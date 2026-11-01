import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundGLSL, postFrag } from './groundShader.js';

// ---------------------------------------------------------------- 配置
const SCENES = [
  { name: 'Niigata, Japan', sub: 'Spring · sakura over flooded paddies', lat: 37.915, lon: 139.399,
    clouds: { count: 4, min: 0.6, max: 0.95 }, cars: [{ x: -132.5, v: -14, color: [0.95, 0.95, 0.93] }] },
  { name: 'La Pampa, Argentina', sub: 'Spring · open grassland', lat: -36.854, lon: -64.050,
    clouds: { count: 2, min: 0.8, max: 1.2 }, cars: [{ x: -135, v: -12, color: [0.86, 0.18, 0.15] }] },
  { name: 'Serengeti, Tanzania', sub: 'Dry season · long grass', lat: -2.502, lon: 35.041,
    clouds: { count: 3, min: 1.6, max: 2.3 }, cars: [{ x: -165, v: -8, color: [0.55, 0.6, 0.42] }] },
  { name: 'Punjab, India', sub: 'Late winter · mustard in flower', lat: 30.820, lon: 76.192,
    clouds: { count: 6, min: 0.75, max: 1.1 }, cars: [{ x: -100.5, v: -16, color: [0.85, 0.2, 0.18] }, { x: -95.5, v: 10, color: [0.95, 0.95, 0.92] }] },
];
const ART = { cx: 360, cy: 310, hx: 296, hy: 222 };       // 画面矩形（720 设计单位舞台）
const RECT = { x: 40, y: 64, w: 640, h: 492 };            // 画布覆盖的设计区域
const BASE_SPEED = 27;                                      // 设计单位/秒（从参考视频测得）
const DEG_PER_UNIT = 0.0003;
const CHUNK = 160;
const AUTO_SECONDS = 20;

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
let autoCycle = params.get('auto') !== '0' && !CAPTURE;
const PAINT = params.has('paint') ? parseFloat(params.get('paint')) : 1;
if (CAPTURE) document.body.classList.add('capture');

// ---------------------------------------------------------------- 工具
const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (R) => (R() + R() + R() - 1.5) / 1.5;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// ---------------------------------------------------------------- 渲染器
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(1, 1, 1);
const camera = new THREE.OrthographicCamera(-RECT.w / 2, RECT.w / 2, RECT.h / 2, -RECT.h / 2, 1, 2000);
camera.up.set(0, 0, -1);

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) },
    uRect: { value: new THREE.Vector4(RECT.x, RECT.y, RECT.w, RECT.h) },
    uArt: { value: new THREE.Vector4(ART.cx, ART.cy, ART.hx, ART.hy) },
    uTime: { value: 0 }, uReveal: { value: 1 }, uSeed: { value: 3.7 }, uPaint: { value: PAINT },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: postFrag, depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 灯光：柔和环境光 + 左上方太阳，阴影投向右下
const AMB = 0.6, DIR = 0.46;
scene.add(new THREE.HemisphereLight(0xe4ebff, 0xdfe6ff, AMB * Math.PI * 1.04));
const sun = new THREE.DirectionalLight(0xfff6ea, DIR * Math.PI / 0.84);
const SUN_DIR = new THREE.Vector3(-0.42, 1, -0.55).normalize();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -470, right: 470, top: 400, bottom: -400, near: 10, far: 1400 });
sun.shadow.radius = 5; sun.shadow.blurSamples = 10; sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- 材质
const groundUniforms = { uBiome: { value: 0 }, uTime: { value: 0 } };
const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
groundMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, groundUniforms);
  sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + groundGLSL)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( groundColor(vWPos.xz), opacity );');
};
const groundGeo = new THREE.PlaneGeometry(1800, CHUNK).rotateX(-Math.PI / 2);

