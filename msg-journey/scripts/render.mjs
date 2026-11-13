// node scripts/render.mjs <out> [--scale=0.5] [--from=sec] [--to=sec] [--comp=Main] [--conc=3] [--nobgm] [--mute] [--png]
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const out = process.argv[2];
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const inputProps = {offset: 0, bgm: !args.nobgm, noPost: !!args.nopost, noAudio: !!args.noaudio, noHtml: !!args.nohtml, q: args.q ?? ''};
const composition = await selectComposition({serveUrl, id: args.comp ?? 'Main', inputProps, browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions: {gl: 'swangle'}});
const fps = composition.fps;
const fr = [Math.round((parseFloat(args.from ?? 0)) * fps), Math.min(composition.durationInFrames - 1, Math.round(parseFloat(args.to ?? 1e9) * fps) - 1)];
const t0 = Date.now(); let last = 0;
await renderMedia({
  serveUrl, composition, inputProps, outputLocation: out, codec: args.codec ?? 'h264', ...((args.codec ?? 'h264') === 'h264' ? {crf: args.crf ? parseInt(args.crf) : 18, imageFormat: args.png ? 'png' : 'jpeg', jpegQuality: 95} : {}),
  frameRange: fr, scale: parseFloat(args.scale ?? 1), concurrency: parseInt(args.conc ?? 3), muted: !!args.mute,
  browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions: {gl: 'swangle'}, timeoutInMilliseconds: 600000,
  onProgress: ({renderedFrames}) => { const now = Date.now(); if (now - last > 20000) { last = now; const el = (now - t0) / 1000; console.log(`${renderedFrames}/${fr[1] - fr[0] + 1} frames, ${(el / Math.max(1, renderedFrames)).toFixed(2)} s/frame, ${el.toFixed(0)}s`); } },
});
console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
