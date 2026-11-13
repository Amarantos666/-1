import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Stars} from '../three/common';
import {mkCanvas, roundRect, toTex} from '../lib/canvas';
import {easeInOut, easeOut, hash1, lerp, mulberry32, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';

// A batch = rows of requests feeding one GPU. Rows finish and leave; new ones board ("continuous batching").
const ROWS = 30, MAXLEN = 26, CUBE = 0.24, GAP = 0.06;
const OURS = 13; // our row index
const STEP = 0.58; // one decode step (≈ one beat at 103 BPM)
export const B4_IN = 1.2;

type Slot = {start: number; end: number; len0: number; hue: number}[];
function schedule(): Slot[] {
  const r = mulberry32(77);
  const rows: Slot[] = [];
  for (let i = 0; i < ROWS; i++) {
    const slots: Slot = [];
    let tt = -r() * 6;
    while (tt < 14) {
      const life = 3 + r() * 7;
      slots.push({start: tt, end: tt + life, len0: 3 + Math.floor(r() * 12), hue: r()});
      tt += life + 1.25 + r() * 0.4;
    }
    rows.push(slots);
  }
  // our request boards at B4_IN and stays for the whole shot
  rows[OURS] = [{start: B4_IN, end: 99, len0: 14, hue: -1}];
  return rows;
}

const PALETTE = ['#3fd0c9', '#ff8a4c', '#7bd36b', '#ff6f91', '#4c9bff', '#f5c04a', '#9aa7ff', '#5fe0a0', '#ff9fcf', '#62c5ff'];

function chipTexture() {
  const c = mkCanvas(1024, 1024); const g = c.getContext('2d')!;
  g.fillStyle = '#0b0820'; g.fillRect(0, 0, 1024, 1024);
  const r = mulberry32(5);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = r();
    g.fillStyle = `rgba(${150 + v * 80},${80 + v * 60},255,${0.15 + v * 0.35})`;
    g.fillRect(60 + i * 57, 60 + j * 57, 50, 50);
  }
  g.strokeStyle = '#d07bff'; g.lineWidth = 8; roundRect(g, 30, 30, 964, 964, 30); g.stroke();
  g.fillStyle = '#ffffff'; g.font = `800 90px ${FONT_EN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = 0.7; g.fillText('GPU', 512, 120);
  return toTex(c);
}

export const B4Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const rows = useMemo(schedule, []);
  const N = ROWS * MAXLEN;
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({metalness: 0.3, roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.0}), N);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    m.frustumCulled = false; return m;
  }, []);
  const chip = useMemo(chipTexture, []);
  const o = new THREE.Object3D(); const col = new THREE.Color();
  const ourCol = new THREE.Color(C.magenta).lerp(new THREE.Color(C.purple), 0.35).multiplyScalar(2.6);
  const stepFrac = (t / STEP) % 1;
  const pulse = Math.exp(-stepFrac * 5);
  const headX = 0; // the GPU face
  for (let i = 0; i < ROWS; i++) {
    const y = (i - (ROWS - 1) / 2) * (CUBE + GAP) * 1.15;
    const s = rows[i].find((q) => t >= q.start - 1.2 && t < q.end + 1.2);
    for (let k = 0; k < MAXLEN; k++) {
      const idx = i * MAXLEN + k;
      if (!s) { o.scale.setScalar(0); o.updateMatrix(); mesh.setMatrixAt(idx, o.matrix); continue; }
      const grown = Math.max(0, Math.floor((t - s.start) / STEP));
      const len = Math.min(MAXLEN, s.len0 + grown);
      const visible = k < len;
      // boarding: slide in from the left; leaving: slide up and out
      const inP = easeOut(ramp(t, s.start - 1.2, s.start));
      const outP = easeInOut(ramp(t, s.end, s.end + 1.2));
      const x = headX - 0.3 - (len - 1 - k) * (CUBE + GAP) - (1 - inP) * 12 - outP * 1.5;
      const z = outP * 1.5;
      const yy = y + outP * 2.5;
      const fresh = k === len - 1 && grown > 0 ? easeOut(stepFrac * 3) : 1;
      o.position.set(x, yy, z);
      o.scale.setScalar((visible ? CUBE : 0) * fresh * (1 - outP) * (1 + (k === len - 1 ? pulse * 0.25 : 0)));
      o.rotation.set(0, 0, 0);
      o.updateMatrix(); mesh.setMatrixAt(idx, o.matrix);
      if (s.hue < 0) col.copy(ourCol);
      else col.set(PALETTE[Math.floor(s.hue * PALETTE.length)]).multiplyScalar(0.55 + 0.25 * pulse);
      if (k === len - 1) col.multiplyScalar(1.6);
      mesh.setColorAt(idx, col);
    }
  }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const ourY = (OURS - (ROWS - 1) / 2) * (CUBE + GAP) * 1.15;
  const intro = easeInOut(ramp(t, 0, 3.5));
  const camPos: [number, number, number] = [lerp(-15, -12, intro) + Math.sin(t * 0.2) * 0.4, lerp(7, 1.6, intro), lerp(17, 16.5, intro)];
  const camTarget: [number, number, number] = [lerp(-2, -3.6, intro), lerp(0, 1.0, intro), 0];
  const h = ROWS * (CUBE + GAP) * 1.15 + 1;
  const ourLen = Math.min(MAXLEN, 14 + Math.max(0, Math.floor((t - B4_IN) / STEP)));
  const ourLabelX = headX - 0.3 - ourLen * (CUBE + GAP) - 0.6 - (1 - easeOut(ramp(t, B4_IN - 1.2, B4_IN))) * 12;
  return (
    <>
      <CameraRig pos={camPos} target={camTarget} fov={42} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 14, 48]} />
      <Stars t={t} tint="#d2a8ff" />
      <GridFloor y={-h / 2 - 0.6} color="#8a3cff" fade={20} opacity={0.6} scroll={[t * 0.6, 0]} />
      <Dust t={t} count={500} spread={[30, 14, 20]} center={[-4, 0, 0]} color="#e3b8ff" opacity={0.35} />
      <primitive object={mesh} />
      {/* GPU slab */}
      <group position={[headX + 0.9, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.8, h, h * 0.62]} />
          <meshStandardMaterial color="#120b2e" emissive="#3a1a7a" emissiveIntensity={0.4 + pulse * 0.6} metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[-0.41, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[h * 0.62, h]} />
          <meshBasicMaterial map={chip} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(0.8 + pulse * 0.7)} />
        </mesh>
        <Glow position={[-0.8, 0, 0]} color={C.purple} size={h * 1.4} opacity={0.25 + pulse * 0.35} />
      </group>
      {/* highlight frame around our row */}
      <mesh position={[headX - 0.3 - (ourLen * (CUBE + GAP)) / 2 + (CUBE + GAP) / 2 - (1 - easeOut(ramp(t, B4_IN - 1.2, B4_IN))) * 12, ourY, 0]}>
        <boxGeometry args={[ourLen * (CUBE + GAP) + 0.2, CUBE + 0.16, CUBE + 0.16]} />
        <meshBasicMaterial color={new THREE.Color(C.magenta).multiplyScalar(1.6)} wireframe transparent opacity={0.8 * smooth(ramp(t, B4_IN, B4_IN + 0.5))} toneMapped={false} />
      </mesh>
      {/* label on our row */}
      <Label3D text="你" sub="YOU" color="#ffd1f4" size={60} height={0.95} position={[ourLabelX - 0.2, ourY, 0.2]} emissive={1.4} opacity={smooth(ramp(t, B4_IN, B4_IN + 0.5))} />
      <pointLight position={[-6, 6, 6]} intensity={120} color="#e7c6ff" />
      <ambientLight intensity={0.5} />
    </>
  );
};

export const B4Html: React.FC<{t: number}> = ({t}) => {
  const rows = useMemo(schedule, []);
  const active = rows.filter((r) => r.some((q) => t >= q.start && t < q.end)).length;
  const a = smooth(ramp(t, 1.0, 1.6));
  const step = Math.floor(t / STEP);
  const lbl: React.CSSProperties = {fontFamily: FONT_ZH, fontSize: 21, color: 'rgba(255,255,255,0.68)'};
  return (
    <div style={{position: 'absolute', left: 96, top: 190, opacity: a, textAlign: 'left', padding: '16px 24px', borderRadius: 12, background: 'rgba(10,8,30,0.55)'}}>
      <div style={lbl}>同一批 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>ONE BATCH</span></div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
        <Odometer value={active} size={60} color="#f4dcff" /><span style={{fontFamily: FONT_ZH, fontSize: 26, color: '#e2b8ff'}}>条请求 <span style={{fontFamily: FONT_EN, fontSize: 18}}>requests</span></span>
      </div>
      <div style={{...lbl, marginTop: 14}}>计算步 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>STEP</span> <span style={{fontFamily: FONT_MONO, color: '#fff'}}>#{String(1000 + step).padStart(4, '0')}</span></div>
      <div style={{...lbl, fontSize: 17, marginTop: 10, lineHeight: '28px'}}>
        <div>每一步，每条请求各写出一个字 <span style={{fontFamily: FONT_EN}}>· one token per row per step</span></div>
        <div>算完的下车，新的随时上车 <span style={{fontFamily: FONT_EN}}>· finished rows leave, new ones join</span></div>
      </div>
    </div>
  );
};

