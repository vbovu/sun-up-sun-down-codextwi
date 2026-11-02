const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const opts={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.BROWSER_EXECUTABLE)opts.executablePath=process.env.BROWSER_EXECUTABLE;const b=await chromium.launch(opts);try{
 const page=await b.newPage({viewport:{width:1365,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL??'http://localhost:3000');await page.waitForFunction(()=>document.querySelector('[aria-label="Start audience encounter"]')?.disabled===false);
 await page.locator('[data-start="true"]').first().click();await page.locator('#btn-auto').click();await page.getByRole('button',{name:'Open Main Menu',exact:true}).click();
 await page.getByRole('button',{name:'Start audience encounter',exact:true}).click();await page.locator('body[data-encounter="true"]').waitFor();
 assert.equal(await page.locator('#tab-chat').isVisible(),false);assert.equal(await page.locator('#btn-close-console').isVisible(),false);
 await page.waitForTimeout(4500);assert.equal(await page.locator('body').getAttribute('data-scene'),'1');assert.equal(await page.locator('#console').isVisible(),true);
 await page.getByRole('button',{name:'Pause encounter',exact:true}).click();
 await page.route('**/api/control',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"expired synthetic session"}'}));
 await page.getByRole('button',{name:'Resume encounter',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Resume encounter',exact:true}).isVisible(),true);
 assert.equal(await page.locator('#stickman-canvas').evaluate(e=>JSON.parse(e.dataset.simulation).encounterPaused),true);
 await page.unroute('**/api/control');await page.getByRole('button',{name:'Leave encounter',exact:true}).click();await page.locator('body[data-state="title"]').waitFor();
 await page.locator('[data-start="true"]').first().click();await page.locator('#tab-game').click();
 await page.waitForFunction(()=>{const c=document.querySelector('#stickman-canvas');return c?.dataset.simulation&&!JSON.parse(c.dataset.simulation).encounterPaused;});
 const before=await page.locator('#stickman-canvas').getAttribute('data-knight-x');await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');const after=await page.locator('#stickman-canvas').getAttribute('data-knight-x');assert.notEqual(before,after);
 assert.equal(errors.length,0);await page.screenshot({path:'EVIDENCE/browser/restored-story-game.png'});
 const result={status:'PASS',observed:['Story Auto cannot advance/close console during encounter','Chat/Close isolated','Rejected resume preserves pause','Leave paused encounter restores original playable console'],beforeX:before,afterX:after,errors};fs.writeFileSync('EVIDENCE/browser/regressions.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