const lowPoly = (o = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
const blobMat = lowPoly({ emissive: 0x000000 });
const petalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const petalMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const animalGeo = new THREE.BoxGeometry(1, 1, 1);
const stripeTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 16;
  const g = c.getContext('2d'); g.fillStyle = '#efebe2'; g.fillRect(0, 0, 4, 16);
  g.fillStyle = '#26221f'; for (let i = 3; i < 16; i += 4) g.fillRect(0, i, 4, 2); g.fillRect(0, 0, 4, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
})();
const zebraMat = lowPoly({ map: stripeTex });
const cattleMat = lowPoly();
const houseMat = lowPoly();
const roofGeo = new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const pondMat = new THREE.MeshLambertMaterial({ color: sc(0.30, 0.62, 0.62) });
const pondRimMat = new THREE.MeshLambertMaterial({ color: sc(0.86, 0.72, 0.52) });

// ---------------------------------------------------------------- 区块
const BLOCKED = [
  (x) => Math.abs(x - 80) < 46 || Math.abs(x + 130) < 13 || ((x + 1000) % 100) < 5 || ((x + 1000) % 100) > 96,
  (x) => Math.abs(x - 90) < 42 || Math.abs(x + 135) < 7,
  (x) => Math.abs(x + 15) < 44 || Math.abs(x + 165) < 7,
  (x) => Math.abs(x - 120) < 26 || Math.abs(x + 98) < 11,
];
const XR = 560;
const dummy = new THREE.Object3D();

