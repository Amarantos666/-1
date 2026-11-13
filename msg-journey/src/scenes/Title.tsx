import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, GridFloor, Stars, Streak} from '../three/common';
import {mkCanvas, toTex} from '../lib/canvas';
import {easeInOut, easeOut, easeOutBack, lerp, mulberry32, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';
import {ev} from '../timeline';
import {streamCurves, MessagePair} from './O1';

export const O2_SPLIT = ev('O2', 3.4);

// Title text drawn once; front layer gets a gradient, back layers are dark tinted to fake extrusion.
function titleCanvas(front: boolean) {
  const W = 2048, H = 640;
  const c = mkCanvas(W, H); const g = c.getContext('2d')!;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 210px ${FONT_ZH}`;
  if (front) {
    const gr = g.createLinearGradient(200, 0, W - 200, 0);
    gr.addColorStop(0, '#7ff0ff'); gr.addColorStop(0.5, '#c79bff'); gr.addColorStop(1, '#ffd27a');
    g.fillStyle = gr;
  } else g.fillStyle = '#ffffff';
  g.fillText('你发的一条消息', W / 2, 190);
  g.fillText('都经历了什么', W / 2, 450);
  return c;
}

export const O2Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const front = useMemo(() => toTex(titleCanvas(true)), []);
  const back = useMemo(() => toTex(titleCanvas(false)), []);
  const LAYERS = 22;
  const appear = easeOutBack(ramp(t, 0.1, 1.2));
  const orbit = lerp(-0.32, 0.22, easeInOut(ramp(t, 0, dur)));
  const push = easeInOut(ramp(t, dur - 1.6, dur));
  const camPos: [number, number, number] = [Math.sin(orbit) * lerp(11, 5.5, push) - push * 3.5, lerp(0.8, 0.3, push), Math.cos(orbit) * lerp(11, 5.5, push)];
  const {L, R} = useMemo(streamCurves, []);
  // the two message streams keep flying far behind the title
  const head = 0.55 + 0.4 * ramp(t, 0, dur);
  const pL = new THREE.Vector3(), pR = new THREE.Vector3();
  L.getPointAt(head, pL); R.getPointAt(head, pR);
  return (
    <>
      <CameraRig pos={camPos} target={[lerp(0, -3.5, push), lerp(0.3, -1.6, push), 0]} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 20, 80]} />
      <Stars t={t} />
      <GridFloor y={-3.2} color="#3a4cff" fade={20} opacity={0.5} scroll={[0, -t]} />
      <Dust t={t} count={400} spread={[30, 12, 30]} />
      <group position={[0, 0, -26]} scale={1}>
        <Streak curve={L} head={head} length={0.35} color="#2E9BFF" count={160} size={0.9} opacity={0.6} />
        <Streak curve={R} head={head} length={0.35} color="#A05CFF" count={160} size={0.9} opacity={0.6} />
        <MessagePair position={pL} t={t} scale={2} opacity={0.7} />
        <MessagePair position={pR} t={t} scale={2} opacity={0.7} phase={1.3} />
      </group>
      <group scale={[appear, appear, 1]} position={[0, 0.9, 0]}>
        {Array.from({length: LAYERS}, (_, i) => {
          const k = i / (LAYERS - 1);
          const col = new THREE.Color('#2a1b6a').lerp(new THREE.Color('#0c0a26'), k);
          return (
            <mesh key={i} position={[0, 0, -i * 0.018]} renderOrder={-i}>
              <planeGeometry args={[9.6, 3.0]} />
              <meshBasicMaterial map={i === 0 ? front : back} transparent color={i === 0 ? new THREE.Color(1.5, 1.5, 1.5) : col} toneMapped={i !== 0} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    </>
  );
};

export const O2Html: React.FC<{t: number; dur: number}> = ({t}) => {
  const sub = smooth(ramp(t, 1.0, 1.7));
  const split = easeOut(ramp(t, O2_SPLIT, O2_SPLIT + 0.5));
  const chip = (zh: string, en: string, col: string, side: -1 | 1) => (
    <div style={{transform: `translateX(${side * (1 - split) * 120}px)`, opacity: split, padding: '12px 28px', borderRadius: 999, border: `2px solid ${col}`, background: `${col}1f`, boxShadow: `0 0 28px ${col}66`, textAlign: 'center'}}>
      <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 34, color: '#fff'}}>{zh}</div>
      <div style={{fontFamily: FONT_EN, fontWeight: 600, fontSize: 15, letterSpacing: 4, color: col}}>{en}</div>
    </div>
  );
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', opacity: sub, fontFamily: FONT_EN, fontWeight: 600, fontSize: 30, letterSpacing: 12, color: 'rgba(230,236,255,0.9)'}}>WHAT HAPPENS AFTER YOU HIT ENTER</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 722, display: 'flex', justifyContent: 'center', gap: 80}}>
        {chip('A 面 · 被搬运', 'SIDE A · DELIVERED', C.cyan, -1)}
        {chip('B 面 · 被读懂', 'SIDE B · UNDERSTOOD', '#C77DFF', 1)}
      </div>
    </>
  );
};

// ---------- Chapter card: warp-speed star streaks + big label (dark card allowed here) ----------
export const CardScene: React.FC<{t: number; dur: number; color: string}> = ({t, color}) => {
  const geo = useMemo(() => {
    const r = mulberry32(31), N = 900;
    const p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const a = r() * Math.PI * 2, rr = 2 + r() * 30, z = -r() * 200; p.set([Math.cos(a) * rr, Math.sin(a) * rr, z, Math.cos(a) * rr, Math.sin(a) * rr, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return {g, base: p.slice()};
  }, []);
  const P = geo.g.getAttribute('position') as THREE.BufferAttribute;
  const speed = 60, len = 6 + 10 * Math.sin(Math.min(1, t / 2.3) * Math.PI);
  for (let i = 0; i < P.count / 2; i++) {
    let z = geo.base[i * 6 + 2] + t * speed; z = ((z % 200) + 200) % 200 - 200;
    P.setZ(i * 2, z); P.setZ(i * 2 + 1, z - len);
  }
  P.needsUpdate = true;
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(1.6), [color]);
  return (
    <>
      <CameraRig pos={[0, 0, 5]} target={[0, 0, -10]} fov={60} roll={t * 0.15} />
      <color attach="background" args={['#05050f']} />
      <lineSegments geometry={geo.g}><lineBasicMaterial color={c} transparent opacity={0.7} toneMapped={false} /></lineSegments>
    </>
  );
};

export const CardHtml: React.FC<{t: number; dur: number; big: string; zh: string; en: string; color: string}> = ({t, dur, big, zh, en, color}) => {
  const a = easeOut(ramp(t, 0, 0.35)) * (1 - smooth(ramp(t, dur - 0.3, dur)));
  const wipe = easeInOut(ramp(t, 0.05, 0.6));
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: a}}>
      <div style={{textAlign: 'center', transform: `scale(${lerp(1.12, 1, easeOut(ramp(t, 0, 0.5)))})`}}>
        <div style={{fontFamily: FONT_ZH, fontWeight: 900, fontSize: 150, color: '#fff', letterSpacing: 12, textShadow: `0 0 40px ${color}`}}>{big}</div>
        <div style={{height: 3, margin: '8px auto 18px', width: `${wipe * 640}px`, background: color, boxShadow: `0 0 16px ${color}`}} />
        <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 48, color: '#fff'}}>{zh}</div>
        <div style={{fontFamily: FONT_EN, fontWeight: 600, fontSize: 22, letterSpacing: 8, color, marginTop: 8}}>{en}</div>
      </div>
    </div>
  );
};
