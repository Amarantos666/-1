import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Stars} from '../three/common';
import {mkCanvas, toTex} from '../lib/canvas';
import {easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';
import {ev, shotFrom} from '../timeline';
import {BEATS} from '../lib/beat';

export const REPLY = ['在', '的', '！', '照', '片', '里', '的', '日', '落', '很', '美', '～', '有', '什', '么', '可', '以', '帮', '你', '？'];
const FILL = ['你', '嗨', '有', '是', '好', '哈', '嗯', '我', '呀', '啊', '这', '那', '，', '。', '吧', '呢'];

// Decode steps land on beats: slow at first (2 beats), then 1 beat, then half beats.
export function b7Steps() {
  const s0 = shotFrom('B7');
  const bs = BEATS.filter((b) => b >= s0 + 1.0);
  const out: number[] = [];
  let i = 0;
  for (let k = 0; k < 3; k++) { out.push(bs[i] - s0); i += 3; }
  for (let k = 0; k < 4; k++) { out.push(bs[i] - s0); i += 1; }
  while (out.length < REPLY.length) { const a = bs[i] - s0, b = bs[i + 1] - s0; out.push(a, (a + b) / 2); i += 1; }
  return out.slice(0, REPLY.length);
}

function candidates(step: number) {
  // step 0 mirrors a plausible distribution; step 2 shows sampling picking a non-top candidate
  if (step === 0) return {toks: ['在', '你', '嗨', '有', '是', '好', '哈', '嗯'], p: [0.62, 0.13, 0.09, 0.06, 0.04, 0.03, 0.02, 0.01], pick: 0};
  if (step === 2) return {toks: ['，', '！', '～', '。', '呀', '啊', '吧', '呢'], p: [0.41, 0.33, 0.1, 0.07, 0.04, 0.03, 0.01, 0.01], pick: 1};
  const toks = [REPLY[step]]; let k = 0;
  while (toks.length < 8) { const c = FILL[(step * 5 + k * 3) % FILL.length]; if (!toks.includes(c)) toks.push(c); k++; }
  const top = 0.45 + hash1(step) * 0.4; const p = [top]; let rest = 1 - top;
  for (let j = 1; j < 8; j++) { const v = rest * (0.45 + hash1(step * 9 + j) * 0.2); p.push(v); rest -= v; }
  return {toks, p, pick: 0};
}

let diceTex: THREE.Texture[] | null = null;
function diceFaces() {
  if (diceTex) return diceTex;
  const pips: number[][][] = [[[0.5, 0.5]], [[0.25, 0.25], [0.75, 0.75]], [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]]];
  diceTex = pips.map((ps) => { const c = mkCanvas(128, 128); const g = c.getContext('2d')!; g.fillStyle = '#f4ecff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#5a2aa0'; for (const [x, y] of ps) { g.beginPath(); g.arc(x * 128, y * 128, 12, 0, Math.PI * 2); g.fill(); } return toTex(c); });
  return diceTex;
}

