// 道路/河流的中心线：x = base + 两个正弦叠加（随 z 缓慢蜿蜒）。JS 与 GLSL 共用同一组参数。
export const FEAT = {
  nRiver: { x: 80, a: [6, 0.0029, 0.7], b: [2.5, 0.011, 2.1] },
  nRoad: { x: -130, a: [3, 0.0021, 1.9], b: [0, 0, 0] },
  pRoad: { x: -135, a: [14, 0.0031, 1.1], b: [5, 0.0093, 0.3] },
  pRiver: { x: 90, a: [26, 0.0024, 2.0], b: [9, 0.0071, 0.5] },
  sTrack: { x: -165, a: [20, 0.0033, 0.2], b: [7, 0.0089, 1.7] },
  sRiver: { x: -15, a: [30, 0.0021, 0.9], b: [11, 0.0063, 2.4] },
  jRoad: { x: -98, a: [8, 0.0026, 0.4], b: [3, 0.0091, 1.0] },
  jRiver: { x: 120, a: [18, 0.0027, 1.6], b: [7, 0.0075, 0.2] },
  nRail: { x: 232, a: [12, 0.0017, 2.4], b: [3, 0.0061, 0.9] },
  jRail: { x: -238, a: [16, 0.0019, 0.8], b: [4, 0.0057, 2.2] },
};
export const fx = (f, z) => f.x + f.a[0] * Math.sin(z * f.a[1] + f.a[2]) + f.b[0] * Math.sin(z * f.b[1] + f.b[2]);
const n = (v) => Number(v).toFixed(5);
export const featGLSL = Object.entries(FEAT).map(([k, f]) =>
  `float ${k}(float z){ return ${n(f.x)} + ${n(f.a[0])}*sin(z*${n(f.a[1])}+${n(f.a[2])}) + ${n(f.b[0])}*sin(z*${n(f.b[1])}+${n(f.b[2])}); }`).join('\n');

// 各生物群系中不能放物体的区域（河流、道路）
export const BLOCKED = [
  (x, z) => Math.abs(x - fx(FEAT.nRiver, z)) < 46 || Math.abs(x - fx(FEAT.nRoad, z)) < 13 || Math.abs(x - fx(FEAT.nRail, z)) < 13,
  (x, z) => Math.abs(x - fx(FEAT.pRiver, z)) < 40 || Math.abs(x - fx(FEAT.pRoad, z)) < 8,
  (x, z) => Math.abs(x - fx(FEAT.sRiver, z)) < 32 || Math.abs(x - fx(FEAT.sTrack, z)) < 8,
  (x, z) => Math.abs(x - fx(FEAT.jRiver, z)) < 26 || Math.abs(x - fx(FEAT.jRoad, z)) < 11 || Math.abs(x - fx(FEAT.jRail, z)) < 11,
];
