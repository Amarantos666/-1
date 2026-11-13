import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Stars} from '../three/common';
import {Crystal, MemoryBoard, OUR_SLOT, slotPos} from '../three/Memory';
import {decay, easeIn, easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';

export const B6_FLASH = 2.6, B6_FLASH_END = 5.6, B6_FORM = 5.8, B6_DOCK = 8.6, B6_LAND = 10.2;
const STACK = new THREE.Vector3(0, 2.4, -5.5), LAYERS = 12, LAYER_GAP = 0.34, PLATE = 4.2;
const BOARD_Y = -1.4;
const NB = 420; // input blocks rising into the stack

export const stackLayerY = (i: number) => STACK.y + (i - (LAYERS - 1) / 2) * LAYER_GAP;
const crystalHome = (): [number, number, number] => { const p = slotPos(OUR_SLOT.c, OUR_SLOT.r); return [p[0], BOARD_Y + 0.7, p[2]]; };

export function b6Cam(t: number) {
  const a = easeInOut(ramp(t, B6_FORM + 1.6, B6_LAND));
  const pos = new THREE.Vector3(lerp(Math.sin(t * 0.25) * 1.2, 4.2, a), lerp(3.6, 2.4, a), lerp(6.5, 7.0, a));
  const tgt = new THREE.Vector3(lerp(0, 0, a), lerp(STACK.y + 0.4, BOARD_Y + 0.9, a), lerp(STACK.z, 0.8, a));
  return {pos, tgt};
}

export const B6Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  // rising input blocks (all at once: prefill reads in parallel)
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({toneMapped: false}), NB);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NB * 3), 3); m.frustumCulled = false; return m;
  }, []);
  const o = new THREE.Object3D(); const col = new THREE.Color();
  const gold = new THREE.Color(C.gold).multiplyScalar(1.8), cyan = new THREE.Color(C.cyan).multiplyScalar(2.2), vio = new THREE.Color('#c08bff').multiplyScalar(1.6);
  for (let k = 0; k < NB; k++) {
    const gx = (hash1(k * 1.7) - 0.5) * PLATE * 0.9, gz = (hash1(k * 2.9) - 0.5) * PLATE * 0.9;
    const p = easeInOut(ramp(t, 0.1 + hash1(k * 5.3) * 0.5, 2.2 + hash1(k * 5.3) * 0.5));
    const y = lerp(STACK.y - 6, stackLayerY(LAYERS - 1) + 0.2, p);
    o.position.set(STACK.x + gx * lerp(1.6, 1, p), y, STACK.z + gz * lerp(1.6, 1, p));
    o.scale.setScalar(0.13 * (1 - smooth(ramp(t, 2.4, 3.2))));
    o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    col.copy(k < 3 ? cyan : k < 60 ? vio : gold); mesh.setColorAt(k, col);
  }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // flashback arcs between layer nodes
  const flash = smooth(ramp(t, B6_FLASH, B6_FLASH + 0.3)) * (1 - smooth(ramp(t, B6_FLASH_END - 0.4, B6_FLASH_END)));
  const arcs = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 46; i++) {
      const l = Math.floor(hash1(i * 3.1) * (LAYERS - 1));
      const a = new THREE.Vector3(STACK.x + (hash1(i * 1.1) - 0.5) * PLATE * 0.8, stackLayerY(l), STACK.z + (hash1(i * 2.2) - 0.5) * PLATE * 0.8);
      const b = new THREE.Vector3(STACK.x + (hash1(i * 4.4) - 0.5) * PLATE * 0.8, stackLayerY(l + 1), STACK.z + (hash1(i * 5.5) - 0.5) * PLATE * 0.8);
      const m = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.6 + hash1(i) * 0.6, 0));
      out.push(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, m, b).getPoints(24)));
    }
    return out;
  }, []);
  // crystal: condense above the stack, then descend into our VRAM slot
  const form = easeOut(ramp(t, B6_FORM, B6_FORM + 1.6));
  const dock = easeInOut(ramp(t, B6_DOCK, B6_LAND));
  const home = crystalHome();
  const above: [number, number, number] = [STACK.x, stackLayerY(LAYERS - 1) + 1.6, STACK.z];
  const cpos: [number, number, number] = [lerp(above[0], home[0], dock), lerp(above[1], home[1], dock) + Math.sin(dock * Math.PI) * 1.2, lerp(above[2], home[2], dock)];
  const land = decay(t, B6_LAND, 3);
  const cam = b6Cam(t);
  return (
    <>
      <CameraRig pos={[cam.pos.x, cam.pos.y, cam.pos.z]} target={[cam.tgt.x, cam.tgt.y, cam.tgt.z]} fov={42} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 14, 46]} />
      <Stars t={t} tint="#e0b8ff" />
      <GridFloor y={BOARD_Y - 0.02} color="#8a3cff" fade={18} opacity={0.4} />
      <Dust t={t} count={600} spread={[26, 12, 26]} center={[0, 2, -2]} color="#ffd8a8" opacity={0.35} />
      {/* the model: stacked translucent layers */}
      {Array.from({length: LAYERS}, (_, i) => {
        const y = stackLayerY(i);
        const wave = Math.exp(-Math.pow((t * 4.5 - i * 0.5) % 9 - 1.5, 2) * 0.8) * (t < B6_FORM ? 1 : 0.3);
        return (
          <group key={i} position={[STACK.x, y, STACK.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[PLATE, PLATE]} />
              <meshBasicMaterial color={new THREE.Color('#7a3cff').lerp(new THREE.Color('#ff3db8'), i / LAYERS).multiplyScalar(0.25 + wave * 0.7)} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(PLATE, PLATE)]} />
              <lineBasicMaterial color={new THREE.Color('#d9a8ff').multiplyScalar(1 + wave * 1.5)} toneMapped={false} />
            </lineSegments>
          </group>
        );
      })}
      <primitive object={mesh} />
      {flash > 0.01 ? arcs.map((pts, i) => (
        <line key={i} geometry={pts as never}>
          <lineBasicMaterial color={new THREE.Color('#9ff3ff').multiplyScalar(2.2)} transparent opacity={flash * (0.5 + 0.5 * hash1(i))} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      )) : null}
      {flash > 0.01 ? <Label3D text="注意力机制 → 见上期" sub="ATTENTION → SEE LAST EPISODE" color="#bff4ff" size={56} height={0.75} position={[STACK.x + 3.6, stackLayerY(LAYERS - 1) + 0.9, STACK.z + 0.6]} opacity={flash} emissive={1.3} /> : null}
      <Glow position={[STACK.x, STACK.y, STACK.z]} color="#9b5cff" size={9} opacity={0.35 + flash * 0.3} />
      {/* memory board */}
      <MemoryBoard t={t} position={[0, BOARD_Y, 0]} />
      {t > B6_FORM ? <Crystal position={cpos} scale={0.62 * form * (1 + land * 0.15)} spin={t * 0.6} intensity={1.35 + land * 1.2} glow={0.8 + land} /> : null}
      {/* condensing sparks */}
      {t > B6_FORM - 0.3 && t < B6_FORM + 1.6 ? Array.from({length: 18}, (_, i) => {
        const a = (i / 18) * Math.PI * 2, rr = lerp(2.6, 0, easeIn(ramp(t, B6_FORM - 0.3, B6_FORM + 1.4)));
        return <Glow key={i} position={[above[0] + Math.cos(a + t) * rr, above[1] + Math.sin(i * 1.3) * rr * 0.4, above[2] + Math.sin(a + t) * rr]} color={i % 3 ? '#c08bff' : C.gold} size={0.5} />;
      }) : null}
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 6, 5]} intensity={80} color="#e7d0ff" />
    </>
  );
};

