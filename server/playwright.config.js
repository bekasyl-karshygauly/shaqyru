import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/browser",timeout:20000,workers:1,
  use:{baseURL:"http://127.0.0.1:3107",headless:true},
  webServer:{command:"node server.js",url:"http://127.0.0.1:3107",env:{PORT:"3107"},reuseExistingServer:false}
});
