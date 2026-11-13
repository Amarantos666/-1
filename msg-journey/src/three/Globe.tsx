import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {mkCanvas} from '../lib/canvas';
import {useJson} from '../lib/data';

export const R_EARTH = 5;
export type GlobeData = {coast: number[][]; cables: number[][]; routes: Record<string, {pts: number[][]}>};
type Land = {features: {geometry: {type: string; coordinates: number[][][] | number[][][][]}}[]};

export const ll2v = (lat: number, lon: number, r = R_EARTH, out = new THREE.Vector3()) => {
  const p = THREE.MathUtils.degToRad(lat), l = THREE.MathUtils.degToRad(lon);
  return out.set(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l));
};

// Path on the sphere through lat/lon waypoints, resampled by arc length (slerp between waypoints).
export class SpherePath {
  pts: THREE.Vector3[] = []; cum: number[] = []; total = 0;
  constructor(latlon: number[][], step = 0.6) {
    const dirs = latlon.map(([lon, lat]) => ll2v(lat, lon, 1));
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < dirs.length - 1; i++) {
      const a = dirs[i], b = dirs[i + 1];
      const ang = a.angleTo(b);
      const n = Math.max(1, Math.ceil(THREE.MathUtils.radToDeg(ang) / step));
      for (let k = 0; k < n; k++) out.push(slerp(a, b, k / n));
    }
    out.push(dirs[dirs.length - 1].clone());
    this.pts = out;
    this.cum = [0];
    for (let i = 1; i < out.length; i++) this.cum.push(this.cum[i - 1] + out[i - 1].angleTo(out[i]));
    this.total = this.cum[this.cum.length - 1];
  }
  at(u: number, r: number, target = new THREE.Vector3()) {
    const d = THREE.MathUtils.clamp(u, 0, 1) * this.total;
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= d) lo = m; else hi = m; }
    const seg = this.cum[hi] - this.cum[lo] || 1;
    return target.copy(slerp(this.pts[lo], this.pts[hi], (d - this.cum[lo]) / seg)).multiplyScalar(r);
  }
  km() { return this.total * 6371; }
}
function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const ang = a.angleTo(b);
  if (ang < 1e-6) return a.clone();
  const s = Math.sin(ang);
  return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s));
}

