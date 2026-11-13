import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow} from './common';
import {hash1, mulberry32} from '../lib/math';

// ---------- Faceted crystal that can shatter into its triangular faces ----------
type CrystalProps = {
  position: [number, number, number]; scale?: number; colorA?: string; colorB?: string;
  shatter?: number;    // 0..1 how far the shards have flown
  crack?: number;      // 0..1 hairline separation before shatter
  grey?: number;       // 0..1 desaturate to cold grey
  intensity?: number; spin?: number; seed?: number; glow?: number;
};
export const Crystal: React.FC<CrystalProps> = ({position, scale = 1, colorA = '#9B5CFF', colorB = '#FFC24A', shatter = 0, crack = 0, grey = 0, intensity = 2.2, spin = 0, seed = 1, glow = 1}) => {
  const base = useMemo(() => {
    // cluster: one tall crystal + 4 smaller ones, all as non-indexed triangles
    const parts: THREE.BufferGeometry[] = [];
    const r = mulberry32(seed);
    const mk = (sx: number, sy: number, px: number, py: number, pz: number, rz: number, rx: number) => {
      const g = new THREE.OctahedronGeometry(1, 2);
      g.scale(sx, sy, sx); g.rotateZ(rz); g.rotateX(rx); g.translate(px, py, pz);
      parts.push(g);
    };
    mk(0.55, 1.35, 0, 0.2, 0, 0, 0);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + r(); mk(0.28 + r() * 0.1, 0.7 + r() * 0.3, Math.cos(a) * 0.45, -0.25, Math.sin(a) * 0.45, Math.cos(a) * 0.5, Math.sin(a) * 0.5); }
    const pos: number[] = [];
    for (const g of parts) pos.push(...(g.getAttribute('position').array as Float32Array));
    const n = pos.length / 9;
    const cent = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < n; f++) {
      a.fromArray(pos, f * 9); b.fromArray(pos, f * 9 + 3); c.fromArray(pos, f * 9 + 6);
      const ce = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      const no = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      cent.set([ce.x, ce.y, ce.z], f * 3); nrm.set([no.x, no.y, no.z], f * 3);
    }
    return {pos: new Float32Array(pos), cent, nrm, n};
  }, [seed]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.pos.length), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.pos.length), 3));
    return g;
  }, [base]);
  const P = geo.getAttribute('position') as THREE.BufferAttribute, Col = geo.getAttribute('color') as THREE.BufferAttribute;
  const cA = new THREE.Color(colorA), cB = new THREE.Color(colorB), gr = new THREE.Color('#7d8798');
  const light = new THREE.Vector3(0.4, 0.8, 0.5).normalize();
  const v = new THREE.Vector3(), ce = new THREE.Vector3(), no = new THREE.Vector3(), axis = new THREE.Vector3(), col = new THREE.Color();
  const q = new THREE.Quaternion();
  for (let f = 0; f < base.n; f++) {
    ce.fromArray(base.cent, f * 3); no.fromArray(base.nrm, f * 3);
    const h1 = hash1(f * 1.3 + seed), h2 = hash1(f * 2.7 + seed), h3 = hash1(f * 4.1 + seed);
    const fly = shatter * (1.0 + h1 * 2.2);
    const off = no.clone().multiplyScalar(crack * 0.06 + fly).add(new THREE.Vector3((h2 - 0.5) * fly, fly * (0.4 + h3) + shatter * shatter * 1.5, (h3 - 0.5) * fly));
    axis.set(h2 - 0.5, h3 - 0.5, h1 - 0.5).normalize();
    q.setFromAxisAngle(axis, shatter * (2 + h1 * 6));
    const shrink = (1 - Math.min(1, Math.max(0, (shatter - 0.08 - h2 * 0.3) * 2.0))) * (1 - 0.45 * Math.min(1, shatter * 3));
    const lit = 0.45 + 0.75 * Math.max(0, no.dot(light));
    col.copy(cA).lerp(cB, Math.min(1, Math.max(0, (ce.y + 1) / 2.4))).multiplyScalar(lit * intensity);
    col.lerp(gr.clone().multiplyScalar(lit * 1.25), grey);
    for (let k = 0; k < 3; k++) {
      v.fromArray(base.pos, f * 9 + k * 3).sub(ce).applyQuaternion(q).multiplyScalar(shrink).add(ce).add(off);
      P.setXYZ(f * 3 + k, v.x, v.y, v.z);
      Col.setXYZ(f * 3 + k, col.r, col.g, col.b);
    }
  }
  P.needsUpdate = true; Col.needsUpdate = true;
  const glowCol = useMemo(() => new THREE.Color(colorA).lerp(new THREE.Color(colorB), 0.3).getStyle(), [colorA, colorB]);
  return (
    <group position={position} scale={scale} rotation={[0, spin, 0]}>
      <mesh geometry={geo} frustumCulled={false}><meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <Glow color={grey > 0.5 ? '#8f9bb0' : glowCol} size={4.2} opacity={glow * (1 - shatter) * (1 - grey * 0.6)} />
    </group>
  );
};

