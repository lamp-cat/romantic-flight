// 6 西安：明城墙（四门含箭楼、瓮城，四座角楼，马面敌楼）、护城河与环城公园；城中心钟楼、西北侧鼓楼；城南大雁塔与大慈恩寺、北广场水景。
// 局部坐标：x 东 z 南；城墙压缩为 500×340（实际 4.2×2.6 km），大雁塔从城南 4 km 拉近到 z≈290。
import { V3, BOX, C, hall, roofGeo, skirtGeo } from './kit.js';

const W0 = -250, W1 = 250, N0 = -170, S1 = 130, MID = -20;  // 城墙外框，东西大街 z
const BELL = [0, MID], DRUM = [-78, MID - 26], PAGODA = [30, 262];
const BRICK = [0.56, 0.52, 0.47], BRICK2 = [0.66, 0.62, 0.56], ROOFG = [0.34, 0.40, 0.38], GREEN = [0.20, 0.44, 0.36], RED = [0.66, 0.18, 0.14];

export default {
  key: 'xian',
  scene: { name: 'Xi\'an City Wall · 西安城墙', sub: 'Bell Tower · Drum Tower · Giant Wild Goose Pagoda', lat: 34.2610, lon: 108.9423,
    zoom: 1.0, tilt: 0.62, planeY: 120, clouds: { count: 3, min: 0.5, max: 0.8, y: 150 }, look: 'soft' },
  origin: [-126, -1300],
  layout: /* glsl */ `
float xaWall(float x, float z){ return rectD(x, z, ${W0}., ${N0}., ${W1}., ${S1}.); }
/* 0 城内街区 1 道路 2 公园 3 水 4 城墙/地标 7 城外 */
float xaKind(float x, float z){
  float d = xaWall(x, z);
  float gate = min(min(abs(x), abs(z - ${MID}.)), 999.);
  if (abs(d) < 8.) return 4.;
  if (d > 8. && d < 66.) {
    if (gate < 9.) return 1.;
    if (d > 26. && d < 40.) return 3.;
    if (d > 56.) return 1.;
    return 2.;
  }
  float bx = x - ${BELL[0]}.;
  float bz = z - ${BELL[1]}.;
  float b = sqrt(bx*bx + bz*bz);
  if (b < 30.) return 4.;
  if (b < 42.) return 1.;
  if (rectD(x, z, ${DRUM[0] - 34}., ${DRUM[1] - 24}., ${DRUM[0] + 34}., ${DRUM[1] + 18}.) < 0.) return 4.;
  if (abs(x) < 8. || abs(z - ${MID}.) < 8.) return 1.;
  if (d < 0.) {
    if (gridD(x, 84., 42.) < 3.5 || gridD(z, 66., ${MID + 33}.) < 3.5) return 1.;
    if (d > -20.) return 2.;
    return 0.;
  }
  /* 城南：大慈恩寺 + 北广场水景 */
  if (rectD(x, z, ${PAGODA[0] - 50}., ${PAGODA[1] - 62}., ${PAGODA[0] + 50}., ${PAGODA[1] + 70}.) < 0.) {
    if (rectD(x, z, ${PAGODA[0] - 11}., ${PAGODA[1] - 58}., ${PAGODA[0] + 11}., ${PAGODA[1] - 30}.) < 0.) return 3.;
    return 4.;
  }
  if (gridD(x, 100., 0.) < 5. || gridD(z, 90., ${MID}.) < 5.) return 1.;
  return 7.;
}`,
  names: ['xaWall', 'xaKind'], kind: 'xaKind',
  groundFn: 'xaGround',
  ground: /* glsl */ `
vec3 xaGround(vec2 p, float x, float z){
  float k = xaKind(x, z);
  float d = xaWall(x, z);
  vec3 asph = vec3(.46,.46,.48);
  vec3 col = s2l(vec3(.76,.74,.70)*(.95 + .06*paint(p)));
  if (k > 2.5 && k < 3.5) return water(p, vec3(.30,.44,.46), vec3(.42,.56,.54), clamp((min(abs(d - 33.), 7.))/7., 0., 1.));
  if (k > 1.5 && k < 2.5) col = grass(p, .25 + .4*smoothstep(.45,.62,fbm(p*.04)));
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.70,.67,.62)*(.95 + .05*vn(p*.5)));
    if (abs(d) < 8.) col = s2l(vec3(.52,.49,.45));
    float b = length(vec2(x - ${BELL[0]}., z - ${BELL[1]}.));
    if (b < 30.) col = mix(s2l(vec3(.80,.78,.74)), grass(p, .1), band(b - 25., 2.5, .5));
    if (z > ${PAGODA[1] - 62}.) col = mix(col, grass(p, .2), step(.5, fract(x/22.))*step(abs(x - ${PAGODA[0]}.), 46.)*step(z, ${PAGODA[1] - 30}.)*.6);
  }
  if (k > 6.5) col = s2l(vec3(.74,.73,.71)*(.95 + .05*paint(p)));
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (abs(x) < 8.) col = road(col, x, 7.5, z, 2., asph);
  if (abs(z - ${MID}.) < 8.) col = road(col, z - ${MID}., 7.5, x, 2., asph);
  return col;
}`,
  build(B0, { R }) {
    const B = B0;
    const tower = (x, z, w, d, h, ry = 0, eaves = 2, o) => hall(B, { x, z, ry, w, d, h, roofH: Math.min(w, d) * 0.34, eaves, roofC: ROOFG, wallC: RED, beamC: GREEN, y: 10, o });
    // ---- 城墙：墙体、外侧雉堞、马面敌台（每隔 ~40）
    const seg = (ax, az, bx, bz) => { const w = Math.abs(bx - ax) || 15, d = Math.abs(bz - az) || 15; B.box((ax + bx) / 2, 0, (az + bz) / 2, w, 10, d, BRICK); B.box((ax + bx) / 2, 10, (az + bz) / 2, w + 0.4, 0.4, d + 0.4, BRICK2); };
    const gap = 9;
    for (const z of [N0, S1]) { seg(W0, z, -gap, z); seg(gap, z, W1, z); }
    for (const x of [W0, W1]) { seg(x, N0, x, MID - gap); seg(x, MID + gap, x, S1); }
    for (let t = W0 + 4; t < W1; t += 6) for (const [z, s] of [[N0, -1], [S1, 1]]) if (Math.abs(t) > 12) B.box(t, 10, z + s * 7, 2.6, 1.8, 1.2, BRICK);
    for (let t = N0 + 4; t < S1; t += 6) for (const [x, s] of [[W0, -1], [W1, 1]]) if (Math.abs(t - MID) > 12) B.box(x + s * 7, 10, t, 1.2, 1.8, 2.6, BRICK);
    const bast = (x, z, nx, nz) => { B.box(x + nx * 10, 0, z + nz * 10, nx ? 8 : 12, 10, nz ? 8 : 12, BRICK); if (R() < 0.45) { B.box(x + nx * 9, 10, z + nz * 9, 7, 3.4, 7, [0.50, 0.30, 0.26]); B.add(roofGeo(9, 9, 2.6, 0), ROOFG, { x: x + nx * 9, y: 13.4, z: z + nz * 9 }); } };
    for (let t = W0 + 40; t < W1 - 20; t += 40) if (Math.abs(t) > 30) { bast(t, N0, 0, -1); bast(t, S1, 0, 1); }
    for (let t = N0 + 40; t < S1 - 20; t += 40) if (Math.abs(t - MID) > 30) { bast(W0, t, -1, 0); bast(W1, t, 1, 0); }
    // ---- 四座角楼
    for (const [x, z] of [[W0, N0], [W1, N0], [W0, S1], [W1, S1]]) { B.box(x, 0, z, 26, 10, 26, BRICK); B.box(x, 10, z, 26.4, 0.4, 26.4, BRICK2); tower(x, z, 15, 15, 6, 0, 2); }
    // ---- 四门：城楼（墙上）+ 瓮城 + 箭楼（外侧）
    const gate = (x, z, nx, nz) => {
      const ry = nx ? Math.PI / 2 : 0;
      B.box(x, 0, z, nx ? 18 : 40, 10, nz ? 18 : 40, BRICK); B.box(x, 10, z, nx ? 18.4 : 40.4, 0.4, nz ? 18.4 : 40.4, BRICK2);
      tower(x, z, 30, 12, 7, ry, 2);
      // 瓮城：外凸的矩形围墙
      const ox = x + nx * 22, oz = z + nz * 22, w = nx ? 28 : 52, d = nz ? 28 : 52;
      for (const s of [-1, 1]) { if (nx) B.box(ox, 0, oz + s * 25, 28, 10, 5, BRICK); else B.box(ox + s * 25, 0, oz, 5, 10, 28, BRICK); }
      B.box(x + nx * 36, 0, z + nz * 36, nx ? 8 : 56, 10, nz ? 8 : 56, BRICK);
      B.box(x + nx * 36, 10, z + nz * 36, nx ? 8.4 : 56.4, 0.4, nz ? 8.4 : 56.4, BRICK2);
      // 箭楼：灰墙、密排箭窗、歇山顶
      const ax = x + nx * 36, az = z + nz * 36, aw = 32, ad = 10;
      B.add(BOX, [0.60, 0.56, 0.52], { x: ax, y: 10, z: az, sx: aw, sy: 9, sz: ad, ry });
      for (let r = 0; r < 3; r++) for (let c = -6; c <= 6; c++) B.add(BOX, [0.16, 0.12, 0.10], { x: ax + (nx ? nx * 5.1 : c * 2.3), y: 11.5 + r * 2.6, z: az + (nz ? nz * 5.1 : c * 2.3), sx: nx ? 0.3 : 1, sy: 1.1, sz: nx ? 1 : 0.3, ry: 0 });
      B.add(roofGeo(aw + 4, ad + 4, 5.6), ROOFG, { x: ax, y: 19, z: az, ry });
      void w; void d;
    };
    gate(0, N0, 0, -1); gate(0, S1, 0, 1); gate(W0, MID, -1, 0); gate(W1, MID, 1, 0);
    // 护城河上的桥
    for (const [x, z, ry] of [[0, N0 - 33, 0], [0, S1 + 33, 0], [W0 - 33, MID, 1], [W1 + 33, MID, 1]]) B.add(BOX, [0.80, 0.78, 0.74], { x, y: 0, z, sx: ry ? 22 : 18, sy: 1, sz: ry ? 18 : 22 });
    // ---- 钟楼：方形砖台（四面券洞）+ 重檐三滴水攒尖顶，绿琉璃，金顶
    { const [x, z] = BELL, B = B0.scaled(x, z, 1.35); B.box(x, 0, z, 28, 11, 28, BRICK); B.box(x, 11, z, 29, 0.8, 29, BRICK2);
      for (const [dx, dz, w, d] of [[0, 14, 7, 0.6], [0, -14, 7, 0.6], [14, 0, 0.6, 7], [-14, 0, 0.6, 7]]) B.box(x + dx, 0, z + dz, w, 6, d, [0.16, 0.12, 0.10]);
      const y0 = 11.8; B.box(x, y0, z, 18, 6, 18, RED); B.box(x, y0 + 4.8, z, 18.4, 1.2, 18.4, GREEN);
      B.add(skirtGeo(26, 26, 4, 15, 15), GREEN, { x, y: y0 + 5.6, z });
      B.box(x, y0 + 8.4, z, 14, 4.6, 14, RED); B.box(x, y0 + 12, z, 14.4, 1, 14.4, GREEN);
      B.add(skirtGeo(21, 21, 3.4, 12, 12), GREEN, { x, y: y0 + 12.6, z });
      B.add(roofGeo(14, 14, 9, 0), GREEN, { x, y: y0 + 15.4, z });
      B.cyl(x, y0 + 24, z, 0.3, 1.1, 4, [0.96, 0.78, 0.26], 8); }
    // ---- 鼓楼：长方形砖台 + 重檐歇山，南面一排大鼓
    { const [x, z] = DRUM, B = B0.scaled(x, z, 1.15); B.box(x, 0, z, 52, 10, 34, BRICK); B.box(x, 10, z, 52.6, 0.6, 34.6, BRICK2);
      for (const dx of [-12, 0, 12]) B.box(x + dx, 0, z + 17, 6, 6, 0.6, [0.16, 0.12, 0.10]);
      hall(B, { x, z, w: 38, d: 20, h: 6, roofH: 7.4, eaves: 2, roofC: ROOFG, wallC: RED, beamC: GREEN, y: 10.6 });
      for (let i = -5; i <= 5; i++) B.cyl(x + i * 3.2, 10.6, z + 13, 1.3, 1.3, 2.4, [0.70, 0.20, 0.16], 10, { ry: 0 }); }
    // ---- 大雁塔：七层方形砖塔，层层收分，出檐叠涩，每面券窗
    { const [x, z] = PAGODA, B = B0.scaled(x, z, 1.2), T = [0.80, 0.68, 0.52], T2 = [0.70, 0.58, 0.44];
      B.box(x, 0, z, 40, 5, 40, [0.74, 0.70, 0.64]); B.box(x, 5, z, 32, 2, 32, T2);
      let y = 7, w = 26;
      for (let i = 0; i < 7; i++) {
        const h = i === 0 ? 11 : 7.4 - i * 0.25;
        B.box(x, y, z, w, h, w, T);
        for (const [dx, dz, a, b] of [[0, w / 2, 3, 0.4], [0, -w / 2, 3, 0.4], [w / 2, 0, 0.4, 3], [-w / 2, 0, 0.4, 3]]) B.box(x + dx, y + h * 0.3, z + dz, a * (i ? 0.8 : 1), h * 0.45, b * (i ? 0.8 : 1), [0.24, 0.18, 0.14]);
        B.box(x, y + h, z, w + 2.4, 0.9, w + 2.4, T2); B.box(x, y + h + 0.9, z, w + 1.2, 0.5, w + 1.2, T);
        y += h + 1.4; w *= 0.92;
      }
      B.add(roofGeo(w + 1.4, w + 1.4, 3.6, 0, 0), T2, { x, y, z }); B.cyl(x, y + 3.4, z, 0.5, 1.2, 4, [0.62, 0.54, 0.40], 8);
      // 大慈恩寺：塔南的殿宇与院墙
      for (const [dz, w, d] of [[34, 26, 12], [50, 20, 10], [-28, 14, 8]]) hall(B, { x, z: z + dz, w, d, h: 4, roofH: 4.4, roofC: [0.38, 0.40, 0.42], wallC: [0.70, 0.22, 0.16], beamC: GREEN, plinth: 0.8 });
      for (const s of [-1, 1]) { B.box(x + s * 46, 0, z, 2, 4, 140, [0.70, 0.22, 0.16]); hall(B, { x: x + s * 22, z: z + 60, w: 8, d: 8, h: 4, roofH: 4.4, roofC: [0.38, 0.40, 0.42] }); }
      B.box(x, 0, z + 70, 94, 4, 2, [0.70, 0.22, 0.16]);
      // 唐僧玄奘像
      B.box(x, 0, z - 30, 4, 2, 4, [0.80, 0.78, 0.74]); B.cyl(x, 2, z - 30, 0.9, 1.4, 4.4, [0.30, 0.28, 0.26], 8);
    }
  },
  deco(D) {
    const { P } = D;
    const walls = P([[0.86, 0.84, 0.80], [0.78, 0.76, 0.72], [0.82, 0.78, 0.70], [0.70, 0.70, 0.72], [0.88, 0.86, 0.82]]);
    const tiles = P([[0.38, 0.40, 0.42], [0.44, 0.46, 0.48], [0.34, 0.36, 0.38], [0.50, 0.46, 0.42]]);
    const glass = P([[0.70, 0.74, 0.78], [0.80, 0.80, 0.80], [0.62, 0.66, 0.72], [0.84, 0.80, 0.72], [0.74, 0.70, 0.66]]);
    const tops = P([[0.60, 0.60, 0.62], [0.52, 0.54, 0.56]]);
    // 城内：限高，灰瓦坡顶为主
    D.blocks(0, 13, { pad: 4.8, skip: 0.1, pal: walls, roof: 'gable', roofPal: tiles, roofH: 2.6, hfn: (x, z, r) => 4 + Math.pow(r(), 1.8) * 14 });
    // 城外：中高层
    D.blocks(7, 16, { pad: 6, skip: 0.12, pal: glass, top: tops, hfn: (x, z, r) => 12 + Math.pow(r(), 1.5) * 40 });
    const tr = P([[0.24, 0.44, 0.24], [0.30, 0.52, 0.28], [0.20, 0.40, 0.22], [0.36, 0.54, 0.30]]);
    D.trees(2, 150, tr, { r: [3, 5] });
    D.trees(4, 40, tr, { r: [2.6, 3.6], test: (x, z) => z > 200 && Math.abs(x - PAGODA[0]) > 26 });
  },
  life(D) {
    D.bus([0.20, 0.52, 0.80]);
    D.ns(-4, -1, 6, 11, 0.15); D.ns(4, 1, 6, 11, 0.15);
    D.ew(MID - 4, -1, 6, 11, 0.15); D.ew(MID + 4, 1, 6, 11, 0.15);
    D.ew(S1 + 61, 1, 4, 12); D.ew(N0 - 61, -1, 3, 12); D.ns(W1 + 61, 1, 3, 12); D.ns(W0 - 61, -1, 3, 12);
    // 钟楼环岛：逆时针绕行
    const ring = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ring.push([BELL[0] + Math.cos(a) * 36, BELL[1] + Math.sin(a) * 36]); }
    for (let k = 0; k < 6; k++) D.seg(ring[k], ring[(k + 1) % 6], 1, 8, { lanes: [0.1] });
    D.crowd(DRUM[0] - 30, DRUM[1] + 18, DRUM[0] + 30, DRUM[1] + 30, 16);
    D.crowd(PAGODA[0] - 45, PAGODA[1] - 60, PAGODA[0] + 45, PAGODA[1] - 22, 30, [[PAGODA[0] - 11, PAGODA[1] - 58, PAGODA[0] + 11, PAGODA[1] - 30]]);
    D.crowd(-120, S1 + 10, 120, S1 + 24, 14);
    // 城墙顶上骑行 / 散步的人
    D.custom((t, put, wz, vis) => {
      const per = 2 * ((W1 - W0) + (S1 - N0));
      for (let i = 0; i < 26; i++) {
        let s = ((i * 113.7 + t * (i % 3 ? 3 : -5)) % per + per) % per, x, z;
        if (s < W1 - W0) { x = W0 + s; z = S1 - 2; } else if ((s -= W1 - W0) < S1 - N0) { x = W1 - 2; z = S1 - s; } else if ((s -= S1 - N0) < W1 - W0) { x = W1 - s; z = N0 + 2; } else { s -= W1 - W0; x = W0 + 2; z = N0 + s; }
        const zz = wz(z); if (!vis(x, zz)) continue;
        put('person', x, 10.4, zz, 1, 0, D.sc(...[[0.9, 0.3, 0.2], [0.2, 0.4, 0.8], [0.95, 0.85, 0.3], [0.95, 0.95, 0.95]][i % 4]));
      }
    });
  },
  taxi: [[0.24, 0.56, 0.42], [0.92, 0.80, 0.30]],
};
