import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/gym-arrival';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const results=[],errors=[];
try{for(const webgl of [false,true]){
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await p.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5191/?quality=standard'+(webgl?'&webgl':''));await p.getByRole('tab',{name:'Testing Gym',exact:true}).click();
 await p.waitForFunction(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);window.qaViewer=v;return v.avatarWorkbench?.getSnapshot().gymReady},null,{timeout:60000});
 await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').click();await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.fill('#gym-weather-date','2026-10-24T14:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();await p.waitForTimeout(500);
 const backend=webgl?'webgl2':'webgpu';await p.screenshot({path:`${out}/${backend}-arrival.png`});
 const position=async(id)=>p.evaluate(id=>{const w=qaViewer.avatarWorkbench,i=w.gym.interactions.find(i=>i.id===id);w.controller.position.copy(i.position);w.controller.position.y=w.gym.groundHeight(i.position.x,i.position.z)+.035;return {object:i.object.position.toArray(),prompt:i.position.toArray()};},id);
 const gear=await position('spinning-rod');await p.waitForTimeout(800);await p.screenshot({path:`${out}/${backend}-boat-gear.png`});await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>qaViewer.avatarWorkbench.getSnapshot().carrying),'Rod pickup at new position');
 await p.locator('#gym-return-rod').click();assert.deepEqual(await p.evaluate(()=>qaViewer.avatarWorkbench.gym.targets.rod.position.toArray()),gear.object);
 await position('tackle-box');await p.waitForTimeout(300);await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await p.waitForTimeout(200);
 assert(await p.evaluate(()=>qaViewer.avatarWorkbench.getSnapshot().interacted.includes('tackle-box')),'Tackle interaction at new position');
 assert(await p.evaluate(()=>!qaViewer.avatarWorkbench.gym.interactions.some(i=>i.id==='bench')));
 results.push({backend,gear,pickupAndReturn:true,tackleInteraction:true,benchRemoved:true});await p.close();
}assert.deepEqual(errors,[]);}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({results,errors},null,2));await browser.close();}
