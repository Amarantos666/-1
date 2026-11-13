import {ev} from '../timeline';
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, GridFloor, Label3D, Stars} from '../three/common';
import {drawPhoto, labelTexture} from '../lib/canvas';
import {clamp, easeInOut, easeOut, easeOutBack, hash1, lerp, mulberry32, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {Odometer, scramble} from '../overlay/Odometer';

const PW = 160, PH = 100; // photo voxels
const N = PW * PH;
const P0 = new THREE.Vector3(4.6, 1.4, 0), PSIZE = 0.04;
const M0 = new THREE.Vector3(4.2, -2.6, -5), MR = 6.5, MH = 27;
export const A2_SHATTER = ev('A2', 2.4, false), A2_SLAM = ev('A2', 6.4), A2_COMPRESS = ev('A2', 8.4, false), A2_ENCRYPT = ev('A2', 11.0, false);
const HEX = ['E5', '9C', 'A8', 'E5', '90', '97'];

function useVoxelData() {
  return useMemo(() => {
    const ph = drawPhoto(PW, PH);
    const px = ph.getContext('2d')!.getImageData(0, 0, PW, PH).data;
    const r = mulberry32(2024);
    const start = new Float32Array(N * 3), end = new Float32Array(N * 3), col = new Float32Array(N * 3), delay = new Float32Array(N), keep = new Uint8Array(N);
    const tmp: {h: number; i: number}[] = [];
    for (let k = 0; k < N; k++) {
      const i = k % PW, j = Math.floor(k / PW);
      start.set([P0.x - (PW * PSIZE) / 2 + (i + 0.5) * PSIZE, P0.y + (PH * PSIZE) / 2 - (j + 0.5) * PSIZE, P0.z], k * 3);
      col.set([px[k * 4] / 255, px[k * 4 + 1] / 255, px[k * 4 + 2] / 255], k * 3);
      // sample a point near the surface of a cone (byte mountain)
      const h = MH * (1 - Math.cbrt(1 - r() * 0.999));
      const rmax = MR * (1 - h / MH);
      const rr = rmax * (0.72 + 0.28 * Math.sqrt(r()));
      const a = r() * Math.PI * 2;
      end.set([M0.x + Math.cos(a) * rr, M0.y + h, M0.z + Math.sin(a) * rr], k * 3);
      tmp.push({h, i: k});
      keep[k] = r() < 0.36 ? 1 : 0;
      delay[k] = (h / MH) * 2.6 + r() * 0.5;
    }
    return {start, end, col, delay, keep};
  }, []);
}

const ByteCube: React.FC<{label: string; position: [number, number, number]; scale: number; t: number; enc: number; i: number}> = ({label, position, scale, t, enc, i}) => {
  const text = enc > 0 ? scramble(label, 1 - enc, t, i + 1).slice(0, 2) : label;
  const shown = enc >= 1 ? scramble('XX', 0, Math.floor(t * 6) / 6, i + 3) : text;
  const {tex} = useMemo(() => labelTexture({text: shown, font: 'mono', size: 110, color: enc > 0.5 ? '#d8f3ff' : '#e9fdff', w: 200, h: 200, pad: 0}), [shown, enc > 0.5]);
  const col = new THREE.Color(C.cyan).lerp(new THREE.Color('#8ca0ff'), enc);
  return (
    <group position={position} scale={scale} rotation={[0.18, -0.25, 0]}>
      <mesh>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#0d2a40" emissive={col} emissiveIntensity={0.55} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.452]}>
        <planeGeometry args={[0.86, 0.86]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} color={new THREE.Color(1.6, 1.6, 1.6)} />
      </mesh>
    </group>
  );
};

export const A2Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const data = useVoxelData();
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({metalness: 0.35, roughness: 0.4, emissive: new THREE.Color('#5a3600'), emissiveIntensity: 0.6}), N);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    m.frustumCulled = false;
    return m;
  }, []);
  const gold = new THREE.Color(C.gold), goldHot = new THREE.Color(C.goldHot), encCol = new THREE.Color('#9fb4ff');
  const comp = easeInOut(ramp(t, A2_COMPRESS, A2_COMPRESS + 1.6));
  const enc = ramp(t, A2_ENCRYPT, A2_ENCRYPT + 1.2);
  const o = new THREE.Object3D(); const c = new THREE.Color(); const pc = new THREE.Color();
  for (let k = 0; k < N; k++) {
    const p = easeInOut(ramp(t, A2_SHATTER + data.delay[k], A2_SHATTER + data.delay[k] + 1.5));
    const sx = data.start[k * 3], sy = data.start[k * 3 + 1], sz = data.start[k * 3 + 2];
    let ex = data.end[k * 3], ey = data.end[k * 3 + 1], ez = data.end[k * 3 + 2];
    // compression: mountain squashes, 64% of bytes disappear
    ey = M0.y + (ey - M0.y) * (1 - 0.62 * comp);
    ex = M0.x + (ex - M0.x) * (1 - 0.25 * comp); ez = M0.z + (ez - M0.z) * (1 - 0.25 * comp);
    const lift = Math.sin(p * Math.PI) * (2 + hash1(k) * 3);
    o.position.set(lerp(sx, ex, p), lerp(sy, ey, p) + lift, lerp(sz, ez, p));
    const vanish = data.keep[k] ? 0 : easeInOut(ramp(comp, hash1(k * 3.1) * 0.6, hash1(k * 3.1) * 0.6 + 0.4));
    const s = lerp(PSIZE * 0.92, 0.2, easeOut(p)) * (1 - vanish);
    o.scale.setScalar(s);
    o.rotation.set(p * hash1(k + 1) * 6, p * hash1(k + 2) * 6, 0);
    o.updateMatrix();
    mesh.setMatrixAt(k, o.matrix);
    pc.setRGB(data.col[k * 3], data.col[k * 3 + 1], data.col[k * 3 + 2]);
    c.copy(gold).lerp(goldHot, hash1(k * 7.3) * 0.6);
    c.lerp(pc, 1 - smooth(p * 1.4));
    if (t < A2_SHATTER) c.copy(pc).multiplyScalar(1.15);
    if (enc > 0) {
      const flick = hash1(k * 1.7 + Math.floor(t * 12) * 5.3);
      c.lerp(encCol, clamp(enc * 1.2 - hash1(k) * 0.3) * (0.55 + 0.45 * flick));
    }
    mesh.setColorAt(k, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  // left: "在吗" -> 6 byte cubes
  const split = easeOutBack(ramp(t, 1.0, 1.8));
  const pull = easeInOut(ramp(t, A2_SHATTER, A2_SLAM));
  const settle = easeInOut(ramp(t, A2_COMPRESS, A2_COMPRESS + 2));
  const camPos: [number, number, number] = [lerp(lerp(0.2, -1.6, pull), 0, settle), lerp(lerp(0.8, 0.2, pull), 2.2, settle), lerp(lerp(12.5, 21, pull), 17, settle)];
  const camTarget: [number, number, number] = [lerp(lerp(0, 1.2, pull), 0.6, settle), lerp(lerp(0.4, 5.6, pull), 1.6, settle), lerp(0, -3, pull)];
  return (
    <>
      <CameraRig pos={camPos} target={camTarget} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 30, 95]} />
      <Stars t={t} />
      <GridFloor y={-2.62} color="#1f6bff" fade={26} opacity={0.7} />
      <Dust t={t} count={500} spread={[50, 30, 40]} center={[0, 6, -5]} color="#ffd79a" opacity={0.35} />
      <primitive object={mesh} />
      {/* photo frame before shatter */}
      <mesh position={[P0.x, P0.y, P0.z - 0.02]}>
        <planeGeometry args={[PW * PSIZE + 0.18, PH * PSIZE + 0.18]} />
        <meshBasicMaterial color={new THREE.Color(C.gold).multiplyScalar(1.6)} toneMapped={false} transparent opacity={1 - ramp(t, A2_SHATTER, A2_SHATTER + 0.4)} />
      </mesh>
      {t < 1.4 ? <Label3D text="在吗" color={C.cyan} size={120} height={1.2} position={[-3.6, 0.6, 2]} emissive={1.6} opacity={1 - ramp(t, 1.0, 1.3)} /> : null}
      {HEX.map((h, i) => (
        <ByteCube key={i} i={i} label={h} t={t} enc={enc} scale={0.62 * split + 0.001} position={[lerp(-4.6, -5.6 + i * 0.78, split), lerp(0.2, 0.2, split) + lerp(0, 2.2, easeInOut(ramp(t, A2_SHATTER, A2_SLAM))) * (1 - easeInOut(ramp(t, A2_COMPRESS, A2_COMPRESS + 2))) + Math.sin(t * 1.5 + i) * 0.05, 2]} />
      ))}
      <pointLight position={[10, 18, 8]} intensity={900} color="#ffd9a0" distance={80} />
      <pointLight position={[-8, 4, 10]} intensity={200} color={C.cyan} distance={50} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 10, 6]} intensity={1.2} color="#fff0d8" />
    </>
  );
};

