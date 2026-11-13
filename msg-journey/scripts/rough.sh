#!/bin/bash
# Rough cut: 960x540, no MSAA/DOF, rendered in chunks then joined with the audio mix.
set -e
cd "$(dirname "$0")/.."
B=(0 30 60 90 120 150 180 205 228)
for i in $(seq 0 7); do
  f=out/rough/chunk_$i.mp4
  [ -f $f ] && continue
  node scripts/render.mjs $f --scale=0.5 --from=${B[$i]} --to=${B[$((i+1))]} --conc=4 --mute --q=m0,nodof 2>&1 | grep -E "done|Error|error" || true
  echo "chunk $i finished $(date +%T)"
done
node scripts/render.mjs out/rough/audio.wav --codec=wav 2>&1 | grep -E "done|rror" || true
printf "file 'chunk_%d.mp4'\n" 0 1 2 3 4 5 6 7 > out/rough/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/rough/list.txt -i out/rough/audio.wav -c:v copy -c:a aac -b:a 192k -shortest out/rough/rough_960x540.mp4
echo "ROUGH DONE"
