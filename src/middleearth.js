// 中土世界（?world=middleearth）：四个原创程序化场景——夏尔、洛汗、幽谷/迷雾山脉、魔多。
// 与地球版共用渲染管线（油画滤镜、撕纸边缘、飞机、指针/自动驾驶、HUD），这里只提供：
//   场景配置、道路/河流曲线、地形高度（JS 与 GLSL 共用同一份源码）、地面着色、区块装饰、移动的生命（车队/骑兵/行军纵队）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fx, featToGLSL } from './layout.js';
import { groundHeader, groundCommonGLSL } from './groundShader.js';

const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lowPoly = (o = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });

// ---------------------------------------------------------------- 场景
export const SCENES = [
  { name: 'The Shire', sub: 'Halimath · harvest-tide, Shire Reckoning 1418', grid: [306.4, 512.8],
    clouds: { count: 5, min: 0.55, max: 0.85 }, birds: { n: 7, color: [1, 1, 1] }, look: 'day' },
  { name: 'Rohan · the Riddermark', sub: 'Third Age 3019 · wind over the Westemnet', grid: [418.2, 655.1],
    clouds: { count: 3, min: 0.8, max: 1.2 }, birds: { n: 8, color: [0.25, 0.22, 0.2] }, look: 'day' },
  { name: 'Rivendell · Misty Mountains', sub: 'Late autumn · snow on the high passes', grid: [377.9, 448.6],
    clouds: { count: 6, min: 0.7, max: 1.0 }, birds: { n: 3, color: [0.36, 0.27, 0.2], scale: 3.2, speed: 22, y: 70 }, look: 'cool' },
  { name: 'Mordor · Plateau of Gorgoroth', sub: 'Ash-fall · the Year of the Ring', grid: [596.3, 702.4],
    clouds: { count: 7, min: 0.8, max: 1.2 }, birds: { n: 9, color: [0.12, 0.1, 0.1] }, look: 'ash' },
];
// 地图坐标：以“里格”（league）计的虚构网格，向北飞时 N 增加
export const coords = (cfg, st) => {
  const E = cfg.grid[0] + st.camX / 90, N = cfg.grid[1] + st.dist / 90;
  return `${E.toFixed(1)} lg E  ·  ${N.toFixed(1)} lg N`;
};

// 灯光/云的色调
const LOOKS = {
  day: { sky: 0xe4ebff, gnd: 0xdfe6ff, hk: 1.0, sun: 0xfff6ea, sk: 1.0, cloud: [1, 1, 1], cem: [0.40, 0.42, 0.46] },
  cool: { sky: 0xe2ecff, gnd: 0xd6e0f4, hk: 1.0, sun: 0xfff3e6, sk: 1.05, cloud: [1, 1, 1], cem: [0.42, 0.44, 0.48] },
  ash: { sky: 0xe0c8bc, gnd: 0x7a5a50, hk: 0.78, sun: 0xffb486, sk: 0.85, cloud: [0.52, 0.48, 0.47], cem: [0.12, 0.10, 0.10] },
};
export function applyLook(cfg, { hemi, sun, cloudMat, base }) {
  const L = LOOKS[cfg.look] || LOOKS.day;
  hemi.color.set(L.sky); hemi.groundColor.set(L.gnd); hemi.intensity = base.hemi * L.hk;
  sun.color.set(L.sun); sun.intensity = base.sun * L.sk;
  cloudMat.color.copy(sc(...L.cloud)); cloudMat.emissive.copy(sc(...L.cem));
}

// ---------------------------------------------------------------- 曲线与地标
export const FEAT = {
  shLane: { x: -70, a: [42, 0.0024, 0.3], b: [14, 0.0071, 1.2] },
  shWater: { x: 185, a: [24, 0.0019, 1.4], b: [8, 0.0067, 0.5] },
  roRoad: { x: -20, a: [22, 0.0016, 0.9], b: [7, 0.0059, 2.0] },
  roStream: { x: 235, a: [26, 0.0021, 0.2], b: [9, 0.0070, 1.1] },
  miRiver: { x: 30, a: [34, 0.0023, 0.6], b: [11, 0.0081, 2.3] },
  moRoad: { x: -30, a: [24, 0.0018, 2.6], b: [7, 0.0066, 0.3] },
  moLava: { x: 175, a: [30, 0.0026, 0.4], b: [10, 0.0083, 1.9] },
  moLava2: { x: -300, a: [26, 0.0022, 1.3], b: [9, 0.0077, 0.6] },
};
const PERIOD = 1440;   // 地标每 1440 单位（约 53 秒航程）重复一次
export const LM = { party: [70, -150], edoras: [-210, -120], riven: [0, -110], volcano: [150, -190], tower: [-170, -10] };
export const lmZ = (z, off) => off + PERIOD * Math.floor((z - off) / PERIOD + 0.5);
const TRAIL = -42;     // 迷雾山脉：河西岸小径相对河心的偏移

// 地形高度：同一段源码既编译成 GLSL（顶点着色器位移 + 法线），也编译成 JS（物体贴地）
const H_SRC = [
  /* 夏尔：起伏的丘陵，河谷与宴会草地压平 */ `
  float h = 11.*sin(x*.0105+.7)*sin(z*.0089+1.3) + 7.*sin(x*.0047-z*.0061+2.1) + 3.5*sin(x*.021+z*.017+.4);
  h = mix(-3., h, smoothstep(26., 80., abs(x - shWater(z))));
  float lz = -150. + 1440.*floor((z+150.)/1440. + .5);
  float d = sqrt((x-70.)*(x-70.) + (z-lz)*(z-lz));
  return mix(4., h, smoothstep(50., 100., d));`,
  /* 洛汗：舒缓的草原丘陵 + 平顶山丘（王城） */ `
  float h = 9.*sin(x*.0062+z*.0041+.5) + 6.*sin(x*.0131-.8)*sin(z*.0079+2.) + 2.5*sin(x*.03+z*.021);
  h = mix(-2., h, smoothstep(18., 55., abs(x - roStream(z))));
  float lz = -120. + 1440.*floor((z+120.)/1440. + .5);
  float d = sqrt((x+210.)*(x+210.) + (z-lz)*(z-lz));
  return mix(32., h, smoothstep(42., 105., d));`,
  /* 迷雾山脉：脊状山峰，河谷（幽谷处更宽） */ `
  float r1 = 1.-abs(sin(x*.0105 + 1.6*sin(z*.0047+.3)));
  float r2 = 1.-abs(sin(x*.0061 - z*.0083 + 2.2));
  float r3 = 1.-abs(sin(z*.0141 + x*.0043 + 1.));
  float m = 30.*r1*r1 + 17.*r2*r2*r2 + 7.*r3*r3;
  float lz = -110. + 1440.*floor((z+110.)/1440. + .5);
  float rv = 1. - smoothstep(110., 260., abs(z-lz));
  float v = smoothstep(26. + 40.*rv, 95. + 80.*rv, abs(x - miRiver(z)));
  return min(1.5 + m*v, 52.);`,
  /* 魔多：灰烬平原 + 火山锥（带火山口）+ 黑塔基座 */ `
  float h = 2.5*sin(x*.017+z*.011) + 1.5*sin(x*.041-z*.033+1.) + 4.*sin(x*.006-z*.004+.7);
  float lz = -190. + 1440.*floor((z+190.)/1440. + .5);
  float dx = x-150.;
  float dz = z-lz;
  float d = sqrt(dx*dx+dz*dz);
  float a = atan(dz, dx);
  float c = max(0., 1. - d/135.);
  float cone = 50.*pow(c, 1.25)*(1. + .07*sin(a*9.+d*.05)) - 12.*(1.-smoothstep(9., 20., d));
  h = max(h, cone);
  float tz = -10. + 1440.*floor((z+10.)/1440. + .5);
  float td = sqrt((x+170.)*(x+170.) + (z-tz)*(z-tz));
  return h + 7.*(1.-smoothstep(12., 34., td));`,
];
const LIB = {
  sin: Math.sin, cos: Math.cos, abs: Math.abs, sqrt: Math.sqrt, floor: Math.floor, min: Math.min, max: Math.max, pow: Math.pow,
  atan: Math.atan2, mix: (a, b, t) => a + (b - a) * t,
  smoothstep: (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); },
};
for (const k of Object.keys(FEAT)) LIB[k] = (z) => fx(FEAT[k], z);
const H_JS = H_SRC.map((src) => new Function(...Object.keys(LIB), 'x', 'z', src.replace(/\bfloat\s/g, 'let ')).bind(null, ...Object.values(LIB)));
export const height = (b, x, z) => H_JS[b](x, z);
const heightGLSL = H_SRC.map((src, i) => `float meH${i}(float x, float z){${src}\n}`).join('\n') + `
float meH(vec2 p){ if (uBiome < .5) return meH0(p.x, p.y); if (uBiome < 1.5) return meH1(p.x, p.y); if (uBiome < 2.5) return meH2(p.x, p.y); return meH3(p.x, p.y); }`;

