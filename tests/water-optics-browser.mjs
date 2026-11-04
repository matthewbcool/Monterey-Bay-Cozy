/** Water-only changes on the real gym, frozen weather, both rendering backends and quality tiers. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='artifacts/water-optics',phase=process.env.PHASE??'after';await fs.mkdir(out,{recursive:true});
const paths=['src/viewer/water.ts','src/viewer/waterDepth.ts','src/viewer/oceanOptics.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,await fs.readFile(p).then(b=>createHash('sha256').update(b).digest('hex'),()=>null)])));
const sourceHashes=await hashes(),records=[],errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});let failure;
try{for(const backend of (process.env.BACKENDS??'webgpu,webgl').split(','))for(const quality of (process.env.QUALITIES??'standard,base').split(',')){
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|validation|wgsl|glsl/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide&quality=${quality}${backend==='webgl'?'&webgl':''}`);
 await page.waitForSelector('#gym-viewport canvas');await page.evaluate(async()=>{window.waterViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await waterViewer.started;});
 await page.waitForFunction(()=>waterViewer.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:90000});
 await page.evaluate(()=>{for(const[id,v]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-10-26T13:00']]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 async function render(position,target,time=4,speed=0,weather='clear',date='2026-10-26T13:00'){
  return page.evaluate(async({position,target,time,speed,weather,date})=>{
   const w=waterViewer.avatarWorkbench,r=w.renderer,water=w.gym.water;
   for(const[id,v]of [['gym-weather-mode',weather],['gym-weather-date',date]]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}
   w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
   w.weather.update({time:0,dt:60,underwater:position[1]<1,overview:position[1]>100,reducedMotion:true,water});water.update(time);water.setWake(120-water.root.position.x,-25-water.root.position.z,Math.PI/2,speed);
   await w.lod.ready();w.lod.setMode('auto');w.lod.update(w.camera,r.domElement.clientHeight,0,true);await r.compileAsync(w.scene,w.camera);
   let draws=0;const old=water.root.onBeforeRender;water.root.onBeforeRender=()=>draws++;
   for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);draws=0;r.info.autoReset=false;r.info.reset();r.render(w.scene,w.camera);}water.root.onBeforeRender=old;
   if(r.backend.device)await r.backend.device.queue.onSubmittedWorkDone();
   return{backend:w.getSnapshot().backend,waterDraws:draws,triangles:(water.root.geometry.index?.count??water.root.geometry.attributes.position.count)/3,refraction:water.refraction,transparent:water.material.transparent,positionVersion:water.root.geometry.attributes.position.version,render:{...r.info.render},memory:{...r.info.memory}};
  },{position,target,time,speed,weather,date});
 }
 for(const[name,position,target,weather,date]of [
  ['coast',[86,7,-60],[130,1,-96],'clear','2026-10-26T13:00'],
  ['near',[110,5,-13],[124,1,-27],'clear','2026-10-26T13:00'],
  ['sun',[110,4,-13],[-110,0,160],'clear','2026-10-26T16:30'],
  ['aerial',[250,240,300],[35,0,-25],'clear','2026-10-26T13:00'],
  ['underside',[98,-2,35],[102,3,37],'clear','2026-10-26T13:00'],
  ['rain',[110,5,-13],[124,1,-27],'rain','2026-10-26T13:00'],
  ['night',[110,5,-13],[124,1,-27],'clear','2026-10-26T22:00']]){
  if(quality==='base'&&!['coast','near'].includes(name))continue;
  const record=await render(position,target,4,0,weather,date);assert.equal(record.backend,backend==='webgpu'?'WebGPU':'WebGL 2');assert.equal(record.waterDraws,1);assert(record.triangles<=800);assert.equal(record.refraction,false);assert.equal(record.transparent,false);
  records.push({name,quality,...record});await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${quality}-${name}.png`});console.log(JSON.stringify({backend,quality,name,waterDraws:record.waterDraws,triangles:record.triangles,sceneDraws:record.render.drawCalls}));
 }
 const position=[110,5,-13],target=[124,1,-27];const fixed=await render(position,target);const still=await page.locator('#gym-viewport canvas').screenshot();await render(position,target);assert(still.equals(await page.locator('#gym-viewport canvas').screenshot()),'Paused water must be deterministic');
 const moving=await render(position,target,6);const animated=await page.locator('#gym-viewport canvas').screenshot();assert(!still.equals(animated),'Water must animate');assert.equal(moving.positionVersion,fixed.positionVersion);
 await render(position,target,6,3);assert(!animated.equals(await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${quality}-wake.png`})),'Wake visible');await render(position,target,6);assert(animated.equals(await page.locator('#gym-viewport canvas').screenshot()),'Wake must clear');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const w=waterViewer.avatarWorkbench,m=document.getElementById('gym-viewport');w.renderer.setSize(m.clientWidth,m.clientHeight);w.camera.aspect=m.clientWidth/m.clientHeight;});await render(position,target,6,3);await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${quality}-phone.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.close();
}assert.deepEqual(errors,[]);assert.deepEqual(await hashes(),sourceHashes,'Water changed during browser verification');}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(`${out}/${phase}.json`,JSON.stringify({phase,passed:!failure,failure,records,errors,sourceHashes},null,2)+'\n');await browser.close();}
