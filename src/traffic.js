// 道路车流 + 铁路列车。车辆沿 layout.js 中的蜿蜒道路行驶，列车每节车厢的前后转向架都落在铁轨曲线上（铰接）。
import * as THREE from 'three';
import { FEAT, fx } from './layout.js';

const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lowPoly = (o = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
const box = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
const mat = (c) => { const k = c.join(','); if (!matCache.has(k)) matCache.set(k, lowPoly({ color: sc(...c) })); return matCache.get(k); };
function part(g, c, sx, sy, sz, x, y, z, geo = box) {
  const m = new THREE.Mesh(geo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
// 朝向：模型默认车头朝 -z；沿 (dx, dz) 方向行驶时的 y 轴旋转
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);

// ---------------------------------------------------------------- 车辆模型
const GLASS = [0.82, 0.88, 0.94], DARK = [0.25, 0.24, 0.26];
const VEH = {
  car(c) {
    const g = new THREE.Group();
    part(g, c, 3.0, 1.4, 5.6, 0, 0.9, 0);
    part(g, GLASS, 2.5, 1.0, 2.6, 0, 2.05, 0.35);
    part(g, c, 2.3, 0.25, 2.1, 0, 2.6, 0.45);
    return Object.assign(g, { len: 5.6 });
  },
  truck(c) {          // 小卡车：驾驶室 + 货箱
    const g = new THREE.Group();
    part(g, c, 3.0, 2.2, 2.6, 0, 1.4, -3.0);
    part(g, GLASS, 2.6, 0.7, 0.3, 0, 2.0, -4.35);
    part(g, [0.93, 0.91, 0.86], 3.2, 2.8, 5.4, 0, 1.75, 1.2);
    part(g, DARK, 2.8, 0.5, 8.0, 0, 0.35, -0.5);
    return Object.assign(g, { len: 8.4 });
  },
  pickup(c) {
    const g = new THREE.Group();
    part(g, c, 3.0, 1.4, 6.4, 0, 0.9, 0);
    part(g, GLASS, 2.6, 1.1, 2.2, 0, 2.1, -0.9);
    part(g, [0.55, 0.45, 0.36], 2.4, 0.3, 2.6, 0, 1.7, 1.7);
    return Object.assign(g, { len: 6.4 });
  },
  bus(c) {
    const g = new THREE.Group();
    part(g, c, 3.4, 3.0, 11.5, 0, 1.8, 0);
    part(g, [0.96, 0.95, 0.92], 2.6, 0.3, 9.5, 0, 3.4, 0);
    part(g, GLASS, 3.0, 0.8, 0.3, 0, 2.4, -5.8);
    return Object.assign(g, { len: 11.5 });
  },
  jeep(c) {
    const g = new THREE.Group();
    part(g, c, 3.0, 1.7, 5.2, 0, 1.1, 0);
    part(g, [0.93, 0.89, 0.78], 2.8, 0.25, 3.2, 0, 2.9, 0.5);
    part(g, DARK, 0.2, 1.0, 0.2, 1.2, 2.3, 1.9); part(g, DARK, 0.2, 1.0, 0.2, -1.2, 2.3, 1.9);
    return Object.assign(g, { len: 5.2 });
  },
};
// 柔和但与浅色路面有足够对比的配色
const PASTEL = [[0.93, 0.50, 0.46], [0.96, 0.74, 0.30], [0.40, 0.66, 0.88], [0.40, 0.74, 0.62], [0.98, 0.97, 0.95],
  [0.70, 0.56, 0.86], [0.88, 0.32, 0.30], [0.34, 0.50, 0.80], [0.96, 0.60, 0.36]];
const INDIA = [[0.98, 0.62, 0.20], [0.92, 0.30, 0.30], [0.25, 0.62, 0.55], [0.98, 0.84, 0.25], [0.45, 0.50, 0.85], [0.98, 0.97, 0.94]];
const SAFARI = [[0.55, 0.56, 0.36], [0.45, 0.50, 0.32], [0.93, 0.90, 0.82]];

// 每个场景的车道：f 道路曲线、o 横向偏移、d 行驶方向（-1 向北，+1 向南）、n 窗口内车辆数、速度区间、车型权重、配色
const LANES = [
  [{ f: 'nRoad', o: -3.4, d: -1, n: 3, v: [14, 34], kinds: { car: 0.72, truck: 0.22, bus: 0.06 }, pal: PASTEL },
   { f: 'nRoad', o: 3.4, d: 1, n: 3, v: [12, 26], kinds: { car: 0.72, truck: 0.22, bus: 0.06 }, pal: PASTEL }],
  [{ f: 'pRoad', o: -1.8, d: -1, n: 1, v: [10, 18], kinds: { pickup: 0.6, car: 0.4 }, pal: PASTEL },
   { f: 'pRoad', o: 1.8, d: 1, n: 1, v: [8, 14], kinds: { pickup: 0.6, truck: 0.4 }, pal: PASTEL }],
  [{ f: 'sTrack', o: -1.2, d: -1, n: 1, v: [8, 12], kinds: { jeep: 1 }, pal: SAFARI },
   { f: 'sTrack', o: 1.2, d: 1, n: 1, v: [7, 10], kinds: { jeep: 1 }, pal: SAFARI }],
  [{ f: 'jRoad', o: -2.9, d: -1, n: 3, v: [14, 34], kinds: { car: 0.5, truck: 0.35, bus: 0.15 }, pal: INDIA },
   { f: 'jRoad', o: 2.9, d: 1, n: 3, v: [12, 26], kinds: { car: 0.5, truck: 0.35, bus: 0.15 }, pal: INDIA }],
];
const VSCALE = 2.0;        // 车辆整体放大，保证在油画滤镜后仍清晰可见
const WIN = 560;           // 镜头前后各 WIN 范围内维持车流

const pick = (R, w) => { let s = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { if ((s -= v) <= 0) return k; } return Object.keys(w)[0]; };

// 与地面着色器相同的哈希（逐步模拟 float32），用于找到旁遮普的支路位置
const f32 = Math.fround, fr = (x) => f32(x - Math.floor(x));
function h12(px, py) {
  let a = fr(f32(px * f32(0.1031))), b = fr(f32(py * f32(0.1031))), c = fr(f32(px * f32(0.1031)));
  const d = f32(f32(a * f32(b + 33.33)) + f32(b * f32(c + 33.33)) + f32(c * f32(a + 33.33)));
  a = f32(a + d); b = f32(b + d); c = f32(c + d);
  return fr(f32(f32(a + b) * c));
}
function punjabSideRoad(zi) {          // 返回该 420 段内的支路中心 zc，没有则 null
  if (h12(zi, 7) >= 0.7) return null;
  return zi * 420 + 80 + h12(zi, 1) * 260;
}
const sideZ = (zc, x, rc) => zc + (x - rc) * 0.08 - Math.sin(x * 0.012) * 6;

export class Traffic {
  constructor(scene) { this.scene = scene; this.vehicles = []; this.side = []; this.group = new THREE.Group(); scene.add(this.group); }
  clear() { for (const v of [...this.vehicles, ...this.side]) this.group.remove(v.mesh); this.vehicles = []; this.side = []; }
  make(R, lane) {
    const kind = pick(R, lane.kinds), col = lane.pal[Math.floor(R() * lane.pal.length)];
    const mesh = VEH[kind](col); mesh.scale.setScalar(VSCALE); mesh.len *= VSCALE; this.group.add(mesh); return mesh;
  }
  reset(biome, camZ, R) {
    this.clear(); this.biome = biome; this.R = R;
    LANES[biome].forEach((lane, li) => {
      for (let k = 0; k < lane.n; k++) {
        const mesh = this.make(R, lane);
        // 均匀分布在窗口里，带随机抖动，避免重叠
        const z = camZ - WIN + (k + 0.2 + R() * 0.6) * (2 * WIN / lane.n);
        const vd = lane.v[0] + R() * (lane.v[1] - lane.v[0]);
        this.vehicles.push({ mesh, lane, li, z, vd, v: vd });
      }
    });
    if (biome === 3) for (let k = 0; k < 2; k++) {
      const lane = { kinds: { car: 0.6, truck: 0.4 }, pal: INDIA };
      this.side.push({ mesh: this.make(R, lane), zi: null, x: 0, dir: 1, v: 9 + R() * 6, wait: R() * 3 });
    }
  }
  update(dt, camZ, camX) {
    const R = Math.random;
    // 跟车：同一车道按前进方向找前车，保持车距
    for (const a of this.vehicles) {
      let gap = Infinity, ahead = null;
      for (const b of this.vehicles) {
        if (b === a || b.li !== a.li) continue;
        const dz = (b.z - a.z) * a.lane.d;              // >0 表示 b 在 a 前方
        if (dz > 0 && dz < gap) { gap = dz; ahead = b; }
      }
      let target = a.vd;
      if (ahead) {
        const clear = gap - (a.mesh.len + ahead.mesh.len) / 2;
        if (clear < 22) target = Math.min(a.vd, Math.max(0, ahead.v * (clear - 5) / 12));
      }
      a.v += (target - a.v) * (1 - Math.exp(-2.5 * dt));
      a.z += a.lane.d * a.v * dt;
    }
    // 出窗口后在另一端重新出现（找一个不与他车重叠的位置）
    for (const a of this.vehicles) {
      const rel = a.z - camZ;
      if (rel > WIN || rel < -WIN - 260) {
        let z = rel > WIN ? camZ - WIN - R() * 200 : camZ + WIN - R() * 60;
        for (let tries = 0; tries < 8; tries++) {
          if (this.vehicles.every((b) => b === a || b.li !== a.li || Math.abs(b.z - z) > 30)) break;
          z += rel > WIN ? -40 : 40;
        }
        a.z = z; a.vd = a.lane.v[0] + R() * (a.lane.v[1] - a.lane.v[0]); a.v = a.vd;
      }
      const f = FEAT[a.lane.f], half = a.mesh.len * 0.4;
      // 前后轴都落在道路曲线上，得到正确的朝向
      const zf = a.z + a.lane.d * half, zb = a.z - a.lane.d * half;
      const xf = fx(f, zf) + a.lane.o, xb = fx(f, zb) + a.lane.o;
      a.mesh.position.set((xf + xb) / 2, 0, a.z);
      a.mesh.rotation.y = yawOf(xf - xb, zf - zb);
    }
    // 旁遮普支路上的车：从主路拐出向西开，或从西边开回主路
    for (const s of this.side) {
      if (s.zi === null) {
        s.mesh.visible = false; s.wait -= dt; if (s.wait > 0) continue;
        // 找镜头前方的一条支路
        const zi0 = Math.floor((camZ - 380) / 420);
        for (let zi = zi0; zi <= zi0 + 1; zi++) {
          const zc = punjabSideRoad(zi); if (zc === null || this.side.some((o) => o.zi === zi)) continue;
          if (zc > camZ - 200) continue;                   // 只选还没进画面的
          s.zi = zi; s.zc = zc; s.dir = R() < 0.5 ? -1 : 1; break;
        }
        if (s.zi === null) { s.wait = 1; continue; }
        const rc = fx(FEAT.jRoad, s.zc);
        s.x = s.dir < 0 ? rc - 8 : camX - 360; s.v = 8 + R() * 7;
      }
      const rc = fx(FEAT.jRoad, s.zc);
      s.x += s.dir * s.v * dt;
      const z = sideZ(s.zc, s.x, rc), zn = sideZ(s.zc, s.x + s.dir, rc);
      s.mesh.visible = true; s.mesh.position.set(s.x, 0, z); s.mesh.rotation.y = yawOf(s.dir, zn - z);
      if (s.x > rc - 6 || s.x < camX - 380 || z - camZ > WIN) { s.zi = null; s.wait = 2 + R() * 5; }
    }
  }
}

// ---------------------------------------------------------------- 列车
function noseGeo(L, W, H) {     // 车头：前 40% 收窄、压低的低多边形流线头
  const g = new THREE.BoxGeometry(W, H, L, 1, 1, 6); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / L;                          // -0.5（前）… 0.5（后）
    const t = THREE.MathUtils.clamp((-0.1 - z) / 0.4, 0, 1), e = t * t;
    p.setX(i, p.getX(i) * (1 - 0.62 * e));
    const y = p.getY(i); p.setY(i, y - (y + H / 2) * 0.6 * e);
  }
  g.translate(0, H / 2, 0); g.computeVertexNormals(); return g;
}
const TRAINS = {
  // 新潟：上越新干线风格，白车身 + 樱粉色车顶线
  shinkansen() {
    const cars = [], L = 32, W = 9.0, H = 6.0, n = 7;
    const nose = noseGeo(L, W, H), body = new THREE.BoxGeometry(W, H, L).translate(0, H / 2, 0);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(), end = i === 0 || i === n - 1;
      const m = new THREE.Mesh(end ? nose : body, mat([0.97, 0.97, 0.95])); m.castShadow = m.receiveShadow = true; g.add(m);
      if (end && i === n - 1) m.rotation.y = Math.PI;
      const s = end ? L * 0.55 : L * 0.92;
      part(g, [0.95, 0.60, 0.72], 1.1, 0.18, s, 0, H + 0.08, end ? (i === 0 ? L * 0.18 : -L * 0.18) : 0);
      part(g, [0.40, 0.62, 0.84], W + 0.08, 0.5, s, 0, H * 0.45, end ? (i === 0 ? L * 0.18 : -L * 0.18) : 0);
      if (i % 2 === 1) part(g, DARK, 1.6, 0.6, 2.2, 0, H + 0.3, L * 0.3);
      cars.push(Object.assign(g, { len: L }));
    }
    return { cars, gap: 1.2, v: [70, 90] };
  },
  // 旁遮普：红色机车 + 蓝色客车（其中一节栗色），车顶有奶油色条
  india() {
    const cars = [], H = 6.0, W = 9.0;
    const loco = new THREE.Group();
    part(loco, [0.86, 0.34, 0.26], W, H, 19, 0, H / 2, 0);
    part(loco, [0.99, 0.82, 0.32], W + 0.1, 0.8, 19.1, 0, H * 0.55, 0);
    part(loco, DARK, 2.4, 0.7, 5, 0, H + 0.3, 2.5); part(loco, DARK, 1.8, 0.5, 2, 0, H + 0.2, -5);
    part(loco, GLASS, W * 0.8, 1.2, 0.3, 0, H * 0.75, -9.55);
    cars.push(Object.assign(loco, { len: 19 }));
    const cols = [[0.40, 0.56, 0.82], [0.40, 0.56, 0.82], [0.66, 0.30, 0.28], [0.40, 0.56, 0.82], [0.40, 0.56, 0.82], [0.40, 0.56, 0.82]];
    for (const c of cols) {
      const g = new THREE.Group();
      part(g, c, W, H, 23, 0, H / 2, 0);
      part(g, [0.88, 0.88, 0.86], W * 0.7, 0.3, 22, 0, H + 0.15, 0);
      part(g, [0.97, 0.92, 0.78], W + 0.1, 0.6, 23.1, 0, H * 0.6, 0);
      cars.push(Object.assign(g, { len: 23 }));
    }
    return { cars, gap: 1.4, v: [38, 50] };
  },
};
const RAILS = { 0: { f: 'nRail', train: 'shinkansen' }, 3: { f: 'jRail', train: 'india' } };