function makeInst(geo, mat, n, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  m.setColorAt(0, new THREE.Color(1, 1, 1));
  return m;
}
function pondGeo(R, r, grow) {
  const s = new THREE.Shape(); const a = R() * 6, b = R() * 6;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48 * Math.PI * 2;
    const rr = r * (1 + 0.22 * Math.sin(3 * t + a) + 0.14 * Math.sin(5 * t + b)) + grow;
    i ? s.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : s.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

class Chunk {
  constructor() {
    this.group = new THREE.Group();
    this.ground = new THREE.Mesh(groundGeo, groundMat); this.ground.receiveShadow = true;
    this.blobs = makeInst(blobGeo, blobMat, 600);
    this.petals = makeInst(petalGeo, petalMat, 1500, false);
    this.cattle = makeInst(boxGeo, cattleMat, 200);
    this.zebra = makeInst(animalGeo, zebraMat, 420);
    this.house = makeInst(boxGeo, houseMat, 12);
    this.roof = makeInst(roofGeo, houseMat, 12);
    this.fence = makeInst(boxGeo, houseMat, 60);
    this.ponds = [];
    this.group.add(this.ground, this.blobs, this.petals, this.cattle, this.zebra, this.house, this.roof, this.fence);
  }
  clearPonds() { for (const p of this.ponds) { this.group.remove(p); p.geometry.dispose(); } this.ponds = []; }
  fill(index, biome, seed) {
    this.index = index;
    const z0 = index * CHUNK, R = rng(index * 9973 + biome * 7919 + seed * 131 + 17);
    this.ground.position.set(0, 0, z0 + CHUNK / 2);
    this.clearPonds();
    const blocked = BLOCKED[biome];
    const free = (pad = 0) => { for (let k = 0; k < 30; k++) { const x = (R() * 2 - 1) * XR; if (!blocked(x - pad) && !blocked(x + pad) && !blocked(x)) return x; } return -400; };
    const n = { blobs: 0, petals: 0, cattle: 0, zebra: 0, house: 0, roof: 0, fence: 0 };
    const put = (mesh, key, x, y, z, sx, sy, sz, color, ry = 0, rnd = false) => {
      if (n[key] >= mesh.instanceMatrix.count) return;
      dummy.position.set(x, y, z);
      if (rnd) dummy.rotation.set(R() * 6, R() * 6, R() * 6); else dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color); n[key]++;
    };
    const tree = (x, z, r, cols, flat = 1, subs = 3) => {
      put(this.blobs, 'blobs', x, r * 0.9, z, r, r * flat, r, cols[0], 0, true);
      for (let k = 0; k < subs; k++) {
        const a = R() * 6.28, d = r * (0.45 + R() * 0.35), rr = r * (0.5 + R() * 0.25);
        put(this.blobs, 'blobs', x + Math.cos(a) * d, r * 0.9 + (R() - 0.3) * r * 0.4, z + Math.sin(a) * d, rr, rr * flat, rr, cols[1 + (k % (cols.length - 1))], 0, true);
      }
    };
    const rz = () => z0 + R() * CHUNK;

    if (biome === 0) {
      const pinks = [sc(0.97, 0.66, 0.76), sc(0.99, 0.76, 0.84), sc(0.93, 0.58, 0.70), sc(1, 0.82, 0.88)];
      const nt = 2 + Math.floor(R() * 2.5);
      for (let t = 0; t < nt; t++) {
        const cx = free(12), cz = rz(); const grove = R() < 0.25 ? 3 + Math.floor(R() * 5) : 1;
        for (let g = 0; g < grove; g++) {
          const x = cx + (g ? gauss(R) * 26 : 0), z = cz + (g ? gauss(R) * 26 : 0);
          if (blocked(x)) continue;
          const r = 12 + R() * 4;
          tree(x, z, r, [pinks[Math.floor(R() * 3)], ...pinks], 0.9, 3);
          for (let p = 0; p < 45; p++) {
            const a = R() * 6.28, d = r * 0.6 + Math.pow(R(), 1.4) * 26;
            const s = 0.6 + R() * 0.7;
            put(this.petals, 'petals', x + Math.cos(a) * d + 4, 0.25, z + Math.sin(a) * d + 4, s, 1, s, R() < 0.6 ? sc(1, 1, 1) : sc(1, 0.86, 0.9), R() * 3);
          }
        }
      }
    } else if (biome === 1) {
      if (R() < 0.8) {
        let cx = free(30); cx = THREE.MathUtils.clamp(cx * 0.55, -300, 300); if (blocked(cx)) cx = -250; const cz = rz(), nh = 12 + Math.floor(R() * 16), dir = R() * 6;
        for (let k = 0; k < nh; k++) {
          const x = cx + gauss(R) * 55, z = cz + gauss(R) * 55; if (blocked(x)) continue;
          const c = R() < 0.7 ? sc(0.22, 0.15, 0.09) : sc(0.36, 0.24, 0.14);
          put(this.cattle, 'cattle', x, 0.9, z, 3.0, 2.4, 6.5, c, dir + gauss(R) * 1.2);
        }
      }
      for (let k = 0; k < 2; k++) { const x = free(); if (R() < 0.6) put(this.cattle, 'cattle', x, 0.9, rz(), 3.0, 2.4, 6.5, sc(0.22, 0.15, 0.09), R() * 6); }
      if (R() < 0.5) { const x = free(8); tree(x, rz(), 7 + R() * 3, [sc(0.20, 0.42, 0.22), sc(0.26, 0.5, 0.25), sc(0.17, 0.36, 0.2)], 0.8, 3); }
    } else if (biome === 2) {
      const cl = 3 + Math.floor(R() * 3);
      for (let c = 0; c < cl; c++) {
        const cx = free(20), cz = rz(), m = 8 + Math.floor(R() * 20), dir = R() * 6;
        for (let k = 0; k < m; k++) {
          const x = cx + gauss(R) * 48, z = cz + gauss(R) * 48; if (blocked(x)) continue;
          const dark = R() < 0.12;
          put(this.zebra, 'zebra', x, 1.3, z, 4.0, 3.0, 7.4, dark ? sc(0.35, 0.28, 0.22) : sc(1, 1, 1), dir + gauss(R) * 1.4);
        }
      }
      for (let k = 0; k < 70; k++) { const x = free(); put(this.zebra, 'zebra', x, 1.3, rz(), 4.0, 3.0, 7.4, sc(1, 1, 1), R() * 6); }
      if (R() < 0.35) { const x = free(15); tree(x, rz(), 13 + R() * 5, [sc(0.22, 0.48, 0.18), sc(0.30, 0.56, 0.22), sc(0.18, 0.40, 0.16)], 0.75, 4); }
      if (R() < 0.3) {
        const x = free(30), z = rz(), r = 13 + R() * 9; const PR = rng(index * 31 + 5);
        const rim = new THREE.Mesh(pondGeo(PR, r, 3.5), pondRimMat), w = new THREE.Mesh(pondGeo(rng(index * 31 + 5), r, 0), pondMat);
        rim.position.set(x, 0.05, z); w.position.set(x, 0.1, z); rim.receiveShadow = w.receiveShadow = true;
        this.ponds.push(rim, w); this.group.add(rim, w);
      }
    } else {
      const greens = [sc(0.16, 0.36, 0.22), sc(0.22, 0.45, 0.27), sc(0.13, 0.30, 0.19), sc(0.26, 0.5, 0.3)];
      if (R() < 0.6) {
        const cx = free(25), cz = rz(), m = 8 + Math.floor(R() * 12);
        for (let k = 0; k < m; k++) { const x = cx + gauss(R) * 40, z = cz + gauss(R) * 40; if (blocked(x)) continue; tree(x, z, 8 + R() * 3, [greens[Math.floor(R() * 4)], ...greens], 0.85, 3); }
      }
      if (R() < 0.5) {
        const side = R() < 0.75 ? -1 : 1, x = -98 + side * (20 + R() * 22), z = rz();
        const roofC = R() < 0.6 ? sc(0.86, 0.2, 0.2) : sc(0.25, 0.42, 0.85);
        put(this.house, 'house', x, 3, z, 8, 6, 9, sc(0.93, 0.88, 0.8));
        put(this.roof, 'roof', x, 6, z, 12, 4, 13, roofC);
        put(this.house, 'house', x + 7, 1.6, z + 2, 3.5, 3.2, 4, roofC);
        const W = 26, H = 22, fx = x + 2, fz = z + 1, fc = sc(0.72, 0.6, 0.42);
        put(this.fence, 'fence', fx, 0.7, fz - H / 2, W, 1.2, 0.5, fc); put(this.fence, 'fence', fx, 0.7, fz + H / 2, W, 1.2, 0.5, fc);
        put(this.fence, 'fence', fx - W / 2, 0.7, fz, 0.5, 1.2, H, fc); put(this.fence, 'fence', fx + W / 2, 0.7, fz, 0.5, 1.2, H, fc);
        if (R() < 0.6) tree(fx - W / 2 - 6, fz + 4, 5, [greens[1], ...greens], 0.85, 2);
      }
      for (let k = 0; k < 8; k++) { const x = free(); put(this.cattle, 'cattle', x, 0.9, rz(), 3.0, 2.4, 5.8, R() < 0.5 ? sc(0.25, 0.2, 0.18) : sc(0.38, 0.27, 0.2), R() * 6); }
    }
    for (const k of Object.keys(n)) {
      const m = this[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
const chunkPool = [], activeChunks = new Map();
const world = new THREE.Group(); scene.add(world);

// ---------------------------------------------------------------- 云
function cloudGeo(seed) {
  const R = rng(seed), parts = [];
  const n = 9 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, d = Math.pow(R(), 0.6) * 26;
    const r = 9 + R() * 9 - d * 0.18;
    const g = new THREE.IcosahedronGeometry(r, 3);
    g.translate(Math.cos(a) * d * 1.1, (R() - 0.5) * 6 + r * 0.15, Math.sin(a) * d);
    parts.push(g);
  }
  const m = mergeGeometries(parts); m.scale(1, 0.7, 1); return m;
}
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: sc(0.42, 0.44, 0.48) });
const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = new THREE.Mesh(cloudGeo(101 + i * 7), cloudMat); c.castShadow = true; c.visible = false;
  scene.add(c); clouds.push(c);
}