const X0 = -4.2, DX = 1.2, BASE = -0.9, HMAX = 3.6;
export const B7Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const steps = useMemo(b7Steps, []);
  let s = -1; for (let i = 0; i < steps.length; i++) if (t >= steps[i]) s = i;
  const cur = Math.max(0, s);
  const next = steps[cur + 1] ?? cur + 99;
  const sd = Math.max(0.25, Math.min(1.8, (steps[cur + 1] ?? steps[cur] + 0.6) - steps[cur]));
  const ph = s < 0 ? 0 : (t - steps[cur]) / sd;
  const cand = candidates(cur);
  const grow = easeOut(Math.min(1, ph / 0.35));
  const pickAt = cur < 3 ? 0.78 : 0.5;
  const picked = ph >= pickAt;
  const faces = diceFaces();
  // dice: tumbles across the bars, lands on the chosen one
  const diceOn = cur < 3 && s >= 0;
  const dp = Math.min(1, Math.max(0, (ph - 0.25) / (pickAt - 0.25)));
  const dx = lerp(X0 - 1.5, X0 + cand.pick * DX, easeOut(dp));
  const dh = BASE + cand.p[cand.pick] * HMAX * grow + 0.45 + Math.abs(Math.sin(dp * Math.PI * 3)) * (1 - dp) * 1.6;
  const fly = picked ? easeInOut(Math.min(1, (ph - pickAt) / (1 - pickAt))) : 0;
  const cam: [number, number, number] = [lerp(-1.2, 0.8, ramp(t, 0, dur)), 1.4, lerp(13.5, 12.2, ramp(t, 0, dur))];
  const done = Math.min(1, s + 1);
  return (
    <>
      <CameraRig pos={cam} target={[-0.2, 0.0, 0]} fov={42} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 14, 50]} />
      <Stars t={t} tint="#e0b8ff" />
      <GridFloor y={BASE - 0.02} color="#8a3cff" fade={18} opacity={0.5} />
      <Dust t={t} count={500} spread={[26, 10, 20]} color="#ffd8a8" opacity={0.3} />
      {/* model output portal */}
      <mesh position={[0, 1.2, -3.2]}><planeGeometry args={[12, 6]} /><meshBasicMaterial color={new THREE.Color('#5a2aa0').multiplyScalar(0.25 + 0.25 * Math.exp(-ph * 4))} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
      <Glow position={[0, 1.2, -3.4]} color="#9b5cff" size={11} opacity={0.35} />
      {cand.toks.map((tk, i) => {
        const h = Math.max(0.03, cand.p[i] * HMAX * grow);
        const sel = picked && i === cand.pick;
        const col = new THREE.Color(sel ? C.goldHot : i === 0 ? '#c08bff' : '#7a5ab8').multiplyScalar(sel ? 2.4 : 1.1);
        return (
          <group key={`${cur}-${i}`} position={[X0 + i * DX, 0, 0]}>
            <mesh position={[0, BASE + h / 2, 0]}><boxGeometry args={[0.72, h, 0.72]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={sel ? 1.4 : 0.45} metalness={0.2} roughness={0.35} transparent opacity={0.92} /></mesh>
            <Label3D text={tk} size={80} height={0.6} color={sel ? '#fff3c4' : '#efe2ff'} position={[0, BASE - 0.45, 0.4]} emissive={sel ? 1.8 : 1.1} />
            <Label3D text={`${Math.round(cand.p[i] * 100)}%`} font="mono" size={44} height={0.26} color="#e8dcff" position={[0, BASE + h + 0.25, 0.4]} opacity={grow} />
          </group>
        );
      })}
      {diceOn && ph < 1 ? (
        <group position={[dx, dh, 0.5]} rotation={[dp * 9 + cur, dp * 7, dp * 5]} scale={0.5}>
          <RoundedBox args={[1, 1, 1]} radius={0.12} smoothness={3}>
            {faces.map((f, i) => <meshStandardMaterial key={i} attach={`material-${i}`} map={f} emissive="#7a3cff" emissiveIntensity={0.25} roughness={0.4} />)}
          </RoundedBox>
        </group>
      ) : null}
      {diceOn && ph < 1 ? <Label3D text="温度骰子 T = 0.8" sub="TEMPERATURE SAMPLING" size={44} height={0.42} color="#e2c4ff" position={[dx, dh + 0.85, 0.5]} emissive={1.2} /> : null}
      {/* chosen token flies up into the output line */}
      {picked && fly < 1 ? <Label3D text={cand.toks[cand.pick]} size={90} height={lerp(0.6, 0.35, fly)} color="#fff3c4" bg="rgba(80,40,10,0.6)" position={[lerp(X0 + cand.pick * DX, -4.6 + cur * 0.12, fly), lerp(BASE + cand.p[cand.pick] * HMAX + 0.4, 5.0, fly), lerp(0.6, 0.2, fly)]} emissive={2} /> : null}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 6]} intensity={80} color="#f0e0ff" />
      {done ? null : null}
      {next ? null : null}
    </>
  );
};

export const B7Html: React.FC<{t: number}> = ({t}) => {
  const steps = useMemo(b7Steps, []);
  let n = 0; steps.forEach((st, i) => { const pickAt = i < 3 ? 0.78 : 0.5; const sd = Math.max(0.25, Math.min(1.8, (steps[i + 1] ?? st + 0.6) - st)); if (t >= st + sd * (pickAt + (1 - pickAt) * 0.9)) n = i + 1; });
  const a = smooth(ramp(t, 0.6, 1.1));
  const caret = Math.floor(t * 3) % 2 === 0;
  const rate = n < 4 ? 0 : 1;
  return (
    <>
      <div style={{position: 'absolute', left: 120, top: 150, opacity: a, padding: '10px 22px', borderRadius: 12, background: 'rgba(10,8,30,0.6)', minWidth: 560}}>
        <div style={{fontFamily: FONT_ZH, fontSize: 18, color: 'rgba(255,255,255,0.6)'}}>正在写回复 <span style={{fontFamily: FONT_EN, fontSize: 14, letterSpacing: 2}}>GENERATING · {n} tokens</span></div>
        <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 40, color: '#fff3c4', minHeight: 52}}>{REPLY.slice(0, n).join('')}<span style={{color: '#c08bff', opacity: caret ? 1 : 0}}>▌</span></div>
        <div style={{fontFamily: FONT_ZH, fontSize: 17, color: 'rgba(255,230,180,0.7)', opacity: smooth(ramp(n, 3, 4))}}>（它在描述照片里的日落 · describing the sunset in the photo）</div>
      </div>
      <div style={{position: 'absolute', right: 120, top: 170, textAlign: 'right', opacity: a, fontFamily: FONT_ZH, fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: '28px'}}>
        <div>候选：整个词表 <span style={{fontFamily: FONT_EN}}>· whole vocabulary</span></div>
        <div style={{fontFamily: FONT_EN, fontSize: 16}}>GPT-3: 50,257 tokens · 这里只画前 8 个</div>
        <div style={{opacity: rate}}>越写越快 <span style={{fontFamily: FONT_EN}}>· speeding up (illustrative)</span></div>
      </div>
    </>
  );
};
export const _b7 = ev;
