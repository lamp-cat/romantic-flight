// 用无头 Chrome（SwiftShader 软件 GL）截取 4 个场景，可选录制 demo 视频帧
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = +(process.env.PORT || 4179);
const url = `http://localhost:${PORT}/`;
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { server.kill(); } };
await new Promise((r) => setTimeout(r, 1500));
const exe = process.env.CHROME || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(+(process.env.TIMEOUT || 180000));
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const mode = process.argv[2] || 'shots';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });
try {
  if (mode === 'shots') {
    for (let i = 1; i <= 4; i++) {
      await page.goto(`${url}?capture&scene=${i}`);
      await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
      await page.evaluate(() => window.__step(1 / 30, 120));   // 飞 4 秒
      await page.screenshot({ path: `${out}/scene${i}.png` });
      console.log('shot', i);
    }
  } else if (mode === 'video') {
    const scene = process.argv[4] || '1';
    const fdir = `${out}/frames`; fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir);
    await page.goto(`${url}?capture&scene=${scene}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(() => window.__step(1 / 30, 30));
    const N = 240;
    for (let f = 0; f < N; f++) {
      await page.evaluate(() => window.__step(1 / 30, 1));
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.png` });
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${out}/demo.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('video done');
  } else if (mode === 'demo') {
    // 动物 + 操控演示：自动驾驶 → 指针接管（左右扫）→ 指针静止 2.5 秒后回到自动驾驶
    const scene = process.argv[4] || '3', N = 480, fdir = `${out}/demo_frames`;
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&scene=${scene}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(() => {
      const c = document.createElement('div'); c.id = 'fakecursor';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 13.8 L10.5 20 L13 19 L10.2 12.8 L16 12.6 Z" fill="#222" stroke="#fff" stroke-width="1.4"/></svg>';
      Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99, pointerEvents: 'none', opacity: 0, transition: 'none' });
      const t = document.createElement('div'); t.id = 'modetag';
      Object.assign(t.style, { position: 'fixed', left: '50%', top: '24px', transform: 'translateX(-50%)', zIndex: 99, font: '13px/1 system-ui, sans-serif',
        color: '#555', background: 'rgba(255,255,255,.85)', padding: '6px 10px', borderRadius: '12px', letterSpacing: '.03em' });
      document.body.append(c, t);
    });
    await page.evaluate(() => window.__step(1 / 30, 30));
    const ease = (x) => x * x * (3 - 2 * x);
    const script = (t) => {           // 返回 [指针 ndc 或 null, 光标透明度, 标签]
      if (t < 4) return [null, 0, 'autopilot · 自动驾驶'];
      if (t < 6) return [0.15 + 0.55 * ease((t - 4) / 2), Math.min(1, (t - 4) * 3), 'pointer · 跟随指针'];
      if (t < 7) return [0.7, 1, 'pointer · 跟随指针'];
      if (t < 9.5) return [0.7 - 1.3 * ease((t - 7) / 2.5), 1, 'pointer · 跟随指针'];
      if (t < 12) return ['idle', 1, 'pointer idle… · 指针静止'];
      return [null, Math.max(0, 1 - (t - 12) * 2), 'autopilot · 自动驾驶'];
    };
    for (let f = 0; f < N; f++) {
      const t = f / 30, [x, op, tag] = script(t);
      await page.evaluate(([x, op, tag]) => {
        if (typeof x === 'number') { window.__pointer(x); window.__lastX = x; }
        else if (x === null) window.__pointer(null);
        const r = document.getElementById('gl').getBoundingClientRect(), cx = window.__lastX ?? 0.15;
        const el = document.getElementById('fakecursor');
        el.style.opacity = op; el.style.transform = `translate(${r.left + (cx + 1) / 2 * r.width - 3}px, ${r.top + r.height * 0.62}px)`;
        document.getElementById('modetag').textContent = tag;
        window.__step(1 / 30, 1);
      }, [x, op, tag]);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (f % 60 === 0) console.log('demo frame', f);
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/demo_animals.mp4`);
    console.log('demo done');
  } else if (mode === 'traffic') {
    // 车流 + 列车演示：旁遮普（列车、车流、支路车辆、少量牛）→ 第 9.5 秒切到塞伦盖蒂（斑马群、越野车）
    const N = 480, fdir = `${out}/traffic_frames`;
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&scene=4`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    for (let f = 0; f < N; f++) {
      await page.evaluate((f) => { if (f === 285) window.__goto(2); window.__step(1 / 30, 1); }, f);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (f % 60 === 0) console.log('traffic frame', f);
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/demo_traffic.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('traffic done');
  } else if (mode === 'me-shots') {
    // 中土世界四个场景的截图 -> shots/me_scene1..4.png
    for (let i = 1; i <= 4; i++) {
      await page.goto(`${url}?capture&world=middleearth&scene=${i}`);
      await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
      await page.evaluate(() => window.__step(1 / 30, 120));
      await page.screenshot({ path: `${out}/me_scene${i}.png` });
      console.log('me shot', i);
    }
  } else if (mode === 'me-demo') {
    // 中土世界演示（约 16 秒）：洛汗（骑兵、王城）→ 魔多（熔岩、火山、黑塔、行军纵队）
    const N = 480, fdir = `${out}/me_frames`, start = process.argv[4] || '2', next = +(process.argv[5] || 3), at = +(process.argv[6] || 225);
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&world=middleearth&scene=${start}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
    for (let f = 0; f < N; f++) {
      await page.evaluate(([f, next, at]) => { if (f === at) window.__goto(next); window.__step(1 / 30, 1); }, [f, next, at]);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (f % 60 === 0) console.log('me frame', f);
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/demo_middleearth.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('me demo done');
  } else if (mode === 'me-tour') {
    // 中土世界 60 秒巡游：夏尔 → 洛汗 → 迷雾山脉/瑞文戴尔 → 魔多，每段约 15 秒，撕纸转场，全程自动驾驶
    // 每个场景应用时镜头回到 z=0，地标都放在 z≈-10…-190，所以每段 15 秒内都会从画面中经过
    const N = 1800, GO = { 435: 1, 885: 2, 1335: 3 }, dry = process.env.DRY === '1';
    const fdir = `${out}/tour_frames`;
    if (!dry) { fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true }); }
    await page.goto(`${url}?capture&world=middleearth&scene=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
    for (let f = 0; f < N; f++) {
      const st = await page.evaluate(([go, dry]) => {
        if (go !== undefined) window.__goto(go);
        if (go === 3) window.__clearSky(9);   // 最后一段：别让云在结尾盖住飞机
        if (dry) window.__tick(1 / 30, 1); else window.__step(1 / 30, 1);
        const s = window.__state(); return { scene: s.scene, camX: s.camX, camZ: s.camZ, px: s.planeX };
      }, [GO[f], dry]);
      if (!dry) await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      if (f % 30 === 0) console.log('tour', (f / 30).toFixed(0) + 's', JSON.stringify(st));
    }
    if (!dry) {
      execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf ${process.env.CRF || 23} -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/me_tour_60s.mp4`);
      fs.rmSync(fdir, { recursive: true, force: true });
    }
    console.log('me tour done');
  } else if (mode === 'lm-shots') {
    // 地标世界 14 个场景的截图 -> shots/lm_scene1..14.png（SCENES=1,3 只拍部分；STEPS 改变飞行帧数）
    const list = (process.env.SCENES || Array.from({ length: 14 }, (_, i) => i + 1).join(',')).split(',').map(Number), steps = +(process.env.STEPS || 120);
    for (const i of list) {
      await page.goto(`${url}?capture&world=landmarks&scene=${i}`);
      await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
      await page.evaluate((n) => window.__step(1 / 30, n), steps);
      await page.screenshot({ path: `${out}/lm_scene${i}${process.env.SUFFIX || ''}.png` });
      console.log('lm shot', i);
    }
  } else if (mode === 'lm-demo') {
    // 地标巡游（约 30 秒，720x720）：东京塔 → 天安门 → 故宫 → 悉尼歌剧院，每段约 7.5 秒，撕纸转场，全程自动驾驶
    const N = +(process.env.FRAMES || 900), GO = { 210: 1, 435: 2, 660: 3 };
    const fdir = `${out}/lm_frames`;
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&world=landmarks&scene=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.evaluate(() => window.__clearSky(9));
    for (let f = 0; f < N; f++) {
      await page.evaluate((go) => { if (go !== undefined) window.__goto(go); window.__step(1 / 30, 1); }, GO[f]);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (f % 60 === 0) console.log('lm frame', f);
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf ${process.env.CRF || 21} -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/demo_landmarks.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('lm demo done');
  } else if (mode === 'lm-tour') {
    // 地标全巡游（720x720，30 fps）：14 个场景各约 4.6 秒（PER 帧），撕纸转场，全程自动驾驶；CRF 控制体积（<15 MB）
    const S = +(process.env.NSCENES || 14), PER = +(process.env.PER || 138), N = S * PER;
    const fdir = `${out}/lm_tour_frames`;
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&world=landmarks&scene=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.evaluate(() => window.__clearSky(9));
    for (let f = 0; f < N; f++) {
      const go = f > 0 && f % PER === 0 ? f / PER : undefined;
      await page.evaluate((g) => { if (g !== undefined) window.__goto(g); window.__step(1 / 30, 1); }, go);
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      if (f % 60 === 0) console.log('lm tour frame', f, '/', N);
    }
    execSync(`ffmpeg -v error -y -framerate 30 -i ${fdir}/%04d.jpg -c:v libx264 -crf ${process.env.CRF || 27} -preset slow -pix_fmt yuv420p -movflags +faststart ${out}/tour_landmarks.mp4`);
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log('lm tour done');
  } else if (mode === 'frames') {
    // 对照视频用：逐帧 JPEG（30 fps），由 scripts/compare.sh 与原视频拼接
    const scene = process.argv[4] || '1', N = +(process.argv[5] || 450);
    const fdir = `${out}/frames${scene}`; fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    await page.goto(`${url}?capture&scene=${scene}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(() => window.__step(1 / 30, 30));
    for (let f = 0; f < N; f++) {
      await page.evaluate(() => window.__step(1 / 30, 1));
      await page.screenshot({ path: `${fdir}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (f % 50 === 0) console.log('scene', scene, 'frame', f);
    }
    console.log('frames done', scene);
  }
} finally {
  await browser.close(); stopServer();
}
