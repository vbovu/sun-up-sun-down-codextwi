// Only run after owner authorization and an explicit request for a real chat vote.
import {chromium,expect} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR??'EVIDENCE/playability-20261102/live';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1365,height:768}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:3000');
 const state=()=>p.evaluate(async()=>{const r=await fetch('/api/state');return r.json();});
 assert.equal((await state()).audience.source,'LIVE');
 await p.locator('[data-start="true"]').click();await p.getByRole('button',{name:/Read Ethan/}).click();await p.getByRole('button',{name:'Put the console away',exact:true}).click();
 await p.getByRole('button',{name:/Talk to Mum/}).click();for(let i=0;i<2;i++)await p.getByRole('button',{name:'Continue',exact:true}).click();
 await p.getByRole('button',{name:/Talk to the driver/}).click();for(let i=0;i<5;i++)await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:/Open Ethan/}).click();
 await p.getByRole('button',{name:'Start audience encounter',exact:true}).click();console.log('LIVE vote window open; awaiting owner !torch.');
 const opened=Date.now();let accepted,applied=false;
 while(Date.now()-opened<54000){
  const d=await state();assert.equal(d.audience.source,'LIVE');
  if(d.lastLiveEvent?.value==='torch')accepted=d.lastLiveEvent;
  if(accepted&&await p.locator('#stickman-canvas').getAttribute('data-aid')==='torch'){applied=true;break;}
  const next=p.getByRole('button',{name:'Open next aid vote',exact:true});if(await next.count()&&await next.isEnabled())await next.click();
  await p.waitForTimeout(300);
 }
 if(!applied){fs.writeFileSync(out+'/results.json',JSON.stringify({status:'NOT_RUN',authorization:'LIVE',reason:'No real torch effect observed within owner test interval',accepted:accepted??null},null,2));console.log('LIVE authorized; no real torch effect yet.');}
 else{
  // Approach using real movement; stay inside slash range for one real attack.
  await p.keyboard.down('d');await p.waitForTimeout(300);await p.keyboard.up('d');
  await p.waitForFunction(()=>{const d=document.querySelector('#stickman-canvas').dataset;return Number(d.enemyHealth)>35&&Math.abs(Number(d.enemyX)-Number(d.knightX))<74;},null,{timeout:3500});
  const before=Number(await p.locator('#stickman-canvas').getAttribute('data-enemy-health'));await p.keyboard.press('f');
  await p.waitForFunction(hp=>Number(document.querySelector('#stickman-canvas').dataset.enemyHealth)<hp,before,{timeout:2000});const after=Number(await p.locator('#stickman-canvas').getAttribute('data-enemy-health'));assert.equal(before-after,35);
  await p.screenshot({path:out+'/real-twitch-torch.png'});const result={status:'PASS',authorization:'LIVE',acceptedLiveEvent:accepted,aidApplied:'torch',enemyHealth:{before,after,damage:before-after},errors,observedAt:new Date().toISOString(),method:'Owner real Twitch message accepted by authenticated EventSub bridge; browser applied torch; real D/F input dealt35damage. No synthetic vote API used.'};assert.equal(errors.length,0);fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
 if(await p.locator('#btn-close-console').isVisible())await p.locator('#btn-close-console').click();
}finally{await b.close();}
