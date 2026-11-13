import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Orb, Stars, Streak} from '../three/common';
import {easeInOut, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {ev} from '../timeline';
import {Panel} from './O1';
import {REPLY} from './B7';

export const B8_START = ev('B8', 1.0, false);
export const B8_GAP = 0.2905; // half a beat at ~103 BPM
const TRAVEL = 0.9;
export const tokenSend = (k: number) => B8_START + k * B8_GAP;
export const tokenArrive = (k: number) => tokenSend(k) + TRAVEL;

const GPU = new THREE.Vector3(9, 1.2, -16), SCREEN = new THREE.Vector3(-1.5, 1.3, 0.2);

export const B8Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([GPU.clone(), new THREE.Vector3(6, 3.2, -9), new THREE.Vector3(2, 2.4, -3), SCREEN.clone().add(new THREE.Vector3(1.4, 0.2, 0.2))]), []);
  const arrived = REPLY.filter((_, k) => t >= tokenArrive(k)).length;
  const done = arrived === REPLY.length;
  const reply = REPLY.slice(0, arrived).join('');
  const back = easeInOut(ramp(t, dur - 3.2, dur));
  const cam = new THREE.Vector3(lerp(1.2, 6.8, back), lerp(1.8, 2.0, back), lerp(9.0, -9.5, back));
  const tgt = new THREE.Vector3(lerp(1.4, GPU.x, back), lerp(1.4, GPU.y, back), lerp(-3, GPU.z, back));
  const v = new THREE.Vector3();
  return (
    <>
      <CameraRig pos={cam.toArray() as [number, number, number]} target={tgt.toArray() as [number, number, number]} fov={42} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 18, 60]} />
      <Stars t={t} tint="#e0b8ff" />
      <GridFloor y={-1.6} color="#8a3cff" fade={22} opacity={0.5} />
      <Dust t={t} count={500} spread={[30, 10, 30]} center={[3, 1, -6]} color="#e3b8ff" opacity={0.35} />
      {/* the GPU far away */}
      <mesh position={GPU.toArray()}><boxGeometry args={[2.4, 2.4, 0.4]} /><meshStandardMaterial color="#1a1238" emissive={C.purple} emissiveIntensity={1.2} metalness={0.5} roughness={0.3} /></mesh>
      <Glow position={GPU.toArray() as [number, number, number]} color="#c08bff" size={9} opacity={0.6} />
      <Streak curve={curve} head={1} length={1} color="#7a3cff" count={260} size={0.18} opacity={0.5} />
      {REPLY.map((ch, k) => {
        const u = (t - tokenSend(k)) / TRAVEL;
        if (u <= 0 || u >= 1) return null;
        curve.getPointAt(easeInOut(u), v);
        return <Orb key={k} position={v.toArray() as [number, number, number]} color={C.goldHot} r={0.07} intensity={5} glow={9} />;
      })}
      <Panel state={{who: 'ai', typed: '', caret: false, attach: 0, sent: 1, reply: reply || ' ', done}} position={SCREEN.toArray() as [number, number, number]} rotY={0.28} opacity={1} />
      <ambientLight intensity={0.5} />
    </>
  );
};

export const B8Html: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const arrived = REPLY.filter((_, k) => t >= tokenArrive(k)).length;
  const rate = arrived > 1 ? 1 / B8_GAP : 0;
  const a = smooth(ramp(t, 0.6, 1.2)) * (1 - smooth(ramp(t, dur - 2.6, dur - 2)));
  return (
    <div style={{position: 'absolute', right: 120, top: 200, textAlign: 'right', opacity: a, padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.55)'}}>
      <div style={{fontFamily: FONT_ZH, fontSize: 20, color: 'rgba(255,255,255,0.7)'}}>流式输出 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>STREAMING</span></div>
      <div style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: 54, color: '#fff3c4'}}>{arrived}<span style={{fontSize: 24}}> / {REPLY.length} tokens</span></div>
      <div style={{fontFamily: FONT_ZH, fontSize: 16, color: 'rgba(255,255,255,0.55)'}}>慢动作演示，实际通常快得多 · slowed down{rate ? '' : ''}</div>
    </div>
  );
};
