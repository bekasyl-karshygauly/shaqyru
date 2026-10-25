import base from './playwright.config.js';
export default {...base,testMatch:['invitation-links.spec.js','orders.spec.js','order-workflow.spec.js'],timeout:45000,
  webServer:process.env.WORKFLOW_TEST_URL?undefined:{command:'node scripts/serve-workflow-fixture.js',url:'http://127.0.0.1:3110/health',reuseExistingServer:false,env:{PORT:'3110',NODE_OPTIONS:'--max-old-space-size=192 --max-semi-space-size=4'}},
  use:{...base.use,baseURL:process.env.WORKFLOW_TEST_URL||'http://127.0.0.1:3110',launchOptions:{args:['--js-flags=--max-old-space-size=96','--renderer-process-limit=1','--disable-gpu','--in-process-gpu']}}};
