import React, {forwardRef, useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer, Bloom, DepthOfField, Vignette, ChromaticAberration, HueSaturation, BrightnessContrast, FXAA} from '@react-three/postprocessing';
import {Effect, BlendFunction} from 'postprocessing';

// Deterministic film grain: seed comes from the frame number, so every frame re-renders identically.
const grainFrag = /* glsl */`
uniform float seed; uniform float amount;
float h(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 px = floor(uv * resolution);
  float n = h(px * 0.013 + vec2(seed * 0.618, seed * 0.317)) - 0.5;
  float lum = dot(inputColor.rgb, vec3(0.299,0.587,0.114));
  float k = amount * (1.0 - 0.6 * lum);
  outputColor = vec4(inputColor.rgb + n * k, inputColor.a);
}`;
class GrainEffect extends Effect {
  constructor() {
    super('Grain', grainFrag, {blendFunction: BlendFunction.NORMAL, uniforms: new Map<string, THREE.Uniform>([['seed', new THREE.Uniform(0)], ['amount', new THREE.Uniform(0.05)]])});
  }
}
const Grain = forwardRef<GrainEffect, {seed: number; amount: number}>(({seed, amount}, ref) => {
  const e = useMemo(() => new GrainEffect(), []);
  (e.uniforms.get('seed') as THREE.Uniform).value = seed % 997;
  (e.uniforms.get('amount') as THREE.Uniform).value = amount;
  return <primitive ref={ref} object={e} dispose={null} />;
});

export type PostProps = {
  frame: number;
  bloom?: number; bloomThreshold?: number;
  dof?: {distance: number; range: number; bokeh: number} | null;
  vignette?: number;
  aberration?: number; // 0..1 (only at transitions)
  saturation?: number; // -1..1
  brightness?: number; contrast?: number;
  grain?: number;
  q?: string;
};

export const Post: React.FC<PostProps> = ({frame, bloom = 1.2, bloomThreshold = 0.55, dof = null, vignette = 0.55, aberration = 0, saturation = 0, brightness = 0, contrast = 0, grain = 0.018, q = ''}) => {
  const ab = useMemo(() => new THREE.Vector2(), []);
  ab.set(aberration * 0.006, aberration * 0.004);
  return (
    <EffectComposer multisampling={q.includes('m0') ? 0 : 4} frameBufferType={q.includes('ub') ? THREE.UnsignedByteType : THREE.HalfFloatType}>
      {dof && !q.includes('nodof') ? <DepthOfField worldFocusDistance={dof.distance} worldFocusRange={dof.range} bokehScale={dof.bokeh} resolutionScale={q.includes('dofq') ? 0.25 : 0.5} /> : <></>}
      {q.includes('fxaa') ? <FXAA /> : <></>}
      {q.includes('nobloom') ? <></> : <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.25} mipmapBlur radius={0.75} />}
      <ChromaticAberration offset={ab} radialModulation={false} modulationOffset={0} />
      <HueSaturation saturation={saturation} hue={0} />
      <BrightnessContrast brightness={brightness} contrast={contrast} />
      <Vignette offset={0.28} darkness={vignette} eskil={false} />
      <Grain seed={frame} amount={grain} />
    </EffectComposer>
  );
};
