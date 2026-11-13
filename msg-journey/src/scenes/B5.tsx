import {ev} from '../timeline';
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, GridFloor, Label3D, Stars} from '../three/common';
import {drawPhoto, labelTexture, toTex} from '../lib/canvas';
import {easeInOut, easeOutBack, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';

// 384x256 px photo -> 24 x 16 patches of 16x16 px = 384 patches (illustrative resolution)
const GX = 24, GY = 16, NP = GX * GY;
const PH_W = 6.0, PH_H = 4.0, PH_C = new THREE.Vector3(3.6, 1.5, 0);
const CELL = PH_W / GX;
export const B5_SPLIT = ev('B5', 0.8, false), B5_GRID = ev('B5', 6.4, false), B5_FLY = ev('B5', 7.0, false), B5_FLY_END = 12.0, B5_NUM = ev('B5', 12.4, false);
const Q0 = new THREE.Vector3(-4.6, 0.2, 1.2), QDIR = new THREE.Vector3(0.42, 0.04, -1).normalize(), QSTEP = 0.5;
const qPos = (q: number, out = new THREE.Vector3()) => out.copy(Q0).addScaledVector(QDIR, q * QSTEP);

const patchVert = /* glsl */`
attribute vec2 aUv; attribute float aGlow; varying vec2 vUv; varying vec2 vLocal; varying float vGlow; varying float vFade;
void main(){
  vLocal = uv; vUv = aUv + uv * vec2(${(1 / GX).toFixed(6)}, ${(1 / GY).toFixed(6)}); vGlow = aGlow;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vFade = exp(-max(-mv.z - 14.0, 0.0) / 80.0);
  gl_Position = projectionMatrix * mv;
}`;
const patchFrag = /* glsl */`
uniform sampler2D map; uniform float uNum; uniform float uGrid; varying vec2 vUv; varying vec2 vLocal; varying float vGlow; varying float vFade;
void main(){
  vec3 c = texture2D(map, vUv).rgb; c = pow(c, vec3(0.6)) * 1.35 + vec3(0.05, 0.03, 0.1);
  float e = max(abs(vLocal.x - 0.5), abs(vLocal.y - 0.5));
  float edge = smoothstep(0.455, 0.5, e) * uGrid;
  vec3 gold = vec3(1.0, 0.76, 0.29);
  c = mix(c, gold * (0.9 + vGlow * 1.2), edge * (0.45 + vGlow * 0.3));
  c = mix(c, vec3(0.62, 0.42, 1.0) * 1.3, uNum * (0.6 + 0.4 * edge));
  gl_FragColor = vec4(c * vFade + vec3(0.04, 0.02, 0.1) * (1.0 - vFade), 1.0);
}`;

const TokenCube: React.FC<{ch: string; position: THREE.Vector3; scale: number; num: number}> = ({ch, position, scale, num}) => {
  const {tex} = useMemo(() => labelTexture({text: ch, size: 140, w: 200, h: 200, pad: 0, color: '#eaffff'}), [ch]);
  return (
    <group position={position} scale={scale}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b3346" emissive={new THREE.Color(C.cyan).lerp(new THREE.Color('#9f6bff'), num)} emissiveIntensity={0.9} metalness={0.3} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.502]}>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} color={new THREE.Color(1.5, 1.5, 1.5)} />
      </mesh>
    </group>
  );
};

export const B5Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const photoTex = useMemo(() => toTex(drawPhoto(384, 256)), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({vertexShader: patchVert, fragmentShader: patchFrag, uniforms: {map: {value: photoTex}, uNum: {value: 0}, uGrid: {value: 0}}}), [photoTex]);
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const uvs = new Float32Array(NP * 2), glow = new Float32Array(NP);
    for (let k = 0; k < NP; k++) { const i = k % GX, j = Math.floor(k / GX); uvs.set([i / GX, 1 - (j + 1) / GY], k * 2); }
    geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));
    geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 1));
    const m = new THREE.InstancedMesh(geo, mat, NP); m.frustumCulled = false; return m;
  }, [mat]);
  const glowAttr = mesh.geometry.getAttribute('aGlow') as THREE.InstancedBufferAttribute;
  const gridIn = smooth(ramp(t, B5_GRID, B5_GRID + 0.6));
  const num = smooth(ramp(t, B5_NUM, B5_NUM + 1.0));
  mat.uniforms.uNum.value = num;
  mat.uniforms.uGrid.value = gridIn;
  const o = new THREE.Object3D(); const a = new THREE.Vector3(), b = new THREE.Vector3();
  const flySpan = B5_FLY_END - B5_FLY;
  for (let k = 0; k < NP; k++) {
    const i = k % GX, j = Math.floor(k / GX);
    a.set(PH_C.x - PH_W / 2 + (i + 0.5) * CELL, PH_C.y + PH_H / 2 - (j + 0.5) * CELL, PH_C.z);
    // split: gaps open between patches when the grid appears
    a.x += (i - GX / 2 + 0.5) * 0.02 * gridIn; a.y -= (j - GY / 2 + 0.5) * 0.02 * gridIn;
    const launch = B5_FLY + (k / NP) * (flySpan - 1.1);
    const p = easeInOut(ramp(t, launch, launch + 1.1));
    qPos(k + 2, b);
    const lift = Math.sin(p * Math.PI) * (1.5 + hash1(k) * 1.2);
    o.position.set(lerp(a.x, b.x, p), lerp(a.y, b.y, p) + lift, lerp(a.z, b.z, p));
    const s = lerp(CELL * (1 - 0.06 * gridIn), 0.44, p);
    o.scale.set(s, s, 1);
    o.rotation.set(0, lerp(0, -0.42, p), Math.sin(p * Math.PI) * (hash1(k * 3) - 0.5) * 1.5);
    o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    glowAttr.setX(k, p > 0 && p < 1 ? 1 : num * (0.5 + 0.5 * Math.sin(t * 6 + k * 0.7)));
  }
  mesh.instanceMatrix.needsUpdate = true; glowAttr.needsUpdate = true;
  // text tokens
  const sp = easeOutBack(ramp(t, B5_SPLIT, B5_SPLIT + 0.7));
  const toQ = easeInOut(ramp(t, 5.4, 6.6));
  const tk = ['在', '吗'].map((ch, i) => {
    const start = new THREE.Vector3(-5.2 + (i - 0.5) * lerp(0.3, 1.25, sp), 2.6, 0.8);
    const end = qPos(i);
    return {ch, pos: start.lerp(end, toQ), scale: lerp(1.0, 0.36, toQ)};
  });
  const intro = easeInOut(ramp(t, 0, 3));
  const late = easeInOut(ramp(t, B5_FLY, B5_FLY_END + 1.5));
  const camPos: [number, number, number] = [lerp(lerp(-1, -2.6, intro), -9.5, late), lerp(lerp(2.2, 2.0, intro), 3.4, late), lerp(lerp(13, 13.5, intro), 10.5, late)];
  const camTarget: [number, number, number] = [lerp(lerp(-1, -0.5, intro), 0.5, late), lerp(1.2, -0.2, late), lerp(0, -8, late)];
  return (
    <>
      <CameraRig pos={camPos} target={camTarget} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 20, 70]} />
      <Stars t={t} tint="#d8b0ff" />
      <GridFloor y={-2.4} color="#8a3cff" fade={24} opacity={0.55} />
      <Dust t={t} count={500} spread={[34, 14, 40]} center={[0, 1, -8]} color="#ffd8a8" opacity={0.35} />
      <primitive object={mesh} />
      {/* photo frame + grid lines */}
      <mesh position={[PH_C.x, PH_C.y, PH_C.z - 0.03]}>
        <planeGeometry args={[PH_W + 0.6, PH_H + 0.6]} />
        <meshBasicMaterial color={new THREE.Color(C.gold).multiplyScalar(1.4)} toneMapped={false} transparent opacity={0.35 * (1 - ramp(t, B5_FLY, B5_FLY_END))} wireframe />
      </mesh>
      {t < 0.9 ? <Label3D text="在吗" color={C.cyan} size={120} height={1.0} position={[-5.2, 2.6, 0.8]} emissive={1.6} opacity={1 - ramp(t, 0.6, 0.9)} /> : null}
      {tk.map((x) => <TokenCube key={x.ch} ch={x.ch} position={x.pos} scale={x.scale * (t < B5_SPLIT ? 0 : 1)} num={num} />)}
      <Label3D text="16×16 px" font="mono" size={44} height={0.32} color="#ffe2a8" position={[PH_C.x + PH_W / 2 - 0.7, PH_C.y + PH_H / 2 + 0.45, 0]} opacity={gridIn * (1 - ramp(t, B5_FLY + 1, B5_FLY + 2))} emissive={1.3} />
      <pointLight position={[-4, 6, 8]} intensity={80} color="#cfe8ff" />
      <ambientLight intensity={0.5} />
    </>
  );
};

