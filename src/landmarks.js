// 地标世界（?world=landmarks）：东京塔、天安门广场、故宫、悉尼歌剧院。
// 与其他世界共用渲染管线（油画滤镜、撕纸边缘、飞机、指针/自动驾驶、HUD）；这里提供场景配置、地面着色、
// 地标模型（每个场景一套合并网格，随镜头按周期复用）、区块填充建筑，以及少量移动的车、行人、船。
import * as THREE from 'three';
import { groundHeader, groundCommonGLSL } from './groundShader.js';
import { SHARED, L, PERIOD, ORIGIN, SY_X, local, kindOf } from './landmarks_layout.js';
import { lmGroundGLSL } from './landmarks_ground.js';
import { buildMonument, sc } from './landmarks_models.js';
import { Builder, rng } from './lm/kit.js';
import { CITIES } from './lm/cities.js';

const lowPoly = (o = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });

// ---------------------------------------------------------------- 场景
// tilt：镜头从正南方向的倾角（弧度），让高耸的塔和殿顶有立体感；planeY 飞机高度（东京要高过东京塔）
export const SCENES = [
  { name: 'Tokyo Tower · 東京タワー', sub: 'Shiba Park, Minato · autumn afternoon', lat: 35.6586, lon: 139.7454,
    zoom: 1.45, speed: 0.7, tilt: 0.66, planeY: 196, clouds: { count: 2, min: 0.5, max: 0.7, y: 225 }, birds: { n: 0, color: [0.2, 0.2, 0.2] }, look: 'day' },
  { name: 'Tiananmen · 天安门', sub: "Chang'an Avenue & the Square · Beijing", lat: 39.9075, lon: 116.3972,
    zoom: 1.45, speed: 0.7, tilt: 0.62, planeY: 92, clouds: { count: 1, min: 0.5, max: 0.7, y: 125 }, birds: { n: 0, color: [0.2, 0.2, 0.2] }, look: 'warm' },
  { name: 'The Forbidden City · 故宫', sub: 'Palace Museum to Jingshan · Beijing', lat: 39.9163, lon: 116.3972,
    zoom: 1.45, speed: 0.7, tilt: 0.62, planeY: 92, clouds: { count: 1, min: 0.5, max: 0.7, y: 125 }, birds: { n: 0, color: [0.2, 0.2, 0.2] }, look: 'warm' },
  { name: 'Sydney Opera House', sub: 'Bennelong Point · Sydney Harbour', lat: -33.8568, lon: 151.2153,
    zoom: 1.2, speed: 0.7, tilt: 0.6, planeY: 96, clouds: { count: 2, min: 0.5, max: 0.75, y: 135 }, birds: { n: 4, color: [0.97, 0.97, 0.97], y: 55 }, look: 'bright' },
  ...CITIES.map((c) => ({ speed: 0.7, birds: { n: 0, color: [0.2, 0.2, 0.2] }, look: 'day', ...c.scene })),
];
const DEG = 1 / 222640;   // 1 单位 ≈ 2 米 → 纬度
export const coords = (cfg, st) => {
  const lat = cfg.lat + (st.dist) * DEG, lon = cfg.lon + st.camX * DEG / Math.cos(cfg.lat * Math.PI / 180);
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
};
const LOOKS = {
  day: { sky: 0xe4ebff, gnd: 0xdfe6ff, hk: 1.0, sun: 0xfff3e4, sk: 1.0, cloud: [1, 1, 1], cem: [0.40, 0.42, 0.46] },
  warm: { sky: 0xeee8f6, gnd: 0xe6e0da, hk: 1.0, sun: 0xfff0dc, sk: 1.02, cloud: [1, 1, 1], cem: [0.42, 0.42, 0.44] },
  bright: { sky: 0xe0ecff, gnd: 0xdce8f6, hk: 1.02, sun: 0xfff8ec, sk: 1.02, cloud: [1, 1, 1], cem: [0.42, 0.44, 0.48] },
  desert: { sky: 0xf2ead8, gnd: 0xf0e2c8, hk: 1.0, sun: 0xfff0d6, sk: 1.06, cloud: [1, 1, 1], cem: [0.44, 0.42, 0.40] },
  soft: { sky: 0xe6ecf2, gnd: 0xe2e6e4, hk: 1.04, sun: 0xfff4e6, sk: 0.94, cloud: [1, 1, 1], cem: [0.42, 0.43, 0.46] },
};
export function applyLook(cfg, { hemi, sun, cloudMat, base }) {
  const Lk = LOOKS[cfg.look] || LOOKS.day;
  hemi.color.set(Lk.sky); hemi.groundColor.set(Lk.gnd); hemi.intensity = base.hemi * Lk.hk;
  sun.color.set(Lk.sun); sun.intensity = base.sun * Lk.sk;
  cloudMat.color.copy(sc(...Lk.cloud)); cloudMat.emissive.copy(sc(...Lk.cem));
}

