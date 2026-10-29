import {defineConfig} from '@playwright/test';
// Layout geometry only: real CSS/components, no HTTP server, API or business data.
export default defineConfig({testDir:'./tests/layout',timeout:20000,workers:1,use:{channel:process.env.CI?undefined:'chrome',headless:true},projects:[{name:'desktop',use:{viewport:{width:1366,height:768}}},{name:'short-desktop',use:{viewport:{width:1280,height:600}}},{name:'mobile',use:{viewport:{width:393,height:851},isMobile:true,hasTouch:true}}]});
