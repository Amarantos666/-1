import React from 'react';
import {FONT_MONO} from '../theme';

// Odometer-style rolling number. `value` may be fractional while animating; each digit column rolls.
export const Odometer: React.FC<{value: number; digits?: number; size?: number; color?: string; commas?: boolean; style?: React.CSSProperties; minDigits?: number}> = ({value, size = 64, color = '#fff', commas = true, style, minDigits = 1}) => {
  const v = Math.max(0, value);
  const intDigits = Math.max(minDigits, Math.floor(v).toString().length);
  const cols: React.ReactNode[] = [];
  for (let i = intDigits - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    // continuous roll: lower digit fraction drives the carry of this column
    const d = Math.floor(v / p) % 10;
    const lowerFrac = (v % p) / p; // progress of everything below this column
    const th = i === 0 ? 0.8 : 0.97;
    const x = Math.min(1, Math.max(0, (lowerFrac - th) / (1 - th)));
    const pos = d + x * x * (3 - 2 * x);
    const lead = v < p && i > 0 && i >= minDigits - 0;
    cols.push(
      <span key={i} style={{display: 'inline-block', height: size * 1.1, overflow: 'hidden', width: size * 0.62, position: 'relative', opacity: lead ? 0.25 : 1}}>
        <span style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-pos * size * 1.1}px)`}}>
          {Array.from({length: 11}, (_, k) => (
            <span key={k} style={{display: 'block', height: size * 1.1, lineHeight: `${size * 1.1}px`, textAlign: 'center'}}>{k % 10}</span>
          ))}
        </span>
      </span>,
    );
    if (commas && i > 0 && i % 3 === 0) cols.push(<span key={`c${i}`} style={{display: 'inline-block', width: size * 0.3, height: size * 1.1, lineHeight: `${size * 1.1}px`, textAlign: 'center', opacity: lead ? 0.25 : 1}}>,</span>);
  }
  return <span style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: size, color, display: 'inline-flex', alignItems: 'flex-start', lineHeight: 1, fontVariantNumeric: 'tabular-nums', ...style}}>{cols}</span>;
};

// Text that "scrambles" toward its final value (encryption / decoding effect). Deterministic in t.
const GLYPHS = '0123456789ABCDEF#%&*@$+=?';
export const scramble = (target: string, progress: number, t: number, seed = 1) => {
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (ch === ' ') { out += ' '; continue; }
    const settle = (i + 1) / (target.length + 1);
    if (progress >= settle) out += ch;
    else out += GLYPHS[Math.floor(Math.abs(Math.sin((i + 1) * 91.7 + Math.floor(t * 24) * 13.1 + seed * 7.7)) * 1e4) % GLYPHS.length];
  }
  return out;
};
