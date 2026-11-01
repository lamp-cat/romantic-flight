#!/usr/bin/env bash
# 把原视频（左）与复刻版帧序列（右）拼成对照视频：shots/compare_sceneN.mp4 与 shots/compare_all.mp4
# 用法：scripts/compare.sh <原视频目录(v1..v4.mp4)> <帧目录(framesN/*.jpg)>
set -euo pipefail
REF=${1:-/workspace/xpost}; FR=${2:-/tmp/cmpv}; OUT=shots
FONT=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
LBL="fontfile=$FONT:fontsize=26:fontcolor=0x333333:box=1:boxcolor=white@0.85:boxborderw=8:x=(w-text_w)/2:y=20"
for i in 1 2 3 4; do
  ffmpeg -v error -y -ss 2 -t 15 -i "$REF/v$i.mp4" -framerate 30 -i "$FR/frames$i/%04d.jpg" -filter_complex \
    "[0:v]fps=30,scale=720:720,setsar=1,drawtext=text='原视频':$LBL[a];[1:v]scale=720:720,setsar=1,drawtext=text='复刻版':$LBL[b];[a][b]hstack=inputs=2,format=yuv420p[v]" \
    -map "[v]" -t 15 -c:v libx264 -crf 22 -preset slow -movflags +faststart "$OUT/compare_scene$i.mp4"
done
printf "file 'compare_scene%d.mp4'\n" 1 2 3 4 > "$OUT/.list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/.list.txt" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/compare_all.mp4"
rm "$OUT/.list.txt"
ls -la "$OUT"/compare_*.mp4
