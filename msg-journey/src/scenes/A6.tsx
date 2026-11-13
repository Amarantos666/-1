import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Stars} from '../three/common';
import {drawPhoto, toTex} from '../lib/canvas';
import {decay, easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {ev} from '../timeline';

const GX = 47, GY = 46, N = 2143;
const PW = 6.4, PH = 4.27, CELL = PW / GX, CH = PH / GY;
const CTR = new THREE.Vector3(-1.4, 1.5, 0);
const LOST = 1288;
export const A6_LOST = ev('A6', 3.2, false), A6_RESEND = ev('A6', 4.4, false), A6_PHONE = ev('A6', 5.2), A6_SHARP = A6_PHONE + 2.2;

const vert = /* glsl */`attribute vec2 aUv; attribute float aLit; varying vec2 vUv; varying vec2 vL; varying float vLit;
void main(){ vL = uv; vLit = aLit; vUv = aUv + uv * vec2(${(1 / GX).toFixed(6)}, ${(1 / GY).toFixed(6)}); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`;
const frag = /* glsl */`uniform sampler2D map; uniform float uReveal; varying vec2 vUv; varying vec2 vL; varying float vLit;
void main(){ vec3 photo = texture2D(map, vUv).rgb * 1.3; vec3 gold = vec3(1.0,0.76,0.29) * (0.75 + vLit * 0.9);
  float e = max(abs(vL.x-0.5), abs(vL.y-0.5)); float edge = smoothstep(0.38, 0.5, e);
  vec3 c = mix(gold, photo, uReveal); c = mix(c, gold * 1.2, edge * (1.0 - uReveal) * 0.6);
  if (vLit < -0.5) c = vec3(2.2, 0.25, 0.3);
  gl_FragColor = vec4(c, 1.0); }`;

export const A6Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const tex = useMemo(() => toTex(drawPhoto(GX * 16, GY * 16)), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({vertexShader: vert, fragmentShader: frag, uniforms: {map: {value: tex}, uReveal: {value: 0}}}), [tex]);
  const mesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = new Float32Array(N * 2), lit = new Float32Array(N);
    for (let k = 0; k < N; k++) { const i = k % GX, j = Math.floor(k / GX); uv.set([i / GX, 1 - (j + 1) / GY], k * 2); }
    g.setAttribute('aUv', new THREE.InstancedBufferAttribute(uv, 2)); g.setAttribute('aLit', new THREE.InstancedBufferAttribute(lit, 1));
    const m = new THREE.InstancedMesh(g, mat, N); m.frustumCulled = false; return m;
  }, [mat]);
  const lit = mesh.geometry.getAttribute('aLit') as THREE.InstancedBufferAttribute;
  mat.uniforms.uReveal.value = smooth(ramp(t, A6_RESEND + 0.5, A6_RESEND + 1.4));
  const o = new THREE.Object3D();
  for (let k = 0; k < N; k++) {
    const i = k % GX, j = Math.floor(k / GX);
    const tx = CTR.x - PW / 2 + (i + 0.5) * CELL, ty = CTR.y + PH / 2 - (j + 0.5) * CH;
    // arrivals come in shuffled (different routes), each lands on its numbered slot
    const arr = 0.2 + hash1(k * 3.7) * 2.6;
    const resend = k === LOST;
    const s0 = resend ? A6_RESEND : arr;
    const p = easeInOut(ramp(t, s0, s0 + 0.7));
    const fromX = 9 + hash1(k) * 4, fromY = (hash1(k * 2) - 0.5) * 6;
    o.position.set(lerp(fromX, tx, p), lerp(fromY, ty, p), lerp(-4 + hash1(k * 5) * 3, 0, p));
    o.scale.set(p > 0 ? CELL * lerp(1.6, 0.96, p) : 0, p > 0 ? CH * lerp(1.6, 0.96, p) : 0, 1);
    o.rotation.set(0, (1 - p) * 1.5, 0);
    o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    lit.setX(k, p > 0 && p < 1 ? 1 : 0);
  }
  // the lost one: empty red slot until resent
  const lostI = LOST % GX, lostJ = Math.floor(LOST / GX);
  const lostPos: [number, number, number] = [CTR.x - PW / 2 + (lostI + 0.5) * CELL, CTR.y + PH / 2 - (lostJ + 0.5) * CH, 0.02];
  mesh.instanceMatrix.needsUpdate = true; lit.needsUpdate = true;
  const blink = t > A6_LOST && t < A6_RESEND + 0.7 ? (Math.floor(t * 6) % 2 ? 1 : 0.35) : 0;
  // phone with thumbnail -> full photo
  const phoneIn = easeOut(ramp(t, A6_PHONE - 0.6, A6_PHONE + 0.2));
  const blur = 1 - smooth(ramp(t, A6_PHONE + 0.6, A6_SHARP));
  const thumb = useMemo(() => toTex(drawPhoto(96, 64)), []);
  const full = useMemo(() => toTex(drawPhoto(768, 512)), []);
  const ding = decay(t, A6_SHARP, 3);
  const cam = easeInOut(ramp(t, A6_PHONE - 1.2, A6_PHONE + 1.4));
  return (
    <>
      <CameraRig pos={[lerp(-0.4, 1.4, cam) + Math.sin(t * 0.3) * 0.3, lerp(1.6, 1.2, cam), lerp(9.5, 8.4, cam)]} target={[lerp(-0.6, 1.2, cam), lerp(1.4, 1.1, cam), 0]} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 14, 50]} />
      <Stars t={t} />
      <GridFloor y={-1.6} color="#1f6bff" fade={20} opacity={0.55} />
      <Dust t={t} count={400} spread={[30, 10, 20]} color="#ffd79a" opacity={0.3} />
      <group position={[0, 0, 0]} scale={1 - 0.15 * cam}><primitive object={mesh} /></group>
      {blink > 0 ? (
        <group scale={1 - 0.15 * cam}>
          <mesh position={lostPos}><planeGeometry args={[CELL * 2.2, CH * 2.2]} /><meshBasicMaterial color={new THREE.Color(C.red).multiplyScalar(2.5 * blink)} toneMapped={false} transparent opacity={t < A6_RESEND + 0.6 ? 1 : 0} /></mesh>
          <Glow position={lostPos} color={C.red} size={0.9} opacity={blink} />
          <Label3D text={t < A6_RESEND ? '#1288 丢失' : '#1288 补发 ✓'} sub={t < A6_RESEND ? 'LOST' : 'RESENT'} size={44} height={0.42} color={t < A6_RESEND ? '#ffb3ba' : '#bfffd2'} position={[lostPos[0] + 0.9, lostPos[1] + 0.55, 0.3]} emissive={1.4} />
        </group>
      ) : null}
      {/* recipient phone */}
      <group position={[lerp(9, 4.4, phoneIn), 1.1, 1.2]} rotation={[0, -0.35, 0]}>
        <RoundedBox args={[2.1, 4.1, 0.16]} radius={0.16} smoothness={4}><meshStandardMaterial color="#121735" metalness={0.6} roughness={0.3} /></RoundedBox>
        <mesh position={[0, 0, 0.085]}><planeGeometry args={[1.92, 3.9]} /><meshBasicMaterial color="#0d1230" /></mesh>
        <mesh position={[0.1, 0.3, 0.09]}>
          <planeGeometry args={[1.6, 1.07]} />
          <meshBasicMaterial map={blur > 0.5 ? thumb : full} toneMapped={false} color={new THREE.Color(1.2, 1.2, 1.2)} />
        </mesh>
        <Label3D text={blur > 0.5 ? '缩略图' : '原图 ✓'} sub={blur > 0.5 ? 'THUMBNAIL' : 'FULL PHOTO'} size={40} height={0.32} color="#dff8ff" position={[0.1, -0.55, 0.1]} emissive={1.2} />
        <Label3D text="在吗" size={44} height={0.3} color="#081024" bg={C.cyan} position={[0.45, 1.3, 0.1]} />
        <Glow position={[0, 0, 0.3]} color={C.cyan} size={5 * ding + 0.01} opacity={ding} />
      </group>
      <pointLight position={[3, 5, 6]} intensity={80} color="#e8f2ff" />
      <ambientLight intensity={0.5} />
    </>
  );
};

export const A6Html: React.FC<{t: number}> = ({t}) => {
  const arrived = Math.min(N - (t < A6_RESEND + 0.7 ? 1 : 0), Math.floor(N * Math.min(1, Math.max(0, (t - 0.5) / 2.6))));
  const a = smooth(ramp(t, 0.3, 0.8)) * (1 - smooth(ramp(t, A6_PHONE - 0.6, A6_PHONE)));
  return (
    <div style={{position: 'absolute', left: 120, top: 210, opacity: a, padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.6)'}}>
      <div style={{fontFamily: FONT_ZH, fontSize: 22, color: 'rgba(255,255,255,0.7)'}}>按编号拼回 <span style={{fontFamily: FONT_EN, fontSize: 16, letterSpacing: 2}}>REASSEMBLED</span></div>
      <div style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: 60, color: C.goldHot}}>{arrived.toLocaleString('en-US')}<span style={{fontSize: 30, opacity: 0.7}}> / 2,143</span></div>
    </div>
  );
};
