// 5 上海外滩与陆家嘴：黄浦江在陆家嘴北面转弯；西岸外滩万国建筑群，东岸东方明珠、金茂大厦、环球金融中心（开瓶器）、上海中心（扭转）。
// 布局（局部坐标，x 东 z 南，1 单位 ≈ 2 米，距离压缩约一半，超高层高度按 ~0.55 缩放）
import * as THREE from 'three';
import { V3, BOX, roofGeo } from './kit.js';

const PEARL = [25, -100], JINMAO = [96, 42], SWFC = [172, 66], SHT = [118, 122];
const HW = 50;   // 江面半宽

export default {
  key: 'shanghai',
  scene: { name: 'The Bund & Lujiazui · 外滩 · 陆家嘴', sub: 'Huangpu River · Shanghai', lat: 31.2397, lon: 121.4998,
    zoom: 1.12, tilt: 0.6, planeY: 205, clouds: { count: 2, min: 0.5, max: 0.7, y: 235 }, look: 'soft' },
  origin: [-36, -1300],
  layout: /* glsl */ `
/* 江心线的有向距离：>0 在外侧（浦西 / 北岸），<0 在内侧（陆家嘴） */
float shS(float x, float z){
  if (z > -150.) return -(x + 70.);
  if (x > 40.) return -(z + 260.);
  float dx = x - 40.;
  float dz = z + 150.;
  return sqrt(dx*dx + dz*dz) - 110.;
}
/* 0 浦西街区 1 道路 2 绿地 3 江 4 滨江步道/地标广场 5 外滩建筑带 7 陆家嘴高楼 */
float shKind(float x, float z){
  float s = shS(x, z);
  if (abs(s) < ${HW}.) return 3.;
  if (s > 0.) {
    if (s < ${HW + 13}.) return 4.;
    if (s < ${HW + 29}.) return 1.;
    if (s < ${HW + 74}. && z > -150. && z < 260.) return 5.;
    if (gridD(x, 64., -10.) < 4. || gridD(z, 58., 20.) < 4.) return 1.;
    return 0.;
  }
  if (s > -${HW + 12}.) return 4.;
  if (ellD(x, z, ${PEARL[0]}., ${PEARL[1]}., 34., 30.) < 0.) return 4.;
  if (rectD(x, z, 66., 16., 206., 156.) < 0.) return 4.;
  if (ellD(x, z, 140., -62., 52., 40.) < 0.) return 2.;
  if (rectD(x, z, 18., -205., 70., -150.) < 0.) return 4.;
  if (gridD(x, 92., 50.) < 4.5 || gridD(z, 84., 0.) < 4.5) return 1.;
  return 7.;
}`,
  names: ['shS', 'shKind'], kind: 'shKind',
  groundFn: 'shGround',
  ground: /* glsl */ `
vec3 shGround(vec2 p, float x, float z){
  float s = shS(x, z);
  float k = shKind(x, z);
  vec3 asph = vec3(.48,.49,.52);
  if (k > 2.5 && k < 3.5) {
    vec3 c = water(p, vec3(.36,.44,.42), vec3(.50,.56,.50), clamp((${HW}. - abs(s))/30., 0., 1.));
    c = mix(c, s2l(vec3(.80,.82,.80)), band(abs(s) - ${HW}. + 1.2 + (vn(p*.3 + uTime*.4) - .5)*1.2, .5, .4)*.5);
    return c;
  }
  vec3 col = s2l(vec3(.74,.73,.71)*(.95 + .06*paint(p)));
  if (k > 3.5 && k < 4.5) {
    col = s2l(vec3(.84,.81,.76)*(.95 + .06*vn(p*.6)));
    col = mix(col, s2l(vec3(.74,.72,.68)), max(band(mod(x, 6.) - 3., .15, .1), band(mod(z, 6.) - 3., .15, .1))*.25);
    if (s < 0.) col = mix(col, grass(p, .15), band(s + ${HW + 7}., 3.2, .6));
    if (s > 0.) col = mix(col, s2l(vec3(.66,.64,.62)), band(s - ${HW + 1}., .9, .3));
  } else if (k > 1.5 && k < 2.5) {
    col = grass(p, .2 + .4*smoothstep(.45,.62,fbm(p*.03)));
    float e = ellD(x, z, 140., -62., 52., 40.);
    col = mix(col, s2l(vec3(.52,.66,.70)), 1. - smoothstep(-1., 1., ellD(x, z, 150., -58., 18., 10.)));
    col = mix(col, s2l(vec3(.86,.82,.74)), band(e + 3., 1.2, .4));
  } else if (k > 4.5 && k < 5.5) {
    col = s2l(vec3(.72,.71,.69)*(.95 + .06*vn(p*.5)));
  } else if (k > 6.5) {
    col = s2l(vec3(.76,.76,.75)*(.95 + .05*paint(p)));
  }
  if (k > .5 && k < 1.5) col = s2l(asph*(.95 + .06*vn(p*.3)));
  if (s > ${HW + 13}. && s < ${HW + 29}.) col = road(col, s - ${HW + 21}., 7.5, z, 2., asph);
  return col;
}`,
  build(B) {
    // ---- 东方明珠：三根立柱 + 三根斜撑 + 上下两个大球 + 五个小球 + 太空舱 + 天线
    { const [px, pz] = PEARL, PINK = [0.86, 0.30, 0.48], PINK2 = [0.78, 0.24, 0.42], COL = [0.92, 0.92, 0.94];
      B.cyl(px, 0, pz, 22, 24, 6, [0.80, 0.80, 0.82], 18);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094 + 0.5, cx = px + Math.cos(a) * 5, cz = pz + Math.sin(a) * 5;
        B.cyl(cx, 0, cz, 2.4, 2.8, 98, COL, 10);
        B.beam(new V3(px + Math.cos(a) * 24, 0, pz + Math.sin(a) * 24), new V3(px + Math.cos(a) * 6, 34, pz + Math.sin(a) * 6), 3.4, COL);
      }
      B.add(new THREE.SphereGeometry(14, 22, 14), PINK, { x: px, y: 42, z: pz, kind: 'smooth' });
      for (const y of [62, 70, 78]) B.add(new THREE.SphereGeometry(3.4, 12, 8), PINK2, { x: px + 6.5 * (y === 70 ? -1 : 1), y, z: pz + (y === 70 ? 0 : 3), kind: 'smooth' });
      B.add(new THREE.SphereGeometry(10, 20, 12), PINK, { x: px, y: 98, z: pz, kind: 'smooth' });
      B.cyl(px, 98, pz, 3.6, 4.2, 20, COL, 10);
      B.add(new THREE.SphereGeometry(4.6, 14, 10), PINK2, { x: px, y: 119, z: pz, kind: 'smooth' });
      B.cyl(px, 122, pz, 0.6, 2.2, 22, [0.86, 0.86, 0.88], 8);
      // 国际会议中心：两只玻璃地球
      B.box(44, 0, -178, 30, 13, 46, [0.86, 0.84, 0.80]);
      for (const zz of [-196, -160]) B.add(new THREE.SphereGeometry(9, 16, 12), [0.50, 0.66, 0.84], { x: 44, y: 17, z: zz, kind: 'smooth' });
    }
    // ---- 金茂大厦：塔式逐级收分（越往上收得越密）+ 尖顶
    { const [jx, jz] = JINMAO, C1 = [0.66, 0.70, 0.74], C2 = [0.84, 0.86, 0.88];
      B.box(jx, 0, jz, 40, 10, 40, [0.78, 0.78, 0.80]);
      let y = 0, w = 22; const segs = [16, 12, 10, 9, 8, 7, 6, 5, 4.5, 4, 3.5, 3, 3, 2.5, 2.5, 2];
      for (const h of segs) { B.box(jx, y, jz, w, h, w, C1, Math.PI / 4 * 0); B.box(jx, y + h - 0.6, jz, w + 1.2, 0.6, w + 1.2, C2); y += h; w *= 0.93; }
      B.box(jx, y, jz, w * 0.8, 5, w * 0.8, C2); B.cyl(jx, y + 5, jz, 0.5, w * 0.36, 14, C1, 8); B.cyl(jx, y + 19, jz, 0.2, 0.6, 6, C2, 6);
      for (const s of [-1, 1]) B.box(jx + s * 11.5, 0, jz, 1, y * 0.8, 1, C2);
    }
    // ---- 环球金融中心：方柱两侧弧形收窄，顶部梯形“开瓶器”洞口
    { const [sx, sz] = SWFC, GL = [0.60, 0.70, 0.80], FR = [0.82, 0.86, 0.90], H = 140, N = 28, ry = Math.PI / 4;
      for (let i = 0; i < N; i++) {
        const y0 = H * i / N, y1 = H * (i + 1) / N, t = (y0 + y1) / 2 / H;
        const wx = 26 * (1 - 0.82 * Math.pow(t, 1.3)), wz = 26 * (1 - 0.1 * t);
        if (y0 > 116 && y1 < 134) { for (const sgn of [-1, 1]) B.add(BOX, GL, { x: sx + Math.cos(ry) * sgn * wz * 0.38, y: y0, z: sz - Math.sin(ry) * sgn * wz * 0.38, sx: wx, sy: y1 - y0, sz: wz * 0.24, ry }); continue; }
        B.add(BOX, i % 4 ? GL : FR, { x: sx, y: y0, z: sz, sx: wx, sy: y1 - y0, sz: wz, ry });
      }
      B.add(BOX, FR, { x: sx, y: H, z: sz, sx: 5, sy: 1.6, sz: 23, ry });
      B.box(sx, 0, sz, 44, 8, 40, [0.80, 0.80, 0.82]);
    }
    // ---- 上海中心：圆角三角形平面，逐层扭转约 120°、向上收分，顶部斜切
    { const [tx, tz] = SHT, H = 172, N = 40, M = 24, GL = [0.66, 0.78, 0.82], arr = [];
      const P = (i, j) => { const y = H * i / N, t = y / H, a = j / M * Math.PI * 2 + t * 2.1;
        const r = 17 * (1 - 0.5 * t) * (1 + 0.1 * Math.cos(3 * (j / M * Math.PI * 2)) - (j === 0 ? 0.12 : 0));
        return [tx + Math.cos(a) * r, Math.min(y, H - 8 + 8 * Math.cos(a - 0.6)), tz + Math.sin(a) * r]; };
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j); arr.push(...a, ...c, ...b, ...a, ...d, ...c); }
      for (let j = 0; j < M; j++) { const a = P(N, j), b = P(N, j + 1); arr.push(tx, H - 6, tz, ...b, ...a); }
      B.tris(arr, GL, { kind: 'smooth' });
      for (let i = 4; i < N; i += 5) { const ring = []; for (let j = 0; j < M; j++) { const a = P(i, j), b = P(i, j + 1); ring.push(...a, ...b, b[0], b[1] + 0.8, b[2], ...a, b[0], b[1] + 0.8, b[2], a[0], a[1] + 0.8, a[2]); } B.tris(ring, [0.86, 0.90, 0.92]); }
      B.box(tx, 0, tz, 44, 9, 44, [0.80, 0.80, 0.82]);
    }
    // ---- 陆家嘴环形天桥
    B.add(new THREE.TorusGeometry(30, 2.2, 6, 40).rotateX(Math.PI / 2), [0.88, 0.88, 0.90], { x: 82, y: 8, z: -24 });
    for (let k = 0; k < 8; k++) { const a = k * 0.785; B.box(82 + Math.cos(a) * 30, 0, -24 + Math.sin(a) * 30, 1.4, 8, 1.4, [0.80, 0.80, 0.82]); }
    // ---- 外滩万国建筑群：沿江一排 13 栋石砌大楼（海关钟楼、汇丰圆顶、和平饭店绿色尖顶、中国银行蓝瓦顶……）
    const STONE = [[0.90, 0.80, 0.62], [0.84, 0.74, 0.60], [0.78, 0.70, 0.58], [0.92, 0.86, 0.72], [0.72, 0.64, 0.54]];
    const ROOF = [[0.42, 0.38, 0.36], [0.36, 0.56, 0.46], [0.50, 0.44, 0.40], [0.38, 0.40, 0.44], [0.46, 0.36, 0.30]];
    const COPPER = [0.36, 0.56, 0.46];
    const bund = [[-140, 26, 14, 0], [-112, 26, 16, 1], [-86, 22, 22, 'peace'], [-62, 22, 18, 'boc'], [-38, 24, 15, 2], [-12, 24, 16, 3], [12, 26, 20, 'hsbc'], [38, 22, 22, 'customs'], [62, 24, 14, 4], [86, 24, 16, 0], [110, 22, 15, 1], [134, 26, 17, 2], [160, 24, 13, 3], [186, 26, 15, 4], [212, 26, 12, 0], [236, 24, 13, 1]];
    for (const [z, d, h, typ] of bund) {
      const x = -70 - (HW + 50), col = typeof typ === 'number' ? STONE[typ] : STONE[0];
      B.box(x, 0, z, 40, h, d - 2, col);
      B.box(x, h, z, 41, 0.8, d - 1, [0.60, 0.54, 0.46]);
      if (typeof typ === 'number') B.add(roofGeo(36, d - 5, 4, 1, 0), ROOF[(typ + Math.round(z)) % 5 < 0 ? 0 : (typ + Math.abs(Math.round(z / 24))) % 5], { x, y: h + 0.8, z });
      for (let k = 0; k < 5; k++) B.box(x + 20.2, 2, z - (d - 2) / 2 + 2 + k * (d - 6) / 4, 0.4, h - 4, 1.6, [0.60, 0.58, 0.56]);   // 立面的竖向壁柱
      if (typ === 'peace') { B.box(x + 8, h, z, 14, 8, 12, col); B.cyl(x + 8, h + 8, z, 0.3, 7.6, 10, COPPER, 4, { ry: Math.PI / 4 }); }
      if (typ === 'boc') { B.add(BOX, [0.30, 0.42, 0.62], { x: x + 4, y: h, z, sx: 22, sy: 2.5, sz: 14 }); B.cyl(x + 4, h + 2.5, z, 0.2, 9, 5, [0.30, 0.42, 0.62], 4, { ry: Math.PI / 4 }); }
      if (typ === 'hsbc') { B.cyl(x + 6, h, z, 6, 6, 4, col, 16); B.add(new THREE.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0.62, 0.64, 0.66], { x: x + 6, y: h + 4, z, kind: 'smooth' }); }
      if (typ === 'customs') { B.box(x + 10, h, z, 10, 12, 10, col); B.box(x + 10, h + 12, z, 9, 4, 9, [0.92, 0.90, 0.86]); for (const s of [-1, 1]) B.box(x + 15.2, h + 13, z + s * 0, 0.3, 2.6, 2.6, [0.98, 0.96, 0.86]); B.cyl(x + 10, h + 16, z, 1, 4.4, 6, COPPER, 4, { ry: Math.PI / 4 }); }
      if (typ === 2 || typ === 4) { B.cyl(x + 14, h, z, 0.3, 4.5, 4, COPPER, 4, { ry: Math.PI / 4 }); }
    }
    // 外滩滨江：防汛墙 + 人民英雄纪念塔（三片合抱的高塔）
    for (let z = -148; z < 300; z += 8) B.box(-70 - HW - 1.2, 0, z, 1.2, 1.4, 8, [0.70, 0.68, 0.64]);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; B.beam(new V3(-138 + Math.cos(a) * 4, 0, -168 + Math.sin(a) * 4), new V3(-138, 34, -168), 2.4, [0.86, 0.84, 0.80], 4); }
    // 外白渡桥（苏州河口的钢桁架桥，北端）
    for (let k = 0; k < 2; k++) { const zz = -205 - k * 10; B.box(-180, 0, zz, 52, 3, 8, [0.42, 0.44, 0.46]); for (let i = 0; i < 6; i++) B.beam(new V3(-206 + i * 9, 3, zz), new V3(-201 + i * 9, 9, zz), 0.8, [0.36, 0.38, 0.40]); }
  },
  deco(D) {
    const { P } = D;
    const glass = P([[0.62, 0.70, 0.78], [0.70, 0.76, 0.82], [0.56, 0.62, 0.70], [0.80, 0.82, 0.84], [0.66, 0.72, 0.70], [0.86, 0.86, 0.84]]);
    const puxi = P([[0.84, 0.80, 0.72], [0.78, 0.76, 0.74], [0.70, 0.72, 0.76], [0.88, 0.84, 0.78], [0.66, 0.62, 0.58], [0.74, 0.66, 0.58]]);
    const tops = P([[0.58, 0.60, 0.62], [0.68, 0.70, 0.72], [0.52, 0.54, 0.56]]);
    const near = (x, z, p, r) => Math.hypot(x - p[0], z - p[1]) < r;
    D.blocks(7, 17, { pad: 6.5, skip: 0.22, pal: glass, top: tops, hfn: (x, z, r) => {
      if (near(x, z, PEARL, 70)) return 10 + r() * 14;
      const sAbs = Math.abs(x + 70);
      if (near(x, z, [134, 80], 120)) return 12 + r() * 22;
      return z > -150 && sAbs < 100 ? 12 + r() * 18 : 18 + Math.pow(r(), 1.6) * 46; } });
    D.blocks(0, 14, { pad: 5.2, skip: 0.08, pal: puxi, top: tops, hfn: (x, z, r) => 8 + Math.pow(r(), 1.8) * (x < -260 || z < -330 ? 46 : 22) });
    const tr = P([[0.24, 0.44, 0.24], [0.30, 0.52, 0.28], [0.20, 0.40, 0.22], [0.36, 0.56, 0.30]]);
    D.trees(2, 40, tr, { r: [3.6, 5.6] });
    // 外滩和陆家嘴滨江的行道树
    D.trees(4, 90, tr, { r: [2.6, 3.2], subs: 2, test: (x, z) => { const s = D.L.shS(x, z); return (s > 55 && s < 59) || (s < -56 && s > -60) || (s > 75 && s < 78 && z > -150); } });
  },
  life(D) {
    D.bus([0.92, 0.28, 0.20]);
    for (const x of [-140, -144, -128, -124]) D.ns(x, x < -134 ? -1 : 1, 3, 12, 0.12);
    D.ew(84, 1, 2, 12); D.ew(-84, -1, 2, 12); D.ew(0, 1, 3, 12); D.ew(4, -1, 3, 12);
    D.ns(50, 1, 2, 11); D.ns(-10 + 64 * -4, 1, 2, 11);
    // 江上：沿江往返的货船与游船，横渡的轮渡
    const curve = (off) => { const pts = []; for (let z = 420; z > -150; z -= 60) pts.push([-70 - off, z]);
      for (let a = 180; a <= 270; a += 15) { const r = 110 + off; pts.push([40 + r * Math.cos(a * Math.PI / 180), -150 + r * Math.sin(a * Math.PI / 180)]); }
      for (let x = 100; x < 560; x += 80) pts.push([x, -260 - off]); return pts; };
    const up = curve(-20), down = curve(20).reverse();
    D.ferry([...up, ...down.slice(1)], 9, [0.32, 0.30, 0.30], [0.66, 0.52, 0.40], 1.4);
    D.ferry([...down, ...up.slice(1)], 10, [0.92, 0.30, 0.24], [0.98, 0.96, 0.92], 1.1);
    D.ferry([...down, ...up.slice(1)], 9, [0.30, 0.32, 0.36], [0.80, 0.60, 0.30], 1.5);
    D.ferry([[-112, 80], [-28, 70], [-28, 80], [-112, 90]], 7, [0.20, 0.46, 0.62], [0.96, 0.96, 0.94], 0.9);
    D.crowd(-120, -140, -110, 260, 50);
    D.crowd(-28, -150, -16, 200, 22);
    D.crowd(PEARL[0] - 30, PEARL[1] + 22, PEARL[0] + 30, PEARL[1] + 30, 14);
    D.crowd(66, 140, 200, 156, 16);
  },
  taxi: [[0.30, 0.56, 0.86], [0.96, 0.82, 0.24], [0.36, 0.62, 0.40]],
};