// 不能放物体的区域
const d2 = (x, z, cx, cz) => Math.hypot(x - cx, z - cz);
export const BLOCKED = [
  (x, z) => Math.abs(x - fx(FEAT.shWater, z)) < 26 || Math.abs(x - fx(FEAT.shLane, z)) < 9 || d2(x, z, LM.party[0], lmZ(z, LM.party[1])) < 64,
  (x, z) => Math.abs(x - fx(FEAT.roRoad, z)) < 10 || Math.abs(x - fx(FEAT.roStream, z)) < 16 || d2(x, z, LM.edoras[0], lmZ(z, LM.edoras[1])) < 110,
  (x, z) => Math.abs(x - fx(FEAT.miRiver, z)) < 24 || Math.abs(x - fx(FEAT.miRiver, z) - TRAIL) < 6,
  (x, z) => Math.abs(x - fx(FEAT.moRoad, z)) < 9 || Math.abs(x - fx(FEAT.moLava, z)) < 24 || Math.abs(x - fx(FEAT.moLava2, z)) < 24
    || d2(x, z, LM.volcano[0], lmZ(z, LM.volcano[1])) < 140 || d2(x, z, LM.tower[0], lmZ(z, LM.tower[1])) < 32,
];

// ---------------------------------------------------------------- 地面着色
const meGLSL = /* glsl */ `
varying float vSlope;
vec3 gEm = vec3(0.);
float lmZ(float z, float off){ return off + 1440.*floor((z-off)/1440. + .5); }

vec3 shire(vec2 p){
  float h = vWPos.y;
  vec2 wq = vec2(fbm(p*.006), fbm(p*.006+7.)) - .5;
  vec3 v = vor(p/150. + wq*.5);
  float edge = v.x*150.;
  vec3 fc;
  if (v.y < .5) fc = mix(vec3(.46,.73,.30), vec3(.58,.81,.35), v.z);
  else if (v.y < .68) { fc = mix(vec3(.91,.80,.42), vec3(.96,.87,.52), v.z);
    float a = v.z*3.14; fc *= .93 + .09*sin(dot(p, vec2(cos(a), sin(a)))*1.1); }
  else if (v.y < .84) { fc = mix(vec3(.64,.81,.38), vec3(.72,.85,.42), v.z);
    vec2 cell = floor(p*.55); float fl = step(.86, h12(cell));
    fc = mix(fc, h12(cell+3.) < .5 ? vec3(1.,.95,.62) : vec3(.98,.76,.84), fl*.85); }
  else { fc = vec3(.64,.48,.34); float a = v.z*3.14; fc *= .84 + .22*smoothstep(-.3,.3,sin(dot(p, vec2(cos(a), sin(a)))*.9)); }
  fc *= .92 + .12*paint(p);
  fc *= .88 + .2*smoothstep(-18., 22., h);
  vec3 col = s2l(fc);
  // 树篱：田块边界上起伏的深绿带 + 柔和投影
  float hd = edge - 2.2*vn(p*.45);
  col = mix(col, col*.7, (1.-smoothstep(3.5, 8., hd + (p.x+p.y)*0.)) * .45);
  vec3 hc = mix(vec3(.15,.38,.16), vec3(.27,.52,.21), smoothstep(.3,.8,vn(p*.7)));
  col = mix(col, s2l(hc), 1.-smoothstep(2.4, 3.4, hd));
  // 宴会草地
  float lz = lmZ(p.y, -150.);
  float dp = length(p - vec2(70., lz));
  col = mix(col, s2l(vec3(.60,.84,.40)*(.95+.08*paint(p*1.3))), 1.-smoothstep(56., 62. + 4.*vn(p*.1), dp));
  // 小路通往宴会草地
  float pz = p.y - lz - 30. - sin(p.x*.03)*5.;
  col = mix(col, s2l(vec3(.84,.74,.56)), band(pz, 2., .4)*step(shLane(p.y), p.x)*step(p.x, 20.));
  // 蜿蜒的乡间小路（中间一条草）
  float rx = p.x - shLane(p.y) + wob(p.y, 2.)*.7;
  col = mix(col, s2l(vec3(.55,.72,.34)), band(rx, 6.5, .8)*.6);
  col = mix(col, s2l(vec3(.87,.75,.55)*(.93+.1*vn(p*vec2(1.2,.3)))), band(rx, 4.4, .5));
  col = mix(col, s2l(vec3(.70,.58,.42)), band(abs(rx)-1.9, .45, .3)*.6);
  col = mix(col, s2l(vec3(.58,.74,.36)), band(rx, .6, .35)*.8);
  col = river(p, shWater(p.y), 13., s2l(vec3(.24,.50,.70)), s2l(vec3(.38,.66,.80)), s2l(vec3(.80,.74,.56)), s2l(vec3(.40,.66,.30)), col, 3.);
  return col;
}

vec3 rohan(vec2 p){
  float h = vWPos.y;
  float n = fbm(p*.004), n2 = fbm(p*.0085+3.), n3 = fbm(p*.03);
  vec3 c = mix(vec3(.84,.68,.30), vec3(.95,.81,.44), smoothstep(.3,.7,n));
  c = mix(c, vec3(.70,.70,.34), smoothstep(.56,.66,n2)*.5);
  c = mix(c, vec3(.78,.58,.24), smoothstep(.62,.75,n3)*.25);
  c *= .88 + .2*(strokes(p, 6., .8)*.55 + strokes(p+9., 13., 1.5)*.45);
  // 风吹草浪
  float wave = vn(vec2(p.x*.010 + p.y*.006 - uTime*.45, p.y*.016 - p.x*.004 + uTime*.12));
  c *= .9 + .17*smoothstep(.25,.85,wave);
  c *= .92 + .1*smoothstep(-10., 20., h);
  vec3 col = s2l(c);
  // 王城所在的山丘：绿顶 + 岩石山腰 + 通向大路的坡道
  float lz = lmZ(p.y, -120.); float d = length(p - vec2(-210., lz));
  col = mix(col, s2l(vec3(.56,.66,.30)*(.92+.12*paint(p))), 1.-smoothstep(42., 50., d + (vn(p*.08)-.5)*8.));
  float flank = smoothstep(40., 55., d)*(1.-smoothstep(85., 105., d));
  col = mix(col, s2l(vec3(.72,.66,.54)*(.85+.3*vn(p*.25))), flank*smoothstep(.5,.62,vn(p*.06 + 3.))*.8);
  float rc = roRoad(p.y);
  float pz = p.y - lz - 26. - (p.x + 160.)*.12;
  col = mix(col, s2l(vec3(.82,.72,.54)), band(pz, 2.6, .5)*step(-172., p.x)*step(p.x, rc));
  float rx = p.x - rc + wob(p.y, 4.)*.5;
  col = mix(col, s2l(vec3(.70,.62,.40)), band(rx, 6.2, .7)*.45);
  col = mix(col, s2l(vec3(.86,.78,.60)*(.93+.1*vn(p*vec2(1.3,.3)))), band(rx, 4.6, .5));
  col = mix(col, s2l(vec3(.72,.62,.46)), band(abs(rx)-2.1, .5, .3)*.6);
  col = river(p, roStream(p.y), 10., s2l(vec3(.22,.46,.66)), s2l(vec3(.36,.62,.78)), s2l(vec3(.84,.78,.58)), s2l(vec3(.52,.64,.30)), col, 5.);
  return col;
}

vec3 misty(vec2 p){
  float h = vWPos.y;
  float n = fbm(p*.02), n2 = fbm(p*.006+5.);
  vec3 rock = mix(vec3(.55,.56,.62), vec3(.70,.70,.75), n) * (.88+.2*strokes(p, 9., 1.2));
  vec3 meadow = mix(vec3(.42,.63,.33), vec3(.54,.71,.37), n2) * (.92+.12*paint(p));
  vec3 forest = mix(vec3(.20,.38,.27), vec3(.27,.46,.31), n);
  vec3 c = mix(meadow, forest, smoothstep(4., 12., h + (n-.5)*6.));
  c = mix(c, rock, smoothstep(24., 32., h + (n2-.5)*10.));
  float snow = smoothstep(29., 33., h + (fbm(p*.03)-.5)*10. + strokes(p, 14., 2.)*4.);
  c = mix(c, vec3(.96,.97,1.)*(.95+.05*n), snow);
  vec3 col = s2l(c);
  float lz = lmZ(p.y, -110.); float rc = miRiver(p.y);
  // 幽谷的草坪
  float rv = (1.-smoothstep(90., 150., abs(p.y-lz))) * (1.-smoothstep(70., 110., abs(p.x-rc)));
  col = mix(col, s2l(vec3(.56,.74,.38)*(.94+.1*paint(p))), rv*.85);
  // 河西岸的小径
  float tx = p.x - rc + 42. + wob(p.y, 8.)*.8;
  col = mix(col, s2l(vec3(.80,.74,.60)*(.92+.1*vn(p*.5))), band(tx, 2.2, .5));
  // 两侧山坡上落下的支流瀑布（白色水流向河心流动）
  float zi = floor(p.y/260.); float zc = zi*260. + 60. + h12(vec2(zi, 4.))*140.;
  float side = h12(vec2(zi, 9.)) < .5 ? -1. : 1.;
  float along = (p.x - rc)*side;
  float sz = p.y - zc - sin(along*.05)*6.;
  if (along > 12. && along < 160.) {
    float s = band(sz, 2.2 + along*.008, .6) * (1.-smoothstep(130., 160., along));
    vec3 fc = mix(vec3(.62,.80,.92), vec3(.97,.98,1.), smoothstep(.3,.8, vn(vec2(along*.3 + uTime*12., sz*1.5))));
    col = mix(col, s2l(fc), s);
  }
  col = river(p, rc, 15., s2l(vec3(.20,.42,.58)), s2l(vec3(.40,.66,.78)), s2l(vec3(.78,.78,.76)), s2l(vec3(.42,.58,.36)), col, 7.);
  // 急流泡沫 + 横跨河道的跌水
  float dx = abs(p.x - rc);
  float foam = smoothstep(.62, .85, vn(vec2((p.x-rc)*.3, p.y*.05 - uTime*1.6))) * band(dx, 13., 2.);
  float wf = band(fract(p.y/330.)*330. - 165., 3., 2.) * band(dx, 15., 1.) * (.6+.4*vn(vec2(p.x*.5, uTime*4.)));
  col = mix(col, s2l(vec3(.96,.98,1.)), clamp(foam*.6 + wf, 0., 1.));
  // 幽谷的石桥
  col = mix(col, s2l(vec3(.88,.86,.80)), band(p.y - lz - 10., 3., .4) * band(p.x - rc, 22., .5));
  return col;
}

void lavaRiver(inout vec3 col, inout vec3 em, vec2 p, float x, float hw, float mask){
  float w = hw + (vn(vec2(3., p.y*.03))-.5)*6.;
  em += vec3(1.,.35,.06) * band(x, w + 20., 14.) * .12 * mask;
  col = mix(col, s2l(vec3(.10,.08,.08)), band(x, w + 4., 1.5) * mask);
  float core = band(x + (vn(p*.05)-.5)*3., w, 1.2) * mask;
  float flow = vn(vec2(x*.3, p.y*.06 - uTime*1.2))*.6 + vn(vec2(x*.9, p.y*.2 - uTime*2.))*.4;
  float plates = smoothstep(.55, .7, vn(vec2(x*.25, p.y*.08 - uTime*.9)));
  vec3 lc = mix(vec3(1.,.42,.07), vec3(1.,.80,.30), flow*(1.-smoothstep(0., w, abs(x))));
  lc = mix(lc, vec3(.20,.09,.06), plates*.7);
  col = mix(col, s2l(lc), core);
  em += s2l(lc) * core * (1.-plates*.75) * 1.1;
}

vec3 mordor(vec2 p){
  float h = vWPos.y;
  float n = fbm(p*.008), n2 = fbm(p*.03+4.);
  vec3 c = mix(vec3(.25,.22,.21), vec3(.36,.31,.28), smoothstep(.3,.7,n));
  c = mix(c, vec3(.48,.42,.37), smoothstep(.6,.75,n2)*.4);
  c *= .86 + .22*strokes(p, 8., 1.);
  vec3 col = s2l(c);
  vec3 em = vec3(0.);
  // 龟裂的地面，部分裂缝透出暗红光
  vec3 vc = vor(p/55. + (vec2(vn(p*.02), vn(p*.02+3.))-.5)*.6);
  float ck = 1.-smoothstep(0., 1.6, vc.x*55.);
  col = mix(col, s2l(vec3(.14,.11,.10)), ck*.8);
  em += vec3(.9,.25,.05) * ck * smoothstep(.55,.75,fbm(p*.004+9.)) * .5;
  // 火山：深色锥体、放射状熔岩流、发光的火山口
  float lz = lmZ(p.y, -190.); vec2 q = p - vec2(150., lz); float d = length(q); float a = atan(q.y, q.x);
  float ridges = .5 + .5*sin(a*23. + sin(d*.05)*1.5 + vn(p*.05)*3.);
  vec3 coneC = mix(vec3(.17,.14,.13), vec3(.34,.29,.26), ridges*smoothstep(130., 30., d));
  coneC = mix(coneC, vec3(.46,.40,.36), (1.-smoothstep(14., 34., d))*.7);
  col = mix(col, s2l(coneC*(.88+.2*strokes(p, 10., 1.4))), (1.-smoothstep(118., 140., d))*.9);
  float rays = abs(fract((a + .25*sin(d*.035 + a*2.))*5./6.2832 + .1) - .5);
  float lavaS = (1.-smoothstep(.02, .06, rays*(1.+d*.02))) * smoothstep(12., 20., d) * (1.-smoothstep(55., 110., d + vn(vec2(a*3., 1.))*30.));
  vec3 lsc = mix(vec3(1.,.40,.07), vec3(1.,.70,.25), vn(vec2(d*.1 - uTime*.8, a*4.)));
  col = mix(col, s2l(lsc), lavaS);
  em += s2l(lsc) * lavaS;
  float crater = 1.-smoothstep(9., 15., d);
  col = mix(col, s2l(vec3(1.,.62,.18)), crater);
  em += vec3(1.,.55,.15) * crater * 1.3;
  em += vec3(1.,.3,.05) * (1.-smoothstep(10., 40., d)) * .25;
  // 熔岩河
  lavaRiver(col, em, p, p.x - moLava(p.y), 12., smoothstep(105., 140., d));
  lavaRiver(col, em, p, p.x - moLava2(p.y), 10., 1.);
  // 灰白的大道
  float rx = p.x - moRoad(p.y) + wob(p.y, 6.)*.6;
  col = mix(col, s2l(vec3(.54,.49,.44)*(.9+.15*vn(p*vec2(1.,.3)))), band(rx, 5.5, .6));
  col = mix(col, s2l(vec3(.38,.33,.30)), band(abs(rx)-2.3, .5, .3)*.7);
  // 黑塔基座
  float tz = lmZ(p.y, -10.); float td = length(p - vec2(-170., tz));
  col = mix(col, s2l(vec3(.52,.47,.43)*(.9+.15*strokes(p, 8., 1.))), (1.-smoothstep(55., 85., td + (vn(p*.04)-.5)*30.))*.85);
  col = mix(col, s2l(vec3(.15,.14,.15)), 1.-smoothstep(22., 28., td + (vn(p*.2)-.5)*6.));
  gEm = em;
  return col;
}

vec3 groundColor(vec2 p){
  gEm = vec3(0.);
  vec3 c;
  if (uBiome < .5) c = shire(p);
  else if (uBiome < 1.5) c = rohan(p);
  else if (uBiome < 2.5) c = misty(p);
  else c = mordor(p);
  // 额外的山体明暗（按三角面片求坡度，带一点低多边形的块面感），让俯视的起伏更明显
  // 山脉用逐面片坡度（低多边形块面感），其它场景用顶点插值的平滑坡度
  float sl = vSlope;
  if (uBiome > 1.5 && uBiome < 2.5) {
    float hx = dFdx(vWPos.y) / max(abs(dFdx(vWPos.x)), 1e-3) * sign(dFdx(vWPos.x));
    float hz = dFdy(vWPos.y) / max(abs(dFdy(vWPos.z)), 1e-3) * sign(dFdy(vWPos.z));
    sl = .42*hx + .55*hz;
  }
  float k = uBiome < .5 ? 1.5 : uBiome < 1.5 ? .6 : uBiome < 2.5 ? 1.6 : 1.3;
  return c * clamp(1. + k*sl, .55, 1.45);
}
`;
const featME = featToGLSL(FEAT);
export const groundGeo = (w, d) => new THREE.PlaneGeometry(w, d, Math.round(w / 10), Math.round(d / 10)).rotateX(-Math.PI / 2);
export function patchGround(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = `uniform float uBiome;\nvarying vec3 vWPos;\nvarying float vSlope;\n${featME}\n${heightGLSL}\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec2 meWp = (modelMatrix*vec4(position,1.)).xz;
  float meHx = meH(meWp+vec2(2.5,0.)) - meH(meWp-vec2(2.5,0.));
  float meHz = meH(meWp+vec2(0.,2.5)) - meH(meWp-vec2(0.,2.5));
  vec3 objectNormal = normalize(vec3(-meHx, 5., -meHz));
  vSlope = (.42*meHx + .55*meHz) / 5.;`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += meH(meWp);
  vWPos = (modelMatrix*vec4(transformed,1.)).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + groundHeader(featME) + groundCommonGLSL + meGLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( groundColor(vWPos.xz), opacity );')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + gEm;');
  };
}

