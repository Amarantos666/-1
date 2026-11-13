// Exports subtitles (SRT) and the shot/timecode table from the beat-snapped timeline.
import {SHOTS} from '../src/timeline';
import * as fs from 'node:fs';
const tc = (s: number, srt = true) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000; const p = (n: number, w = 2) => String(n).padStart(w, '0'); return srt ? `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}` : `${p(m)}:${p(sec)}.${p(Math.floor(r / 10))}`; };
let n = 1; const srt: string[] = [];
for (const s of SHOTS) for (const c of s.cues) {
  const a = s.from + c.from, b = s.from + Math.min(c.to, s.to - s.from - 0.12);
  srt.push(`${n++}\n${tc(a)} --> ${tc(b)}\n${c.zh}\n${c.en}\n`);
}
srt.push(`${n++}\n${tc(214.6)} --> ${tc(219.2)}\n同样是按下回车——一条被送达，一条被读懂。然后，被忘记。\nSame Enter key — one delivered, one understood. And then, forgotten.\n`);
fs.writeFileSync('subs.srt', srt.join('\n'));
const rows = SHOTS.map((s) => `| ${s.id} | ${tc(s.from, false)} | ${tc(s.to, false)} | ${(s.to - s.from).toFixed(2)} s | ${s.chapter} | ${s.cues.map((c) => c.zh).join(' / ') || '—'} | ${s.note ?? '—'} |`);
fs.writeFileSync('SHOTLIST.md', `# 分镜时间码表\n\n镜头边界已对齐 BGM（0.9× 变速后）重拍。\n\n| 镜头 | 入点 | 出点 | 时长 | 章节 | 字幕 | 注释条 |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
// Motion-blur windows (fast motion): every shot boundary +-0.4 s plus fast-moving moments.
const at = (id: string, a: number, b: number): [number, number] => { const x = SHOTS.find((q) => q.id === id)!; return [x.from + a, Math.min(x.to, x.from + b)]; };
const win: [number, number][] = SHOTS.slice(1).map((x) => [x.from - 0.45, x.from + 0.45]);
win.push(at('O1', 8.6, 12.5), at('A2', 2.2, 7.0), at('A4', 4.5, 9), at('A5', 0, 3.4), at('BR', 0, 6), at('B3', 0, 10), at('B5', 7.0, 12.4), at('F1', 2.3, 5.2), at('C1', 7.5, 10.8));
win.sort((a, b) => a[0] - b[0]);
const merged: [number, number][] = [];
for (const w of win) { const fr: [number, number] = [Math.max(0, Math.floor(w[0] * 30)), Math.min(6840, Math.ceil(w[1] * 30))]; const l = merged[merged.length - 1]; if (l && fr[0] <= l[1] + 15) l[1] = Math.max(l[1], fr[1]); else merged.push(fr); }
const segs: {f0: number; f1: number; blur: boolean}[] = []; let cur = 0;
for (const [a, b] of merged) { if (a > cur) segs.push({f0: cur, f1: a, blur: false}); segs.push({f0: a, f1: b, blur: true}); cur = b; }
if (cur < 6840) segs.push({f0: cur, f1: 6840, blur: false});
fs.writeFileSync('out/segments.json', JSON.stringify(segs));
console.log('blur frames', segs.filter((x) => x.blur).reduce((a, x) => a + x.f1 - x.f0, 0), 'segments', segs.length);
console.log('srt cues', n - 1, 'shots', SHOTS.length);
