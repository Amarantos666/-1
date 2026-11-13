import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT_EN, FONT_MONO, FONT_ZH} from '../theme';
import {CHAPTERS, SHOTS, TOTAL, Shot} from '../timeline';
import {clamp, ramp} from '../lib/math';

const accent = (p: Shot['palette']) => (p === 'A' ? C.cyan : p === 'B' ? '#C77DFF' : p === 'forget' ? C.grey : p === 'outro' ? C.goldHot : '#9fd8ff');

export const Overlay: React.FC<{t: number; shot: Shot; hideChrome?: boolean}> = ({t, shot, hideChrome}) => {
  const lt = t - shot.from;
  const ac = accent(shot.palette);
  const dur = shot.to - shot.from;
  const cue0 = shot.cues.find((c) => lt >= c.from && lt < Math.min(c.to, dur - 0.12));
  const cue = cue0 ? {...cue0, to: Math.min(cue0.to, dur - 0.12)} : undefined;
  const cueA = cue ? Math.min(ramp(lt, cue.from, cue.from + 0.25), 1 - ramp(lt, cue.to - 0.25, cue.to)) : 0;
  const noteA = shot.note ? Math.min(ramp(lt, 0.3, 0.9), 1 - ramp(lt, shot.to - shot.from - 0.4, shot.to - shot.from)) : 0;
  const chromeA = hideChrome ? 0 : 1;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* legibility band behind subtitles */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 820, bottom: 0, background: 'linear-gradient(180deg, rgba(6,6,20,0) 0%, rgba(6,6,20,0.5) 45%, rgba(6,6,20,0.62) 100%)', opacity: cue ? 0.4 + 0.6 * cueA : 0.4}} />
      {/* watermark */}
      <div style={{position: 'absolute', left: 56, top: 40, fontFamily: FONT_ZH, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: 'rgba(255,255,255,0.78)', textShadow: '0 0 12px rgba(120,180,255,0.35)'}}>
        vibe<span style={{color: ac}}>知识大赏</span>
      </div>
      {/* chapter label + progress */}
      <div style={{position: 'absolute', top: 36, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: chromeA}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, padding: '6px 20px', borderRadius: 999, background: 'rgba(10,10,30,0.45)', border: `1px solid ${ac}55`}}>
          <span style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 24, color: '#fff'}}>{shot.chapter}</span>
          <span style={{fontFamily: FONT_EN, fontWeight: 600, fontSize: 15, letterSpacing: 3, color: ac}}>{shot.chapterEn}</span>
        </div>
      </div>
      <div style={{position: 'absolute', top: 92, left: 560, right: 560, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, opacity: chromeA}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${clamp(t / TOTAL) * 100}%`, background: `linear-gradient(90deg, ${C.cyan}, #C77DFF, ${C.goldHot})`, borderRadius: 2, boxShadow: `0 0 10px ${ac}`}} />
        {CHAPTERS.map((c) => (
          <div key={c.label} style={{position: 'absolute', left: `${(c.from / TOTAL) * 100}%`, top: -3, width: 2, height: 9, background: t >= c.from ? '#fff' : 'rgba(255,255,255,0.35)'}} />
        ))}
      </div>
      {/* illustration tag */}
      {shot.illustration ? (
        <div style={{position: 'absolute', right: 56, top: 42, fontFamily: FONT_ZH, fontSize: 17, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, border: '1px solid rgba(255,255,255,0.28)', padding: '3px 10px', borderRadius: 4, opacity: chromeA}}>
          示意图 <span style={{fontFamily: FONT_EN, letterSpacing: 2, fontSize: 13}}>ILLUSTRATION</span>
        </div>
      ) : null}
      {/* data annotation bar (~70% height) */}
      {shot.note ? (
        <div style={{position: 'absolute', top: 742, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: noteA}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1500, padding: '8px 22px', borderRadius: 8, background: 'rgba(8,10,28,0.62)', borderLeft: `3px solid ${ac}`, fontFamily: FONT_MONO, fontSize: 21, color: 'rgba(235,240,255,0.92)', whiteSpace: 'nowrap'}}>
            <span style={{fontFamily: FONT_EN, fontSize: 13, letterSpacing: 2, color: ac, fontWeight: 700}}>DATA</span>
            <span style={{fontFamily: `${FONT_MONO}`}}>{shot.note}</span>
          </div>
        </div>
      ) : null}
      {/* subtitles: zh ~46px at 85-88%, en ~25px at ~90% */}
      {cue ? (
        <div style={{position: 'absolute', top: 896, left: 120, right: 120, textAlign: 'center', opacity: cueA, transform: `translateY(${(1 - cueA) * 8}px)`}}>
          <div style={{fontFamily: FONT_ZH, fontWeight: 700, fontSize: 46, lineHeight: '58px', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)', whiteSpace: 'nowrap'}}>{cue.zh}</div>
          <div style={{fontFamily: FONT_EN, fontWeight: 500, fontSize: 25, lineHeight: '34px', marginTop: 6, color: 'rgba(225,232,255,0.88)', textShadow: '0 2px 8px rgba(0,0,0,0.85)', whiteSpace: 'nowrap'}}>{cue.en}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const shotById = (id: string) => SHOTS.find((s) => s.id === id)!;
