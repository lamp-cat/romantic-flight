// 地标世界的建模工具箱：合并构建器 + 中式建筑部件（屋顶、殿堂、城台、宫墙、角楼、院落）。各城市模块共用。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const V3 = THREE.Vector3;
export const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- 合并构建器
export const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
export const BEAM = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
export const BLOB = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();
const _o = new THREE.Object3D();
export class Builder {
  constructor() { this.g = { flat: [], smooth: [], shell: [] }; }
  add(geo, color, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, kind = 'flat', matrix = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    else { _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)); g.applyMatrix4(_m); }
    const c = Array.isArray(color) ? sc(...color) : color, n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.g[kind].push(g); return g;
  }
  box(x, y, z, w, h, d, color, ry = 0) { return this.add(BOX, color, { x, y, z, ry, sx: w, sy: h, sz: d }); }
  // 两点之间的方梁
  beam(a, b, t, color, t2 = t) {
    const len = a.distanceTo(b); _o.position.copy(a).add(b).multiplyScalar(0.5); _o.lookAt(b); _o.scale.set(t, t2, len); _o.updateMatrix();
    return this.add(BEAM, color, { matrix: _o.matrix.clone() });
  }
  cyl(x, y, z, rt, rb, h, color, seg = 12, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, o.open || false).translate(0, h / 2, 0), color, { x, y, z, ry: o.ry || 0, kind: o.kind }); }
  // 旋转体：pts = [[r, y], ...]（自下而上）
  lathe(x, y, z, pts, color, seg = 16, o = {}) {
    const g = new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(Math.max(0.001, r), yy)), seg);
    return this.add(g, color, { x, y, z, ry: o.ry || 0, sx: o.sx || 1, sz: o.sz || 1, kind: o.kind || 'smooth' });
  }
  // 竖直拉伸的多边形（pts 为 xz 平面的轮廓，逆时针或顺时针皆可）
  prism(pts, y0, h, color, o = {}) {
    const sh = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
    return this.add(g, color, { x: o.x || 0, y: y0, z: o.z || 0, ry: o.ry || 0, kind: o.kind });
  }
  // 任意三角形（平铺坐标数组）
  tris(arr, color, o = {}) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
    return this.add(g, color, o);
  }
  // 以 (cx, 0, cz) 为中心整体放大 s 倍的子构建器（地标夸张用）
  scaled(cx, cz, s, sy = s) {
    const base = this, M = new THREE.Matrix4().makeTranslation(cx, 0, cz).multiply(new THREE.Matrix4().makeScale(s, sy, s)).multiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
    const o = Object.create(this); o.add = (geo, color, opt) => base.add(geo, color, opt).applyMatrix4(M); return o;
  }
  blob(x, y, z, r, color, sy = 1) { return this.add(BLOB, color, { x, y, z, sx: r, sy: r * sy, sz: r, ry: x * 0.37 + z }); }
  tree(x, z, r, cols, y = 0, R = Math.random) {
    this.box(x, y, z, r * 0.25, r * 0.9, r * 0.25, [0.42, 0.30, 0.20]);
    this.blob(x, y + r * 1.15, z, r, cols[0], 0.85);
    for (let k = 0; k < 3; k++) { const a = R() * 6.28, d = r * 0.55; this.blob(x + Math.cos(a) * d, y + r * (1.05 + R() * 0.2), z + Math.sin(a) * d, r * 0.62, cols[1 + (k % (cols.length - 1))], 0.85); }
  }
  build() {
    const grp = new THREE.Group();
    const mats = {
      flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
      smooth: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      shell: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: sc(0.5, 0.5, 0.48) }),
    };
    for (const k of Object.keys(this.g)) {
      if (!this.g[k].length) continue;
      const geo = mergeGeometries(this.g[k]); this.g[k].forEach((g) => g.dispose());
      const m = new THREE.Mesh(geo, mats[k]); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; grp.add(m);
    }
    return grp;
  }
}

