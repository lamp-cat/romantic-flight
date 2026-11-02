// 14 迪拜哈利法塔：Y 形平面、螺旋退台的超高塔（高度按比例压缩），南侧迪拜喷泉湖（动态水柱），
// 东侧迪拜购物中心、西侧露天市场 Souk Al Bahar，北面谢赫扎耶德路两侧的摩天楼群与棕榈大道。
import * as THREE from 'three';
import { BOX } from './kit.js';

const HB = 300, GL = [0.86, 0.90, 0.95], GL2 = [0.76, 0.82, 0.90], CAP = [0.97, 0.98, 1.0], SAND = [0.88, 0.78, 0.62];
const LAKE = (x, z) => Math.pow(Math.abs(x - 20) / 128, 2.4) + Math.pow(Math.abs(z - 66) / 40, 2.4);

export default {
  key: 'dubai',
  scene: { name: 'Burj Khalifa · برج خليفة', sub: 'Dubai Fountain · Downtown Dubai · Sheikh Zayed Road', lat: 25.1972, lon: 55.2744,
    zoom: 1.08, tilt: 0.62, planeY: 330, clouds: { count: 1, min: 0.45, max: 0.6, y: 350 }, look: 'desert' },
  origin: [-6, -1300],
  layout: /* glsl */ `
/* 0 城区 1 道路 2 公园 3 湖 4 广场/购物中心 5 沙地空地 */
float dbKind(float x, float z){
  if (pow(abs(x - 20.)/128., 2.4) + pow(abs(z - 66.)/40., 2.4) < 1.) return 3.;
  if (sqrt(x*x + z*z) < 44.) return 2.;
  if (abs(z + 200.) < 14.) return 1.;
  if (rectD(x, z, 140., 16., 262., 130.) < 0.) return 4.;
  if (rectD(x, z, -140., 30., -88., 104.) < 0.) return 4.;
  if (pow(abs(x - 20.)/150., 2.4) + pow(abs(z - 66.)/58., 2.4) < 1.) return 4.;
  float rr = sqrt(x*x/1.6 + (z - 30.)*(z - 30.));
  if (abs(rr - 175.) < 5.) return 1.;
  if (z > -186. && (gridD(x, 96., 48.) < 3.5 || gridD(z, 84., 40.) < 3.5) && rr > 180.) return 1.;
  if (z < -186. && gridD(x, 64., 0.) < 3. ) return 1.;
  if (z > 190. && fract(sin(floor(x/60.)*12.9 + floor(z/60.)*78.2)*437.5) < .4) return 5.;
  return 0.;
}`,
  names: ['dbKind'], kind: 'dbKind',
  groundFn: 'dbGround',
  ground: /* glsl */ `
vec3 dbGround(vec2 p, float x, float z){
  float k = dbKind(x, z);
  if (k > 2.5 && k < 3.5) {
    float e = 1. - (pow(abs(x - 20.)/128., 2.4) + pow(abs(z - 66.)/40., 2.4));
    return water(p, vec3(.22,.48,.62), vec3(.40,.66,.76), clamp(e*3., 0., 1.));
  }
  vec3 col = s2l(vec3(.86,.82,.74)*(.95 + .05*paint(p)));
  if (k > 1.5 && k < 2.5) { col = grass(p, .2); if (abs(mod(atan(z, x)*3./3.14159, 2.) - 1.) < .12) col = s2l(vec3(.90,.86,.78)); }
  if (k > 3.5 && k < 4.5) col = s2l(vec3(.90,.86,.78)*(.96 + .04*vn(p*.4)));
  if (k > .5 && k < 1.5) { col = s2l(vec3(.40,.40,.42)*(.95 + .06*vn(p*.3)));
    if (abs(z + 200.) < 14.) col = mix(col, s2l(vec3(.92,.90,.84)), band(abs(mod(z + 200., 4.7) - 2.35), .12, .06)*.5 + band(abs(z + 200.) - 1.2, .8, .4)*.6); }
  if (k > 4.5) col = s2l(vec3(.90,.78,.58)*(.94 + .08*fbm(p*.03)));
  return col;
}`,
  build(B) {
    // ---- 哈利法塔：中心六边形核心 + 三翼退台
    const N = 27, A0 = -Math.PI / 2, SB = (x, y, z, w, h, d, c, ry = 0) => B.add(BOX, c, { x, y, z, ry, sx: w, sy: h, sz: d, kind: 'shell' });
    B.cyl(0, 0, 0, 34, 36, 2, [0.88, 0.86, 0.80], 32);
    for (let k = 0; k < N; k++) {
      const y0 = 2 + HB * 0.70 * k / N, y1 = 2 + HB * 0.70 * (k + 1) / N;
      for (let i = 0; i < 3; i++) {
        const drops = Math.floor((k + (3 - i) % 3) / 3), L = 21 * (1 - drops / (N / 3 + 1.4));
        if (L < 6) continue;
        const a = A0 + i * 2 * Math.PI / 3, w = 8 - drops * 0.18, cx = Math.cos(a) * L / 2, cz = Math.sin(a) * L / 2;
        SB(cx, y0, cz, L, y1 - y0 - 0.5, w, k % 2 ? GL : GL2, -a);
        SB(cx, y1 - 0.5, cz, L + 0.3, 0.5, w + 0.3, CAP, -a);
        SB(Math.cos(a) * (L - 0.4), y0, Math.sin(a) * (L - 0.4), 1.4, y1 - y0, w * 0.55, CAP, -a);
      }
    }
    B.cyl(0, 2, 0, 6, 6.5, HB * 0.70, GL, 6, { kind: 'shell' });
    B.cyl(0, 2 + HB * 0.70, 0, 3.6, 5.6, HB * 0.12, GL, 6, { kind: 'shell' }); B.cyl(0, 2 + HB * 0.82, 0, 3.0, 3.6, 0.8, CAP, 6, { kind: 'shell' });
    B.cyl(0, 2 + HB * 0.82, 0, 2.0, 3.0, HB * 0.07, GL2, 6, { kind: 'shell' });
    B.cyl(0, 2 + HB * 0.89, 0, 0.25, 1.9, HB * 0.12, [0.84, 0.86, 0.90], 8, { kind: 'shell' });
    // ---- 迪拜购物中心（东，低矮大体量、屋顶天窗）+ 地址酒店
    B.box(200, 0, 72, 118, 13, 108, [0.88, 0.82, 0.72]); B.box(200, 13, 72, 119, 0.8, 109, [0.94, 0.90, 0.82]);
    for (let i = 0; i < 5; i++) B.box(160 + i * 20, 13.8, 72, 3, 1.4, 90, [0.62, 0.74, 0.82]);
    B.box(170, 0, 22, 40, 8, 10, [0.80, 0.74, 0.64]);
    const tower = (x, z, w, d, h, c = GL, top = CAP) => { B.box(x, 0, z, w, h, d, c); B.box(x, h, z, w * 0.8, 2, d * 0.8, top); };
    // Address Downtown：两段收分、顶部斜面
    { const x = 128, z = -12; B.box(x, 0, z, 18, 64, 14, [0.66, 0.72, 0.78]); B.box(x, 64, z, 14, 14, 11, [0.70, 0.76, 0.82]); B.cyl(x, 78, z, 0.3, 4, 8, CAP, 4, { ry: Math.PI / 4 }); }
    { const x = -128, z = -26; B.box(x, 0, z, 16, 50, 16, [0.80, 0.74, 0.64]); B.box(x, 50, z, 12, 8, 12, [0.84, 0.78, 0.68]); }
    // ---- Souk Al Bahar（西岸，阿拉伯风格低层 + 小穹顶）
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = -132 + j * 18, z = 38 + i * 18; B.box(x, 0, z, 15, 6 + (i + j) % 2 * 2, 15, SAND); B.box(x, 6 + (i + j) % 2 * 2, z, 15.6, 0.8, 15.6, [0.80, 0.68, 0.52]); }
    for (const [x, z] of [[-114, 56], [-96, 92], [-132, 74]]) B.add(new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0.92, 0.84, 0.70], { x, y: 8, z });
    B.box(-96, 0, 30, 6, 22, 6, SAND); B.add(new THREE.SphereGeometry(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0.92, 0.84, 0.70], { x: -96, y: 22, z: 30 });
    // 湖上步行桥
    B.box(-70, 1.2, 72, 44, 0.8, 4, [0.86, 0.84, 0.80]);
    // ---- 谢赫扎耶德路两侧的标志楼：酋长塔（两座三角形塔）等
    for (const [x, h] of [[-36, 96], [-14, 84]]) { B.prism([[-7, -6], [7, -6], [0, 8]], 0, h, [0.72, 0.78, 0.82], { x, z: -228 }); B.cyl(x, h, -228, 0.2, 1.6, 10, CAP, 3); }
    tower(40, -228, 16, 14, 88, [0.42, 0.52, 0.62]); tower(80, -170, 14, 14, 72, [0.62, 0.70, 0.78]);
    tower(-96, -170, 14, 16, 80, [0.50, 0.58, 0.66]); tower(140, -230, 18, 14, 96, [0.60, 0.68, 0.74]);
    tower(-170, -232, 16, 16, 70, [0.70, 0.74, 0.76]); tower(196, -168, 14, 14, 66, [0.46, 0.56, 0.64]);
    // 地铁高架线（沿谢赫扎耶德路）
    B.box(0, 7, -190, 900, 1.6, 4, [0.86, 0.86, 0.84]);
    for (let x = -440; x <= 440; x += 30) B.box(x, 0, -190, 2, 7, 2, [0.80, 0.80, 0.78]);
  },
  deco(D) {
    const { P } = D;
    const palms = P([[0.30, 0.50, 0.26], [0.36, 0.56, 0.28], [0.26, 0.44, 0.22]]);
    D.trees(2, 60, palms, { r: [2.2, 3], flat: 0.45, h: 2.4, subs: 4 });
    D.trees(4, 50, palms, { r: [2.2, 3], flat: 0.45, h: 2.4, subs: 4, test: (x, z) => !(x > 140 && x < 262 && z > 16 && z < 130) && !(x > -140 && x < -88 && z > 30 && z < 104) });
    D.trees(0, 70, palms, { r: [2.2, 3], flat: 0.45, h: 2.4, subs: 4 });
    const glass = P([[0.80, 0.74, 0.64], [0.52, 0.60, 0.68], [0.86, 0.80, 0.70], [0.74, 0.68, 0.58], [0.44, 0.52, 0.60], [0.90, 0.86, 0.78], [0.70, 0.62, 0.52]]);
    const tops = P([[0.86, 0.88, 0.90], [0.78, 0.80, 0.82], [0.70, 0.72, 0.74]]);
    D.blocks(0, 22, { pad: 5, skip: 0.22, jitter: 3, pal: glass, top: tops, roof: 'flat', roofPal: tops,
      hfn: (x, z, r) => { const near = Math.max(0, 1 - Math.abs(z + 200) / 60), rr = Math.hypot(x, z - 30);
        if (Math.abs(x) < 70 && z < 0 && z > -175) return 6 + r() * 10; return (rr < 200 ? 10 : 14) + Math.pow(r(), 1.5) * (30 + 46 * near) + (rr > 240 ? 6 : 0); } });
  },
  life(D) {
    D.bus([0.86, 0.22, 0.20]);
    for (const [off, d] of [[-10, -1], [-6.5, -1], [-3, -1], [3, 1], [6.5, 1], [10, 1]]) D.ew(-200 + off, d, 4, 16);
    D.crowd(-40, 22, 0, 30, 18); D.crowd(130, 16, 160, 40, 16); D.crowd(-88, 40, -70, 100, 14); D.crowd(-30, -44, 30, -40, 10);
    D.sail(4, [-100, 40, 140, 96], (x, z) => LAKE(x, z) < 0.8, { kind: 'row', v: [1, 2], cols: [[0.70, 0.50, 0.30], [0.92, 0.92, 0.90]] });
    const W = D.sc(0.96, 0.98, 1.0);
    D.custom((t, put, wz) => {
      const ph = Math.floor(t / 9) % 3;
      for (let i = 0; i < 44; i++) {
        const u = i / 43, x = -78 + u * 190, z = 64 + 11 * Math.sin(u * Math.PI * 3);
        let a = ph === 0 ? Math.sin(t * 2.2 - u * 14) : ph === 1 ? Math.sin(t * 1.6 + Math.abs(u - 0.5) * 18) : Math.sin(t * 3 + (i % 2) * Math.PI);
        a = Math.max(0, a); const h = 3 + 34 * a * a * (0.7 + 0.3 * Math.sin(i * 1.7));
        put('jet', x, 0, wz(z), [1.1, h, 1.1], 0, W);
        if (i % 2 === 0) put('jet', x + 2, 0, wz(z + 5), [0.8, h * 0.6, 0.8], 0, W);
      }
    });
  },
  taxi: [[0.86, 0.84, 0.80], [0.90, 0.30, 0.20]],
};
