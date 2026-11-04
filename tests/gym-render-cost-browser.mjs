/** Actual backend submissions, grouped by pass and owner; identical fixtures before/after. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/gym-render-cost',phase=process.env.PHASE??'before',quality=process.env.QUALITY??'standard';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const records=[],errors=[];
try{for(const backend of (process.env.BACKENDS??'webgpu').split(',')){
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|validation|wgsl|glsl/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=show&quality=${quality}${backend==='webgl'?'&webgl':''}`);
 await page.waitForSelector('#gym-viewport canvas');await page.evaluate(async()=>{window.costViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await costViewer.started;});
 await page.waitForFunction(()=>costViewer.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:90000});
 await page.evaluate(()=>{window.costWorkbench=costViewer.avatarWorkbench;for(const[id,v]of [['gym-weather-mode','clear'],['gym-weather-clock','preview'],['gym-weather-date','2026-10-26T13:00']]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const views=[['arrival',null,null,[25,8,-35],false],['walk',[64,12,-10],[-25,9,-50],[25,8,-35],false],['flight',[100,90,100],[0,5,-40],[25,8,-35],false],['overview',[180,180,180],[0,5,-40],[25,8,-35],true],['reef',null,null,null,false]];
 if(process.env.SWEEP)views.push(['morning',[64,12,-10],[-25,9,-50],[25,8,-35],false],['evening',[-20,12,-80],[120,1,-20],[25,8,-35],false],['portrait',[64,12,-10],[-25,9,-50],[25,8,-35],false],['return-flight',[100,90,100],[0,5,-40],[25,8,-35],false]);
 for(const[view,position,target,focus,overview]of views.filter(v=>!process.env.VIEWS||process.env.VIEWS.split(',').includes(v[0]))){
  if(view==='portrait')await page.setViewportSize({width:390,height:844});
  if(view==='return-flight')await page.setViewportSize({width:1280,height:900});
  const result=await page.evaluate(async({view,position,target,focus,overview})=>{
   const w=costWorkbench,g=w.gym,r=w.renderer,camera=w.camera;
   if(view==='reef'){const c=g.reef.center;focus=[c.x,c.y+2,c.z];position=[c.x+6,c.y+3,c.z+7];target=[c.x,c.y+1.5,c.z];}
   const date=document.getElementById('gym-weather-date');date.value='2026-10-26T'+(view==='morning'?'09:00':view==='evening'?'16:00':'13:00');date.dispatchEvent(new Event('change',{bubbles:true}));
   w.avatar.root.position.fromArray(focus);if(position){camera.position.fromArray(position);camera.lookAt(...target);}camera.updateMatrixWorld(true);
   g.reef.setViewer(focus[0],focus[2]);g.coastalLife.setViewer(focus[0],focus[2],overview);g.gulls.setViewer(focus[0],focus[2],overview);g.whalePod.setViewer(focus[0],focus[2],overview);
   w.weather.update({time:0,dt:60,underwater:view==='reef',overview,reducedMotion:true,water:g.water});w.lod.setMode('auto');w.lod.update(camera,r.domElement.clientHeight,1,true);await r.compileAsync(w.scene,camera);
   for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);r.render(w.scene,camera);}
   const owners=new Map([[g.reef.root,'reef'],[g.coastalLife.root,'coastal-life'],[g.gulls.root,'gulls'],[g.whalePod.root,'whales'],[g.butterflies.root,'butterflies'],[g.waterfront.root,'waterfront'],[g.museum.root,'museum'],[g.caledonia.root,'caledonia'],[g.seafloor.root,'seafloor'],[g.root,'park'],[w.avatar.root,'avatar'],[w.weather.root,'sky']]);
   const rows=[];const draw=r.backend.draw;
   r.backend.draw=function(ro,...args){const before=r.info.render.drawCalls,tris=r.info.render.triangles;const value=draw.call(this,ro,...args);let o=ro.object,owner='other';const path=[];while(o){path.push(o.name||o.type);if(owners.has(o)){owner=owners.get(o);break;}o=o.parent;}const index=w.weather.shadows.node.lights.findIndex(l=>l.shadow.camera===ro.camera);rows.push({pass:index<0?'color':'shadow-'+index,owner,name:path.slice(0,3).join(' / '),draws:r.info.render.drawCalls-before,triangles:r.info.render.triangles-tris});return value;};
   await new Promise(requestAnimationFrame);r.info.autoReset=false;r.info.reset();r.render(w.scene,camera);const totals={...r.info.render};r.backend.draw=draw;
   const census={};for(const row of rows){const key=row.pass+'/'+row.owner;const c=census[key]??={draws:0,triangles:0};c.draws+=row.draws;c.triangles+=row.triangles;}
   let reference;
   if(w.weather.shadows.node.casters){
    const canvas=document.createElement('canvas');canvas.width=r.domElement.width;canvas.height=r.domElement.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=async()=>{if(r.backend.isWebGPUBackend)await r.backend.device.queue.onSubmittedWorkDone();ctx.drawImage(r.domElement,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
    const optimized=await pixels(),optimizedImage=canvas.toDataURL(),cull=w.weather.shadows.node.casters,original=cull.update;
    try{
     cull.update=()=>{for(const light of w.weather.shadows.node.lights)light.shadow.camera.layers.mask=camera.layers.mask;};
     for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);r.info.reset();r.render(w.scene,camera);}
     const all=await pixels();let changedPixels=0,maxChannelDelta=0;const changedBounds=[Infinity,Infinity,-Infinity,-Infinity];
     for(let i=0;i<all.length;i+=4){let changed=false;for(let j=0;j<3;j++){const d=Math.abs(all[i+j]-optimized[i+j]);maxChannelDelta=Math.max(maxChannelDelta,d);if(d>1)changed=true;}if(changed){changedPixels++;const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);changedBounds[0]=Math.min(changedBounds[0],x);changedBounds[1]=Math.min(changedBounds[1],y);changedBounds[2]=Math.max(changedBounds[2],x);changedBounds[3]=Math.max(changedBounds[3],y);}}
     reference={totals:{...r.info.render},changedPixels,maxChannelDelta,changedBounds,images:changedPixels?[optimizedImage,canvas.toDataURL()]:undefined,pixels:canvas.width*canvas.height};
    }finally{cull.update=original;for(let i=0;i<2;i++){await new Promise(requestAnimationFrame);r.render(w.scene,camera);}}
   }
   return{backend:w.getSnapshot().backend,view,totals,reference,census,rows,coastal:g.coastalLife.stats(),reef:g.reef.active,gulls:g.gulls.stats(),camera:camera.position.toArray()};
  },{view,position,target,focus,overview});
  if(result.reference?.images){for(const[i,data]of result.reference.images.entries())await fs.writeFile(`${out}/${phase}-${backend}-${view}-${i?'reference':'optimized'}.png`,Buffer.from(data.split(',')[1],'base64'));delete result.reference.images;}records.push({quality,...result});if(result.reference){assert(result.totals.drawCalls<result.reference.totals.drawCalls,'Must reduce actual submissions');assert.equal(result.reference.changedPixels,0,`${backend}/${view}: visible pixels changed`);}console.log(JSON.stringify({backend,view,totals:result.totals,reference:result.reference}));await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${phase}-${backend}-${view}.png`});
 }
 await page.close();
}if(errors.length)throw Error(errors.join('\n'));}finally{await fs.writeFile(`${out}/${phase}.json`,JSON.stringify({phase,records,errors},null,2)+'\n');await browser.close();}
