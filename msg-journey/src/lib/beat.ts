import B from '../beats.json';
const DB: number[] = (B as {downbeats: number[]}).downbeats;
const BT: number[] = (B as {beats: number[]}).beats;
const nearest = (arr: number[], t: number) => { let best = t, d = Infinity; for (const x of arr) { const e = Math.abs(x - t); if (e < d) { d = e; best = x; } } return {best, d}; };
// Snap an absolute film time to the nearest downbeat (strong beat) if within `win` seconds.
export const snapDown = (t: number, win = 1.2) => { const n = nearest(DB, t); return n.d <= win ? n.best : t; };
export const snapBeat = (t: number, win = 0.35) => { const n = nearest(BT, t); return n.d <= win ? n.best : t; };
// 0..1 pulse that decays after every beat (for subtle beat-synced breathing).
export const beatPulse = (t: number, k = 6) => { let last = -1; for (const x of BT) { if (x <= t) last = x; else break; } return last < 0 ? 0 : Math.exp(-(t - last) * k); };
export const BEATS = BT;
export const GOLDEN = (B as {golden: number}).golden;
