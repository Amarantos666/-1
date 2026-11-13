import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Overlay} from './overlay/Overlay';
import {Post} from './three/Post';
import {sceneFor} from './scenes/registry';
import {shotAt} from './timeline';
import {C} from './theme';
import {useJson} from './lib/data';

export const Main: React.FC<{offset?: number}> = ({offset = 0}) => {
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
  const Three = S.three, Html = S.html;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {ready ? <ThreeCanvas key={shot.id} width={width} height={height} dpr={1} gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, position: [0, 0, 10], near: 0.05, far: 4000}}>
        <Three t={lt} dur={dur} />
        <Post frame={Math.round(t * 30)} {...post} />
      </ThreeCanvas> : null}
      {Html ? <Html t={lt} dur={dur} /> : null}
      <Overlay t={t} shot={shot} hideChrome={S.hideChrome ? S.hideChrome(lt) : false} />
    </AbsoluteFill>
  );
};