// ---------------------------------------------------------------- 几何体
const V3 = THREE.Vector3;
function orient(geo, pos, normal) {   // 让 +z 朝向 normal，再移到 pos
  const o = new THREE.Object3D(); o.position.copy(pos); o.lookAt(pos.clone().add(normal)); o.updateMatrix();
  return geo.applyMatrix4(o.matrix);
}
// 霍比特洞：椭球形草丘 + 斜向上的圆门 + 门框 + 两扇圆窗（同一实例矩阵）
const MOUND = [15, 7.5, 13];
const ellN = (x, y, z) => new V3(x / MOUND[0] ** 2, y / MOUND[1] ** 2, z / MOUND[2] ** 2).normalize();
const ellZ = (x, y) => MOUND[2] * Math.sqrt(Math.max(0, 1 - (x / MOUND[0]) ** 2 - (y / MOUND[1]) ** 2));
const moundGeo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(...MOUND);
const smialPart = (r, x, y, lift) => { const z = ellZ(x, y), n = ellN(x, y, z); return orient(new THREE.CircleGeometry(r, 14), new V3(x, y, z).addScaledVector(n, lift), n); };
const doorGeo = smialPart(2.7, 0, 4.4, 0.35);
const frameGeo = mergeGeometries([smialPart(3.6, 0, 4.4, 0.2), smialPart(1.9, -7, 4.2, 0.2), smialPart(1.9, 7, 4.2, 0.2)]);
const winGeo = mergeGeometries([smialPart(1.3, -7, 4.2, 0.35), smialPart(1.3, 7, 4.2, 0.35)]);
const knobGeo = smialPart(0.5, 0.9, 4.4, 0.5);
// 松树：两层圆锥
const pineGeo = mergeGeometries([new THREE.ConeGeometry(1, 1.3, 7).translate(0, 0.75, 0), new THREE.ConeGeometry(0.7, 1.0, 7).translate(0, 1.45, 0)]);
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
// 人字形屋顶：三棱柱，宽 1、高 1、长 1，底面在 y=0
const gableGeo = new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).translate(0, 0.5, 0).scale(1 / 1.732, 1 / 1.5, 1);
const tentGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
const rockGeo = new THREE.IcosahedronGeometry(1, 0);
const spikeGeo = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
const glowGeo = new THREE.IcosahedronGeometry(1, 1);
const wheelGeo = new THREE.CylinderGeometry(1, 1, 0.35, 12).rotateZ(Math.PI / 2);

