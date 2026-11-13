import {Config} from '@remotion/cli/config';
// WebGL runs on SwiftShader (CPU) inside headless Chromium.
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable('/opt/pw-browsers/chromium');
Config.setVideoImageFormat('png');
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(600000);
