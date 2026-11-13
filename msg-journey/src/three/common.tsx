import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {mulberry32} from '../lib/math';
import {glowTexture, labelTexture, LabelOpts} from '../lib/canvas';

// ---------- Camera ----------
// Sub-pixel jitter (set by Main when rendering 4 sub-frames per output frame).
export const JITTER = {x: 0, y: 0};
export const CameraRig: React.FC<{pos: [number, number, number]; target: [number, number, number]; fov?: number; roll?: number}> = ({pos, target, fov = 40, roll = 0}) => {
  const {camera, size} = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (JITTER.x || JITTER.y) cam.setViewOffset(size.width, size.height, JITTER.x, JITTER.y, size.width, size.height); else cam.clearViewOffset();
    cam.position.set(...pos);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(...target);
    if (cam.fov !== fov) { cam.fov = fov; }
    cam.near = 0.05; cam.far = 4000;
    cam.updateProjectionMatrix();
  });
  return null;
};

// ---------- Starfield ----------
const starVert = /* glsl */`
attribute float aSize; attribute float aPhase; attribute vec3 aColor;
uniform float uTime; varying vec3 vColor; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.65 + 0.35*sin(uTime*1.7 + aPhase*6.2831);
  vA = tw; vColor = aColor;
  gl_PointSize = aSize * (1.0 + 0.25*tw);
}`;
const starFrag = /* glsl */`
varying vec3 vColor; varying float vA; uniform float uOpacity;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r = length(d);
  float a = smoothstep(0.5, 0.0, r); a = a*a;
  gl_FragColor = vec4(vColor * (1.0 + 2.0*smoothstep(0.15,0.0,r)), a * vA * uOpacity);
}`;
export const Stars: React.FC<{t: number; count?: number; radius?: number; opacity?: number; tint?: string}> = ({t, count = 3500, radius = 900, opacity = 1, tint = '#9fb6ff'}) => {
  const geo = useMemo(() => {
    const r = mulberry32(42);
    const p = new Float32Array(count * 3), s = new Float32Array(count), ph = new Float32Array(count), c = new Float32Array(count * 3);
    const base = new THREE.Color(tint);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = radius * (0.6 + r() * 0.4);
      const sq = Math.sqrt(1 - u * u);
      p.set([rr * sq * Math.cos(th), rr * u, rr * sq * Math.sin(th)], i * 3);
      s[i] = 1.2 + Math.pow(r(), 6) * 5.5; ph[i] = r();
      const col = base.clone().lerp(new THREE.Color(r() > 0.85 ? '#ffd9a0' : '#ffffff'), r() * 0.6);
      c.set([col.r, col.g, col.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
    return g;
  }, [count, radius, tint]);
  const mat = useMemo(() => new THREE.ShaderMaterial({vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: {value: 0}, uOpacity: {value: 1}}}), []);
  mat.uniforms.uTime.value = t; mat.uniforms.uOpacity.value = opacity;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />;
};

// ---------- Infinite-looking grid floor ----------
const gridVert = /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const gridFrag = /* glsl */`
uniform vec3 uColor; uniform float uScale; uniform float uFade; uniform float uOpacity; uniform vec2 uScroll; uniform vec3 uCenter;
varying vec3 vW;
float line(vec2 p, float w){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
void main(){
  vec2 p = (vW.xz + uScroll) / uScale;
  float l1 = line(p, 1.0); float l2 = line(p / 5.0, 1.4);
  float d = length(vW.xz - uCenter.xz);
  float fade = exp(-d / uFade);
  float a = (l1 * 0.35 + l2 * 0.9) * fade * uOpacity;
  gl_FragColor = vec4(uColor * (0.6 + l2), a);
}`;
export const GridFloor: React.FC<{y?: number; color?: string; scale?: number; fade?: number; opacity?: number; scroll?: [number, number]; center?: [number, number, number]; size?: number}> = ({y = -3, color = '#2a6cff', scale = 1, fade = 30, opacity = 1, scroll = [0, 0], center = [0, 0, 0], size = 600}) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({vertexShader: gridVert, fragmentShader: gridFrag, transparent: true, depthWrite: false, extensions: {derivatives: true} as never,
    uniforms: {uColor: {value: new THREE.Color()}, uScale: {value: 1}, uFade: {value: 30}, uOpacity: {value: 1}, uScroll: {value: new THREE.Vector2()}, uCenter: {value: new THREE.Vector3()}}}), []);
  mat.uniforms.uColor.value.set(color); mat.uniforms.uScale.value = scale; mat.uniforms.uFade.value = fade; mat.uniforms.uOpacity.value = opacity;
  mat.uniforms.uScroll.value.set(...scroll); mat.uniforms.uCenter.value.set(...center);
  return <mesh rotation-x={-Math.PI / 2} position={[center[0], y, center[2]]} material={mat} renderOrder={-5}><planeGeometry args={[size, size]} /></mesh>;
};

