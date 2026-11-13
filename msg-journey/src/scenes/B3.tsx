import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Glow, Label3D, Stars} from '../three/common';
import {easeIn, easeInOut, hash1, lerp, mulberry32, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';

const SIDE = 11, PER = 420, STEP = 0.72, AISLE = 3.0;
const N = SIDE * 2 * PER;
const TURN_Z = -46;

const ledVert = /* glsl */`attribute float aSeed; uniform float uTime; varying float vOn; varying vec3 vCol;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
  float ph = fract(sin(aSeed * 91.3) * 437.5); float rate = 1.5 + ph * 6.0;
  vOn = step(0.35, fract(uTime * rate * 0.25 + ph)); vCol = mix(vec3(0.35,1.0,0.6), vec3(0.75,0.45,1.0), step(0.7, ph));
  gl_PointSize = clamp(140.0 / -mv.z, 1.5, 7.0); }`;
const ledFrag = /* glsl */`varying float vOn; varying vec3 vCol; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vCol * (0.4 + 2.6 * vOn), a); }`;

export const B3Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const racks = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 2.3, 0.56), new THREE.MeshStandardMaterial({color: '#2a2c4a', metalness: 0.5, roughness: 0.5, emissive: '#2a1a5a', emissiveIntensity: 0.9}), N);
    const o = new THREE.Object3D(); let k = 0;
    for (let s = -1; s <= 1; s += 2) for (let r = 0; r < SIDE; r++) for (let i = 0; i < PER; i++) {
      o.position.set(s * (AISLE / 2 + 0.5 + r * 3.2), 1.15, 4 - i * STEP); o.updateMatrix(); m.setMatrixAt(k++, o.matrix);
    }
    m.frustumCulled = false; return m;
  }, []);
  const leds = useMemo(() => {
    const r = mulberry32(3); const pos: number[] = [], seed: number[] = [];
    for (let s = -1; s <= 1; s += 2) for (let row = 0; row < SIDE; row++) for (let i = 0; i < PER; i++) {
      const x = s * (AISLE / 2 + 0.5 + row * 3.2) - s * 0.51;
      for (let l = 0; l < 6; l++) { pos.push(x, 0.3 + l * 0.33 + r() * 0.05, 4 - i * STEP + (r() - 0.5) * 0.4); seed.push(r() * 1000); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    return g;
  }, []);
  const ledMat = useMemo(() => new THREE.ShaderMaterial({vertexShader: ledVert, fragmentShader: ledFrag, uniforms: {uTime: {value: 0}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}), []);
  ledMat.uniforms.uTime.value = t;
  // camera: glide down the aisle, slow, turn right and push into one GPU tray
  const fly = easeInOut(ramp(t, 0, 6.2));
  const turn = easeInOut(ramp(t, 5.6, 7.6));
  const push = easeIn(ramp(t, 7.4, dur));
  const z = lerp(8, TURN_Z + 3, fly);
  const camPos: [number, number, number] = [lerp(0, lerp(0.2, 0.95, push), turn), lerp(lerp(2.6, 1.5, fly), lerp(1.3, 1.3, push), turn), lerp(z, lerp(TURN_Z + 1.2, TURN_Z, push), turn)];
  const camTgt: [number, number, number] = [lerp(0, AISLE / 2 + 1, turn), lerp(1.3, 1.3, turn), lerp(z - 10, TURN_Z, turn)];
  const tray = smooth(ramp(t, 5.8, 7.0));
  return (
    <>
      <CameraRig pos={camPos} target={camTgt} fov={lerp(50, 40, turn)} roll={Math.sin(t * 0.4) * 0.02 * (1 - turn)} />
      <color attach="background" args={['#120c2e']} />
      <fog attach="fog" args={['#120c2e', 8, 80]} />
      <Stars t={t} opacity={0.4} />
      <primitive object={racks} />
      <points geometry={leds} material={ledMat} frustumCulled={false} />
      {/* floor with aisle light strips + overhead cable trays */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -150]}><planeGeometry args={[80, 320]} /><meshStandardMaterial color="#0b0b1d" metalness={0.7} roughness={0.35} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * AISLE / 2, 0.01, -150]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.05, 320]} /><meshBasicMaterial color={new THREE.Color('#9b5cff').multiplyScalar(2)} toneMapped={false} /></mesh>)}
      {Array.from({length: 8}, (_, i) => <mesh key={i} position={[(i - 3.5) * 3.2, 3.2, -150]}><boxGeometry args={[0.3, 0.06, 320]} /><meshStandardMaterial color="#1c1a36" emissive="#3a2470" emissiveIntensity={0.5} /></mesh>)}
      {/* the GPU tray that slides out */}
      <group position={[AISLE / 2 + 0.5 - tray * 0.7, 1.3, TURN_Z]}>
        <mesh><boxGeometry args={[0.66, 0.18, 0.9]} /><meshStandardMaterial color="#1a1238" emissive={C.purple} emissiveIntensity={0.8 + push * 4} metalness={0.5} roughness={0.3} /></mesh>
        <mesh position={[-0.34, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[0.5, 0.12]} /><meshBasicMaterial color={new THREE.Color('#ffd27a').multiplyScalar(2 + push * 6)} toneMapped={false} /></mesh>
        <Glow position={[-0.4, 0, 0]} color="#c08bff" size={1.2 + push * 6} opacity={0.6 + push * 0.4} />
      </group>
      {tray > 0.5 ? <Label3D text="GPU" font="en" size={60} height={0.16} color="#ffe2a8" position={[AISLE / 2 - 0.3, 1.58, TURN_Z]} rotation={[0, -Math.PI / 2, 0]} opacity={1 - push} emissive={1.4} /> : null}
      <pointLight position={[0, 3, z - 4]} intensity={160} color="#b48cff" distance={40} />
      <pointLight position={[0, 3, z - 20]} intensity={160} color="#7fb0ff" distance={40} />
      <hemisphereLight args={['#6a5ad0', '#0a0820', 0.8]} />
      <ambientLight intensity={0.35} />
    </>
  );
};

export const B3Html: React.FC<{t: number}> = ({t}) => {
  const n = 10000 * easeInOut(ramp(t, 0.6, 5.2));
  const a = smooth(ramp(t, 0.5, 1.0)) * (1 - smooth(ramp(t, 7.0, 7.6)));
  return (
    <div style={{position: 'absolute', left: 120, top: 210, opacity: a, padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.55)'}}>
      <div style={{fontFamily: FONT_ZH, fontSize: 22, color: 'rgba(255,255,255,0.7)'}}>AI 芯片 <span style={{fontFamily: FONT_EN, fontSize: 16, letterSpacing: 2}}>AI CHIPS</span></div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 6}}><Odometer value={n} size={64} color="#f0dcff" /><span style={{fontFamily: FONT_MONO_FALLBACK, fontSize: 48, color: '#f0dcff', fontWeight: 700}}>+</span></div>
      <div style={{fontFamily: FONT_ZH, fontSize: 18, color: 'rgba(255,255,255,0.6)'}}>上万块 · 量级示意 <span style={{fontFamily: FONT_EN}}>order of magnitude</span></div>
    </div>
  );
};
const FONT_MONO_FALLBACK = '"JetBrains Mono", monospace';
export const _b3 = hash1;
