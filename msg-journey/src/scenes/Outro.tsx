import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Orb, Stars, Streak} from '../three/common';
import {decay, easeInOut, easeOut, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH, FONT_ZH_SERIF} from '../theme';
import {ev, shotFrom} from '../timeline';
import {GOLDEN} from '../lib/beat';

export const C1_GOLD = GOLDEN - shotFrom('C1');
export const C1_ROWS = [ev('C1', 0.6, false), ev('C1', 2.4, false), ev('C1', 4.3, false), ev('C1', 6.2, false)];

export const C1Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const conv = easeInOut(ramp(t, C1_GOLD - 2.2, C1_GOLD));
  const L = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-16, -1, -6), new THREE.Vector3(-8, 0.5, -3), new THREE.Vector3(-3, 1.2, -1), new THREE.Vector3(0, 1.4, 0)]), []);
  const R = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(16, -1, -6), new THREE.Vector3(8, 0.5, -3), new THREE.Vector3(3, 1.2, -1), new THREE.Vector3(0, 1.4, 0)]), []);
  const head = lerp(0.25, 1, conv);
  const hit = decay(t, C1_GOLD, 1.6);
  const after = t >= C1_GOLD;
  return (
    <>
      <CameraRig pos={[0, 1.6, lerp(12, 10.5, ramp(t, 0, 15))]} target={[0, 1.2, 0]} fov={45} />
      <color attach="background" args={[C.bg]} />
      <Stars t={t} />
      <GridFloor y={-2.4} color="#5a4cff" fade={20} opacity={0.45} scroll={[0, -t * 0.6]} />
      <Dust t={t} count={500} spread={[34, 12, 20]} color="#e0d0ff" opacity={0.35} />
      {/* split halves: soft coloured light fields */}
      <Glow position={[-7, 1.2, -6]} color={C.cyanDeep} size={18} opacity={0.35 * (1 - hit * 0.5)} />
      <Glow position={[7, 1.2, -6]} color={C.purple} size={18} opacity={0.35 * (1 - hit * 0.5)} />
      <Streak curve={L} head={head} length={0.6} color="#2E9BFF" count={200} size={0.55} />
      <Streak curve={R} head={head} length={0.6} color="#A05CFF" count={200} size={0.55} />
      {!after ? <><Orb position={L.getPointAt(head).toArray() as [number, number, number]} color={C.cyan} r={0.12} intensity={5} glow={10} /><Orb position={R.getPointAt(head).toArray() as [number, number, number]} color="#c08bff" r={0.12} intensity={5} glow={10} /></> : null}
      {after ? <><Orb position={[0, 1.4, 0]} color={C.goldHot} r={0.18 + hit * 0.2} intensity={6} glow={14 + hit * 20} /><Glow position={[0, 1.4, 0]} color="#ffffff" size={2 + hit * 30} opacity={0.5 + hit * 0.5} /></> : null}
    </>
  );
};

const ROWS = [
  {k: '发出去的', ke: 'What is sent', a: '“在吗” + 照片', b: '整段对话 + 设定 + 照片'},
  {k: '一张照片', ke: 'A photo', a: '两千多个包，到了再拼回去', b: '几百个小方块，被“看懂”'},
  {k: '路上', ke: 'On the way', a: '没人读懂', b: '被拆开、被读懂'},
  {k: '之后', ke: 'Afterwards', a: '留在对方手机里', b: '被忘记，下次重读'},
];

