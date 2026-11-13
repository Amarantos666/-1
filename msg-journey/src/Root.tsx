import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {TOTAL} from './timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={Math.round(TOTAL * 30)} fps={30} width={1920} height={1080} defaultProps={{offset: 0}} />
    {/* Same film sampled at 120 fps: 4 sub-frames per output frame, blended in ffmpeg for motion blur. */}
    <Composition id="Main120" component={Main} durationInFrames={Math.round(TOTAL * 120)} fps={120} width={1920} height={1080} defaultProps={{offset: 0}} />
  </>
);
