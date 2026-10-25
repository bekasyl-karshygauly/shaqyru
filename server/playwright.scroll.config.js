import base from './playwright.config.js';
export default {...base,testMatch:['invitation-scroll.spec.js','openings.spec.js','motion.spec.js'],
  webServer:process.env.SCROLL_TEST_URL?undefined:base.webServer,
  use:{...base.use,baseURL:process.env.SCROLL_TEST_URL||base.use.baseURL,launchOptions:{args:['--js-flags=--max-old-space-size=96','--renderer-process-limit=1','--disable-gpu','--in-process-gpu']}}};
