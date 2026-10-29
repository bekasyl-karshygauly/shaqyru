import base from './playwright.config.js';
export default {...base,timeout:60000,workers:1,
  webServer:process.env.ENGINES_TEST_URL?undefined:{command:'node scripts/serve-workflow-fixture.js',url:'http://127.0.0.1:3132',env:{PORT:'3132'},reuseExistingServer:true},
  reporter:[['line'],['json',{outputFile:'test-results/browser-engines.json'}]],
  use:{...base.use,baseURL:process.env.ENGINES_TEST_URL||'http://127.0.0.1:3132',viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1,reducedMotion:'no-preference',screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'chromium',testMatch:'browser-engines.spec.js',use:{browserName:'chromium',launchOptions:{args:['--js-flags=--max-old-space-size=128','--renderer-process-limit=1','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}},
    {name:'webkit',testMatch:'browser-engines.spec.js',use:{browserName:'webkit'}},
    {name:'firefox',testMatch:'browser-engines.spec.js',use:{browserName:'firefox',headless:!process.env.CI,launchOptions:{timeout:30000,firefoxUserPrefs:{'webgl.force-enabled':true}}}},
    {name:'regression',testMatch:['invitation-scroll.spec.js','invitation-webgl.spec.js','mobile-webgl-performance.spec.js'],use:{browserName:'chromium',launchOptions:{args:['--js-flags=--max-old-space-size=128','--renderer-process-limit=1','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}}
  ]
};
