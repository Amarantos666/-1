import React from 'react';
import {PostProps} from '../three/Post';
import {O1Scene, O1Html, O1_PRESS} from './O1';
import {A5Scene, A5Html, A5_ARRIVE} from './A5';
import {B1Scene, B1Html, B1_XRAY, b1Cam} from './B1';
import {B4Scene, B4Html} from './B4';
import {B5Scene, B5Html} from './B5';
import {B6Scene, B6Html, B6_FLASH, B6_FLASH_END, B6_LAND, b6Cam} from './B6';
import {F1Scene, F1_SHATTER, f1Cam} from './F1';
import {A2Scene, A2Html, A2_SLAM, A2_ENCRYPT} from './A2';
import {decay, ramp} from '../lib/math';
import {CameraRig, Stars, GridFloor} from '../three/common';
import {C} from '../theme';

export type SceneDef = {
  three: React.FC<{t: number; dur: number}>;
  html?: React.FC<{t: number; dur: number}>;
  post?: (t: number, dur: number) => Omit<PostProps, 'frame'>;
  hideChrome?: (t: number) => boolean;
};

const Placeholder: React.FC<{t: number; dur: number}> = ({t}) => (
  <>
    <CameraRig pos={[0, 2, 12]} target={[0, 0, 0]} />
    <color attach="background" args={[C.bg]} />
    <Stars t={t} />
    <GridFloor />
  </>
);

export const SCENES: Record<string, SceneDef> = {
  O1: {three: O1Scene, html: O1Html, post: (t) => ({bloom: 1.1 + decay(t, O1_PRESS, 3) * 2.5, dof: {distance: t < 6 ? 12 : t < O1_PRESS ? 3.6 : 11, range: t < O1_PRESS && t > 6 ? 3 : 14, bokeh: t > O1_PRESS ? 1.1 : 2}, aberration: decay(t, O1_PRESS, 6)})},
};
SCENES.A2 = {three: A2Scene, html: A2Html, post: (t) => ({bloom: 0.9 + decay(t, A2_SLAM, 3) * 1.2, bloomThreshold: 0.62, dof: {distance: t < 2.4 ? 12 : 22, range: 16, bokeh: 1.6}, aberration: decay(t, A2_SLAM, 8) + decay(t, A2_ENCRYPT, 6) * 0.6})};
SCENES.A5 = {three: A5Scene, html: A5Html, post: (t) => ({bloom: 1.0 + decay(t, A5_ARRIVE, 3), bloomThreshold: 0.5, dof: null, vignette: 0.6, aberration: decay(t, A5_ARRIVE, 8) * 0.5})};
SCENES.B1 = {three: B1Scene, html: B1Html, post: (t) => ({bloom: 0.9, bloomThreshold: 0.7, dof: {distance: (() => { const c = b1Cam(t); return c.pos.distanceTo(c.tgt) * 0.8; })(), range: 9, bokeh: 1.4}, aberration: decay(t, B1_XRAY, 5) * 0.6})};
SCENES.B4 = {three: B4Scene, html: B4Html, post: () => ({bloom: 1.0, bloomThreshold: 0.6, dof: {distance: 12.5, range: 8, bokeh: 2}})};
SCENES.B5 = {three: B5Scene, html: B5Html, post: () => ({bloom: 0.9, bloomThreshold: 0.65, dof: {distance: 12, range: 10, bokeh: 1.6}})};
SCENES.B6 = {three: B6Scene, html: B6Html, post: (t) => {
  const fl = ramp(t, B6_FLASH, B6_FLASH + 0.2) * (1 - ramp(t, B6_FLASH_END - 0.3, B6_FLASH_END));
  const c = b6Cam(t);
  return {bloom: 1.0 + decay(t, B6_LAND, 3), bloomThreshold: 0.6, dof: {distance: c.pos.distanceTo(c.tgt), range: 6, bokeh: 2}, aberration: decay(t, B6_FLASH, 6) + fl * 0.2 + decay(t, B6_FLASH_END, 6), saturation: -0.35 * fl};
}};
SCENES.F1 = {three: F1Scene, post: (t) => {
  const c = f1Cam(t);
  return {bloom: 0.8 + decay(t, F1_SHATTER, 3) * 1.2, bloomThreshold: 0.6, dof: {distance: c.pos.distanceTo(c.tgt), range: 4, bokeh: 2.2}, saturation: -0.75 * Math.min(1, t / 1.8), vignette: 0.75, aberration: decay(t, F1_SHATTER, 6) * 0.5};
}};
export const PLACEHOLDER: SceneDef = {three: Placeholder};
export const sceneFor = (id: string) => SCENES[id] ?? PLACEHOLDER;
