import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Glow, Label3D, Stars} from '../three/common';
import {Billboard, Globe, GlobeData, ll2v, PathLine, R_EARTH, SpherePath} from '../three/Globe';
import {useJson} from '../lib/data';
import {mkCanvas, roundRect, toTex} from '../lib/canvas';
import {decay, easeInOut, easeOut, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH, FONT_ZH_SERIF} from '../theme';
import {ev} from '../timeline';

export const A1_NOW = ev('A1', 4.6);
// 1858 cable landings: Valentia Island (Ireland) -> Trinity Bay (Newfoundland)
const VAL: [number, number] = [-10.3, 51.9], TRI: [number, number] = [-53.6, 47.7];

function cardCanvas() {
  const W = 1100, H = 700;
  const c = mkCanvas(W, H); const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#efe2c4'); bg.addColorStop(1, '#d9c49a');
  g.fillStyle = bg; roundRect(g, 0, 0, W, H, 18); g.fill();
  // paper speckle
  for (let i = 0; i < 1600; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * H; g.fillStyle = `rgba(110,80,40,${0.04 + (i % 5) * 0.012})`; g.fillRect(x, y, 2, 2); }
  g.strokeStyle = '#7a5a2a'; g.lineWidth = 4; roundRect(g, 24, 24, W - 48, H - 48, 10); g.stroke();
  g.fillStyle = '#4a3416'; g.textAlign = 'center';
  g.font = `700 64px ${FONT_ZH_SERIF}`; g.fillText('跨大西洋电报', W / 2, 120);
  g.font = `600 30px ${FONT_EN}`; g.fillText('ATLANTIC TELEGRAPH · AUGUST 16, 1858', W / 2, 170);
  g.font = `500 32px ${FONT_ZH_SERIF}`; g.textAlign = 'left';
  g.fillText('发报：维多利亚女王   To: 布坎南总统', 80, 250);
  g.fillText('长度：98 个词', 80, 305);
  g.fillText('线路：爱尔兰 → 纽芬兰，约 3,200 km', 80, 360);
  // morse tape
  g.fillStyle = '#f6edd8'; g.fillRect(60, 430, W - 120, 90); g.strokeStyle = '#8a6a36'; g.lineWidth = 2; g.strokeRect(60, 430, W - 120, 90);
  g.fillStyle = '#2b1d0a';
  const morse = '--. .-.. --- .-. -.-- / - --- / --. --- -.. / .. -. / - .... . / .... .. --. .... . ... -';
  let x = 80;
  for (const ch of morse) { if (ch === '.') { g.beginPath(); g.arc(x + 6, 475, 7, 0, Math.PI * 2); g.fill(); x += 22; } else if (ch === '-') { g.fillRect(x, 468, 34, 14); x += 46; } else x += 18; if (x > W - 100) break; }
  g.font = `italic 500 28px ${FONT_ZH_SERIF}`; g.textAlign = 'center'; g.fillStyle = '#5a4020';
  g.fillText('复原示意 · Reconstruction', W / 2, 600);
  return c;
}

