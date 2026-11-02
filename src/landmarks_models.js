// 地标的程序化模型：全部在“局部坐标”里搭建（原点 = 地标中心，北 = -z），合并成少量带顶点色的网格。
import * as THREE from 'three';
import { L, SY_X } from './landmarks_layout.js';
import { V3, sc, rng, BOX, BEAM, BLOB, Builder, roofGeo, skirtGeo, C, hall, platform, wallRing, gallery, cornerTower, courtyard, fillCourts } from './lm/kit.js';
export { sc, Builder };


// ================================================================ 1 东京塔
function tokyoTower(B) {
  const H = 125, ORANGE = [0.94, 0.33, 0.13], WHITE = [0.97, 0.96, 0.93];
  const hw = (y) => (y <= H ? 2.4 + 19.6 * Math.pow(1 - y / H, 1.55) : 2.4 - 1.8 * (y - H) / 41);
  const bandC = (y) => {
    const bands = [[0, 58, ORANGE], [58, 66, WHITE], [66, 75, ORANGE], [75, 84, WHITE], [84, 95, ORANGE], [95, 103, WHITE], [103, 112, ORANGE],
      [112, 118, WHITE], [118, 126, ORANGE], [126, 136, WHITE], [136, 144, ORANGE], [144, 152, WHITE], [152, 159, ORANGE], [159, 167, WHITE]];
    for (const [a, b, c] of bands) if (y >= a && y < b) return c; return ORANGE;
  };
  const levels = [0, 6, 13, 20, 28, 36, 45, 54, 62, 70, 75, 84, 92, 100, 108, 116, 125, 136, 146, 156, 166];
  const P = (sx, sz, y) => new V3(sx * hw(y), y, sz * hw(y));
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1], col = bandC((y0 + y1) / 2), t = y0 < 75 ? 2.4 : y0 < 125 ? 1.8 : 1.1;
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      B.beam(P(ax, az, y0), P(ax, az, y1), t * 1.5, col);                         // 塔腿
      B.beam(P(ax, az, y1), P(bx, bz, y1), t * 0.8, bandC(y1 - 0.1));            // 横杆
      if (y0 < 125) { B.beam(P(ax, az, y0), P(bx, bz, y1), t * 0.7, col); B.beam(P(bx, bz, y0), P(ax, az, y1), t * 0.7, col); }
    }
    // 中线竖杆，让每个面更“实”
    if (y0 < 70) for (const [sx, sz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) B.beam(P(sx, sz, y0), P(sx, sz, y1), t * 0.7, col);
  }
  // 塔脚之间的拱
  for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
    for (let k = 0; k < 8; k++) {
      const u0 = k / 8, u1 = (k + 1) / 8, arch = (u) => 4 + 16 * Math.sin(Math.PI * u);
      const p0 = new V3((ax + (bx - ax) * u0) * hw(arch(u0)), arch(u0), (az + (bz - az) * u0) * hw(arch(u0)));
      const p1 = new V3((ax + (bx - ax) * u1) * hw(arch(u1)), arch(u1), (az + (bz - az) * u1) * hw(arch(u1)));
      B.beam(p0, p1, 2.2, ORANGE);
    }
  }
  // 大瞭望台（两层）与特别瞭望台
  B.box(0, 74, 0, 19, 4.2, 19, WHITE); B.box(0, 78.2, 0, 20, 2.4, 20, [0.34, 0.40, 0.48]); B.box(0, 80.6, 0, 17, 3, 17, WHITE);
  B.box(0, 82, 0, 21, 0.8, 21, [0.70, 0.72, 0.74]);
  B.box(0, 122, 0, 8, 2.5, 8, [0.38, 0.44, 0.52]); B.box(0, 124.5, 0, 8.4, 1.5, 8.4, WHITE);
  // 天线
  B.box(0, 125, 0, 2.6, 22, 2.6, ORANGE); B.box(0, 147, 0, 1.6, 10, 1.6, WHITE); B.box(0, 157, 0, 1.1, 9, 1.1, ORANGE);
  // 塔下的 FootTown（白色 4 层楼）
  B.box(0, 0, -3, 54, 10, 36, [0.93, 0.92, 0.90]); B.box(0, 10, -3, 50, 0.8, 32, [0.78, 0.80, 0.82]);
  B.box(0, 0, 15, 54, 1, 6, [0.70, 0.72, 0.76]);
}
function zojoji(B, R) {
  const DARK = [0.30, 0.33, 0.36], VERM = [0.80, 0.22, 0.14], WALL = [0.95, 0.93, 0.88];
  // 大殿（面向东）
  hall(B, { x: 118, z: 60, ry: Math.PI / 2, w: 40, d: 30, h: 9, roofH: 10, eaves: 2, roofC: DARK, wallC: VERM, beamC: [0.88, 0.70, 0.30], plinth: 2, plinthC: [0.78, 0.76, 0.72] });
  // 三解脱门（朱红二层楼门）
  hall(B, { x: 205, z: 60, ry: Math.PI / 2, w: 26, d: 12, h: 8, roofH: 6, eaves: 2, roofC: DARK, wallC: VERM, beamC: [0.90, 0.30, 0.18] });
  // 安国殿等配殿、钟楼
  hall(B, { x: 112, z: 32, ry: Math.PI / 2, w: 18, d: 13, h: 5, roofH: 5, roofC: DARK, wallC: WALL, beamC: VERM });
  hall(B, { x: 150, z: 34, w: 8, d: 8, h: 6, roofH: 4, ridge: 0, roofC: DARK, wallC: VERM });
  hall(B, { x: 98, z: 90, w: 22, d: 10, h: 4, roofH: 4, roofC: DARK, wallC: WALL, beamC: VERM });
  // 千体地藏：一排排红帽小石像（彩点）
  for (let i = 0; i < 60; i++) B.box(150 + (i % 15) * 2.2, 0, 86 + Math.floor(i / 15) * 2.4, 1.2, 1.4, 1.2, i % 3 ? [0.85, 0.25, 0.20] : [0.92, 0.90, 0.86]);
  // 石灯笼
  for (let k = 0; k < 6; k++) { B.box(150 + k * 9, 0, 52, 1.6, 3.2, 1.6, [0.70, 0.69, 0.66]); B.box(150 + k * 9, 0, 68, 1.6, 3.2, 1.6, [0.70, 0.69, 0.66]); }
}

