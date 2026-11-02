import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundGLSL, postFrag } from './groundShader.js';
import { FEAT, fx, BLOCKED } from './layout.js';

// ---------------------------------------------------------------- 配置
const SCENES = [
  { name: 'Niigata, Japan', sub: 'Spring · sakura over flooded paddies', lat: 37.915, lon: 139.399,
    clouds: { count: 4, min: 0.5, max: 0.75 }, cars: [{ f: 'nRoad', o: -2.5, v: -14, color: [0.95, 0.95, 0.93] }], birds: { n: 7, color: [1, 1, 1] } },
  { name: 'La Pampa, Argentina', sub: 'Spring · open grassland', lat: -36.854, lon: -64.050,
    clouds: { count: 2, min: 0.8, max: 1.1 }, cars: [{ f: 'pRoad', o: 0, v: -12, color: [0.86, 0.18, 0.15] }], birds: { n: 9, color: [0.25, 0.22, 0.2] } },
  { name: 'Serengeti, Tanzania', sub: 'Dry season · long grass', lat: -2.502, lon: 35.041,
    clouds: { count: 3, min: 1.7, max: 2.3 }, cars: [{ f: 'sTrack', o: 0, v: -8, color: [0.55, 0.6, 0.42] }], birds: { n: 10, color: [0.22, 0.2, 0.18] } },
  { name: 'Punjab, India', sub: 'Late winter · mustard in flower', lat: 30.820, lon: 76.192,
    clouds: { count: 6, min: 0.65, max: 0.95 }, cars: [{ f: 'jRoad', o: -2.5, v: -16, color: [0.85, 0.2, 0.18] }, { f: 'jRoad', o: 2.5, v: 10, color: [0.95, 0.95, 0.92] }], birds: { n: 8, color: [0.95, 0.95, 0.95] } },
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
    uCam: { value: new THREE.Vector2() }, uTime: { value: 0 }, uReveal: { value: 1 }, uSeed: { value: 3.7 }, uPaint: { value: PAINT },
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
const blobMat = lowPoly();
const trunkGeo = new THREE.CylinderGeometry(0.55, 0.85, 1, 5).translate(0, 0.5, 0);
const trunkMat = lowPoly({ color: sc(0.42, 0.30, 0.20) });
const petalGeo = new THREE.CircleGeometry(0.95, 5).rotateX(-Math.PI / 2);
const petalMat = new THREE.MeshBasicMaterial();
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// 斑马：浅色身体 + 深色横纹（圆柱 UV 的 v 沿身体长度方向）
const stripeTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 20;
  const g = c.getContext('2d'); g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, 4, 20);
  g.fillStyle = '#4b4a52'; for (const y of [2, 6, 10, 14]) g.fillRect(0, y, 4, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; return t;
})();
function animalGeo(kind) {
  const parts = [];
  const L = kind === 'zebra' ? 8.6 : 7.0, Rr = kind === 'zebra' ? 2.4 : 2.0;
  const body = new THREE.CylinderGeometry(Rr, Rr, L, 7, 1).rotateX(Math.PI / 2).translate(0, Rr + 0.6, 0.4);
  parts.push(body.toNonIndexed());
  const head = new THREE.BoxGeometry(1.9, 1.8, 2.6);
  // 头部 UV 压到纹理的浅色区域
  const uv = head.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.97);
  head.translate(0, Rr + 1.0, -L / 2 - 0.6);
  parts.push(head.toNonIndexed());
  const g = mergeGeometries(parts); g.computeVertexNormals(); return g;
}
const zebraGeo = animalGeo('zebra'), cattleGeo = animalGeo('cattle');
const zebraMat = lowPoly({ map: stripeTex, emissive: sc(0.12, 0.12, 0.12) });
const cattleMat = lowPoly();
const houseMat = lowPoly();
const roofGeo = new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const pondMat = new THREE.MeshLambertMaterial({ color: sc(0.32, 0.64, 0.62) });
const pondRimMat = new THREE.MeshLambertMaterial({ color: sc(0.70, 0.52, 0.34) });

