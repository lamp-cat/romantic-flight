// 8 巴黎：埃菲尔铁塔立于战神广场北端，北面跨塞纳河的耶拿桥、夏乐宫两翼与特罗卡德罗花园喷泉；再往北为凯旋门与星形广场（12 条放射大道）。
// 实际轴线为西北—东南走向，这里转成南北向，距离压缩约一半。
import * as THREE from 'three';
import { V3, BOX } from './kit.js';

const ARC = [76, -296], TRO = [0, -236], SEINE = -84, SHW = 21;
const IRON = [0.52, 0.42, 0.32], IRON2 = [0.44, 0.35, 0.27], STONE = [0.92, 0.88, 0.78];

export default {
  key: 'paris',
  scene: { name: 'Eiffel Tower · Tour Eiffel', sub: 'Champ de Mars · Trocadéro · Arc de Triomphe · Paris', lat: 48.8584, lon: 2.2945,
    zoom: 1.05, tilt: 0.62, planeY: 236, clouds: { count: 2, min: 0.5, max: 0.7, y: 262 }, look: 'soft' },
  origin: [24, -1300],
  layout: /* glsl */ `
float paSeine(float x, float z){ return z - (${SEINE}. + 6.*sin(x*.009 + .5)); }
float paRad(float x, float z, float cx, float cz, float n, float r0){
  float dx = x - cx;
  float dz = z - cz;
  float r = sqrt(dx*dx + dz*dz);
  float st = 6.2832/n;
  float a = atan(dz, dx);
  float k = floor(a/st + .5);
  float d = r*abs(sin(a - k*st));
  if (r < r0) return 99.;
  return d;
}
/* 0 奥斯曼街区 1 道路 2 草坪花园 3 塞纳河 4 广场/地标 */
float paKind(float x, float z){
  float s = paSeine(x, z);
  if (abs(s) < ${SHW}.) {
    if (abs(x) < 12.) return 4.;
    return 3.;
  }
  if (abs(s) < ${SHW + 9}.) return 1.;
  if (s > 0.) {
    if (abs(x) < 42. && z < 34.) return 4.;
    if (abs(x) < 52. && z < 200.) return abs(x) > 44. ? 1. : 2.;
    if (abs(x) < 62.) return 1.;
    if (gridD(x, 92., 46.) < 4. || gridD(z, 72., 0.) < 4.) return 1.;
    return 0.;
  }
  float ex = x - ${ARC[0]}.;
  float ez = z - ${ARC[1]}.;
  float er = sqrt(ex*ex + ez*ez);
  if (er < 24.) return 4.;
  if (er < 36.) return 1.;
  if (paRad(x, z, ${ARC[0]}., ${ARC[1]}., 12., 30.) < (abs(ez) < 8. && ex > 0. ? 7. : 4.)) return 1.;
  float tx = x - ${TRO[0]}.;
  float tz = z - ${TRO[1]}.;
  float tr = sqrt(tx*tx + tz*tz);
  if (z > -205. && abs(x) < 70.) return abs(x) < 20. ? 4. : 2.;
  if (tr < 22.) return 4.;
  if (tr < 32.) return 1.;
  if (z > -222. && abs(x) < 120.) return 4.;
  if (paRad(x, z, ${TRO[0]}., ${TRO[1]}., 8., 28.) < 4. && z < -205.) return 1.;
  if (abs(z + 160.) < 4.) return 1.;
  return 0.;
}`,
  names: ['paSeine', 'paRad', 'paKind'], kind: 'paKind',
  groundFn: 'paGround',
  ground: /* glsl */ `
vec3 paGround(vec2 p, float x, float z){
  float k = paKind(x, z);
  float s = paSeine(x, z);
  vec3 asph = vec3(.46,.46,.48);
  if (k > 2.5 && k < 3.5) {
    vec3 c = water(p, vec3(.34,.44,.44), vec3(.46,.54,.50), clamp((${SHW}. - abs(s))/10., 0., 1.));
    return mix(c, s2l(vec3(.72,.70,.66)), band(abs(s) - ${SHW}. + .8, .8, .3));
  }
  vec3 col = s2l(vec3(.80,.78,.74)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) {
    col = grass(p, .15);
    /* 战神广场的砂石小径与花坛分格 */
    if (s > 0.) col = mix(col, s2l(vec3(.86,.80,.66)), max(band(abs(x) - 30., 3., .5), band(mod(z, 44.) - 22., 1.6, .4)*step(abs(x), 30.)));
    else {
      /* 特罗卡德罗：沙瓦洛喷泉长池与斜坡草坪 */
      col = mix(col, s2l(vec3(.86,.82,.72)), band(abs(x) - 28., 2., .4));
    }
  }
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.86,.82,.72)*(.95 + .05*vn(p*.6)));
    if (s < 0. && z > -200. && abs(x) < 15. && z < -118.) col = water(p, vec3(.40,.56,.64), vec3(.56,.70,.74), .5);
    if (abs(s) < ${SHW}.) col = s2l(vec3(.70,.68,.64));
  }
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (k < .5) col = s2l(vec3(.70,.68,.66));
  return col;
}`,
  build(B0, { R }) {
    let B = B0.scaled(0, 0, 0.92, 1.3);
    // ---- 埃菲尔铁塔
    { const w = (y) => 31 * Math.exp(-y / 45) + 0.6;
      // 四条塔腿（底部到二层），沿外凸曲线分段
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        let prev = null;
        for (let i = 0; i <= 10; i++) { const y = i * 6, c = Math.max(w(y) - (y < 30 ? 6 - y * 0.08 : 3 - (y - 30) * 0.06), 1.5), p = new V3(sx * c, y, sz * c);
          if (prev) { const t = 8.4 - i * 0.5; B.beam(prev, p, t, i % 2 ? IRON : IRON2); } prev = p; }
      }
      // 一层底部的装饰拱
      for (let k = 0; k < 4; k++) { const ry = k * Math.PI / 2; let prev = null;
        for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1, xx = t * 20, yy = 26 - 10 * Math.sqrt(Math.max(0, 1 - t * t)) * 0.9, p = new V3(Math.cos(ry) * xx - Math.sin(ry) * 22, yy, -Math.sin(ry) * xx - Math.cos(ry) * 22);
          if (prev) B.beam(prev, p, 1.2, IRON2); prev = p; } }
      // 平台
      const deck = (y, s, h) => { for (const [dx, dz, a, b] of [[0, s / 2 - 2, s, 4], [0, -s / 2 + 2, s, 4], [s / 2 - 2, 0, 4, s], [-s / 2 + 2, 0, 4, s]]) B.box(dx, y, dz, a, h, b, IRON2); };
      deck(29, 40, 4.5); deck(58, 22, 3.2); B.box(0, 58, 0, 16, 3.2, 16, IRON);
      // 上段塔身：方锥筒 + 横向腰带
      for (let i = 0; i < 10; i++) { const y0 = 61 + i * 9.8, r0 = w(y0) * 1.32, r1 = w(y0 + 9.8) * 1.32;
        B.add(new THREE.CylinderGeometry(r1, r0, 9.8, 4, 1, true).translate(0, 4.9, 0), i % 2 ? IRON : IRON2, { x: 0, y: y0, z: 0, ry: Math.PI / 4 });
        B.add(new THREE.CylinderGeometry(r1 * 0.55, r0 * 0.55, 9.8, 4).translate(0, 4.9, 0), [0.30, 0.24, 0.20], { x: 0, y: y0, z: 0, ry: Math.PI / 4 }); }
      B.box(0, 158, 0, 4.6, 4, 4.6, IRON); B.box(0, 162, 0, 3, 3, 3, [0.82, 0.78, 0.66]); B.cyl(0, 165, 0, 0.3, 0.7, 9, [0.80, 0.80, 0.80], 6);
      // 塔下的四个售票亭与花坛
      for (const [x, z] of [[24, 24], [-24, 24], [24, -24], [-24, -24]]) B.box(x * 1.35, 0, z * 1.35, 6, 3, 6, [0.84, 0.80, 0.70]);
    }
    B = B0;
    // ---- 耶拿桥（五孔石桥）
    { const z0 = SEINE - SHW - 2, z1 = SEINE + SHW + 2; B.box(0, 2.6, (z0 + z1) / 2, 24, 1.4, z1 - z0, [0.86, 0.82, 0.72]);
      for (let i = 0; i < 4; i++) B.box(0, 0, z0 + 4 + i * (z1 - z0 - 8) / 3, 26, 2.6, 3, [0.80, 0.76, 0.68]);
      for (const s of [-1, 1]) for (const zz of [z0 + 1, z1 - 1]) { B.box(s * 11, 4, zz, 2.4, 3, 2.4, STONE); B.box(s * 11, 7, zz, 2.6, 2.2, 1.2, [0.70, 0.66, 0.60]); } }
    // 塞纳河另一座桥（比尔哈克姆桥，东侧，双层）
    { const x = 250; B.box(x, 3, SEINE, 22, 1.4, SHW * 2 + 6, [0.70, 0.68, 0.64]); B.box(x, 8, SEINE, 8, 1, SHW * 2 + 6, [0.36, 0.44, 0.38]); for (let i = -2; i <= 2; i++) B.box(x, 0, SEINE + i * 9, 6, 8, 2, [0.70, 0.68, 0.64]); }
    // ---- 夏乐宫：两翼弧形长楼 + 中间平台
    { const cz = TRO[1] + 2;
      for (const s of [-1, 1]) { for (let i = 0; i < 9; i++) { const a = 0.15 + i * 0.13, r = 80, x = s * (24 + Math.sin(a) * r * 0.95), z = cz + 30 - Math.cos(a) * r * 0.42 + 10;
          B.box(x, 0, z, 16, 13, 14, STONE, s * (a - 0.1) * 0.9); B.box(x, 13, z, 16.4, 1, 14.4, [0.78, 0.74, 0.66], s * (a - 0.1) * 0.9); }
        B.box(s * 30, 0, cz + 22, 16, 16, 18, STONE); B.box(s * 30, 16, cz + 22, 16.4, 1, 18.4, [0.78, 0.74, 0.66]); }
      // 喷泉长池里的喷水柱（静态）与两侧台阶
      for (let i = 0; i < 9; i++) B.cyl(i % 2 ? -5 : 5, 0, -130 - i * 7, 0.4, 0.9, 6 + (i % 3) * 2, [0.90, 0.95, 0.98], 6);
      for (const s of [-1, 1]) B.cyl(s * 3, 0, -186, 0.6, 1.2, 12, [0.92, 0.96, 0.98], 6);
      B.box(0, 0, TRO[1], 4, 4, 4, [0.80, 0.76, 0.68]); B.cyl(0, 4, TRO[1], 1, 1.4, 4, [0.30, 0.34, 0.30], 8);
    }
    // ---- 凯旋门
    { const [x, z] = ARC, S = B.scaled(x, z, 1.15);
      S.box(x, 0, z, 18, 30, 34, STONE);
      S.box(x, 30, z, 18.6, 1.4, 34.6, [0.84, 0.80, 0.70]); S.box(x, 31.4, z, 17, 3.4, 33, [0.88, 0.84, 0.74]);
      for (const s of [-1, 1]) { S.box(x + s * 9.1, 0, z, 0.4, 19, 10, [0.30, 0.26, 0.22]); S.box(x, 0, z + s * 17.1, 6, 12, 0.4, [0.30, 0.26, 0.22]); S.box(x + s * 9.2, 8, z + s * 11, 0.4, 8, 5, [0.70, 0.66, 0.58]); }
    }
    // ---- 战神广场南端的军事学校（只露北立面）与沿河的小船码头
    B.box(0, 0, 205, 120, 14, 22, STONE); B.box(0, 14, 205, 30, 6, 16, [0.84, 0.80, 0.70]); B.add(new THREE.SphereGeometry(7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0.40, 0.44, 0.50], { x: 0, y: 20, z: 205 });
    for (const x of [-80, 60, 140]) B.box(x, 0.2, SEINE + SHW - 3, 16, 1.2, 4, [0.52, 0.44, 0.36]);
    void R;
  },
  deco(D) {
    const { P } = D;
    const cream = P([[0.94, 0.90, 0.80], [0.90, 0.86, 0.76], [0.96, 0.92, 0.84], [0.88, 0.84, 0.74], [0.92, 0.88, 0.82]]);
    const zinc = P([[0.50, 0.54, 0.60], [0.46, 0.50, 0.56], [0.54, 0.58, 0.64], [0.42, 0.46, 0.52]]);
    D.blocks(0, 17, { pad: 7.4, skip: 0.04, jitter: 0.06, pal: cream, roof: 'hip', roofPal: zinc, roofH: 3.6, hfn: (x, z, r) => 12 + r() * 3 });
    const tr = P([[0.28, 0.46, 0.26], [0.34, 0.52, 0.28], [0.24, 0.42, 0.24], [0.38, 0.56, 0.30]]);
    // 战神广场两侧的行道树（四排）
    for (let z = D.z0 + 2; z < D.z0 + 160; z += 6) { const lz = D.local(z); if (lz < 40 || lz > 192) continue;
      for (const x of [-40, -35, 35, 40]) D.tree(x, z, 2.6 + D.R() * 0.6, [D.pick(tr), ...tr], { subs: 2 }); }
    // 塞纳河两岸与林荫大道
    for (let x = -330; x < 330; x += 7) for (const off of [SHW + 2, -SHW - 2]) { const zz = D.rowZ(SEINE + off + 6 * Math.sin(x * 0.009 + 0.5)); if (zz !== null && Math.abs(x) > 18 && D.R() < 0.8) D.tree(x, zz, 2.6 + D.R(), [D.pick(tr), ...tr], { subs: 2 }); }
    D.trees(2, 60, tr, { r: [3, 4.5], test: (x, z) => z < -100 && Math.abs(x) > 26 });
  },
  life(D) {
    D.bus([0.28, 0.56, 0.40]);
    D.ew(SEINE - SHW - 3, -1, 4, 12, 0.1); D.ew(SEINE - SHW - 7, 1, 4, 12); D.ew(SEINE + SHW + 3, 1, 4, 12, 0.1); D.ew(SEINE + SHW + 7, -1, 4, 12);
    D.ns(-48, 1, 3, 11); D.ns(48, -1, 3, 11); D.ns(57, 1, 3, 11); D.ns(-57, -1, 3, 11);
    // 星形广场放射大道与环岛
    const [ax, az] = ARC;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); D.seg([ax + c * 36, az + s * 36], [ax + c * 300, az + s * 300], 2, 11, { lanes: [-2, 2] }); }
    const ring = []; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + 0.26; ring.push([ax + Math.cos(a) * 30, az + Math.sin(a) * 30]); }
    for (let k = 0; k < 12; k++) D.seg(ring[k], ring[(k + 1) % 12], 1, 9, { lanes: [0.1] });
    const tr = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; tr.push([TRO[0] + Math.cos(a) * 27, TRO[1] + Math.sin(a) * 27]); }
    for (let k = 0; k < 8; k++) D.seg(tr[k], tr[(k + 1) % 8], 1, 8, { lanes: [0.1] });
    // 塞纳河游船
    D.ferry([[-420, SEINE - 6], [420, SEINE - 6], [420, SEINE + 6], [-420, SEINE + 6]], 8, [0.94, 0.94, 0.92], [0.60, 0.70, 0.78], 1.3);
    D.ferry([[420, SEINE + 6], [-420, SEINE + 6], [-420, SEINE - 6], [420, SEINE - 6]], 8, [0.20, 0.24, 0.30], [0.90, 0.90, 0.88], 1.2);
    D.ferry([[-420, SEINE + 2], [420, SEINE + 2], [420, SEINE - 2], [-420, SEINE - 2]], 7, [0.92, 0.90, 0.86], [0.70, 0.76, 0.80], 1.2);
    D.crowd(-40, -38, 40, 32, 46, [[-14, -14, 14, 14]]);
    D.crowd(-30, 40, 30, 190, 30);
    D.crowd(-110, -222, 110, -205, 26);
    D.crowd(-18, -200, 18, -118, 12, [[-15, -195, 15, -118]]);
    D.crowd(-11, SEINE - SHW, 11, SEINE + SHW, 8);
  },
  taxi: [[0.92, 0.92, 0.92], [0.20, 0.22, 0.26]],
};