const M = {
  mound: lowPoly(), frame: lowPoly({ color: sc(0.80, 0.72, 0.58) }), door: lowPoly(),
  win: new THREE.MeshLambertMaterial({ color: sc(1, 0.86, 0.5), emissive: sc(0.35, 0.25, 0.08) }),
  pine: lowPoly(), house: lowPoly(), dark: lowPoly({ color: sc(0.10, 0.09, 0.10) }),
  glow: new THREE.MeshBasicMaterial({ color: sc(1, 0.55, 0.15) }),
  smoke: new THREE.MeshLambertMaterial({ color: sc(0.42, 0.38, 0.37), emissive: sc(0.08, 0.06, 0.06), transparent: true, opacity: 0.88 }),
};
const dummy = new THREE.Object3D();
function inst(geo, mat, n, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.visible = false;
  m.setColorAt(0, new THREE.Color(1, 1, 1)); return m;
}

// ---------------------------------------------------------------- 区块装饰
export class Deco {
  constructor(group) {
    this.m = {
      mound: inst(moundGeo, M.mound, 8), frame: inst(frameGeo, M.frame, 8, false), door: inst(doorGeo, M.door, 8, false),
      win: inst(winGeo, M.win, 8, false), knob: inst(knobGeo, M.frame, 8, false),
      pine: inst(pineGeo, M.pine, 420), house: inst(boxGeo, M.house, 40), roof: inst(gableGeo, M.house, 40),
      post: inst(boxGeo, M.house, 110), tent: inst(tentGeo, M.house, 16), rock: inst(rockGeo, M.house, 40),
      dark: inst(boxGeo, M.dark, 12), spike: inst(spikeGeo, M.dark, 16), glow: inst(glowGeo, M.glow, 4, false),
      smoke: inst(glowGeo, M.smoke, 14, false), wheel: inst(wheelGeo, M.house, 2),
    };
    for (const k in this.m) group.add(this.m[k]);
    this.smoke = null;
  }
  fill(c) {
    const { biome, z0, R, rz, free, blocked, tree, addAnimal, pond, H } = c;
    const n = {}; for (const k in this.m) n[k] = 0;
    const put = (key, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rzz = 0) => {
      const mesh = this.m[key]; if (n[key] >= mesh.instanceMatrix.count) return -1;
      dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rzz, 'YXZ'); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color); return n[key]++;
    };
    // 局部坐标（旋转 ry）→ 世界坐标
    const loc = (cx, cz, ry, lx, lz) => [cx + lx * Math.cos(ry) + lz * Math.sin(ry), cz - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const house = (x, z, ry, w, h, d, wall, roof, roofH = 0.55, y = null) => {
      const y0 = y ?? H(x, z) - 0.5;
      put('house', x, y0, z, w, h, d, wall, ry);
      put('roof', x, y0 + h, z, w * 1.12, w * roofH, d * 1.08, roof, ry);
    };
    const inChunk = (lz) => lz >= z0 && lz < z0 + 160;
    this.smoke = null;
    const greens = [sc(0.22, 0.46, 0.20), sc(0.30, 0.56, 0.24), sc(0.18, 0.40, 0.18), sc(0.40, 0.64, 0.30)];

    if (biome === 0) {                       // ---------------- 夏尔
      const doors = [sc(0.20, 0.48, 0.28), sc(0.96, 0.78, 0.24), sc(0.76, 0.22, 0.18), sc(0.24, 0.40, 0.72), sc(0.20, 0.48, 0.28)];
      const ns = 2 + (R() < 0.5 ? 1 : 0);
      for (let s = 0; s < ns; s++) {
        const z = rz(), x = free(z, 30, 300); if (blocked(x, z)) continue;
        const ry = (R() - 0.5) * 1.4, sz = 1.5 + R() * 0.3, y = H(x, z) - 1.6;
        const g = sc(0.52 + R() * 0.06, 0.76 + R() * 0.05, 0.34);
        for (const k of ['mound', 'frame', 'door', 'win', 'knob'])
          put(k, x, y, z, sz, sz, sz, k === 'mound' ? g : k === 'door' ? doors[Math.floor(R() * doors.length)] : k === 'knob' ? sc(0.95, 0.8, 0.3) : k === 'win' ? sc(1, 1, 1) : sc(0.82, 0.74, 0.60), ry);
        // 门前的小花园和一棵树
        const [tx, tz] = loc(x, z, ry, 28 + R() * 6, -6); if (!blocked(tx, tz)) tree(tx, tz, 6 + R() * 2, greens);
      }
      const nt = 2 + Math.floor(R() * 4);
      for (let t = 0; t < nt; t++) {
        const cz = rz(), cx = free(cz, 10, 330), k = R() < 0.3 ? 4 : 1;
        for (let j = 0; j < k; j++) { const x = cx + (j ? (R() - 0.5) * 50 : 0), z = cz + (j ? (R() - 0.5) * 40 : 0); if (!blocked(x, z)) tree(x, z, 6 + R() * 4, greens); }
      }
      // 磨坊和水塘（在“小河”边）
      if (R() < 0.28) {
        const z = rz(), side = R() < 0.5 ? -1 : 1, wx = fx(FEAT.shWater, z);
        const x = wx + side * 34;
        house(x, z, 0, 12, 8, 14, sc(0.92, 0.86, 0.74), sc(0.62, 0.40, 0.30), 0.6);
        put('wheel', wx + side * 22, H(x, z) + 4, z + 2, 2, 5.5, 5.5, sc(0.50, 0.36, 0.24));
        pond(wx + side * 66, z + 26, 13 + R() * 5);
      }
      // 宴会树
      const lz = lmZ(z0 + 80, LM.party[1]);
      if (inChunk(lz)) {
        const [px] = LM.party;
        tree(px, lz, 22, [sc(0.20, 0.46, 0.20), sc(0.28, 0.55, 0.24), sc(0.18, 0.40, 0.18), sc(0.40, 0.66, 0.30)], { subs: 6, spread: 0.7 });
        const tc = [sc(0.98, 0.95, 0.88), sc(0.96, 0.62, 0.62), sc(0.62, 0.78, 0.96), sc(0.98, 0.86, 0.46)];
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * 6.283 + 0.4, x = px + Math.cos(a) * 42, z = lz + Math.sin(a) * 40;
          put('tent', x, H(x, z), z, 6, 7, 6, tc[k % 4], a);
        }
        for (let k = 0; k < 6; k++) put('house', px - 18 + k * 7, H(px, lz + 22), lz + 24, 5, 1.2, 2.2, sc(0.86, 0.72, 0.52));   // 长桌
      }
      // 羊（稀疏）与小马
      if (R() < 0.4) {
        const cz = rz(), cx = free(cz, 20, 320), m = 3 + Math.floor(R() * 4);
        for (let k = 0; k < m; k++) { const x = cx + (R() - 0.5) * 50, z = cz + (R() - 0.5) * 40; if (!blocked(x, z)) addAnimal('cattle', x, z, R() * 6, -1, 0.62, sc(0.97, 0.96, 0.92)); }
      }
      if (R() < 0.22) { const z = rz(), x = free(z, 0, 320); addAnimal('cattle', x, z, R() * 6, -1, 0.78, R() < 0.5 ? sc(0.48, 0.32, 0.20) : sc(0.80, 0.78, 0.74)); }
    } else if (biome === 1) {                // ---------------- 洛汗
      const lz = lmZ(z0 + 80, LM.edoras[1]);
      if (inChunk(lz)) {
        const [ex] = LM.edoras, y = 31.6;
        // 金顶大殿
        house(ex + 4, lz - 6, 0.25, 13, 9, 34, sc(0.80, 0.70, 0.56), sc(0.92, 0.70, 0.22), 0.75, y);
        put('post', ex + 4 + Math.sin(0.25) * 19, y, lz - 6 + Math.cos(0.25) * 19, 9, 1, 6, sc(0.80, 0.74, 0.64), 0.25);   // 台阶
        const thatch = [sc(0.70, 0.56, 0.34), sc(0.62, 0.46, 0.28), sc(0.76, 0.62, 0.38)];
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * 6.283 + R() * 0.3, r = 24 + R() * 10, x = ex + Math.cos(a) * r, z = lz + Math.sin(a) * r;
          house(x, z, a + 1.57, 6, 4, 9, sc(0.78, 0.68, 0.54), thatch[k % 3], 0.6, y);
        }
        // 木栅栏（东南留出城门）
        const gate = Math.atan2(26, 42);
        for (let k = 0; k < 96; k++) {
          const a = k / 96 * 6.283; if (Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate))) < 0.1) continue;
          const x = ex + Math.cos(a) * 45, z = lz + Math.sin(a) * 45;
          put('post', x, H(x, z) - 0.5, z, 1.8, 6 + R() * 0.8, 1.8, sc(0.48, 0.34, 0.22), -a);
        }
        for (const s of [-1, 1]) { const a = gate + s * 0.13, x = ex + Math.cos(a) * 45, z = lz + Math.sin(a) * 45;
          house(x, z, -a, 4, 8, 4, sc(0.52, 0.38, 0.24), sc(0.40, 0.28, 0.18), 0.8); }
      }
      if (R() < 0.35) for (let k = 0; k < 2 + R() * 4; k++) { const z = rz(), x = free(z, 4, 380), s = 2 + R() * 3; put('rock', x, H(x, z), z, s * 1.4, s * 0.7, s, sc(0.74, 0.68, 0.58), R() * 6); }
      if (R() < 0.3) { const cz = rz(), cx = fx(FEAT.roStream, cz) + (R() < 0.5 ? -24 : 24);
        for (let k = 0; k < 3; k++) { const z = cz + (R() - 0.5) * 50; tree(cx + (R() - 0.5) * 12, z, 6 + R() * 3, greens); } }
      if (R() < 0.25) {                       // 野马群
        const cz = rz(), cx = free(cz, 20, 320), m = 4 + Math.floor(R() * 4);
        const hc = [sc(0.42, 0.26, 0.16), sc(0.30, 0.20, 0.14), sc(0.85, 0.83, 0.78), sc(0.56, 0.40, 0.26)];
        for (let k = 0; k < m; k++) { const x = cx + (R() - 0.5) * 60, z = cz + (R() - 0.5) * 50; if (!blocked(x, z)) addAnimal('cattle', x, z, R() * 6, -1, 0.85, hc[Math.floor(R() * 4)]); }
      }
    } else if (biome === 2) {                // ---------------- 迷雾山脉 / 幽谷
      const pg = [sc(0.14, 0.34, 0.24), sc(0.18, 0.40, 0.27), sc(0.12, 0.30, 0.22), sc(0.22, 0.44, 0.30)];
      for (let k = 0; k < 340; k++) {
        const z = rz(), x = (R() * 2 - 1) * 560, h = H(x, z);
        if (h < 2.5 || h > 30 || blocked(x, z)) continue;
        const dens = Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) * Math.sin(z * 0.017 + x * 0.006) + (h > 6 && h < 26 ? 0.55 : 0);
        if (dens < 0.15 + R() * 0.5) continue;
        const s = 7 + R() * 4, snow = h > 24 ? 0.5 : 0;
        const col = pg[Math.floor(R() * 4)].clone().lerp(sc(0.88, 0.9, 0.94), snow * R());
        put('pine', x, h - 0.5, z, s, s * (2.2 + R() * 0.6), s, col, R() * 6);
      }
      const lz = lmZ(z0 + 80, LM.riven[1]);
      if (inChunk(lz)) {
        const wall = sc(0.95, 0.93, 0.87), roofs = [sc(0.44, 0.58, 0.62), sc(0.52, 0.62, 0.70), sc(0.62, 0.50, 0.40)];
        const gold = [sc(0.95, 0.70, 0.22), sc(0.92, 0.52, 0.18), sc(0.98, 0.80, 0.34), sc(0.86, 0.40, 0.16)];
        for (let k = 0; k < 13; k++) {
          const side = k % 2 ? 1 : -1, z = lz + (R() - 0.5) * 150, rc = fx(FEAT.miRiver, z);
          const x = rc + side * (28 + R() * 46);
          if (Math.abs(x - rc - TRAIL) < 7) continue;
          house(x, z, (R() - 0.5) * 0.8, 9 + R() * 5, 6 + R() * 4, 11 + R() * 6, wall, roofs[k % 3], 0.5);
        }
        put('house', fx(FEAT.miRiver, lz) - 9 - 30, H(fx(FEAT.miRiver, lz) - 39, lz) - 0.5, lz - 30, 6, 16, 6, wall);   // 小塔
        for (let k = 0; k < 12; k++) {
          const z = lz + (R() - 0.5) * 170, side = R() < 0.5 ? -1 : 1, x = fx(FEAT.miRiver, z) + side * (26 + R() * 70);
          if (!blocked(x, z)) tree(x, z, 6 + R() * 3, gold);
        }
      }
    } else {                                 // ---------------- 魔多
      for (let k = 0; k < 3 + R() * 5; k++) {
        const z = rz(), x = free(z, 6, 520), s = 2 + R() * 3.5;
        put('spike', x, H(x, z) - 0.5, z, s, s * (2 + R() * 2.5), s, sc(0.16, 0.14, 0.14), R() * 6, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5);
      }
      const tz = lmZ(z0 + 80, LM.tower[1]);
      if (inChunk(tz)) {   // 黑塔：层层收窄的塔身 + 尖刺 + 顶端的火光
        const [tx] = LM.tower, y = H(tx, tz) - 1, k = sc(0.12, 0.11, 0.12);
        put('dark', tx, y, tz, 28, 8, 28, k); put('dark', tx, y + 8, tz, 19, 14, 19, k, 0.2);
        put('dark', tx, y + 22, tz, 14, 14, 14, k, 0.5); put('dark', tx, y + 36, tz, 9, 8, 9, k, 0.8);
        for (let j = 0; j < 4; j++) { const a = j * 1.57 + 0.2;
          put('spike', tx + Math.cos(a) * 12, y + 8, tz + Math.sin(a) * 12, 3.2, 12, 2.5, k, 0, 0.3 * Math.sin(a), -0.3 * Math.cos(a)); }
        put('spike', tx - 2.5, y + 43, tz, 1.6, 9, 1.6, k, 0, 0, 0.35); put('spike', tx + 2.5, y + 43, tz, 1.6, 9, 1.6, k, 0, 0, -0.35);
        put('glow', tx, y + 47, tz, 2.6, 2.2, 1.6, sc(1, 0.55, 0.15));
      }
      const vz = lmZ(z0 + 80, LM.volcano[1]);
      if (inChunk(vz)) this.smoke = { x: LM.volcano[0], z: vz, y: H(LM.volcano[0], vz) };
    }
    for (const k in this.m) { const mesh = this.m[k]; mesh.count = n[k]; mesh.visible = n[k] > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    if (this.smoke) { this.m.smoke.count = 14; this.m.smoke.visible = true; this.update(0); }
  }
  // 火山口飘出的烟（随风向东南飘散）
  update(t) {
    const s = this.smoke; if (!s) return;
    const m = this.m.smoke;
    for (let i = 0; i < 14; i++) {
      const ph = (t * 0.07 + i / 14) % 1;
      const r = 5 + ph * 13;
      dummy.position.set(s.x + ph * 70 + Math.sin(i * 2.1) * 6, Math.min(58, s.y + 4 + ph * 12), s.z + ph * 36 + Math.cos(i * 1.7) * 6);
      dummy.rotation.set(i, i * 0.7, 0); dummy.scale.set(r, r * 0.6, r); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, sc(0.5 - ph * 0.15, 0.46 - ph * 0.15, 0.45 - ph * 0.15));
    }
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- 移动的生命：车队、骑兵、旅人、行军纵队
function part(g, x, y, z, rx = 0) { g.rotateX(rx); g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; }
const horseGeo = (() => { const g = mergeGeometries([
  part(new THREE.CylinderGeometry(1.15, 1.15, 5.2, 6), 0, 3.3, 0.2, Math.PI / 2),
  part(new THREE.BoxGeometry(1.0, 1.2, 3.0), 0, 4.4, -3.1, -0.6),
  part(new THREE.BoxGeometry(0.5, 2.6, 0.5), -0.6, 1.3, -1.8), part(new THREE.BoxGeometry(0.5, 2.6, 0.5), 0.6, 1.3, -1.8),
  part(new THREE.BoxGeometry(0.5, 2.6, 0.5), -0.6, 1.3, 2.0), part(new THREE.BoxGeometry(0.5, 2.6, 0.5), 0.6, 1.3, 2.0),
  part(new THREE.BoxGeometry(0.5, 0.5, 2.0), 0, 3.4, 3.4, 0.6)]); g.computeVertexNormals(); return g; })();