export class Train {
  constructor(scene) { this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.cfg = null; }
  reset(biome, camZ, R, firstDelay = 1.0) {
    this.group.clear(); this.cfg = RAILS[biome] || null; if (!this.cfg) return;
    const t = TRAINS[this.cfg.train](); this.cars = t.cars; this.gapL = t.gap; this.vr = t.v;
    for (const c of this.cars) this.group.add(c);
    // 第一列总是南行（从画面上方迎面驶来，很快就能看到），之后上下行交替
    this.R = R; this.active = false; this.wait = firstDelay; this.dir = -1; this.group.visible = false;
  }
  get length() { return this.cars.reduce((s, c) => s + c.len + this.gapL, 0); }
  spawn(camZ) {
    this.dir = -this.dir;                                  // 上下行交替
    const R = this.R; this.v = this.vr[0] + R() * (this.vr[1] - this.vr[0]);
    // 南行：从画面上方进入；北行：从下方追上来（速度要比镜头快）
    if (this.dir < 0) this.v = Math.max(this.v, 27 + 40);
    this.head = this.dir > 0 ? camZ - 300 : camZ + 300;
    this.active = true; this.group.visible = true;
  }
  update(dt, camZ) {
    if (!this.cfg) return;
    if (!this.active) { this.wait -= dt; if (this.wait <= 0) this.spawn(camZ); else return; }
    this.head += this.dir * this.v * dt;
    const f = FEAT[this.cfg.f];
    let s = 0;
    for (const c of this.cars) {
      // 车厢中心沿轨道向后排；前后转向架分别取轨道上的点 → 每节车厢各自贴合曲线
      const zc = this.head - this.dir * (s + c.len / 2), h = c.len * 0.42;
      const zf = zc + this.dir * h, zb = zc - this.dir * h;
      const xf = fx(f, zf), xb = fx(f, zb);
      c.position.set((xf + xb) / 2, 0, zc);
      c.rotation.y = yawOf(xf - xb, zf - zb);
      s += c.len + this.gapL;
    }
    const tail = this.head - this.dir * s;
    const gone = this.dir > 0 ? tail - camZ > 320 : camZ - tail > 320 && this.head - camZ < -320;
    if (gone || Math.abs(this.head - camZ) > 2500) { this.active = false; this.group.visible = false; this.wait = 3 + this.R() * 5; }
  }
}
