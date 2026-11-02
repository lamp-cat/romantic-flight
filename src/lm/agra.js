// 13 阿格拉泰姬陵：北临亚穆纳河的白色大理石陵墓（洋葱穹顶、四面拱门、四座宣礼塔），西侧红砂岩清真寺、东侧对称的答辩厅；
// 南面四分花园（十字水渠、中央水池、柏树列），最南端红砂岩正门。
import * as THREE from 'three';
import { V3, BOX } from './kit.js';

const TZ = -108, GZ = 136, MARB = [0.97, 0.96, 0.93], MARB2 = [0.86, 0.85, 0.82], RED = [0.72, 0.36, 0.26], RED2 = [0.62, 0.30, 0.22];

export default {
  key: 'agra',
  scene: { name: 'Taj Mahal · ताज महल', sub: 'Charbagh garden · Yamuna River · Agra', lat: 27.1751, lon: 78.0421,
    zoom: 1.22, tilt: 0.62, planeY: 110, clouds: { count: 2, min: 0.5, max: 0.7, y: 135 }, look: 'warm' },
  origin: [-50, -1300],
  layout: /* glsl */ `
/* 0 城区 1 道路 2 花园草坪 3 河/水渠 4 石材地面 7 对岸田地 */
float agKind(float x, float z){
  if (z < -152. && z > -268.) return 3.;
  if (z <= -268.) return abs(x) < 110. ? 2. : 7.;
  if (rectD(x, z, -108., -152., 108., ${GZ + 6}.) < 0.) {
    if (z < -70. || z > ${GZ - 8}.) return 4.;
    if (abs(x) < 3.5 || abs(z - 30.) < 3.5) return 3.;
    if (abs(x) < 12. && abs(z - 30.) < 12.) return 4.;
    if (abs(x) < 9. || abs(z - 30.) < 9. || abs(abs(x) - 100.) < 8. || z < -62. || z > ${GZ - 16}.) return 4.;
    if (abs(abs(x) - 50.) < 2.5 || abs(abs(z - 30.) - 50.) < 2.5) return 4.;
    return 2.;
  }
  if (rectD(x, z, -108., ${GZ + 6}., 108., 214.) < 0.) return 4.;
  if (abs(z - 222.) < 6. || abs(x - 130.) < 5. && z > -150. || abs(x + 130.) < 5. && z > -150.) return 1.;
  if (gridD(x, 70., 0.) < 3. && z > 230. || gridD(z, 60., 0.) < 3. && abs(x) > 140.) return 1.;
  return 0.;
}`,
  names: ['agKind'], kind: 'agKind',
  groundFn: 'agGround',
  ground: /* glsl */ `
vec3 agGround(vec2 p, float x, float z){
  float k = agKind(x, z);
  vec3 asph = vec3(.52,.50,.48);
  if (k > 2.5 && k < 3.5) {
    if (z > -152.) return water(p, vec3(.42,.56,.66), vec3(.54,.68,.74), .6);
    vec3 c = water(p, vec3(.40,.46,.42), vec3(.56,.58,.48), clamp(min(z + 268., -152. - z)/40., 0., 1.));
    return mix(c, s2l(vec3(.78,.72,.60)), band(min(z + 268., -152. - z), 3., 1.5)*.6);
  }
  vec3 col = s2l(vec3(.84,.76,.62)*(.95 + .06*paint(p)));
  if (k > 1.5 && k < 2.5) {
    col = grass(p, .1 + .3*smoothstep(.45,.62,fbm(p*.05)));
    col = mix(col, s2l(vec3(.70,.62,.46)), band(abs(mod(x, 25.) - 12.5) - abs(mod(z - 5., 25.) - 12.5), .8, .3)*.5*step(-150., z));
  }
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.78,.46,.36)*(.95 + .05*vn(p*.5)));
    if (abs(x) < 9. || abs(z - 30.) < 9.) col = s2l(vec3(.88,.84,.78));
    if (abs(x) < 34. && abs(z - ${TZ}.) < 34.) col = s2l(vec3(.94,.92,.88));
    col = mix(col, s2l(vec3(.92,.88,.80)), max(band(mod(x, 8.) - 4., .2, .1), band(mod(z, 8.) - 4., .2, .1))*.25);
  }
  if (k > 6.5) col = mix(grass(p, .6), s2l(vec3(.76,.70,.52)), step(.5, fract(x/40. + .3*sin(z*.01))));
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (k < .5) col = s2l(vec3(.82,.74,.62)*(.95 + .05*paint(p)));
  return col;
}`,
  build(B0, { R }) {
    const B = B0;
    const onion = (S, x, y, z, r, h, col, seg = 20) => S.lathe(x, y, z, [[r * 0.82, 0], [r * 1.0, h * 0.22], [r * 1.06, h * 0.38], [r * 0.96, h * 0.55], [r * 0.7, h * 0.72], [r * 0.38, h * 0.86], [r * 0.12, h * 0.96], [0.05, h]], col, seg);
    const chhatri = (S, x, y, z, r, col = MARB, dome = MARB) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.box(x + dx * r * 0.7, y, z + dz * r * 0.7, r * 0.22, r * 1.4, r * 0.22, col);
      S.box(x, y + r * 1.4, z, r * 1.9, r * 0.3, r * 1.9, col); onion(S, x, y + r * 1.7, z, r * 0.8, r * 1.5, dome, 12); };
    // ---- 陵墓：台基 + 抹角方形主体（四面大拱门 pishtaq）+ 鼓座 + 洋葱穹顶 + 四角小亭 + 四座宣礼塔
    { const S = B0.scaled(0, TZ, 1.3), x = 0, z = TZ;
      S.box(x, 0, z, 66, 6, 66, MARB); S.box(x, 6, z, 66.6, 0.6, 66.6, MARB2);
      for (const s of [-1, 1]) S.box(x, 0, z + s * 33.1, 14, 4, 0.4, MARB2);
      const w = 42, c = 8, y0 = 6.6, h = 26, pts = [[-w / 2 + c, -w / 2], [w / 2 - c, -w / 2], [w / 2, -w / 2 + c], [w / 2, w / 2 - c], [w / 2 - c, w / 2], [-w / 2 + c, w / 2], [-w / 2, w / 2 - c], [-w / 2, -w / 2 + c]];
      S.prism(pts, y0, h, MARB, { x, z });
      for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const fx = x + nx * (w / 2 + 0.3), fz = z + nz * (w / 2 + 0.3), sx = nx ? 0.6 : 18, sz = nx ? 18 : 0.6;
        S.add(BOX, [0.99, 0.98, 0.96], { x: fx, y: y0, z: fz, sx: nx ? 0.6 : 20, sy: h + 3, sz: nx ? 20 : 0.6 });
        S.add(BOX, [0.70, 0.70, 0.72], { x: fx + nx * 0.2, y: y0, z: fz + nz * 0.2, sx: nx ? 0.4 : 12, sy: h * 0.72, sz: nx ? 12 : 0.4 });
        S.add(BOX, [0.56, 0.56, 0.60], { x: fx + nx * 0.3, y: y0 + h * 0.08, z: fz + nz * 0.3, sx: nx ? 0.3 : 6, sy: h * 0.5, sz: nx ? 6 : 0.3 });
        for (const s of [-1, 1]) { S.add(BOX, [0.76, 0.76, 0.78], { x: fx + (nz ? s * 14 : nx * 0.2), y: y0 + 2, z: fz + (nx ? s * 14 : nz * 0.2), sx: nx ? 0.4 : 4, sy: 8, sz: nx ? 4 : 0.4 }); S.add(BOX, [0.76, 0.76, 0.78], { x: fx + (nz ? s * 14 : nx * 0.2), y: y0 + 14, z: fz + (nx ? s * 14 : nz * 0.2), sx: nx ? 0.4 : 4, sy: 8, sz: nx ? 4 : 0.4 }); }
        void sx; void sz;
      }
      S.prism(pts.map(([a, b]) => [a * 1.02, b * 1.02]), y0 + h, 1, MARB2, { x, z });
      const yd = y0 + h + 1; S.cyl(x, yd, z, 9.5, 9.5, 7, MARB, 24);
      onion(S, x, yd + 7, z, 12, 26, MARB, 28);
      S.cyl(x, yd + 33, z, 0.3, 0.8, 7, [0.90, 0.74, 0.36], 8); S.add(new THREE.SphereGeometry(0.9, 8, 6), [0.92, 0.76, 0.36], { x, y: yd + 36, z });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chhatri(S, x + dx * 13.5, yd, z + dz * 13.5, 3.4);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const mx = x + dx * 30.5, mz = z + dz * 30.5;
        S.cyl(mx, 6.6, mz, 1.9, 2.4, 34, MARB, 12); for (const yy of [14, 24, 34]) S.cyl(mx, 6.6 + yy - 0.4, mz, 3.2, 2.4, 1.4, MARB2, 12);
        chhatri(S, mx, 41, mz, 2.6); }
    }
    // ---- 清真寺（西）与答辩厅（东）：红砂岩、三个白穹顶、中央白框大拱门
    for (const s of [-1, 1]) { const x = s * 86, z = TZ, S = B0.scaled(x, z, 1.1);
      S.box(x, 0, z, 18, 3, 64, RED2); S.box(x, 3, z, 14, 16, 50, RED); S.box(x, 19, z, 14.4, 0.8, 50.4, MARB2);
      S.box(x - s * 7.2, 3, z, 0.4, 19, 13, MARB); S.box(x - s * 7.4, 3, z, 0.4, 13, 8, [0.36, 0.20, 0.16]);
      for (const dz of [-14, 14]) S.box(x - s * 7.3, 5, z + dz, 0.4, 8, 6, [0.40, 0.22, 0.18]);
      S.cyl(x, 19.8, z, 5, 5, 3, MARB, 16); onion(S, x, 22.8, z, 6, 12, MARB, 20);
      for (const dz of [-17, 17]) { S.cyl(x, 19.8, z + dz, 3.4, 3.4, 2, MARB, 14); onion(S, x, 21.8, z + dz, 4, 8, MARB, 16); }
      for (const dz of [-25, 25]) for (const dx of [-6, 6]) chhatri(S, x + dx, 19.8, z + dz, 1.8, RED, MARB); }
    // 河边台地与围墙（红砂岩，四角八角亭）
    B.box(0, 0, -152, 220, 6, 4, RED2);
    for (const [x0, z0, x1, z1] of [[-108, -150, -108, GZ], [108, -150, 108, GZ], [-108, GZ, -24, GZ], [24, GZ, 108, GZ]]) { const w = Math.abs(x1 - x0) || 3, d = Math.abs(z1 - z0) || 3; B.box((x0 + x1) / 2, 0, (z0 + z1) / 2, w, 9, d, RED); B.box((x0 + x1) / 2, 9, (z0 + z1) / 2, w + 0.6, 0.6, d + 0.6, RED2); }
    for (const [x, z] of [[-108, -150], [108, -150], [-108, GZ], [108, GZ], [-108, -20], [108, -20]]) { B.cyl(x, 0, z, 5, 5.4, 12, RED, 8, { ry: Math.PI / 8 }); chhatri(B, x, 12, z, 3, RED, MARB); }
    // ---- 正门（Darwaza）：红砂岩、白框拱门、顶上一排小穹顶、四角塔亭
    { const x = 0, z = GZ, S = B0.scaled(x, z, 1.15);
      S.box(x, 0, z, 46, 24, 22, RED); S.box(x, 24, z, 46.6, 0.8, 22.6, RED2);
      for (const s of [-1, 1]) { S.box(x, 0, z + s * 11.2, 18, 21, 0.4, MARB); S.box(x, 0, z + s * 11.4, 12, 15, 0.4, [0.36, 0.20, 0.16]); S.box(x, 0, z + s * 11.5, 6, 10, 0.4, [0.20, 0.12, 0.10]);
        for (let i = 0; i < 11; i++) { const cx = x - 15 + i * 3; S.box(cx, 24.8, z + s * 9, 0.4, 2, 0.4, MARB); S.add(new THREE.SphereGeometry(1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MARB, { x: cx, y: 26.8, z: z + s * 9 }); } }
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { S.cyl(x + dx * 22, 0, z + dz * 10, 2.6, 2.8, 28, RED, 8, { ry: Math.PI / 8 }); chhatri(S, x + dx * 22, 28, z + dz * 10, 2.4, RED, MARB); } }
    // 中央水池的大理石台与喷泉
    B.box(0, 0, 30, 16, 1, 16, MARB); B.box(0, 1, 30, 10, 0.3, 10, [0.50, 0.64, 0.72]);
    for (let i = 0; i < 14; i++) for (const s of [-1, 1]) B.cyl(0, 0, -50 + i * 12 + (i > 6 ? 16 : 0), 0.2, 0.3, 3 + (i % 2), [0.92, 0.96, 0.98], 5);
    // 对岸月光花园的残墙
    B.box(0, 0, -290, 200, 3, 3, RED2);
    void R; void V3;
  },
  deco(D) {
    const { P, R } = D;
    // 水渠两侧的柏树列
    const cyp = P([[0.16, 0.34, 0.18], [0.20, 0.38, 0.20], [0.14, 0.30, 0.16]]);
    for (let z = D.z0 + 2; z < D.z0 + 160; z += 8) { const lz = D.local(z); if (lz < -60 || lz > GZ - 20 || Math.abs(lz - 30) < 14) continue;
      for (const x of [-7, 7]) D.tree(x, z, 1.8, [D.pick(cyp), ...cyp], { flat: 3, h: 0.5, subs: 0 }); }
    for (let x = -96; x < 96; x += 8) { if (Math.abs(x) < 14) continue; for (const off of [-7, 7]) { const zz = D.rowZ(30 + off); if (zz !== null) D.tree(x, zz, 1.8, [D.pick(cyp), ...cyp], { flat: 3, h: 0.5, subs: 0 }); } }
    const tr = P([[0.28, 0.46, 0.24], [0.34, 0.52, 0.28], [0.40, 0.56, 0.30], [0.24, 0.42, 0.22]]);
    D.trees(2, 60, tr, { r: [3.4, 5], test: (x, z) => z > -150 && (Math.abs(Math.abs(x) - 75) < 18 || Math.abs(Math.abs(z - 30) - 75) < 18) });
    D.trees(2, 40, tr, { r: [3, 5], test: (x, z) => z < -270 });
    D.trees(0, 50, tr, { r: [3, 5] });
    const walls = P([[0.88, 0.80, 0.66], [0.84, 0.72, 0.58], [0.92, 0.86, 0.74], [0.78, 0.62, 0.50], [0.90, 0.90, 0.86]]);
    const tops = P([[0.70, 0.64, 0.56], [0.80, 0.74, 0.64]]);
    D.blocks(0, 12, { pad: 4.4, skip: 0.18, pal: walls, top: tops, roof: 'flat', roofPal: tops, hfn: (x, z, r) => 5 + Math.pow(r(), 1.6) * 12 });
    D.trees(7, 40, tr, { r: [3, 5] });
    void R;
  },
  life(D) {
    D.bus([0.30, 0.56, 0.36]);
    D.crowd(-100, -150, -40, -70, 20); D.crowd(40, -150, 100, -70, 20);
    D.crowd(-34, -76, 34, -70, 22);
    D.crowd(-9, -62, -4, GZ - 10, 22); D.crowd(4, -62, 9, GZ - 10, 22);
    D.crowd(-96, 22, 96, 38, 30, [[-12, 18, 12, 42]]);
    D.crowd(-100, GZ + 10, 100, 210, 40);
    D.ew(220, 1, 3, 9); D.ew(224, -1, 3, 9); D.ns(128, 1, 2, 9); D.ns(-132, -1, 2, 9);
    D.sail(6, [-300, -262, 300, -158], (x, z) => z < -160 && z > -260, { kind: 'row', v: [1.5, 3], cols: [[0.70, 0.50, 0.30], [0.30, 0.50, 0.70], [0.86, 0.30, 0.24]] });
  },
  taxi: [[0.20, 0.30, 0.20], [0.96, 0.80, 0.20]],
};