// ---------------------------------------------------------------- 飞机
function makePlane() {
  const parts = [];
  const add = (g, x, y, z) => { g.translate(x, y, z); parts.push(g.toNonIndexed()); };
  add(new THREE.BoxGeometry(2.4, 2.2, 13), 0, 0, 0.5);
  add(new THREE.ConeGeometry(1.25, 3.5, 6).rotateX(-Math.PI / 2), 0, 0, -7.7);
  const wg = new THREE.BoxGeometry(30, 0.5, 3.6); add(wg, 0, 0.2, -0.6);
  add(new THREE.BoxGeometry(10, 0.4, 2.4), 0, 0.6, 6.4);
  add(new THREE.BoxGeometry(0.4, 3.2, 2.6), 0, 2.0, 6.3);
  const g = mergeGeometries(parts); g.computeVertexNormals();
  const m = new THREE.Mesh(g, lowPoly({ color: 0xffffff, emissive: sc(0.22, 0.22, 0.24) }));
  m.castShadow = true; m.scale.setScalar(1.0);
  const grp = new THREE.Group(); grp.add(m); return grp;
}
const plane = makePlane(); scene.add(plane);

// ---------------------------------------------------------------- 车辆
function makeCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, lowPoly()); body.scale.set(3.0, 1.5, 5.6); body.position.y = 0.9;
  const cab = new THREE.Mesh(boxGeo, lowPoly({ color: sc(0.9, 0.92, 0.95) })); cab.scale.set(2.5, 1.0, 2.6); cab.position.set(0, 2.0, 0.3);
  body.castShadow = cab.castShadow = true; g.add(body, cab); g.userData.body = body; return g;
}
const cars = [makeCar(), makeCar()]; cars.forEach((c) => { c.visible = false; scene.add(c); });