export const C1Html: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const head = smooth(ramp(t, 0, 0.5));
  const gold = ramp(t, C1_GOLD, C1_GOLD + 0.25);
  const tableA = 1 - 0.75 * smooth(ramp(t, C1_GOLD - 0.4, C1_GOLD + 0.3));
  const endA = 1 - smooth(ramp(t, dur - 0.5, dur));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: endA}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'linear-gradient(90deg, rgba(28,140,255,0.10), rgba(28,140,255,0))'}} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', background: 'linear-gradient(270deg, rgba(155,92,255,0.12), rgba(155,92,255,0))'}} />
      <div style={{position: 'absolute', left: 240, right: 240, top: 150, opacity: head * tableA, transform: `translateY(${-gold * 40}px)`}}>
        <div style={{display: 'grid', gridTemplateColumns: '220px 1fr 1fr', columnGap: 30, alignItems: 'center'}}>
          <div />
          <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 36, color: C.cyan, textAlign: 'center'}}>发给人 <span style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 3}}>TO A FRIEND</span></div>
          <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 36, color: '#C77DFF', textAlign: 'center'}}>发给 AI <span style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 3}}>TO AN AI</span></div>
          {ROWS.map((r, i) => {
            const a = easeOut(ramp(t, C1_ROWS[i], C1_ROWS[i] + 0.4));
            return (
              <React.Fragment key={i}>
                <div style={{opacity: a, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.12)', fontFamily: FONT_ZH, fontSize: 26, color: 'rgba(255,255,255,0.75)'}}>{r.k}<div style={{fontFamily: FONT_EN, fontSize: 14, letterSpacing: 2}}>{r.ke.toUpperCase()}</div></div>
                <div style={{opacity: a, transform: `translateX(${(1 - a) * -40}px)`, padding: '16px 0', borderTop: '1px solid rgba(56,232,255,0.3)', fontFamily: FONT_ZH, fontWeight: 700, fontSize: 32, color: '#dff8ff', textAlign: 'center'}}>{r.a}</div>
                <div style={{opacity: a, transform: `translateX(${(1 - a) * 40}px)`, padding: '16px 0', borderTop: '1px solid rgba(199,125,255,0.35)', fontFamily: FONT_ZH, fontWeight: 700, fontSize: 32, color: '#f0dcff', textAlign: 'center'}}>{r.b}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {gold > 0 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', opacity: gold, transform: `scale(${lerp(1.25, 1, easeOut(gold))})`, filter: `blur(${(1 - gold) * 5}px)`}}>
          <div style={{fontFamily: FONT_ZH_SERIF, fontWeight: 900, fontSize: 62, color: '#fff6dc', textShadow: '0 0 30px rgba(255,194,74,0.8)', whiteSpace: 'nowrap'}}>同样是按下回车——一条被送达，一条被读懂。</div>
          <div style={{fontFamily: FONT_ZH_SERIF, fontWeight: 900, fontSize: 62, color: '#cfd6e6', marginTop: 10, opacity: smooth(ramp(t, C1_GOLD + 1.2, C1_GOLD + 1.8)), textShadow: '0 0 24px rgba(150,170,210,0.6)'}}>然后，被忘记。</div>
          <div style={{fontFamily: FONT_EN, fontWeight: 500, fontSize: 28, color: 'rgba(240,236,255,0.85)', marginTop: 18}}>Same Enter key — one delivered, one understood. <span style={{opacity: smooth(ramp(t, C1_GOLD + 1.2, C1_GOLD + 1.8))}}>And then, forgotten.</span></div>
        </div>
      ) : null}
    </div>
  );
};

// ---------------- References ----------------
export const R1Scene: React.FC<{t: number; dur: number}> = ({t}) => (
  <>
    <CameraRig pos={[Math.sin(t * 0.1) * 1.5, 1, 12]} target={[0, 0, 0]} fov={45} />
    <color attach="background" args={[C.bg]} />
    <Stars t={t} />
    <GridFloor y={-3} color="#3a4cff" fade={20} opacity={0.35} scroll={[0, -t * 0.4]} />
    <Dust t={t} count={300} />
  </>
);

const REFS = [
  'IEEE Spectrum (2019) · The First Transatlantic Telegraph Cable Was a Bold, Beautiful Failure',
  'ITU (2025) · Global Connectivity Report — submarine cables carry 99%+ of international data',
  'Brown et al. (2020) · Language Models are Few-Shot Learners (GPT-3)',
  'Kaplan et al. (2020) · Scaling Laws for Neural Language Models',
  'Dosovitskiy et al. (2020) · An Image is Worth 16x16 Words',
  'Yu et al. (OSDI 2022) · Orca: continuous batching',
  'Kwon et al. (SOSP 2023) · vLLM / PagedAttention',
  'Vaswani et al. (2017) · Attention Is All You Need',
];

export const R1Html: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const a = smooth(ramp(t, 0, 0.6));
  const last = smooth(ramp(t, dur - 3.2, dur - 2.4));
  return (
    <div style={{position: 'absolute', left: 200, right: 200, top: 150, opacity: a}}>
      <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 34, color: '#fff'}}>参考资料 <span style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 4, color: C.goldHot}}>REFERENCES</span></div>
      <div style={{marginTop: 16, fontFamily: FONT_MONO, fontSize: 19, lineHeight: '33px', color: 'rgba(225,232,255,0.85)'}}>
        {REFS.map((r, i) => <div key={i} style={{opacity: smooth(ramp(t, 0.2 + i * 0.12, 0.6 + i * 0.12))}}>{r}</div>)}
        <div style={{marginTop: 10, color: 'rgba(225,232,255,0.7)'}}>海缆数据 Submarine cable data: TeleGeography, submarinecablemap.com (CC BY-SA 4.0) · 海岸线 Coastlines: Natural Earth</div>
        <div style={{color: 'rgba(225,232,255,0.7)'}}>BGM：开智小曲《We Never (Remix)》</div>
      </div>
      <div style={{marginTop: 22, fontFamily: FONT_ZH, fontSize: 21, color: 'rgba(255,255,255,0.62)', lineHeight: '32px'}}>
        示意动画；数值为典型情况估算，流程为常见做法，不代表任何具体产品的实现。
        <div style={{fontFamily: FONT_EN, fontSize: 17}}>Illustrative animation. Figures are typical estimates; flows show common practice, not any specific product.</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', opacity: last, fontFamily: FONT_ZH_SERIF, fontWeight: 700, fontSize: 44, color: C.goldHot, textShadow: '0 0 20px rgba(255,194,74,0.5)'}}>— 今天又学到了 —</div>
    </div>
  );
};
export const _o = Orb;
