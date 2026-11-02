// 地标世界（?world=landmarks）的平面布局：同一段类 C 源码同时编译成 GLSL（地面着色/地形位移）和 JS（摆放建筑、车辆、行人）。
// 坐标：x 向东，z 向南（飞机向 -z 即向北飞），1 单位 ≈ 2 米（0.5 单位/米）。每个场景的地标以“局部坐标”描述，
// 局部 z = 世界 z - 地标原点；地标每 PERIOD 单位重复一次，局部 z 落在 [LO, LO+PERIOD) 内。
import { CITIES } from './lm/cities.js';
export const PERIOD = 2200;
// 场景 → [原点 OZ（镜头 z=0 时地标原点的世界 z）, 局部窗口下界 LO]
// 5…14 号场景（各城市模块）的原点写在各自文件里
export const ORIGIN = [[-40, -1300], [-120, -1370], [400, -1370], [-10, -1300], ...CITIES.map((c) => c.origin)];
// 悉尼的布局按真实方位写（x 东、z 南），画面里旋转 90°：飞机向西飞，画面上方 = 西、右方 = 北，
// 这样镜头从东面（麦考瑞夫人角方向）望过去，歌剧院在前、海港大桥的拱在后——最经典的角度。
// 布局坐标 (x', z') 与世界 (x, 局部 z) 的关系：x' = 局部 z，z' = SY_X - x
export const SY_X = -110;
const f = (v) => v.toFixed(1);

export const SHARED = /* glsl */ `
const float SY_X = ${f(SY_X)};
float rectD(float x, float z, float x0, float z0, float x1, float z1){
  float dx = max(x0 - x, x - x1);
  float dz = max(z0 - z, z - z1);
  float ox = max(dx, 0.);
  float oz = max(dz, 0.);
  return sqrt(ox*ox + oz*oz) + min(max(dx, dz), 0.);
}
float ellD(float x, float z, float cx, float cz, float rx, float rz){
  float u = (x - cx)/rx;
  float v = (z - cz)/rz;
  return (sqrt(u*u + v*v) - 1.)*min(rx, rz);
}
float gridD(float v, float sp, float off){ return abs(mod(v - off + sp*.5, sp) - sp*.5); }
float lmLocal(float z, float oz, float lo){ return z - (oz + 2200.*floor((z - oz - lo)/2200.)); }

/* 东京：0 街区 1 道路 2 公园 3 水 4 地标广场 */
float tkMain(float x, float z){
  return min(min(abs(z + 50.) - 7., abs(z - 170.) - 7.), min(abs(x + 70.) - 7., abs(x - 230.) - 10.));
}
float tkKind(float x, float z){
  if (tkMain(x, z) < 0.) return 1.;
  if (x > -63. && x < 220. && z > -43. && z < 163.) {
    if (rectD(x, z, -36., -36., 36., 32.) < 0.) return 4.;
    if (rectD(x, z, 84., 24., 222., 98.) < 0.) return 4.;
    return 2.;
  }
  if (x > -63. && x < 220. && z > 177. && z < 300.) return 2.;
  if (gridD(x, 60., -70.) < 4. || gridD(z, 55., -50.) < 4.) return 1.;
  return 0.;
}

/* 北京中轴线（原点 = 天安门城楼）：0 现代街区 1 大路 1.5 胡同 2 公园/绿地 3 水 4 地标 5 胡同四合院 */
float bjMoat(float x, float z){
  float o = rectD(x, z, -226., -801., 226., -245.);
  float i = rectD(x, z, -200., -775., 200., -271.);
  float r = max(o, -i);
  if (z > -275. && abs(x) < 62.) r = 1.;
  return r;
}
float bjKind(float x, float z){
  if (bjMoat(x, z) < 0.) return 3.;
  if (z > 28. && z < 68.) return 1.;
  if (abs(x) < 245. && z >= 68. && z < 446.) return 4.;
  if (abs(x) < 52. && z >= 446. && z < 492.) return 4.;
  if (z > 0. && z <= 28.) { if (abs(x) < 255.) return 4.; return 0.; }
  if (z > -283. && z <= 0. && abs(x) < 250.) {
    if (abs(x) < 32.) return 4.;
    if (rectD(x, z, 68., -228., 156., -76.) < 0.) return 4.;
    if (rectD(x, z, -134., -184., -86., -136.) < 0.) return 4.;
    return 2.;
  }
  if (rectD(x, z, -238., -813., 238., -233.) < 0.) return 4.;
  if (z <= -813. && z > -827.) return 1.;
  if (abs(x) < 120. && z <= -827. && z > -1022.) return 2.;
  if (rectD(x, z, -362., -1042., -196., -766.) < 0.) { if (ellD(x, z, -268., -905., 42., 38.) < 0.) return 2.; return 3.; }
  if (rectD(x, z, -378., -1056., -182., -752.) < 0.) return 2.;
  if (rectD(x, z, -346., -662., -262., -140.) < 0.) return 3.;
  if (rectD(x, z, -380., -702., -244., -108.) < 0.) return 2.;
  if (abs(x - 266.) < 7. && z < 28.) return 1.;
  if (abs(x + 398.) < 7.) return 1.;
  if (abs(z + 1044.) < 7.) return 1.;
  if (z > -96. && z < 182. && abs(x) > 255.) { if (gridD(x, 80., 0.) < 4.5) return 1.; return 0.; }
  if (gridD(x, 120., 20.) < 3.5) return 1.;
  if (gridD(z, 40., 0.) < 1.8) return 1.5;
  return 5.;
}

/* 悉尼（原点 = 歌剧院中心）：陆地有向距离，>0 为陆地 */
float syLand(float x, float z){
  float s = z + 40.;
  s = min(s, rectD(x, z, -112., -110., -50., 82.) - 10.);
  s = min(s, ellD(x, z, 124., -40., 82., 100.));
  s = min(s, rectD(x, z, -420., -120., -224., 6.));
  s = max(s, -(rectD(x, z, -22., -50., 27., 200.) - 14.));
  s = max(s, -(rectD(x, z, 220., -80., 250., 200.) - 14.));
  float n = -(z + 300.);
  n = max(n, -ellD(x, z, 75., -300., 78., 66.));
  n = max(n, -ellD(x, z, -128., -300., 52., 36.));
  n = min(n, rectD(x, z, -270., -400., -186., -282.));
  float fd = -ellD(x, z, 182., -168., 11., 10.);
  return max(max(s, n), fd);
}
float syBridge(float x, float z){
  float bx = x + 190.;
  float bz = z + 45.;
  float al = bx*.259 - bz*.966;
  float ac = bx*.966 + bz*.259;
  if (al > -230. && al < 420.) return abs(ac);
  return 999.;
}
/* 0 岩石区老街 1 道路 2 植物园 3 水 4 地标 6 北岸住宅 7 高楼 */
float syKind(float x, float z){
  float L = syLand(x, z);
  if (L < 0.) return 3.;
  if (syBridge(x, z) < 14.) return 1.;
  if (rectD(x, z, -40., -70., 46., 92.) < 0.) return 4.;
  if (z > 82. && z < 128. && x > -150. && x < 46.) return 4.;
  if (ellD(x, z, 182., -168., 11., 10.) < 2.) return 4.;
  if (x > 46. && x < 330. && z > -100. && z < 330.) return 2.;
  if (z < -280.) {
    if (gridD(x, 90., 15.) < 3.5 || gridD(z, 50., 0.) < 3.) return 1.;
    if (z < -720.) return 7.;
    return 6.;
  }
  if (gridD(x, 70., -42.) < 4. || gridD(z, 55., 18.) < 4.) return 1.;
  if (z < 128. && x < -122. && x > -600.) return 0.;
  return 7.;
}

${CITIES.map((c) => c.layout).join('\n')}
/* 地形高度：北京的景山、琼华岛（白塔山）；各城市模块可提供自己的高度函数（局部坐标） */
float lmHeightBJ(float b, float x, float z){
  if (b < .5 || b > 2.5) return 0.;
  float oz = ${f(ORIGIN[1][0])};
  if (b > 1.5) oz = ${f(ORIGIN[2][0])};
  float lz = lmLocal(z, oz, -1370.);
  float u = x/104.;
  float v = (lz + 905.)/60.;
  float r = u*u + v*v;
  float h = 0.;
  if (r < 1.) { float e = 1. - r; h = smoothstep(0., 1., e)*(13. + 14.*exp(-x*x/700.) + 3.*cos(x*.09)); }
  float u2 = (x + 268.)/40.;
  float v2 = (lz + 905.)/36.;
  float r2 = u2*u2 + v2*v2;
  if (r2 < 1.) { float e2 = 1. - r2; h = max(h, smoothstep(0., 1., e2)*16.); }
  return h;
}
float lmHeight(float b, float x, float z){
  if (b < 3.5) return lmHeightBJ(b, x, z);
${CITIES.map((c, i) => c.height ? `  if (abs(b - ${i + 4}.) < .5) return ${c.height}(x, lmLocal(z, ${f(c.origin[0])}, ${f(c.origin[1])}));` : '').filter(Boolean).join('\n')}
  return 0.;
}
`;

