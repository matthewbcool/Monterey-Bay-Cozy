import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase=process.env.PHASE??'after',out=process.env.ARTIFACT_DIR??'artifacts/gym-shadow-coverage';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const records=[],errors=[];
try{for(const [backend,tier] of [['webgpu','standard'],['webgl','standard'],['webgl','base']]){
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5191/?tab=gym&whales=hide&quality='+tier+(backend==='webgl'?'&webgl':''));
 await page.waitForSelector('#gym-viewport canvas');
 await page.evaluate(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;window.shadowViewer=v;});
 await page.waitForFunction(()=>shadowViewer.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:90000});
 await page.evaluate(()=>{window.shadowWorkbench=shadowViewer.avatarWorkbench;});
 await page.evaluate(()=>{for(const[id,value]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-10-26T13:00']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}});
 // Exercise real keyboard movement and takeoff before fixed-camera visual inspections.
 if(backend==='webgpu'){
  await page.locator('#gym-viewport canvas').focus();await page.keyboard.press('e');
  const start=await page.evaluate(()=>shadowWorkbench.getSnapshot().position);
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');
  const walked=await page.evaluate(()=>shadowWorkbench.getSnapshot().position);assert(Math.hypot(walked[0]-start[0],walked[2]-start[2])>.3,'Keyboard walking');
  await page.keyboard.down('Space');await page.waitForTimeout(3200);await page.keyboard.up('Space');await page.waitForTimeout(500);
  const flying=await page.evaluate(()=>({position:shadowWorkbench.getSnapshot().position,flight:shadowWorkbench.getSnapshot().flight,shadows:shadowWorkbench.weather.shadows.getSnapshot()}));
  assert(flying.flight.flying&&flying.position[1]>walked[1]+5,'Keyboard flight');
  await page.locator('#gym-viewport canvas').screenshot({path:`${out}/keyboard-flight.png`});records.push({view:'keyboard-input',backend,tier,start,walked,...flying});
 }
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 for(const[view,position,target,focus,wide]of [
  ['walk',[64,12,-10],[-25,9,-50],[25,7,-35],false],
  ['flight',[100,90,100],[0,5,-40],[25,7,-35],true],
  ['high-flight',[180,180,180],[0,5,-40],[25,7,-35],true],
  ['shifted-focus',[180,180,180],[0,5,-40],[200,7,80],true]
 ]){
  const m=await page.evaluate(async({position,target,focus,wide})=>{const w=window.shadowWorkbench;if(!w.gym)throw Error('Gym unavailable: '+JSON.stringify(w.getSnapshot()));w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateMatrixWorld(true);w.weather.update({time:12,dt:60,underwater:false,overview:wide,reducedMotion:true,shadowFocus:w.avatar.root.position.clone().fromArray(focus),water:w.gym.water});w.lod.setMode('near');w.lod.update(w.camera,900,0,true);await w.renderer.compileAsync(w.scene,w.camera);for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);w.renderer.render(w.scene,w.camera);}await new Promise(requestAnimationFrame);w.renderer.info.autoReset=false;w.renderer.info.reset();w.renderer.render(w.scene,w.camera);return{backend:w.getSnapshot().backend,shadow:w.weather.shadows?.getSnapshot?.(),draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles,passes:w.renderer.info.render.frameCalls};},{position,target,focus,wide});
  await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${tier}-${view}.png`});assert.equal(m.backend,backend==='webgl'?'WebGL 2':'WebGPU');assert.equal(m.shadow.maps.filter(s=>s.allocated).length,3);assert(m.passes>=4);records.push({view,tier,...m});
 }
 assert.deepEqual(await fs.readFile(`${out}/${phase}-${backend}-${tier}-high-flight.png`),await fs.readFile(`${out}/${phase}-${backend}-${tier}-shifted-focus.png`),'Player focus cannot move the shadow coverage');
 await page.close();
}if(errors.length)throw Error(errors.join('\n'));}finally{await fs.writeFile(`${out}/${phase}-browser.json`,JSON.stringify({phase,records,errors},null,2)+'\n');await browser.close();}