function linesGeometry(lines: number[][], r: number) {
  const pos: number[] = [];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const ln of lines) {
    for (let i = 0; i < ln.length / 2 - 1; i++) {
      // break segments that jump across the antimeridian
      if (Math.abs(ln[i * 2] - ln[i * 2 + 2]) > 180) continue;
      ll2v(ln[i * 2 + 1], ln[i * 2], r, v); ll2v(ln[i * 2 + 3], ln[i * 2 + 2], r, w);
      pos.push(v.x, v.y, v.z, w.x, w.y, w.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

const oceanVert = `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = normalize(position); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
const oceanFrag = `uniform vec3 uDeep; uniform vec3 uRim; uniform float uGrid; varying vec3 vN; varying vec3 vV; varying vec3 vP;
float gl(float x, float w){ float f = abs(fract(x) - 0.5); return smoothstep(w, 0.0, 0.5 - f); }
void main(){
  float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
  float lat = asin(clamp(vP.y, -1.0, 1.0)) * 57.2958; float lon = atan(-vP.z, vP.x) * 57.2958;
  float g = max(gl(lat / 15.0, 0.012), gl(lon / 15.0, 0.012)) * uGrid;
  vec3 c = uDeep + uRim * fr * 0.9 + vec3(0.12, 0.3, 0.6) * g * 0.16;
  gl_FragColor = vec4(c, 1.0);
}`;
const atmoFrag = `uniform vec3 uRim; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float fr = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uRim * fr * 1.4, fr); }`;

export const Globe: React.FC<{data: GlobeData; rim?: string; deep?: string; landColor?: string; cableOpacity?: number; coastOpacity?: number}> = ({data, rim = '#1f6bff', deep = '#02061a', landColor = '#5b9bff', cableOpacity = 0.32, coastOpacity = 0.55}) => {
  const land = useJson<Land>('data/ne_110m_land.geojson');
  const coastGeo = useMemo(() => linesGeometry(data.coast, R_EARTH * 1.001), [data]);
  const cableGeo = useMemo(() => linesGeometry(data.cables, R_EARTH * 1.002), [data]);
  const dots = useMemo(() => {
    if (!land) return null;
    const W = 2048, H = 1024;
    const c = mkCanvas(W, H); const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (const f of land.features) {
      const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poly of polys) {
        g.beginPath();
        for (const ring of poly) ring.forEach(([lon, lat], i) => { const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.fill('evenodd');
      }
    }
    const img = g.getImageData(0, 0, W, H).data;
    const n = 90000, pos: number[] = []; const v = new THREE.Vector3();
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      const lat = Math.asin(y) * 57.2958; let lon = Math.atan2(-(Math.sin(th) * r), Math.cos(th) * r) * 57.2958;
      const px = Math.floor(((lon + 180) / 360) * W) % W, py = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
      if (img[(py * W + px) * 4] > 128) { ll2v(lat, lon, R_EARTH * 1.003, v); pos.push(v.x, v.y, v.z); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, [land]);
  const ocean = useMemo(() => new THREE.ShaderMaterial({vertexShader: oceanVert, fragmentShader: oceanFrag, uniforms: {uDeep: {value: new THREE.Color(deep)}, uRim: {value: new THREE.Color(rim)}, uGrid: {value: 1}}}), [deep, rim]);
  const atmo = useMemo(() => new THREE.ShaderMaterial({vertexShader: oceanVert, fragmentShader: atmoFrag, uniforms: {uRim: {value: new THREE.Color(rim)}}, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}), [rim]);
  return (
    <group>
      <mesh material={ocean}><sphereGeometry args={[R_EARTH, 96, 64]} /></mesh>
      <mesh material={atmo} scale={1.12}><sphereGeometry args={[R_EARTH, 64, 48]} /></mesh>
      {dots ? (
        <points geometry={dots}>
          <pointsMaterial size={0.04} color={landColor} transparent opacity={0.9} sizeAttenuation depthWrite={false} />
        </points>
      ) : null}
      <lineSegments geometry={coastGeo}><lineBasicMaterial color="#5fd0ff" transparent opacity={coastOpacity} depthWrite={false} /></lineSegments>
      <lineSegments geometry={cableGeo}><lineBasicMaterial color="#1fd6c8" transparent opacity={cableOpacity} depthWrite={false} blending={THREE.AdditiveBlending} /></lineSegments>
    </group>
  );
};

// A glowing polyline along a SpherePath, revealed up to `reveal`.
export const PathLine: React.FC<{path: SpherePath; r: number; color: THREE.ColorRepresentation; intensity?: number; reveal?: number; opacity?: number; lift?: number}> = ({path, r, color, intensity = 2, reveal = 1, opacity = 1, lift = 0}) => {
  const geo = useMemo(() => {
    const n = 300; const pos = new Float32Array(n * 3); const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const u = i / (n - 1); path.at(u, r + Math.sin(Math.PI * u) * lift, v); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, [path, r, lift]);
  geo.setDrawRange(0, Math.max(2, Math.floor(300 * reveal)));
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);
  return <line><primitive object={geo} attach="geometry" /><lineBasicMaterial color={c} transparent opacity={opacity} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} /></line>;
};

// Faces the camera every frame.
export const Billboard: React.FC<{position: THREE.Vector3 | [number, number, number]; children: React.ReactNode}> = ({position, children}) => {
  const ref = useRef<THREE.Group>(null);
  const {camera} = useThree();
  useLayoutEffect(() => { if (ref.current) ref.current.quaternion.copy(camera.quaternion); });
  return <group ref={ref} position={position as never}>{children}</group>;
};
