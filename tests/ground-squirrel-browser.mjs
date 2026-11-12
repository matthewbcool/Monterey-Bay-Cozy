import{chromium}from'playwright';import fs from'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/',out=process.env.ARTIFACT_DIR??'artifacts/ground-squirrel';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??'chrome',headless:true}),reports=[],errors=[];
function check(ok,label){if(!ok)throw Error(label);console.log('PASS',label);}
try{for(const backend of ['webgpu','webgl']){
 const page=await browser.newPage({viewport:{width:1400,height:900}});page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_|weather/i.test(m.text())){errors.push(m.text());console.log('ERROR',m.text().slice(0,1000));}});
 await page.goto(url+'?tab=objects'+(backend==='webgl'?'&webgl':''));await page.evaluate(async()=>{window.v=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await v.started;});
 await page.selectOption('#object-select','california-ground-squirrel');
 for(const count of [1,8,32]){
  await page.selectOption('#object-group',String(count));await page.evaluate(async()=>await v.lod.ready());
  const costs=await page.evaluate(()=>({grounding:v.objects.selected.position.y,backend:v.state.backend,...v.lod.stats(v.objects.selected)}));check(Math.abs(costs.grounding)<.02,`${backend} library feet remain grounded`);check(costs.near.draws===1,`${backend} ${count} squirrels in one draw`);check(costs.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),`${backend} backend confirmed`);
  for(const pose of ['alert','forage','scurry']){await page.selectOption('#object-pose',pose);await page.waitForTimeout(160);
   for(const level of ['near','mid','far']){await page.evaluate(level=>{v.setLodMode(level);v.lod.update(v.camera,900,0,true);},level);await page.waitForTimeout(80);if(count===1&&pose==='alert')await page.screenshot({path:`${out}/${backend}-library-${level}.png`});}
  }
  reports.push({backend,count,costs});
 }
 await page.locator('#tab-gym').click();await page.waitForFunction(()=>v.avatarWorkbench?.getSnapshot().gymReady,{},{timeout:120000});
 await page.evaluate(()=>{for(const[id,value]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-11-11T13:00']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.getElementById('gym-squirrels-visit').click();});await page.waitForTimeout(600);
 const state=await page.evaluate(()=>v.avatarWorkbench.getSnapshot());check(state.squirrels.count===8&&state.squirrels.active,`${backend} visit shortcut reaches eight active squirrels`);check(state.position[0]>75&&state.position[2]<-75,`${backend} player arrives beside the granite`);
 await page.evaluate(async()=>{const w=v.avatarWorkbench;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));await w.lod.ready();});
 await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}.gym-prompt-area,.gym-controls,.gym-loading{opacity:0!important}.gym-layout *:not(canvas){background:transparent!important;box-shadow:none!important;border-color:transparent!important}'});
 for(const level of ['near','mid','far']){
  const result=await page.evaluate(async level=>{const w=v.avatarWorkbench,s=w.gym.squirrels,h=s.animals[0].home;w.avatar.root.visible=false;s.setViewer(h.x,h.z);s.setPlayer(0,0,0,false);s.batch.setPose('alert');s.batch.update(0);w.camera.position.set(h.x-1.2,h.y+.65,h.z+1.4);w.camera.lookAt(h.x,h.y+.13,h.z);w.camera.updateMatrixWorld(true);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});w.lod.setMode(level);w.lod.update(w.camera,900,0,true);await w.renderer.compileAsync(w.scene,w.camera);for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);w.renderer.info.reset();w.renderer.render(w.scene,w.camera);}if(w.renderer.backend.device)await w.renderer.backend.device.queue.onSubmittedWorkDone();return{level,costs:w.lod.stats(s.root),state:s.stats(),renderer:{...w.renderer.info.render}};},level);
  await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-gym-${level}.png`});reports.push({backend,gym:result});
 }
 await page.close();
}check(errors.length===0,'No page or shader exceptions');}finally{await browser.close();await fs.writeFile(`${out}/browser-results.json`,JSON.stringify({reports,errors},null,2));}
