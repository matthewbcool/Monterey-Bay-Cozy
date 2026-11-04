import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/museum-district';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],metrics=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));const check=(v,s)=>{if(!v)throw Error(s);checks.push(s);console.log('PASS',s);};
const read=(p,fn)=>p.evaluate(async code=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return (0,eval)('('+code+')')(viewer.avatarWorkbench);},fn.toString());
try{for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|compile|validation/i.test(e.text()))errors.push(e.text());});
 await p.route('https://api.weather.gov/**',r=>r.abort());await p.clock.setFixedTime(new Date('2026-10-24T20:00:00Z'));
 await p.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 await p.goto('http://127.0.0.1:5191/?tab=gym'+(backend==='webgl'?'&webgl':''));
 const end=Date.now()+120000;while(Date.now()<end){if(await read(p,w=>!!w?.gym?.museum&&w.getSnapshot().frameCount>4))break;await pause(200);}
 await p.locator('#gym-menu > summary').click();await p.locator('#gym-museum-visit').click();await pause(300);check(await read(p,w=>w.getSnapshot().museum.floor==='ground'),backend+' museum visit');
 check(await read(p,w=>w.getSnapshot().backend)===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' correct renderer');
 await read(p,w=>w.setActive(null));
 const route=await read(p,w=>{const result=[];for(const v of [-14.7,3]){const target=w.gym.museum.point(16.54,v);for(let i=0;i<1200;i++){const p=w.avatar.root.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.07)break;w.controller.update(1/60,{x:dx/d,z:dz/d,run:true});}result.push(Math.hypot(target.x-w.avatar.root.position.x,target.z-w.avatar.root.position.z));}return result;});
 check(route.every(d=>d<.12),backend+' walk down approach and back up all stairs');
 for(const shot of ['stairs','empty-rooms','jewell-park']){
  await p.evaluate(async shot=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench,g=w.gym,m=g.museum,scene=g.root.parent,c=w.camera;
   m.setView(shot==='empty-rooms'?'ground':'exterior');
   if(shot==='stairs'){c.position.copy(m.point(5,-22,11));c.lookAt(m.point(17,-1,0));}
   else if(shot==='empty-rooms'){c.position.copy(m.point(45,-5,35));c.lookAt(m.point(20,18,0));}
   else{c.position.set(55,61,418);c.lookAt(-7,25,358);}
   c.near=.2;c.far=3500;c.updateProjectionMatrix();c.updateMatrixWorld(true);scene.fog.near=160;scene.fog.far=1200;
   w.weather.update({time:12,dt:60,underwater:false,overview:true,reducedMotion:true,water:g.water});w.lod.setMode('near');w.lod.update(c,1000,0,true);await w.renderer.compileAsync(scene,c);w.renderer.render(scene,c);w.renderer.render(scene,c);
  },shot);await p.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-${shot}.png`});
 }
 const stats=await read(p,w=>{const g=w.gym,scene=g.root.parent,levels=[];for(const mode of ['near','mid','far']){w.lod.setMode(mode);w.lod.update(w.camera,1000,0,true);w.renderer.render(scene,w.camera);levels.push(mode);}return {museum:w.lod.stats(g.museum.root),region:w.lod.stats(g.waterfront.root),park:g.waterfront.jewellPark,waterTriangles:(g.water.root.geometry.index?.count??g.water.root.geometry.attributes.position.count)/3,levels};});
 check(stats.region.near.triangles<=100000,backend+' waterfront budget');check(stats.museum.near.triangles<=26000,backend+' museum budget');check(stats.waterTriangles<800,backend+' smaller coastline-clipped ocean');metrics.push({backend,...stats});await p.close();
}check(errors.length===0,'no browser or shader errors');}finally{await fs.writeFile(out+'/checks.json',JSON.stringify({checks,errors,metrics},null,2));await browser.close();}