export const A1Scene: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const data = useJson<GlobeData>('data/globe.json');
  const card = useMemo(() => toTex(cardCanvas()), []);
  const path = useMemo(() => new SpherePath([VAL, [-30, 52.5], TRI], 0.5), []);
  const old = ramp(t, 0.4, A1_NOW - 0.2);
  const now = easeOut(ramp(t, A1_NOW, A1_NOW + 0.25));
  const camLat = 44, camLon = lerp(-38, -30, ramp(t, 0, dur));
  const cp = ll2v(camLat, camLon, lerp(12.5, 11.2, easeInOut(ramp(t, 0, dur))));
  const tg = ll2v(46, -32, 2.2);
  const hit = decay(t, A1_NOW, 3);
  const pulseU = (t * 0.12) % 1;
  const pp = path.at(old < 1 ? old * 0.98 : 1, R_EARTH * 1.02);
  return (
    <>
      <CameraRig pos={[cp.x, cp.y, cp.z]} target={[tg.x, tg.y, tg.z]} fov={38} />
      <color attach="background" args={[C.bg]} />
      <Stars t={t} />
      {data ? <Globe data={data} cableOpacity={0.12} /> : null}
      <PathLine path={path} r={R_EARTH * 1.01} color={t < A1_NOW ? '#ffb347' : C.cyan} intensity={1.4 + hit * 3} />
      {t < A1_NOW ? <Glow position={[pp.x, pp.y, pp.z]} color="#ffb347" size={0.6} /> : <Glow position={(() => { const v = path.at(pulseU * 3 % 1, R_EARTH * 1.02); return [v.x, v.y, v.z] as [number, number, number]; })()} color={C.cyan} size={0.7} />}
      <Billboard position={ll2v(VAL[1] + 2.5, VAL[0] + 3, R_EARTH * 1.04)}><Label3D text="爱尔兰" sub="VALENTIA" size={48} height={0.36} color="#ffe9c4" depthTest={false} /></Billboard>
      <Billboard position={ll2v(TRI[1] - 3, TRI[0] - 1, R_EARTH * 1.04)}><Label3D text="纽芬兰" sub="TRINITY BAY" size={48} height={0.36} color="#ffe9c4" depthTest={false} /></Billboard>
      {/* vintage card floating in front of the globe */}
      <group position={(() => { const v = ll2v(camLat, camLon, 8.4); return [v.x, v.y, v.z] as [number, number, number]; })()}>
        <Billboard position={[0, 0, 0]}>
          <group position={[-1.25, 0.05, 0]} rotation={[0, 0.18, -0.03]} scale={(1 - smooth(ramp(t, A1_NOW - 0.1, A1_NOW + 0.4)) * 0.25)}>
            <mesh>
              <planeGeometry args={[1.65, 1.05]} />
              <meshBasicMaterial map={card} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(lerp(1.05, 0.55, smooth(ramp(t, A1_NOW, A1_NOW + 0.6))))} transparent opacity={smooth(ramp(t, 0, 0.5))} />
            </mesh>
          </group>
        </Billboard>
      </group>
      <ambientLight intensity={0.4} />
    </>
  );
};

export const A1Html: React.FC<{t: number}> = ({t}) => {
  const old = ramp(t, 0.4, A1_NOW - 0.2);
  const secs = 16 * 3600 * Math.pow(old, 1.4) * 0.985;
  const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = Math.floor(secs % 60);
  const now = ramp(t, A1_NOW, A1_NOW + 0.18);
  const a = smooth(ramp(t, 0.3, 0.8));
  return (
    <div style={{position: 'absolute', right: 140, top: 300, textAlign: 'right', opacity: a}}>
      <div style={{opacity: 1 - smooth(ramp(t, A1_NOW, A1_NOW + 0.3))}}>
        <div style={{fontFamily: FONT_ZH, fontSize: 22, color: '#ffd9a0'}}>1858 · 发送用时 <span style={{fontFamily: FONT_EN, fontSize: 16, letterSpacing: 2}}>TIME TO SEND</span></div>
        <div style={{fontFamily: FONT_MONO, fontWeight: 700, fontSize: 92, color: '#ffe2b0', textShadow: '0 0 24px #ff9a3a'}}>{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
        <div style={{fontFamily: FONT_ZH, fontSize: 24, color: '#ffd9a0'}}>近 16 小时 <span style={{fontFamily: FONT_EN, fontSize: 18}}>· nearly 16 hours</span></div>
      </div>
      {now > 0 ? (
        <div style={{position: 'absolute', right: 0, top: 0, opacity: now, transform: `scale(${lerp(1.8, 1, easeOut(now))})`, transformOrigin: 'right center', filter: `blur(${(1 - now) * 6}px)`}}>
          <div style={{fontFamily: FONT_ZH, fontSize: 26, color: '#bff4ff'}}>今天 <span style={{fontFamily: FONT_EN, fontSize: 18, letterSpacing: 2}}>TODAY</span></div>
          <div style={{fontFamily: FONT_MONO, fontWeight: 800, fontSize: 120, color: '#fff', textShadow: `0 0 30px ${C.cyan}, 0 0 70px ${C.cyan}`, whiteSpace: 'nowrap'}}>≈ 16 ms</div>
          <div style={{fontFamily: FONT_ZH, fontSize: 22, color: '#bff4ff'}}>同样的距离，光在光纤里跑一趟</div>
        </div>
      ) : null}
    </div>
  );
};