export const A2Html: React.FC<{t: number}> = ({t}) => {
  const leftA = smooth(ramp(t, 1.4, 1.9));
  const bytes = 3_000_000 * easeInOut(ramp(t, A2_SHATTER + 0.2, A2_SLAM - 0.3));
  const rightA = smooth(ramp(t, A2_SHATTER, A2_SHATTER + 0.5)) * (1 - smooth(ramp(t, A2_COMPRESS + 0.2, A2_COMPRESS + 0.8)));
  const slam = ramp(t, A2_SLAM, A2_SLAM + 0.18);
  const slamA = slam * (1 - smooth(ramp(t, A2_COMPRESS - 0.4, A2_COMPRESS)));
  const compA = smooth(ramp(t, A2_COMPRESS + 0.4, A2_COMPRESS + 0.9)) * (1 - smooth(ramp(t, A2_ENCRYPT - 0.3, A2_ENCRYPT)));
  const encA = smooth(ramp(t, A2_ENCRYPT, A2_ENCRYPT + 0.4));
  const lbl: React.CSSProperties = {fontFamily: FONT_ZH, fontSize: 22, color: 'rgba(255,255,255,0.7)', letterSpacing: 1};
  return (
    <>
      <div style={{position: 'absolute', left: 150, top: 560, opacity: leftA, textAlign: 'left'}}>
        <div style={lbl}>“在吗” · UTF-8</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
          <span style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: 64, color: C.cyan, textShadow: `0 0 18px ${C.cyan}`}}>6</span>
          <span style={{fontFamily: FONT_EN, fontWeight: 600, fontSize: 28, color: C.cyan}}>bytes</span>
        </div>
      </div>
      <div style={{position: 'absolute', right: 120, top: 548, opacity: rightA, textAlign: 'right', padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.72)'}}>
        <div style={lbl}>一张照片 · a photo <span style={{fontSize: 16, opacity: 0.7}}>（约，典型值 ≈ typical）</span></div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'flex-end', textShadow: `0 0 18px ${C.gold}`}}>
                    <Odometer value={bytes} size={64} color={C.goldHot} />
          <span style={{fontFamily: FONT_EN, fontWeight: 600, fontSize: 28, color: C.goldHot}}>bytes</span>
        </div>
      </div>
      {slamA > 0 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 210, textAlign: 'center', opacity: slamA, transform: `scale(${lerp(1.9, 1, easeOut(slam))})`, filter: `blur(${(1 - slam) * 6}px)`}}>
          <div style={{fontFamily: FONT_MONO, fontWeight: 800, fontSize: 132, color: '#fff', textShadow: `0 0 30px ${C.gold}, 0 0 80px ${C.gold}`}}>×500,000</div>
          <div style={{display: 'inline-block', fontFamily: FONT_ZH, fontWeight: 700, fontSize: 36, color: C.goldHot, marginTop: -6, padding: '4px 18px', borderRadius: 8, background: 'rgba(10,10,30,0.55)'}}>大了几十万倍 <span style={{fontFamily: FONT_EN, fontSize: 24, opacity: 0.8}}>· hundreds of thousands ×</span></div>
        </div>
      ) : null}
      <div style={{position: 'absolute', right: 120, top: 552, opacity: compA, textAlign: 'right', padding: '12px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.72)'}}>
        <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 44, color: C.goldHot}}>压缩 <span style={{fontFamily: FONT_EN, fontSize: 26, letterSpacing: 3}}>COMPRESS ↓</span></div>
        <div style={lbl}>体积变小，画质略降 · smaller, slightly lossy</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 170, textAlign: 'center', opacity: encA}}>
        <span style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 44, color: '#cfe0ff', textShadow: '0 0 20px #6f8cff'}}><Lock /> 加密 <span style={{fontFamily: FONT_EN, fontSize: 26, letterSpacing: 3}}>ENCRYPTED</span></span>
        <div style={{fontFamily: FONT_MONO, fontSize: 24, color: 'rgba(200,215,255,0.7)', marginTop: 6}}>{scramble('7F 3A C9 0E 5B D2 81 4C E0 19 A6 2D', 0, t, 5)}<div style={{fontFamily: FONT_ZH, fontSize: 22, marginTop: 4}}>路上谁也看不懂 · unreadable on the way</div></div>
      </div>
      <div style={{position: 'absolute', right: 150, top: 160, fontFamily: FONT_ZH, fontSize: 16, color: 'rgba(255,255,255,0.45)', opacity: rightA}}>不按比例 · NOT TO SCALE</div>
    </>
  );
};

const Lock: React.FC = () => (
  <svg width="34" height="38" viewBox="0 0 34 38" style={{verticalAlign: '-4px', marginRight: 6}}>
    <path d="M8 16 V11 a9 9 0 0 1 18 0 V16" fill="none" stroke="#cfe0ff" strokeWidth="4" />
    <rect x="3" y="16" width="28" height="20" rx="4" fill="#cfe0ff" />
    <rect x="15" y="22" width="4" height="8" rx="2" fill="#2a3470" />
  </svg>
);
