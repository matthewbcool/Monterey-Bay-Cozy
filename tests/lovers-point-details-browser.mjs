// Fixed daytime inspection cameras; this checks rendering, not gameplay routes or live weather.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out=process.env.ARTIFACT_DIR??'artifacts/lovers-point-details';await fs.mkdir(out,{recursive:true});
const paths=['src/viewer/testingGym/buildings.ts','src/viewer/testingGym/shore.ts','src/viewer/testingGym/landmarks.ts','tests/lovers-point-details-browser.mjs'];
const digest=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await digest(),checks=[],errors=[],measurements=[];let failure;
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=v.avatarWorkbench;await w.ready;return new Function('w','arg',`return (${fn})(w,arg)`)(w,arg);},{fn:fn.toString(),arg});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),preview=new URL(url);
  await context.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT'))errors.push(m.text());});
  await p.goto(`${url}?tab=gym${backend==='webgl'?'&webgl':''}`);
  await p.waitForFunction(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:45000});
  await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').click();
  await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.locator('#gym-weather-date').fill('2026-10-23T13:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();
  const setup=await read(p,async w=>{await w.lod.ready();const scene=w.gym.root.parent;w.setActive(null);window.__detailScene=scene;return {backend:w.getSnapshot().backend,world:w.lod.stats(w.gym.root)};});
  check(setup.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' actual renderer');check(setup.world.near.draws<=38&&setup.world.near.triangles<=69472,backend+' current park ceiling');
  for(const [view,position,target,relative] of [
   ['beach-house',[28,13,45],[-9,3.7,14],true],
   ['pool',[18,9,70],[-12,1.2,49],true],
   ['seawall',[99,7,25],[49,7,-24],false],
  ]){
   const result=await read(p,async(w,{position,target,relative})=>{
    const scene=window.__detailScene,height=relative?w.gym.terrainHeight(target[0],target[2]):0;
    w.camera.position.set(position[0],position[1]+height,position[2]);w.camera.lookAt(target[0],target[1]+height,target[2]);w.camera.near=.25;w.camera.far=1500;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
    w.gym.update(0);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});scene.updateMatrixWorld(true);w.lod.setMode('auto');w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);await w.renderer.compileAsync(scene,w.camera);
    const reset=w.renderer.info.autoReset;w.renderer.info.autoReset=false;w.renderer.info.reset();w.renderer.render(scene,w.camera);const render={draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles};w.renderer.info.autoReset=reset;
    return {render,world:w.lod.stats(w.gym.root),astronomy:w.weather.getSnapshot().astronomy};
   },{position,target,relative});measurements.push({backend,view,...result});check(result.astronomy.sun.altitude>.4,backend+' '+view+' fixed daytime');await p.screenshot({path:`${out}/${backend}-${view}.png`});
  }
  await p.setViewportSize({width:390,height:844});await read(p,w=>{const mount=document.getElementById('gym-viewport');w.renderer.setSize(mount.clientWidth,mount.clientHeight);w.camera.aspect=mount.clientWidth/mount.clientHeight;w.camera.updateProjectionMatrix();w.lod.update(w.camera,mount.clientHeight,0,true);w.renderer.render(window.__detailScene,w.camera);});await p.screenshot({path:`${out}/${backend}-phone.png`});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),backend+' phone layout fits');await context.close();
 }
 check(errors.length===0,'No browser or shader errors');check(JSON.stringify(before)===JSON.stringify(await digest()),'Detail source stayed stable');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({date:new Date().toISOString(),passed:!failure,failure,checks,errors,measurements,sources:before,note:'Fixed clear/daytime previews, Chrome on this Mac, WebGPU and forced WebGL 2. Phone viewport is emulation; cameras are independent of movement tests.'},null,2)+'\n');await browser.close();}
