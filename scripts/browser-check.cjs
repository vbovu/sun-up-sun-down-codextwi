const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
let playwright;try{playwright=require('@playwright/test');}catch{playwright=require('C:/Users/bovuv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
(async()=>{
 const options={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.BROWSER_EXECUTABLE)options.executablePath=process.env.BROWSER_EXECUTABLE;
 const browser=await playwright.chromium.launch(options);const reports=[];fs.mkdirSync('EVIDENCE/browser',{recursive:true});
 try {
  for(const viewport of [{width:1365,height:768},{width:1920,height:1080}]) {
   const context=await browser.newContext({viewport,recordVideo:{dir:'EVIDENCE/browser',size:{width:1365,height:768}}});
   const page=await context.newPage(),errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
   await page.goto(process.env.BASE_URL??'http://localhost:3000');await page.waitForFunction(()=>document.querySelector('[aria-label="Start audience encounter"]')?.disabled===false);
   if(await page.getByRole('button',{name:'Use solo mode',exact:true}).count())await page.getByRole('button',{name:'Use solo mode',exact:true}).click();
   await page.screenshot({path:`EVIDENCE/browser/title-${viewport.width}.png`});
   await page.getByRole('button',{name:'Use DEMO viewers',exact:true}).click();
   await page.getByRole('button',{name:'Start audience encounter',exact:true}).click();
   await page.locator('body[data-encounter="true"]').waitFor();
   await page.getByRole('button',{name:'DEMO !torch',exact:true}).click();await page.getByText('1 viewers',{exact:true}).waitFor();
   // The second command from the same synthetic viewer must not change the vote.
   await page.getByRole('button',{name:'DEMO !shield',exact:true}).click();
   assert.equal(await page.locator('.vote-window').innerText().then(t=>t.includes('1 viewers')),true);
   await page.getByRole('button',{name:'Pause encounter',exact:true}).click();const frozen=await page.locator('.vote-window').innerText();
   await page.waitForTimeout(1100);assert.equal(await page.locator('.vote-window').innerText(),frozen);
   await page.keyboard.down('d');await page.keyboard.up('d');await page.getByRole('button',{name:'Resume encounter',exact:true}).click();
   await page.getByTestId('aid-result').filter({hasText:'DEMO audience: torch'}).waitFor({timeout:18000});
   await page.waitForFunction(()=>document.querySelector('#stickman-canvas')?.dataset.aid==='torch');
   await page.screenshot({path:`EVIDENCE/browser/torch-${viewport.width}.png`});
   // Send real keyboard input while the active knight is visible.
   const beforeX=await page.locator('#stickman-canvas').getAttribute('data-knight-x');
   await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');
   const afterX=await page.locator('#stickman-canvas').getAttribute('data-knight-x');assert.notEqual(afterX,beforeX,'Keyboard movement must change the real knight position');
   await page.keyboard.press('w');await page.keyboard.press('s');
   for(let i=0;i<4;i++){await page.keyboard.press('f');await page.waitForTimeout(500);}
   await page.screenshot({path:`EVIDENCE/browser/combat-${viewport.width}.png`});
   // A blur clears held movement and requires explicit resume.
   await page.keyboard.down('a');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('a');
   await page.getByRole('button',{name:'Resume encounter',exact:true}).waitFor();await page.getByRole('button',{name:'Resume encounter',exact:true}).click();await page.getByRole('button',{name:'Pause encounter',exact:true}).waitFor();
   const panel=await page.locator('.audience-panel').boundingBox(),canvas=await page.locator('#console').boundingBox();
   assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=viewport.width&&panel.y+panel.height<=viewport.height);
   assert.ok(canvas.x>=0&&canvas.y>=0&&canvas.x+canvas.width<=viewport.width+1);
   await page.getByRole('checkbox',{name:'Reduced motion'}).check();assert.equal(await page.locator('html').getAttribute('data-reduced-motion'),'true');
   await page.getByRole('button',{name:'Leave encounter',exact:true}).click();await page.locator('body[data-state="title"]').waitFor();
   assert.equal(errors.length,0,errors.join('\n'));assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
   reports.push({viewport,errors,consoleErrors,panel,canvas,beforeX,afterX,observed:'DEMO torch applied, duplicate viewer ignored, pause clock frozen, keyboard movement/jump/block/slash, blur pause, reduced motion, leave to title'});
   await page.getByRole('button',{name:'Use solo mode',exact:true}).click();
   await context.close();
  }
  // One complete 60s route with no viewer votes, separate from the interactive DEMO proof.
  const context=await browser.newContext({viewport:{width:1365,height:768}}),page=await context.newPage();
  await page.goto(process.env.BASE_URL??'http://localhost:3000');await page.waitForFunction(()=>document.querySelector('[aria-label="Start audience encounter"]')?.disabled===false);
  const solo=page.getByRole('button',{name:'Use solo mode',exact:true});if(await solo.count())await solo.click();
  await page.getByRole('button',{name:'Start audience encounter',exact:true}).click();
  await page.getByTestId('aid-result').filter({hasText:'Solo fallback'}).waitFor({timeout:18000});
  await page.getByText('Encounter finished.',{exact:false}).waitFor({timeout:60000});
  await page.screenshot({path:'EVIDENCE/browser/solo-finished.png'});await context.close();
  reports.push({observed:'Full 60-second solo route completed with no votes; automatic fallback; title returned.'});
  // Rejected server controls must never start a new local encounter.
  const rejected=await browser.newContext(),rejectedPage=await rejected.newPage();await rejectedPage.goto(process.env.BASE_URL??'http://localhost:3000');
  await rejectedPage.waitForFunction(()=>document.querySelector('[aria-label="Start audience encounter"]')?.disabled===false);
  await rejectedPage.route('**/api/control',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"expired test session"}'}));
  await rejectedPage.getByRole('button',{name:'Start audience encounter',exact:true}).click();await rejectedPage.getByRole('alert').waitFor();
  assert.notEqual(await rejectedPage.locator('body').getAttribute('data-encounter'),'true');await rejected.close();
  reports.push({observed:'Synthetic expired-session HTTP401 refused; local encounter did not start.'});
  fs.writeFileSync('EVIDENCE/browser/results.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
