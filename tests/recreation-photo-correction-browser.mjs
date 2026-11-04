import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='artifacts/recreation-photo-correction';await fs.mkdir(out,{recursive:true});
const sources=['src/viewer/testingGym/recreationGrade.ts','src/viewer/testingGym/groundSurface.ts','src/viewer/testingGym/elevation.ts','src/viewer/testingGym/access.ts','src/viewer/testingGym/pathStyle.ts','src/viewer/testingGym/buildings.ts','src/viewer/testingGym/landmarks.ts'];
const hashSources=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')]))),before=await hashSources();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const errors=[],results=[];
try{for(const backend of ['webgpu','webgl']){
 const page=await browser.newPage({viewport:{width:1200,height:850},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|validation/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide${backend==='webgl'?'&webgl':''}`);
 const deadline=Date.now()+120000;
 while(!await page.evaluate(async()=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench;if(!w?.getSnapshot().gymReady)return false;window.gradeW=w;return true;})){assert(Date.now()<deadline);await page.waitForTimeout(200);}
 const stats=await page.evaluate(async()=>{const w=window.gradeW;window.gradeScene=w.scene;w.setActive(null);await w.lod.ready();return {backend:w.getSnapshot().backend,lod:w.lod.stats(w.gym.root)};});
 assert.equal(stats.backend,backend==='webgpu'?'WebGPU':'WebGL 2');console.log('BUDGET',backend,JSON.stringify(stats.lod.near));
 for(const [name,position,target] of [['trail',[30,17,111],[-27,11.5,79]],['court',[-35,38,86],[-9,8.25,62]],['grill',[28,18,94],[4,8.25,77]],['stairs',[34,17,63],[5,7,55]],['bath-house',[9,14,51],[-10,12,20]],['pool-court',[-22,13,25],[-6,9,65]]])for(const level of name==='court'?['near','mid','far']:['near']){
  await page.evaluate(async({position,target,level})=>{const w=window.gradeW;w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateMatrixWorld(true);w.lod.setMode(level);w.lod.update(w.camera,850,0,true);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});await w.renderer.renderAsync(window.gradeScene,w.camera);},{position,target,level});
  await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-${name}-${level}.png`});
 }
 assert(stats.lod.near.triangles<=69472);assert(stats.lod.near.draws<=38);results.push(stats);console.log('PASS',backend,stats.lod.near);await page.close();
}assert.deepEqual(errors,[]);assert.deepEqual(await hashSources(),before,'Sources remain stable throughout browser validation');await fs.writeFile(`${out}/metrics.json`,JSON.stringify({browser:browser.version(),results,errors,sourceHashes:before},null,2));}finally{await browser.close();}
