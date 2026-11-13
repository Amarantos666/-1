import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, GridFloor, Label3D, Stars} from '../three/common';
import {labelTexture} from '../lib/canvas';
import {easeInOut, easeOut, easeOutBack, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';
import {ev} from '../timeline';

export const N_PKT = 2143;
const GX = 47, GY = 46; // 2,162 slots, 2,143 used
const SP = 0.16;
const WALL = new THREE.Vector3(3.2, 1.8, -2);
export const A3_TEXT = ev('A3', 1.2, false), A3_WALL = ev('A3', 2.3, false), A3_DONE = A3_WALL + 4.6;

// packet = gold body + white header strip (address / sequence number)
export const packetGeometry = () => {
  const body = new THREE.BoxGeometry(1, 0.7, 0.35);
  return body;
};

export const A3Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(packetGeometry(), new THREE.MeshStandardMaterial({metalness: 0.3, roughness: 0.4, emissive: new THREE.Color('#5a3a00'), emissiveIntensity: 0.5}), N_PKT);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_PKT * 3), 3); m.frustumCulled = false; return m;
  }, []);
  const tags = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.22), new THREE.MeshBasicMaterial({color: new THREE.Color(1.1, 1.1, 1.15), toneMapped: false}), N_PKT);
    m.frustumCulled = false; return m;
  }, []);
  const o = new THREE.Object3D(), col = new THREE.Color(), gold = new THREE.Color(C.gold), hot = new THREE.Color(C.goldHot);
  const src = new THREE.Vector3(9, -1.5, -6);
  for (let k = 0; k < N_PKT; k++) {
    const i = k % GX, j = Math.floor(k / GX);
    const start = A3_WALL + (k / N_PKT) * 3.6 + hash1(k) * 0.25;
    const p = easeInOut(ramp(t, start, start + 0.9));
    const tx = WALL.x - (GX * SP) / 2 + i * SP, ty = WALL.y + (GY * SP) / 2 - j * SP;
    o.position.set(lerp(src.x + hash1(k * 2) * 2, tx, p), lerp(src.y + hash1(k * 3) * 2, ty, p) + Math.sin(p * Math.PI) * 1.2, lerp(src.z, WALL.z, p));
    o.rotation.set(0, (1 - p) * 2, 0);
    o.scale.setScalar(p > 0 ? SP * 0.82 : 0);
    o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    o.position.y += SP * 0.82 * 0.24; o.position.z += SP * 0.82 * 0.18; o.updateMatrix(); tags.setMatrixAt(k, o.matrix);
    col.copy(gold).lerp(hot, hash1(k * 5.5) * 0.5).multiplyScalar(p < 1 ? 1.4 : 0.75);
    mesh.setColorAt(k, col);
  }
  mesh.instanceMatrix.needsUpdate = true; tags.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // the one text packet
  const tp = easeOutBack(ramp(t, A3_TEXT, A3_TEXT + 0.6)) * 1.25;
  const {tex: hdr} = useMemo(() => labelTexture({text: '#1 → 203.0.113.7', font: 'mono', size: 44, color: '#0a2a3a', bg: '#d8fbff', w: 520, h: 84, pad: 0}), []);
  const intro = easeInOut(ramp(t, 0, 2.5));
  const done = easeInOut(ramp(t, A3_DONE - 1.5, A3_DONE + 1.8));
  const camPos: [number, number, number] = [lerp(lerp(-2, -0.6, intro), 0.4, done), lerp(1.2, 1.6, intro), lerp(lerp(12, 10.5, intro), 13.5, done)];
  const camTgt: [number, number, number] = [lerp(lerp(-1, 0.2, intro), 1.0, done), lerp(1, 1.4, intro), lerp(-1, -2, done)];
  return (
    <>
      <CameraRig pos={camPos} target={camTgt} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 16, 60]} />
      <Stars t={t} />
      <GridFloor y={-2.4} color="#1f6bff" fade={22} opacity={0.6} scroll={[t * 0.3, 0]} />
      <Dust t={t} count={400} spread={[30, 12, 20]} color="#ffd79a" opacity={0.3} />
      <primitive object={mesh} />
      <primitive object={tags} />
      {/* single text packet */}
      <group position={[-3.9, 0.8, 0.5]} scale={tp} rotation={[0.1, 0.35 + Math.sin(t) * 0.05, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 1.4, 0.6]} />
          <meshStandardMaterial color="#0d3346" emissive={C.cyan} emissiveIntensity={0.8} metalness={0.3} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.48, 0.305]}><planeGeometry args={[2.0, 0.32]} /><meshBasicMaterial map={hdr} toneMapped={false} /></mesh>
        <Label3D text="在吗 · 6 B" size={60} height={0.36} color="#e9fdff" position={[0, -0.12, 0.31]} emissive={1.4} />
      </group>
      <Label3D text="1 个包" sub="1 PACKET" size={56} height={0.62} color={C.cyan} position={[-3.9, -1.2, 0.5]} opacity={smooth(ramp(t, A3_TEXT + 0.4, A3_TEXT + 0.9))} emissive={1.3} />
      <pointLight position={[0, 6, 6]} intensity={120} color="#fff0d8" />
      <ambientLight intensity={0.45} />
    </>
  );
};

export const A3Html: React.FC<{t: number}> = ({t}) => {
  const n = N_PKT * Math.min(1, Math.max(0, (t - A3_WALL - 0.6) / 3.8));
  const a = smooth(ramp(t, A3_WALL, A3_WALL + 0.5));
  const zoom = smooth(ramp(t, A3_DONE - 0.5, A3_DONE + 0.4));
  return (
    <>
      <div style={{position: 'absolute', right: 120, top: 210, opacity: a, textAlign: 'right', padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.6)'}}>
        <div style={{fontFamily: FONT_ZH, fontSize: 22, color: 'rgba(255,255,255,0.7)'}}>照片 <span style={{fontFamily: FONT_EN, fontSize: 16, letterSpacing: 2}}>PHOTO</span></div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'flex-end'}}><Odometer value={n} size={68} color={C.goldHot} /><span style={{fontFamily: FONT_ZH, fontSize: 28, color: C.goldHot}}>个包 <span style={{fontFamily: FONT_EN, fontSize: 20}}>packets</span></span></div>
      </div>
      <div style={{position: 'absolute', left: 150, top: 230, opacity: zoom, fontFamily: FONT_MONO, fontSize: 22, color: '#ffe9c4', lineHeight: '34px', padding: '14px 22px', borderRadius: 10, background: 'rgba(10,8,30,0.65)', borderLeft: `3px solid ${C.gold}`}}>
        <div style={{fontFamily: FONT_ZH, fontSize: 20, color: 'rgba(255,255,255,0.7)', marginBottom: 4}}>每个包都贴着编号和地址 <span style={{fontFamily: FONT_EN, fontSize: 15}}>· numbered & addressed</span></div>
        <div>#0001 → 203.0.113.7</div>
        <div>#0002 → 203.0.113.7</div>
        <div style={{opacity: 0.6}}>…</div>
        <div>#2143 → 203.0.113.7</div>
      </div>
    </>
  );
};
export const _a3 = easeOut;
