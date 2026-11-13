import {ev} from '../timeline';
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Dust, Glow, GridFloor, Label3D, Orb, Stars} from '../three/common';
import {drawPhoto, mkCanvas, roundRect, toTex} from '../lib/canvas';
import {easeInOut, easeOut, easeOutBack, lerp, mulberry32, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';

const PAPER_W = 5.2, CW = 1024, CH = 4400;
const TOTAL = (PAPER_W * CH) / CW; // world length of the full scroll
export const B1_XRAY = ev('B1', 2.0, false), B1_UNROLL = ev('B1', 3.6, false), B1_NOTE = ev('B1', 5.2, false);
const ROLL_R = 0.32;

// Where (in canvas px) each section lives.
const SEC = {sys: 40, mem: 520, hist: 760, now: 3700};

function drawScroll() {
  const c = mkCanvas(CW, CH); const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#1a0f3c'); bg.addColorStop(1, '#2a0f3a');
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  // faint ruled lines
  g.strokeStyle = 'rgba(200,160,255,0.06)'; g.lineWidth = 2;
  for (let y = 0; y < CH; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
  const head = (y: number, zh: string, en: string, col: string) => {
    g.fillStyle = col; g.font = `700 46px ${FONT_ZH}`; g.textBaseline = 'top'; g.fillText(zh, 64, y);
    const w = g.measureText(zh).width;
    g.font = `600 26px ${FONT_EN}`; g.fillStyle = col + 'aa'; g.fillText(en, 84 + w, y + 14);
  };
  const bars = (x: number, y: number, n: number, maxW: number, col: string, seed: number) => {
    const r = mulberry32(seed);
    for (let i = 0; i < n; i++) { g.fillStyle = col; roundRect(g, x, y + i * 38, maxW * (i === n - 1 ? 0.35 + r() * 0.4 : 0.75 + r() * 0.25), 18, 9); g.fill(); }
  };
  // 1. system prompt
  head(SEC.sys, '系统设定', 'SYSTEM PROMPT', '#d9b8ff');
  g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, 48, SEC.sys + 78, CW - 96, 330, 22); g.fill();
  g.fillStyle = '#efe4ff'; g.font = `500 34px ${FONT_ZH}`;
  g.fillText('你是一个乐于助人的助手。请友好、简洁地回答……', 84, SEC.sys + 108);
  bars(84, SEC.sys + 176, 6, CW - 180, 'rgba(220,190,255,0.28)', 3);
  // 2. memory slot (the sticky note lands here)
  g.setLineDash([14, 10]); g.strokeStyle = 'rgba(255,214,110,0.35)'; g.lineWidth = 3;
  roundRect(g, 48, SEC.mem, CW - 96, 190, 20); g.stroke(); g.setLineDash([]);
  // 3. history
  head(SEC.hist, '之前所有的聊天记录', 'CONVERSATION HISTORY', '#ff9be0');
  const msgs = [
    ['u', '帮我想个周末去处'], ['a', ''], ['u', '海边那家咖啡店几点开门？'], ['a', ''], ['u', '把这段话翻译成英文'], ['a', ''],
    ['u', '推荐一部轻松的电影'], ['a', ''], ['u', '明天要带伞吗'], ['a', ''], ['u', '谢谢！'], ['a', ''],
  ];
  let y = SEC.hist + 90;
  msgs.forEach(([who, txt], i) => {
    const user = who === 'u';
    const h = user ? 96 : 150 + (i % 3) * 38;
    const w = user ? 560 : 760;
    const x = user ? CW - 64 - w : 64;
    g.fillStyle = user ? 'rgba(178,120,255,0.32)' : 'rgba(255,255,255,0.08)';
    roundRect(g, x, y, w, h, 26); g.fill();
    if (user) { g.fillStyle = '#f4ebff'; g.font = `500 34px ${FONT_ZH}`; g.fillText(txt, x + 30, y + 30); }
    else bars(x + 30, y + 30, Math.floor((h - 40) / 38), w - 60, 'rgba(230,210,255,0.22)', 10 + i);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = `500 20px ${FONT_EN}`;
    g.fillText(user ? 'YOU' : 'AI', user ? x + w - 50 : x + 8, y - 26);
    y += h + 60;
  });
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = `500 30px ${FONT_ZH}`; g.textAlign = 'center';
  g.fillText('⋮', CW / 2, y); g.textAlign = 'left';
  // 4. this message
  const ny = SEC.now;
  head(ny, '这一次的新消息', 'THIS MESSAGE', '#ffd27a');
  g.strokeStyle = '#ffd27a'; g.lineWidth = 5; roundRect(g, 40, ny + 70, CW - 80, 560, 30); g.stroke();
  const grd = g.createLinearGradient(600, ny + 110, 960, ny + 210);
  grd.addColorStop(0, '#B07CFF'); grd.addColorStop(1, '#FF3DB8');
  g.fillStyle = grd; roundRect(g, CW - 64 - 260, ny + 110, 260, 100, 34); g.fill();
  g.fillStyle = '#12082a'; g.font = `700 48px ${FONT_ZH}`; g.fillText('在吗', CW - 64 - 260 + 82, ny + 134);
  const ph = drawPhoto(768, 512);
  g.save(); roundRect(g, CW - 64 - 480, ny + 240, 480, 320, 28); g.clip(); g.drawImage(ph, CW - 64 - 480, ny + 240, 480, 320); g.restore();
  return c;
}

function drawNote() {
  const c = mkCanvas(900, 170); const g = c.getContext('2d')!;
  g.fillStyle = '#ffd86e'; roundRect(g, 0, 0, 900, 170, 16); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 900, 26);
  g.fillStyle = '#3a2600'; g.font = `700 44px ${FONT_ZH}`; g.textBaseline = 'top'; g.fillText('记忆 MEMORY', 34, 40);
  g.font = `500 36px ${FONT_ZH}`; g.fillText('· 用户喜欢拍日落    · 常用中文', 34, 102);
  return toTex(c);
}

