import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CameraRig, Label3D, Orb, Stars, Glow} from '../three/common';
import {Billboard, Globe, GlobeData, ll2v, PathLine, R_EARTH, SpherePath} from '../three/Globe';
import {useJson} from '../lib/data';
import {clamp, easeInOut, easeOut, hash1, lerp, ramp, smooth} from '../lib/math';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {Odometer} from '../overlay/Odometer';

export const SH: [number, number] = [121.47, 31.23];
export const SF: [number, number] = [-122.42 + 360, 37.77];
export const ROUTES = [
  {key: 'New Cross Pacific (NCP) Cable System', short: 'NCP', w: 0.3},
  {key: 'Trans-Pacific Express (TPE) Cable System', short: 'TPE', w: 0.2},
  {key: 'FASTER', short: 'FASTER', w: 0.2},
  {key: 'Pacific Light Cable Network (PLCN)', short: 'PLCN', w: 0.15},
  {key: 'Tata TGN-Pacific', short: 'TGN-Pacific', w: 0.15},
];
export const N_PACKETS = 2143; // 3,000,000 B / 1,400 B
export const A5_ARRIVE = 7.6;
export const LIFT = [0.05, 0.42, 0.78, 0.22, 1.1];

export function useRoutes(data: GlobeData | null) {
  return useMemo(() => {
    if (!data) return null;
    return ROUTES.map((r) => new SpherePath([SH, ...data.routes[r.key].pts, SF], 0.5));
  }, [data]);
}

