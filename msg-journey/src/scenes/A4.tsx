import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Orb, Stars, Streak} from '../three/common';
import {easeInOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C} from '../theme';

const PHONE = new THREE.Vector3(-7, 0.4, 0), ONT = new THREE.Vector3(-2.6, 0, 0), F0 = -1.6, F1 = 60, FR = 0.42;

function zigzag() {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let x = F0, y = 0.0, up = 1;
  const pts: THREE.Vector3[] = [new THREE.Vector3(x, 0, 0)];
  while (x < F1) { x += 1.15; y = up * FR * 0.82; up *= -1; pts.push(new THREE.Vector3(x, y, Math.sin(x * 0.7) * 0.06)); }
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return path;
}

export const A4Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const zz = useMemo(zigzag, []);
  const travel = ramp(t, 2.2, dur + 1.5);
  const headU = 0.02 + travel * 0.5;
  const pk = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), new THREE.MeshBasicMaterial({color: new THREE.Color(C.gold).multiplyScalar(2.4), toneMapped: false}), 220);
    m.frustumCulled = false; return m;
  }, []);
  const o = new THREE.Object3D(), v = new THREE.Vector3();
  for (let k = 0; k < 220; k++) {
    const u = headU - 0.004 - k * 0.0011;
    if (u <= 0.0005) { o.scale.setScalar(0); }
    else { zz.getPointAt(u, v); o.position.set(v.x, v.y * 0.85 + (hash1(k) - 0.5) * 0.12, v.z + (hash1(k * 2) - 0.5) * 0.25); o.scale.setScalar(1); }
    o.updateMatrix(); pk.setMatrixAt(k, o.matrix);
  }
  pk.instanceMatrix.needsUpdate = true;
  const head = new THREE.Vector3(); zz.getPointAt(Math.min(headU, 0.999), head);
  // camera: phone -> ONT -> dive into the fibre
  const a = easeInOut(ramp(t, 1.4, 4.2)), d = easeInOut(ramp(t, 4.4, dur));
  const camPos: [number, number, number] = [lerp(lerp(-6, -2.5, a), head.x - 3.2, d), lerp(lerp(1.6, 1.4, a), 0.25, d), lerp(lerp(7.5, 6.5, a), 0.9, d)];
  const camTgt: [number, number, number] = [lerp(lerp(-5, -1, a), head.x + 4, d), lerp(0.2, 0, d), 0];
  const rings = [0, 1, 2, 3, 4].map((i) => ((t * 0.9 + i / 5) % 1));
  const fiberOn = smooth(ramp(t, 2.0, 2.6));
  return (
    <>
      <CameraRig pos={camPos} target={camTgt} fov={42} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 10, 45]} />
      <Stars t={t} />
      <GridFloor y={-1.8} color="#1f6bff" fade={18} opacity={0.55} />
      <Dust t={t} count={500} spread={[50, 10, 16]} center={[10, 0, 0]} />
      {/* phone */}
      <group position={PHONE.toArray()} rotation={[0, 0.5, 0]}>
        <RoundedBox args={[0.9, 1.8, 0.1]} radius={0.08} smoothness={4}><meshStandardMaterial color="#141a3a" metalness={0.6} roughness={0.3} /></RoundedBox>
        <mesh position={[0, 0, 0.056]}><planeGeometry args={[0.78, 1.62]} /><meshBasicMaterial color={new THREE.Color('#1c3a7a').multiplyScalar(1.4)} toneMapped={false} /></mesh>
      </group>
      {/* radio waves */}
      {rings.map((r, i) => (
        <mesh key={i} position={[lerp(PHONE.x + 0.4, ONT.x - 0.3, r), PHONE.y * (1 - r), 0]} rotation={[0, Math.PI / 2, 0]} scale={0.3 + r * 1.2}>
          <torusGeometry args={[1, 0.02, 8, 64]} />
          <meshBasicMaterial color={new THREE.Color(C.cyan).multiplyScalar(2)} transparent opacity={(1 - r) * 0.8 * (1 - smooth(ramp(t, 3.5, 4.5)))} toneMapped={false} />
        </mesh>
      ))}
      <Label3D text="电磁波" sub="RADIO WAVES" size={52} height={0.5} color={C.cyan} position={[-4.9, 1.6, 0]} opacity={1 - smooth(ramp(t, 4, 5))} emissive={1.3} />
      {/* ONT / optical modem */}
      <group position={ONT.toArray()}>
        <RoundedBox args={[1.4, 0.4, 1.0]} radius={0.06} smoothness={3}><meshStandardMaterial color="#10142e" emissive="#0c3a66" emissiveIntensity={0.5} metalness={0.5} roughness={0.35} /></RoundedBox>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[-0.45 + i * 0.3, 0.21, 0.35]}><boxGeometry args={[0.08, 0.02, 0.08]} /><meshBasicMaterial color={new THREE.Color(i === 3 ? C.gold : '#5cff9a').multiplyScalar(Math.floor(t * 8 + i * 3) % 3 ? 2.5 : 0.6)} toneMapped={false} /></mesh>)}
        <Label3D text="光猫" sub="OPTICAL MODEM · 电 → 光" size={52} height={0.55} color="#dff8ff" position={[0, 0.9, 0]} opacity={1 - smooth(ramp(t, 4.6, 5.4))} emissive={1.2} />
      </group>
      {/* fibre: glass cladding + faint core */}
      <mesh position={[(F0 + F1) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[FR, FR, F1 - F0, 40, 1, true]} />
        <meshStandardMaterial color="#8fd8ff" transparent opacity={0.13} metalness={0.1} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} emissive="#1a5a8a" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[(F0 + F1) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[FR * 1.02, FR * 1.02, F1 - F0, 40, 1, true]} />
        <meshBasicMaterial color={new THREE.Color(C.cyan)} wireframe transparent opacity={0.05} />
      </mesh>
      {t > 2.0 ? <Streak curve={zz} head={headU} length={0.12} color="#bff4ff" count={260} size={0.22} opacity={fiberOn} /> : null}
      <primitive object={pk} />
      {t > 2.0 ? <Orb position={[head.x, head.y, head.z]} color={C.cyan} r={0.06} intensity={6} glow={10} /> : null}
      <Glow position={[F0, 0, 0]} color={C.cyan} size={1.5} opacity={fiberOn} />
      <Label3D text="光纤 · 全反射" sub="FIBRE · TOTAL INTERNAL REFLECTION" size={52} height={0.5} color="#bff4ff" position={[3.2, 1.1, 0]} opacity={smooth(ramp(t, 2.6, 3.2)) * (1 - smooth(ramp(t, 5.2, 5.8)))} emissive={1.2} />
      <pointLight position={[-4, 4, 5]} intensity={60} color="#cfe8ff" />
      <ambientLight intensity={0.4} />
    </>
  );
};