// Paper geometry with a rolled end: s in [0, TOTAL] along the length.
function useScrollGeo() {
  return useMemo(() => {
    const SEG = 360;
    const g = new THREE.PlaneGeometry(PAPER_W, 1, 1, SEG);
    return {g, SEG};
  }, []);
}

const unrolledAt = (t: number) => lerp(0.8, 4.6, easeOut(ramp(t, B1_UNROLL + 0.1, B1_NOTE))) + (TOTAL - 1.2 - 4.6) * easeInOut(ramp(t, B1_NOTE + 1.2, 13.2));
const TOP = 3.2;
export function b1Cam(t: number) {
  const endY = TOP - unrolledAt(t);
  const a = smooth(ramp(t, B1_UNROLL - 0.4, B1_UNROLL + 1.4));
  const f = easeInOut(ramp(t, 6.6, 9.6));
  const pos = new THREE.Vector3(
    lerp(lerp(0.4, 2.6, a), 5.2, f),
    lerp(lerp(TOP + 0.5, TOP - 1.6, a), endY - 0.6, f),
    lerp(lerp(8, 10.5, a), 6.8, f));
  const tgt = new THREE.Vector3(lerp(lerp(0, 0, a), -0.6, f), lerp(lerp(TOP + 0.2, TOP - 2.4, a), endY + 4.2, f), 0);
  return {pos, tgt};
}