export const B5Html: React.FC<{t: number}> = ({t}) => {
  const a1 = smooth(ramp(t, 1.2, 1.8));
  const a2 = smooth(ramp(t, B5_GRID, B5_GRID + 0.6));
  const flySpan = B5_FLY_END - B5_FLY - 1.1;
  const inQueue = Math.min(NP, Math.max(0, ((t - B5_FLY - 1.1) / flySpan) * NP));
  const num = smooth(ramp(t, B5_NUM, B5_NUM + 1));
  const lbl: React.CSSProperties = {fontFamily: FONT_ZH, fontSize: 21, color: 'rgba(255,255,255,0.68)'};
  const vec = (s: number) => Array.from({length: 4}, (_, i) => (Math.sin(s * 3.1 + i * 1.7 + Math.floor(t * 8)) * 0.99).toFixed(2)).join(', ');
  return (
    <div style={{position: 'absolute', left: 96, top: 190, padding: '16px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.5)', minWidth: 420}}>
      <div style={{opacity: a1}}>
        <div style={lbl}>文字 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>TEXT</span> “在吗”</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}><span style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: 60, color: C.cyan}}>2</span><span style={{fontFamily: FONT_EN, fontSize: 24, color: C.cyan}}>tokens</span><span style={{...lbl, fontSize: 16}}>（常见分词器 2–3 个）</span></div>
      </div>
      <div style={{opacity: a2, marginTop: 10}}>
        <div style={lbl}>图片 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>IMAGE</span> 384×256 px <span style={{fontSize: 16}}>（示意）</span></div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}><Odometer value={inQueue} size={60} color={C.goldHot} /><span style={{fontFamily: FONT_EN, fontSize: 24, color: C.goldHot}}>/ 384 patches</span></div>
        <div style={{...lbl, fontSize: 16}}>24 × 16 块，每块 16×16 像素</div>
      </div>
      <div style={{opacity: num, marginTop: 14, fontFamily: FONT_MONO, fontSize: 19, color: '#d8c2ff'}}>
        <div style={{fontFamily: FONT_ZH, fontSize: 20}}>全部变成数字 <span style={{fontFamily: FONT_EN, fontSize: 16}}>· all become numbers</span></div>
        <div>[{vec(1)}, …]</div>
        <div>[{vec(2)}, …]</div>
      </div>
    </div>
  );
};

