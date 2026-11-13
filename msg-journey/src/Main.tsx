import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Overlay} from './overlay/Overlay';
import {Post} from './three/Post';
import {sceneFor} from './scenes/registry';
import {shotAt} from './timeline';
import {C} from './theme';
import {useJson} from './lib/data';
import {AudioTrack} from './AudioTrack';

export const Main: React.FC<{offset?: number; bgm?: boolean; noPost?: boolean; noAudio?: boolean; noHtml?: boolean; q?: string}> = ({offset = 0, bgm = true, noPost = false, noAudio = false, noHtml = false, q = ''}) => {
  const frame = useCurrentFrame();
  // preload data before the WebGL canvas mounts (r3f only draws on frame advance)
  const g1 = useJson('data/globe.json');
  const g2 = useJson('data/ne_110m_land.geojson');
  const ready = g1 !== null && g2 !== null;
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps + offset;
  const shot = shotAt(t);
  const lt = t - shot.from, dur = shot.to - shot.from;
  const S = sceneFor(shot.id);
  const post = S.post ? S.post(lt, dur) : {};
  // push-through transition: zoom into the end of a shot, settle out of the start of the next
  const out = shot.to >= 227.9 ? 0 : Math.pow(Math.max(0, 1 - (shot.to - t) / 0.4), 2);
  const inn = shot.from === 0 ? 0 : Math.pow(Math.max(0, 1 - lt / 0.4), 2);
  const zoom = 1 + out * 0.14 + inn * 0.08;
  const trans = Math.max(out, inn);
  (post as {aberration?: number}).aberration = Math.min(1.4, ((post as {aberration?: number}).aberration ?? 0) + trans * 1.0);
  const Three = S.three, Html = S.html;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, filter: trans > 0.01 ? `brightness(${1 + trans * 0.6})` : undefined}}>
      {ready ? <ThreeCanvas key={shot.id} width={width} height={height} dpr={1} gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, position: [0, 0, 10], near: 0.05, far: 4000}}>
        <Three t={lt} dur={dur} />
        {noPost ? null : <Post frame={Math.round(t * 30)} {...post} q={q} />}
      </ThreeCanvas> : null}
      {Html && !noHtml ? <Html t={lt} dur={dur} /> : null}
      </AbsoluteFill>
      {noAudio ? null : <AudioTrack bgm={bgm} />}
      <Overlay t={t} shot={shot} hideChrome={S.hideChrome ? S.hideChrome(lt) : false} />
    </AbsoluteFill>
  );
};
