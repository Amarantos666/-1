import React from 'react';
import {Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import {SHOTS, shotFrom} from './timeline';
import {O1_PRESS} from './scenes/O1';
import {O2_SPLIT} from './scenes/Title';
import {A1_NOW} from './scenes/A1';
import {A2_SHATTER, A2_SLAM, A2_ENCRYPT, A2_COMPRESS} from './scenes/A2';
import {A3_TEXT, A3_WALL} from './scenes/A3';
import {A5_ARRIVE} from './scenes/A5';
import {A6_LOST, A6_RESEND, A6_SHARP} from './scenes/A6';
import {B1_XRAY, B1_UNROLL, B1_NOTE} from './scenes/B1';
import {B2_G1, B2_G2, B2_G3} from './scenes/B2';
import {B5_FLY} from './scenes/B5';
import {B6_FLASH, B6_LAND} from './scenes/B6';
import {b7Steps} from './scenes/B7';
import {tokenArrive} from './scenes/B8';
import {REPLY} from './scenes/B7';
import {F1_SHATTER} from './scenes/F1';
import {C1_GOLD} from './scenes/Outro';
import {TOTAL} from './timeline';

type Ev = {t: number; s: string; v: number; d?: number};
const at = (id: string, local: number) => shotFrom(id) + local;

export function sfxEvents(): Ev[] {
  const e: Ev[] = [];
  // O1: typing (pinyin keystrokes), attach, Enter
  [1.45, 1.6, 1.78, 1.92, 2.3, 2.45, 2.6, 2.78, 3.05].forEach((x) => e.push({t: at('O1', x), s: 'key', v: 0.35}));
  e.push({t: at('O1', 3.9), s: 'key', v: 0.45});
  e.push({t: at('O1', O1_PRESS) - 0.01, s: 'enter', v: 0.9}, {t: at('O1', O1_PRESS), s: 'impact', v: 0.7}, {t: at('O1', O1_PRESS) + 0.05, s: 'hum', v: 0.6}, {t: at('O1', O1_PRESS) + 0.1, s: 'whoosh', v: 0.5});
  e.push({t: at('O2', O2_SPLIT), s: 'impact', v: 0.5});
  // transitions: a soft whoosh into every shot
  SHOTS.slice(1).forEach((s) => { if (s.id !== 'C1' && s.id !== 'R1') e.push({t: s.from - 0.45, s: 'whoosh', v: s.id === 'A0' || s.id === 'B0' ? 0.6 : 0.3}); });
  // A1 telegraph clicks then the "16 ms" slam
  for (let x = 0.5; x < A1_NOW - 0.2; x += 0.23) e.push({t: at('A1', x), s: 'tick', v: 0.18});
  e.push({t: at('A1', A1_NOW), s: 'impact', v: 0.7});
  // A2 bytes
  e.push({t: at('A2', 1.0), s: 'key', v: 0.4}, {t: at('A2', A2_SHATTER), s: 'rustle', v: 0.45, d: 4}, {t: at('A2', A2_SLAM), s: 'impact', v: 0.85}, {t: at('A2', A2_COMPRESS), s: 'whoosh', v: 0.4}, {t: at('A2', A2_ENCRYPT), s: 'glitch', v: 0.5});
  // A3 packets
  e.push({t: at('A3', A3_TEXT), s: 'key', v: 0.45}, {t: at('A3', A3_WALL), s: 'rustle', v: 0.6, d: 4});
  // A4 / A5
  e.push({t: at('A4', 2.0), s: 'whoosh', v: 0.4}, {t: at('A5', 0.8), s: 'rustle', v: 0.35, d: 4}, {t: at('A5', A5_ARRIVE), s: 'impact', v: 0.8});
  // A6 reassembly
  e.push({t: at('A6', 0.2), s: 'rustle', v: 0.4, d: 3}, {t: at('A6', A6_LOST), s: 'glitch', v: 0.35}, {t: at('A6', A6_RESEND), s: 'tick', v: 0.5}, {t: at('A6', A6_SHARP), s: 'ding', v: 0.75});
  // B1 / B2
  e.push({t: at('B1', B1_XRAY), s: 'glitch', v: 0.35}, {t: at('B1', B1_UNROLL), s: 'whoosh', v: 0.45}, {t: at('B1', B1_NOTE), s: 'key', v: 0.4});
  [B2_G1, B2_G2 + 0.3, B2_G3 + 0.2].forEach((x) => e.push({t: at('B2', x), s: 'tick', v: 0.5}));
  // B4 decode steps (tiny ticks per step)
  for (let x = 1.2; x < SHOTS.find((s) => s.id === 'B4')!.to - shotFrom('B4'); x += 0.58) e.push({t: at('B4', x), s: 'tick', v: 0.12});
  e.push({t: at('B5', B5_FLY), s: 'rustle', v: 0.45, d: 4});
  e.push({t: at('B6', B6_FLASH), s: 'hum', v: 0.4}, {t: at('B6', B6_LAND), s: 'impact', v: 0.6});
  // B7 "哒哒" accelerating, B8 one tick per streamed token
  b7Steps().forEach((x) => e.push({t: at('B7', x), s: 'tick', v: 0.4}));
  REPLY.forEach((_, k) => e.push({t: at('B8', tokenArrive(k)), s: 'tick', v: 0.3}));
  // twist: shatter + one long decay
  e.push({t: at('F1', F1_SHATTER), s: 'shatter', v: 0.7}, {t: at('F1', F1_SHATTER) + 0.15, s: 'decay', v: 0.8});
  // golden line
  e.push({t: at('C1', C1_GOLD), s: 'impact', v: 0.6}, {t: at('C1', C1_GOLD), s: 'ding', v: 0.45}, {t: TOTAL - 5.6, s: 'ding', v: 0.3});
  return e;
}

export const AudioTrack: React.FC<{bgm: boolean}> = ({bgm}) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(0, Math.round(s * fps));
  const ev = sfxEvents();
  const fanFrom = shotFrom('B3'), fanTo = shotFrom('C1');
  const forget = shotFrom('F1');
  return (
    <>
      {bgm ? <Audio src={staticFile('audio/bgm_edit.wav')} volume={0.82} /> : null}
      {/* server-room fan bed: from the data centre to the end of the twist, louder when everything else goes quiet */}
      <Sequence from={f(fanFrom)} durationInFrames={f(fanTo - fanFrom)}>
        <Audio src={staticFile('sfx/fan.wav')} loop volume={(fr) => { const tt = fanFrom + fr / fps; const base = tt > forget ? 0.42 : 0.14; const fadeIn = Math.min(1, (tt - fanFrom) / 1.5); const fadeOut = Math.min(1, (fanTo - tt) / 1.0); return base * fadeIn * Math.max(0, fadeOut); }} />
      </Sequence>
      {ev.map((x, i) => (
        <Sequence key={i} from={f(x.t)} durationInFrames={f(x.d ?? 3) || 1}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </>
  );
};
