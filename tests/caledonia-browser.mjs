/** Real menu/keyboard navigation; held cameras below are visual fixtures, not traversal. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'artifacts/caledonia-refinement';await fs.mkdir(out,{recursive:true});
const checks=[],errors=[],measurements=[];let failure;
const files=['src/viewer/avatarWorkbench.ts','src/viewer/mapStudy/caledonia.ts','src/viewer/mapStudy/caledoniaPlaygrounds.ts','src/viewer/mapStudy/caledoniaFence.ts','src/viewer/mapStudy/caledoniaMeals.ts','src/viewer/mapStudy/caledoniaAnnex.ts','src/data/caledonia-meals-site.json','tests/caledonia-browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await hashes();
const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);console.log('PASS',message);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const read=(p,fn,arg)=>p.evaluate(({fn,arg})=>new Function('w','arg',`return (${fn})(w,arg)`)(window.caledoniaReview, arg),{fn:fn.toString(),arg});
async function ready(p,view='gym'){
 let complete=false;
 for(const deadline=Date.now()+120000;Date.now()<deadline&&!complete;){
  complete=await p.evaluate(async view=>{const s=document.querySelector('script[type="module"][src*="/src/main.ts"]');if(!s)return false;const{viewer}=await import(s.src);const w=view==='gym'?viewer.avatarWorkbench:viewer.mapStudy;if(view==='gym'?!w?.getSnapshot().gymReady:!w?.caledonia)return false;window.caledoniaReview=w;return view!=='gym'||w.lod.stats(w.gym.caledonia.root).ready;},view);
  if(!complete)await p.waitForTimeout(120);
 }
 check(complete,view+' initialized');
}
async function menu(p){if(!await p.locator('#gym-menu').evaluate(el=>el.open))await p.locator('#gym-menu > summary').click();}
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.route('https://api.weather.gov/**',r=>r.abort());await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191',s=>s.send(JSON.stringify({type:'connected'})));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&/shader|pipeline|validation/i.test(m.text()))errors.push(m.text());});await p.clock.setFixedTime(new Date('2026-10-26T20:00:00Z'));
  const suffix=backend==='webgl'?'&webgl':'';
  await p.goto('http://127.0.0.1:5191/?tab=gym&whales=hide&destination=caledonia-park'+suffix);await ready(p);await p.waitForTimeout(350);
  let start=await read(p,w=>w.getSnapshot());
  check(start.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' requested backend active');
  check(start.destination==='caledonia-park'&&start.position[0]<-300,backend+' direct link arrives at park gate');
  check(await p.locator('.gym-place h1').textContent()==='Caledonia Park',backend+' destination title survives updates');
  await p.locator('#gym-viewport canvas').focus();await p.keyboard.down('w');await p.waitForTimeout(1900);await p.keyboard.up('w');
  const after=await read(p,w=>w.getSnapshot());check(await read(p,w=>w.gym.caledonia.containsPark(w.avatar.root.position.x,w.avatar.root.position.z)),backend+' actual keyboard walking passes through park gate');check(!after.swimming,backend+' park stays dry');
  check(after.destination==='caledonia-park',backend+' walking retains destination');await p.screenshot({path:`${out}/${backend}-walking.png`});
  await menu(p);await p.locator('#gym-reset').click();check(await read(p,w=>w.avatar.root.position.distanceTo(w.gym.caledonia.spawn)<.1),backend+' Back to start returns to this destination');
  await menu(p);await p.locator('#gym-overview').click();check(await read(p,w=>w.getSnapshot().caledoniaOverview),backend+' contextual overview frames Caledonia');
  check(await read(p,w=>w.camera.getWorldDirection(w.camera.position.clone()).y<-.999),backend+' north-up camera');await p.waitForTimeout(300);await p.screenshot({path:`${out}/${backend}-top.png`});
  await p.setViewportSize({width:1100,height:900});await p.waitForTimeout(200);check(await read(p,w=>w.getSnapshot().caledoniaOverview&&w.camera.getWorldDirection(w.camera.position.clone()).y<-.999),backend+' resize preserves Caledonia overview');await p.setViewportSize({width:1440,height:1000});
  await menu(p);await p.locator('#gym-overview').click();check(!await read(p,w=>w.getSnapshot().overview),backend+' overview returns to walk view');
  await menu(p);await p.selectOption('#gym-destination','lovers-point');await p.waitForTimeout(100);check(await read(p,w=>w.getSnapshot().destination)==='lovers-point',backend+' destination selector returns to Lovers Point');
  await menu(p);await p.selectOption('#gym-destination','caledonia-park');await p.waitForTimeout(200);check(new URL(p.url()).searchParams.get('destination')==='caledonia-park',backend+' selector preserves shareable destination URL');
  await menu(p);await p.locator('#gym-meals-visit').click();await p.waitForTimeout(200);check(await read(p,w=>w.avatar.root.position.distanceTo(w.gym.caledonia.meals.entry)<.2),backend+' Meals visit reaches mapped forecourt');
  const stats=await read(p,w=>({district:w.lod.stats(w.gym.caledonia.root),meals:w.lod.stats(w.gym.caledonia.meals.root),gates:w.gym.caledonia.parkEntrances.length}));measurements.push({backend,...stats});check(stats.district.near.draws<=8&&stats.district.near.triangles<=45000,backend+' full district within 45k/8 budget');check(stats.gates===5,backend+' five mapped pedestrian gates');check(stats.meals.near.draws===1&&stats.meals.far.triangles<stats.meals.near.triangles,backend+' Meals uses one draw and authored LOD');
  // Hold the existing render loop for reproducible, labeled review cameras.
  await read(p,w=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  for(const mode of ['near','mid','far'])for(const view of ['park','meals','playhouse','climbing']){
   const render=await read(p,async(w,{mode,view})=>{const c=w.gym.caledonia.court;if(view==='park'){w.camera.position.set(c.x-29,c.y+20,c.z+34);w.camera.lookAt(c.x,c.y,c.z);}else if(view==='playhouse'||view==='climbing'){const x=view==='playhouse'?-260:-248.8,z=view==='playhouse'?237:220,y=w.gym.caledonia.floorAt(x,z);w.camera.position.set(x-9,y+7,z+13);w.camera.lookAt(x,y+1.3,z);w.camera.fov=48;}else{const m=w.gym.caledonia.meals,b=m.bounds,center=b.getCenter(w.camera.position.clone());w.camera.position.set(m.center[0]+m.front[0]*32-m.front[1]*12,m.baseY+3,m.center[1]+m.front[1]*32+m.front[0]*12);w.camera.lookAt(m.center[0],m.baseY+2.8,m.center[1]);}
    w.camera.near=.1;w.camera.fov=(view==='playhouse'||view==='climbing')?48:60;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);w.weather.update({time:0,dt:60,underwater:false,overview:true,reducedMotion:true,water:w.gym.water});w.scene.updateMatrixWorld(true);w.lod.setMode(mode);w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);await w.renderer.compileAsync(w.scene,w.camera);w.renderer.info.reset();w.renderer.render(w.scene,w.camera);return {calls:w.renderer.info.render.calls,drawCalls:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles};},{mode,view});
   measurements.push({backend,mode,view,wholeSceneIncludingShadows:render});await p.screenshot({path:`${out}/${backend}-${view}-${mode}.png`});
  }
  await p.goto('http://127.0.0.1:5191/?tab=map'+suffix);await ready(p,'map');await p.locator('[data-view=caledonia]').click();await p.waitForTimeout(300);await p.screenshot({path:`${out}/${backend}-map.png`});check(await p.locator('[data-view=caledonia]').getAttribute('aria-pressed')==='true',backend+' shared Map Study view works');
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await context.route('https://api.weather.gov/**',r=>r.abort());await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191',s=>s.send(JSON.stringify({type:'connected'})));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.setFixedTime(new Date('2026-10-26T20:00:00Z'));await p.goto('http://127.0.0.1:5191/?tab=gym&webgl&quality=base&whales=hide');await ready(p);await menu(p);await p.selectOption('#gym-destination','caledonia-park');check((await read(p,w=>w.getSnapshot())).destination==='caledonia-park','touch destination selection');await menu(p);await p.locator('#gym-caledonia-top').tap();await p.waitForTimeout(250);check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px layout fits');await p.screenshot({path:`${out}/phone-top.png`});await context.close();check(errors.length===0,'no browser or shader errors');check(JSON.stringify(await hashes())===JSON.stringify(before),'source unchanged during validation');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(`${out}/browser-checks.json`,JSON.stringify({passed:!failure,failure,checks,errors,measurements,sourceHashes:before},null,2));await browser.close();}
