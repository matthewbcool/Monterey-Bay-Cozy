/** Shared-preview input plus held camera inspections; never changes player/animal placement. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/coastal-life';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],checks=[],metrics=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,s)=>{if(!v)throw Error(s);checks.push(s);console.log('PASS',s);};
const read=(p,fn)=>p.evaluate(async code=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return (0,eval)('('+code+')')(viewer.avatarWorkbench);},fn.toString());
try{for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|compile|validation/i.test(e.text()))errors.push(e.text());});
 await p.route('https://api.weather.gov/**',r=>r.abort());await p.clock.setFixedTime(new Date('2026-10-24T20:00:00Z'));
 // Hold one source snapshot while other chats work on the shared checkout.
 await p.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 await p.goto('http://127.0.0.1:5191/?tab=gym'+(backend==='webgl'?'&webgl':''));
 const end=Date.now()+120000;while(Date.now()<end){if(await read(p,w=>!!w?.gym?.coastalLife&&w.getSnapshot().frameCount>4))break;await pause(200);}
 check(await read(p,w=>w.getSnapshot().coastalLife.kelp===120),backend+' 120 added kelp plants');
 await p.locator('#gym-menu > summary').click();await p.locator('#gym-coastal-view').click();await pause(400);await p.screenshot({path:out+'/'+backend+'-lookout.png'});
 check(await read(p,w=>w.gym.coastalLife.root.parent===w.gym.root.parent&&w.gym.coastalLife.root.parent!==null),backend+' habitat attached to scene');
 const start=await read(p,w=>w.gym.coastalLife.swimmers[0].model.root.position.toArray());await pause(800);const later=await read(p,w=>w.gym.coastalLife.swimmers[0].model.root.position.toArray());check(Math.hypot(...later.map((v,i)=>v-start[i]))>.2,backend+' shark patrol moves');
 const counts=await read(p,w=>({backend:w.getSnapshot().backend,life:w.gym.coastalLife.stats(),lod:w.lod.stats(w.gym.coastalLife.root),trail:w.gym.waterfront.trail,region:w.lod.stats(w.gym.waterfront.root)}));check(counts.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' correct renderer');
 await read(p,w=>{w.setActive(null);});
 for(const shot of ['shark','kelp-underwater','kelp-surface','trail']){
  await p.evaluate(async shot=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench,g=w.gym,scene=g.root.parent,camera=w.camera;const under=shot==='shark'||shot==='kelp-underwater';
   if(shot==='shark'){const p=g.coastalLife.swimmers[0].model.root.position;g.coastalLife.setViewer(p.x,p.z);camera.position.set(p.x-6,-.6,p.z+7);camera.lookAt(p.x,p.y,p.z);}
   else if(shot.startsWith('kelp')){const c=g.coastalLife.beds[2].center;g.coastalLife.setViewer(c.x,c.z);camera.position.set(c.x+15,under?-1.3:6,c.z+12);camera.lookAt(c.x,under?-1.7:1,c.z);}
   else {const r=g.waterfront.trail.records.find(r=>r.id==='authored-rest-3');const y=g.waterfront.trail.seats.find(s=>s.id===r.id).y-.53;camera.position.set(r.x+12,y+5,r.z+10);camera.lookAt(r.x,y+.7,r.z);g.coastalLife.setViewer(r.x,r.z);}
   camera.near=.1;camera.far=3500;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);scene.fog.color.set(under?'#2e6f78':'#b1c8c0');scene.fog.near=under?1:160;scene.fog.far=under?38:1200;
   w.weather.update({time:12,dt:60,underwater:under,overview:!under,reducedMotion:false,water:g.water});w.lod.setMode('near');w.lod.update(camera,1000,0,true);await w.renderer.compileAsync(scene,camera);w.renderer.render(scene,camera);w.renderer.render(scene,camera);
  },shot);
  await p.locator('#gym-viewport canvas').screenshot({path:out+'/'+backend+'-'+shot+'.png'});
 }
 const lodCheck=await read(p,w=>{const g=w.gym,s=g.root.parent,levels=[];for(const mode of ['near','mid','far']){w.lod.setMode(mode);w.lod.update(w.camera,1000,0,true);w.renderer.render(s,w.camera);levels.push({mode,stats:w.lod.stats(g.coastalLife.root)});}return levels;});
 check(lodCheck.every(r=>r.stats.ready),backend+' all LODs ready');metrics.push({...counts,levels:lodCheck});await p.close();
}check(errors.length===0,'no browser/shader errors');}finally{await fs.writeFile(out+'/checks.json',JSON.stringify({date:new Date().toISOString(),checks,errors,metrics},null,2));await browser.close();}
