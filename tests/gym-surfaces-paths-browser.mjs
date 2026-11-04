// Fixed weather/cameras isolate the scoped material layer from live weather variability.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out=process.env.ARTIFACT_DIR??'artifacts/gym-surfaces-paths';await fs.mkdir(out,{recursive:true});
const sources=['src/viewer/gymSurfaceStyle.ts','src/viewer/testingGym.ts','src/viewer/testingGym/access.ts','src/viewer/testingGym/pathStyle.ts','src/viewer/testingGym/groundSurface.ts','src/viewer/avatarWorkbench.ts','src/viewer/mapStudy/loversPoint.ts','tests/gym-surfaces-paths-browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await hashes(),checks=[],errors=[],results=[];let failure;
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('w','arg',`return (${fn})(w,arg)`)(v.avatarWorkbench,arg);},{fn:fn.toString(),arg});
async function weather(p,date){
 await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').evaluate(e=>e.parentElement.open=true);
 await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.locator('#gym-weather-date').fill(date);await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();
}
const frame=async(w,{position,target,mode='near'})=>{
 const scene=window.__surfaceScene;
 w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.near=.25;w.camera.far=1500;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
 w.gym.update(0);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});scene.updateMatrixWorld(true);
 w.lod.setMode(mode);w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);await w.renderer.compileAsync(scene,w.camera);
 w.renderer.render(scene,w.camera);w.renderer.info.reset();w.renderer.render(scene,w.camera);
 const ground=w.gym.root.getObjectByName('gym-ground-surface'),map=ground.material.userData.gymContactTexture;
 return {world:w.lod.stats(w.gym.root),submitted:{draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles},astronomy:w.weather.getSnapshot().astronomy,paintExposure:w.weather.environment.paintExposure.value,contact:{version:map.version,bytes:map.image.data.byteLength},camera:{position,target},mode};
};
const views=[['lawn',[40,13,-16],[23,8.5,-38]],['east-stairs',[83,10,-44],[63,6,-57]],['south-stairs',[27,7,68],[8,4,54]]];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try{
 for(const backend of ['webgpu','webgl'])for(const tier of ['standard','base']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),preview=new URL(url);
  // No external requests or Vite hot replacement during this reproducible preview.
  await context.route('https://api.weather.gov/**',r=>r.abort());
  await context.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::ERR_/.test(m.text()))errors.push(m.text());});
  await p.goto(`${url}?tab=gym&quality=${tier}${backend==='webgl'?'&webgl':''}`);
  await p.waitForFunction(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:45000});
  await weather(p,'2026-10-24T13:00');
  const setup=await read(p,async w=>{await w.lod.ready();window.__surfaceScene=w.gym.root.parent;w.setActive(null);return {backend:w.getSnapshot().backend,pixelRatio:w.renderer.getPixelRatio()};});
  check(setup.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),`${backend}/${tier} actual renderer`);
  for(const [view,position,target] of tier==='standard'?views:views.slice(0,1)){
   const metric=await read(p,frame,{position,target});results.push({backend,tier,view,...setup,...metric});
   check(metric.world.near.draws<=38&&metric.world.near.triangles<=69472,`${backend}/${tier}/${view} current park ceiling`);
   check(metric.astronomy.sun.altitude>.4,`${backend}/${tier}/${view} fixed daylight`);
   check(metric.contact.bytes===262144,`${backend}/${tier}/${view} single small generated contact field`);
   await p.screenshot({path:`${out}/${backend}-${tier}-${view}.png`});
  }
  // Force every LOD and prove the static field never uploads again across held frames.
  const position=views[0][1],target=views[0][2];let version;
  for(const mode of ['near','mid','far','auto']){
   const metric=await read(p,frame,{position,target,mode});results.push({backend,tier,view:'lawn-lod',...metric});
   version??=metric.contact.version;check(metric.contact.version===version,`${backend}/${tier}/${mode} static contact field`);
   if(mode==='far'&&tier==='standard')await p.screenshot({path:`${out}/${backend}-${tier}-far.png`});
  }
  await weather(p,'2026-10-24T01:00');const night=await read(p,frame,{position,target});results.push({backend,tier,view:'night',...night});
  check(night.astronomy.sun.altitude<0&&night.paintExposure<.2,`${backend}/${tier} ground fill follows nighttime exposure`);
  if(tier==='standard')await p.screenshot({path:`${out}/${backend}-${tier}-night.png`});
  await weather(p,'2026-10-24T13:00');await p.setViewportSize({width:390,height:844});
  await read(p,w=>{const mount=document.getElementById('gym-viewport');w.renderer.setSize(mount.clientWidth,mount.clientHeight);w.camera.aspect=mount.clientWidth/mount.clientHeight;w.camera.updateProjectionMatrix();});
  await read(p,frame,{position:views[1][1],target:views[1][2],mode:'auto'});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${backend}/${tier} phone viewport fits`);
  if(tier==='standard')await p.screenshot({path:`${out}/${backend}-${tier}-phone.png`});
  await context.close();
 }
 check(errors.length===0,'No browser or shader errors');check(JSON.stringify(before)===JSON.stringify(await hashes()),'Sources stayed stable during verification');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({date:new Date().toISOString(),passed:!failure,failure,checks,errors,results,sources:before,note:'Chrome on this Mac; native WebGPU and forced WebGL 2; DPR 1, Base/Standard, reduced motion and phone viewport emulation. Fixed clear previews with NWS requests deliberately blocked. Counts distinguish park assets from actual submitted scene/output work. Typed-array bytes are not GPU memory.'},null,2)+'\n');await browser.close();}
