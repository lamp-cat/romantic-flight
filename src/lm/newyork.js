// 9 纽约港：自由女神像立于自由岛的十一角星形堡垒上；西北为埃利斯岛；北面曼哈顿下城（炮台公园、世贸一号楼）与布鲁克林大桥；港湾里的橙色史泰登岛渡轮与帆船。
// 中央公园位于更北的 z −640…−860（飞过去才看得到）。距离压缩约一半。
import * as THREE from 'three';
import { V3, BOX } from './kit.js';

const LIB = [-56, 18], ELLIS = [-170, -90], WTC = [40, -246], GOV = [178, -112];
const GREEN = [0.46, 0.70, 0.62], GRANITE = [0.80, 0.76, 0.70];

export default {
  key: 'newyork',
  scene: { name: 'Statue of Liberty · New York Harbor', sub: 'Liberty Island · Ellis Island · Lower Manhattan', lat: 40.6892, lon: -74.0445,
    zoom: 1.12, tilt: 0.62, planeY: 165, clouds: { count: 2, min: 0.5, max: 0.75, y: 190 }, look: 'day' },
  origin: [34, -1300],
  layout: /* glsl */ `
float nyCx(float z){ return 40. + max(0., -200. - z)*.28; }
float nyMan(float x, float z){
  if (z > -172.) return 99.;
  float hw = min(80., 16. + (-172. - z)*.9);
  return abs(x - nyCx(z)) - hw;
}
float nyBrook(float x, float z){ return 245. + max(0., -z - 120.)*.36 + 14.*sin(z*.02) - x; }
float nyJersey(float x, float z){ return x - (-250. - z*.12 + 10.*sin(z*.025)); }
/* 0 布鲁克林/泽西城 1 道路 2 公园 3 水 4 地标 7 曼哈顿 */
float nyKind(float x, float z){
  float m = nyMan(x, z);
  if (m < 0.) {
    if (z > -206. || (z < -640. && z > -860. && abs(x - nyCx(z)) < 30.)) return 2.;
    if (m > -6.) return 1.;
    float u = x - nyCx(z);
    if (gridD(u, 36., 0.) < 3. || gridD(z, 22., 0.) < 2.) return 1.;
    return 7.;
  }
  if (ellD(x, z, ${LIB[0]}., ${LIB[1] + 4}., 62., 46.) < 0.) return 4.;
  if (rectD(x, z, ${ELLIS[0] - 24}., ${ELLIS[1] - 16}., ${ELLIS[0] + 24}., ${ELLIS[1] + 18}.) < 0.) return 4.;
  if (ellD(x, z, ${GOV[0]}., ${GOV[1]}., 40., 28.) < 0.) return 2.;
  if (nyBrook(x, z) < 0.) {
    if (nyBrook(x, z) > -8.) return 1.;
    if (gridD(x, 40., 0.) < 3. || gridD(z, 30., 0.) < 3.) return 1.;
    return 0.;
  }
  if (nyJersey(x, z) < 0.) {
    if (nyJersey(x, z) > -10.) return 2.;
    if (gridD(x, 40., 0.) < 3. || gridD(z, 34., 0.) < 3.) return 1.;
    return 0.;
  }
  return 3.;
}`,
  names: ['nyCx', 'nyMan', 'nyBrook', 'nyJersey', 'nyKind'], kind: 'nyKind',
  groundFn: 'nyGround',
  ground: /* glsl */ `
vec3 nyGround(vec2 p, float x, float z){
  float k = nyKind(x, z);
  vec3 asph = vec3(.44,.45,.48);
  if (k > 2.5 && k < 3.5) {
    float sh = min(min(abs(nyMan(x, z)), abs(nyBrook(x, z))), abs(nyJersey(x, z)));
    sh = min(sh, abs(ellD(x, z, ${LIB[0]}., ${LIB[1] + 4}., 62., 46.)));
    vec3 c = water(p, vec3(.30,.42,.52), vec3(.42,.54,.60), clamp(sh/40., 0., 1.));
    return mix(c, s2l(vec3(.82,.84,.84)), band(sh - 1., .5, .4)*.4);
  }
  vec3 col = s2l(vec3(.74,.73,.71)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) col = grass(p, .2 + .4*smoothstep(.45,.62,fbm(p*.04)));
  if (k > 3.5 && k < 4.5) {
    col = grass(p, .1);
    col = mix(col, s2l(vec3(.84,.82,.78)), smoothstep(.2, .6, vn(p*.2))*.3);
    float e = ellD(x, z, ${LIB[0]}., ${LIB[1] + 4}., 44., 32.);
    col = mix(col, s2l(vec3(.70,.68,.64)), band(e + 2., 2., .4));
    if (x < -80.) col = s2l(vec3(.82,.80,.76));
  }
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (k > 6.5) col = s2l(vec3(.66,.66,.66));
  return col;
}`,
  build(B0, { R }) {
    const B = B0;
    // ---- 自由女神像：十一角星形堡垒 + 花岗岩基座 + 铜绿色雕像（面朝南）
    { const [x, z] = LIB, S = B0.scaled(x, z, 1.8), star = [];
      for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, r = i % 2 ? 15 : 23; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
      S.prism(star, 0, 6, [0.76, 0.72, 0.64], { x, z });
      S.prism(star.map(([a, b]) => [a * 0.9, b * 0.9]), 6, 0.6, [0.66, 0.70, 0.60], { x, z });
      S.box(x, 6, z, 14, 4, 14, GRANITE); S.box(x, 10, z, 11, 12, 11, GRANITE); S.box(x, 22, z, 12, 1.5, 12, [0.72, 0.68, 0.62]);
      for (const [dx, dz, w, d] of [[0, 5.6, 4, 0.3], [0, -5.6, 4, 0.3], [5.6, 0, 0.3, 4], [-5.6, 0, 0.3, 4]]) S.box(x + dx, 13, z + dz, w, 6, d, [0.62, 0.58, 0.54]);
      const y0 = 23.5;
      S.lathe(x, y0, z, [[0.1, 0], [4.6, 0], [4.4, 3], [3.8, 9], [3.3, 14], [3.0, 17], [3.2, 19], [2.4, 21], [0.9, 22.4], [0.1, 22.6]], GREEN, 14, { sx: 1, sz: 0.82 });
      S.add(new THREE.SphereGeometry(1.8, 12, 10), GREEN, { x, y: y0 + 24, z: z + 0.2, kind: 'smooth' });
      for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.9 + k * Math.PI * 0.3 * 0.9 + Math.PI * 0.05; S.beam(new V3(x + Math.cos(a) * 1.6, y0 + 25, z - Math.sin(a) * 1.6 * -1), new V3(x + Math.cos(a) * 3.6, y0 + 26.2, z + Math.sin(a) * 3.6 * -1 + 0), 0.45, GREEN); }
      // 高举火炬的右臂（西侧，向上）与左臂托书板
      S.beam(new V3(x - 2.6, y0 + 20, z), new V3(x - 3.6, y0 + 33, z - 0.6), 1.5, GREEN);
      S.cyl(x - 3.7, y0 + 33, z - 0.6, 1.2, 0.6, 1.4, [0.86, 0.70, 0.30], 8);
      S.add(new THREE.ConeGeometry(0.9, 2.4, 8).translate(0, 1.2, 0), [1.0, 0.82, 0.32], { x: x - 3.7, y: y0 + 34.4, z: z - 0.6, kind: 'shell' });
      S.add(BOX, GREEN, { x: x + 3.4, y: y0 + 12, z: z + 1.4, sx: 1.6, sy: 6, sz: 3, rz: 0.2 });
      // 岛上：游客中心、码头、树
      B.box(x + 34, 0, z - 32, 24, 5, 10, [0.86, 0.84, 0.80]); B.box(x - 12, 0.2, z + 52, 18, 1.2, 6, [0.56, 0.48, 0.40]);
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, r = 54 + (k % 2) * 3; if (Math.sin(a) > 0.7) continue; B.tree(x + Math.cos(a) * r * 1.0, z + 4 + Math.sin(a) * r * 0.62, 2.6, [[0.30, 0.50, 0.28], [0.26, 0.44, 0.24], [0.36, 0.56, 0.30]], 0, R); }
    }
    // ---- 埃利斯岛：红砖主楼 + 四座铜顶塔
    { const [x, z] = ELLIS, BR = [0.70, 0.36, 0.26], TR = [0.92, 0.88, 0.80];
      B.box(x, 0, z, 36, 12, 14, BR); B.box(x, 12, z, 36.6, 1, 14.6, TR); B.add(new THREE.CylinderGeometry(0, 10, 0.1, 4), BR, { x, y: 0, z });
      B.add(BOX, [0.40, 0.52, 0.56], { x, y: 13, z, sx: 30, sy: 3, sz: 10 });
      for (const [dx, dz] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) { B.box(x + dx, 12, z + dz, 3.2, 8, 3.2, TR); B.add(new THREE.SphereGeometry(2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0.42, 0.64, 0.56], { x: x + dx, y: 20, z: z + dz }); B.cyl(x + dx, 21.6, z + dz, 0.1, 0.4, 2, TR, 6); }
      for (const dx of [-22, 22]) B.box(x + dx, 0, z + 2, 8, 8, 24, BR);
    }
    // ---- 世贸一号楼：方形反棱台（底与顶的方形相差 45°）+ 基座 + 尖塔
    { const [x, z] = WTC, H = 112, r0 = 15, r1 = 9, GL = [0.62, 0.74, 0.86], arr = [];
      const bot = [], top = []; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, b = i * Math.PI / 2; bot.push([x + Math.cos(a) * r0, 20, z + Math.sin(a) * r0]); top.push([x + Math.cos(b) * r1, 20 + H, z + Math.sin(b) * r1]); }
      for (let i = 0; i < 4; i++) { const b0 = bot[i], b1 = bot[(i + 1) % 4], t0 = top[i], t1 = top[(i + 1) % 4]; arr.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0); }
      for (let i = 0; i < 4; i++) { const t0 = top[i], t1 = top[(i + 1) % 4]; arr.push(x, 20 + H, z, ...t1, ...t0); }
      B.tris(arr, GL); B.box(x, 0, z, 21, 20, 21, [0.72, 0.76, 0.80]);
      B.box(x, 20 + H, z, 9, 3, 9, [0.82, 0.84, 0.86]); B.cyl(x, 23 + H, z, 0.25, 0.9, 30, [0.90, 0.90, 0.92], 6);
      // 9/11 纪念水池
      for (const dx of [-22, -2]) B.box(x + dx, 0, z + 30, 12, 0.3, 12, [0.24, 0.30, 0.36]);
    }
    // ---- 布鲁克林大桥：两座哥特式石塔 + 主缆 + 桥面
    { const zb = -250, xa = 110, xb = 268, ST = [0.80, 0.72, 0.60];
      B.box((xa + xb) / 2, 9, zb, xb - xa + 30, 1.4, 12, [0.50, 0.48, 0.46]);
      for (const tx of [xa + 32, xb - 32]) { B.box(tx, 0, zb, 10, 36, 14, ST); for (const s of [-1, 1]) B.box(tx, 14, zb + s * 3.4, 10.4, 14, 3, [0.30, 0.26, 0.22]); B.box(tx, 36, zb, 10.6, 1.4, 14.6, [0.72, 0.64, 0.54]); }
      for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, xx = xa - 8 + t * (xb - xa + 16); const t1 = xa + 32, t2 = xb - 32;
          let y; if (xx < t1) y = 10 + (xx - xa + 8) / (t1 - xa + 8) * 26; else if (xx > t2) y = 10 + (xb + 8 - xx) / (xb + 8 - t2) * 26; else { const u = (xx - t1) / (t2 - t1) * 2 - 1; y = 12 + 24 * u * u; }
          pts.push(new V3(xx, y, zb + s * 5)); }
        for (let i = 1; i < pts.length; i++) B.beam(pts[i - 1], pts[i], 0.7, [0.76, 0.74, 0.70]); }
    }
    // 总督岛上的老堡垒，东河上的码头
    B.prism([[0, -14], [12, -6], [12, 8], [-12, 8], [-12, -6]], 0, 4, [0.70, 0.40, 0.30], { x: GOV[0] - 10, z: GOV[1] - 6 });
    for (let k = 0; k < 4; k++) B.box(-20 + k * 30, 0.2, -186, 5, 1, 18, [0.54, 0.48, 0.42]);
  },
  deco(D) {
    const { P, L } = D;
    const glass = P([[0.62, 0.70, 0.78], [0.72, 0.76, 0.80], [0.56, 0.60, 0.66], [0.80, 0.78, 0.74], [0.70, 0.64, 0.58], [0.84, 0.82, 0.78], [0.50, 0.54, 0.60]]);
    const tops = P([[0.56, 0.56, 0.58], [0.64, 0.64, 0.66], [0.48, 0.50, 0.52]]);
    D.blocks(7, 11, { pad: 4.6, skip: 0.06, jitter: 0.1, pal: glass, top: tops, hfn: (x, z, r) => {
      if (Math.hypot(x - WTC[0], z - WTC[1]) < 32) return 0;
      if (z > -230) return 16 + r() * 26;
      if (z > -370) return 26 + Math.pow(r(), 1.4) * 58;
      if (z > -520) return 18 + Math.pow(r(), 1.5) * 34;
      return 30 + Math.pow(r(), 1.3) * 80; } });
    const brown = P([[0.66, 0.42, 0.34], [0.72, 0.52, 0.42], [0.60, 0.40, 0.34], [0.80, 0.74, 0.66], [0.70, 0.66, 0.62]]);
    D.blocks(0, 13, { pad: 5.2, skip: 0.08, pal: brown, top: tops, hfn: (x, z, r) => (x < 0 ? 14 + Math.pow(r(), 1.4) * 60 : 6 + Math.pow(r(), 2) * 16) });
    const tr = P([[0.28, 0.48, 0.26], [0.34, 0.54, 0.28], [0.22, 0.42, 0.24], [0.40, 0.58, 0.32]]);
    D.trees(2, 80, tr, { r: [3, 5], test: (x, z) => L.nyKind(x, z) === 2 });
  },
  life(D) {
    const { L } = D;
    D.bus([0.24, 0.40, 0.76]);
    for (let k = 0; k < 4; k++) D.seg([40 + k * 36 - 54, -210], [40 + k * 36 - 54 + 0.28 * 500, -710], 3, 11, { lanes: [-1.2, 1.2] });
    D.ew(-242, 1, 3, 11); D.ew(-286, -1, 3, 11); D.ew(-330, 1, 3, 11);
    D.seg([96, -250], [284, -250], 6, 12, { lanes: [-2.5, 2.5], y: 10.4 });
    // 史泰登岛渡轮（橙色）、自由岛 / 埃利斯岛游船、帆船
    D.ferry([[52, -192], [80, -80], [100, 200], [110, 520], [100, 200], [80, -80]], 11, [0.94, 0.52, 0.18], [0.98, 0.70, 0.30], 1.6);
    D.ferry([[110, 520], [100, 200], [80, -80], [52, -192], [80, -80], [100, 200]], 11, [0.94, 0.52, 0.18], [0.98, 0.70, 0.30], 1.6);
    D.ferry([[10, -194], [-40, -90], [-50, 76], [-140, -56], [-160, -70], [-80, -150]], 8, [0.20, 0.30, 0.50], [0.96, 0.96, 0.94], 1.1);
    D.ferry([[-200, -240], [-160, -60], [-60, 120], [-160, -60]], 9, [0.92, 0.92, 0.90], [0.30, 0.40, 0.50], 1.0);
    const water = (x, z) => L.nyKind(x, z) === 3 && L.nyKind(x + 14, z) === 3 && L.nyKind(x - 14, z) === 3 && L.nyKind(x, z + 14) === 3 && L.nyKind(x, z - 14) === 3;
    D.sail(9, [-220, -200, 240, 200], water, { v: [5, 8] });
    D.crowd(LIB[0] - 30, LIB[1] + 44, LIB[0] + 30, LIB[1] + 56, 16); D.crowd(LIB[0] - 44, LIB[1] - 30, LIB[0] + 44, LIB[1] - 22, 12);
    D.crowd(20, -206, 90, -182, 24);
    D.crowd(ELLIS[0] - 18, ELLIS[1] + 8, ELLIS[0] + 18, ELLIS[1] + 16, 10);
  },
  taxi: [[0.98, 0.80, 0.16], [0.98, 0.80, 0.16], [0.98, 0.80, 0.16]],
};
