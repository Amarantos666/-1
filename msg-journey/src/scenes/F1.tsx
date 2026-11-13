import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Stars} from '../three/common';
import {Crystal, MemoryBoard, OUR_SLOT, slotPos} from '../three/Memory';
import {decay, easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {glowTexture} from '../lib/canvas';
import {C} from '../theme';

export const F1_CRACK = 1.6, F1_SHATTER = 2.6, F1_NEXT = 6.6;
const BOARD_Y = -1.4;

export function f1Cam(t: number) {
  const home = slotPos(OUR_SLOT.c, OUR_SLOT.r);
  const pull = easeInOut(ramp(t, 7.5, 15));
  const pos = new THREE.Vector3(home[0] + lerp(2.2, 5.5, pull), lerp(1.0, 5.2, pull), home[2] + lerp(5.4, 9.5, pull));
  const tgt = new THREE.Vector3(home[0], BOARD_Y + lerp(1.1, 0.4, pull), home[2] - lerp(0, 1.5, pull));
  return {pos, tgt};
}

export const F1Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const home = slotPos(OUR_SLOT.c, OUR_SLOT.r);
  const grey = smooth(ramp(t, 0.2, 1.8));
  const crack = smooth(ramp(t, F1_CRACK, F1_SHATTER));
  const shatter = easeOut(ramp(t, F1_SHATTER, F1_SHATTER + 3.2));
  const next = easeInOut(ramp(t, F1_NEXT, F1_NEXT + 1.6));
  const cam = f1Cam(t);
  const pop = decay(t, F1_SHATTER, 4);
  return (
    <>
      <CameraRig pos={[cam.pos.x, cam.pos.y, cam.pos.z]} target={[cam.tgt.x, cam.tgt.y, cam.tgt.z]} fov={40} />
      <color attach="background" args={['#0a0c16']} />
      <fog attach="fog" args={['#0a0c16', 10, 40]} />
      <Stars t={t * 0.3} tint="#9aa3b5" opacity={0.6} />
      <GridFloor y={BOARD_Y - 0.02} color="#4a5262" fade={16} opacity={0.35} />
      <Dust t={t} count={500} spread={[20, 8, 20]} center={[home[0], 1, home[2]]} color="#aab4c6" opacity={0.3} />
      <MemoryBoard t={t} position={[0, BOARD_Y, 0]} grey={grey} />
      {shatter < 0.999 ? <Crystal position={[home[0], BOARD_Y + 0.7, home[2]]} scale={0.62} spin={t * 0.2 + 3.3} crack={crack} shatter={shatter} grey={grey} intensity={1.35 - grey * 0.3} glow={1 - grey * 0.5} /> : null}
      <Burst t={t} at={[home[0], BOARD_Y + 0.7, home[2]]} />
      <Glow position={[home[0], BOARD_Y + 0.7, home[2]]} color="#c9d2e3" size={3 * pop + 0.01} opacity={pop} />
      {/* the next stranger's request slides into the freed slot */}
      {t > F1_NEXT ? <Crystal position={[lerp(home[0] + 7, home[0], next), BOARD_Y + 0.7 + Math.sin(next * Math.PI) * 0.8, home[2]]} scale={0.62} spin={t * 0.5} colorA="#3fd0c9" colorB="#d8fff6" intensity={1.8} seed={7} grey={0.35} /> : null}
      <ambientLight intensity={0.5} />
      <pointLight position={[2, 5, 5]} intensity={40} color="#c9d2e3" />
    </>
  );
};

// memory dissolving into grey particles that drift up and fade
const Burst: React.FC<{t: number; at: [number, number, number]}> = ({t, at}) => {
  const N = 700;
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; }, []);
  const P = geo.getAttribute('position') as THREE.BufferAttribute;
  const lt = Math.max(0, t - F1_SHATTER);
  for (let i = 0; i < N; i++) {
    const a = hash1(i * 1.3) * Math.PI * 2, b = Math.acos(2 * hash1(i * 2.1) - 1), sp = 0.4 + hash1(i * 3.7) * 1.6;
    const r = sp * (1 - Math.exp(-lt * 1.1)) * 2.2;
    P.setXYZ(i, at[0] + Math.sin(b) * Math.cos(a) * r, at[1] + Math.cos(b) * r * 0.6 + lt * lt * 0.05 + lt * 0.25 * hash1(i), at[2] + Math.sin(b) * Math.sin(a) * r);
  }
  P.needsUpdate = true;
  const op = t < F1_SHATTER ? 0 : Math.exp(-lt * 0.35);
  return <points geometry={geo} frustumCulled={false}><pointsMaterial size={0.07} map={glowTexture()} color="#c9d2e3" transparent opacity={op} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation /></points>;
};