// ---------- Glow sprite ----------
export const Glow: React.FC<{position?: [number, number, number]; color: string; size: number; opacity?: number}> = ({position = [0, 0, 0], color, size, opacity = 1}) => (
  <sprite position={position} scale={[size, size, 1]} renderOrder={5}>
    <spriteMaterial map={glowTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  </sprite>
);

// Bright core + glow: the recurring "text" (cyan dot) and "image" (gold orb) characters.
export const Orb: React.FC<{position?: [number, number, number]; color: string; r: number; intensity?: number; opacity?: number; glow?: number}> = ({position = [0, 0, 0], color, r, intensity = 4, opacity = 1, glow = 6}) => {
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[r, 32, 16]} />
        <meshBasicMaterial color={c} toneMapped={false} transparent opacity={opacity} />
      </mesh>
      <Glow color={color} size={r * glow} opacity={0.9 * opacity} />
    </group>
  );
};

// ---------- Text label on a plane ----------
export const Label3D: React.FC<LabelOpts & {position?: [number, number, number]; height?: number; opacity?: number; rotation?: [number, number, number]; emissive?: number; billboard?: boolean; depthTest?: boolean; renderOrder?: number}> = ({position = [0, 0, 0], height = 0.5, opacity = 1, rotation = [0, 0, 0], emissive = 1, depthTest = true, renderOrder = 10, ...o}) => {
  const {tex, aspect} = useMemo(() => labelTexture(o), [o.text, o.sub, o.color, o.size, o.bg, o.border, o.font, o.weight, o.subColor, o.w, o.h]);
  const col = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(emissive), [emissive]);
  return (
    <mesh position={position} rotation={rotation} renderOrder={renderOrder}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} color={col} toneMapped={false} depthWrite={false} depthTest={depthTest} side={THREE.DoubleSide} />
    </mesh>
  );
};

// Points distributed along a curve with fading tail (light streak).
export const Streak: React.FC<{curve: THREE.Curve<THREE.Vector3>; head: number; length: number; color: string; count?: number; size?: number; opacity?: number}> = ({curve, head, length, color, count = 120, size = 0.25, opacity = 1}) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const u = THREE.MathUtils.clamp(head - f * length, 0, 1);
    curve.getPointAt(u, v);
    pos.setXYZ(i, v.x, v.y, v.z);
    const a = Math.pow(1 - f, 1.6) * opacity * (head - f * length < 0 ? 0 : 1);
    col.setXYZ(i, base.r * a * 3, base.g * a * 3, base.b * a * 3);
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial size={size} map={glowTexture()} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} sizeAttenuation />
    </points>
  );
};

// Dust particles floating in the volume (depth cue layer).
export const Dust: React.FC<{t: number; count?: number; spread?: [number, number, number]; center?: [number, number, number]; color?: string; size?: number; seed?: number; opacity?: number}> = ({t, count = 600, spread = [40, 20, 40], center = [0, 0, 0], color = '#8fb8ff', size = 0.06, seed = 9, opacity = 0.6}) => {
  const base = useMemo(() => {
    const r = mulberry32(seed); const a = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) a.set([(r() - 0.5) * spread[0], (r() - 0.5) * spread[1], (r() - 0.5) * spread[2], r() * 10], i * 4);
    return a;
  }, [count, seed, spread[0], spread[1], spread[2]]);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); return g; }, [count]);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const ph = base[i * 4 + 3];
    p.setXYZ(i, center[0] + base[i * 4] + Math.sin(t * 0.3 + ph) * 0.4, center[1] + base[i * 4 + 1] + Math.sin(t * 0.21 + ph * 2) * 0.3, center[2] + base[i * 4 + 2] + Math.cos(t * 0.25 + ph) * 0.4);
  }
  p.needsUpdate = true;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial size={size} map={glowTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
};

export const useRefObj = <T,>() => useRef<T>(null);
