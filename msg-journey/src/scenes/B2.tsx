import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Orb, Stars, Streak} from '../three/common';
import {easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C} from '../theme';
import {ev} from '../timeline';
import {MessagePair, streamCurves} from './O1';

// ---------------- Bridge: the camera turns back to chase the purple stream ----------------
export const BRScene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const {L, R} = useMemo(streamCurves, []);
  const u = lerp(0.35, 0.92, easeInOut(ramp(t, 0, dur)));
  const turn = easeInOut(ramp(t, 0, 1.6));
  const head = new THREE.Vector3(), back = new THREE.Vector3(), lh = new THREE.Vector3();
  R.getPointAt(u, head); R.getPointAt(Math.max(0, u - 0.07), back); L.getPointAt(0.97, lh);
  const camA = new THREE.Vector3(0, 2.6, 9.5);
  const camB = back.clone().add(new THREE.Vector3(2.4, 1.4, 4.2));
  const cam = camA.clone().lerp(camB, turn);
  const tgt = new THREE.Vector3(-4, 2, -20).lerp(head, turn);
  return (
    <>
      <CameraRig pos={cam.toArray() as [number, number, number]} target={tgt.toArray() as [number, number, number]} fov={44} roll={Math.sin(t * 0.8) * 0.04} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 20, 80]} />
      <Stars t={t} tint="#c9a6ff" />
      <GridFloor y={-1.2} color="#6b3bff" fade={22} opacity={0.5} scroll={[0, -t * 2]} />
      <Dust t={t} count={600} spread={[40, 14, 60]} center={[4, 2, -18]} color="#d6a8ff" opacity={0.4} />
      <Streak curve={L} head={0.97} length={0.4} color="#2E9BFF" count={200} size={0.6} opacity={1 - turn * 0.7} />
      <Streak curve={R} head={u} length={0.5} color="#A05CFF" count={320} size={0.7} />
      <Streak curve={R} head={u} length={0.1} color="#e2c2ff" count={80} size={0.35} />
      <MessagePair position={head} t={t} scale={0.9} />
      <Glow position={head.toArray() as [number, number, number]} color={C.purple} size={2.5} opacity={0.5} />
      <Glow position={lh.toArray() as [number, number, number]} color={C.cyan} size={3} opacity={0.5 * (1 - turn)} />
    </>
  );
};

// ---------------- B2: auth -> rate limit -> safety scan ----------------
export const B2_G1 = ev('B2', 1.2, false), B2_G2 = ev('B2', 3.4, false), B2_G3 = ev('B2', 5.6, false);
const GATES = [{x: 0, zh: '验身份', en: 'AUTHENTICATION'}, {x: 7, zh: '限流排队', en: 'RATE LIMIT'}, {x: 14, zh: '安全检查', en: 'SAFETY CHECK'}];

export const B2Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  // packet x: moves through each gate, pausing briefly at the queue
  const seg = (a: number, b: number, x0: number, x1: number) => lerp(x0, x1, easeInOut(ramp(t, a, b)));
  const px = t < B2_G1 ? seg(0, B2_G1, -5, 0) : t < B2_G2 ? seg(B2_G1 + 0.4, B2_G2, 0, 6.2) + easeOut(ramp(t, B2_G2 - 0.2, B2_G2 + 0.3)) * 0.8 : seg(B2_G2 + 0.5, B2_G3, 7, 14) + seg(B2_G3 + 0.3, dur, 0, 6);
  const pass = [t > B2_G1, t > B2_G2 + 0.3, t > B2_G3 + 0.2];
  const scan = ramp(t, B2_G3 - 0.5, B2_G3 + 0.2);
  const cam: [number, number, number] = [px - 3.8, 1.8, 7.2];
  const queue = useMemo(() => Array.from({length: 7}, (_, i) => ({c: ['#3fd0c9', '#ff8a4c', '#7bd36b', '#ff6f91', '#4c9bff', '#f5c04a', '#9aa7ff'][i], d: hash1(i + 3)})), []);
  return (
    <>
      <CameraRig pos={cam} target={[px + 1.8, 0.9, 0]} fov={44} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 10, 40]} />
      <Stars t={t} tint="#c9a6ff" />
      <GridFloor y={-1.6} color="#7b3cff" fade={18} opacity={0.55} scroll={[t * 0.5, 0]} />
      <Dust t={t} count={500} spread={[40, 10, 16]} center={[7, 0, 0]} color="#d6a8ff" opacity={0.35} />
      {GATES.map((g, i) => {
        const ok = pass[i];
        const col = new THREE.Color(ok ? '#5cffb0' : i === 1 ? '#ffb347' : '#C77DFF').multiplyScalar(2);
        return (
          <group key={i} position={[g.x, 0.3, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[1.5, 0.05, 12, 96]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
            <mesh rotation={[0, Math.PI / 2, t * (i === 0 ? 1 : -0.6)]}><torusGeometry args={[1.75, 0.015, 8, 96, Math.PI * 1.3]} /><meshBasicMaterial color={col} toneMapped={false} transparent opacity={0.6} /></mesh>
            <Label3D text={g.zh} sub={g.en} size={56} height={0.62} color="#f2e6ff" position={[0, 2.25, 0]} emissive={1.3} />
            {ok ? <Label3D text="✓" size={90} height={0.5} color="#5cffb0" position={[0, -1.95, 0]} emissive={1.8} /> : null}
          </group>
        );
      })}
      {/* rate-limit queue: other people's requests waiting */}
      {queue.map((q, i) => <Orb key={i} position={[7 - 1.1 - i * 0.55, -0.6 + Math.sin(t * 2 + i) * 0.05, -0.6 - q.d * 0.6]} color={q.c} r={0.12} intensity={2.5} glow={5} />)}
      {/* safety scan plane */}
      {scan > 0 && scan < 1 ? (
        <mesh position={[14, lerp(1.6, -1.0, scan), 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.45, 48]} />
          <meshBasicMaterial color={new THREE.Color('#bfe9ff').multiplyScalar(2.5)} transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ) : null}
      {/* the purple packet */}
      <group position={[px, 0.3, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.32, 0.9, 8, 24]} /><meshStandardMaterial color="#3a1670" emissive={C.purple} emissiveIntensity={1.0} metalness={0.3} roughness={0.25} /></mesh>
        <Glow color={C.purple} size={3} opacity={0.7} />
        <MessagePair position={new THREE.Vector3(0, 0, 0)} t={t} scale={0.6} />
      </group>
      <pointLight position={[px, 4, 4]} intensity={50} color="#e7d0ff" />
      <ambientLight intensity={0.4} />
    </>
  );
};
export const _b2 = smooth;