// ---------------------------------------------------------------- 地形与地面
export const height = (b, x, z) => L.lmHeight(b, x, z);
export const BLOCKED = SCENES.map(() => () => false);
export const groundGeo = (w, d) => new THREE.PlaneGeometry(w, d, Math.round(w / 10), Math.round(d / 10)).rotateX(-Math.PI / 2);
export function patchGround(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = `uniform float uBiome;\nvarying vec3 vWPos;\nvarying float vSlope;\n${SHARED}\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec2 lmWp = (modelMatrix*vec4(position,1.)).xz;
  float lmHx = lmHeight(uBiome, lmWp.x+2.5, lmWp.y) - lmHeight(uBiome, lmWp.x-2.5, lmWp.y);
  float lmHz = lmHeight(uBiome, lmWp.x, lmWp.y+2.5) - lmHeight(uBiome, lmWp.x, lmWp.y-2.5);
  vec3 objectNormal = normalize(vec3(-lmHx, 5., -lmHz));
  vSlope = (.42*lmHx + .55*lmHz) / 5.;`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += lmHeight(uBiome, lmWp.x, lmWp.y);
  vWPos = (modelMatrix*vec4(transformed,1.)).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + groundHeader('') + groundCommonGLSL + SHARED + lmGroundGLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( groundColor(vWPos.xz), opacity );')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + gEm;');
  };
}

// ---------------------------------------------------------------- 地标模型：每个场景一套，镜头附近摆两份（当前周期 + 相邻周期）
export class Monuments {
  constructor(scene) { this.scene = scene; this.cache = {}; this.copies = []; this.b = -1; }
  set(b) {
    for (const c of this.copies) this.scene.remove(c);
    if (!this.cache[b]) {
      if (b < 4) this.cache[b] = buildMonument(b);
      else { const B = new Builder(); CITIES[b - 4].build(B, { L, R: rng(4242 + b * 17), H: (x, z) => L.lmHeight(b, x, z + ORIGIN[b][0]) }); this.cache[b] = B.build(); }
    }
    const g = this.cache[b];
    this.copies = [g, g.clone()];
    for (const c of this.copies) this.scene.add(c);
    this.b = b;
  }
  update(camZ) {
    const b = this.b, lz = local(b, camZ), o = camZ - lz, lo = ORIGIN[b][1];
    this.copies[0].position.z = o;
    this.copies[1].position.z = lz < lo + PERIOD / 2 ? o - PERIOD : o + PERIOD;
  }
}