// ---- 编译成 JS
const LIB = {
  sin: Math.sin, cos: Math.cos, abs: Math.abs, sqrt: Math.sqrt, floor: Math.floor, min: Math.min, max: Math.max, pow: Math.pow, exp: Math.exp,
  atan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)), sign: Math.sign, length: (a, b) => Math.hypot(a, b),
  mod: (a, b) => a - b * Math.floor(a / b), fract: (a) => a - Math.floor(a), mix: (a, b, t) => a + (b - a) * t,
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)), step: (e, x) => (x < e ? 0 : 1),
  smoothstep: (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); },
};
const toJS = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/const float /g, 'const ')
  .replace(/float\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (m, n, a) => `function ${n}(${a.replace(/float\s+/g, '')}){`)
  .replace(/\bfloat\s+/g, 'let ');
const NAMES = ['rectD', 'ellD', 'gridD', 'lmLocal', 'tkMain', 'tkKind', 'bjMoat', 'bjKind', 'syLand', 'syBridge', 'syKind', 'lmHeight', ...CITIES.flatMap((c) => c.names)];
export const L = new Function(...Object.keys(LIB), toJS(SHARED) + `\nreturn {${NAMES.join(',')}};`)(...Object.values(LIB));

// 场景 b：世界 z → 局部 z / 原点
export const local = (b, z) => L.lmLocal(z, ORIGIN[b][0], ORIGIN[b][1]);
export const originOf = (b, z) => z - local(b, z);
// 场景 b 的地面类型
export const kindOf = (b, x, lz) => (b === 0 ? L.tkKind(x, lz) : b === 3 ? L.syKind(lz, SY_X - x) : b >= 4 ? L[CITIES[b - 4].kind](x, lz) : L.bjKind(x, lz));