// ---------------------------------------------------------------- 中式屋顶：凹曲面 + 起翘的檐角（庑殿 / 攒尖 / 下檐）
export function ring(a, b, y, lift) {
  return [[-a, y + lift, -b], [0, y, -b], [a, y + lift, -b], [a, y, 0], [a, y + lift, b], [0, y, b], [-a, y + lift, b], [-a, y, 0]];
}
export function loft(rings) {
  const pos = [];
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < 8; i++) {
    const a = rings[r][i], b = rings[r][(i + 1) % 8], c = rings[r + 1][(i + 1) % 8], d = rings[r + 1][i];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
// w×d 为檐口外沿尺寸，h 为屋顶高度；ridge 正脊长度比例（0 = 攒尖）
export function roofGeo(w, d, h, ridge = 1, up = 0.26) {
  const a0 = w / 2, b0 = d / 2, inset = b0 * 0.4;
  const ar = Math.max(0, (w - d) / 2) * ridge;
  const a1 = Math.max(ar + 0.1, a0 - inset), b1 = b0 - inset;
  return loft([ring(a0, b0, 0, h * up), ring(a1, b1, h * 0.34, h * 0.06), ring(ar, 0.01, h, 0)]);
}
export function skirtGeo(w, d, h, wi, di, up = 0.24) {
  return loft([ring(w / 2, d / 2, 0, h * up), ring(wi / 2 + (w - wi) * 0.18, di / 2 + (d - di) * 0.18, h * 0.55, h * 0.05), ring(wi / 2, di / 2, h, 0)]);
}
export const C = {
  red: [0.72, 0.17, 0.13], darkRed: [0.55, 0.12, 0.10], yellow: [0.98, 0.76, 0.20], ridge: [0.86, 0.58, 0.12], teal: [0.18, 0.50, 0.46],
  marble: [0.94, 0.93, 0.89], stone: [0.80, 0.78, 0.74], greyRoof: [0.40, 0.41, 0.44], green: [0.22, 0.48, 0.25],
};
// 殿堂：台基 + 红柱身 + 彩画梁带 + （重檐）屋顶
export function hall(B, { x, z, ry = 0, w, d, h, roofH, eaves = 1, y = 0, roofC = C.yellow, wallC = C.red, beamC = C.teal, ridge = 1, plinth = 0, plinthC = C.marble, o }) {
  const ov = o ?? Math.max(1.4, d * 0.14);
  const add = (geo, col, yy) => B.add(geo, col, { x, y: yy, z, ry });
  if (plinth) { add(BOX.clone().scale(w + 5, plinth, d + 5), plinthC, y); y += plinth; }
  add(BOX.clone().scale(w, h, d), wallC, y);
  add(BOX.clone().scale(w + 0.5, h * 0.2, d + 0.5), beamC, y + h * 0.8);
  let tw = w, td = d, ty = y + h;
  if (eaves === 2) {
    const hs = roofH * 0.42, wi = w * 0.84, di = d * 0.7, hu = h * 0.55;
    add(skirtGeo(w + ov * 2, d + ov * 2, hs, wi, di), roofC, ty - hs * 0.15);
    add(BOX.clone().scale(wi, hu + hs * 0.6, di), wallC, ty);
    add(BOX.clone().scale(wi + 0.4, hu * 0.3, di + 0.4), beamC, ty + hs * 0.6 + hu * 0.7);
    tw = wi; td = di; ty += hs * 0.6 + hu;
  }
  add(roofGeo(tw + ov * 2, td + ov * 2, roofH, ridge), roofC, ty);
  const ar = Math.max(0, (tw - td) / 2) * ridge;
  if (ar > 0.5) add(BOX.clone().scale(ar * 2 + 1, 0.9, 0.9), C.ridge, ty + roofH - 0.3);
  else B.add(BLOB, [0.95, 0.70, 0.18], { x, y: ty + roofH + 0.4, z, sx: 0.9, sy: 1.3, sz: 0.9 });
  return ty + roofH;
}
// 城台：红墙台座 + 黄琉璃压顶 + 南面券门
export function platform(B, { x, z, w, d, h, ry = 0, col = C.red, doors = [], doorFace = 1 }) {
  B.box(x, 0, z, w, h, d, col, ry);
  B.box(x, h, z, w + 0.8, 0.8, d + 0.8, [0.90, 0.70, 0.30], ry);
  B.box(x, h + 0.8, z, w - 1, 0.7, d - 1, [0.86, 0.84, 0.80], ry);
  for (const [dx, dw, dh] of doors) B.box(x + dx, 0, z + doorFace * (d / 2), dw, dh, 0.6, [0.18, 0.12, 0.10], ry);
  return h + 0.8;
}
// 一圈宫墙
export function wallRing(B, x0, z0, x1, z1, h, t, col = C.red, cap = C.yellow, gaps = []) {
  const seg = (ax, az, bx, bz) => {
    const w = Math.abs(bx - ax) || t, d = Math.abs(bz - az) || t, cx = (ax + bx) / 2, cz = (az + bz) / 2;
    B.box(cx, 0, cz, w, h, d, col); B.box(cx, h, cz, w + 0.5, 0.6, d + 0.5, cap);
  };
  const cut = (a, b, fixed, horiz) => {   // 沿一条边按缺口切分
    let s = a; const gs = gaps.filter((g) => g.horiz === horiz && Math.abs(g.at - fixed) < 0.5).sort((p, q) => p.from - q.from);
    for (const g of gs) { if (g.from > s) horiz ? seg(s, fixed, g.from, fixed) : seg(fixed, s, fixed, g.from); s = g.to; }
    if (b > s) horiz ? seg(s, fixed, b, fixed) : seg(fixed, s, fixed, b);
  };
  cut(x0, x1, z0, true); cut(x0, x1, z1, true); cut(z0, z1, x0, false); cut(z0, z1, x1, false);
}
// 长廊（庑房）：沿 x（ry=0）或 z 方向的一排低矮殿房
export function gallery(B, x0, z0, x1, z1, h = 3.2, roofC = C.yellow) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), horiz = w >= d;
  hall(B, { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ry: horiz ? 0 : Math.PI / 2, w: horiz ? w : d, d: horiz ? d : w, h, roofH: 2.6, roofC, o: 1.2 });
}
// 角楼：十字脊多重檐
export function cornerTower(B, x, z) {
  B.box(x, 0, z, 17, 6.5, 17, C.red); B.box(x, 6.5, z, 18, 0.8, 18, [0.88, 0.70, 0.30]);
  B.box(x, 7.3, z, 9, 5, 9, C.red);
  B.add(skirtGeo(16, 16, 2.4, 9, 9), C.yellow, { x, y: 9.8, z });
  B.add(roofGeo(15, 8, 4, 1), C.yellow, { x, y: 12.2, z });
  B.add(roofGeo(15, 8, 4, 1), C.yellow, { x, y: 12.2, z, ry: Math.PI / 2 });
  B.add(roofGeo(8, 8, 4.6, 0), C.yellow, { x, y: 13.4, z });
  B.add(BLOB, [0.95, 0.70, 0.18], { x, y: 18.2, z, sx: 0.8, sy: 1.2, sz: 0.8 });
}
// 院落单元：红墙围合 + 正殿 + 东西配殿（+ 后殿）
export function courtyard(B, x0, z0, x1, z1, R, big = false) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2;
  if (w < 12 || d < 12) return;
  wallRing(B, x0, z0, x1, z1, 2.4, 1.0, C.red, C.yellow, [{ horiz: true, at: z1, from: cx - 2.5, to: cx + 2.5 }]);
  const mw = Math.min(w - 5, big ? 26 : 18), md = Math.min(d * 0.3, big ? 11 : 8);
  hall(B, { x: cx, z: z0 + d * 0.3, w: mw, d: md, h: big ? 4.5 : 3.6, roofH: big ? 4.6 : 3.6, eaves: big && R() < 0.5 ? 2 : 1, plinth: 0.8 });
  if (d > 22) for (const s of [-1, 1]) if (R() < 0.85) hall(B, { x: cx + s * (w / 2 - 4.2), z: z0 + d * 0.66, ry: Math.PI / 2, w: d * 0.34, d: 5, h: 2.8, roofH: 2.7, o: 1 });
  if (d > 30 && R() < 0.6) hall(B, { x: cx, z: z1 - 5, w: mw * 0.8, d: 5.5, h: 2.8, roofH: 2.8, o: 1 });
  if (R() < 0.35) B.tree(cx + (R() - 0.5) * w * 0.4, z0 + d * 0.7, 3.2, [[0.24, 0.48, 0.24], [0.30, 0.56, 0.28], [0.20, 0.42, 0.22]], 0, R);
}
export function fillCourts(B, x0, z0, x1, z1, R, cw = 26, cd = 30, big = false) {
  const nx = Math.max(1, Math.round((x1 - x0) / cw)), nz = Math.max(1, Math.round((z1 - z0) / cd));
  const W = (x1 - x0) / nx, D = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (R() < 0.08) continue;
    const a = x0 + i * W + 1.2, b = z0 + j * D + 1.2;
    courtyard(B, a, b, a + W - 2.4, b + D - 2.4, R, big);
  }
}