export const B6Html: React.FC<{t: number}> = ({t}) => {
  const flash = smooth(ramp(t, B6_FLASH, B6_FLASH + 0.2)) * (1 - smooth(ramp(t, B6_FLASH_END - 0.3, B6_FLASH_END)));
  const kv = smooth(ramp(t, B6_LAND - 0.6, B6_LAND));
  const vram = smooth(ramp(t, B6_DOCK, B6_DOCK + 0.6));
  return (
    <>
      <div style={{position: 'absolute', left: 300, top: 470, opacity: kv, textAlign: 'right', padding: '10px 20px', borderRadius: 10, background: 'rgba(10,8,30,0.6)', borderRight: `3px solid ${C.goldHot}`}}>
        <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 40, color: '#ffe2a8'}}>记忆晶体</div>
        <div style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 3, color: '#ffe2a8cc'}}>KV CACHE · 你的这段对话</div>
      </div>
      <div style={{position: 'absolute', left: 96, top: 200, opacity: vram, padding: '10px 20px', borderRadius: 10, background: 'rgba(10,8,30,0.55)'}}>
        <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 30, color: '#e2c4ff'}}>显存 <span style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 3}}>GPU MEMORY</span></div>
        <div style={{fontFamily: FONT_ZH, fontSize: 18, color: 'rgba(255,255,255,0.65)'}}>每个格子 = 一位用户正在进行的请求</div>
      </div>
      {/* flashback frame: thin border + tag, like an inserted clip */}
      <div style={{position: 'absolute', inset: 24, border: `2px solid rgba(160,240,255,${0.5 * flash})`, borderRadius: 8, opacity: flash}} />
      <div style={{position: 'absolute', left: 96, top: 140, opacity: flash, fontFamily: FONT_ZH, fontSize: 22, color: '#bff4ff', letterSpacing: 2}}>
        ◀◀ 上期回顾 <span style={{fontFamily: FONT_EN, fontSize: 16, letterSpacing: 3}}>FLASHBACK · ATTENTION IS ALL YOU NEED</span>
      </div>
    </>
  );
};
