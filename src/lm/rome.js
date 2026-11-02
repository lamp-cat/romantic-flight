// 12 罗马：斗兽场（椭圆外墙北侧完整、南侧外圈坍塌露出第二圈，内部看台与地下室格墙），西南的君士坦丁凯旋门，
// 西北的古罗马广场遗迹、维纳斯与罗马神庙、马克森提乌斯巴西利卡，帝国广场大道斜向通往威尼斯广场；帕拉蒂尼山上的伞松。
import * as THREE from 'three';
import { V3, BOX } from './kit.js';

const AX = 47, AZ = 39, ARCH = [-66, 70], TRAV = [0.88, 0.82, 0.70], TRAV2 = [0.78, 0.72, 0.60], BRICK = [0.72, 0.56, 0.44], MARBLE = [0.92, 0.90, 0.86];

export default {
  key: 'rome',
  scene: { name: 'Colosseum · Colosseo', sub: 'Arch of Constantine · Roman Forum · Palatine Hill · Rome', lat: 41.8902, lon: 12.4922,
    zoom: 1.36, tilt: 0.62, planeY: 90, clouds: { count: 2, min: 0.5, max: 0.7, y: 120 }, look: 'warm' },
  origin: [-50, -1300],
  layout: /* glsl */ `
float roFori(float x, float z){ return abs((z + 40.) - (x + 40.)*.62)*.85; }
/* 0 街区 1 道路 2 公园 4 遗址/广场 6 帕拉蒂尼山 */
float roKind(float x, float z){
  float e = ellD(x, z, 0., 0., ${AX + 22}., ${AZ + 22}.);
  if (e < 0.) return 4.;
  if (e < 10.) return 1.;
  if (x < -30. && x > -320. && roFori(x, z) < 7. && z < -20.) return 1.;
  if (rectD(x, z, ${ARCH[0] - 26}., 38., ${ARCH[0] + 26}., 100.) < 0.) return 4.;
  if (abs(x - ${ARCH[0]}.) < 6. && z > 100.) return 1.;
  if (x < -40. && z > 40. && x > -330.) return 6.;
  if (x < -40. && z < 40. && z > -150. + max(0., -x - 200.)*0. && x > -330. && (z - 40.) > (x + 40.)*.62 - 6.) return 4.;
  if (x < -30. && z < -20. && (z + 40.) < (x + 40.)*.62 - 7. && x > -330.) {
    if (rectD(x, z, -330., -330., -210., -200.) < 0.) return 4.;
    if (gridD(x, 50., 0.) < 3. || gridD(z, 44., 0.) < 3.) return 1.;
    return 0.;
  }
  if (abs(z - 4.) < 6. && x > 60.) return 1.;
  if (x > 30. && z < -40. && x < 220.) return 2.;
  if (x > 20. && z > 60. && x < 160.) return 2.;
  if (gridD(x, 52., 26.) < 3. || gridD(z, 46., 4.) < 3.) return 1.;
  return 0.;
}
float roHeight(float x, float z){
  float h = smoothstep(30., 90., z)*smoothstep(-36., -90., x)*smoothstep(-340., -300., x);
  return h*16.*(1. + .1*sin(x*.05)*sin(z*.04));
}`,
  names: ['roFori', 'roKind', 'roHeight'], kind: 'roKind', height: 'roHeight',
  groundFn: 'roGround',
  ground: /* glsl */ `
vec3 roGround(vec2 p, float x, float z){
  float k = roKind(x, z);
  vec3 asph = vec3(.50,.48,.46);
  vec3 col = s2l(vec3(.80,.74,.64)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) col = grass(p, .3 + .4*smoothstep(.45,.62,fbm(p*.04)));
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.84,.78,.66)*(.94 + .07*vn(p*.5)));
    col = mix(col, grass(p, .5), smoothstep(.5, .7, vn(p*.08))*.5);
    if (x < -40.) col = mix(col, s2l(vec3(.70,.64,.54)), smoothstep(.3, .7, vn(p*.3))*.4);
  }
  if (k > 5.5 && k < 6.5) col = mix(grass(p, .45), s2l(vec3(.74,.66,.54)), smoothstep(.55, .7, vn(p*.05))*.6);
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (k < .5) col = s2l(vec3(.78,.66,.54)*(.95 + .05*paint(p)));
  return col;
}`,
  build(B, { R, H }) {
    // ---- 斗兽场
    { const N = 72, el = (a, s) => [Math.cos(a) * AX * s, Math.sin(a) * AZ * s];
      // 外墙：北半圈完整四层（24 高），南半圈外圈坍塌，露出较矮的第二圈
      for (let i = 0; i < N; i++) {
        const a = (i + 0.5) / N * Math.PI * 2, [x, z] = el(a, 1), [x2, z2] = el(a, 0.9), tang = -Math.atan2(Math.cos(a) * AZ, -Math.sin(a) * AX);
        const len = Math.hypot(...el(a + Math.PI / N, 1).map((v, k) => v - el(a - Math.PI / N, 1)[k])) + 0.2;
        const south = Math.sin(a) > 0.08 && Math.cos(a) < 0.75, h = south ? 0 : 24;
        if (h) {
          B.box(x, 0, z, len, h, 3, TRAV, tang);
          for (let r = 0; r < 3; r++) B.box(x + Math.cos(a) * 1.55, 1.5 + r * 6.6, z + Math.sin(a) * 1.55, len * 0.55, 4.4, 0.3, [0.30, 0.24, 0.20], tang);
          B.box(x + Math.cos(a) * 1.55, 21, z + Math.sin(a) * 1.55, len * 0.25, 1.2, 0.3, [0.36, 0.30, 0.24], tang);
          B.box(x, h, z, len, 0.6, 3.4, TRAV2, tang);
        }
        const h2 = south ? 14 + 5 * Math.sin(i * 1.7) + 3 * Math.sin(i * 0.5) : 20;
        B.box(x2, 0, z2, len * 0.9, h2, 2.4, south ? [0.82, 0.74, 0.62] : TRAV2, tang);
        if (south) for (let r = 0; r < 2; r++) B.box(x2 + Math.cos(a) * 1.25, 1.5 + r * 6.6, z2 + Math.sin(a) * 1.25, len * 0.5, 4.2, 0.3, [0.34, 0.26, 0.20], tang);
      }
      // 坍塌处的扶壁（瓦拉迪耶修复的砖扶壁）
      for (const a of [0.12, 2.6]) { const [x, z] = el(a, 1.02); B.box(x, 0, z, 7, 22, 5, [0.86, 0.70, 0.56], -a); }
      // 看台：自外向内阶梯下降的椭圆环（残破，砖色）+ 放射墙
      const rings = [[0.88, 19], [0.80, 15], [0.72, 11], [0.64, 7.4], [0.58, 4.6]], arr = [];
      for (let j = 0; j < rings.length - 1; j++) { const [s0, y0] = rings[j], [s1, y1] = rings[j + 1];
        for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, w = 0.6 + 0.4 * Math.abs(Math.sin(i * 2.3 + j));
          const p = (a, s, y) => { const [x, z] = el(a, s); return [x, y * w + (1 - w) * 6, z]; };
          arr.push(...p(a0, s0, y0), ...p(a1, s1, y1), ...p(a1, s0, y0), ...p(a0, s0, y0), ...p(a0, s1, y1), ...p(a1, s1, y1)); } }
      B.tris(arr, BRICK);
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, [xa, za] = el(a, 0.56), [xb, zb] = el(a, 0.88); B.beam(new V3(xa, 2.4, za), new V3(xb, 9, zb), 1.2, [0.66, 0.50, 0.40], 4.8); }
      // 竞技场：地下室格墙 + 东端复原的木地板
      B.add(new THREE.CylinderGeometry(1, 1, 0.4, 40), [0.42, 0.34, 0.28], { x: 0, y: 0, z: 0, sx: AX * 0.56, sz: AZ * 0.56 });
      for (let k = -5; k <= 5; k++) B.box(k * 4.2, 0, 0, 0.8, 3, (AZ * 0.5) * Math.sqrt(Math.max(0, 1 - (k * 4.2 / (AX * 0.54)) ** 2)) * 2, [0.66, 0.52, 0.40]);
      for (const zz of [-8, -3, 3, 8]) B.box(0, 0, zz, AX * 0.9 * Math.sqrt(1 - (zz / (AZ * 0.55)) ** 2), 2.4, 0.8, [0.62, 0.48, 0.38]);
      B.box(19, 3, 0, 10, 0.5, 18, [0.70, 0.56, 0.40]);
    }
    // ---- 君士坦丁凯旋门
    { const [x, z] = ARCH, S = B.scaled(x, z, 1.4), M = [0.90, 0.86, 0.78];
      S.box(x, 0, z, 18, 15, 6, M); S.box(x, 15, z, 18.4, 0.8, 6.4, [0.80, 0.76, 0.68]); S.box(x, 15.8, z, 17, 4.8, 5.6, M);
      for (const s of [-1, 1]) { S.box(x, 0, z + s * 3.05, 5.4, 10, 0.3, [0.26, 0.22, 0.18]); S.box(x - 6.4, 0, z + s * 3.05, 2.8, 6, 0.3, [0.26, 0.22, 0.18]); S.box(x + 6.4, 0, z + s * 3.05, 2.8, 6, 0.3, [0.26, 0.22, 0.18]);
        for (const dx of [-8.4, -4, 4, 8.4]) { S.cyl(x + dx, 2, z + s * 3.5, 0.6, 0.6, 10.6, [0.82, 0.74, 0.62], 8); S.box(x + dx, 12.6, z + s * 3.6, 1.2, 4, 0.8, [0.84, 0.80, 0.72]); } } }
    // ---- 维纳斯与罗马神庙（斗兽场西北，台基 + 列柱残迹）
    { const x = -84, z = -14; B.box(x, 0, z, 60, 4, 34, [0.80, 0.76, 0.68]);
      for (let i = 0; i < 12; i++) for (const s of [-1, 1]) if (R() < 0.7) B.cyl(x - 27 + i * 5, 4, z + s * 14, 0.9, 1, 6 + R() * 6, MARBLE, 8);
      B.box(x, 4, z, 14, 10, 12, BRICK); B.add(new THREE.CylinderGeometry(6, 6, 12, 12, 1, false, 0, Math.PI), BRICK, { x, y: 14, z, rx: Math.PI / 2, ry: Math.PI / 2 }); }
    // ---- 古罗马广场：马克森提乌斯巴西利卡的三个大拱、提图斯凯旋门、成排的柱子与神庙台基
    { const bx = -150, bz = -40; for (let k = 0; k < 3; k++) { B.box(bx - 14 + k * 14, 0, bz, 4, 20, 26, BRICK); B.add(new THREE.CylinderGeometry(7, 7, 26, 10, 1, true, 0, Math.PI), BRICK, { x: bx - 7 + k * 14, y: 13, z: bz, rx: Math.PI / 2, ry: -Math.PI / 2 }); } B.box(bx, 0, bz + 14, 46, 12, 2, BRICK); }
    { const x = -116, z = 18; B.box(x, 0, z, 8, 10, 5, MARBLE); B.box(x, 0, z + 2.6, 3, 6, 0.3, [0.26, 0.22, 0.18]); B.box(x, 10, z, 8.4, 2.4, 5.4, [0.86, 0.82, 0.74]); }
    for (let k = 0; k < 18; k++) { const x = -190 - R() * 120, z = -30 + R() * 90; if ((z - 40) < (x + 40) * 0.62 - 4 || H(x, z) > 3) continue;
      const w = 10 + R() * 16, d = 8 + R() * 14; B.box(x, 0, z, w, 1.6 + R() * 2, d, [0.80, 0.76, 0.68]);
      if (R() < 0.6) { const n = 3 + Math.floor(R() * 5); for (let i = 0; i < n; i++) B.cyl(x - w / 2 + 1.5 + i * (w - 3) / Math.max(1, n - 1), 1.6, z - d / 2 + 1.5, 0.7, 0.8, 7 + R() * 7, MARBLE, 8); if (R() < 0.5) B.box(x, 15, z - d / 2 + 1.5, w - 1, 1.6, 2, MARBLE); } }
    // ---- 帕拉蒂尼山：宫殿砖墙遗迹
    for (let k = 0; k < 14; k++) { const x = -110 - R() * 200, z = 110 + R() * 120, y = H(x, z) - 1; B.box(x, y, z, 6 + R() * 18, 3 + R() * 9, 2 + R() * 3, BRICK, R() < 0.5 ? 0 : Math.PI / 2); }
    // ---- 维托里亚诺（威尼斯广场，西北角）
    { const x = -270, z = -265; B.box(x, 0, z, 90, 12, 40, MARBLE); B.box(x, 12, z - 4, 80, 14, 24, MARBLE);
      for (let i = 0; i < 16; i++) B.cyl(x - 37 + i * 4.9, 12, z + 8.6, 0.9, 0.9, 14, [0.96, 0.95, 0.92], 8);
      B.box(x, 26, z - 4, 82, 2, 26, [0.90, 0.88, 0.84]); for (const s of [-1, 1]) { B.box(x + s * 38, 28, z + 6, 6, 6, 6, MARBLE); B.box(x + s * 38, 34, z + 6, 5, 3, 3, [0.40, 0.36, 0.30]); } }
    // 圣母院钟楼风格的方塔（Santa Francesca Romana）与路旁的柱子
    B.box(-108, 0, -44, 6, 26, 6, [0.76, 0.56, 0.42]); B.cyl(-108, 26, -44, 0.3, 4.4, 4, [0.70, 0.50, 0.38], 4, { ry: Math.PI / 4 });
  },
  deco(D) {
    const { P } = D;
    const ochre = P([[0.90, 0.72, 0.52], [0.86, 0.62, 0.44], [0.94, 0.82, 0.62], [0.82, 0.56, 0.40], [0.92, 0.86, 0.74], [0.78, 0.48, 0.36]]);
    const terra = P([[0.74, 0.40, 0.28], [0.70, 0.36, 0.24], [0.80, 0.46, 0.32], [0.66, 0.38, 0.28]]);
    D.blocks(0, 13, { pad: 5.2, skip: 0.06, pal: ochre, roof: 'hip', roofPal: terra, roofH: 2.8, hfn: (x, z, r) => 9 + r() * 8 });
    const pine = P([[0.20, 0.36, 0.22], [0.24, 0.40, 0.24], [0.18, 0.32, 0.20], [0.28, 0.44, 0.26]]);
    const cyp = P([[0.16, 0.30, 0.18], [0.20, 0.34, 0.20]]);
    // 伞松：伞状扁平树冠、高树干
    D.trees([6], 160, pine, { r: [5, 7.5], flat: 0.42, h: 1.9, subs: 3, xr: 330 });
    D.trees([2], 300, pine, { r: [4.5, 6.5], flat: 0.45, h: 1.8, subs: 3, xr: 260 });
    D.trees([4], 16, pine, { r: [4.5, 6.5], flat: 0.42, h: 1.9, subs: 3, test: (x, z) => x < -40 && z > -10 });
    D.trees([6], 30, cyp, { r: [1.6, 2], flat: 3.2, h: 0.5, subs: 0 });
  },
  life(D) {
    D.bus([0.86, 0.80, 0.30]);
    D.seg([-40, -40], [-320, -214], 4, 11, { lanes: [-2.4, 2.4] });
    D.ew(1, -1, 3, 11); D.ew(7, 1, 3, 11);
    D.ns(ARCH[0] - 2, -1, 2, 10); D.ns(ARCH[0] + 2, 1, 2, 10);
    const ring = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; ring.push([Math.cos(a) * (AX + 27), Math.sin(a) * (AZ + 27)]); }
    for (let k = 0; k < 16; k += 2) D.seg(ring[k], ring[(k + 1) % 16], 1, 7, { lanes: [0.1] });
    D.crowd(-66, -60, 66, -42, 30); D.crowd(-66, 42, 66, 60, 26); D.crowd(-68, -40, -50, 40, 12); D.crowd(50, -40, 68, 40, 12);
    D.crowd(ARCH[0] - 20, ARCH[1] - 22, ARCH[0] + 20, ARCH[1] - 8, 16);
    D.crowd(-300, -20, -120, 30, 30);
    D.crowd(-16, -14, 16, 14, 14);
  },
  taxi: [[0.96, 0.96, 0.96]],
};