// ---------------------------------------------------------------- 状态
const state = {
  scene: 0, seed: 1, t: 0, dist: 0, camZ: 0, camX: 0, steer: 0, steerTarget: 0, speed: 1, speedTarget: 1,
  reveal: 1, phase: 'idle', pending: -1, autoT: 0, planeX: 0, planeVX: 0,
  keys: {}, mouse: null,
};

function applyScene(i) {
  state.scene = i; state.seed = (state.seed * 7 + 3) % 1000;
  state.dist = 0; state.camZ = 0;
  groundUniforms.uBiome.value = i;
  postMat.uniforms.uSeed.value = 1 + i * 13.7 + state.seed * 0.1;
  for (const [, c] of activeChunks) { world.remove(c.group); chunkPool.push(c); }
  activeChunks.clear();
  streamChunks();
  const cfg = SCENES[i], R = rng(i * 77 + state.seed);
  clouds.forEach((c, k) => {
    c.visible = k < cfg.clouds.count;
    const s = cfg.clouds.min + R() * (cfg.clouds.max - cfg.clouds.min);
    c.scale.set(s, s, s);
    c.position.set((R() * 2 - 1) * 330, 110 + R() * 50, (R() * 2 - 1) * 330);
    c.rotation.y = R() * 6;
  });
  cars.forEach((c, k) => {
    const d = cfg.cars[k]; c.visible = !!d; if (!d) return;
    c.userData.body.material.color.copy(sc(...d.color));
    c.userData.v = d.v; c.position.set(d.x, 0, (R() * 2 - 1) * 140); c.rotation.y = d.v > 0 ? Math.PI : 0;
  });
  document.getElementById('loc').textContent = cfg.name;
  document.getElementById('sub').textContent = cfg.sub;
  [...document.querySelectorAll('#dots i')].forEach((d, k) => d.classList.toggle('on', k === i));
}