const riderGeo = (() => { const g = mergeGeometries([
  part(new THREE.BoxGeometry(1.7, 2.3, 1.3), 0, 5.6, 0.2), part(new THREE.BoxGeometry(2.2, 0.4, 2.8), 0, 5.0, 1.0),
  part(new THREE.IcosahedronGeometry(0.75, 0), 0, 7.2, 0.1)]); g.computeVertexNormals(); return g; })();
const figGeo = (() => { const g = mergeGeometries([
  part(new THREE.BoxGeometry(1.4, 1.3, 0.9), 0, 0.65, 0), part(new THREE.BoxGeometry(1.7, 1.6, 1.1), 0, 2.0, 0),
  part(new THREE.IcosahedronGeometry(0.62, 0), 0, 3.3, 0)]); g.computeVertexNormals(); return g; })();
const spearGeo = new THREE.BoxGeometry(0.28, 0.28, 5.5).rotateX(-0.9).translate(0.9, 3.4, -0.6);
const cartGeo = (() => { const g = mergeGeometries([
  part(new THREE.BoxGeometry(3.8, 1.4, 6.0), 0, 2.0, 0), part(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 10).rotateZ(Math.PI / 2), -2.1, 1.4, 0.8),
  part(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 10).rotateZ(Math.PI / 2), 2.1, 1.4, 0.8), part(new THREE.BoxGeometry(0.3, 0.3, 4), -0.8, 2.0, -4.5),
  part(new THREE.BoxGeometry(0.3, 0.3, 4), 0.8, 2.0, -4.5)]); g.computeVertexNormals(); return g; })();