// ---------------------------------------------------------------- 区块
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
    const rr = r * (1 + 0.24 * Math.sin(3 * t + a) + 0.16 * Math.sin(5 * t + b)) + grow;
    i ? s.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : s.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

// 动物：每只记录 [x, z, 朝向, 目标朝向, 速度, 目标速度, 步伐相位, 计时器, 所属群, 缩放]
const AF = 10;
class Herd { constructor(x, z, h) { this.x = x; this.z = z; this.h = h; this.r = 45; } }

class Chunk {
  constructor() {
    this.group = new THREE.Group();
    this.ground = new THREE.Mesh(groundGeo, groundMat); this.ground.receiveShadow = true;
    this.blobs = makeInst(blobGeo, blobMat, 900);
    this.trunk = makeInst(trunkGeo, trunkMat, 200);
    this.petals = makeInst(petalGeo, petalMat, 2600, false);
    this.cattle = makeInst(cattleGeo, cattleMat, 220);
    this.zebra = makeInst(zebraGeo, zebraMat, 360);
    this.house = makeInst(boxGeo, houseMat, 12);
    this.roof = makeInst(roofGeo, houseMat, 12);
    this.fence = makeInst(boxGeo, houseMat, 60);
    this.ponds = [];
    this.anim = { cattle: new Float32Array(220 * AF), zebra: new Float32Array(360 * AF) };
    this.herds = [];
    this.group.add(this.ground, this.blobs, this.trunk, this.petals, this.cattle, this.zebra, this.house, this.roof, this.fence);
  }
  clearPonds() { for (const p of this.ponds) { this.group.remove(p); p.geometry.dispose(); } this.ponds = []; }
  fill(index, biome, seed) {
    this.index = index; this.biome = biome;
    const z0 = index * CHUNK, R = rng(index * 9973 + biome * 7919 + seed * 131 + 17);
    this.R = R;
    this.ground.position.set(0, 0, z0 + CHUNK / 2);
    this.clearPonds(); this.herds = [];
    const blocked = BLOCKED[biome];
    const free = (z, pad = 0, xr = XR) => { for (let k = 0; k < 40; k++) { const x = (R() * 2 - 1) * xr; if (!blocked(x - pad, z) && !blocked(x + pad, z) && !blocked(x, z)) return x; } return -420; };
    const n = { blobs: 0, trunk: 0, petals: 0, cattle: 0, zebra: 0, house: 0, roof: 0, fence: 0 };
    const put = (mesh, key, x, y, z, sx, sy, sz, color, ry = 0, rnd = false) => {
      if (n[key] >= mesh.instanceMatrix.count) return -1;
      dummy.position.set(x, y, z);
      if (rnd) dummy.rotation.set(R() * 6, R() * 6, R() * 6); else dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(n[key], dummy.matrix); mesh.setColorAt(n[key], color); return n[key]++;
    };
    // 树：树干 + 若干低多边形球团（flat < 1 时为金合欢式伞状树冠）
    const tree = (x, z, r, cols, { flat = 0.85, subs = 3, h = 0.9, spread = 0.6 } = {}) => {
      const cy = r * h;
      put(this.trunk, 'trunk', x, 0, z, r * 0.16, cy, r * 0.16, trunkMat.color, R() * 6);
      put(this.blobs, 'blobs', x, cy, z, r, r * flat, r, cols[0], 0, true);
      for (let k = 0; k < subs; k++) {
        const a = R() * 6.28, d = r * (spread * 0.7 + R() * spread * 0.6), rr = r * (0.5 + R() * 0.3);
        put(this.blobs, 'blobs', x + Math.cos(a) * d, cy + (R() - 0.2) * r * 0.35 * flat, z + Math.sin(a) * d, rr, rr * flat, rr, cols[1 + (k % (cols.length - 1))], 0, true);
      }
      // 顶部高光团
      put(this.blobs, 'blobs', x - r * 0.2, cy + r * 0.45 * flat, z - r * 0.2, r * 0.5, r * 0.5 * flat, r * 0.5, cols[cols.length - 1], 0, true);
    };
    const rz = () => z0 + R() * CHUNK;
    const addAnimal = (kind, x, z, h, herd, scale, color) => {
      const mesh = this[kind]; const i = put(mesh, kind, x, 0, z, scale, scale, scale, color, h);
      if (i < 0) return;
      const a = this.anim[kind], o = i * AF;
      a[o] = x; a[o + 1] = z; a[o + 2] = h; a[o + 3] = h; a[o + 4] = 0; a[o + 5] = 0;
      a[o + 6] = R() * 6.28; a[o + 7] = R() * 4; a[o + 8] = herd; a[o + 9] = scale;
    };

    if (biome === 0) {
      const pinks = [sc(0.97, 0.66, 0.76), sc(0.99, 0.76, 0.84), sc(0.93, 0.58, 0.70), sc(1, 0.86, 0.91)];
      const nt = 3 + Math.floor(R() * 3);
      for (let t = 0; t < nt; t++) {
        const cz = rz(), cx = free(cz, 14, 380); const grove = R() < 0.3 ? 3 + Math.floor(R() * 5) : 1;
        for (let g = 0; g < grove; g++) {
          const x = cx + (g ? gauss(R) * 48 : 0), z = cz + (g ? gauss(R) * 44 : 0);
          if (blocked(x, z)) continue;
          const r = 11 + R() * 5;
          tree(x, z, r, [pinks[Math.floor(R() * 3)], ...pinks], { flat: 0.85, subs: 4, h: 1.0, spread: 0.55 });
          for (let p = 0; p < 110; p++) {
            const a = R() * 6.28, d = r * 0.5 + Math.pow(R(), 1.3) * 34;
            const s = 0.7 + R() * 1.0;
            put(this.petals, 'petals', x + Math.cos(a) * d + 5, 0.3, z + Math.sin(a) * d * 0.9 + 5, s, 1, s,
              R() < 0.75 ? sc(1, 1, 1) : sc(1, 0.84, 0.9), R() * 3);
          }
        }
      }
    } else if (biome === 1) {
      const nh = R() < 0.85 ? 1 + (R() < 0.3 ? 1 : 0) : 0;
      for (let hI = 0; hI < nh; hI++) {
        const cz = rz(); let cx = THREE.MathUtils.clamp(free(cz, 30, 420) * 0.6, -240, 240); if (blocked(cx, cz)) cx = -250;
        const herd = new Herd(cx, cz, R() * 6.28); this.herds.push(herd);
        const m = 6 + Math.floor(R() * 8);
        for (let k = 0; k < m; k++) {
          const x = cx + gauss(R) * 62, z = cz + gauss(R) * 58; if (blocked(x, z)) continue;
          const c = R() < 0.7 ? sc(0.24, 0.16, 0.10) : R() < 0.5 ? sc(0.40, 0.27, 0.16) : sc(0.86, 0.82, 0.74);
          addAnimal('cattle', x, z, herd.h + gauss(R) * 1.5, this.herds.length - 1, 0.95 + R() * 0.15, c);
        }
      }
      for (let k = 0; k < 3; k++) { const z = rz(), x = free(z, 0, 380); if (R() < 0.6) addAnimal('cattle', x, z, R() * 6, -1, 1, sc(0.24, 0.16, 0.1)); }
      if (R() < 0.5) { const z = rz(), x = free(z, 8); tree(x, z, 7 + R() * 3, [sc(0.20, 0.42, 0.22), sc(0.26, 0.5, 0.25), sc(0.17, 0.36, 0.2), sc(0.34, 0.58, 0.3)]); }
    } else if (biome === 2) {
      const cl = 1 + Math.floor(R() * 2);
      for (let c = 0; c < cl; c++) {
        const cz = rz(), cx = free(cz, 20, 360); const herd = new Herd(cx, cz, R() * 6.28); herd.r = 75; this.herds.push(herd);
        const m = 6 + Math.floor(R() * 9);
        for (let k = 0; k < m; k++) {
          const x = cx + gauss(R) * 70, z = cz + gauss(R) * 60; if (blocked(x, z)) continue;
          const wild = R() < 0.1;
          addAnimal('zebra', x, z, herd.h + gauss(R) * 1.6, this.herds.length - 1, 0.95 + R() * 0.15, wild ? sc(0.42, 0.36, 0.32) : sc(1, 1, 1));
        }
      }
      for (let k = 0; k < 36; k++) { const z = rz(), x = free(z, 0, 400); addAnimal('zebra', x, z, R() * 6.28, -1, 0.95 + R() * 0.15, sc(1, 1, 1)); }
      if (R() < 0.75) {
        const z = rz(), x = free(z, 18, 360);
        tree(x, z, 14 + R() * 5, [sc(0.22, 0.46, 0.17), sc(0.30, 0.55, 0.21), sc(0.17, 0.38, 0.14), sc(0.40, 0.62, 0.26)], { flat: 0.45, subs: 5, h: 1.25, spread: 0.75 });
      }
      if (R() < 0.3) {
        const z = rz(), x = free(z, 30), r = 14 + R() * 9; const seedP = index * 31 + 5;
        const rim = new THREE.Mesh(pondGeo(rng(seedP), r, 4), pondRimMat), w = new THREE.Mesh(pondGeo(rng(seedP), r, 0), pondMat);
        rim.position.set(x, 0.05, z); w.position.set(x, 0.1, z); rim.receiveShadow = w.receiveShadow = true;
        this.ponds.push(rim, w); this.group.add(rim, w);
      }
    } else {
      const greens = [sc(0.16, 0.36, 0.22), sc(0.22, 0.45, 0.27), sc(0.13, 0.30, 0.19), sc(0.30, 0.54, 0.32)];
      if (R() < 0.65) {
        const cz = rz(), cx = free(cz, 25), m = 12 + Math.floor(R() * 14);
        for (let k = 0; k < m; k++) {
          const x = cx + gauss(R) * 45, z = cz + gauss(R) * 45; if (blocked(x, z)) continue;
          tree(x, z, 8 + R() * 4, [greens[Math.floor(R() * 3)], ...greens], { subs: 3, h: 1.0 });
        }
      }
      if (R() < 0.5) {
        const z = rz(), side = R() < 0.75 ? -1 : 1, x = fx(FEAT.jRoad, z) + side * (20 + R() * 22);
        const roofC = R() < 0.6 ? sc(0.86, 0.2, 0.2) : sc(0.25, 0.42, 0.85);
        put(this.house, 'house', x, 3, z, 8, 6, 9, sc(0.93, 0.88, 0.8));
        put(this.roof, 'roof', x, 6, z, 12, 4, 13, roofC);
        put(this.house, 'house', x + 7, 1.6, z + 2, 3.5, 3.2, 4, roofC);
        const W = 26, H = 22, fxx = x + 2, fz = z + 1, fc = sc(0.72, 0.6, 0.42);
        put(this.fence, 'fence', fxx, 0.7, fz - H / 2, W, 1.2, 0.5, fc); put(this.fence, 'fence', fxx, 0.7, fz + H / 2, W, 1.2, 0.5, fc);
        put(this.fence, 'fence', fxx - W / 2, 0.7, fz, 0.5, 1.2, H, fc); put(this.fence, 'fence', fxx + W / 2, 0.7, fz, 0.5, 1.2, H, fc);
        if (R() < 0.7) tree(fxx - W / 2 - 7, fz + 4, 7, [greens[1], ...greens]);
      }
      for (let k = 0; k < 3; k++) { const z = rz(), x = free(z); addAnimal('cattle', x, z, R() * 6, -1, 0.9, R() < 0.5 ? sc(0.25, 0.2, 0.18) : sc(0.38, 0.27, 0.2)); }
    }
    for (const k of Object.keys(n)) {
      const m = this[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  // 动物行为：吃草/慢走交替、转向、松散群聚、避开河流道路、走路时轻微起伏
  updateAnimals(dt, t) {
    const blocked = BLOCKED[this.biome];
    for (const h of this.herds) {
      h.h += (Math.sin(t * 0.13 + h.x * 0.01) * 0.12) * dt;
      const nx = h.x - Math.sin(h.h) * 1.1 * dt, nz = h.z - Math.cos(h.h) * 1.1 * dt;
      if (blocked(nx, nz)) h.h += Math.PI * 0.5 * dt * 4; else { h.x = nx; h.z = nz; }
    }
    for (const kind of ['cattle', 'zebra']) {
      const mesh = this[kind]; const cnt = mesh.count; if (!cnt) continue;
      const a = this.anim[kind]; const R = Math.random;
      for (let i = 0; i < cnt; i++) {
        const o = i * AF;
        let x = a[o], z = a[o + 1], h = a[o + 2];
        a[o + 7] -= dt;
        const herd = a[o + 8] >= 0 ? this.herds[a[o + 8]] : null;
        if (a[o + 7] <= 0) {
          const walk = R() < 0.55;
          a[o + 5] = walk ? 2.2 + R() * 3.2 : 0;
          a[o + 7] = walk ? 2 + R() * 4 : 1.5 + R() * 3.5;
          a[o + 3] = (herd ? herd.h : h) + (R() - 0.5) * 2.4;
          if (herd) {
            const dx = herd.x - x, dz = herd.z - z, d = Math.hypot(dx, dz);
            if (d > herd.r) { a[o + 3] = Math.atan2(-dx, -dz); a[o + 5] = 3 + R() * 2; }
          }
        }
        // 转向目标朝向
        let dh = a[o + 3] - h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        h += THREE.MathUtils.clamp(dh, -1.4 * dt, 1.4 * dt);
        a[o + 4] = damp(a[o + 4], a[o + 5], 3, dt);
        const sp = a[o + 4];
        const nx = x - Math.sin(h) * sp * dt, nz = z - Math.cos(h) * sp * dt;
        if (blocked(nx, nz)) { a[o + 3] = h + Math.PI; a[o + 5] = 1.5; } else { x = nx; z = nz; }
        a[o + 6] += dt * (sp * 2.2 + 0.6);
        const ph = a[o + 6], s = a[o + 9];
        const moving = Math.min(1, sp / 2);
        a[o] = x; a[o + 1] = z; a[o + 2] = h;
        dummy.position.set(x, Math.abs(Math.sin(ph)) * 0.45 * moving, z);
        // 吃草时低头（前倾），走路时左右轻摆
        dummy.rotation.set((1 - moving) * (0.12 + 0.06 * Math.sin(ph * 0.7)), h + Math.sin(ph) * 0.06 * moving, Math.sin(ph) * 0.05 * moving, 'YXZ');
        dummy.scale.set(s, s, s); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
const chunkPool = [], activeChunks = new Map();
const world = new THREE.Group(); scene.add(world);

// ---------------------------------------------------------------- 云：中心团 + 4~6 个圆瓣 + 外缘小鼓包，边缘做喷溅式虚化
function cloudGeo(seed) {
  const R = rng(seed), parts = [];
  const add = (r, x, y, z) => { const g = new THREE.IcosahedronGeometry(r, 3); g.translate(x, y, z); parts.push(g); };
  const C = 16 + R() * 4; add(C, 0, 0, 0);
  const n = 4 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.7, d = C * (0.8 + R() * 0.35), r = C * (0.55 + R() * 0.3);
    add(r, Math.cos(a) * d, (R() - 0.5) * 4, Math.sin(a) * d);
    for (let k = 0; k < 2; k++) {
      const a2 = a + (R() - 0.5) * 1.3, d2 = d + r * 0.55, r2 = r * (0.4 + R() * 0.2);
      add(r2, Math.cos(a2) * d2, -2, Math.sin(a2) * d2);
    }
  }
  const m = mergeGeometries(parts); m.scale(1, 0.55, 1); return m;
}
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: sc(0.40, 0.42, 0.46) });
cloudMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { float rim = 1. - abs(normal.z);
      float hn = fract(sin(dot(floor(gl_FragCoord.xy*.7), vec2(12.9898,78.233)))*43758.5453);
      if (rim > .80 + .2*hn) discard; }`);
};
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
  add(new THREE.BoxGeometry(30, 0.5, 3.6), 0, 0.2, -0.6);
  add(new THREE.BoxGeometry(10, 0.4, 2.4), 0, 0.6, 6.4);
  add(new THREE.BoxGeometry(0.4, 3.2, 2.6), 0, 2.0, 6.3);
  const g = mergeGeometries(parts); g.computeVertexNormals();
  const m = new THREE.Mesh(g, lowPoly({ color: 0xffffff, emissive: sc(0.22, 0.22, 0.24) }));
  m.castShadow = true;
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

// ---------------------------------------------------------------- 鸟群：扇动翅膀的 V 形小鸟
const birdGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.2, -4, 0.0, 0.8, 0, 0, 0.6, 0, 0, -1.2, 0, 0, 0.6, 4, 0.0, 0.8], 3));
  g.computeVertexNormals(); return g;
})();
const birdMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: sc(0.2, 0.2, 0.2) });
const birds = makeInst(birdGeo, birdMat, 16); scene.add(birds);
const birdState = [];
// ---------------------------------------------------------------- 状态
const state = {
  scene: 0, seed: 1, t: 0, dist: 0, camZ: 0, camX: 0, speed: 1, speedTarget: 1,
  reveal: 1, phase: 'idle', pending: -1, autoT: 0, planeX: 0, planeVX: 0,
  keys: {}, ptr: { x: 0, inside: false, last: -99 }, ctl: 0, off: 0, offV: 0, camVX: 0, yaw: 0, roll: 0, pitch: 0,
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
    c.userData.v = d.v; c.userData.f = FEAT[d.f]; c.userData.o = d.o;
    c.position.set(fx(FEAT[d.f], 0) + d.o, 0, (R() * 2 - 1) * 140);
  });
  // 鸟群
  birdState.length = 0;
  birdMat.color.copy(sc(...cfg.birds.color));
  const bx = (R() * 2 - 1) * 200, bz = -200 - R() * 100, bh = (R() - 0.5) * 1.2;
  for (let k = 0; k < cfg.birds.n; k++) {
    birdState.push({ x: bx + gauss(R) * 30, z: bz + gauss(R) * 30, y: 38 + R() * 10, h: bh + (R() - 0.5) * 0.3, ph: R() * 6.28, f: 7 + R() * 3 });
  }
  birds.count = birdState.length;
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
  const P = state.ptr;
  if (k.ArrowLeft || k.ArrowRight) { P.x = THREE.MathUtils.clamp(P.x + (k.ArrowRight ? 1.1 : -1.1) * dt, -1, 1); P.inside = true; P.last = state.t; }
  if (k.ArrowUp) state.speedTarget = Math.min(3, state.speedTarget + dt * 1.2);
  if (k.ArrowDown) state.speedTarget = Math.max(0.25, state.speedTarget - dt * 1.2);
  state.speed = damp(state.speed, state.speedTarget, 2, dt);

  const v = BASE_SPEED * state.speed;
  state.camZ -= v * dt; state.dist += v * dt;
  streamChunks();

  // 飞机操控：指针在画面上时飞向指针的水平位置；指针静止 2.5 秒或离开画面后切换为自动驾驶（不重复的漫游），两者平滑混合
  const t = state.t;
  const wantPtr = P.inside && t - P.last < IDLE_SECONDS ? 1 : 0;
  // 进入指针模式快一些，回到自动驾驶慢一些
  state.ctl = damp(state.ctl, wantPtr, wantPtr ? 2.2 : 0.7, dt);
  const w = state.ctl * state.ctl * (3 - 2 * state.ctl);
  const target = THREE.MathUtils.lerp(autopilot(t + state.seed * 37.1), P.x * 250, w);
  // 临界阻尼弹簧：位置、速度都连续，没有突变
  const om = 1.6;
  state.offV += (om * om * (target - state.off) - 2 * om * state.offV) * dt;
  state.off += state.offV * dt;
  // 镜头跟随飞机：飞机偏离中心越多，镜头横移越快（同样经过平滑）
  // 世界内容集中在 x≈0 附近，所以镜头横移有软边界：越靠边，向外的跟随越弱，并有轻微回中力
  let follow = state.off * 0.16;
  if (follow * state.camX > 0) follow *= Math.max(0, 1 - (state.camX / CAM_LIMIT) ** 2);
  state.camVX = damp(state.camVX, follow - state.camX * 0.02, 1.0, dt);
  state.camX += state.camVX * dt;
  const px = state.camX + state.off;
  const latV = state.camVX + state.offV;               // 世界坐标下的横向速度
  const yaw = THREE.MathUtils.clamp(-Math.atan2(latV, v) * 0.7, -0.7, 0.7);              // 机头指向实际航向（略收敛，避免横着飞）
  const yawRate = (yaw - state.yaw) / Math.max(dt, 1e-4); state.yaw = yaw;
  // 倾斜与转弯角速度成正比，并做缓动
  state.roll = damp(state.roll, THREE.MathUtils.clamp(yawRate * 1.3, -0.6, 0.6), 3.0, dt);
  state.pitch = damp(state.pitch, 0.04 * Math.sin(t * 0.8) - Math.abs(state.roll) * 0.08, 3, dt);
  state.planeX = px; state.planeVX = latV;
  plane.position.set(px, 62 + 1.2 * Math.sin(t * 0.9), state.camZ + 62);
  plane.rotation.set(state.pitch, yaw, state.roll, 'YXZ');

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
    const z = c.position.z, f = c.userData.f;
    c.position.x = fx(f, z) + c.userData.o;
    const slope = (fx(f, z - 1) - fx(f, z + 1)) / 2;
    c.rotation.y = (c.userData.v > 0 ? Math.PI : 0) + Math.atan(slope) * (c.userData.v > 0 ? -1 : 1);
  });
  // 动物
  for (const [, ch] of activeChunks) ch.updateAnimals(dt, t);
  // 鸟：成群缓慢飞行，扇翅；飞出画面后在前方重新出现
  let lag = 0;
  for (const b of birdState) lag = Math.max(lag, b.z - state.camZ);
  if (birdState.length && lag > 330) {
    const R = Math.random, bx = state.camX + (R() * 2 - 1) * 220, bz = state.camZ - 330 - R() * 200, bh = (R() - 0.5) * 1.2;
    for (const b of birdState) { b.x = bx + gauss(R) * 30; b.z = bz + gauss(R) * 30; b.h = bh + (R() - 0.5) * 0.3; }
  }
  birdState.forEach((b, i) => {
    b.h += Math.sin(t * 0.3 + i) * 0.05 * dt;
    b.x -= Math.sin(b.h) * 16 * dt; b.z -= Math.cos(b.h) * 16 * dt; b.ph += dt * b.f;
    const flap = Math.sin(b.ph);
    dummy.position.set(b.x, b.y + flap * 0.4, b.z);
    dummy.rotation.set(0, b.h, 0); dummy.scale.set(0.35 + 0.65 * Math.abs(flap), 1, 1); dummy.updateMatrix();
    birds.setMatrixAt(i, dummy.matrix);
  });
  birds.instanceMatrix.needsUpdate = true;

  // 相机与阴影相机（按纹素对齐防止闪烁）
  camera.position.set(state.camX, 600, state.camZ); camera.lookAt(state.camX, 0, state.camZ);
  const texel = 940 / 2048;
  const tx = Math.round(state.camX / texel) * texel, tz = Math.round(state.camZ / texel) * texel;
  sun.target.position.set(tx, 0, tz); sun.position.set(tx, 0, tz).addScaledVector(SUN_DIR, 600);

  groundUniforms.uTime.value = t;
  postMat.uniforms.uTime.value = t;
  postMat.uniforms.uCam.value.set(state.camX, state.camZ);
  postMat.uniforms.uReveal.value = state.phase === "in" ? easeInOut(state.reveal) : state.reveal;
  const ui = document.getElementById('ui'); ui.style.opacity = Math.min(1, state.reveal * 1.4);

  // 经纬度
  const lat = cfg.lat + state.dist * DEG_PER_UNIT;
  const lon = cfg.lon + state.camX * DEG_PER_UNIT / Math.cos(cfg.lat * Math.PI / 180) - state.dist * DEG_PER_UNIT * 0.12;
  coordEl.textContent = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
}
// 自动驾驶：几组频率互不成比例的正弦 + 一维平滑噪声，永不重复
const IDLE_SECONDS = 2.5, CAM_LIMIT = 170;
const h1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return THREE.MathUtils.lerp(h1(i), h1(i + 1), u) * 2 - 1; };
function autopilot(t) {
  return 70 * Math.sin(t * 0.173 + 0.4) + 45 * Math.sin(t * 0.2913 + 2.2) + 22 * Math.sin(t * 0.4571 + 4.1)
    + 60 * noise1(t * 0.09) + 25 * noise1(t * 0.23 + 17.3);
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
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { state.keys[e.key] = false; });
// 指针（鼠标/触摸）：只用水平位置；记录最后一次移动的时间，用来判断是否闲置
function setPointer(ndcX) {
  const P = state.ptr;
  if (ndcX === null) { P.inside = false; return; }
  P.x = THREE.MathUtils.clamp(ndcX, -1, 1); P.inside = true; P.last = state.t;
}
const ptrNdc = (e) => { const r = canvas.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 2 - 1; };
canvas.style.touchAction = 'none';
canvas.addEventListener('pointermove', (e) => setPointer(ptrNdc(e)));
canvas.addEventListener('pointerdown', (e) => setPointer(ptrNdc(e)));
canvas.addEventListener('pointerleave', () => setPointer(null));
canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setPointer(null); });

// ---------------------------------------------------------------- 启动
layout();
const startScene = params.has('scene') ? (parseInt(params.get('scene'), 10) - 1) % 4 : 0;
applyScene(startScene);
if (CAPTURE) {
  window.__step = (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) update(dt); render(); return state.camZ; };
  window.__goto = goTo;
  window.__pointer = setPointer;
  window.__state = () => state;
  window.__tick = (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) update(dt); };
  window.__count = () => { let tot = 0, vis = 0;
    for (const [, c] of activeChunks) for (const kind of ['cattle', 'zebra']) { const a = c.anim[kind];
      for (let i = 0; i < c[kind].count; i++) { tot++; if (Math.abs(a[i * AF] - state.camX) < 296 && Math.abs(a[i * AF + 1] - state.camZ) < 222) vis++; } }
    return { tot, vis }; };
  window.__dbg = () => [...activeChunks.values()].map((c) => [c.index, c.zebra.count, c.cattle.count, c.blobs.count, c.petals.count]);
  window.__scene = (i) => { applyScene(i); state.reveal = 1; state.phase = 'idle'; update(0.001); render(); };
  update(0.001); render(); window.__ready = true;
} else {
  let last = performance.now();
  renderer.setAnimationLoop((now) => { const dt = (now - last) / 1000; last = now; update(dt); render(); });
}
