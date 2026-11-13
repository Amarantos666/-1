"""Detect beats of assets/bgm.mp3 after 0.9x time-stretch (tempo change, pitch preserved via ffmpeg atempo)."""
import subprocess, json, sys, numpy as np, librosa
SRC = 'assets/bgm.mp3'; OUT = 'assets/bgm_090.wav'
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',SRC,'-filter:a','atempo=0.9','-ar','44100',OUT],check=True)
y, sr = librosa.load(OUT, sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
onset = librosa.onset.onset_strength(y=y, sr=sr)
times = librosa.times_like(onset, sr=sr)
# downbeat guess: strongest phase of 4 by onset strength at beats
bf = librosa.time_to_frames(beats, sr=sr)
strength = onset[np.clip(bf,0,len(onset)-1)]
phase = int(np.argmax([strength[i::4].mean() for i in range(4)]))
down = beats[phase::4]
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
# per-second loudness envelope for structure
sec = [float(rms[(rt>=s)&(rt<s+1)].mean()) for s in range(int(rt[-1]))]
json.dump({'tempo': float(np.atleast_1d(tempo)[0]), 'duration': float(len(y)/sr), 'beats': [round(float(b),3) for b in beats],
           'downbeats': [round(float(b),3) for b in down], 'beat_strength': [round(float(s),3) for s in strength], 'rms_per_sec': [round(s,4) for s in sec]},
          open('data/beats.json','w'))
print('tempo', tempo, 'dur', len(y)/sr, 'nbeats', len(beats), 'phase', phase)
print('first beats', beats[:12])
print('rms/sec', ' '.join(f'{s:.2f}' for s in sec))