const loadGeo = new THREE.IcosahedronGeometry(1, 1).scale(1.7, 1.0, 2.6).translate(0, 3.4, 0.2);
const bannerGeo = new THREE.BoxGeometry(0.25, 0.25, 9).rotateX(-1.25).translate(0, 7.5, 0.5);
const flagGeo = new THREE.BoxGeometry(2.6, 0.2, 1.8).translate(1.4, 11.6, 2.2);

const WHITE = new THREE.Color(1, 1, 1);
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
const WIN = 330;

class Group {
  constructor(o) { Object.assign(this, o); }
  get len() { return this.rows * this.sp; }
}

export class Life {
  constructor(scene) {
    const mk = (geo, mat, n) => { const m = inst(geo, mat, n); scene.add(m); return m; };
    this.m = {
      horse: mk(horseGeo, lowPoly(), 48), rider: mk(riderGeo, lowPoly(), 40), fig: mk(figGeo, lowPoly(), 200),
      spear: mk(spearGeo, lowPoly({ color: sc(0.30, 0.28, 0.27) }), 200), cart: mk(cartGeo, lowPoly(), 8), load: mk(loadGeo, lowPoly(), 8),
      banner: mk(bannerGeo, lowPoly({ color: sc(0.36, 0.26, 0.18) }), 8), flag: mk(flagGeo, lowPoly(), 8),
    };
    this.groups = []; this.t = 0;
  }
  reset(biome, camZ, R, H) {
    this.biome = biome; this.R = R; this.H = H; this.groups = [];
    const lane = (k, off = 0) => (z) => fx(FEAT[k], z) + off;
    const wild = () => { const f = { x: -280 + R() * 480, a: [30 + R() * 40, 0.002 + R() * 0.002, R() * 6], b: [8 + R() * 10, 0.006 + R() * 0.004, R() * 6] }; return (z) => fx(f, z); };
    const G = (o) => this.groups.push(new Group({ phase: R() * 6, members: [], ...o }));
    const C = (...a) => sc(...a);
    if (biome === 0) {
      // 小路上的马车（小马拉车 + 赶车的霍比特人）和步行的霍比特人
      const loads = [C(0.95, 0.82, 0.38), C(0.62, 0.42, 0.26), C(0.90, 0.56, 0.32), C(0.70, 0.80, 0.42)];
      for (let k = 0; k < 3; k++) {
        const dir = k % 2 ? 1 : -1;
        G({ kind: 'cart', curve: lane('shLane', dir * 1.6), dir, v: 6 + R() * 4, rows: 1, cols: 1, sp: 14, csp: 0, z: camZ - 220 + k * 170 + R() * 40,
          members: [{ row: 0, col: 0, c: loads[k % 4], pony: R() < 0.5 ? C(0.5, 0.34, 0.22) : C(0.82, 0.8, 0.76), coat: [C(0.30, 0.52, 0.30), C(0.80, 0.56, 0.24), C(0.62, 0.30, 0.22)][k % 3] }] });
      }
      const coats = [C(0.30, 0.55, 0.32), C(0.86, 0.66, 0.26), C(0.72, 0.30, 0.24), C(0.40, 0.48, 0.70)];
      for (let k = 0; k < 2; k++) {
        const n = 2 + Math.floor(R() * 2);
        G({ kind: 'walk', curve: lane('shLane', (k ? 1 : -1) * 3.2), dir: k ? 1 : -1, v: 2.4 + R(), rows: n, cols: 1, sp: 5.5, csp: 0, z: camZ - 120 + k * 200,
          members: Array.from({ length: n }, (_, i) => ({ row: i, col: 0, c: coats[(i + k) % 4], s: 1.7 })) });
      }
    } else if (biome === 1) {
      // 骠骑（éored）：沿大路南下的纵队 + 越野奔驰的骑兵
      const horses = [C(0.42, 0.26, 0.16), C(0.30, 0.20, 0.14), C(0.56, 0.40, 0.26), C(0.72, 0.68, 0.62)];
      const cloaks = [C(0.26, 0.46, 0.28), C(0.34, 0.52, 0.30), C(0.62, 0.64, 0.66)];
      const troop = (curve, dir, v, rows, cols, z, sp = 17, csp = 10) => {
        const members = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
          members.push({ row: r, col: c, c: r === 0 && c === 0 ? C(0.96, 0.95, 0.92) : horses[Math.floor(R() * 4)], coat: cloaks[Math.floor(R() * 3)],
            dx: (R() - 0.5) * 2.5, dz: (R() - 0.5) * 3, banner: r === 0 && c === cols - 1 });
        G({ kind: 'ride', curve, dir, v, rows, cols, sp, csp, z, members, gallop: 1 });
      };
      troop(lane('roRoad'), 1, 30, 5, 2, camZ - 160);
      troop(wild(), -1, 46, 4, 3, camZ + 360, 16, 12);
    } else if (biome === 2) {
      // 河边小径上的九人旅队，偶尔有一位白马骑手
      const cl = [C(0.62, 0.64, 0.66), C(0.36, 0.48, 0.30), C(0.46, 0.36, 0.26), C(0.30, 0.42, 0.36), C(0.54, 0.40, 0.28), C(0.40, 0.46, 0.34),
        C(0.70, 0.56, 0.30), C(0.36, 0.30, 0.26), C(0.46, 0.50, 0.40)];
      const sz = [1.75, 1.6, 1.6, 1.15, 1.15, 1.15, 1.15, 1.35, 1.6];
      G({ kind: 'walk', curve: lane('miRiver', TRAIL), dir: -1, v: 3.2, rows: 9, cols: 1, sp: 6, csp: 0, z: camZ - 150,
        members: cl.map((c, i) => ({ row: i, col: 0, c, s: sz[i] * 1.5 })) });
      G({ kind: 'ride', curve: lane('miRiver', TRAIL), dir: 1, v: 16, rows: 1, cols: 1, sp: 12, csp: 0, z: camZ - 330, gallop: 0.6,
        members: [{ row: 0, col: 0, c: C(0.97, 0.96, 0.94), coat: C(0.86, 0.88, 0.92) }] });
    } else {
      // 魔多：大道上行军的纵队 + 越野行进的纵队，带旗手
      const ok = [C(0.16, 0.14, 0.13), C(0.22, 0.17, 0.14), C(0.12, 0.11, 0.11), C(0.26, 0.20, 0.16)];
      const column = (curve, dir, v, rows, cols, z) => {
        const members = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
          members.push({ row: r, col: c, c: ok[Math.floor(R() * 4)], s: 1.9 + R() * 0.3, dx: (R() - 0.5) * 0.8, dz: (R() - 0.5) * 1.0, spear: R() < 0.7,
            banner: (r % 6 === 0) && c === 0 });
        G({ kind: 'march', curve, dir, v, rows, cols, sp: 5.6, csp: 5.0, z, members });
      };
      column(lane('moRoad', -1), 1, 9, 14, 5, camZ - 200);
      column(wild(), -1, 7, 10, 4, camZ - 60);
    }
    this.update(0, camZ);
  }
  update(dt, camZ) {
    this.t += dt;
    const H = this.H, b = this.biome, t = this.t, R = Math.random;
    const n = {}; for (const k in this.m) n[k] = 0;
    const put = (key, x, y, z, s, yaw, color, pitch = 0, roll = 0) => {
      const mesh = this.m[key]; if (n[key] >= mesh.instanceMatrix.count) return;
      dummy.position.set(x, y, z); dummy.rotation.set(pitch, yaw, roll, 'YXZ'); dummy.scale.set(s, s, s); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color || WHITE); n[key]++;
    };
    for (const g of this.groups) {
      g.z += g.dir * g.v * dt;
      // 整队离开视野后在另一端重新出现
      const head = g.z, tail = g.z - g.dir * g.len, lo = Math.min(head, tail), hi = Math.max(head, tail);
      const fast = g.dir === -1 && g.v > 27;     // 比飞机还快的北行骑兵会从画面下方追上来
      if (lo > camZ + WIN || (fast && hi < camZ - WIN)) {
        if (fast) g.z = camZ + WIN + 40 + R() * 200;
        else if (g.dir === 1) g.z = camZ - WIN - 40 - R() * 260;
        else g.z = camZ - WIN - 40 - g.len - R() * 200;
      }
      for (const m of g.members) {
        const zm = g.z - g.dir * m.row * g.sp + (m.dz || 0);
        const lateral = (m.col - (g.cols - 1) / 2) * g.csp + (m.dx || 0);
        const cx = g.curve(zm), slope = (g.curve(zm + 1) - g.curve(zm - 1)) / 2;
        const yaw = yawOf(slope * g.dir, g.dir);
        const x = cx + lateral, z = zm;
        if (Math.abs(z - camZ) > WIN + 40) continue;
        const ph = t * (g.kind === 'ride' ? 9 * g.gallop : g.kind === 'march' ? 7 : 5) + m.row * 0.9 + m.col * 1.7 + g.phase;
        const y = H(b, x, z);
        if (g.kind === 'ride') {
          const bob = Math.abs(Math.sin(ph)) * 0.9 * g.gallop, pitch = Math.sin(ph) * 0.08 * g.gallop;
          put('horse', x, y + bob, z, 2.3, yaw, m.c, pitch);
          put('rider', x, y + bob, z, 2.3, yaw, m.coat, pitch);
          if (m.banner) { put('banner', x, y + bob, z, 2.3, yaw); put('flag', x, y + bob, z, 2.3, yaw, sc(0.24, 0.50, 0.26)); }
        } else if (g.kind === 'march' || g.kind === 'walk') {
          const bob = Math.abs(Math.sin(ph)) * 0.35, sway = Math.sin(ph) * 0.08;
          put('fig', x, y + bob, z, m.s, yaw, m.c, 0, sway);
          if (m.spear) put('spear', x, y + bob, z, m.s, yaw);
          if (m.banner) { put('banner', x, y + bob, z, 1.3, yaw); put('flag', x, y + bob, z, 1.3, yaw, sc(0.55, 0.10, 0.08)); }
        } else if (g.kind === 'cart') {
          const fx_ = Math.sin(yaw), fz = Math.cos(yaw);       // 车头方向是 -z 本地 → 世界方向 (-sin, -cos)
          put('cart', x, y, z, 1.7, yaw, sc(0.56, 0.40, 0.26), Math.sin(ph) * 0.02);
          put('load', x, y, z, 1.7, yaw, m.c);
          const px = x - fx_ * 13, pz = z - fz * 13;
          put('horse', px, H(b, px, pz) + Math.abs(Math.sin(ph)) * 0.25, pz, 1.25, yaw, m.pony);
          put('fig', x - fx_ * 4.6, y + 3.4, z - fz * 4.6, 1.4, yaw, m.coat);
        }
      }
    }
    for (const k in this.m) { const mesh = this.m[k]; mesh.count = n[k]; mesh.visible = n[k] > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
}