function streamChunks() {
  const lo = Math.floor((state.camZ - 420) / CHUNK), hi = Math.floor((state.camZ + 420) / CHUNK);
  for (const [k, c] of activeChunks) if (k < lo || k > hi) { world.remove(c.group); chunkPool.push(c); activeChunks.delete(k); }
  for (let k = lo; k <= hi; k++) if (!activeChunks.has(k)) {
    const c = chunkPool.pop() || new Chunk();
    c.fill(k, state.scene, state.seed); world.add(c.group); activeChunks.set(k, c);
  }
}

function goTo(i) {
  i = (i + SCENES.length) % SCENES.length;
  if (state.phase !== 'idle') { state.pending = i; return; }
  state.pending = i; state.phase = 'out'; state.autoT = 0;
}

function update(dt) {
  dt = Math.min(dt, 0.1);
  state.t += dt;
  // 过渡
  if (state.phase === 'out') { state.reveal -= dt / 1.1; if (state.reveal <= 0) { state.reveal = 0; applyScene(state.pending); state.phase = 'in'; } }
  else if (state.phase === 'in') { state.reveal += dt / 1.6; if (state.reveal >= 1) { state.reveal = 1; state.phase = 'idle'; } }
  if (autoCycle && state.phase === 'idle') { state.autoT += dt; if (state.autoT > AUTO_SECONDS) goTo(state.scene + 1); }

  // 操控
  const k = state.keys;
  if (k.ArrowLeft) state.steerTarget -= 160 * dt;
  if (k.ArrowRight) state.steerTarget += 160 * dt;
  if (k.ArrowUp) state.speedTarget = Math.min(3, state.speedTarget + dt * 1.2);
  if (k.ArrowDown) state.speedTarget = Math.max(0.25, state.speedTarget - dt * 1.2);
  if (state.mouse !== null) state.steerTarget = state.mouse * 170;
  state.steerTarget = THREE.MathUtils.clamp(state.steerTarget, -180, 180);
  state.steer = damp(state.steer, state.steerTarget, 2.0, dt);
  state.camX = damp(state.camX, state.steer * 0.75, 0.9, dt);
  state.speed = damp(state.speed, state.speedTarget, 2, dt);

  const v = BASE_SPEED * state.speed;
  state.camZ -= v * dt; state.dist += v * dt;
  streamChunks();

  // 飞机：轻微左右摇摆 + 倾斜
  const t = state.t;
  const px = state.steer + 34 * Math.sin(t * 0.42) + 9 * Math.sin(t * 1.07 + 1.3);
  const vx = (px - state.planeX) / Math.max(dt, 1e-4);
  state.planeVX = damp(state.planeVX, vx, 4, dt); state.planeX = px;
  plane.position.set(px, 62, state.camZ + 62);
  plane.rotation.set(0.04 * Math.sin(t * 0.8), -state.planeVX * 0.006, -state.planeVX * 0.028, 'YXZ');

  // 云：随风漂移，离开画面后在前方重生
  const cfg = SCENES[state.scene];
  clouds.forEach((c, i) => {
    if (!c.visible) return;
    c.position.x += 2.5 * dt; c.position.z -= (3 + i % 3) * dt;
    if (c.position.z - state.camZ > 380) {
      const R = Math.random;
      c.position.set(state.camX + (R() * 2 - 1) * 330, 110 + R() * 50, state.camZ - 380 - R() * 120);
      const s = cfg.clouds.min + R() * (cfg.clouds.max - cfg.clouds.min); c.scale.set(s, s, s);
    }
  });
  cars.forEach((c) => {
    if (!c.visible) return;
    c.position.z += c.userData.v * dt;
    if (c.position.z - state.camZ > 320) c.position.z = state.camZ - 300 - Math.random() * 300;
    if (c.position.z - state.camZ < -700) c.position.z = state.camZ + 300;
  });

  // 相机与阴影相机（按纹素对齐防止闪烁）
  camera.position.set(state.camX, 600, state.camZ); camera.lookAt(state.camX, 0, state.camZ);
  const texel = 940 / 2048;
  const tx = Math.round(state.camX / texel) * texel, tz = Math.round(state.camZ / texel) * texel;
  sun.target.position.set(tx, 0, tz); sun.position.set(tx, 0, tz).addScaledVector(SUN_DIR, 600);

  groundUniforms.uTime.value = t;
  postMat.uniforms.uTime.value = t;
  postMat.uniforms.uReveal.value = state.phase === "in" ? easeInOut(state.reveal) : state.reveal;
  const ui = document.getElementById('ui'); ui.style.opacity = Math.min(1, state.reveal * 1.4);

  // 经纬度
  const lat = cfg.lat + state.dist * DEG_PER_UNIT;
  const lon = cfg.lon + state.camX * DEG_PER_UNIT / Math.cos(cfg.lat * Math.PI / 180) - state.dist * DEG_PER_UNIT * 0.12;
  coordEl.textContent = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
}
const easeInOut = (x) => x * x * (3 - 2 * x);
const coordEl = document.getElementById('coord');

