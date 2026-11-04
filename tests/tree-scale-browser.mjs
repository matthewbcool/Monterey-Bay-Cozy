/** Ground-level architectural comparison for the Oct 25 user photo; inferred camera, not photogrammetry. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/lovers-point-tree-scale',phase='after';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],results=[];
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('w','arg',`return (${fn})(w,arg)`)(viewer.avatarWorkbench,arg);},{fn:fn.toString(),arg});
try{for(const backend of ['webgpu','webgl']){
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await context.route('https://api.weather.gov/**',r=>r.abort());
 await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(e.text()))errors.push(e.text());});
 await p.goto('http://127.0.0.1:5191/?tab=gym&quality=standard&whales=hide'+(backend==='webgl'?'&webgl':''));
 for(let i=0;i<300;i++){const s=await read(p,w=>w?.getSnapshot());if(s?.gymReady&&s.frameCount>4)break;if(i%50===0)console.log('Loading',backend,JSON.stringify({ready:s?.gymReady,frames:s?.frameCount}));if(i===299)throw Error('Gym not ready: '+await p.locator('body').innerText());await p.waitForTimeout(200);}
 await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').evaluate(e=>e.parentElement.open=true);await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.fill('#gym-weather-date','2026-10-25T13:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();
 await read(p,async w=>{await w.lod.ready();Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));w.scene.updateMatrixWorld(true);});
 const views=[['reference',[70,10.5,-23],[-30,11.5,-28],70],['grove',[70,26,40],[16,14,-13],52],['overview',[110,95,95],[8,7,-30],52]];
 for(const [view,position,target,fov]of views){const metric=await read(p,async(w,{position,target,fov})=>{
  const {PARK_TREES}=await import('/src/viewer/testingGym/placement.ts');const y=position[1]??w.gym.terrainHeight(position[0],position[2])+1.7;
  w.avatar.root.visible=false;w.gym.reef.root.visible=false;w.gym.coastalLife.root.visible=false;w.gym.bay?.root&&(w.gym.bay.root.visible=false);
  w.camera.position.set(position[0],y,position[2]);w.camera.lookAt(...target);w.camera.fov=fov;w.camera.near=.25;w.camera.far=2600;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
  w.weather.update({time:0,dt:60,underwater:false,overview:false,reducedMotion:true,shadowFocus:w.avatar.root.position,water:w.gym.water});w.lod.setMode('near');w.lod.update(w.camera,1000,0,true);await w.renderer.compileAsync(w.scene,w.camera);w.renderer.render(w.scene,w.camera);
  const batches=[];w.gym.root.traverse(o=>{if(o.userData.treeSourceIds)batches.push({ids:o.userData.treeSourceIds,draws:1,count:o.count});});
  return {camera:w.camera.position.toArray(),trees:PARK_TREES.map(t=>({id:t.sourceId,x:t.x,z:t.z,height:t.height})),batches,park:w.lod.stats(w.gym.root),renderer:w.renderer.info.render};
 },{position,target,fov});results.push({backend,view,...metric});await p.screenshot({path:`${out}/${phase}-${backend}-${view}.png`});}
 // All LODs must retain the same rooted placement at the same comparison camera.
 for(const level of ['mid','far']){await read(p,(w,level)=>{w.camera.position.set(70,10.5,-23);w.camera.lookAt(-30,11.5,-28);w.camera.fov=70;w.camera.updateProjectionMatrix();w.lod.setMode(level);w.lod.update(w.camera,1000,0,true);w.renderer.render(w.scene,w.camera);},level);await p.screenshot({path:`${out}/${phase}-${backend}-${level}.png`});}
 if(phase!=='before'){
  // The data-driven height change must also reach the independent Map Study owner.
  await p.locator('#tab-map').click();await p.waitForTimeout(700);await p.evaluate(async()=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);if(!viewer.mapStudy)throw Error('Map Study owner missing');await viewer.mapStudy.lod.ready();const batches=[];viewer.mapStudy.park.root.traverse(o=>{if(o.userData.treeSourceIds)batches.push(o.count);});if(batches.reduce((n,c)=>n+c,0)!==52)throw Error('Map lost municipal tree instances');});
 }
 await context.close();console.log('Captured',phase,backend);
 }if(errors.length)throw Error(errors.join('\n'));
}finally{await fs.writeFile(out+`/${phase}-browser.json`,JSON.stringify({phase,errors,results},null,2));await browser.close();}
