// 7 杭州西湖：东岸湖滨城区；北面白堤（断桥→孤山）、西侧苏堤（六桥）；湖心小瀛洲“湖中有岛、岛中有湖”，岛南三潭印月三座石塔；南岸夕照山雷峰塔；西、南两面青山。
import * as THREE from 'three';
import { V3, BOX, hall, roofGeo, skirtGeo } from './kit.js';

const LEIFENG = [-20, 264], XYZ = [30, 50];
const ROOF = [0.30, 0.32, 0.34], WALLW = [0.94, 0.93, 0.90], WOOD = [0.56, 0.24, 0.16];

export default {
  key: 'hangzhou',
  scene: { name: 'West Lake · 西湖', sub: 'Su & Bai Causeways · Three Pools Mirroring the Moon · Leifeng Pagoda · Hangzhou', lat: 30.2460, lon: 120.1430,
    zoom: 1.05, tilt: 0.62, planeY: 110, clouds: { count: 1, min: 0.5, max: 0.8, y: 140 }, look: 'soft' },
  origin: [-106, -1300],
  layout: /* glsl */ `
float hzLake(float x, float z){
  float dx = abs(x + 20.)/240.;
  float dz = abs(z + 10.)/230.;
  float q = pow(dx*dx*dx + dz*dz*dz, .3333);
  return (q - 1.)*230. + 7.*sin(x*.031 + 1.) + 6.*sin(z*.027) + 4.*sin((x + z)*.06);
}
float hzSu(float x, float z){ return abs(x + 134. + .064*z); }
float hzBai(float x, float z){
  if (x < -30. || x > 150.) return 99.;
  return abs(z + 188. + (x + 24.)*.1605);
}
/* 0 湖滨城区 1 道路 2 青山/林地 3 湖 4 堤岸/岛/广场 */
float hzKind(float x, float z){
  float lk = hzLake(x, z);
  if (lk < 0.) {
    if (hzSu(x, z) < 5. || hzBai(x, z) < 5.) return 4.;
    if (ellD(x, z, -92., -200., 62., 18.) < 0.) return 2.;
    float e1 = ellD(x, z, ${XYZ[0]}., ${XYZ[1]}., 50., 40.);
    float e2 = ellD(x, z, ${XYZ[0]}., ${XYZ[1]}., 37., 28.);
    if (e1 < 0. && (e2 > 0. || abs(x - ${XYZ[0]}.) < 3. || abs(z - ${XYZ[1]}.) < 3.)) return 4.;
    if (ellD(x, z, 120., -60., 14., 10.) < 0. || ellD(x, z, -50., 50., 12., 9.) < 0.) return 4.;
    return 3.;
  }
  if (hzSu(x, z) < 5. && lk < 30.) return 4.;
  float lf = sqrt((x - ${LEIFENG[0]}.)*(x - ${LEIFENG[0]}.) + (z - ${LEIFENG[1]}.)*(z - ${LEIFENG[1]}.));
  if (lf < 24.) return 4.;
  if (lk < 10.) return 4.;
  if (lk < 21. && x > -200. && z < 230.) return 1.;
  if (x > 196. && z < 230.) {
    if (gridD(x, 62., 0.) < 3.5 || gridD(z, 56., 0.) < 3.5) return 1.;
    return 0.;
  }
  return 2.;
}
float hzHeight(float x, float z){
  if (x > 190. && z < 230.) return 0.;
  float lk = hzLake(x, z);
  float h = smoothstep(18., 140., lk);
  float bump = .65 + .35*sin(x*.021 + 1.3)*sin(z*.017 + .4) + .2*sin(x*.07 + z*.05);
  float lf = smoothstep(46., 0., sqrt((x - ${LEIFENG[0]}.)*(x - ${LEIFENG[0]}.) + (z - ${LEIFENG[1]}.)*(z - ${LEIFENG[1]}.)));
  return max(h*44.*bump, lf*12.*smoothstep(4., 30., lk));
}`,
  names: ['hzLake', 'hzSu', 'hzBai', 'hzKind', 'hzHeight'], kind: 'hzKind', height: 'hzHeight',
  groundFn: 'hzGround',
  ground: /* glsl */ `
vec3 hzGround(vec2 p, float x, float z){
  float k = hzKind(x, z);
  float lk = hzLake(x, z);
  vec3 asph = vec3(.46,.47,.49);
  if (k > 2.5 && k < 3.5) {
    vec3 c = water(p, vec3(.36,.52,.50), vec3(.50,.62,.54), clamp(-lk/50., 0., 1.));
    /* 曲院风荷：北岸与西北角的荷叶 */
    float lotus = smoothstep(.55, .62, vn(p*.22))*(smoothstep(-40., -8., lk)*step(z, -120.) + smoothstep(14., 4., hzSu(x, z) - 4.)*.0);
    c = mix(c, s2l(vec3(.40,.58,.32)), lotus*.85);
    c = mix(c, s2l(vec3(.82,.84,.80)), band(lk + 1.4, .5, .4)*.5);
    return c;
  }
  vec3 col = s2l(vec3(.76,.75,.72)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) {
    col = grass(p, .55 + .4*smoothstep(.4,.65,fbm(p*.03)));
    col = mix(col, s2l(vec3(.30,.44,.28)), smoothstep(30., 120., lk)*.5);
  }
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.80,.78,.72)*(.95 + .05*vn(p*.6)));
    col = mix(col, grass(p, .15), .55*smoothstep(.3, .6, vn(p*.15)));
    if (hzSu(x, z) < 5. || hzBai(x, z) < 5.) col = mix(grass(p, .1), s2l(vec3(.84,.80,.72)), 1. - smoothstep(1.2, 2.2, min(hzSu(x, z), hzBai(x, z))));
  }
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (k < .5) col = s2l(vec3(.78,.77,.74)*(.95 + .05*paint(p)));
  return col;
}`,
  build(B0, { R, H, L }) {
    const B = B0;
    // ---- 雷峰塔：八角五层，铜色檐，金色宝顶，立于夕照山
    { const [x, z] = LEIFENG, y0 = H(x, z), S = B0.scaled(x, z, 1.25), BODY = [0.90, 0.76, 0.52], EAVE = [0.56, 0.42, 0.24], COL = [0.62, 0.22, 0.14];
      S.cyl(x, y0 - 2, z, 22, 24, 6, [0.74, 0.70, 0.64], 8, { ry: Math.PI / 8 });
      S.cyl(x, y0 + 4, z, 15, 16, 4, [0.80, 0.76, 0.70], 8, { ry: Math.PI / 8 });
      let y = y0 + 8, r = 11;
      for (let i = 0; i < 5; i++) {
        const h = i === 0 ? 8 : 5.6;
        S.cyl(x, y, z, r, r, h, BODY, 8, { ry: Math.PI / 8 });
        S.cyl(x, y + h * 0.15, z, r + 0.15, r + 0.15, h * 0.55, COL, 8, { ry: Math.PI / 8 + 0.12 });
        S.add(new THREE.CylinderGeometry(r * 0.9, r + 4.4, 2.6, 8, 1).translate(0, 1.3, 0), EAVE, { x, y: y + h, z, ry: Math.PI / 8 });
        S.cyl(x, y + h + 2.6, z, r * 0.88, r * 0.9, 0.8, [0.86, 0.68, 0.30], 8, { ry: Math.PI / 8 });
        y += h + 3.2; r *= 0.9;
      }
      S.add(new THREE.ConeGeometry(r + 2, 5, 8).translate(0, 2.5, 0), EAVE, { x, y, z, ry: Math.PI / 8 });
      S.cyl(x, y + 4.5, z, 0.4, 1.2, 6, [0.96, 0.80, 0.30], 8);
    }
    // ---- 三潭印月：三座小石塔（球形塔身 + 葫芦顶），放大
    for (const [dx, dz] of [[-22, 50], [0, 58], [22, 50]]) { const x = XYZ[0] + dx, z = XYZ[1] + dz, S = B0.scaled(x, z, 2.2);
      S.cyl(x, 0, z, 1.1, 1.3, 1.4, [0.80, 0.80, 0.78], 8);
      S.add(new THREE.SphereGeometry(1.5, 10, 8), [0.86, 0.86, 0.84], { x, y: 2.6, z, kind: 'smooth' });
      S.cyl(x, 3.8, z, 1.6, 0.6, 0.6, [0.70, 0.70, 0.70], 8);
      S.cyl(x, 4.4, z, 0.3, 0.6, 1.4, [0.80, 0.80, 0.78], 6);
      S.add(new THREE.SphereGeometry(0.55, 8, 6), [0.86, 0.86, 0.84], { x, y: 6, z, kind: 'smooth' }); }
    // 小瀛洲上的亭榭、九曲桥
    hall(B, { x: XYZ[0], z: XYZ[1] - 34, w: 14, d: 7, h: 3, roofH: 3.4, roofC: ROOF, wallC: WOOD, beamC: [0.30, 0.30, 0.28] });
    hall(B, { x: XYZ[0], z: XYZ[1], w: 6, d: 6, h: 2.8, roofH: 3.6, roofC: ROOF, wallC: WOOD, beamC: [0.30, 0.30, 0.28], ridge: 0 });
    hall(B, { x: XYZ[0] + 32, z: XYZ[1] + 6, w: 10, d: 6, h: 3, roofH: 3.2, roofC: ROOF, wallC: WOOD, ry: Math.PI / 2 });
    hall(B, { x: 120, z: -60, w: 7, d: 7, h: 3, roofH: 3.8, roofC: [0.80, 0.62, 0.22], wallC: WOOD, ridge: 0 });   // 湖心亭
    hall(B, { x: -50, z: 50, w: 6, d: 5, h: 2.6, roofH: 3, roofC: ROOF, wallC: WOOD });
    // ---- 断桥：白堤东端单孔石拱桥
    const hump = (x, z, ry, len, w, top) => { for (let i = 0; i < 9; i++) { const t = i / 8 - 0.5, yy = top * (1 - 4 * t * t);
      B.add(BOX, [0.86, 0.84, 0.80], { x: x + Math.cos(ry) * t * len, y: 0, z: z - Math.sin(ry) * t * len, sx: len / 8 + 0.4, sy: yy + 0.8, sz: w, ry }); }
      B.add(BOX, [0.30, 0.34, 0.34], { x, y: 0, z, sx: len * 0.34, sy: top * 0.7, sz: w + 0.3, ry }); };
    { const bx = (() => { for (let x = 100; x < 200; x += 1) if (L.hzLake(x, -188 - (x + 24) * 0.1605) > 0) return x - 12; return 140; })(); hump(bx, -188 - (bx + 24) * 0.1605, -0.16, 26, 7, 5); }
    hump(56, -201, -0.16, 18, 7, 3.2);   // 锦带桥
    hump(-124, -190, Math.PI / 2, 14, 9, 3);  // 西泠桥
    // 苏堤六桥
    for (let i = 0; i < 6; i++) { const z = -200 + i * 80, x = -134 - 0.064 * z; hump(x, z, Math.PI / 2 - 0.064, 18, 8, 3.6); B.box(x, 3.2, z, 1, 0.5, 1, [0.70, 0.70, 0.68]); }
    // 孤山：亭台楼阁（放鹤亭、西泠印社），北山保俶塔
    for (const [x, z, w, d] of [[-120, -205, 16, 8], [-96, -198, 10, 6], [-70, -204, 14, 7], [-50, -195, 8, 6]]) hall(B, { x, z, w, d, h: 3, roofH: 3.4, roofC: ROOF, wallC: WALLW, beamC: [0.30, 0.30, 0.28] });
    { const x = 40, z = -280, y0 = H(x, z); for (let i = 0; i < 7; i++) B.cyl(x, y0 + i * 4.6, z, 3.4 - i * 0.36, 3.6 - i * 0.36, 4.6, [0.68, 0.60, 0.50], 6); B.cyl(x, y0 + 32, z, 0.2, 0.8, 5, [0.50, 0.44, 0.36], 6); }
    // 湖滨：东岸水边的码头与亭子
    for (const z of [-140, -40, 60, 160]) { let x = 150; while (L.hzLake(x, z) < 0 && x < 300) x += 1; hall(B, { x: x + 4, z, w: 6, d: 6, h: 2.6, roofH: 3, roofC: ROOF, wallC: WOOD, ridge: 0 }); B.box(x - 6, 0.2, z, 14, 0.6, 4, [0.62, 0.50, 0.38]); }
    void V3; void roofGeo; void skirtGeo; void R;
  },
  deco(D) {
    const { P } = D;
    const walls = P([[0.94, 0.93, 0.90], [0.90, 0.88, 0.84], [0.86, 0.86, 0.86], [0.80, 0.78, 0.74], [0.92, 0.90, 0.86]]);
    const tiles = P([[0.28, 0.30, 0.32], [0.34, 0.36, 0.38], [0.40, 0.40, 0.42]]);
    D.blocks(0, 13, { pad: 4.8, skip: 0.1, pal: walls, roof: 'gable', roofPal: tiles, roofH: 2.6, hfn: (x, z, r) => (x < 300 ? 4 + r() * 8 : 6 + Math.pow(r(), 1.6) * 30) });
    const forest = P([[0.18, 0.36, 0.20], [0.24, 0.42, 0.22], [0.16, 0.32, 0.20], [0.30, 0.46, 0.26], [0.22, 0.40, 0.30]]);
    D.trees(2, 420, forest, { r: [4, 7], subs: 3, xr: 340 });
    // 堤上的垂柳与桃花
    const willow = P([[0.56, 0.72, 0.36], [0.62, 0.78, 0.40], [0.50, 0.66, 0.32], [0.96, 0.72, 0.78]]);
    D.trees(4, 200, willow, { r: [2.4, 3.4], subs: 2, xr: 300, test: (x, z) => (D.L.hzSu(x, z) < 4.6 || D.L.hzBai(x, z) < 4.6) && Math.abs(D.L.hzSu(x, z)) > 2.2 * 0 && (D.L.hzSu(x, z) > 2.4 || D.L.hzBai(x, z) > 2.4) });
    for (let z = D.z0 + 3; z < D.z0 + 160; z += 6.5) { const lz = D.local(z); if (lz < -250 || lz > 240) continue; const x = -134 - 0.064 * lz;
      if (D.L.hzKind(x, lz) !== 4) continue;
      for (const s of [-1, 1]) if (D.R() < 0.85) D.tree(x + s * 3.4, z + (D.R() - 0.5) * 2, 2.4 + D.R() * 1.2, [D.pick(willow), ...willow], { subs: 2 }); }
    for (let x = -26; x < 140; x += 6) { const lz0 = -188 - (x + 24) * 0.1605; for (const s of [-1, 1]) { const zz = D.rowZ(lz0 + s * 3.4); if (zz === null || D.R() > 0.85) continue; D.tree(x + (D.R() - 0.5) * 2, zz, 2.4 + D.R() * 1.2, [D.pick(willow), ...willow], { subs: 2 }); } }
    D.trees(4, 80, willow, { r: [2.6, 3.6], subs: 2, xr: 320, test: (x, z) => { const lk = D.L.hzLake(x, z); return lk > 2 && lk < 8; } });
    D.trees(4, 40, willow, { r: [2.4, 3.2], subs: 2, xr: 120, test: (x, z) => Math.hypot((x - XYZ[0]) / 50, (z - XYZ[1]) / 40) < 1 });
  },
  life(D) {
    const water = (x, z) => D.L.hzKind(x, z) === 3 && D.L.hzLake(x, z) < -6;
    D.sail(18, [-250, -200, 210, 210], water, { kind: 'row', v: [2, 4], cols: [[0.90, 0.70, 0.36], [0.80, 0.30, 0.20], [0.96, 0.94, 0.88], [0.30, 0.50, 0.70]] });
    D.ferry([[205, 0], [100, 30], [50, 98], [100, 30]], 6, [0.80, 0.62, 0.34], [0.74, 0.20, 0.14], 1.0);
    D.ferry([[200, -120], [120, -130], [20, -140], [-60, -150], [20, -140], [120, -130]], 6, [0.80, 0.62, 0.34], [0.84, 0.70, 0.26], 1.0);
    D.ferry([[195, 130], [100, 150], [-60, 160], [100, 150]], 6, [0.86, 0.84, 0.80], [0.24, 0.40, 0.56], 1.0);
    D.ns(232, -1, 4, 10); D.ns(236, 1, 4, 10); D.ns(240, -1, 3, 10);
    D.ew(-254, 1, 3, 10); D.ew(-258, -1, 3, 10); D.ew(-250, 1, 2, 10);
    // 堤上游人
    for (let i = 0; i < 5; i++) { const z = -230 + i * 100, x = -134 - 0.064 * z; D.crowd(x - 2.5, z, x + 2.5, z + 90, 8); }
    for (let i = 0; i < 4; i++) { const x = -24 + i * 40, z = -188 - (x + 24) * 0.1605; D.crowd(x, z - 2.5, x + 38, z + 1.5, 7); }
    D.crowd(LEIFENG[0] - 18, LEIFENG[1] + 6, LEIFENG[0] + 18, LEIFENG[1] + 22, 10);
    D.crowd(214, -180, 226, 180, 20);
  },
  taxi: [[0.30, 0.62, 0.86], [0.96, 0.96, 0.96]],
};
