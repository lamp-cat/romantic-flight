# Flyover · 低多边形俯瞰飞行

复刻 X 帖子 (notjignes/status/2113958988949942538) 里的效果：白色页面中央一块“撕纸/水彩笔触”边缘的画面，
正交俯视一片柔和、像手绘的低多边形大地，一直向北飞；中间一架白色小飞机轻轻左右摇摆，云朵在上方飘过并投下软阴影；
底部是极简的地名、季节/地貌和实时更新的经纬度。

## 四个场景
1. **Niigata, Japan** — Spring · sakura over flooded paddies（灌水稻田网格、直河、粉色樱花树和花瓣）
2. **La Pampa, Argentina** — Spring · open grassland（绿色草原、左侧土路+红色小车、右侧河流、牛群）
3. **Serengeti, Tanzania** — Dry season · long grass（金色稀树草原、土路、河、斑马群、绿树、水塘）
4. **Punjab, India** — Late winter · mustard in flower（黄色油菜花/绿色田块拼布、公路、河、树丛、带围栏的小房子、车）

## 运行
```bash
npm install
npm run dev        # 开发模式，浏览器打开提示的地址
npm run build      # 产物在 dist/，纯静态、无外部 CDN，可离线
npm run preview    # 预览构建结果
```

## 操作
- `←` / `→`：转向（飞机和镜头跟着平移）；鼠标在画面上左右移动也可以转向
- `↑` / `↓`：加速 / 减速
- `1`–`4`、`[` / `]`、底部 ‹ › 和圆点：切换场景
- 默认每 20 秒自动轮播（水彩晕开式过渡），`空格` 暂停/恢复自动轮播
- `k`：开/关轻度油画（Kuwahara）滤镜
- URL 参数：`?scene=3` 起始场景，`?auto=0` 关闭自动轮播，`?paint=0` 关闭油画滤镜

## 实现要点
- Three.js（npm + Vite）。`OrthographicCamera` 正上方俯视，每秒 27 个设计单位（从参考视频测得）。
- **无限区块流式加载**：每块 160 单位长，按镜头位置回收/复用（对象池），树、樱花、花瓣、动物、房子、围栏全部用 `InstancedMesh`。
- **地面**：`MeshLambertMaterial` + `onBeforeCompile` 注入程序化着色（`src/groundShader.js`），按世界坐标画稻田网格、河流、道路、
  Voronoi 田块等，所以区块之间无缝；带笔触噪声和每块颜色变化，并接收阴影。
- **阴影**：方向光 VSM 软阴影，阴影相机跟随镜头并按纹素对齐防闪烁；云、树、飞机、车都投影。
- **后期**（一个全屏 pass）：轻度 Kuwahara 油画滤镜 → 纸纹 + 动态胶片颗粒 → 圆角矩形 SDF + 多尺度噪声 + 飞白斑点做出撕纸边缘；
  切场景时同一张遮罩向内侵蚀再晕开。
- 经纬度：纬度随飞行距离增加（南半球数值随之减小），经度随转向偏移。

## 截图 / 录屏
```bash
npm run shots   # 无头 Chrome（SwiftShader 软件渲染）截 4 个场景 -> shots/scene1..4.png
npm run video   # 8 秒 demo -> shots/demo.mp4（需要 ffmpeg）
```
`shots/compare_sceneN.png` 左边是参考视频帧，右边是本实现。截图脚本默认用 `/usr/bin/google-chrome`，可用 `CHROME=...` 覆盖。
`?capture` 模式下关闭实时循环，由脚本调用 `window.__step(dt, n)` 逐帧推进，保证截图/录屏可复现。

## 目录
- `index.html`、`src/style.css`：页面与底部 UI
- `src/main.js`：场景、区块流式加载、物体生成、飞机/云/车、交互、后期
- `src/groundShader.js`：地面着色器和后期着色器
- `scripts/shoot.mjs`：截图和录屏脚本