// ---------- GPU memory board with slots holding other users' crystals ----------
export const SLOT_COLS = 7, SLOT_ROWS = 4, SLOT_GAP = 1.7;
export const OUR_SLOT = {c: 3, r: 3};
export const slotPos = (c: number, r: number, y = 0): [number, number, number] => [(c - (SLOT_COLS - 1) / 2) * SLOT_GAP, y, (r - (SLOT_ROWS - 1) / 2) * SLOT_GAP];
const OTHER = ['#3fd0c9', '#ff8a4c', '#7bd36b', '#ff6f91', '#4c9bff', '#f5c04a', '#9aa7ff', '#5fe0a0'];

export const MemoryBoard: React.FC<{t: number; position?: [number, number, number]; grey?: number; ourEmpty?: boolean; hideOthers?: boolean}> = ({t, position = [0, 0, 0], grey = 0, ourEmpty = true, hideOthers = false}) => {
  const W = SLOT_COLS * SLOT_GAP + 0.8, D = SLOT_ROWS * SLOT_GAP + 0.8;
  const rimCol = useMemo(() => new THREE.Color('#b26bff').lerp(new THREE.Color('#7d8798'), grey).multiplyScalar(1.4), [grey]);
  const slots: React.ReactNode[] = [];
  for (let c = 0; c < SLOT_COLS; c++) for (let r = 0; r < SLOT_ROWS; r++) {
    const ours = c === OUR_SLOT.c && r === OUR_SLOT.r;
    const p = slotPos(c, r);
    const h = hash1(c * 7.1 + r * 3.3);
    slots.push(
      <group key={`${c}-${r}`} position={p}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.62, 4, 1, Math.PI / 4]} />
          <meshBasicMaterial color={ours ? new THREE.Color('#ffd27a').multiplyScalar(1.6) : rimCol} toneMapped={false} />
        </mesh>
        {!ours && !hideOthers && h > 0.38 ? (
          <Crystal position={[0, 0.45, 0]} scale={0.25} colorA={OTHER[Math.floor(h * 97) % OTHER.length]} colorB="#ffffff" intensity={0.95} spin={t * 0.3 + h * 6} seed={Math.floor(h * 1000)} grey={grey * 0.7} glow={0.6} />
        ) : null}
      </group>,
    );
  }
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={new THREE.Color('#120d2a').lerp(new THREE.Color('#14161c'), grey)} metalness={0.6} roughness={0.45} />
      </mesh>
      {/* PCB traces */}
      {Array.from({length: 18}, (_, i) => (
        <mesh key={i} position={[-W / 2 + 0.3 + (i / 17) * (W - 0.6), 0.005, D / 2 - 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, 0.3]} />
          <meshBasicMaterial color={new THREE.Color('#ffc24a').lerp(new THREE.Color('#8a93a6'), grey)} />
        </mesh>
      ))}
      <lineSegments position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(W, D)]} />
        <lineBasicMaterial color={rimCol} toneMapped={false} />
      </lineSegments>
      {slots}
      {ourEmpty ? null : null}
    </group>
  );
};