// ================================================================ 2/3 北京中轴线
function beijingAxis(B) {
  const R = rng(20261102);
  const PINE = [[0.16, 0.34, 0.22], [0.20, 0.40, 0.25], [0.14, 0.30, 0.20]];
  // ---- 正阳门
  const zy = platform(B, { x: 0, z: 468, w: 48, d: 20, h: 8, col: [0.56, 0.54, 0.52], doors: [[0, 6, 5.5]] });
  hall(B, { x: 0, z: 468, y: zy, w: 34, d: 13, h: 6, roofH: 6, eaves: 2, roofC: [0.36, 0.46, 0.42], beamC: C.teal });
  // ---- 毛主席纪念堂
  B.box(0, 0, 368, 60, 1.5, 60, [0.86, 0.85, 0.82]); B.box(0, 1.5, 368, 54, 1.2, 54, [0.86, 0.85, 0.82]);
  B.box(0, 2.7, 368, 46, 13, 46, [0.92, 0.90, 0.84]);
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) { const t = -22 + i * 4.4; B.box(t, 2.7, 368 + s * 24, 1.4, 13, 1.4, [0.95, 0.94, 0.90]); B.box(368 * 0 + s * 24, 2.7, 368 + t, 1.4, 13, 1.4, [0.95, 0.94, 0.90]); }
  B.box(0, 15.7, 368, 52, 1.6, 52, [0.90, 0.72, 0.34]); B.box(0, 17.3, 368, 46, 1.4, 46, [0.90, 0.72, 0.34]); B.box(0, 18.7, 368, 40, 0.6, 40, [0.82, 0.80, 0.76]);
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, r = 44 + (i % 2) * 5; B.tree(Math.cos(a) * r * 0.9, 368 + Math.sin(a) * r, 4.2, PINE, 0, R); }
  // ---- 人民英雄纪念碑：两层须弥座台基 + 碑身 + 小庑殿顶
  B.box(0, 0, 240, 32, 1.4, 38, [0.86, 0.85, 0.82]); B.box(0, 1.4, 240, 24, 1.4, 29, [0.86, 0.85, 0.82]);
  B.box(0, 2.8, 240, 9, 3.4, 12, [0.76, 0.74, 0.70]);
  B.box(0, 6.2, 240, 4.6, 20, 6.4, [0.80, 0.78, 0.74]);
  B.box(0, 6.2, 236.75, 2.6, 15, 0.3, [0.88, 0.76, 0.40]);                                                       // 北面的镏金题字
  B.add(roofGeo(6, 7.8, 2.4, 1, 0.1), [0.84, 0.83, 0.80], { x: 0, y: 26.2, z: 240, ry: Math.PI / 2 });
  // 广场上的华灯：两侧各两列
  for (const sx of [-1, 1]) for (const cx of [60, 100]) for (let zz = 96; zz < 440; zz += 24) {
    if (Math.abs(zz - 240) < 30 || (zz > 330 && zz < 405 && cx === 60)) continue;
    B.box(sx * cx, 0, zz, 0.8, 8, 0.8, [0.50, 0.50, 0.54]); B.blob(sx * cx, 8.4, zz, 1.7, [0.98, 0.97, 0.92]);
  }
  // ---- 人民大会堂（西）与国家博物馆（东）
  const civic = (cx, face, w, d, h, col) => {
    const GOLD = [0.74, 0.66, 0.36], LITE = [0.94, 0.92, 0.86], fx = cx + face * w / 2;
    B.box(cx, 0, 240, w, h, d, col);
    B.box(cx, h, 240, w + 1.4, 1.6, d + 1.4, GOLD);
    B.box(cx - face * 4, h + 1.6, 240, w - 14, 3, d - 26, col); B.box(cx - face * 4, h + 4.6, 240, w - 13, 0.9, d - 25, GOLD);   // 退台的屋顶层
    B.box(cx - face * 6, h + 5.5, 240, w * 0.3, 0.4, d * 0.5, [0.62, 0.64, 0.60]);
    for (const s of [-1, 1]) { B.box(cx + face * 2, 0, 240 + s * (d / 2 - 12), w + 4, h + 3, 24, col); B.box(cx + face * 2, h + 3, 240 + s * (d / 2 - 12), w + 5, 1.2, 25, GOLD); } // 两端突出的翼楼
    for (let zz = 240 - d / 2 + 4; zz < 240 + d / 2 - 2; zz += 4.6) B.box(fx + face * 2.4, 1.2, zz, 0.8, h - 2.4, 1, LITE);  // 立面壁柱
    B.box(cx + face * 6, 0, 240, w * 0.5, h + 9, 64, col); B.box(cx + face * 6, h + 9, 240, w * 0.5 + 1.6, 1.8, 65.6, GOLD); // 中央高起的门厅
    B.box(cx + face * 6, h + 10.8, 240, w * 0.5 - 4, 2, 58, [0.84, 0.82, 0.76]);
    for (let i = 0; i < 12; i++) B.box(cx + face * (w / 2 + 6.5), 0, 240 - 30 + i * 5.45, 2, h + 7, 2, LITE);    // 柱廊
    B.box(cx + face * (w / 2 + 6.5), h + 7, 240, 5.6, 2, 66, col); B.box(cx + face * (w / 2 + 6.5), h + 9, 240, 6.4, 0.8, 67, GOLD);
    B.box(fx + face * 9.5, 0, 240, 6, 1.4, 70, [0.86, 0.85, 0.82]); B.box(fx + face * 12, 0, 240, 4, 0.7, 76, [0.86, 0.85, 0.82]);   // 台阶
  };
  civic(-178, 1, 82, 176, 20, [0.88, 0.82, 0.72]);
  civic(178, -1, 72, 152, 18, [0.86, 0.80, 0.70]);
  // ---- 广场花坛 + 中央巨型花篮
  { const FL = [[0.92, 0.24, 0.20], [0.98, 0.78, 0.22], [0.96, 0.50, 0.70], [0.98, 0.96, 0.92], [0.90, 0.40, 0.16]], GR = [0.30, 0.50, 0.26];
    for (const sx of [-1, 1]) for (const zz of [120, 168, 312, 420]) { B.box(sx * 80, 0, zz, 14, 0.9, 26, GR);
      for (let i = 0; i < 10; i++) B.blob(sx * 80 + (R() - 0.5) * 12, 1, zz + (R() - 0.5) * 24, 1.3, FL[i % FL.length], 0.5); }
    const bz = 150; B.cyl(0, 0, bz, 13, 14, 1.2, [0.30, 0.50, 0.26], 24); B.cyl(0, 1.2, bz, 7, 5, 6, [0.86, 0.64, 0.30], 16);
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = Math.sqrt(i / 40) * 9; B.blob(Math.cos(a) * r, 6 + (9 - r) * 0.7 + R() * 1.5, bz + Math.sin(a) * r, 2, FL[i % FL.length]); }
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283; B.blob(Math.cos(a) * 12, 1.4, bz + Math.sin(a) * 12, 1.4, FL[(i + 1) % FL.length], 0.6); }
    for (const sx of [-6, 6]) B.beam(new THREE.Vector3(sx, 7, bz), new THREE.Vector3(0, 20, bz), 0.5, [0.86, 0.64, 0.30]); }
  // ---- 国旗杆
  B.box(0, 0, 84, 5, 0.8, 5, [0.9, 0.88, 0.84]); B.box(0, 0.8, 84, 0.8, 30, 0.8, [0.96, 0.96, 0.96]);
  // ---- 金水桥 + 华表 + 天安门城楼 + 东西宫墙
  for (const [bx, bw] of [[0, 5], [-8, 3.6], [8, 3.6], [-15, 3.2], [15, 3.2]]) B.box(bx, 0, 15, bw, 0.9, 9, C.marble);
  for (const s of [-1, 1]) for (const zz of [26, -18]) { B.box(s * 20, 0, zz, 2.6, 1.4, 2.6, C.marble); B.box(s * 20, 1.4, zz, 1.2, 10, 1.2, C.marble); B.box(s * 20 - 1.6, 9, zz, 4.4, 0.6, 1, C.marble); }
  const ty = platform(B, { x: 0, z: 0, w: 66, d: 24, h: 12, doors: [[0, 5.4, 6.4], [-12, 4.4, 5.4], [12, 4.4, 5.4], [-22, 3.4, 4.4], [22, 3.4, 4.4]] });
  B.box(0, 7, 12.4, 4.2, 4.6, 0.4, [0.30, 0.26, 0.24]); B.box(0, 7.4, 12.65, 3.4, 3.8, 0.3, [0.82, 0.68, 0.54]);   // 城门上方的画像
  for (const s of [-1, 1]) B.box(s * 12, 7.6, 12.4, 9, 2.2, 0.3, [0.95, 0.92, 0.86]);                             // 两侧标语
  hall(B, { x: 0, z: 0, y: ty, w: 52, d: 17, h: 7, roofH: 8.5, eaves: 2, ridge: 0.85 });
  for (let i = 0; i < 9; i++) B.box(-24 + i * 6, ty, 9.4, 1, 7, 1, C.darkRed);                                    // 檐下的红柱
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) B.box(s * (6 + i * 3.4), ty, 12.8, 0.9, 0.9 + (i % 2) * 0.4, 0.9, [0.85, 0.20, 0.15]); // 观礼台上的红旗/灯笼
  for (const s of [-1, 1]) wallRing(B, s * 33, -1.5, s * 250, 1.5, 6.5, 3, C.red, C.yellow);
  // ---- 端门 + 两侧朝房
  const dy = platform(B, { x: 0, z: -132, w: 62, d: 22, h: 11, doors: [[0, 5, 6], [-12, 4, 5], [12, 4, 5]] });
  hall(B, { x: 0, z: -132, y: dy, w: 48, d: 16, h: 6.5, roofH: 8, eaves: 2, ridge: 0.85 });
  for (const s of [-1, 1]) { gallery(B, s * 30, -122, s * 37, -8); gallery(B, s * 30, -272, s * 37, -142); wallRing(B, s * 30, -2, s * 250, -0.5, 0, 0); }
  // ---- 太庙（东）与社稷坛（西）
  wallRing(B, 70, -226, 154, -78, 3, 1.4);
  hall(B, { x: 112, z: -168, w: 46, d: 20, h: 7, roofH: 8, eaves: 2, plinth: 2.4 });
  hall(B, { x: 112, z: -122, w: 30, d: 12, h: 5, roofH: 5, plinth: 1.5 });
  hall(B, { x: 112, z: -206, w: 30, d: 12, h: 5, roofH: 5, plinth: 1.5 });
  B.box(-110, 0, -160, 26, 1.6, 26, C.marble);
  const soil = [[0, 0, 0, [0.92, 0.78, 0.25]], [0, -1, 0, [0.20, 0.18, 0.18]], [1, 0, 0, [0.22, 0.50, 0.32]], [0, 1, 0, [0.80, 0.24, 0.18]], [-1, 0, 0, [0.95, 0.94, 0.90]]];
  for (const [ix, iz, , c] of soil) B.box(-110 + ix * 7, 1.6, -160 + iz * 7, ix || iz ? 6.6 : 7.4, 0.6, ix || iz ? 6.6 : 7.4, c);
  for (let k = 0; k < 4; k++) { const a = k * 1.571; B.box(-110 + Math.cos(a) * 19, 0, -160 + Math.sin(a) * 19, k % 2 ? 2 : 40, 2, k % 2 ? 40 : 2, [0.95, 0.94, 0.9]); }
  // ================= 紫禁城
  const WZ = -283, NZ = -763, EX = 188;
  // 宫墙 + 角楼
  wallRing(B, -EX, NZ, EX, WZ, 6.5, 5, C.red, [0.66, 0.30, 0.20], [{ horiz: true, at: WZ, from: -40, to: 40 }, { horiz: true, at: NZ, from: -22, to: 22 }]);
  for (const [x, z] of [[-EX, WZ], [EX, WZ], [-EX, NZ], [EX, NZ]]) cornerTower(B, x, z);
  // 午门：凹字形城台 + 正楼 + 雁翅楼 + 四座方亭
  B.box(0, 0, -282, 80, 10, 20, C.red); for (const s of [-1, 1]) B.box(s * 34, 0, -248, 12, 10, 50, C.red);
  B.box(0, 10, -282, 81, 0.8, 21, [0.88, 0.70, 0.30]); for (const s of [-1, 1]) B.box(s * 34, 10, -248, 13, 0.8, 51, [0.88, 0.70, 0.30]);
  for (const dx of [-12, 0, 12]) B.box(dx, 0, -272, dx ? 3.6 : 4.6, dx ? 4.4 : 5.4, 0.6, [0.18, 0.12, 0.10]);
  hall(B, { x: 0, z: -283, y: 10.8, w: 52, d: 16, h: 7, roofH: 8.5, eaves: 2, ridge: 0.85 });
  for (const s of [-1, 1]) {
    gallery(B, s * 30.5, -268, s * 37.5, -232, 3.4);
    for (const zz of [-276, -228]) hall(B, { x: s * 34, z: zz, y: 10.8, w: 11, d: 11, h: 4, roofH: 4.8, eaves: 2, ridge: 0 });
  }
  // 内金水桥
  for (const bx of [-16, -8, 0, 8, 16]) B.box(bx, 0, -330 + 16 * (1 - (bx / 70) ** 2), bx ? 3.2 : 4.4, 0.8, 9, C.marble);
  // 太和门 + 庭院四周庑房 + 体仁阁/弘义阁
  hall(B, { x: 0, z: -362, w: 44, d: 16, h: 6.5, roofH: 7.5, eaves: 2, plinth: 2.2 });
  for (const s of [-1, 1]) {
    hall(B, { x: s * 38, z: -362, w: 18, d: 10, h: 4.5, roofH: 4.6, plinth: 1.2 });
    gallery(B, s * 49, -365, s * 100, -359);
    gallery(B, s * 97, -575, s * 103, -372);
    hall(B, { x: s * 100, z: -470, ry: Math.PI / 2, w: 26, d: 12, h: 6, roofH: 6, eaves: 2, plinth: 1.5 });
    gallery(B, s * 40, -580, s * 100, -574);
  }
  // 三台（汉白玉三层台基，“土”字形）
  for (let k = 0; k < 3; k++) {
    const i = k * 3, y = k * 2.1;
    B.box(0, y, -506, 76 - i * 2, 2.1, 128 - i * 2, C.marble);
    B.box(0, y, -462, 100 - i * 2, 2.1, 36 - i * 2, C.marble);
    B.box(0, y + 2.1, -506, 76 - i * 2 + 0.6, 0.35, 128 - i * 2 + 0.6, [0.86, 0.85, 0.80]);
  }
  B.box(0, 0, -438, 14, 3.2, 12, C.marble);   // 御路丹陛
  // 太和殿（重檐庑殿，最大的黄顶）/ 中和殿（攒尖）/ 保和殿（重檐歇山）
  hall(B, { x: 0, z: -470, y: 6.3, w: 46, d: 24, h: 9, roofH: 10, eaves: 2, ridge: 1 });
  hall(B, { x: 0, z: -506, y: 6.3, w: 16, d: 16, h: 6, roofH: 6.5, ridge: 0 });
  hall(B, { x: 0, z: -540, y: 6.3, w: 38, d: 18, h: 7.5, roofH: 8, eaves: 2, ridge: 0.75 });
  // 乾清门 + 内廷（乾清宫、交泰殿、坤宁宫）
  hall(B, { x: 0, z: -592, w: 28, d: 10, h: 5, roofH: 5.5, plinth: 1.6 });
  for (const s of [-1, 1]) { gallery(B, s * 18, -595, s * 58, -589); gallery(B, s * 55, -688, s * 61, -598); }
  gallery(B, -58, -690, 58, -684);
  B.box(0, 0, -636, 44, 2.4, 74, C.marble);
  hall(B, { x: 0, z: -616, y: 2.4, w: 36, d: 18, h: 7.5, roofH: 8, eaves: 2 });
  hall(B, { x: 0, z: -640, y: 2.4, w: 12, d: 12, h: 4.5, roofH: 4.6, ridge: 0 });
  hall(B, { x: 0, z: -660, y: 2.4, w: 32, d: 15, h: 6.5, roofH: 7, eaves: 2 });
  // 御花园：古柏、亭子、钦安殿
  hall(B, { x: 0, z: -730, w: 22, d: 12, h: 5, roofH: 5.5, plinth: 1.4 });
  for (const s of [-1, 1]) { hall(B, { x: s * 30, z: -712, w: 9, d: 9, h: 3.4, roofH: 4.2, ridge: 0, roofC: [0.30, 0.56, 0.42] }); hall(B, { x: s * 44, z: -740, w: 10, d: 8, h: 3.4, roofH: 3.6 }); }
  for (let k = 0; k < 26; k++) { const x = (R() - 0.5) * 112, z = -700 - R() * 54; if (Math.abs(x) < 14 && z < -715) continue; B.tree(x, z, 3.6 + R() * 1.6, PINE, 0, R); }
  // 神武门
  const sy = platform(B, { x: 0, z: NZ, w: 44, d: 16, h: 8.5, doors: [[0, 4.6, 5]], doorFace: -1 });
  hall(B, { x: 0, z: NZ, y: sy, w: 36, d: 13, h: 5.6, roofH: 6.5, eaves: 2, ridge: 0.85 });
  // 东西华门
  for (const s of [-1, 1]) { const y = platform(B, { x: s * EX, z: -335, w: 14, d: 34, h: 8 }); hall(B, { x: s * EX, z: -335, y, ry: Math.PI / 2, w: 26, d: 10, h: 4.6, roofH: 5.5, eaves: 2 }); }
  // 文华殿（东）/ 武英殿（西）院落
  for (const s of [-1, 1]) {
    wallRing(B, s > 0 ? 112 : -172, -468, s > 0 ? 172 : -112, -384, 3, 1.2, C.red, C.yellow, [{ horiz: true, at: -384, from: s * 142 - 4, to: s * 142 + 4 }]);
    hall(B, { x: s * 142, z: -440, w: 30, d: 14, h: 5.5, roofH: 6, plinth: 1.6, eaves: s > 0 ? 1 : 1 });
    hall(B, { x: s * 142, z: -412, w: 22, d: 10, h: 4.2, roofH: 4.5, plinth: 1 });
  }
  // 东西两侧密集的宫院：东六宫/西六宫、宁寿宫、慈宁宫、南三所……
  for (const s of [-1, 1]) {
    const X = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    let [a, b] = X(66, 104); fillCourts(B, a, -700, b, -598, R, 19, 34);
    fillCourts(B, a, -588, b, -486, R, 19, 34);
    fillCourts(B, a, -756, b, -706, R, 19, 25);
    [a, b] = X(110, 182); fillCourts(B, a, -756, b, -478, R, 36, 40, true);
    [a, b] = X(110, 182); fillCourts(B, a, -376, b, -294, R, 24, 40);
    [a, b] = X(52, 92); fillCourts(B, a, -350, b, -298, R, 20, 26);
  }
  // ================= 景山：五亭（中间万春亭三重檐黄顶，两侧绿顶八角、蓝顶圆亭）
  const H = (x, z) => L.lmHeight(1, x, z - 200);
  const pav = [[0, 3, C.yellow, 13], [-34, 2, [0.24, 0.55, 0.40], 9], [34, 2, [0.24, 0.55, 0.40], 9], [-68, 1, [0.25, 0.42, 0.70], 7], [68, 1, [0.25, 0.42, 0.70], 7]];
  for (const [px, tiers, col, w] of pav) {
    const y = H(px, -905) - 0.6;
    B.box(px, y - 2, -905, w + 3, 2.6, w + 3, C.marble);
    let top = y + 0.6;
    for (let t = 0; t < tiers; t++) { const ww = w * (1 - t * 0.22); B.box(px, top, -905, ww * 0.7, 3.2, ww * 0.7, C.red); B.add(roofGeo(ww + 2, ww + 2, 2.8, 0), col, { x: px, y: top + 3, z: -905 }); top += 4.2; }
    B.add(BLOB, [0.95, 0.70, 0.18], { x: px, y: top + 0.4, z: -905, sx: 0.8, sy: 1.4, sz: 0.8 });
  }
  hall(B, { x: 0, z: -990, w: 34, d: 14, h: 5, roofH: 6, plinth: 1.2 });     // 寿皇殿
  // ================= 北海白塔（琼华岛）
  const by = L.lmHeight(1, -268, -905 - 200);
  B.box(-268, by - 1, -905, 12, 4, 12, C.marble); B.box(-268, by + 3, -905, 9, 3, 9, C.marble);
  B.add(new THREE.SphereGeometry(6.2, 14, 9), [0.97, 0.97, 0.95], { x: -268, y: by + 10, z: -905, sy: 1.1 });
  B.add(new THREE.CylinderGeometry(1.3, 2.6, 9, 10), [0.95, 0.95, 0.93], { x: -268, y: by + 20, z: -905 });
  B.add(new THREE.CylinderGeometry(2.6, 2.6, 0.8, 12), [0.88, 0.70, 0.30], { x: -268, y: by + 24.8, z: -905 });
  B.add(BLOB, [0.92, 0.72, 0.25], { x: -268, y: by + 26.4, z: -905, sx: 1.2, sy: 1.6, sz: 1.2 });
  hall(B, { x: -268, z: -878, y: L.lmHeight(1, -268, -878 - 200) - 0.5, w: 16, d: 8, h: 3.5, roofH: 3.8 });
}