function render() {
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}

// ---------------------------------------------------------------- 布局
const stage = document.getElementById('stage');
function layout() {
  const W = innerWidth, H = innerHeight, s = Math.min(W / 720, H / 720);
  const ox = W / 2 - 360 * s, oy = H / 2 - 360 * s;
  stage.style.transform = `translate(${ox - W / 2}px, ${oy - H / 2}px) scale(${s})`;
  const cw = RECT.w * s, ch = RECT.h * s;
  Object.assign(canvas.style, { left: `${ox + RECT.x * s}px`, top: `${oy + RECT.y * s}px`, width: `${cw}px`, height: `${ch}px` });
  const dpr = Math.min(window.devicePixelRatio || 1, 2, 1700 / cw);
  renderer.setPixelRatio(dpr); renderer.setSize(cw, ch, false);
  rt.setSize(Math.round(cw * dpr), Math.round(ch * dpr));
  postMat.uniforms.uRes.value.set(Math.round(cw * dpr), Math.round(ch * dpr));
  postMat.uniforms.uPaint.value = PAINT * Math.max(1, dpr * s * 0.75);
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- 交互
const dots = document.getElementById('dots');
SCENES.forEach((_, i) => { const d = document.createElement('i'); d.title = SCENES[i].name; d.onclick = () => goTo(i); dots.appendChild(d); });
document.getElementById('prev').onclick = () => goTo(state.scene - 1);
document.getElementById('next').onclick = () => goTo(state.scene + 1);
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '4') goTo(+e.key - 1);
  else if (e.key === ']' || e.key === 'n' || e.key === 'PageDown') goTo(state.scene + 1);
  else if (e.key === '[' || e.key === 'p' || e.key === 'PageUp') goTo(state.scene - 1);
  else if (e.key === ' ') { autoCycle = !autoCycle; state.autoT = 0; }
  else if (e.key === 'k') postMat.uniforms.uPaint.value = postMat.uniforms.uPaint.value > 0 ? 0 : PAINT;
  state.keys[e.key] = true;
  if (e.key.startsWith('Arrow')) { state.mouse = null; e.preventDefault(); }
});
addEventListener('keyup', (e) => { state.keys[e.key] = false; });
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect(); state.mouse = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
});
canvas.addEventListener('pointerleave', () => { state.mouse = null; state.steerTarget = 0; });

// ---------------------------------------------------------------- 启动
layout();
const startScene = params.has('scene') ? (parseInt(params.get('scene'), 10) - 1) % 4 : 0;
applyScene(startScene);
if (CAPTURE) {
  window.__step = (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) update(dt); render(); return state.camZ; };
  window.__goto = goTo;
  window.__scene = (i) => { applyScene(i); state.reveal = 1; state.phase = 'idle'; update(0.001); render(); };
  update(0.001); render(); window.__ready = true;
} else {
  let last = performance.now();
  renderer.setAnimationLoop((now) => { const dt = (now - last) / 1000; last = now; update(dt); render(); });
}
