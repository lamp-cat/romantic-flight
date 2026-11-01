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
- **会动的动物**（第二版）：牛（La Pampa、Punjab）和斑马（Serengeti）每只都有独立状态——在“低头吃草”和“慢走”之间随机切换，
  平滑转向，走路时轻微上下起伏、左右摆；成群的动物围绕一个缓慢漂移的“群中心”松散聚集，掉队会走回去，并避开河流和道路。
  斑马是浅色身体加深色横纹（无 mipmap 的条纹贴图）。天上还有一小群扇翅的鸟。车沿蜿蜒的道路行驶并跟着转向。
- **更像原作的画风**（第二版）：地面加了方向变化的笔刷纹理；稻田按不规则大块划分、每块 5–8 条、颜色各异、田埂偏柔；
  道路、河流都按 `src/layout.js` 里的正弦叠加曲线蜿蜒（地面着色器和物体摆放共用同一套曲线）；
  云是中心团 + 圆瓣 + 小鼓包的“花朵”形，边缘做喷溅虚化；樱花树更大、带树干，花瓣更多更大；金合欢是扁伞状大树冠；
  撕纸边缘改成干笔飞白式喷点，并锚定在世界坐标上随飞行变化。

## 截图 / 录屏
```bash
npm run shots   # 无头 Chrome（SwiftShader 软件渲染）截 4 个场景 -> shots/scene1..4.png
npm run video   # 8 秒 demo -> shots/demo.mp4（需要 ffmpeg）
# 对照视频：每个场景 15 秒 30fps，左原视频右复刻版
for i in 1 2 3 4; do PORT=$((4190+i)) node scripts/shoot.mjs frames /tmp/cmpv $i 450 & done; wait
scripts/compare.sh /path/to/reference_videos /tmp/cmpv   # -> shots/compare_scene1..4.mp4、shots/compare_all.mp4
```
`shots/compare_sceneN.png` 左边是参考视频帧，右边是本实现。截图脚本默认用 `/usr/bin/google-chrome`，可用 `CHROME=...` 覆盖。
`?capture` 模式下关闭实时循环，由脚本调用 `window.__step(dt, n)` 逐帧推进，保证截图/录屏可复现。

## 目录
- `index.html`、`src/style.css`：页面与底部 UI
- `src/main.js`：场景、区块流式加载、物体生成、飞机/云/车、交互、后期
- `src/groundShader.js`：地面着色器和后期着色器
- `src/layout.js`：道路/河流蜿蜒曲线（JS 与 GLSL 共用）和“不可站立区域”
- `scripts/compare.sh`：拼接对照视频
- `scripts/shoot.mjs`：截图和录屏脚本
