import * as THREE from 'three';
import {mulberry32} from './math';
import {FONT_ZH, FONT_EN, FONT_MONO} from '../theme';

export const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

export const toTex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

// Procedural "photo": sunset gradient, sun, layered mountain silhouettes, water reflection.
const photoCache = new Map<string, HTMLCanvasElement>();
export function drawPhoto(w = 768, h = 512, blur = 0): HTMLCanvasElement {
  const key = `${w}x${h}`;
  let base = photoCache.get(key);
  if (!base) {
    base = mkCanvas(w, h);
    const g = base.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#1b1446'); sky.addColorStop(0.35, '#6a2c7a'); sky.addColorStop(0.62, '#e2566a');
    sky.addColorStop(0.85, '#ff9a4a'); sky.addColorStop(1, '#ffd27a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // sun
    const sx = w * 0.62, sy = h * 0.52, sr = h * 0.12;
    const halo = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 4);
    halo.addColorStop(0, 'rgba(255,240,190,0.9)'); halo.addColorStop(0.3, 'rgba(255,170,90,0.35)'); halo.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // thin clouds
    const r = mulberry32(7);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(255,${150 + r() * 60},${120 + r() * 40},${0.12 + r() * 0.12})`;
      const cy = h * (0.12 + r() * 0.3); const cx = r() * w; const cw = w * (0.2 + r() * 0.35);
      g.beginPath(); g.ellipse(cx, cy, cw, h * 0.012 + r() * h * 0.01, 0, 0, Math.PI * 2); g.fill();
    }
    // mountains (3 layers)
    const layers = [
      {base: 0.6, amp: 0.2, col: '#3b1d4f', seed: 3},
      {base: 0.64, amp: 0.15, col: '#26133a', seed: 11},
      {base: 0.68, amp: 0.1, col: '#140b24', seed: 23},
    ];
    for (const L of layers) {
      const rr = mulberry32(L.seed);
      g.fillStyle = L.col; g.beginPath(); g.moveTo(0, h);
      let y = h * L.base;
      const peaks = 7;
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * w;
        y = h * (L.base - rr() * L.amp);
        g.lineTo(x - w / peaks / 2, h * (L.base - rr() * L.amp * 0.3));
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    // water
    const wy = h * 0.7;
    const wat = g.createLinearGradient(0, wy, 0, h);
    wat.addColorStop(0, '#2a1640'); wat.addColorStop(1, '#0c0818');
    g.fillStyle = wat; g.fillRect(0, wy, w, h - wy);
    for (let i = 0; i < 26; i++) {
      const yy = wy + (i / 26) * (h - wy);
      const ww = (w * 0.18) * (1 - i / 30);
      g.fillStyle = `rgba(255,${200 - i * 3},${130 - i * 2},${0.55 - i * 0.018})`;
      g.fillRect(sx - ww / 2 + Math.sin(i * 1.7) * 10, yy, ww, 2.2);
    }
    photoCache.set(key, base);
  }
  if (!blur) return base;
  const c = mkCanvas(w, h);
  const g = c.getContext('2d')!;
  g.filter = `blur(${blur}px)`;
  g.drawImage(base, 0, 0);
  return c;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export type LabelOpts = {
  text: string; sub?: string; color?: string; subColor?: string; size?: number; subSize?: number;
  font?: 'zh' | 'en' | 'mono'; weight?: number; pad?: number; bg?: string; border?: string; w?: number; h?: number; align?: CanvasTextAlign;
};
// Text label texture (two lines: main + optional sub). Returns texture and aspect.
export function labelTexture(o: LabelOpts) {
  const size = o.size ?? 64, sub = o.subSize ?? Math.round(size * 0.45), pad = o.pad ?? 24;
  const fam = o.font === 'mono' ? FONT_MONO : o.font === 'en' ? FONT_EN : FONT_ZH;
  const meas = mkCanvas(8, 8).getContext('2d')!;
  meas.font = `${o.weight ?? 700} ${size}px ${fam}`;
  const w1 = meas.measureText(o.text).width;
  meas.font = `500 ${sub}px ${FONT_EN}`;
  const w2 = o.sub ? meas.measureText(o.sub).width : 0;
  const W = o.w ?? Math.ceil(Math.max(w1, w2) + pad * 2);
  const H = o.h ?? Math.ceil(size * 1.25 + (o.sub ? sub * 1.5 : 0) + pad * 2);
  const c = mkCanvas(W, H);
  const g = c.getContext('2d')!;
  if (o.bg) { g.fillStyle = o.bg; roundRect(g, 2, 2, W - 4, H - 4, Math.min(24, H / 4)); g.fill(); }
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 3; roundRect(g, 2, 2, W - 4, H - 4, Math.min(24, H / 4)); g.stroke(); }
  g.textBaseline = 'middle';
  g.textAlign = o.align ?? 'center';
  const x = g.textAlign === 'left' ? pad : g.textAlign === 'right' ? W - pad : W / 2;
  g.fillStyle = o.color ?? '#fff';
  g.font = `${o.weight ?? 700} ${size}px ${fam}`;
  g.fillText(o.text, x, pad + size * 0.62);
  if (o.sub) {
    g.fillStyle = o.subColor ?? 'rgba(255,255,255,0.7)';
    g.font = `500 ${sub}px ${FONT_EN}`;
    g.fillText(o.sub, x, pad + size * 1.25 + sub * 0.65);
  }
  return {tex: toTex(c), aspect: W / H, canvas: c};
}

// Soft radial sprite used for glows / particles.
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = mkCanvas(128, 128);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
