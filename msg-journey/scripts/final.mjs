// Final 1080p render.
//   node scripts/final.mjs [--q=m0,dofq] [--conc=4] [--only=assemble]
// Segments come from out/segments.json (scripts/export_meta.ts). Fast-motion segments are rendered from the
// 120 fps composition (4 jittered sub-frames per output frame) and blended -> motion blur + anti-aliasing.
// Other segments render at 30 fps with FXAA. Everything is a pure function of the frame number, so any
// segment can be re-rendered on its own (delete its file and run again).
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const Q = args.q ?? 'm0,dofq';
const CONC = parseInt(args.conc ?? 4);
const DIR = 'out/final';
fs.mkdirSync(DIR, {recursive: true});
const segs = JSON.parse(fs.readFileSync('out/segments.json', 'utf8'));
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], {stdio: 'inherit'});
const browser = {browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions: {gl: 'swangle'}};

if (args.only !== 'assemble') {
  const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
  const comps = {};
  for (const id of ['Main', 'Main120']) comps[id] = await selectComposition({serveUrl, id, inputProps: {offset: 0, bgm: true}, ...browser});
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const out = `${DIR}/seg_${String(i).padStart(2, '0')}.mp4`;
    if (fs.existsSync(out)) continue;
    const t0 = Date.now();
    const blur = s.blur;
    const comp = comps[blur ? 'Main120' : 'Main'];
    const k = blur ? 4 : 1;
    const raw = blur ? `${DIR}/raw_${i}.mp4` : out;
    const inputProps = {offset: 0, bgm: true, noAudio: true, q: blur ? Q : `${Q},fxaa`};
    await renderMedia({serveUrl, composition: {...comp, props: inputProps}, inputProps, outputLocation: raw, codec: 'h264', crf: 12, x264Preset: 'medium',
      frameRange: [s.f0 * k, s.f1 * k - 1], concurrency: CONC, muted: true, imageFormat: 'jpeg', jpegQuality: 96, timeoutInMilliseconds: 900000, ...browser});
    if (blur) {
      ff('-i', raw, '-vf', "tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\\,4)\\,3)',setpts=N/30/TB", '-r', '30', '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-video_track_timescale', '90000', out);
      fs.rmSync(raw);
    }
    console.log(`seg ${i}/${segs.length} ${blur ? 'blur' : 'std '} frames ${s.f0}-${s.f1} in ${((Date.now() - t0) / 1000).toFixed(0)}s  ${new Date().toTimeString().slice(0, 8)}`);
  }
  // audio stems: full mix and SFX-only
  for (const [name, bgm] of [['mix', true], ['sfx', false]]) {
    const out = `${DIR}/${name}.wav`;
    if (fs.existsSync(out)) continue;
    await renderMedia({serveUrl, composition: {...comps.Main, props: {offset: 0, bgm}}, inputProps: {offset: 0, bgm}, outputLocation: out, codec: 'wav', ...browser});
  }
}

// assemble: concat video, loudness-normalise the mix to -14 LUFS (SFX-only stem gets the same gain)
fs.writeFileSync(`${DIR}/list.txt`, segs.map((_, i) => `file 'seg_${String(i).padStart(2, '0')}.mp4'`).join('\n'));
if (!fs.existsSync(`${DIR}/video.mp4`)) ff('-f', 'concat', '-safe', '0', '-i', `${DIR}/list.txt`, '-c:v', 'libx264', '-crf', '18', '-maxrate', '25M', '-bufsize', '50M', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', '30', `${DIR}/video.mp4`);
const statsRaw = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i ${DIR}/mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -12`]).toString();
const st = JSON.parse(statsRaw.slice(statsRaw.indexOf('{')));
const gain = -14 - parseFloat(st.input_i);
console.log('mix loudness', st.input_i, 'LUFS -> gain', gain.toFixed(2), 'dB');
ff('-i', `${DIR}/mix.wav`, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=disabled`, '-ar', '48000', `${DIR}/mix_n.wav`);
ff('-i', `${DIR}/sfx.wav`, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=disabled`, '-ar', '48000', `${DIR}/sfx_n.wav`);
for (const [name, a] of [['final.mp4', 'mix_n.wav'], ['final_nobgm.mp4', 'sfx_n.wav']]) {
  ff('-i', `${DIR}/video.mp4`, '-i', `${DIR}/${a}`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', name);
}
console.log('FINAL DONE');
