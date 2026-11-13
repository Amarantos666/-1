import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {CameraRig, Dust, GridFloor, Label3D, Orb, Stars, Streak} from '../three/common';
import {drawPhoto, mkCanvas, roundRect, toTex} from '../lib/canvas';
import {decay, easeInOut, easeOut, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';

export const O1_PRESS = 9.0; // Enter press (beat-aligned later)

type PanelState = {who: 'friend' | 'ai'; typed: string; caret: boolean; attach: number; sent: number};
function drawPanel(s: PanelState) {
  const W = 720, H = 960;
  const c = mkCanvas(W, H); const g = c.getContext('2d')!;
  const ac = s.who === 'friend' ? C.cyan : '#B07CFF';
  // glass body
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(22,28,64,0.94)'); bg.addColorStop(1, 'rgba(10,12,34,0.94)');
  g.fillStyle = bg; roundRect(g, 4, 4, W - 8, H - 8, 44); g.fill();
  g.lineWidth = 4; g.strokeStyle = ac + 'aa'; roundRect(g, 4, 4, W - 8, H - 8, 44); g.stroke();
  // header
  g.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(g, 4, 4, W - 8, 130, 44); g.fill();
  g.fillStyle = ac; g.beginPath(); g.arc(84, 70, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b0f26';
  if (s.who === 'friend') { // generic person glyph
    g.beginPath(); g.arc(84, 60, 12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(84, 90, 20, 12, 0, Math.PI, 0); g.fill();
  } else { // generic four-point sparkle (not any product mark)
    g.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 22; const a = (i / 8) * Math.PI * 2 - Math.PI / 2; g.lineTo(84 + Math.cos(a) * r, 70 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  g.fillStyle = '#fff'; g.font = `700 40px ${FONT_ZH}`; g.textBaseline = 'middle';
  g.fillText(s.who === 'friend' ? '朋友' : 'AI', 140, 60);
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = `500 22px ${FONT_EN}`;
  g.fillText(s.who === 'friend' ? 'Friend · online' : 'Assistant · online', 140, 100);
  // timestamp
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = `500 22px ${FONT_EN}`; g.textAlign = 'center';
  g.fillText('18:42', W / 2, 180); g.textAlign = 'left';
  // sent bubbles
  if (s.sent > 0) {
    const a = s.sent; g.globalAlpha = a;
    const y0 = 230 + (1 - a) * 40;
    const grd = g.createLinearGradient(400, y0, 680, y0 + 90);
    grd.addColorStop(0, ac); grd.addColorStop(1, s.who === 'friend' ? '#2E6BFF' : '#FF3DB8');
    g.fillStyle = grd; roundRect(g, 470, y0, 210, 86, 30); g.fill();
    g.fillStyle = '#081024'; g.font = `700 40px ${FONT_ZH}`; g.fillText('在吗', 535, y0 + 44);
    const ph = drawPhoto(768, 512);
    g.save(); roundRect(g, 300, y0 + 110, 380, 253, 26); g.clip(); g.drawImage(ph, 300, y0 + 110, 380, 253); g.restore();
    g.globalAlpha = 1;
  }
  // input bar
  const iy = H - 130;
  g.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(g, 34, iy, W - 68, 92, 46); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; roundRect(g, 34, iy, W - 68, 92, 46); g.stroke();
  // attach chip
  if (s.attach > 0 && s.sent < 1) {
    g.globalAlpha = s.attach * (1 - s.sent);
    const ph = drawPhoto(768, 512);
    const ay = iy - 150 + (1 - s.attach) * 30;
    g.save(); roundRect(g, 40, ay, 190, 127, 18); g.clip(); g.drawImage(ph, 40, ay, 190, 127); g.restore();
    g.strokeStyle = C.gold; g.lineWidth = 4; roundRect(g, 40, ay, 190, 127, 18); g.stroke();
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = `400 44px ${FONT_EN}`; g.fillText('+', 66, iy + 46);
  const txt = s.sent >= 1 ? '' : s.typed;
  g.fillStyle = '#fff'; g.font = `500 38px ${FONT_ZH}`; g.fillText(txt, 120, iy + 47);
  if (s.caret && s.sent < 1) { const w = g.measureText(txt).width; g.fillStyle = ac; g.fillRect(124 + w, iy + 26, 3, 42); }
  // send arrow
  g.fillStyle = ac; g.beginPath(); g.arc(W - 86, iy + 46, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b0f26'; g.font = `700 32px ${FONT_EN}`; g.textAlign = 'center'; g.fillText('↑', W - 86, iy + 48); g.textAlign = 'left';
  return c;
}

const Panel: React.FC<{state: PanelState; position: [number, number, number]; rotY: number; opacity: number}> = ({state, position, rotY, opacity}) => {
  const key = JSON.stringify(state);
  const tex = useMemo(() => toTex(drawPanel(state)), [key]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh renderOrder={2}>
        <planeGeometry args={[3.6, 4.8]} />
        <meshBasicMaterial map={tex} transparent opacity={opacity} toneMapped={false} color={new THREE.Color(1.15, 1.15, 1.15)} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.05]} renderOrder={1}>
        <planeGeometry args={[3.9, 5.1]} />
        <meshBasicMaterial color={state.who === 'friend' ? C.cyanDeep : C.violet} transparent opacity={0.08 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const keyTexCache: {t?: THREE.Texture} = {};
function keyTex() {
  if (keyTexCache.t) return keyTexCache.t;
  const c = mkCanvas(512, 320); const g = c.getContext('2d')!;
  g.fillStyle = '#141a3a'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#eaf6ff'; g.font = `700 92px ${FONT_EN}`; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText('Enter ↵', 256, 160);
  return (keyTexCache.t = toTex(c));
}

export function streamCurves() {
  const mk = (k: number) => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(k * 0.9, 1.0, -1.2), new THREE.Vector3(k * 2.2, 1.7, -4.5), new THREE.Vector3(k * 4.8, 2.4, -13), new THREE.Vector3(k * 9, 3.0, -34)], false, 'centripetal');
  return {L: mk(-1), R: mk(1)};
}

export const MessagePair: React.FC<{position: THREE.Vector3; t: number; scale?: number; opacity?: number; phase?: number}> = ({position, t, scale = 1, opacity = 1, phase = 0}) => {
  const a = t * 2.2 + phase;
  return (
    <group position={position} scale={scale}>
      <Orb position={[Math.cos(a) * 0.32, Math.sin(a) * 0.18, Math.sin(a) * 0.32]} color={C.cyan} r={0.075} intensity={5} opacity={opacity} glow={7} />
      <Orb position={[-Math.cos(a) * 0.32, -Math.sin(a) * 0.18, -Math.sin(a) * 0.32]} color={C.gold} r={0.22} intensity={3.5} opacity={opacity} glow={5} />
    </group>
  );
};

export const O1Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const typedN = Math.floor(ramp(t, 1.4, 3.2) * 2 + 0.0001);
  const typed = '在吗'.slice(0, typedN);
  const caret = Math.floor(t * 2.4) % 2 === 0 || (t > 1.4 && t < 3.4);
  const attach = easeOut(ramp(t, 3.9, 4.6));
  const sent = easeOut(ramp(t, O1_PRESS + 0.05, O1_PRESS + 0.6));
  const push = easeInOut(ramp(t, 5.6, O1_PRESS - 0.05));
  const pull = easeOut(ramp(t, O1_PRESS + 0.1, 12.6));
  const pressDown = t < O1_PRESS ? ramp(t, O1_PRESS - 0.12, O1_PRESS) : 1 - ramp(t, O1_PRESS + 0.1, O1_PRESS + 0.35);
  const flash = decay(t, O1_PRESS, 5);
  const {L, R} = useMemo(streamCurves, []);
  const head = easeInOut(ramp(t, O1_PRESS + 0.02, 14)) * 0.9 + 0.08 * easeOut(ramp(t, O1_PRESS, O1_PRESS + 0.5));
  const drift = Math.sin(t * 0.25) * 0.5;
  const camPos: [number, number, number] = [
    lerp(lerp(drift, 0, push), 0, pull),
    lerp(lerp(2.4, 1.6, push), 2.6, pull),
    lerp(lerp(10.5 - t * 0.15, 3.2, push), 10.6, pull),
  ];
  const camTarget: [number, number, number] = [0, lerp(lerp(1.3, 0.1, push), 1.0, pull), lerp(lerp(-2, 0, push), -5, pull)];
  const panelOpacity = smooth(ramp(t, 0.1, 1.0));
  const pL = new THREE.Vector3(), pR = new THREE.Vector3();
  L.getPointAt(Math.max(head, 0.001), pL); R.getPointAt(Math.max(head, 0.001), pR);
  const keyGlow = 0.6 + push * 0.8 + flash * 3;
  return (
    <>
      <CameraRig pos={camPos} target={camTarget} fov={38} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 22, 80]} />
      <Stars t={t} />
      <GridFloor y={-1.2} color="#2b5cff" fade={16} opacity={0.6} scroll={[0, -t * 0.4]} />
      <Dust t={t} count={500} spread={[40, 14, 40]} />
      <Panel state={{who: 'friend', typed, caret, attach, sent}} position={[-3.7, 2.0, -3.6]} rotY={0.38} opacity={panelOpacity} />
      <Panel state={{who: 'ai', typed, caret, attach, sent}} position={[3.7, 2.0, -3.6]} rotY={-0.38} opacity={panelOpacity} />
      {/* Enter key, tilted so its cap faces the camera */}
      <group position={[0, -0.1 - pressDown * 0.12, 0]} rotation={[0.55, 0, 0]}>
        <RoundedBox args={[2.0, 0.5, 1.25]} radius={0.14} smoothness={4}>
          <meshStandardMaterial color="#121735" emissive={new THREE.Color('#0c3a66')} emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.7, 1.06]} />
          <meshBasicMaterial map={keyTex()} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(0.9 + push * 0.3 + flash * 2)} />
        </mesh>
        {/* glowing rim under the key */}
        <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.12, 1.17, 64]} />
          <meshBasicMaterial color={new THREE.Color(C.cyan).multiplyScalar(keyGlow)} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </group>
      <pointLight position={[0, 3, 3]} intensity={25} color="#9fc8ff" />
      <pointLight position={[-4, 2, 2]} intensity={12} color={C.cyan} />
      <pointLight position={[4, 2, 2]} intensity={12} color={C.purple} />
      <ambientLight intensity={0.35} />
      {t > O1_PRESS ? (
        <>
          <Streak curve={L} head={head} length={0.5} color="#2E9BFF" count={320} size={0.7} />
          <Streak curve={L} head={head} length={0.12} color="#9fe6ff" count={80} size={0.35} />
          <Streak curve={R} head={head} length={0.5} color="#A05CFF" count={320} size={0.7} />
          <Streak curve={R} head={head} length={0.12} color="#e2c2ff" count={80} size={0.35} />
          <MessagePair position={pL} t={t} scale={1.8} />
          <MessagePair position={pR} t={t} phase={1.3} scale={1.8} />
          <Orb position={[0, 0.25, 0]} color="#ffffff" r={0.2 * flash + 0.001} intensity={8} glow={18} opacity={flash} />
        </>
      ) : null}
    </>
  );
};

export const O1Html: React.FC<{t: number}> = ({t}) => {
  const flash = decay(t, O1_PRESS, 6);
  return <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash * 0.85, mixBlendMode: 'screen'}} />;
};