// ---------------------------------------------------------------- 区块填充：城市街区、胡同四合院、郊区住宅、公园树木
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const gableGeo = new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).translate(0, 0.5, 0).scale(1 / 1.732, 1 / 1.5, 1);
const hipGeo = new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0);
const domeGeo = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const dummy = new THREE.Object3D();
function inst(geo, mat, n, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  m.setColorAt(0, new THREE.Color(1, 1, 1)); return m;
}
const MAT = { b: lowPoly(), r: lowPoly() };
const P = (arr) => arr.map((c) => sc(...c));
const PAL = {
  tokyo: P([[0.90, 0.88, 0.84], [0.84, 0.82, 0.78], [0.78, 0.79, 0.80], [0.93, 0.92, 0.90], [0.70, 0.74, 0.80], [0.86, 0.80, 0.70], [0.62, 0.66, 0.72]]),
  tokyoTop: P([[0.62, 0.64, 0.66], [0.70, 0.71, 0.72], [0.56, 0.60, 0.62]]),
  bjModern: P([[0.84, 0.80, 0.72], [0.78, 0.76, 0.74], [0.70, 0.74, 0.78], [0.88, 0.84, 0.76], [0.64, 0.68, 0.74]]),
  hutongWall: P([[0.62, 0.62, 0.62], [0.58, 0.58, 0.60], [0.66, 0.64, 0.62]]),
  hutongRoof: P([[0.36, 0.37, 0.40], [0.40, 0.41, 0.44], [0.33, 0.34, 0.37]]),
  syCbd: P([[0.80, 0.84, 0.88], [0.66, 0.74, 0.82], [0.90, 0.88, 0.84], [0.58, 0.66, 0.74], [0.84, 0.78, 0.68], [0.94, 0.93, 0.92]]),
  syRocks: P([[0.84, 0.70, 0.52], [0.78, 0.62, 0.46], [0.90, 0.84, 0.74]]),
  terracotta: P([[0.76, 0.38, 0.26], [0.70, 0.34, 0.24], [0.82, 0.46, 0.32], [0.60, 0.62, 0.66]]),
  house: P([[0.96, 0.94, 0.90], [0.92, 0.88, 0.80], [0.88, 0.86, 0.84]]),
};
const TREES = {
  tokyo: P([[0.24, 0.46, 0.22], [0.30, 0.54, 0.26], [0.86, 0.52, 0.22], [0.92, 0.70, 0.26], [0.36, 0.58, 0.30]]),
  bj: P([[0.18, 0.38, 0.22], [0.22, 0.44, 0.25], [0.16, 0.34, 0.20], [0.28, 0.50, 0.28]]),
  bjYellow: P([[0.86, 0.72, 0.26], [0.92, 0.80, 0.32], [0.80, 0.64, 0.22], [0.95, 0.85, 0.40]]),
  sy: P([[0.16, 0.38, 0.20], [0.22, 0.46, 0.24], [0.14, 0.32, 0.18], [0.30, 0.52, 0.26]]),
};
export class Deco {
  constructor(group) {
    this.m = { body: inst(boxGeo, MAT.b, 1600), top: inst(boxGeo, MAT.b, 1100), gable: inst(gableGeo, MAT.r, 1300), hip: inst(hipGeo, MAT.r, 1000), cyl: inst(cylGeo, MAT.b, 300), dome: inst(domeGeo, MAT.r, 200) };
    for (const k in this.m) group.add(this.m[k]);
  }
  fill(c) {
    const { biome: b, z0, R, tree } = c;
    
    const n = {}; for (const k in this.m) n[k] = 0;
    const put = (key, x, y, z, sx, sy, sz, color, ry = 0) => {
      const mesh = this.m[key]; if (n[key] >= mesh.instanceMatrix.count) return;
      dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color); n[key]++;
    };
    const pick = (a) => a[Math.floor(R() * a.length)];
    const o = z0 - local(b, z0);       // 区块起点所在周期的原点（区块不会跨越太多，逐点再算局部坐标）
    const K = (x, z) => kindOf(b, x, local(b, z));
    const allK = (x, z, hw, hd, k) => K(x - hw, z - hd) === k && K(x + hw, z - hd) === k && K(x - hw, z + hd) === k && K(x + hw, z + hd) === k && K(x, z) === k;
    const XR = 560;
    // 1) 建筑：按格网逐格放置，四角都在同一类填充地块才放（这样不会压到道路、广场、水面）
    const lattice = (step, fn) => {
      const zs = Math.ceil(z0 / step) * step;
      for (let z = zs; z < z0 + 160; z += step) for (let x = -XR; x <= XR; x += step) fn(x + (R() - 0.5) * step * 0.25, z + (R() - 0.5) * step * 0.25);
    };
    if (b >= 4) {
      const D = { b, z0, R, L, sc, P, TREES, PAL, put, pick, K, allK, lattice, tree, XR, H: c.H, local: (z) => local(b, z),
        // 局部 z 的一条东西向线在本区块里的世界 z（不在本区块则 null）
        rowZ: (tz) => { const zz = tz + (o + PERIOD * Math.round((z0 + 80 - o - tz) / PERIOD)); return zz >= z0 && zz < z0 + 160 ? zz : null; },
        // 在 kind 地块里撒树
        trees: (kinds, n, pal, { r = [3.5, 6], xr = 420, flat, h, subs = 3, test } = {}) => {
          for (let k = 0; k < n; k++) { const x = (R() * 2 - 1) * xr, z = z0 + R() * 160, kk = K(x, z);
            if (!(Array.isArray(kinds) ? kinds.includes(kk) : kk === kinds)) continue;
            if (test && !test(x, local(b, z))) continue;
            tree(x, z, r[0] + R() * (r[1] - r[0]), [pick(pal), ...pal], { subs, h, flat }); }
        },
        // 格网街区：kind 地块里逐格放楼（hfn 决定高度，返回 0 则跳过）
        blocks: (kind, step, { pad = step * 0.36, jitter = 0.25, skip = 0.08, hfn, pal, top, roof, roofPal, roofH = 3, hw: hwF } = {}) => {
          const zs = Math.ceil(z0 / step) * step;
          for (let z = zs; z < z0 + 160; z += step) for (let x = -XR; x <= XR; x += step) {
            const xx = x + (R() - 0.5) * step * jitter, zz = z + (R() - 0.5) * step * jitter;
            const hw = hwF ? hwF(R) : pad * (0.85 + R() * 0.3), hd = hwF ? hwF(R) : pad * (0.85 + R() * 0.3);
            if (!allK(xx, zz, hw, hd, kind) || R() < skip) continue;
            const h = hfn(xx, local(b, zz), R); if (!h) continue;
            put('body', xx, 0, zz, hw * 2, h, hd * 2, pick(pal));
            if (roof === 'hip') put('hip', xx, h, zz, hw * 2.3, roofH, hd * 2.3, pick(roofPal));
            else if (roof === 'gable') put('gable', xx, h, zz, hw * 2.1, roofH, hd * 2.1, pick(roofPal), R() < 0.5 ? 0 : Math.PI / 2);
            else if (roof === 'flat') put('top', xx, h, zz, hw * 2.08, 0.8, hd * 2.08, pick(roofPal));
            else if (top) put('top', xx + (R() - 0.5) * hw * 0.6, h, zz + (R() - 0.5) * hd * 0.6, hw * (0.6 + R() * 0.5), 1 + R() * 2, hd * (0.5 + R() * 0.5), pick(top));
          }
        },
      };
      CITIES[b - 4].deco(D);
    } else if (b === 0) {
      lattice(13, (x, z) => {
        const hw = 4 + R() * 2.2, hd = 4 + R() * 2.2;
        if (!allK(x, z, hw, hd, 0) || R() < 0.08) return;
        const lz = local(b, z), far = Math.hypot(x, lz) > 330;
        let h = 6 + Math.pow(R(), 2.2) * (far ? 60 : 30);
        if (Math.abs(x) < 120 && lz > 60 && lz < 330) h = Math.min(h, 16);   // 塔南面压低，别挡住东京塔
        put('body', x, 0, z, hw * 2, h, hd * 2, pick(PAL.tokyo));
        put('top', x + (R() - 0.5) * hw, h, z + (R() - 0.5) * hd, hw * (0.5 + R() * 0.5), 1 + R() * 2, hd * (0.4 + R() * 0.4), pick(PAL.tokyoTop));
      });
      // 芝公园的树（秋色：绿、橙、黄混合）
      for (let k = 0; k < 90; k++) {
        const x = -60 + R() * 280, z = z0 + R() * 160;
        if (K(x, z) !== 2) continue;
        tree(x, z, 4.5 + R() * 3, [pick(TREES.tokyo), ...TREES.tokyo], { subs: 3, h: 0.9 });
      }
      // 街道行道树
      for (let k = 0; k < 40; k++) { const x = (R() * 2 - 1) * XR, z = z0 + R() * 160; const lz = local(b, z);
        if (Math.abs(L.tkMain(x, lz) + 9.5) < 1.2 && K(x, z) !== 2) tree(x, z, 2.8, [TREES.tokyo[0], ...TREES.tokyo.slice(0, 2)], { subs: 2 }); }
    } else if (b === 1 || b === 2) {
      // 胡同四合院：一圈灰瓦坡顶 + 中庭，偶尔一棵大槐树
      lattice(20, (x, z) => {
        const k = K(x, z);
        if (k === 5 && allK(x, z, 9, 9, 5)) {
          if (R() < 0.06) return;
          const s = 7 + R() * 2.2, wc = pick(PAL.hutongWall), rc = pick(PAL.hutongRoof);
          put('body', x, 0, z - s * 0.62, s * 1.8, 2.6, 5, wc); put('gable', x, 2.6, z - s * 0.62, 6.2, 2.4, s * 1.9, rc, Math.PI / 2);
          put('body', x, 0, z + s * 0.7, s * 1.8, 2.3, 4, wc); put('gable', x, 2.3, z + s * 0.7, 5.0, 2.0, s * 1.9, rc, Math.PI / 2);
          for (const sx of [-1, 1]) { put('body', x + sx * s * 0.68, 0, z + 0.4, 4, 2.2, s * 0.9, wc); put('gable', x + sx * s * 0.68, 2.2, z + 0.4, 5, 1.8, s * 0.95, rc); }
          if (R() < 0.3) tree(x + (R() - 0.5) * 4, z + (R() - 0.5) * 3, 3.6 + R() * 1.5, [pick(TREES.bj), ...TREES.bj], { subs: 3 });
        } else if (k === 0 && allK(x, z, 8, 8, 0)) {
          if (R() < 0.15) return;
          const h = 10 + Math.pow(R(), 1.6) * 34, hw = 6 + R() * 3, hd = 6 + R() * 3;
          put('body', x, 0, z, hw * 2, h, hd * 2, pick(PAL.bjModern));
          put('top', x, h, z, hw * 1.2, 1.5, hd * 1.2, pick(PAL.tokyoTop));
        }
      });
      // 公园与绿地：中山公园、太庙、景山、北海、中南海的松柏；长安街和广场两侧的行道树
      for (let k = 0; k < 150; k++) {
        const x = (R() * 2 - 1) * 420, z = z0 + R() * 160;
        if (K(x, z) !== 2) continue;
        const lz = local(b, z);
        if (Math.abs(lz + 905) < 66 && Math.abs(x) < 106 && Math.abs(x) % 34 < 9) continue;   // 景山五亭附近留空
        const yel = R() < 0.18 ? TREES.bjYellow : TREES.bj;
        tree(x, z, 3.6 + R() * 2.4, [pick(yel), ...yel], { subs: 3, h: 0.95 });
      }
      for (let x = -XR + R() * 9; x < XR; x += 11 + R() * 3) for (const tz of [26, 72]) {
        const zz = tz + (o + PERIOD * Math.round((z0 + 80 - o - tz) / PERIOD));
        if (zz < z0 || zz >= z0 + 160) continue;
        if (Math.abs(x) < 40 && tz === 26) continue;
        if (tz === 72 && Math.abs(x) < 126) continue;
        tree(x, zz, 3.2, [TREES.bj[0], ...TREES.bj], { subs: 2 });
      }
    } else {
      lattice(14, (x, z) => {
        const k = K(x, z), sz = SY_X - x;     // 悉尼布局坐标里的南北（z' > 0 为南）
        if (k === 7 && allK(x, z, 5.5, 5.5, 7)) {
          if (R() < 0.1) return;
          const south = sz > 120 ? Math.min(1, (sz - 120) / 260) : 0.25, north = sz < -720 ? 0.7 : 0;
          const h = 10 + Math.pow(R(), 1.8) * (20 + 90 * Math.max(south, north));
          const hw = 4.5 + R() * 2, hd = 4.5 + R() * 2;
          put('body', x, 0, z, hw * 2, h, hd * 2, pick(PAL.syCbd));
          put('top', x, h, z, hw * 1.3, 1.2 + R() * 2, hd * 1.3, pick(PAL.tokyoTop));
        } else if (k === 0 && allK(x, z, 5, 5, 0)) {
          const h = 4 + R() * 9;
          put('body', x, 0, z, 9 + R() * 2, h, 8 + R() * 2, pick(PAL.syRocks));
          put('hip', x, h, z, 11, 3, 10, pick(PAL.terracotta));
        } else if (k === 6 && allK(x, z, 4.5, 4.5, 6)) {
          if (R() < 0.25) { tree(x, z, 3.8 + R() * 2, [pick(TREES.sy), ...TREES.sy], { subs: 3 }); return; }
          const w = 7 + R() * 3, d = 6 + R() * 3, h = 3.2 + R() * 2.5;
          put('body', x, 0, z, w, h, d, pick(PAL.house));
          put('hip', x, h, z, w * 1.15, 2.8, d * 1.15, pick(PAL.terracotta));
        }
      });
      // 皇家植物园：大无花果树
      for (let k = 0; k < 110; k++) {
        const x = (R() * 2 - 1) * 420, z = z0 + R() * 160;
        if (K(x, z) !== 2) continue;
        tree(x, z, 4.5 + R() * 3.5, [pick(TREES.sy), ...TREES.sy], { subs: 4, h: 0.85 });
      }
    }
    for (const k of Object.keys(this.m)) { const m = this.m[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  update() {}
}

// ---------------------------------------------------------------- 移动的生命：车流、行人、渡轮与帆船
const carGeo = (() => {
  const g = [new THREE.BoxGeometry(2.6, 1.4, 5.6).translate(0, 1.0, 0), new THREE.BoxGeometry(2.3, 1.1, 3.0).translate(0, 2.2, 0.3)];
  return mergeG(g);
})();
const busGeo = mergeG([new THREE.BoxGeometry(2.8, 3.0, 11).translate(0, 1.8, 0)]);
const personGeo = mergeG([new THREE.CylinderGeometry(0.55, 0.65, 2.0, 6).translate(0, 1.0, 0), new THREE.IcosahedronGeometry(0.55, 0).translate(0, 2.4, 0)]);
const ferryGeo = mergeG([new THREE.BoxGeometry(5.4, 1.6, 15).translate(0, 0.8, 0), new THREE.BoxGeometry(4.4, 2.0, 9).translate(0, 2.6, 0), new THREE.BoxGeometry(3.2, 1.2, 4).translate(0, 4.2, -1.5)]);
const ferryTopGeo = mergeG([new THREE.BoxGeometry(5.6, 0.7, 15.2).translate(0, 1.2, 0)]);
const hullGeo = mergeG([new THREE.BoxGeometry(2.0, 0.9, 6.4).translate(0, 0.45, 0)]);
const rowGeo = mergeG([new THREE.BoxGeometry(2.2, 0.9, 7).translate(0, 0.45, 0), new THREE.BoxGeometry(2.0, 1.4, 3).translate(0, 1.6, 0.4)]);
const jetGeo = mergeG([new THREE.CylinderGeometry(0.25, 1.1, 1, 7).translate(0, 0.5, 0), new THREE.IcosahedronGeometry(1.1, 0).translate(0, 1, 0)]);
const sailGeo = (() => { const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -1.4, 0, 9, -0.6, 0, 1, 2.4], 3)); g.computeVertexNormals(); return g; })();
function mergeG(list) {
  const pos = [], nor = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
const CARC = P([[0.95, 0.95, 0.95], [0.20, 0.20, 0.22], [0.70, 0.72, 0.75], [0.85, 0.18, 0.15], [0.20, 0.32, 0.62], [0.96, 0.96, 0.94], [0.55, 0.56, 0.58]]);
const TAXI = { 0: P([[0.20, 0.26, 0.42], [0.96, 0.78, 0.22], [0.32, 0.56, 0.40]]), 1: P([[0.95, 0.78, 0.25], [0.30, 0.42, 0.70]]), 3: P([[0.98, 0.88, 0.20]]) };
const PEOPLE = P([[0.20, 0.20, 0.24], [0.92, 0.92, 0.90], [0.80, 0.22, 0.20], [0.24, 0.40, 0.72], [0.90, 0.72, 0.30], [0.36, 0.52, 0.36], [0.62, 0.50, 0.42]]);
const WIN = 440;
export class Life {
  constructor(scene) {
    const mk = (geo, n, shadow = true, mat = lowPoly()) => { const m = inst(geo, mat, n, shadow); scene.add(m); return m; };
    this.m = { car: mk(carGeo, 90), bus: mk(busGeo, 16), person: mk(personGeo, 320, false), ferry: mk(ferryGeo, 10), ferryTop: mk(ferryTopGeo, 10, false), hull: mk(hullGeo, 12), sail: mk(sailGeo, 12, true, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })),
      row: mk(rowGeo, 24), jet: mk(jetGeo, 120, false, new THREE.MeshLambertMaterial({ emissive: sc(0.5, 0.52, 0.55), transparent: true, opacity: 0.82 })) };
    this.t = 0;
  }
  // 最靠近镜头的那一份周期里，局部 z 对应的世界 z
  wz(lz, camZ) { const oz = ORIGIN[this.b][0]; return lz + oz + PERIOD * Math.round((camZ - oz - lz) / PERIOD); }
  reset(b, camZ, R) {
    this.b = b; this.R = R; this.cars = []; this.people = []; this.boats = []; this.custom = null; this.busC = null;
    const pick = (a) => a[Math.floor(R() * a.length)];
    const taxi = b >= 4 ? P(CITIES[b - 4].taxi || []) : TAXI[b === 2 ? 1 : b] || [];
    const carC = () => (R() < 0.22 && taxi.length ? pick(taxi) : pick(CARC));
    // 东西向车道：lz 车道中心局部 z，dir 行驶方向（+1 向东），n 车辆数
    const ew = (lz, dir, n, v, bus = 0) => { for (let i = 0; i < n; i++) this.cars.push({ ax: 'x', lz, dir, p: (R() * 2 - 1) * WIN, v: v * (0.85 + R() * 0.3), c: carC(), bus: R() < bus }); };
    const ns = (x, dir, n, v, bus = 0) => { for (let i = 0; i < n; i++) this.cars.push({ ax: 'z', x, dir, p: camZ + (R() * 2 - 1) * WIN, v: v * (0.85 + R() * 0.3), c: carC(), bus: R() < bus }); };
    const crowd = (x0, z0, x1, z1, n, avoid = []) => {
      for (let i = 0; i < n; i++) {
        let x, z, k = 0;
        do { x = x0 + R() * (x1 - x0); z = z0 + R() * (z1 - z0); k++; } while (k < 20 && avoid.some((a) => x > a[0] && x < a[2] && z > a[1] && z < a[3]));
        this.people.push({ rect: [x0, z0, x1, z1], avoid, x, z, tx: x, tz: z, v: 0.9 + R() * 0.7, wait: R() * 4, c: pick(PEOPLE) });
      }
    };
    if (b >= 4) {
      const city = CITIES[b - 4];
      const D = { R, L, sc, P, pick, carC, ew, ns, crowd, camZ,
        // 沿任意线段往返的车流：a→b（局部坐标），lane 为横向偏移，y 为高度（桥面）
        seg: (a, bb, n, v, { lanes = [-2, 2], y = 0, bus = 0.1 } = {}) => { const len = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
          for (let i = 0; i < n; i++) { const ln = lanes[i % lanes.length]; this.cars.push({ ax: 's', a, b: bb, len, lane: ln, dir: ln > 0 ? 1 : -1, p: R() * len, v: v * (0.85 + R() * 0.3), c: carC(), bus: R() < bus, y }); } },
        ferry: (rt, v = 10, c1 = [0.20, 0.42, 0.30], c2 = [0.96, 0.90, 0.70], s = 1) => this.boats.push({ kind: 'ferry', rt, seg: Math.floor(R() * rt.length), u: R(), v: v * (0.9 + R() * 0.2), heading: null, c1: sc(...c1), c2: sc(...c2), s }),
        // 帆船 / 小船：在 ok(x, z) 为真的水面上漂游（区域 [x0,z0,x1,z1]）
        sail: (n, box, ok, { kind = 'sail', v = [4, 7], cols } = {}) => { for (let k = 0; k < n; k++) { let x, z, t = 0;
          do { x = box[0] + R() * (box[2] - box[0]); z = box[1] + R() * (box[3] - box[1]); t++; } while (!ok(x, z) && t < 60);
          this.boats.push({ kind, x, z, h: R() * 6.28, v: v[0] + R() * (v[1] - v[0]), ok, box, c: cols ? sc(...pick(cols)) : R() < 0.8 ? sc(0.98, 0.98, 0.96) : pick(PEOPLE) }); } },
        bus: (c) => { this.busC = sc(...c); },
        custom: (fn) => { this.custom = fn; },
      };
      city.life(D);
    } else if (b === 0) {
      for (const [lz, d] of [[-52, 1], [-48, -1], [170 - 2, 1], [172, -1]]) ew(lz, d, 3, 13);
      ns(-72, -1, 3, 12); ns(-68, 1, 3, 12); ns(227, -1, 3, 14); ns(233, 1, 3, 14);
      crowd(-34, -34, 34, -22, 8); crowd(-34, 18, 34, 30, 10); crowd(130, 50, 200, 70, 10);
    } else if (b === 1 || b === 2) {
      // 长安街：两向各五条车道，含公交
      for (const [off, d] of [[-15, -1], [-11, -1], [-7, -1], [-3.5, -1], [3.5, 1], [7, 1], [11, 1], [15, 1]]) ew(48 + off, d, b === 1 ? 3 : 2, 15, 0.18);
      ns(-400, -1, 3, 13); ns(-396, 1, 3, 13); ns(264, -1, 2, 12); ns(268, 1, 2, 12);
      const sq = [[-18, 220, 18, 262], [-32, 336, 32, 400], [-4, 78, 4, 90], [-15, 135, 15, 165]];
      crowd(-118, 76, 118, 440, b === 1 ? 130 : 30, sq);
      crowd(-60, 18, 60, 27, 12);
      crowd(-26, -270, 26, -145, 14);
      crowd(-90, -440, 90, -376, b === 2 ? 30 : 10, [[-50, -440, 50, -436]]);
      crowd(-50, -588, 50, -570, 8);
      crowd(-40, -1010, 40, -995, 8);
    } else {
      // 悉尼：布局坐标 (x' 东, z' 南) → 世界 (x = SY_X - z', 局部 z = x')
      const W4 = (ax0, az0, ax1, az1) => [SY_X - az1, ax0, SY_X - az0, ax1];
      const cr = (r, n, avoid = []) => crowd(...W4(...r), n, avoid.map((a) => W4(...a)));
      // 大桥上的车：沿桥轴线（布拉德菲尔德公路）行驶
      for (let i = 0; i < 14; i++) this.cars.push({ ax: 'b', lane: (i % 4 - 1.5) * 3.6, dir: i % 4 < 2 ? 1 : -1, p: -150 + R() * 550, v: 13 + R() * 4, c: carC(), bus: R() < 0.1 });
      // 东西向街道（画面里是竖直方向）与南北向街道（画面里水平）
      ns(SY_X - 20, 1, 3, 11); ns(SY_X - 16, -1, 3, 11); ns(SY_X - 111, 1, 2, 10);
      ew(-114, 1, 2, 10); ew(-110, -1, 2, 10); ew(-184, 1, 2, 10); ew(-180, -1, 2, 10);
      cr([-28, 48, 30, 92], 22, [[-30, 48, 30, 60]]);
      cr([-110, 84, -40, 98], 18);
      cr([-30, -46, 32, -40], 6);
      // 渡轮：从环形码头出发的环线；帆船在开阔水面上漂游
      const routes = [
        [[-76, 70], [-76, 10], [-30, -110], [120, -200], [320, -220], [460, -150], [300, -120], [80, -130], [-60, -20]],
        [[-63, 70], [-62, 0], [-90, -150], [-160, -230], [-330, -240], [-460, -200], [-300, -170], [-140, -110], [-80, -20]],
        [[-89, 70], [-92, -10], [0, -150], [60, -250], [-10, -240], [-60, -80]],
        [[-50, 70], [-45, -20], [140, -110], [250, -60], [235, 60], [210, -60], [60, -80]],
      ];
      routes.forEach((rt) => this.boats.push({ kind: 'ferry', rt, seg: Math.floor(R() * rt.length), u: R(), v: 10 + R() * 2, heading: null }));
      for (let k = 0; k < 8; k++) {
        let x, z; do { x = (R() * 2 - 1) * 480; z = -60 - R() * 220; } while (L.syLand(x, z) > -14);
        this.boats.push({ kind: 'sail', x, z, h: R() * 6.28, v: 4 + R() * 3, c: R() < 0.8 ? sc(0.98, 0.98, 0.96) : pick(PEOPLE) });
      }
    }
    this.update(0, camZ, 0);
  }
  update(dt, camZ, camX = 0) {
    this.t += dt;
    const b = this.b, R = Math.random, n = {}; for (const k in this.m) n[k] = 0;
    const put = (key, x, y, z, s, yaw, color, pitch = 0, roll = 0) => {
      const mesh = this.m[key]; if (n[key] >= mesh.instanceMatrix.count) return;
      dummy.position.set(x, y, z); dummy.rotation.set(pitch, yaw, roll, 'YXZ'); if (Array.isArray(s)) dummy.scale.set(s[0], s[1], s[2]); else dummy.scale.set(s, s, s); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color); n[key]++;
    };
    const vis = (x, z) => Math.abs(z - camZ) < 440 && Math.abs(x - camX) < 520;
    for (const c of this.cars) {
      c.p += c.dir * c.v * dt;
      let x, z, yaw, y = 0;
      if (c.ax === 'x') {
        if (c.p - camX > WIN) c.p -= 2 * WIN; else if (camX - c.p > WIN) c.p += 2 * WIN;
        x = c.p; z = this.wz(c.lz, camZ); yaw = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        if (b !== 1 && b !== 2 && kindOf(b, x, local(b, z)) !== 1) continue;
      } else if (c.ax === 'z') {
        if (c.p - camZ > WIN) c.p -= 2 * WIN; else if (camZ - c.p > WIN) c.p += 2 * WIN;
        x = c.x; z = c.p; yaw = c.dir > 0 ? Math.PI : 0;
        const k = kindOf(b, x, local(b, z));
        if (k !== 1) continue;
      } else if (c.ax === 's') {
        if (c.p > c.len) c.p -= c.len; else if (c.p < 0) c.p += c.len;
        const ux = (c.b[0] - c.a[0]) / c.len, uz = (c.b[1] - c.a[1]) / c.len;
        x = c.a[0] + ux * c.p - uz * c.lane; const lz = c.a[1] + uz * c.p + ux * c.lane; z = this.wz(lz, camZ); y = c.y;
        yaw = Math.atan2(-ux * c.dir, -uz * c.dir);
      } else {
        if (c.p > 410) c.p = -150; else if (c.p < -150) c.p = 410;
        const al = c.p, deck = al < 0 ? Math.max(4, 25 + al * 0.12) : al > 252 ? Math.max(4, 25 - (al - 252) * 0.12) : 25;
        const ax = -190 + 0.259 * al + 0.966 * c.lane, az = -45 - 0.966 * al + 0.259 * c.lane;
        x = SY_X - az; z = this.wz(ax, camZ); y = deck + 1.2;
        yaw = Math.atan2(-0.966 * c.dir, -0.259 * c.dir);
      }
      if (!vis(x, z)) continue;
      put(c.bus ? 'bus' : 'car', x, y, z, 1, yaw, c.bus ? (this.busC || (b === 3 ? sc(0.30, 0.50, 0.75) : sc(0.86, 0.22, 0.18))) : c.c);
    }
    for (const p of this.people) {
      if (p.wait > 0) p.wait -= dt;
      else {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.5) {
          p.wait = 1 + R() * 5;
          for (let k = 0; k < 8; k++) {
            const tx = THREE.MathUtils.clamp(p.x + (R() - 0.5) * 40, p.rect[0], p.rect[2]), tz = THREE.MathUtils.clamp(p.z + (R() - 0.5) * 40, p.rect[1], p.rect[3]);
            if (!p.avoid.some((a) => tx > a[0] && tx < a[2] && tz > a[1] && tz < a[3])) { p.tx = tx; p.tz = tz; break; }
          }
        } else { p.x += dx / d * p.v * dt; p.z += dz / d * p.v * dt; p.h = Math.atan2(-dx, -dz); }
      }
      const z = this.wz(p.z, camZ); if (!vis(p.x, z)) continue;
      const bob = p.wait > 0 ? 0 : Math.abs(Math.sin(this.t * 8 + p.v * 10)) * 0.2;
      put('person', p.x, bob + L.lmHeight(b, p.x, z), z, 1, p.h || 0, p.c);
    }
    for (const bt of this.boats) {
      if (bt.kind === 'ferry') {
        const rt = bt.rt, a = rt[bt.seg], c = rt[(bt.seg + 1) % rt.length];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        bt.u += bt.v * dt / len;
        if (bt.u >= 1) { bt.u -= 1; bt.seg = (bt.seg + 1) % rt.length; }
        const x = a[0] + (c[0] - a[0]) * bt.u, lz = a[1] + (c[1] - a[1]) * bt.u;
        const want = Math.atan2(-(c[0] - a[0]), -(c[1] - a[1]));
        if (bt.heading === null) bt.heading = want;
        let dh = want - bt.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); bt.heading += THREE.MathUtils.clamp(dh, -1.2 * dt, 1.2 * dt);
        const rot = b === 3, wx = rot ? SY_X - lz : x, z = this.wz(rot ? x : lz, camZ); if (!vis(wx, z)) continue;
        const rock = Math.sin(this.t * 1.3 + bt.seg) * 0.03, yaw = rot ? bt.heading - Math.PI / 2 : bt.heading, s = bt.s || 1;
        put('ferry', wx, 0, z, s, yaw, bt.c1 || sc(0.20, 0.42, 0.30), 0, rock);
        put('ferryTop', wx, 1.6 * s, z, s, yaw, bt.c2 || sc(0.96, 0.90, 0.70), 0, rock);
      } else {
        bt.h += (Math.sin(this.t * 0.2 + bt.v) * 0.25) * dt;
        const nx = bt.x - Math.sin(bt.h) * bt.v * dt, nz = bt.z - Math.cos(bt.h) * bt.v * dt;
        const bad = bt.ok ? (!bt.ok(nx, nz) || nx < bt.box[0] || nx > bt.box[2] || nz < bt.box[1] || nz > bt.box[3]) : (L.syLand(nx, nz) > -12 || Math.abs(nx) > 520 || nz < -290 || nz > 40);
        if (bad) bt.h += 2.2 * dt * 4; else { bt.x = nx; bt.z = nz; }
        const rot = b === 3, wx = rot ? SY_X - bt.z : bt.x, z = this.wz(rot ? bt.x : bt.z, camZ); if (!vis(wx, z)) continue;
        const heel = 0.18 + Math.sin(this.t * 0.9 + bt.v) * 0.05, yaw = rot ? bt.h - Math.PI / 2 : bt.h;
        if (bt.kind === 'row') { put('row', wx, 0, z, 1, yaw, bt.c, 0, Math.sin(this.t * 1.7 + bt.v) * 0.04); continue; }
        put('hull', wx, 0, z, 1, yaw, sc(0.96, 0.96, 0.95), 0, heel * 0.4);
        put('sail', wx, 0, z, 1, yaw, bt.c, 0, heel);
      }
    }
    if (this.custom) this.custom(this.t, put, (lz) => this.wz(lz, camZ), vis);
    for (const k in this.m) { const mesh = this.m[k]; mesh.count = n[k]; mesh.visible = n[k] > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
}
