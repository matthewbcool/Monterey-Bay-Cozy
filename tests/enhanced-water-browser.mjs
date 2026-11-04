/** Real WebGPU opt-in, fallback isolation, per-pixel waterline and bounded render-cost audit. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const paths=['src/viewer/water.ts','src/viewer/nodeStyle.ts','src/viewer/gymWeatherSky.ts','src/viewer/enhancedWater/index.ts','src/viewer/enhancedWater/medium.ts','src/viewer/enhancedWater/caustics.ts','src/viewer/enhancedWater/surfaceGeometry.ts','src/viewer/waterEffectsSettings.ts','src/viewer/waterEffectsPanel.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));const sourceHashes=await hashes();
const out='artifacts/enhanced-water';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const errors=[],records=[];let failure;
try{
 for(const mode of ['enhanced','balanced','fallback']){
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),imports=[];
 if(mode==='enhanced')await page.clock.setFixedTime(new Date('2026-10-27T05:00:00Z')); // Cold start after sunset, before optional targets have rendered.
 page.on('request',r=>{if(r.url().includes('/enhancedWater/'))imports.push(r.url());});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message.slice(0,800));});page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_FAILED')||m.type()==='warning'&&/shader|wgsl|error|invalid/i.test(m.text())){errors.push(m.text());console.log('BROWSER',m.text().slice(0,1500));}});
 await page.goto(`http://127.0.0.1:5191/?tab=gym&quality=standard&water=${mode==='balanced'?'balanced':'enhanced'}&whales=hide&profileGPU${mode==='fallback'?'&webgl':''}`);
 await page.evaluate(async()=>{window.v=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await v.started;});
 await page.waitForFunction(()=>v.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:120000});console.log('Gym ready',mode);
 await page.evaluate(()=>{for(const[id,value]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-10-26T13:00']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const capability=await page.evaluate(()=>({backend:v.avatarWorkbench.getSnapshot().backend,owner:!!v.avatarWorkbench.enhancedWater,choice:document.querySelector('#gym-water-quality').value,disabled:document.querySelector('#gym-water-quality').options[1].disabled}));
 assert.equal(capability.owner,mode==='enhanced');assert.equal(capability.choice,mode==='enhanced'?'enhanced':'balanced');assert.equal(capability.disabled,mode==='fallback');if(mode!=='enhanced')assert.equal(imports.length,0,'Balanced must not load optional shader modules');
 records.push({mode,capability,optionalImports:imports.length});
 async function render(position,target,time=4){return page.evaluate(async({position,target,time})=>{
  const w=v.avatarWorkbench,r=w.renderer;w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.near=.05;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);w.gym.reef.setViewer(99,42);w.weather.update({time:0,dt:60,underwater:!w.enhancedWater&&position[1]<1,overview:false,reducedMotion:true,water:w.gym.water});w.gym.water.update(time);w.lod.setMode('near');w.lod.update(w.camera,800,0,true);
  for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);r.info.autoReset=false;r.info.reset();if(w.enhancedWater)w.enhancedWater.render(w.scene,w.camera);else r.render(w.scene,w.camera);}
  if(r.backend.device)await r.backend.device.queue.onSubmittedWorkDone();return {backend:w.getSnapshot().backend,effects:w.enhancedWater?.getSnapshot()??{mode:'balanced'},render:{...r.info.render},memory:{...r.info.memory}};
 },{position,target,time});}
 const fixtures=[['surface',[110,5,-13],[124,1,-27]],['reef',[99,-2,42],[91,-3,45]],['snell',[99,-2,42],[100,3,44]],['waterline',[110,1,-13],[124,1,-27]]];
 for(const[name,position,target]of fixtures){
  const r=await render(position,target);records.push({mode,name,...r});console.log(JSON.stringify({mode,name,...r}));await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${mode}-${name}.png`});
 }
 if(mode==='enhanced'){
  await render([99,-2,42],[91,-3,45]);const on=await page.locator('#gym-viewport canvas').screenshot();
  await page.evaluate(()=>{const e=document.querySelector('#gym-water-shafts');e.value='0';e.dispatchEvent(new Event('change',{bubbles:true}));});await render([99,-2,42],[91,-3,45]);const noShaft=await page.locator('#gym-viewport canvas').screenshot({path:`${out}/shafts-off.png`});assert(!on.equals(noShaft),'Ray-marched shafts must affect pixels');
  await page.evaluate(()=>{const e=document.querySelector('#gym-water-caustics');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});await render([99,-2,42],[91,-3,45]);const off=await page.locator('#gym-viewport canvas').screenshot({path:`${out}/caustics-off.png`});assert(!noShaft.equals(off),'Caustics must affect pixels');
  await page.evaluate(()=>{for(const[id,value]of [['gym-water-caustics',true],['gym-water-shafts','24']]){const e=document.getElementById(id);if(typeof value==='boolean')e.checked=value;else e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}});await render([99,-2,42],[91,-3,45]);assert.equal(await page.evaluate(()=>v.avatarWorkbench.enhancedWater.getSnapshot().settings.shafts),24);
  await page.evaluate(()=>{const e=document.querySelector('#gym-water-shafts');e.value='12';e.dispatchEvent(new Event('change',{bubbles:true}));});
  const mask=await page.evaluate(async()=>{
   const {Vector3,RenderTarget}=await import('/node_modules/.vite/deps/three.js'),{vec4}=await import('/node_modules/.vite/deps/three_tsl.js'),{sampleWater}=await import('/src/viewer/water.ts'),w=v.avatarWorkbench,e=w.enhancedWater,r=w.renderer;
   w.camera.position.set(110,1,-13);w.camera.position.y=w.gym.water.root.position.y+sampleWater(110-w.gym.water.root.position.x,-13-w.gym.water.root.position.z,4).height;w.camera.lookAt(124,w.camera.position.y,-27);w.camera.updateMatrixWorld(true);w.gym.water.update(4);
   const original=e.debug.post.outputNode;e.debug.post.outputNode=vec4(e.debug.waterline,e.debug.waterline,e.debug.waterline,1);e.debug.post.needsUpdate=true;
   const canvas={width:r.domElement.width,height:r.domElement.height},maskTarget=new RenderTarget(canvas.width,canvas.height,{depthBuffer:false});r.setRenderTarget(maskTarget);await new Promise(requestAnimationFrame);e.render(w.scene,w.camera);const pixels=await r.readRenderTargetPixelsAsync(maskTarget,0,0,canvas.width,canvas.height);r.setRenderTarget(null);maskTarget.dispose();
   let checked=0,mismatch=0,wet=0,dry=0;for(let y=10;y<canvas.height;y+=17)for(let x=10;x<canvas.width;x+=17){const p=new Vector3((x+.5)/canvas.width*2-1,1-(y+.5)/canvas.height*2,0).applyMatrix4(w.camera.projectionMatrixInverse).applyMatrix4(w.camera.matrixWorld);const d=w.gym.water.root.position.y+sampleWater(p.x-w.gym.water.root.position.x,p.z-w.gym.water.root.position.z,4).height-p.y;if(Math.abs(d)<.002)continue;const expected=d>0;if(expected)wet++;else dry++;checked++;if((pixels[y*Math.ceil(canvas.width*4/256)*256+x*4]>127)!==expected)mismatch++;}
   e.debug.post.outputNode=original;e.debug.post.needsUpdate=true;return{checked,mismatch,wet,dry};
  });records.push({waterlineCPUvsGPU:mask});console.log('mask',mask);assert(mask.checked>500&&mask.wet>100&&mask.dry>100);assert(mask.mismatch/mask.checked<.01,'Near-plane GPU mask must match CPU shared waves');
  // Freeze time: repeat pixels, then advance the shared clock and require a visible difference.
  await render([99,-2,42],[100,3,44]);const still=await page.locator('#gym-viewport canvas').screenshot();await render([99,-2,42],[100,3,44]);assert(still.equals(await page.locator('#gym-viewport canvas').screenshot()));await render([99,-2,42],[100,3,44],6);assert(!still.equals(await page.locator('#gym-viewport canvas').screenshot()));
  await page.evaluate(()=>{const e=document.querySelector('#gym-weather-date');e.value='2026-10-26T22:00';e.dispatchEvent(new Event('change',{bubbles:true}));});const night=await render([99,-2,42],[100,3,44]);assert.equal(night.effects.shaftActive,false);await page.locator('#gym-viewport canvas').screenshot({path:`${out}/night-snell.png`});
  await page.evaluate(()=>{const e=document.querySelector('#gym-weather-date');e.value='2026-10-26T13:00';e.dispatchEvent(new Event('change',{bubbles:true}));});
 }
 if(mode!=='fallback'){
  await render([99,-2,42],[91,-3,45]);const profile=await page.evaluate(async()=>{const w=v.avatarWorkbench,r=w.renderer,gpu=[],wall=[],draws=[],triangles=[];await r.resolveTimestampsAsync('render');for(let i=0;i<36;i++){await new Promise(requestAnimationFrame);w.gym.water.update(10+i/30);r.info.reset();const start=performance.now();if(w.enhancedWater)w.enhancedWater.render(w.scene,w.camera);else r.render(w.scene,w.camera);await r.backend.device.queue.onSubmittedWorkDone();const elapsed=performance.now()-start;const ms=await r.resolveTimestampsAsync('render');if(i>=6){wall.push(elapsed);gpu.push(ms);draws.push(r.info.render.drawCalls);triangles.push(r.info.render.triangles);}}const stats=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],min:a[0],max:a.at(-1)}};return{gpuPassMs:stats(gpu),cpuToGPUCompletionMs:stats(wall),draws:stats(draws),triangles:stats(triangles),adapter:r.backend.device.adapterInfo?{vendor:r.backend.device.adapterInfo.vendor,architecture:r.backend.device.adapterInfo.architecture,description:r.backend.device.adapterInfo.description}:null};});records.push({mode,profile});console.log('profile',mode,JSON.stringify(profile));
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const w=v.avatarWorkbench,m=document.getElementById('gym-viewport');w.renderer.setSize(m.clientWidth,m.clientHeight);w.camera.aspect=m.clientWidth/m.clientHeight;document.querySelector('.gym-menu').open=true;document.querySelector('#gym-water-effects').open=true;});await render([110,5,-13],[124,1,-27]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#gym-water-effects').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${mode}-phone.png`});
 if(mode==='enhanced'){
  await page.selectOption('#gym-water-quality','balanced');await page.waitForURL('**water=balanced**');await page.waitForSelector('#gym-water-quality',{state:'attached'});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('monterey-bay-cozy-water-effects-v1')).mode),'balanced');
 }
 await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(await hashes(),sourceHashes,'Rendering sources changed during verification');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(`${out}/browser.json`,JSON.stringify({failure,browser:browser.version(),sourceHashes,records,errors},null,2)+'\n');await browser.close();}
