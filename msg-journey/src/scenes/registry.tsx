import React from 'react';
import {PostProps} from '../three/Post';
import {O1Scene, O1Html, O1_PRESS} from './O1';
import {A5Scene, A5Html, A5_ARRIVE} from './A5';
import {B1Scene, B1Html, B1_XRAY, b1Cam} from './B1';
import {B4Scene, B4Html} from './B4';
import {B5Scene, B5Html} from './B5';
import {B6Scene, B6Html, B6_FLASH, B6_FLASH_END, B6_LAND, b6Cam} from './B6';
import {F1Scene, F1_SHATTER, f1Cam} from './F1';
import {O2Scene, O2Html, O2_SPLIT, CardScene, CardHtml} from './Title';
import {A1Scene, A1Html, A1_NOW} from './A1';
import {A3Scene, A3Html} from './A3';
import {A4Scene} from './A4';
import {A6Scene, A6Html, A6_SHARP} from './A6';
import {BRScene, B2Scene, B2_G3} from './B2';
import {B3Scene, B3Html} from './B3';
import {B7Scene, B7Html} from './B7';
import {B8Scene, B8Html} from './B8';
import {C1Scene, C1Html, C1_GOLD, R1Scene, R1Html} from './Outro';
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
SCENES.O2 = {three: O2Scene, html: O2Html, post: (t) => ({bloom: 1.0 + decay(t, O2_SPLIT, 4) * 0.8, bloomThreshold: 0.6, dof: {distance: 10.5, range: 8, bokeh: 1.4}, aberration: decay(t, O2_SPLIT, 8) * 0.6})};
const cardA: React.FC<{t: number; dur: number}> = (p) => <CardScene {...p} color={C.cyan} />;
const cardB: React.FC<{t: number; dur: number}> = (p) => <CardScene {...p} color="#C77DFF" />;
SCENES.A0 = {three: cardA, html: (p) => <CardHtml {...p} big="A 面" zh="发给人 · 被搬运" en="SIDE A · TO A FRIEND · DELIVERED" color={C.cyan} />, hideChrome: () => true, post: () => ({bloom: 1.4, bloomThreshold: 0.3})};
SCENES.B0 = {three: cardB, html: (p) => <CardHtml {...p} big="B 面" zh="发给 AI · 被读懂" en="SIDE B · TO AN AI · UNDERSTOOD" color="#C77DFF" />, hideChrome: () => true, post: () => ({bloom: 1.4, bloomThreshold: 0.3})};
SCENES.A1 = {three: A1Scene, html: A1Html, post: (t) => ({bloom: 1.0 + decay(t, A1_NOW, 3), bloomThreshold: 0.55, aberration: decay(t, A1_NOW, 8) * 0.6, saturation: t < A1_NOW ? -0.25 : 0})};
SCENES.A3 = {three: A3Scene, html: A3Html, post: () => ({bloom: 0.9, bloomThreshold: 0.6, dof: {distance: 10, range: 9, bokeh: 1.6}})};
SCENES.A4 = {three: A4Scene, post: () => ({bloom: 1.2, bloomThreshold: 0.5, dof: {distance: 6, range: 8, bokeh: 1.6}})};
SCENES.A6 = {three: A6Scene, html: A6Html, post: (t) => ({bloom: 0.9 + decay(t, A6_SHARP, 3), bloomThreshold: 0.6, dof: {distance: 9, range: 8, bokeh: 1.6}})};
SCENES.BR = {three: BRScene, post: () => ({bloom: 1.2, bloomThreshold: 0.5, dof: {distance: 3.5, range: 5, bokeh: 2}})};
SCENES.B2 = {three: B2Scene, post: (t) => ({bloom: 1.1, bloomThreshold: 0.55, dof: {distance: 6.5, range: 5, bokeh: 1.8}, aberration: decay(t, B2_G3, 6) * 0.4})};
SCENES.B3 = {three: B3Scene, html: B3Html, post: (t, d) => ({bloom: 1.2 + ramp(t, d - 1.5, d) * 2, bloomThreshold: 0.5, dof: {distance: t < 6 ? 14 : 3, range: t < 6 ? 30 : 4, bokeh: 1.6}, aberration: ramp(t, d - 0.8, d) * 0.8})};
SCENES.B7 = {three: B7Scene, html: B7Html, post: () => ({bloom: 1.0, bloomThreshold: 0.6, dof: {distance: 9.5, range: 7, bokeh: 1.4}})};
SCENES.B8 = {three: B8Scene, html: B8Html, post: () => ({bloom: 1.1, bloomThreshold: 0.55, dof: {distance: 8.5, range: 9, bokeh: 1.4}})};
SCENES.C1 = {three: C1Scene, html: C1Html, post: (t) => ({bloom: 1.0 + decay(t, C1_GOLD, 1.5) * 2, bloomThreshold: 0.55, aberration: decay(t, C1_GOLD, 6) * 0.8})};
SCENES.R1 = {three: R1Scene, html: R1Html, post: () => ({bloom: 0.8, bloomThreshold: 0.6})};
export const PLACEHOLDER: SceneDef = {three: Placeholder};
export const sceneFor = (id: string) => SCENES[id] ?? PLACEHOLDER;
