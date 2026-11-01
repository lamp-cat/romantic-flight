// 用无头 Chrome（SwiftShader 软件 GL）截取 4 个场景，可选录制 demo 视频帧
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = +(process.env.PORT || 4179);
const url = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const exe = process.env.CHROME || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
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
  await browser.close(); server.kill();
}
