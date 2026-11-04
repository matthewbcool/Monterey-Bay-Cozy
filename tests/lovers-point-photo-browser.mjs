/** Repeatable reference-photo angles; scene costs include shadows and output. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sources=['buildings','shore','access','landmarks','cafeTerrace','recreationGrade'].map(n=>`src/viewer/testingGym/${n}.ts`);
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));const sourceHashes=await hashes();
const out='artifacts/lovers-point-photo-detail',phase=process.env.PHASE??'after';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const records=[],errors=[];
try{for(const backend of (process.env.BACKENDS??'webgpu,webgl').split(',')){
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|validation|wgsl|glsl/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide${backend==='webgl'?'&webgl':''}`);
 await page.waitForSelector('#gym-viewport canvas');await page.evaluate(async()=>{window.photoViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await photoViewer.started;});
 await page.waitForFunction(()=>photoViewer.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:90000});
 await page.evaluate(()=>{for(const[id,v]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-10-26T13:00']]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 for(const[name,position,target]of [['cafe',[-21,20,72],[14,10,78]],['beach',[39,15,69],[6,8,13]],['pier',[91,14,48],[53,5,9]],['grill-front',[20,12,65],[8,10,79]]]){
  for(const mode of (phase==='after'&&name==='cafe'?['near','mid','far']:['near'])){
   const record=await page.evaluate(async({position,target,mode})=>{const w=photoViewer.avatarWorkbench,r=w.renderer;w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateMatrixWorld(true);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});await w.lod.ready();w.lod.setMode(mode);w.lod.update(w.camera,r.domElement.clientHeight,0,true);await r.compileAsync(w.scene,w.camera);for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);r.info.autoReset=false;r.info.reset();r.render(w.scene,w.camera);}return{backend:w.getSnapshot().backend,park:w.lod.stats(w.gym.root),render:{...r.info.render}};},{position,target,mode});
   assert.equal(record.backend,backend==='webgpu'?'WebGPU':'WebGL 2');assert(record.park.near.triangles<=69472);assert(record.park.near.draws<=38);records.push({name,mode,...record});
   await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${name}-${mode}.png`});console.log(JSON.stringify({backend,name,mode,triangles:record.park.near.triangles,draws:record.park.near.draws,scene:record.render.drawCalls}));
  }
 }
 await page.close();
}assert.deepEqual(errors,[]);assert.deepEqual(await hashes(),sourceHashes,'Photo component sources changed during verification');}finally{await fs.writeFile(`${out}/${phase}.json`,JSON.stringify({phase,records,errors,sourceHashes},null,2)+'\n');await browser.close();}
