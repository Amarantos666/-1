// Usage: node scripts/stills.mjs name:seconds [name:seconds ...]  -> out/stills/name.png (1920x1080)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';
const args = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const browser = await openBrowser('chrome', {browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: 'Main', puppeteerInstance: browser, inputProps: {}});
for (const a of args) {
  const [name, sec] = a.split(':');
  const t0 = Date.now();
  await renderStill({serveUrl, composition, frame: Math.round(eval(sec) * 30), output: `out/stills/${name}.png`, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}, timeoutInMilliseconds: 600000});
  console.log(name, sec, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close({silent: true});
