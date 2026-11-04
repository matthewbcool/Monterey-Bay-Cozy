import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'artifacts/recreation-area';await fs.mkdir(out,{recursive:true});
const checks=[],errors=[],measurements=[];let failure;
const paths=['src/viewer/testingGym/landmarks.ts','src/viewer/testingGym/parkFurniture.ts','src/viewer/testingGym/poolGate.ts','src/viewer/testingGym/recreationGrade.ts','src/viewer/testingGym/elevation.ts','src/viewer/testingGym/pathStyle.ts','src/viewer/testingGym.ts','src/viewer/avatarWorkbench.ts','src/viewer/mapStudy/loversPoint.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));const before=await hashes();
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('w','arg',`return (${fn})(w,arg)`)(viewer.avatarWorkbench,arg);},{fn:fn.toString(),arg});
async function until(p,fn,label){for(let i=0;i<120;i++){const s=await read(p,w=>w?({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null}):null);if(s&&fn(s))return s;await p.waitForTimeout(100);}throw Error('Timed out: '+label);}
async function visit(p,touch=false){const action=touch?'tap':'click';await p.locator('#gym-menu > summary')[action]();await p.locator('#gym-pool-visit')[action]();await until(p,s=>s.nearest==='pool-gate','gate prompt');}
const side=s=>(s.position[0]+9.526644930515337)*.9615+(s.position[2]-35.65674274319632)*(-.2747);
async function setup(options){const context=await browser.newContext(options);await context.route('https://api.weather.gov/**',r=>r.abort());await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(m.text()))errors.push(m.text());});await p.clock.setFixedTime(new Date('2026-10-25T20:00:00Z'));return {context,p};}
try{
 for(const backend of ['webgpu','webgl']){
  const {context,p}=await setup({viewport:{width:1440,height:1000}});
  await p.goto('http://127.0.0.1:5191/?tab=gym&whales=hide'+(backend==='webgl'?'&webgl':''));
  await p.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return viewer.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:90000});await visit(p);
  check((await read(p,w=>({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null}).backend))===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' actual backend');
  // Camera fixture looks straight through the doorway. Travel uses real held keys.
  await read(p,w=>{const a=w.avatar.root.position;w.camera.position.set(a.x+5.769,a.y+3,a.z-1.648);w.camera.lookAt(a.x,a.y+.78,a.z);w.camera.updateMatrixWorld(true);});
  await p.locator('#gym-viewport canvas').focus();await p.keyboard.down('w');await p.waitForTimeout(2200);await p.keyboard.up('w');
  check(side(await read(p,w=>({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null})))>.2,backend+' closed gate blocks held walking input');
  await p.keyboard.down('s');await until(p,s=>side(s)>1.9,'back away');await p.keyboard.up('s');await p.waitForTimeout(200);
  await p.keyboard.press('e');await until(p,s=>s.poolGate.open,'open gate');
  check((await p.locator('#gym-interact-label').textContent())==='Close pool gate',backend+' prompt updates to close');
  await p.keyboard.down('w');await until(p,s=>side(s)<-.62,'walk onto deck');await p.keyboard.up('w');await p.waitForTimeout(200);
  check((await read(p,w=>({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null}))).poolGate.open,backend+' avatar crosses open doorway');
  await p.keyboard.press('e');await p.waitForTimeout(150);check((await read(p,w=>({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null}))).poolGate.open,backend+' gate refuses occupied swing');
  await p.screenshot({path:`${out}/${backend}-on-deck.png`});
  await p.keyboard.down('s');await until(p,s=>side(s)>1.9,'walk out');await p.keyboard.up('s');await p.waitForTimeout(200);await p.keyboard.press('e');await until(p,s=>!s.poolGate.open,'close gate');
  check(!(await read(p,w=>({...w.getSnapshot(),poolGate:w.gym?{open:w.gym.poolGate.open}:null}))).poolGate.open,backend+' can leave and close gate');
  const stats=await read(p,async w=>{await w.lod.ready();return w.lod.stats(w.gym.root);});measurements.push({backend,park:stats});
  check(stats.near.triangles<=69472&&stats.near.draws<=38,backend+' unchanged park budget');
  await read(p,w=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  for(const [name,position,target] of [['overview',[-60,30,104],[-9,8,50]],['pool',[-1,19,53],[-16,8.25,38]],['court',[7,18,83],[-8,8.5,56]],['trail',[17,16,104],[-27,10,79]]]){
   for(const mode of name==='pool'?['near','mid','far']:['near']){
    await read(p,async(w,{position,target,mode})=>{w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateMatrixWorld(true);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});w.scene.updateMatrixWorld(true);w.lod.setMode(mode);w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);await w.renderer.compileAsync(w.scene,w.camera);w.renderer.render(w.scene,w.camera);},{position,target,mode});
    await p.screenshot({path:`${out}/${backend}-${name}-${mode}.png`});
   }
  }
  // Shared map factory retains this geography and a closed static gate.
  await p.goto('http://127.0.0.1:5191/?tab=map&park'+(backend==='webgl'?'&webgl':''));
  await p.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!viewer.mapStudy?.park;},undefined,{timeout:90000});
  await p.locator('[data-view=park]').click();
  check(await p.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!viewer.mapStudy.park.root.getObjectByName('Lovers Point pool · opening gate');}),backend+' Map Study uses same recreation geometry');
  await p.screenshot({path:`${out}/${backend}-map.png`});await context.close();
 }
 const {context,p}=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:5191/?tab=gym&webgl&quality=base&whales=hide');
 await p.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return viewer.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:90000});await visit(p,true);
 await p.locator('#gym-interact').tap();await until(p,s=>s.poolGate.open,'touch opens gate');check(true,'Base/reduced-motion touch opens gate');
 await p.locator('#gym-interact').tap();await until(p,s=>!s.poolGate.open,'touch closes gate');check(true,'Base/reduced-motion touch closes gate');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px layout fits');await p.screenshot({path:`${out}/phone.png`});await context.close();
 check(errors.length===0,'no browser or shader errors');check(JSON.stringify(before)===JSON.stringify(await hashes()),'recreation sources stable during browser validation');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(`${out}/browser-checks.json`,JSON.stringify({passed:!failure,failure,checks,errors,measurements,sourceHashes:before},null,2));await browser.close();}
