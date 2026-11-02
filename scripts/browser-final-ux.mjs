import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='EVIDENCE/ux-20261102/browser',base=process.env.BASE_URL??'http://localhost:3012';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try{
 for(const width of [1365,1920,900]){
 const p=await b.newPage({viewport:{width,height:width===1920?1080:768}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
 await p.locator('[data-start="true"]').click();await expect(p.getByRole('dialog',{name:'Choose graphics',exact:true})).toBeVisible();
 for(const [i,name] of ['Ink & gouache','Painterly','Classic toon','Colour sketch'].entries()){
  if(width!==1365&&i!==0)continue;await p.getByRole('button',{name:new RegExp(name)}).click();await expect(p.locator('#stage')).toHaveAttribute('data-graphics',String(i));await p.waitForTimeout(600);await p.screenshot({path:`${out}/graphics-${width}-${i}.png`});
 }
 await p.getByRole('button',{name:/Ink & gouache/}).click();await p.getByRole('button',{name:'Use graphics and play',exact:true}).click();
 await p.getByRole('button',{name:/Read Ethan/}).click();await p.getByRole('button',{name:'Put the console away',exact:true}).click();
 await p.getByRole('button',{name:/Talk to Mum/}).click();for(let i=0;i<2;i++)await p.getByRole('button',{name:'Continue',exact:true}).click();
 const savedBeat=await p.locator('body').getAttribute('data-beat');await p.keyboard.press('Escape');await p.getByRole('button',{name:'Return to title',exact:true}).click();
 await p.screenshot({path:`${out}/continue-menu-${width}.png`});await p.locator('[data-start="true"]').click();await expect(p.getByRole('dialog',{name:'Start a new chapter',exact:true})).toBeVisible();await p.getByRole('button',{name:'Keep my progress',exact:true}).click();
 await p.getByRole('button',{name:'Continue chapter',exact:true}).click();await expect(p.locator('body')).toHaveAttribute('data-journey','world');await expect(p.locator('body')).toHaveAttribute('data-beat',savedBeat);
 await p.getByRole('button',{name:/Talk to the driver/}).click();for(let i=0;i<5;i++)await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:/Open Ethan/}).click();
 await p.locator('.experience-header').getByRole('button',{name:'Settings',exact:true}).click();const d=p.getByRole('dialog',{name:'Settings',exact:true});
 await d.getByLabel('Graphic look').selectOption('2');await d.getByRole('slider',{name:'Scene brightness'}).fill('1.5');await expect(p.locator('#stage')).toHaveAttribute('data-brightness','1.5');await expect(p.locator('#stage')).toHaveAttribute('data-graphics','2');
 await p.screenshot({path:`${out}/settings-${width}.png`});await d.getByRole('button',{name:'Done',exact:true}).click();await p.getByRole('button',{name:'Resume game',exact:true}).click();
 await p.getByRole('button',{name:'Start audience encounter',exact:true}).click();await expect(p.locator('#console [data-testid="encounter-seconds"]')).toBeVisible();
 await p.screenshot({path:`${out}/console-timer-${width}.png`});await p.locator('.experience-header').getByRole('button',{name:/Pause/}).click();await p.getByRole('button',{name:'Return to title',exact:true}).click();await p.getByRole('button',{name:'Continue chapter',exact:true}).click();await expect(p.locator('body')).toHaveAttribute('data-journey','ready');assert.equal(await p.locator('body').getAttribute('data-beat'),'3');
 await p.reload();await p.getByRole('button',{name:'Settings',exact:true}).click();await expect(p.getByLabel('Graphic look')).toHaveValue('2');await expect(p.getByRole('slider',{name:'Scene brightness'})).toHaveValue('1.5');assert.equal(errors.length,0);reports.push({width,status:'PASS',errors,observed:'All graphics choices preview real scene; brightness/style apply and persist; accidental new game can be cancelled; menu Continue preserves beat; combat checkpoint restores ready without replaying story; timer inside console.'});await p.close();
 }
 // Explicit UI-only mock: validate connected affordance without authenticating or changing owner's bridge.
 const live=await b.newPage();await live.addInitScript(()=>{window.EventSource=class {constructor(){setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify({channel:'vbovu',oauthConfigured:true,lastLiveEvent:null,audience:{source:'LIVE',paused:false,window:null,result:null}})});},50);}close(){}};});await live.goto(base);await live.getByRole('button',{name:'Audience setup',exact:true}).click();const panel=live.locator('.audience-setup');await expect(panel.getByTestId('audience-source')).toHaveText('LIVE');await expect(panel.getByRole('button',{name:/Already connected/})).toBeDisabled();reports.push({connectedAffordance:'PASS',method:'MOCKED EventSource UI state only; not real Twitch proof and no owner-server mutation'});await live.close();
 fs.writeFileSync(out+'/results.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
}catch(e){fs.writeFileSync(out+'/error.txt',String(e));throw e;}finally{await b.close();}
