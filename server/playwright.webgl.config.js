import base from './playwright.config.js';
export default {...base,testMatch:['invitation-webgl.spec.js'],timeout:45000,
  webServer:process.env.WEBGL_TEST_URL?undefined:base.webServer,
  use:{...base.use,baseURL:process.env.WEBGL_TEST_URL||base.use.baseURL,
    launchOptions:{args:['--js-flags=--max-old-space-size=128','--renderer-process-limit=1','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}};
