import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/lovers-point-surrey';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{for(const backend of ['webgpu','webgl']){
 const errors=[],page=await browser.newPage({viewport:{width:1400,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.PREVIEW_URL??'http://127.0.0.1:5191/')+'?tab=gym&water=balanced&whales=hide'+(backend==='webgl'?'&webgl':''));
 await page.evaluate(async()=>{window.v=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await v.started;});
 await page.waitForFunction(()=>v.avatarWorkbench?.getSnapshot().gymReady,{},{timeout:180000});
 const get=()=>page.evaluate(()=>v.avatarWorkbench.getSnapshot());
 const check=(condition,label)=>{if(!condition)throw new Error(backend+': '+label);console.log('PASS',backend,label);};
 await page.evaluate(()=>{for(const[id,value]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-11-06T13:00']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.getElementById('gym-surrey-visit').click();});
 await page.waitForTimeout(300);await page.locator('#gym-viewport canvas').focus();await page.keyboard.press('e');await page.waitForTimeout(500);
 let s=await get();check(s.surrey.riding,'E boards from the normal visit shortcut');const start=s.surrey.position;
 await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
 s=await get();check(Math.hypot(s.surrey.position[0]-start[0],s.surrey.position[2]-start[2])>1,'keyboard pedals along the coastal trail');check(s.surrey.pedalPhase>0,'crank phase advances');
 await page.waitForTimeout(2000);s=await get();check(Math.abs(s.surrey.speed)<.02,'release brakes');
 const heading=s.surrey.heading;await page.keyboard.down('s');await page.keyboard.down('a');await page.waitForTimeout(700);await page.keyboard.up('s');await page.keyboard.up('a');s=await get();check(s.surrey.heading!==heading,'reverse steering changes heading');
 await page.keyboard.press('e');await page.waitForTimeout(250);s=await get();check(!s.surrey.riding&&!s.swimming,'E safely dismounts on land');check(Math.hypot(s.position[0]-s.surrey.position[0],s.position[2]-s.surrey.position[2])<2,'exit stays beside the vehicle');
 await page.keyboard.press('e');await page.waitForTimeout(200);check((await get()).surrey.riding,'can board again');
 await page.evaluate(()=>document.getElementById('gym-back').click());await page.waitForTimeout(300);check(!(await get()).surrey.riding,'switching to character editing releases the vehicle');
 await page.evaluate(()=>v.avatarWorkbench.setActive('gym'));await page.waitForTimeout(300);
 const metrics=await page.evaluate(async()=>{const w=v.avatarWorkbench;await w.lod.ready();return {backend:w.getSnapshot().backend,lod:w.lod.stats(w.surrey.root),position:w.surrey.root.position.toArray()};});check(errors.length===0,'no page exceptions');
 reports.push({requestedBackend:backend,...metrics,errors});await page.screenshot({path:`${out}/vehicle-${backend}.png`});await page.close();
 }}finally{await browser.close();await fs.writeFile(`${out}/vehicle-results.json`,JSON.stringify(reports,null,2));}