// ================================================================ 4 悉尼
// 壳片：从后端 (u=0) 升起到开口 (u=1)，开口顶点略向前探出；返回壳面和开口处的玻璃幕墙
function shellGeo(L0, W, Hh, lean = 0.22) {
  const NU = 16, NV = 14, pos = [], glass = [];
  const P = (u, v) => {
    const w = W * Math.pow(u, 0.62), yr = Hh * Math.pow(Math.sin(u * Math.PI / 2), 1.25);
    const av = Math.abs(v), prof = 1 - Math.pow(av, 1.25);
    return [v * w, yr * prof, -L0 * u - lean * L0 * prof * u * u * u];
  };
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const u0 = i / NU, u1 = (i + 1) / NU, v0 = -1 + 2 * j / NV, v1 = -1 + 2 * (j + 1) / NV;
    const a = P(u0, v0), b = P(u0, v1), c = P(u1, v1), d = P(u1, v0);
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  // 开口玻璃：从开口弧到地面中线下方
  for (let j = 0; j < NV; j++) {
    const v0 = -1 + 2 * j / NV, v1 = -1 + 2 * (j + 1) / NV, a = P(1, v0), b = P(1, v1);
    const ga = [a[0] * 0.9, 0, -L0 * 0.88], gb = [b[0] * 0.9, 0, -L0 * 0.88];
    glass.push(...a, ...b, ...gb, ...a, ...gb, ...ga);
  }
  const mk = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  return [mk(pos), mk(glass)];
}
function operaHouse(B) {
  const PODIUM = [0.86, 0.74, 0.62], SHELL = [1.0, 1.0, 0.98], SHELL2 = [0.96, 0.96, 0.93], GLASS = [0.42, 0.36, 0.30];
  B.box(1, 0, -2, 62, 4.5, 96, PODIUM);
  B.box(1, 4.5, -2, 63, 0.5, 97, [0.80, 0.68, 0.56]);
  for (let k = 0; k < 6; k++) B.box(1, 0, 46 + k * 2.4, 56, 4.5 - k * 0.75, 2.4, [0.88, 0.78, 0.66]);     // 大台阶
  // 壳片：back = 后端 z，dir = -1 开口朝北 / +1 朝南；L 长度、W 半宽、H 高
  const sets = [
    // 音乐厅（西）：三片朝北开口的主壳（南高北低，层层相套）+ 一片朝南的小壳
    [-12, 22, -1, 36, 13.5, 33, SHELL], [-12, 3, -1, 32, 12.5, 27, SHELL], [-12, -15, -1, 28, 11, 21, SHELL2], [-12, 14, 1, 22, 11, 20, SHELL],
    // 歌剧厅（东，略小）
    [13, 20, -1, 33, 12, 30, SHELL], [13, 2, -1, 29, 11.5, 24, SHELL], [13, -14, -1, 26, 10, 19, SHELL2], [13, 12, 1, 20, 10, 18, SHELL],
    // 贝尼朗餐厅（西南角的两片小壳）
    [-22, 32, 1, 12, 7.5, 13, SHELL], [-22, 38, -1, 11, 6.5, 10, SHELL2],
  ];
  for (const [x, zb, dir, Ln, W, Hh, col] of sets) {
    const [s, g] = shellGeo(Ln * 1.08, W * 1.12, Hh);
    const ry = dir < 0 ? 0 : Math.PI;
    B.add(s, col, { x, y: 5, z: zb, ry, kind: 'shell' });
    B.add(g, GLASS, { x, y: 5, z: zb, ry });
  }
}
function harbourBridge(B) {
  const STEEL = [0.70, 0.72, 0.74], DARK = [0.52, 0.55, 0.58], GRANITE = [0.84, 0.76, 0.62];
  const o = new V3(-190, 0, -45), dir = new V3(0.259, 0, -0.966), side = new V3(0.966, 0, 0.259);
  const P = (al, y, ac) => o.clone().addScaledVector(dir, al).addScaledVector(side, ac).setY(y);
  const SPAN = 252, DECK = 25;
  // 桥面：引桥从两岸缓缓抬升
  const deckY = (al) => (al < 0 ? Math.max(4, DECK + al * 0.12) : al > SPAN ? Math.max(4, DECK - (al - SPAN) * 0.12) : DECK);
  for (let al = -150; al < SPAN + 150; al += 10) {
    const a = P(al, deckY(al), 0), b = P(al + 10, deckY(al + 10), 0);
    B.beam(a, b, 24, [0.38, 0.39, 0.42], 2.4);
    for (const s of [-1, 1]) B.beam(P(al, deckY(al) + 1.6, s * 11.5), P(al + 10, deckY(al + 10) + 1.6, s * 11.5), 0.8, DARK, 1.2);
    if ((al < 0 || al > SPAN) && Math.round(al) % 20 === 0) for (const s of [-1, 1]) B.beam(P(al, 0, s * 9), P(al, deckY(al) - 1, s * 9), 2.6, [0.78, 0.70, 0.58]);
  }
  // 塔门（四座花岗岩桥塔）
  for (const al of [-6, SPAN + 6]) for (const s of [-1, 1]) {
    const c = P(al, 0, s * 13);
    B.add(BOX, GRANITE, { x: c.x, y: 0, z: c.z, sx: 9, sy: 46, sz: 14, ry: Math.atan2(dir.x, dir.z) });
    B.add(BOX, [0.78, 0.70, 0.56], { x: c.x, y: 46, z: c.z, sx: 7, sy: 3, sz: 11, ry: Math.atan2(dir.x, dir.z) });
  }
  // 拱：上弦、下弦、竖杆与斜杆，两片拱架之间有横撑
  const top = (u) => 44 + 23 * Math.sin(Math.PI * u), bot = (u) => 4 + 58 * Math.sin(Math.PI * u) ** 0.9;
  const N = 28;
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, a0 = u0 * SPAN, a1 = u1 * SPAN, ac = s * 10.5;
      B.beam(P(a0, top(u0), ac), P(a1, top(u1), ac), 2.2, STEEL, 2.6);
      B.beam(P(a0, bot(u0), ac), P(a1, bot(u1), ac), 2.6, STEEL, 3.2);
      B.beam(P(a1, bot(u1), ac), P(a1, top(u1), ac), 1.1, STEEL);
      B.beam(P(a0, bot(u0), ac), P(a1, top(u1), ac), 0.9, DARK);
      // 吊杆
      if (bot(u1) > DECK + 3) B.beam(P(a1, bot(u1), ac), P(a1, DECK + 1, ac), 0.6, DARK);
    }
  }
  for (let i = 1; i < N; i += 2) { const u = i / N; B.beam(P(u * SPAN, top(u), -10.5), P(u * SPAN, top(u), 10.5), 1.2, DARK); }
  // 桥上的旗杆（拱顶两面旗）
  const tp = P(SPAN / 2, top(0.5), 0); B.box(tp.x - 2, tp.y, tp.z, 0.4, 8, 0.4, [0.9, 0.9, 0.9]); B.box(tp.x + 2, tp.y, tp.z, 0.4, 8, 0.4, [0.9, 0.9, 0.9]);
  B.box(tp.x - 3.2, tp.y + 6, tp.z, 2.4, 1.6, 0.2, [0.20, 0.25, 0.55]); B.box(tp.x + 0.8, tp.y + 6, tp.z, 2.4, 1.6, 0.2, [0.85, 0.30, 0.20]);
}
function circularQuay(B) {
  // 渡轮码头（5 座栈桥）+ 环形码头站与卡希尔高架
  for (let k = 0; k < 5; k++) {
    const x = -102 + k * 13;
    B.box(x, 0, 74, 7, 1.6, 18, [0.82, 0.74, 0.60]); B.box(x, 1.6, 70, 6, 3, 8, [0.92, 0.88, 0.70]);
    B.add(roofGeo(7.5, 9, 1.6, 1, 0.05), [0.30, 0.52, 0.42], { x, y: 4.6, z: 70, ry: Math.PI / 2 });
  }
  B.box(-72, 0, 103, 108, 7, 10, [0.70, 0.70, 0.70]); B.box(-72, 7, 103, 110, 1.4, 14, [0.58, 0.59, 0.62]);
  // 海外客运码头 + 停靠的邮轮
  B.box(-117, 0, -12, 12, 1.8, 120, [0.82, 0.78, 0.72]); B.box(-117, 1.8, 30, 10, 6, 40, [0.86, 0.86, 0.84]);
  const sx = -101, z0 = -52;
  B.box(sx, 0, z0, 15, 4, 130, [0.20, 0.24, 0.38]);
  B.box(sx, 4, z0, 15, 6, 128, [0.97, 0.97, 0.96]);
  for (let k = 0; k < 4; k++) B.box(sx, 10 + k * 2.4, z0 + 4 + k * 2, 13.5 - k * 1.2, 2.4, 108 - k * 12, k % 2 ? [0.90, 0.92, 0.94] : [0.98, 0.98, 0.97]);
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) B.box(sx + s * 7.8, 7, z0 - 40 + k * 10, 1, 1.6, 5, [0.96, 0.52, 0.18]);
  B.box(sx, 19.6, z0 + 14, 5, 2, 16, [0.40, 0.70, 0.86]);
  B.box(sx, 19.6, z0 - 28, 4, 6, 6, [0.92, 0.92, 0.92]); B.box(sx, 25.6, z0 - 28, 4.2, 1.4, 6.2, [0.20, 0.30, 0.55]);
  // 皇家植物园旁的政府大楼 + 丹尼森堡（海中小岛上的圆形炮台）
  B.add(new THREE.CylinderGeometry(6, 6.5, 5, 14), [0.84, 0.74, 0.58], { x: 182, y: 0, z: -168 });
  B.add(new THREE.CylinderGeometry(3.2, 3.6, 7, 12), [0.80, 0.70, 0.54], { x: 186, y: 0, z: -170 });
  B.box(178, 0, -164, 8, 3.4, 6, [0.84, 0.74, 0.58]);
}

export function buildMonument(b) {
  const B = new Builder();
  if (b === 0) { tokyoTower(B); zojoji(B); }
  else if (b === 3) {
    operaHouse(B); harbourBridge(B); circularQuay(B);
    // 悉尼按真实方位搭建，再整体旋转到“向西飞”的画面方向
    const outer = new THREE.Group(), inner = B.build();
    inner.rotation.y = -Math.PI / 2; inner.position.x = SY_X; outer.add(inner); return outer;
  } else beijingAxis(B);
  return B.build();
}
