"""Build the film-length BGM edit (228 s) from the 0.9x-stretched track and a film-time beat map.
Segment 1: src 0-203.5 plays as-is (its natural fade-out lands on the quiet "forgotten" section).
Segment 2: src from just before the mid-song drop is spliced in at 205 s so the drop (src 113.94)
hits the golden line; fades out at the end."""
import json, numpy as np, soundfile as sf
TOTAL = 228.0
DROP_SRC = 113.94
GOLDEN = 214.6            # film time of the golden line (C1 local 9.6)
SEG2_FILM = 205.0
SEG2_SRC = DROP_SRC - (GOLDEN - SEG2_FILM)
y, sr = sf.read('assets/bgm_090.wav')
out = np.zeros((int(TOTAL * sr), y.shape[1]))
n1 = int(203.5 * sr); out[:n1] = y[:n1]
a = int(SEG2_SRC * sr); b = a + int((TOTAL - SEG2_FILM) * sr)
seg = y[a:b].copy()
env = np.ones(len(seg))
fi = int(1.2 * sr); env[:fi] = np.linspace(0, 1, fi) ** 2
fo = int(3.0 * sr); env[-fo:] = np.linspace(1, 0, fo) ** 1.5
seg *= env[:, None]
s0 = int(SEG2_FILM * sr); out[s0:s0 + len(seg)] += seg
sf.write('assets/bgm_edit.wav', out, sr)
d = json.load(open('data/beats.json'))
def mp(ts):
    r = [t for t in ts if t < 200]
    r += [round(t - SEG2_SRC + SEG2_FILM, 3) for t in ts if SEG2_SRC + 0.5 <= t <= SEG2_SRC + TOTAL - SEG2_FILM]
    return r
json.dump({'beats': mp(d['beats']), 'downbeats': mp(d['downbeats']), 'golden': GOLDEN, 'seg2src': SEG2_SRC}, open('src/beats.json', 'w'))
print('seg2 src', SEG2_SRC, 'downbeats near golden', [x for x in mp(d['downbeats']) if 210 < x < 218])
