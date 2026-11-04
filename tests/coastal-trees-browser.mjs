import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/',out='artifacts/camera-lighting-trees';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],results=[];let failure;
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('v','arg',`return (${fn})(v,arg)`)(v,arg);},{fn:fn.toString(),arg});
try{for(const backend of ['webgpu','webgl']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),preview=new URL(url);
 await context.route('https://api.weather.gov/**',r=>r.abort());await context.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::ERR_/.test(m.text()))errors.push(m.text());});
 await p.goto(`${url}?tab=objects${backend==='webgl'?'&webgl':''}`);await read(p,v=>v.started);
 const species=['monterey-cypress','monterey-pine','coast-live-oak','pohutukawa','canary-island-date-palm','cabbage-tree','inventory-holly'];
 for(const id of species){
  await p.selectOption('#object-select',id);
  const stats=await read(p,async v=>{await v.lod.ready();return {levels:v.lod.stats(v.objects.selected),seed:v.objects.selected.userData.seed,backend:v.state.backend,height:v.objects.selected.userData.heightMetres};});results.push({backend,id,...stats});
  check(stats.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),`${backend}/${id} renderer`);check(stats.levels.near.draws===1&&stats.levels.near.triangles<=260,`${backend}/${id} one low-triangle batch`);
  for(const mode of ['near','mid','far']){await read(p,(v,mode)=>{v.setLodMode(mode);v.lod.update(v.camera,innerHeight,0,true);},mode);if(species.indexOf(id)<3&&mode!=='mid')await p.screenshot({path:`${out}/${backend}-${id}-${mode}.png`});}
  await p.locator('#object-regenerate').click();check(await read(p,(v,seed)=>v.objects.selected.userData.seed!==seed,stats.seed),`${backend}/${id} regenerates`);
 }
 await p.locator('#object-compare').click();check(await read(p,async v=>{const{propCollection}=await import('/src/models/props/catalogue.ts');return v.objects.comparison.children.filter(x=>x.userData.assetId).length===propCollection.length;}),`${backend} comparison includes every object`);await p.screenshot({path:`${out}/${backend}-compare.png`});
 await p.setViewportSize({width:390,height:844});await p.selectOption('#object-select','monterey-cypress');await p.screenshot({path:`${out}/${backend}-phone.png`});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${backend} phone layout`);
 await p.setViewportSize({width:1440,height:1000});await p.locator('#tab-gym').click();await p.waitForFunction(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:90000});
 await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').evaluate(e=>e.parentElement.open=true);await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.locator('#gym-weather-date').fill('2026-10-24T13:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();
 await read(p,async v=>{const w=v.avatarWorkbench;await w.lod.ready();window.__treeScene=w.gym.root.parent;w.setActive(null);});
 const views=[['park',[130,110,110],[10,5,-20]],['cove',[70,14,45],[22,8,-3]],['cypress',[30,14,-59],[18,11,-85]]];
 for(const [name,position,target]of views){
  const metric=await read(p,async(v,{position,target})=>{const w=v.avatarWorkbench;w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.near=.25;w.camera.far=2500;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,water:w.gym.water});window.__treeScene.updateMatrixWorld(true);w.lod.setMode('near');w.lod.update(w.camera,1000,0,true);await w.renderer.compileAsync(window.__treeScene,w.camera);w.renderer.render(window.__treeScene,w.camera);const groups=[];w.gym.root.traverse(o=>{if(o.userData.treeSourceIds)groups.push({count:o.count,ids:o.userData.treeSourceIds,triangles:o.geometry.attributes.position.count/3*o.count,stableLighting:o.material.userData.stableToonLighting,surfaceStyle:o.material.userData.gymSurfaceStyle});});return {groups,world:w.lod.stats(w.gym.root)};},{position,target});results.push({backend,view:name,...metric});check(metric.groups.reduce((n,g)=>n+g.count,0)===52&&metric.groups.length===5,`${backend}/${name} 52 inventory trees in five draws`);check(metric.groups.every(g=>g.stableLighting&&g.surfaceStyle),`${backend}/${name} stable lighting reaches tree instances`);await p.screenshot({path:`${out}/${backend}-${name}.png`});
 }
 await context.close();
}check(errors.length===0,'No browser or shader errors');}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({date:new Date().toISOString(),checks,errors,results,failure,note:'Chrome on this Mac; WebGPU and forced WebGL2; phone viewport emulation, not physical device testing. World stats include concurrently added waterfront and avatar work.'},null,2)+'\n');await browser.close();}