export const A5Scene: React.FC<{t: number; dur: number}> = ({t}) => {
  const data = useJson<GlobeData>('data/globe.json');
  const paths = useRoutes(data);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: new THREE.Color(C.gold).multiplyScalar(2.2), toneMapped: false}), N_PACKETS);
    m.frustumCulled = false; return m;
  }, []);
  const assign = useMemo(() => {
    const out: number[] = [];
    for (let k = 0; k < N_PACKETS; k++) { const h = hash1(k * 1.37); let acc = 0, ri = 0; for (; ri < ROUTES.length; ri++) { acc += ROUTES[ri].w; if (h < acc) break; } out.push(Math.min(ri, ROUTES.length - 1)); }
    return out;
  }, []);
  // camera: from Shanghai close-up out to the whole Pacific, then drift east with the packets
  const z = easeInOut(ramp(t, 0, 3.2));
  const drift = ramp(t, 3, 15);
  const camLat = lerp(lerp(29, 26, z), 30, drift), camLon = lerp(lerp(124, 172, z), 205, easeInOut(drift));
  const dist = lerp(7.2, 16.4, z) - 1.6 * smooth(ramp(t, 10, 15));
  const camPos = ll2v(camLat, camLon, dist);
  const tgt = ll2v(lerp(31, 40, z), lerp(124, camLon - 2, z), lerp(R_EARTH * 0.98, 2.6, z));
  const v = new THREE.Vector3(), o = new THREE.Object3D();
  if (paths) {
    for (let k = 0; k < N_PACKETS; k++) {
      const ri = assign[k]; const p = paths[ri];
      const start = 0.7 + (k / N_PACKETS) * 4.6 + hash1(k * 3.3) * 0.4;
      const travel = 5.4 * (p.total / paths[0].total) * (0.92 + hash1(k * 5.1) * 0.16);
      const u = (t - start) / travel;
      const vis = u > 0 && u < 1.04 ? 1 : 0;
      p.at(clamp(u), R_EARTH * (1.008 + hash1(k * 9.1) * 0.008) + Math.sin(Math.PI * clamp(u)) * LIFT[ri], v);
      v.x += (hash1(k * 2.1) - 0.5) * 0.05; v.y += (hash1(k * 4.7) - 0.5) * 0.05; v.z += (hash1(k * 6.9) - 0.5) * 0.05;
      o.position.copy(v);
      o.scale.setScalar(vis * 0.03 * (1 - clamp((u - 1) * 25)));
      o.lookAt(0, 0, 0);
      o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  const textU = easeInOut(ramp(t, 1.2, A5_ARRIVE)) * 0.5 + ramp(t, 1.2, A5_ARRIVE) * 0.5;
  const cyanPos = paths ? paths[0].at(textU, R_EARTH * 1.03 + Math.sin(Math.PI * textU) * (LIFT[0] + 0.18)) : new THREE.Vector3();
  const reveal = easeOut(ramp(t, 0.4, 3.6));
  const shV = ll2v(SH[1], SH[0], R_EARTH * 1.02), sfV = ll2v(SF[1], SF[0], R_EARTH * 1.02);
  const arrive = ramp(t, A5_ARRIVE, A5_ARRIVE + 0.6);
  return (
    <>
      <CameraRig pos={[camPos.x, camPos.y, camPos.z]} target={[tgt.x, tgt.y, tgt.z]} fov={38} />
      <color attach="background" args={[C.bg]} />
      <Stars t={t} radius={800} />
      {data ? <Globe data={data} /> : null}
      {paths ? paths.map((p, i) => <PathLine key={i} path={p} r={R_EARTH * 1.006} lift={LIFT[i]} color={i === 0 ? C.cyan : C.gold} intensity={i === 0 ? 1.6 : 1.1} reveal={reveal} opacity={0.85} />) : null}
      <primitive object={mesh} />
      {paths && t > 1.2 && t < A5_ARRIVE + 1.2 ? <><Orb position={[cyanPos.x, cyanPos.y, cyanPos.z]} color={C.cyan} r={0.085} intensity={7} glow={16} /><Billboard position={[cyanPos.x, cyanPos.y + 0.32, cyanPos.z]}><Label3D text="在吗" size={44} height={0.26} color={C.cyan} emissive={1.6} depthTest={false} /></Billboard></> : null}
      <Glow position={[shV.x, shV.y, shV.z]} color={C.cyan} size={0.9} />
      <Glow position={[sfV.x, sfV.y, sfV.z]} color={C.cyan} size={0.9 + arrive * 1.2} opacity={0.6 + arrive * 0.4} />
      <Billboard position={ll2v(SH[1] - 2.2, SH[0] - 4, R_EARTH * 1.05)}><Label3D text="上海" sub="SHANGHAI" size={52} height={0.42} color="#e8f6ff" emissive={1.2} depthTest={false} /></Billboard>
      <Billboard position={ll2v(SF[1] + 2.6, SF[0] + 3, R_EARTH * 1.05)}><Label3D text="旧金山" sub="SAN FRANCISCO" size={52} height={0.42} color="#e8f6ff" emissive={1.2} depthTest={false} /></Billboard>
      {paths ? ROUTES.map((r, i) => {
        const uu = [0.55, 0.42, 0.5, 0.62, 0.36][i]; const pos = paths[i].at(uu, R_EARTH * 1.03 + Math.sin(Math.PI * uu) * LIFT[i] + 0.12);
        return <Billboard key={r.short} position={pos}><Label3D text={r.short} font="mono" size={40} weight={600} height={0.2} color={i === 0 ? '#9ff3ff' : '#ffe2a8'} emissive={1.1} opacity={reveal * 0.9} depthTest={false} /></Billboard>;
      }) : null}
    </>
  );
};

export const A5Html: React.FC<{t: number}> = ({t}) => {
  const u = ramp(t, 1.2, A5_ARRIVE);
  const uu = easeInOut(u) * 0.5 + u * 0.5;
  const a = smooth(ramp(t, 1.0, 1.6));
  const slam = ramp(t, A5_ARRIVE, A5_ARRIVE + 0.16);
  const lbl: React.CSSProperties = {fontFamily: FONT_ZH, fontSize: 20, color: 'rgba(255,255,255,0.65)', letterSpacing: 1};
  return (
    <>
      <div style={{position: 'absolute', left: 120, top: 250, opacity: a}}>
        <div style={lbl}>距离 <span style={{fontFamily: FONT_EN, letterSpacing: 3, fontSize: 15}}>DISTANCE</span></div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}><Odometer value={10000 * uu} size={56} color="#dff8ff" minDigits={1} /><span style={{fontFamily: FONT_EN, fontSize: 26, color: C.cyan}}>km</span></div>
        <div style={{...lbl, marginTop: 22}}>时间 <span style={{fontFamily: FONT_EN, letterSpacing: 3, fontSize: 15}}>ELAPSED</span></div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}><Odometer value={49 * uu} size={56} color="#dff8ff" /><span style={{fontFamily: FONT_EN, fontSize: 26, color: C.cyan}}>ms</span></div>
        <div style={{...lbl, marginTop: 22, fontSize: 17}}>金色 = 照片的 2,143 个包 · <span style={{color: C.gold}}>■</span></div>
        <div style={{...lbl, fontSize: 17}}>青色 = “在吗”的 1 个包 · <span style={{color: C.cyan}}>●</span></div>
        <div style={{...lbl, fontSize: 15, marginTop: 10, opacity: 0.7}}>慢动作 · SLOW MOTION</div>
      </div>
      {slam > 0 ? (
        <div style={{position: 'absolute', right: 140, top: 230, textAlign: 'right', opacity: slam * (1 - ramp(t, 13.5, 14.5)), transform: `scale(${lerp(1.8, 1, easeOut(slam))})`, transformOrigin: 'right center', filter: `blur(${(1 - slam) * 6}px)`}}>
          <div style={{fontFamily: FONT_MONO, fontWeight: 800, fontSize: 120, color: '#fff', textShadow: `0 0 30px ${C.cyan}, 0 0 70px ${C.cyan}`}}>≈50<span style={{fontSize: 60}}> ms</span></div>
          <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 32, color: '#bff4ff'}}>跨过太平洋 <span style={{fontFamily: FONT_EN, fontSize: 22}}>across the Pacific</span></div>
        </div>
      ) : null}
    </>
  );
};
