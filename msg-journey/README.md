# 你发的一条消息都经历了什么 — vibe知识大赏

Remotion + react-three-fiber + postprocessing。所有动画都是时间 t 的确定函数，可以单帧重渲。

```bash
npm install
node scripts/stills.mjs name:秒数 ...      # 渲染 1080p 关键帧到 out/stills/
python3 scripts/beats.py                   # BGM 0.9× 变速 + 节拍检测 → data/beats.json
```
