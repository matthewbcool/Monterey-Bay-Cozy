import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
// The gym keeps its tools in one menu; open it before using a menu control. Touch pages tap.
async function openMenu(page,tap=false){if(!await page.locator('#gym-menu').evaluate(e=>e.open)){const s=page.locator('#gym-menu > summary');await(tap?s.tap():s.click());}}
async function menuClick(page,selector,tap=false){await openMenu(page,tap);const l=page.locator(selector);await(tap?l.tap():l.click());}
const out=process.env.ARTIFACT_DIR??'artifacts/ocean-look',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';await fs.mkdir(out,{recursive:true});
async function sources(){return Object.fromEntries(await Promise.all(['src/viewer/water.ts','src/viewer/testingGym.ts','tests/ocean-look-browser.mjs'].map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));}
const before=await sources(),checks=[],errors=[],measurements=[];
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const read=(page,fn,arg)=>page.evaluate(async({fn,arg})=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench;await w.ready;return new Function('w','arg',`return (${fn})(w,arg)`)(w,arg);},{fn:fn.toString(),arg});
let failure;
try{
for(const backend of ['webgpu','webgl']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),socket=>socket.send(JSON.stringify({type:'connected'})));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT'))errors.push(m.text())});
 await p.goto(`${url}?tab=gym${backend==='webgl'?'&webgl':''}`);await p.locator('#gym-overview').waitFor({ state: 'attached', timeout:45000});
 await read(p,async w=>{await w.ready;});await p.waitForTimeout(300);
 check((await read(p,w=>w.getSnapshot().backend))===(backend==='webgl'?'WebGL 2':'WebGPU'),backend+' actual renderer');
 // Inspection fixture: a camera offshore and a posed boat. The interactive boat
 // suite separately verifies boarding/rowing; no gameplay state is saved here.
 const render=async(time,strength,view='boat')=>{
  const metrics=await read(p,async(w,{time,strength,view})=>{
   const scene=w.gym.root.parent;w.setActive(null);
   w.gym.boat.position.set(120,1,-25);w.gym.boat.rotation.y=Math.PI/2;w.gym.update(time);
   w.gym.water.setWake(120-w.gym.water.root.position.x,-25-w.gym.water.root.position.z,Math.PI/2,strength);
   if(view==='boat'){w.camera.position.set(110,5,-13);w.camera.lookAt(w.camera.aspect<1?120:124,1,w.camera.aspect<1?-25:-27);w.camera.near=.25;w.camera.far=600;}
   if(view==='coast'){w.camera.position.set(86,7,-60);w.camera.lookAt(130,1,-96);w.camera.near=.25;w.camera.far=1000;}
   if(view==='overview'){w.camera.position.set(250,240,300);w.camera.lookAt(35,0,-25);w.camera.near=20;w.camera.far=2000; if(scene.fog){scene.fog.near=500;scene.fog.far=1800;}}
   w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);scene.getObjectByName('Gradient sky dome')?.position.copy(w.camera.position);
   w.lod.setMode('auto');w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);
   await w.renderer.compileAsync(scene,w.camera);let draws=0;const mesh=w.gym.water.root,old=mesh.onBeforeRender;mesh.onBeforeRender=()=>draws++;
   w.renderer.render(scene,w.camera);mesh.onBeforeRender=old;
   return {backend:w.getSnapshot().backend,view,time,wake:w.gym.water.uniforms.wakeStrength.value,waterDraws:draws,waterTriangles:(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,refraction:w.gym.water.refraction,positionVersion:mesh.geometry.attributes.position.version,render:{draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles},world:w.lod.stats(w.gym.root)};
  },{time,strength,view});measurements.push(metrics);return metrics;
 };
 const m=await render(4,0);const still=await p.screenshot({path:`${out}/${backend}-still.png`});
 check(m.waterDraws===1&&m.waterTriangles===800&&!m.refraction,backend+' ocean retains 800 triangles, one draw, no refraction capture');
 await render(4,0);const paused=await p.screenshot();check(still.equals(paused),backend+' fixed time and stationary boat render identically');
 const moving=await render(6,0);const animated=await p.screenshot({path:`${out}/${backend}-waves.png`});check(!still.equals(animated),backend+' advancing time visibly animates ocean');
 await render(6,3);const wake=await p.screenshot({path:`${out}/${backend}-wake.png`});check(!animated.equals(wake),backend+' moving boat produces visible wake');
 check(moving.positionVersion===m.positionVersion,backend+' animated water does not upload geometry');
 await render(6,0);const reset=await p.screenshot();check(reset.equals(animated),backend+' stopping removes the wake without retained particles');
 await render(6,0,'coast');await p.screenshot({path:`${out}/${backend}-coast.png`});
 await render(6,0,'overview');await p.screenshot({path:`${out}/${backend}-overview.png`});
 await p.setViewportSize({width:390,height:844});await read(p,w=>{const mount=document.getElementById('gym-viewport');w.renderer.setSize(mount.clientWidth,mount.clientHeight);w.camera.aspect=mount.clientWidth/mount.clientHeight;});await render(6,3);await p.screenshot({path:`${out}/${backend}-phone.png`});
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),backend+' 390px layout fits');
 await context.close();
}
check(errors.length===0,'No browser or shader errors');
check(JSON.stringify(before)===JSON.stringify(await sources()),'Water source stayed unchanged during checks');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({date:new Date().toISOString(),passed:!failure,failure,checks,errors,measurements,sources:before,note:'Chrome on this Mac, native WebGPU and WebGL 2. Phone-size viewport is emulation. Fixed inspection boat poses are separate from interactive boat regression.'},null,2)+'\n');await browser.close();}
