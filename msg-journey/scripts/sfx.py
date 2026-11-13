"""Synthesize all sound effects (deterministic, seeded). Output: public/sfx/*.wav (44.1 kHz stereo)."""
import numpy as np, soundfile as sf
SR = 44100
rng = np.random.default_rng(7)
def t(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, k=8.0): x = t(d); return np.minimum(1, x / a) * np.exp(-x * k)
def lp(x, a):  # one-pole low-pass, a in (0,1)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += a * (x[i] - s); y[i] = s
    return y
def hp(x, a): return x - lp(x, a)
def st(x, w=0.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    d = int(w * SR); r = np.concatenate([np.zeros(d), x])[:len(x)] if d else x
    return np.stack([x, r], 1)
def save(n, x, w=0.0): sf.write(f'public/sfx/{n}.wav', st(x, w), SR)

# key click: bright noise tick + tiny body
d = 0.12; x = hp(rng.standard_normal(int(d*SR)), 0.3) * env(d, 0.001, 70) + 0.5*np.sin(2*np.pi*180*t(d)) * env(d, 0.001, 40); save('key', x)
# enter: heavier click + sub thump
d = 0.6; x = hp(rng.standard_normal(int(d*SR)), 0.25) * env(d, 0.001, 45) + 1.2*np.sin(2*np.pi*(60+80*np.exp(-t(d)*25))*t(d)) * env(d, 0.002, 7); save('enter', x)
# impact (slams on downbeats)
d = 1.2; f = 45 + 110*np.exp(-t(d)*18); x = np.sin(2*np.pi*np.cumsum(f)/SR) * env(d, 0.002, 4.5) + 0.3*lp(rng.standard_normal(int(d*SR)), 0.08)*env(d, 0.001, 10); save('impact', x)
# hum ("嗡" at the split): detuned low chord swelling then fading
d = 2.4; x = sum(np.sin(2*np.pi*f*t(d)) for f in [55, 55.7, 110.3, 164.6]) * np.minimum(1, t(d)/0.15) * np.exp(-t(d)*1.4); save('hum', x, 0.012)
# whoosh: noise through a sweeping low-pass
d = 0.9; n = rng.standard_normal(int(d*SR)); sw = 0.02 + 0.25*np.sin(np.pi*t(d)/d)**2; y = np.empty_like(n); s = 0.0
for i in range(len(n)): s += sw[i]*(n[i]-s); y[i] = s
save('whoosh', y*np.sin(np.pi*t(d)/d)**1.5, 0.008)
# rustle ("沙沙"): dense tiny grains
d = 4.0; x = np.zeros(int(d*SR))
for k in range(2600):
    p = int(rng.uniform(0, d-0.02)*SR); g = hp(rng.standard_normal(300), 0.5) * np.exp(-np.arange(300)/50) * rng.uniform(0.2, 1)
    x[p:p+300] += g
x *= np.minimum(1, t(d)/0.3) * np.minimum(1, (d-t(d))/0.6); save('rustle', x, 0.006)
# fan / server room bed (loopable 12 s)
d = 12.0; b = lp(rng.standard_normal(int(d*SR)), 0.02); x = b*3 + 0.25*np.sin(2*np.pi*120*t(d)) + 0.1*np.sin(2*np.pi*240*t(d)) + 0.15*lp(rng.standard_normal(int(d*SR)), 0.2)
fade = int(0.5*SR); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade); save('fan', x, 0.01)
# token tick ("哒")
d = 0.06; x = np.sin(2*np.pi*2100*t(d)) * env(d, 0.0005, 120) + 0.4*hp(rng.standard_normal(int(d*SR)), 0.4)*env(d, 0.0005, 160); save('tick', x)
# ding (arrival)
d = 2.2; x = sum(a*np.sin(2*np.pi*f*t(d))*np.exp(-t(d)*k) for f, a, k in [(1318.5, 1, 2.2), (2637, 0.35, 3.5), (3950, 0.15, 5), (1975.5, 0.25, 3)]) * np.minimum(1, t(d)/0.003); save('ding', x, 0.004)
# glitch (encryption / x-ray)
d = 0.5; x = np.sign(np.sin(2*np.pi*np.cumsum(300+2000*rng.random(int(d*SR)))/SR)) * (rng.random(int(d*SR)) > 0.3) * env(d, 0.002, 7) * 0.5; save('glitch', x)
# shatter: bright resonant noise burst with many tiny tinkles
d = 2.5; x = hp(rng.standard_normal(int(d*SR)), 0.6) * env(d, 0.001, 6)
for k in range(90):
    p = int(rng.uniform(0, 1.6)*SR); f = rng.uniform(2500, 7000); L = int(0.25*SR); tt = np.arange(L)/SR
    seg = np.sin(2*np.pi*f*tt) * np.exp(-tt*rng.uniform(15, 40)) * rng.uniform(0.1, 0.5) * np.exp(-p/SR*1.5)
    x[p:p+L] += seg[:max(0, min(L, len(x)-p))]
save('shatter', x, 0.007)
# long decay ("忘记"): cold low tone + shimmer fading over 7 s
d = 7.0; x = (np.sin(2*np.pi*73.4*t(d)) + 0.5*np.sin(2*np.pi*110*t(d)+0.3) + 0.25*np.sin(2*np.pi*146.8*t(d)) + 0.12*np.sin(2*np.pi*880*t(d))*np.sin(2*np.pi*0.7*t(d))) * np.minimum(1, t(d)/0.05) * np.exp(-t(d)*0.55); save('decay', x, 0.015)
print('ok')
