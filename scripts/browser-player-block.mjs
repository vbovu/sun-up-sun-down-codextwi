import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out=process.env.EVIDENCE_DIR??`EVIDENCE/continuation-20261102/block-${Date.now()}`;
fs.mkdirSync(out,{recursive:true});
const options={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(process.env.BROWSER_EXECUTABLE)options.executablePath=process.env.BROWSER_EXECUTABLE;
const browser=await chromium.launch(options);
try{
 const page=await browser.newPage({viewport:{width:1365,height:768}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.BASE_URL??'http://localhost:3000');
 await page.getByRole('button',{name:'Audience setup',exact:true}).click();
 const setup=page.locator('.audience-setup');
 await expect(setup.getByTestId('audience-source')).not.toHaveText('LIVE');
 if(await setup.getByRole('button',{name:'Use solo mode',exact:true}).count())await setup.getByRole('button',{name:'Use solo mode',exact:true}).click();
 await setup.getByRole('button',{name:'Close audience setup',exact:true}).click();
 await page.locator('[data-start="true"]').click();
 await page.getByRole('button',{name:/Read Ethan/}).click();
 await page.getByRole('button',{name:'Put the console away',exact:true}).click();
 await page.getByRole('button',{name:/Talk to Mum/}).click();
 for(let i=0;i<2;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:/Talk to the driver/}).click();
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:/Open Ethan/}).click();
 await page.getByRole('button',{name:'Start audience encounter',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#stickman-canvas').dataset.simulation).encounterActive);
 await page.waitForFunction(()=>document.querySelector('#stickman-canvas').dataset.enemyState==='wind',null,{timeout:11000});
 for(let i=0;i<8;i++){
  await page.keyboard.press('s');await page.waitForTimeout(140);
  if(await page.locator('#stickman-canvas').evaluate(e=>JSON.parse(e.dataset.lastHit)?.kind==='block'))break;
 }
 const observed=await page.locator('#stickman-canvas').evaluate(e=>({hit:JSON.parse(e.dataset.lastHit),blocks:Number(e.dataset.blocks),aid:e.dataset.aid}));
 assert.equal(observed.hit.kind,'block','Player S must block before audience shield aid arrives');
 assert.equal(observed.hit.before,observed.hit.after);assert.ok(observed.blocks>0);assert.equal(errors.length,0);
 await page.screenshot({path:out+'/player-block.png'});
 const result={status:'PASS',observed,errors,method:'Real S key input during enemy windup; no audience aid required; health unchanged'};
 fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 await page.locator('#btn-close-console').click();
}finally{await browser.close();}
