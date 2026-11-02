// 10 吉萨金字塔：胡夫、哈夫拉、孟卡拉三座大金字塔 + 王后金字塔、狮身人面像、河谷神庙、马斯塔巴墓群；东侧是纳兹莱特村的平顶房。
// 布局（局部坐标，x 东 z 南，1 单位 ≈ 2 米）：以哈夫拉金字塔为参照，三座金字塔沿西南对角线排列（距离略有压缩）。
import { V3, BOX } from './kit.js';

const KHUFU = [100, -150, 57.5, 73], KHAFRE = [-30, 12, 53.5, 71.5], MENK = [-140, 178, 26, 33];
const SPHINX = [186, 84];

export default {
  key: 'giza',
  scene: { name: 'Pyramids of Giza · الأهرامات', sub: 'Khufu, Khafre, Menkaure & the Great Sphinx · Giza plateau', lat: 29.9753, lon: 31.1376,
    zoom: 1.12, tilt: 0.62, planeY: 110, clouds: { count: 1, min: 0.45, max: 0.6, y: 150 }, look: 'desert' },
  origin: [-74, -1300],
  layout: /* glsl */ `
float gzCity(float x, float z){ return x - 238. - 18.*sin(z*.011) - 12.*sin(z*.031 + 1.) - max(0., -z - 60.)*.5; }
/* 0 村镇 1 道路 2 农田 4 高原碎石地 6 沙漠 */
float gzKind(float x, float z){
  if (abs(z - 250.) < 5. && x > 150.) return 1.;
  if (abs(x - 226.) < 4. && z < 250. && z > -300.) return 1.;
  if (abs(z + 300.) < 4. && x > -320. && x < 230.) return 1.;
  if (gzCity(x, z) > 0.) { if (x > 700. + 40.*sin(z*.008)) return 2.; return 0.; }
  if (rectD(x, z, -260., -270., 240., 260.) < 0.) return 4.;
  return 6.;
}`,
  names: ['gzCity', 'gzKind'], kind: 'gzKind',
  groundFn: 'gzGround',
  ground: /* glsl */ `
vec3 gzGround(vec2 p, float x, float z){
  float k = gzKind(x, z);
  float rip = sin(x*.55 + z*.28 + vn(p*.04)*5.)*.5 + .5;
  float dune = fbm(p*.008 + 2.);
  vec3 col = s2l(mix(vec3(.93,.82,.64), vec3(.86,.72,.54), smoothstep(.35, .7, dune))*(.94 + .05*fbm(p*.03) + .05*rip));
  if (k > 3.5 && k < 4.5) {
    // 高原：浅色石灰岩碎石，带深浅斑块
    float e = smoothstep(0., 50., -rectD(x, z, -260., -270., 240., 260.));
    vec3 rock = vec3(.90,.84,.72)*(.9 + .12*vn(p*.25) + .06*fbm(p*.05));
    col = mix(col, s2l(rock), .55*e);
    col = mix(col, s2l(vec3(.80,.74,.64)), .35*e*smoothstep(.55, .75, vn(p*.04)));
    // 金字塔脚下的阴影色带与狮身人面像的凹坑
    col = mix(col, s2l(vec3(.66,.54,.40)), (1. - smoothstep(-2., 4., rectD(x, z, ${SPHINX[0] - 50}., ${SPHINX[1] - 22}., ${SPHINX[0] + 40}., ${SPHINX[1] + 22}.)))*.8);
    // 堤道

  } else if (k < .5) {
    col = s2l(vec3(.78,.70,.58)*(.93 + .08*paint(p)));
    col = road(col, mod(z + 15., 30.) - 15., 2., x, 0., vec3(.62,.58,.52));
    col = road(col, mod(x + 11., 46.) - 23., 2.2, z, 0., vec3(.62,.58,.52));
  } else if (k > 1.5 && k < 2.5) {
    col = grass(p, .2 + .4*step(.5, fract(z/34.)));
  }
  vec3 asph = vec3(.62,.58,.54);
  if (x > 150.) col = road(col, z - 250., 4.5, x, 1., asph);
  if (z < 250. && z > -300.) col = road(col, x - 226., 3.5, z, 0., asph);
  if (x < 230. && x > -320.) col = road(col, z + 300., 3.5, x, 0., asph);
  // 停车场
  col = mix(col, s2l(vec3(.70,.68,.64)), 1. - smoothstep(-1., 1., rectD(x, z, 130., 150., 215., 178.)));
  return col;
}`,
  build(B0, { R }) {
    let B = B0;
    // eslint-disable-next-line no-param-reassign
    const STONE = [0.86, 0.73, 0.52], STONE2 = [0.82, 0.69, 0.49], CASING = [0.95, 0.90, 0.78];
    // 阶梯感的金字塔：N 层四棱台，每层之间留一道细小的台阶
    const pyramid = ([cx, cz, a, h], cap = 0) => {
      const N = 14, step = 0.006 * a;
      for (let i = 0; i < N; i++) {
        const y0 = h * i / N, y1 = h * (i + 1) / N, a0 = a * (1 - i / N) - (i ? step : 0), a1 = Math.max(0.2, a * (1 - (i + 1) / N));
        const col = cap && i >= N - cap ? CASING : i % 2 ? STONE : STONE2;
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], FACE = [1.0, 1.16, 0.9, 1.04];   // 北 东 南 西：手调明暗，让棱线清楚
        for (let k = 0; k < 4; k++) {
          const arr = [];
          const [ax, az] = c[k], [bx, bz] = c[(k + 1) % 4];
          const p00 = [cx + ax * a0, y0, cz + az * a0], p01 = [cx + bx * a0, y0, cz + bz * a0], p10 = [cx + ax * a1, y1, cz + az * a1], p11 = [cx + bx * a1, y1, cz + bz * a1];
          arr.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
          if (i) { const q0 = [cx + ax * (a0 + step), y0, cz + az * (a0 + step)], q1 = [cx + bx * (a0 + step), y0, cz + bz * (a0 + step)]; arr.push(...q0, ...p00, ...p01, ...q0, ...p01, ...q1); }
          B.tris(arr, col.map((v) => Math.min(1, v * FACE[k])));
        }
      }
    };
    pyramid(KHUFU); pyramid(KHAFRE, 2); pyramid(MENK);
    // 王后金字塔：胡夫东侧三座、孟卡拉南侧三座
    for (const zz of [-232, -200, -168]) pyramid([KHUFU[0] + 82, zz, 11, 14]);
    for (const xx of [-205, -170, -137]) pyramid([xx, MENK[1] + 52, xx === -205 ? 10 : 8, xx === -205 ? 12 : 8]);
    // 祭庙（金字塔东侧）与堤道
    for (const [cx, cz, a] of [KHUFU, KHAFRE, MENK]) { B.box(cx + a + 12, 0, cz, 22, 3.2, 28, [0.78, 0.68, 0.52]); B.box(cx + a + 12, 3.2, cz, 14, 0.6, 18, [0.70, 0.60, 0.46]); }
    { const a = new V3(KHAFRE[0] + KHAFRE[2] + 22, 1, KHAFRE[1]), b = new V3(SPHINX[0] - 20, 1, SPHINX[1] + 40); B.beam(a, b, 6, [0.80, 0.70, 0.54], 2); }
    // 河谷神庙 + 狮身人面像神庙（深色花岗岩方块）
    B.box(SPHINX[0] - 4, 0, SPHINX[1] + 46, 34, 6.5, 26, [0.66, 0.58, 0.48]); B.box(SPHINX[0] - 4, 6.5, SPHINX[1] + 46, 28, 0.6, 20, [0.58, 0.50, 0.42]);
    B.box(SPHINX[0] + 54, 0, SPHINX[1], 20, 5, 28, [0.70, 0.62, 0.50]);
    // 狮身人面像：面朝东（+x），从南面看到侧影
    { const [sx, sz] = [0, 0], LION = [0.80, 0.64, 0.42], DARK = [0.60, 0.46, 0.32];
      B = { box: (x, y, z, w, h, d, c) => B0.add(BOX, c, { x: SPHINX[0] + x * 1.5, y: y * 1.5, z: SPHINX[1] + z * 1.5, sx: w * 1.5, sy: h * 1.5, sz: d * 1.5 }),
        blob: (x, y, z, r, c, sy) => B0.blob(SPHINX[0] + x * 1.5, y * 1.5, SPHINX[1] + z * 1.5, r * 1.5, c, sy),
        tris: (arr, c) => B0.tris(arr.map((v, i) => (i % 3 === 0 ? SPHINX[0] + v * 1.5 : i % 3 === 1 ? v * 1.5 : SPHINX[1] + v * 1.5)), c) };
      B.box(sx - 4, -1, sz, 44, 10, 10, LION);                                   // 身体
      B.blob(sx - 24, 6, sz, 6.4, LION, 0.9);                                    // 臀部
      B.box(sx + 14, -1, sz - 3.2, 16, 3.6, 3.2, LION); B.box(sx + 14, -1, sz + 3.2, 16, 3.6, 3.2, LION);   // 前爪
      B.box(sx + 12, 6, sz, 8, 8, 8.4, LION);                                    // 胸
      B.box(sx + 13, 13, sz, 7, 8, 6.2, LION);                                   // 头
      B.tris([sx + 10, 11, sz - 7, sx + 10, 21, sz - 3.6, sx + 10, 11, sz + 7, sx + 10, 21, sz - 3.6, sx + 10, 21, sz + 3.6, sx + 10, 11, sz + 7,
        sx + 10, 11, sz - 7, sx + 14, 11, sz - 6, sx + 10, 21, sz - 3.6, sx + 10, 11, sz + 7, sx + 10, 21, sz + 3.6, sx + 14, 11, sz + 6], DARK);   // 头巾（nemes）两侧垂片
      B.box(sx + 16.6, 13.5, sz, 0.6, 3, 2.6, DARK);
      B = B0;
    }
    // 马斯塔巴墓群：胡夫东西两侧整齐的低矮石室
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
      if (R() < 0.12) continue;
      const x = -12 + i * 11 + (R() - 0.5) * 2, z = -258 + j * 17;
      B.box(x, 0, z, 8, 2 + R() * 1.6, 12, R() < 0.5 ? [0.84, 0.74, 0.56] : [0.80, 0.70, 0.52]);
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if (R() < 0.15) continue; B.box(KHUFU[0] + 112 + i * 11, 0, -258 + j * 18, 8, 2 + R(), 12, [0.82, 0.72, 0.54]); }
    // 观景台上的小遮阳棚与游客中心
    B.box(-215, 0, 120, 18, 3, 10, [0.94, 0.92, 0.86]); B.box(-215, 3, 120, 20, 0.6, 12, [0.86, 0.80, 0.70]);
    B.box(180, 0, 205, 30, 6, 16, [0.92, 0.88, 0.80]);
    // 停车场里的旅游大巴
    for (let i = 0; i < 7; i++) if (R() < 0.8) B.box(138 + i * 11, 0, 164, 3.2, 3.4, 12, i % 3 ? [0.96, 0.96, 0.94] : [0.86, 0.88, 0.92]);
  },
  deco(D) {
    const { R, P } = D;
    const wall = P([[0.82, 0.72, 0.58], [0.78, 0.66, 0.52], [0.88, 0.80, 0.68], [0.74, 0.62, 0.50], [0.90, 0.86, 0.78]]);
    const roofs = P([[0.70, 0.62, 0.52], [0.66, 0.60, 0.54], [0.76, 0.70, 0.62]]);
    D.blocks(0, 11, { pad: 4.6, skip: 0.06, hfn: (x, z, r) => 4 + Math.pow(r(), 1.4) * 14, pal: wall, roof: 'flat', roofPal: roofs });
    const palms = P([[0.30, 0.48, 0.24], [0.36, 0.54, 0.26], [0.26, 0.42, 0.22]]);
    D.trees(0, 14, palms, { r: [2.4, 3.2], xr: 560, flat: 0.45, h: 2.4, subs: 4 });
    D.trees(2, 30, palms, { r: [2.4, 3.4], xr: 560, flat: 0.45, h: 2.4, subs: 4 });
    void R;
  },
  life(D) {
    D.bus([0.96, 0.96, 0.94]);
    D.ew(247.5, -1, 3, 11, 0.4); D.ew(252.5, 1, 3, 11, 0.4);
    D.ns(224, -1, 2, 9, 0.5); D.ns(228, 1, 2, 9, 0.5);
    D.crowd(SPHINX[0] - 50, SPHINX[1] + 24, SPHINX[0] + 40, SPHINX[1] + 32, 18);
    D.crowd(KHUFU[0] - 50, KHUFU[1] + 60, KHUFU[0] + 50, KHUFU[1] + 68, 18);
    D.crowd(KHAFRE[0] + 56, -30, KHAFRE[0] + 70, 30, 8);
    D.crowd(-227, 128, -203, 140, 10);
  },
  taxi: [[0.96, 0.96, 0.96], [0.20, 0.20, 0.22]],
};
