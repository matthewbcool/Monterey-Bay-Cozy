/** User-input regression for the shared preview. Does not teleport or mutate game state. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.OTTER_ARTIFACT_DIR??'artifacts/otter-man';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],measurements=[];
function check(value,label){if(!value)throw Error(label);checks.push(label);console.log('PASS',label);}
const state=p=>p.evaluate(async()=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return viewer.avatarWorkbench.getSnapshot();});
// Poll resolved snapshots in Node: this installed browser adapter can resolve an
// async waitForFunction before its returned Promise predicate becomes true.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitGym(p){const until=Date.now()+120000;while(Date.now()<until){const s=await state(p);if(s.gymReady&&s.frameCount>3&&s.nearest==='otter-man-suit')return;await pause(200);}throw Error('Gym station did not become ready');}
const observe=(p,label)=>p.on('pageerror',e=>errors.push(label+': '+e.message));
async function hold(p,keys,ms){for(const k of keys)await p.keyboard.down(k);await p.waitForTimeout(ms);for(const k of keys)await p.keyboard.up(k);}
async function flyTo(p,target){let down=[];const begin=Date.now();try{while(Date.now()-begin<30000){
 const data=await p.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src),w=viewer.avatarWorkbench,e=w.camera.matrixWorld.elements;return{p:w.avatar.root.position.toArray(),f:[-e[8],-e[10]]};});
 const dx=target[0]-data.p[0],dz=target[1]-data.p[2];if(Math.hypot(dx,dz)<12)break;
 const [fx,fz]=data.f,n=Math.hypot(fx,fz),h=(-fz*dx+fx*dz)/n,v=(fx*dx+fz*dz)/n,m=Math.max(Math.abs(h),Math.abs(v));
 const wanted=['Shift'];if(Math.abs(h)>m*.35)wanted.push(h>0?'d':'a');if(Math.abs(v)>m*.35)wanted.push(v>0?'w':'s');
 for(const k of down)if(!wanted.includes(k))await p.keyboard.up(k);for(const k of wanted)if(!down.includes(k))await p.keyboard.down(k);down=wanted;await p.waitForTimeout(100);
 }}finally{for(const k of down)await p.keyboard.up(k);}await p.waitForTimeout(500);}
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1440,height:1000}});observe(p,backend);
  await p.goto((process.env.PREVIEW_URL??'http://127.0.0.1:5191/')+'?tab=gym'+(backend==='webgl'?'&webgl':''));await waitGym(p);
  const before=await state(p);check(before.backend===(backend==='webgl'?'WebGL 2':'WebGPU'),backend+' renderer');check(before.nearest==='otter-man-suit',backend+' reachable suit station');
  await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await p.waitForTimeout(500);const worn=await state(p);check(worn.otterSuit&&worn.model.drawCalls===1,backend+' equips one-draw suit');check(JSON.stringify(worn.design)===JSON.stringify(before.design),backend+' outfit retained');
  await p.screenshot({path:out+'/'+backend+'-suit.png'});
  await hold(p,['Space'],1600);await p.waitForTimeout(700);const up=await state(p);check(up.flight.flying&&up.position[1]>before.position[1]+5,backend+' lifts off');
  await p.waitForTimeout(700);check(Math.abs((await state(p)).position[1]-up.position[1])<.2,backend+' hover holds height');
  await hold(p,['c'],2300);await p.waitForTimeout(200);check(!(await state(p)).flight.flying,backend+' lands and returns to walking controller');
  await hold(p,['Space'],6000);await flyTo(p,[400,340]);const travel=await state(p);check(travel.position[2]>130&&travel.position[0]>250,backend+' crosses park seam into new region');
  await p.mouse.move(800,350);await p.mouse.down();await p.mouse.move(800,550,{steps:12});await p.mouse.up();await p.waitForTimeout(400);
  await p.screenshot({path:out+'/'+backend+'-waterfront-flight.png'});
  await p.locator('#gym-suit-return').click();await p.waitForTimeout(400);const returned=await state(p);check(!returned.otterSuit&&Math.hypot(returned.position[0]-25,returned.position[2]+35)<.2,backend+' returns suit and player to station');
  await p.locator('#gym-menu summary').first().click();await p.locator('#gym-waterfront-view').click();await p.waitForTimeout(400);await p.screenshot({path:out+'/'+backend+'-gym-waterfront.png'});
  const counts=await p.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench;return{park:w.lod.stats(w.gym.root),waterfront:w.lod.stats(w.gym.waterfront.root)};});
  await p.locator('#tab-map').click();await p.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!viewer.mapStudy;},null,{timeout:120000});
  await p.locator('[data-view="waterfront"]').click();await p.waitForTimeout(400);await p.screenshot({path:out+'/'+backend+'-map-waterfront.png'});
  await p.locator('#map-park').uncheck();check(await p.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !viewer.mapStudy.waterfront.root.visible;}),backend+' map comparison toggles region');await p.locator('#map-park').check();
  measurements.push({backend,suit:worn.model,suitLod:worn.lod,flight:travel.flight,counts});await p.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});observe(p,'touch');
 await p.goto('http://127.0.0.1:5191/?tab=gym&webgl');await waitGym(p);await p.locator('#gym-interact').tap();await p.waitForTimeout(400);check((await state(p)).otterSuit,'touch equips suit');
 const cdp=await p.context().newCDPSession(p);const box=await p.locator('#gym-jump').boundingBox();check(!!box,'touch ascent control visible');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await p.waitForTimeout(1000);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300);check((await state(p)).flight.flying,'touch hold lifts off');
 check(await p.locator('#gym-dive').isVisible(),'touch descent control visible');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px layout fits');await p.screenshot({path:out+'/touch-flight.png'});
 await p.locator('#gym-suit-return').tap();await p.waitForTimeout(300);check(!(await state(p)).otterSuit,'touch returns suit');await p.close();
 check(errors.length===0,'no browser runtime errors');
}finally{await fs.writeFile(out+'/browser-metrics.json',JSON.stringify({date:new Date().toISOString(),checks,errors,measurements},null,2));await browser.close();}