export const B1Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const tex = useMemo(() => toTex(drawScroll()), []);
  const note = useMemo(drawNote, []);
  const {g, SEG} = useScrollGeo();
  const unrolled = unrolledAt(t);
  // rebuild vertices
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const rollLen = Math.min(TOTAL - unrolled, Math.PI * 2 * ROLL_R * 2.2);
  const shown = unrolled + rollLen;
  for (let j = 0; j <= SEG; j++) {
    const s = (j / SEG) * shown;
    let y: number, z: number;
    if (s <= unrolled) { y = -s; z = Math.sin(s * 0.35 + t * 0.6) * 0.08; }
    else { const th = (s - unrolled) / ROLL_R; y = -unrolled - ROLL_R * Math.sin(th); z = ROLL_R - ROLL_R * Math.cos(th); }
    for (let i = 0; i < 2; i++) {
      const k = j * 2 + i;
      pos.setXYZ(k, (i - 0.5) * PAPER_W, y, z);
      uv.setXY(k, i, 1 - s / TOTAL);
    }
  }
  pos.needsUpdate = true; uv.needsUpdate = true; g.computeVertexNormals();
  const open = easeOutBack(ramp(t, B1_UNROLL - 0.6, B1_UNROLL));
  const xray = ramp(t, B1_XRAY, B1_XRAY + 1.2);
  const capsuleA = 1 - smooth(ramp(t, B1_UNROLL - 0.2, B1_UNROLL + 0.5));
  const top = TOP;
  const cam = b1Cam(t);
  const camPos: [number, number, number] = [cam.pos.x, cam.pos.y, cam.pos.z];
  const camTarget: [number, number, number] = [cam.tgt.x, cam.tgt.y, cam.tgt.z];
  // sticky note flight
  const nk = easeOut(ramp(t, B1_NOTE, B1_NOTE + 1.1));
  const noteY = top - (SEC.mem + 95) * (TOTAL / CH);
  const notePos: [number, number, number] = [lerp(9, 0, nk), lerp(noteY + 3, noteY, nk), lerp(3, 0.06, nk)];
  const noteVisible = top - noteY < unrolled + 0.2 || t < B1_NOTE;
  return (
    <>
      <CameraRig pos={camPos} target={camTarget} fov={40} />
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 18, 60]} />
      <Stars t={t} tint="#c9a6ff" />
      <GridFloor y={-20} color="#7b3cff" fade={30} opacity={0.5} />
      <Dust t={t} count={600} spread={[30, 40, 20]} center={[0, -6, -3]} color="#d6a8ff" opacity={0.4} />
      {/* scroll */}
      <group position={[0, top, 0]} scale={[open, 1, 1]}>
        <mesh geometry={g}>
          <meshBasicMaterial color="#1a0b33" side={THREE.BackSide} />
        </mesh>
        <mesh geometry={g}>
          <meshBasicMaterial map={tex} side={THREE.FrontSide} toneMapped={false} color={new THREE.Color(1.25, 1.2, 1.3)} transparent opacity={smooth(ramp(t, B1_UNROLL - 0.5, B1_UNROLL))} />
        </mesh>
        {/* glowing side rails */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (PAPER_W / 2 + 0.04), -Math.min(unrolled, 30) / 2, 0]}>
            <boxGeometry args={[0.04, Math.min(unrolled, 30), 0.04]} />
            <meshBasicMaterial color={new THREE.Color(C.magenta).multiplyScalar(2.2)} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.05, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, PAPER_W + 0.5, 24]} />
          <meshStandardMaterial color="#2a1150" emissive={C.purple} emissiveIntensity={1.4} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
      {/* memory sticky note */}
      {noteVisible && t > B1_NOTE - 0.2 ? (
        <mesh position={notePos} rotation={[0, lerp(-0.6, 0, nk), lerp(0.3, -0.03, nk)]}>
          <planeGeometry args={[PAPER_W * 0.86, PAPER_W * 0.86 * (170 / 900)]} />
          <meshBasicMaterial map={note} toneMapped={false} color={new THREE.Color(1.15, 1.15, 1.15)} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {/* the purple packet being x-rayed */}
      {capsuleA > 0.01 ? (
        <group position={[0, top + 0.2, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.7, 2.2, 8, 32]} />
            <meshStandardMaterial color="#3a1670" emissive={C.purple} emissiveIntensity={lerp(0.7, 0.25, xray)} transparent opacity={capsuleA * lerp(0.92, 0.3, xray)} metalness={0.5} roughness={0.25} />
          </mesh>
          <Orb position={[-0.5, 0, 0]} color={C.cyan} r={0.12} opacity={capsuleA * lerp(0.25, 1, xray)} glow={8} />
          <Orb position={[0.5, 0, 0]} color={C.gold} r={0.32} opacity={capsuleA * lerp(0.25, 1, xray)} glow={5} />
          {/* scan plane */}
          {t > B1_XRAY && t < B1_XRAY + 1.4 ? (
            <mesh position={[lerp(-2.4, 2.4, ramp(t, B1_XRAY, B1_XRAY + 1.2)), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[2.4, 2.4]} />
              <meshBasicMaterial color={new THREE.Color('#bfe9ff').multiplyScalar(3)} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          ) : null}
          <Glow color={C.purple} size={5} opacity={capsuleA * 0.6} />
        </group>
      ) : null}
      {t > B1_XRAY && t < B1_UNROLL + 0.6 ? <Label3D text="X-RAY" font="mono" size={48} height={0.34} color="#bfe9ff" position={[0, top + 1.6, 0]} opacity={smooth(ramp(t, B1_XRAY, B1_XRAY + 0.3)) * capsuleA} /> : null}
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 6, 6]} intensity={60} color="#e0c8ff" />
    </>
  );
};

export const B1Html: React.FC<{t: number}> = ({t}) => {
  const unrolledFrac = ramp(t, B1_UNROLL, 13.2);
  const items = 1 + Math.floor(unrolledFrac * 15.999);
  const a = smooth(ramp(t, B1_UNROLL + 0.4, B1_UNROLL + 1));
  const lbl: React.CSSProperties = {fontFamily: FONT_ZH, fontSize: 21, color: 'rgba(255,255,255,0.68)'};
  return (
    <div style={{position: 'absolute', left: 120, top: 250, opacity: a}}>
      <div style={lbl}>这一次实际发出去的 <span style={{fontFamily: FONT_EN, fontSize: 15, letterSpacing: 2}}>ACTUALLY SENT</span></div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4}}>
        <Odometer value={items} size={60} color="#f0dcff" />
        <span style={{fontFamily: FONT_ZH, fontSize: 26, color: '#d9b8ff'}}>段内容 <span style={{fontFamily: FONT_EN, fontSize: 18}}>blocks</span></span>
      </div>
      <div style={{...lbl, fontSize: 18, marginTop: 14, lineHeight: '30px'}}>
        <div><span style={{color: '#d9b8ff'}}>■</span> 系统设定 system prompt</div>
        <div style={{opacity: t > B1_NOTE ? 1 : 0.3}}><span style={{color: '#ffd86e'}}>■</span> 记忆 memory</div>
        <div><span style={{color: '#ff9be0'}}>■</span> 历史对话 history</div>
        <div style={{opacity: unrolledFrac > 0.97 ? 1 : 0.3}}><span style={{color: '#ffd27a'}}>■</span> 新消息：“在吗”+ 照片</div>
      </div>
    </div>
  );
};

