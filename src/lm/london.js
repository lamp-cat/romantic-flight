// 11 伦敦威斯敏斯特：泰晤士河南北向流过；西岸国会大厦（北端伊丽莎白塔大本钟、南端维多利亚塔、中央尖塔），西侧威斯敏斯特教堂与议会广场；
// 绿色的威斯敏斯特桥；东岸郡政厅与伦敦眼（轮面转成接近东西向，方便从南面看清）。红色双层巴士，靠左行驶。
import * as THREE from 'three';
import { V3, BOX } from './kit.js';

const BIGBEN = [-30, -150], VIC = [-40, 22], EYE = [70, -262], ABBEY = [-128, -40], BR = -172;
const STONE = [0.88, 0.78, 0.58], STONE2 = [0.80, 0.70, 0.52], SLATE = [0.48, 0.52, 0.56], GOLD = [0.92, 0.74, 0.30];

export default {
  key: 'london',
  scene: { name: 'Big Ben & the London Eye', sub: 'Palace of Westminster · Westminster Bridge · River Thames · London', lat: 51.5007, lon: -0.1246,
    zoom: 1.22, tilt: 0.62, planeY: 150, clouds: { count: 2, min: 0.5, max: 0.75, y: 175 }, look: 'soft' },
  origin: [70, -1300],
  layout: /* glsl */ `
float loRiv(float x, float z){ return x - (32. + 10.*sin(z*.007 + .6)); }
/* 0 街区 1 道路 2 公园 3 泰晤士河 4 地标 */
float loKind(float x, float z){
  float r = loRiv(x, z);
  if (abs(z - ${BR}.) < 8. && abs(r) < 60.) return 4.;
  if (abs(r) < 42.) return 3.;
  if (r < 0.) {
    if (r > -52. && z < ${BR - 8}.) return 1.;
    if (rectD(x, z, -66., -160., -10., 30.) < 0.) return 4.;
    if (rectD(x, z, -60., 30., -10., 120.) < 0.) return 2.;
    if (rectD(x, z, ${ABBEY[0] - 30}., ${ABBEY[1] - 44}., ${ABBEY[0] + 30}., ${ABBEY[1] + 34}.) < 0.) return 4.;
    if (rectD(x, z, -126., -188., -80., -124.) < 0.) return 2.;
    if (abs(z - ${BR}.) < 8. || abs(x + 72.) < 6. || abs(x + 74.) < 6. && z < -180. || abs(z + 110.) < 4. && x < -70. || abs(x + 72.) < 6.) return 1.;
    if (abs(x + 160.) < 5. || abs(z - 60.) < 4. || abs(z + 240.) < 4.) return 1.;
    return 0.;
  }
  if (r < 52.) return 1.;
  if (abs(z - ${BR}.) < 8.) return 1.;
  if (rectD(x, z, 80., -330., 150., -276.) < 0.) return 2.;
  if (sqrt((x - ${EYE[0]}.)*(x - ${EYE[0]}.) + (z - ${EYE[1]}.)*(z - ${EYE[1]}.)) < 26.) return 4.;
  if (rectD(x, z, 80., -240., 150., -180.) < 0.) return 4.;
  if (abs(x - 160.) < 5. || abs(z + 60.) < 4. || abs(z - 50.) < 4.) return 1.;
  return 0.;
}`,
  names: ['loRiv', 'loKind'], kind: 'loKind',
  groundFn: 'loGround',
  ground: /* glsl */ `
vec3 loGround(vec2 p, float x, float z){
  float k = loKind(x, z);
  float r = loRiv(x, z);
  vec3 asph = vec3(.44,.44,.46);
  if (k > 2.5 && k < 3.5) {
    vec3 c = water(p, vec3(.36,.40,.36), vec3(.48,.50,.42), clamp((42. - abs(r))/16., 0., 1.));
    return mix(c, s2l(vec3(.70,.66,.58)), band(abs(r) - 41.2, .8, .3));
  }
  vec3 col = s2l(vec3(.74,.72,.68)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) col = grass(p, .15 + .3*smoothstep(.45,.62,fbm(p*.04)));
  if (k > 3.5 && k < 4.5) col = s2l(vec3(.80,.76,.68)*(.95 + .05*vn(p*.6)));
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (abs(z - ${BR}.) < 8. && abs(r) < 60.) col = road(s2l(vec3(.40,.52,.44)), z - ${BR}., 6.5, x, 2., asph);
  return col;
}`,
  build(B0, { R }) {
    const B = B0;
    const pinn = (x, y, z, h, c = STONE) => { B.box(x, y, z, 1.2, h * 0.6, 1.2, c); B.cyl(x, y + h * 0.6, z, 0.05, 0.7, h * 0.4, c, 4, { ry: Math.PI / 4 }); };
    // ---- 国会大厦：沿河长立面 + 内部几条横纵翼楼 + 密排尖顶
    { const x0 = -60, x1 = -14, z0 = -140, z1 = 14;
      const blk = (x, z, w, d, h) => { B.box(x, 0, z, w, h, d, STONE); B.box(x, h, z, w + 0.3, 0.5, d + 0.3, STONE2);
        const ry = d > w ? 0 : Math.PI / 2, L = Math.max(w, d), W = Math.min(w, d);
        const g = new THREE.BufferGeometry(); const a = L / 2, b = W / 2, hh = W * 0.45;
        g.setAttribute('position', new THREE.Float32BufferAttribute([-b, 0, -a, b, 0, -a, 0, hh, -a, b, 0, a, -b, 0, a, 0, hh, a, -b, 0, -a, 0, hh, -a, 0, hh, a, -b, 0, -a, 0, hh, a, -b, 0, a, b, 0, -a, b, 0, a, 0, hh, a, b, 0, -a, 0, hh, a, 0, hh, -a], 3));
        B.add(g, SLATE, { x, y: h + 0.5, z, ry }); };
      blk(-17, (z0 + z1) / 2, 6, z1 - z0, 17);                       // 河岸立面
      for (let z = z0 + 4; z < z1; z += 7) { pinn(-13.6, 17.5, z, 6); pinn(-20.4, 17.5, z, 5); }
      for (let z = z0 + 8; z < z1 - 4; z += 14) B.box(-13.8, 3, z, 0.5, 11, 5, [0.70, 0.62, 0.46]);
      blk(-40, (z0 + z1) / 2, 6, z1 - z0 - 20, 15); blk(-56, (z0 + z1) / 2 + 10, 8, z1 - z0 - 30, 14);
      for (const z of [-118, -86, -60, -30, -4]) blk((-17 - 56) / 2, z, 34, 6, 13);
      for (const z of [-118, -60, -4]) for (const x of [-26, -48]) pinn(x, 13.5, z, 7);
      // 中央八角尖塔
      B.cyl(-36, 0, -60, 6, 6, 26, STONE, 8, { ry: Math.PI / 8 }); B.cyl(-36, 26, -60, 0.4, 6, 16, SLATE, 8, { ry: Math.PI / 8 });
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; pinn(-36 + Math.cos(a) * 6.2, 26, -60 + Math.sin(a) * 6.2, 6); }
      // 维多利亚塔（南端，最高的方塔）
      { const [x, z] = VIC; B.box(x, 0, z, 18, 58, 18, STONE); for (const s of [-1, 1]) { B.box(x + s * 9.1, 6, z, 0.4, 48, 6, STONE2); B.box(x, 6, z + s * 9.1, 6, 48, 0.4, STONE2); }
        B.box(x, 58, z, 18.6, 1.2, 18.6, STONE2); for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) pinn(x + dx, 59, z + dz, 9, STONE);
        B.cyl(x, 59, z, 0.2, 3, 7, [0.30, 0.32, 0.36], 4, { ry: Math.PI / 4 }); B.box(x, 66, z, 0.2, 5, 0.2, [0.9, 0.9, 0.9]); B.box(x + 1.4, 69.5, z, 2.6, 1.6, 0.1, [0.82, 0.20, 0.18]); }
    }
    // ---- 伊丽莎白塔（大本钟）：方塔身 + 四面钟盘 + 钟楼 + 铸铁尖顶
    { const [x, z] = BIGBEN, S = B0.scaled(x, z, 1.6);
      S.box(x, 0, z, 10, 36, 10, STONE); for (const s of [-1, 1]) { S.box(x + s * 5.05, 2, z, 0.3, 32, 3, STONE2); S.box(x, 2, z + s * 5.05, 3, 32, 0.3, STONE2); }
      S.box(x, 36, z, 11.4, 9, 11.4, STONE);
      for (const [dx, dz, ry] of [[0, 5.75, 0], [0, -5.75, 0], [5.75, 0, Math.PI / 2], [-5.75, 0, Math.PI / 2]]) {
        S.add(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 20).rotateX(Math.PI / 2), [0.98, 0.96, 0.88], { x: x + dx, y: 40.5, z: z + dz, ry, kind: 'shell' });
        S.add(new THREE.CylinderGeometry(4.1, 4.1, 0.2, 20).rotateX(Math.PI / 2), GOLD, { x: x + dx * 0.99, y: 40.5, z: z + dz * 0.99, ry });
        S.add(BOX, [0.12, 0.12, 0.14], { x: x + dx * 1.01, y: 40.4, z: z + dz * 1.01, sx: ry ? 0.3 : 0.5, sy: 2.8, sz: ry ? 0.5 : 0.3, ry: 0 }); }
      for (const [dx, dz] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]]) S.cyl(x + dx, 45, z + dz, 0.1, 0.8, 4, GOLD, 4);
      S.box(x, 45, z, 9, 5, 9, STONE2); S.box(x, 50, z, 9.6, 0.6, 9.6, GOLD);
      S.cyl(x, 50.6, z, 0.4, 6.6, 12, [0.26, 0.30, 0.34], 4, { ry: Math.PI / 4 });
      S.cyl(x, 62, z, 0.1, 0.5, 4, GOLD, 4); }
    // ---- 威斯敏斯特桥：七孔浅拱，绿色栏杆，哥特路灯
    { const xa = -12, xb = 86; B.box((xa + xb) / 2, 3.4, BR, xb - xa, 1.2, 15, [0.80, 0.78, 0.72]);
      for (const s of [-1, 1]) B.box((xa + xb) / 2, 4.6, BR + s * 7.2, xb - xa, 1.2, 0.6, [0.26, 0.50, 0.38]);
      for (let i = 0; i < 6; i++) B.box(xa + 8 + i * 15, 0, BR, 3, 3.4, 16, [0.70, 0.68, 0.62]);
      for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { B.box(xa + 4 + i * 12.4, 5, BR + s * 7.2, 0.5, 4, 0.5, [0.20, 0.36, 0.28]); B.box(xa + 4 + i * 12.4, 9, BR + s * 7.2, 1.4, 1.2, 1.4, [0.96, 0.90, 0.70]); } }
    // ---- 伦敦眼：轮缘 + 辐条 + 32 个吊舱 + 东侧 A 形支架
    { const [x, z] = EYE, Rr = 40, hub = 46, ry = -0.5, ax = Math.cos(ry), az = -Math.sin(ry);
      const P = (a, r) => new V3(x + ax * Math.cos(a) * r, hub + Math.sin(a) * r, z + az * Math.cos(a) * r);
      for (let i = 0; i < 48; i++) { const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2; B.beam(P(a0, Rr), P(a1, Rr), 1.1, [0.92, 0.92, 0.94]); B.beam(P(a0, Rr - 3), P(a1, Rr - 3), 0.6, [0.86, 0.86, 0.88]); }
      for (let i = 0; i < 16; i++) B.beam(P(i / 16 * Math.PI * 2, 2), P(i / 16 * Math.PI * 2, Rr - 3), 0.25, [0.80, 0.80, 0.84]);
      B.cyl(x, hub - 1.5, z, 2, 2, 3, [0.70, 0.70, 0.74], 10);
      for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, p = P(a, Rr + 1.6);
        B.add(new THREE.SphereGeometry(1.5, 10, 8), [0.82, 0.90, 0.96], { x: p.x, y: p.y - 0.6, z: p.z, sx: 1.6, sy: 1, sz: 1.6, ry, kind: 'smooth' }); }
      const nx = Math.sin(ry), nz = Math.cos(ry);
      for (const s of [-1, 1]) B.beam(new V3(x + nx * 24 + ax * s * 10, 0, z + nz * 24 + az * s * 10), new V3(x, hub, z), 1.6, [0.94, 0.94, 0.96]);
      B.box(x, 0, z, 30, 1.6, 10, [0.70, 0.70, 0.72], ry); }
    // ---- 郡政厅（弧形主立面面向河）
    for (let i = 0; i < 7; i++) { const a = -0.6 + i * 0.2, cx = 132 - Math.cos(a) * 46, cz = -210 + Math.sin(a) * 46;
      B.box(cx, 0, cz, 12, 18, 10, [0.84, 0.80, 0.72], -a); B.box(cx, 18, cz, 12.4, 4, 10.4, [0.46, 0.40, 0.38], -a); }
    B.box(124, 0, -210, 30, 18, 50, [0.80, 0.76, 0.68]); B.box(124, 18, -210, 30.4, 4, 50.4, [0.46, 0.40, 0.38]);
    // ---- 威斯敏斯特教堂：十字形平面 + 西立面双塔
    { const [x, z] = ABBEY, ST = [0.84, 0.80, 0.70];
      const nave = (cx, cz, w, d, h) => { B.box(cx, 0, cz, w, h, d, ST);
        B.add(new THREE.CylinderGeometry(0.01, 1, 1, 3, 1).rotateX(Math.PI / 2).rotateZ(0), SLATE, { x: cx, y: h, z: cz, sx: w * 0.55, sy: w * 0.4, sz: d, rx: 0 }); };
      nave(x, z, 16, 74, 18); B.box(x, 0, z + 2, 52, 16, 14, ST); B.box(x, 16, z + 2, 52.4, 0.8, 14.4, [0.70, 0.66, 0.58]);
      for (const s of [-1, 1]) { B.box(x + s * 6, 0, z + 34, 7, 34, 7, ST); pinn(x + s * 6 + 2.6, 34, z + 36.6, 5, ST); pinn(x + s * 6 - 2.6, 34, z + 31.4, 5, ST); pinn(x + s * 6 + 2.6, 34, z + 31.4, 5, ST); pinn(x + s * 6 - 2.6, 34, z + 36.6, 5, ST); }
      B.box(x, 18, z + 2, 9, 6, 9, ST); B.box(x + 20, 0, z - 28, 24, 8, 26, [0.78, 0.74, 0.66]); }
    // 议会广场上的雕像与旗杆
    for (let i = 0; i < 6; i++) B.box(-122 + i * 8, 0, -128, 1.6, 4, 1.6, [0.40, 0.38, 0.36]);
    void R;
  },
  deco(D) {
    const { P } = D;
    const stone = P([[0.90, 0.86, 0.78], [0.84, 0.80, 0.72], [0.78, 0.66, 0.56], [0.70, 0.46, 0.38], [0.86, 0.84, 0.82], [0.66, 0.62, 0.58]]);
    const roofs = P([[0.40, 0.42, 0.46], [0.46, 0.46, 0.48], [0.52, 0.40, 0.36]]);
    D.blocks(0, 15, { pad: 6.2, skip: 0.06, jitter: 0.08, pal: stone, roof: 'hip', roofPal: roofs, roofH: 3, hfn: (x, z, r) => 10 + r() * 10 + (x > 0 ? Math.pow(r(), 3) * 30 : 0) });
    const tr = P([[0.28, 0.46, 0.26], [0.34, 0.52, 0.28], [0.24, 0.42, 0.24], [0.38, 0.56, 0.30]]);
    D.trees(2, 70, tr, { r: [3, 5] });
    // 两岸行道树
    for (let z = D.z0 + 3; z < D.z0 + 160; z += 8) { const lz = D.local(z), rc = 32 + 10 * Math.sin(lz * 0.007 + 0.6);
      if (lz < BR - 10 || lz > 40) D.tree(rc - 50, z, 2.8, [D.pick(tr), ...tr], { subs: 2 });
      if (lz < -340 || lz > BR + 10) D.tree(rc + 50, z, 2.8, [D.pick(tr), ...tr], { subs: 2 }); }
  },
  life(D) {
    D.bus([0.86, 0.14, 0.12]);
    // 靠左行驶：桥上向东的车走南侧（+z），向西的走北侧；南北向道路北行走西侧
    D.seg([-90, BR + 2.5], [320, BR + 2.5], 5, 11, { lanes: [0.1], bus: 0.35, y: 0 });
    D.seg([320, BR - 2.5], [-90, BR - 2.5], 5, 11, { lanes: [0.1], bus: 0.35, y: 0 });
    D.ns(-75, -1, 4, 10, 0.3); D.ns(-69, 1, 4, 10, 0.3);
    D.ns(32 - 48 + 1, -1, 3, 10, 0.2);
    D.ns(160 - 2, -1, 3, 10, 0.3); D.ns(160 + 2, 1, 3, 10, 0.3);
    // 河上游船
    D.ferry([[34, 420], [36, -500], [26, -500], [24, 420]], 8, [0.94, 0.94, 0.92], [0.24, 0.30, 0.42], 1.2);
    D.ferry([[24, -500], [26, 420], [40, 420], [38, -500]], 8, [0.20, 0.24, 0.30], [0.90, 0.88, 0.84], 1.1);
    D.crowd(-12, BR - 6, 86, BR + 6, 30);
    D.crowd(EYE[0] - 30, EYE[1] - 22, EYE[0] + 40, EYE[1] + 26, 30, [[EYE[0] - 12, EYE[1] - 6, EYE[0] + 12, EYE[1] + 6]]);
    D.crowd(-126, -188, -80, -124, 20);
    D.crowd(ABBEY[0] - 24, ABBEY[1] + 36, ABBEY[0] + 24, ABBEY[1] + 44, 14);
    D.crowd(74, -300, 84, -160, 20);
  },
  taxi: [[0.10, 0.10, 0.12], [0.10, 0.10, 0.12]],
};
