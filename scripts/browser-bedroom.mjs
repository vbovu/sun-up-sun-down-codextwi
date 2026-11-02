import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs';
const out=process.env.EVIDENCE_DIR??`EVIDENCE/playability-${Date.now()}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:768}}),errors=[],pages=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL??'http://localhost:3000');await page.getByRole('button',{name:'Story archive',exact:true}).click();
 await page.getByRole('button',{name:/Scene IV/}).click();
 await expect(page.locator('body')).toHaveAttribute('data-scene','4');
 await page.getByRole('button',{name:'Close dialogue',exact:true}).click();
 await expect(page.locator('#dialogue')).toBeHidden();const before=JSON.parse(await page.locator('body').getAttribute('data-walker'));
 await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');const after=JSON.parse(await page.locator('body').getAttribute('data-walker'));assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.15);
 await page.screenshot({path:out+'/bedroom-explore.png'});await expect(page.locator('#capture')).toBeHidden();
 await page.getByRole('button',{name:'Continue story',exact:true}).click();
 for(let i=0;i<35;i++){
  await page.waitForTimeout(100);
  if(await page.getByRole('region',{name:'Story complete'}).count())break;
  if(await page.getByRole('button',{name:'Continue story',exact:true}).count())await page.getByRole('button',{name:'Continue story',exact:true}).click();
  const state={beat:await page.locator('body').getAttribute('data-beat'),line:await page.locator('body').getAttribute('data-line')};
  await expect(page.locator('#dialogue')).toBeVisible();
  // Read and dispatch in one browser task: a real interval cannot finish between the check and click.
  const typing=await page.locator('#line').evaluate(e=>{const typing=Boolean(e.style.clipPath);if(typing)document.querySelector('#btn-next').click();return typing;});
  if(typing)await expect(page.locator('body')).toHaveAttribute('data-line',state.line);
  await page.waitForFunction(()=>!document.querySelector('#line').style.clipPath);
  pages.push(state);await page.locator('#btn-next').press('Enter');
 }
 await expect(page.getByRole('region',{name:'Story complete'})).toBeVisible();
 assert.equal(pages.length,11);assert.equal(new Set(pages.map(p=>p.beat+':'+p.line)).size,11);
 await expect(page.locator('body')).toHaveAttribute('data-beat','4');await page.screenshot({path:out+'/bedroom-complete.png'});
 await page.getByRole('button',{name:'Return to title',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-state','title');assert.equal(errors.length,0);
 const result={status:'PASS',pages,movement:{before,after},errors,observed:'All11 bedroom pages exactly once; typing click does not skip; Enter advances once; free walking/tutorial dismissal; final chapter completion does not wrap; return to title.'};fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
