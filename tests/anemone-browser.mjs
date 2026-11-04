import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/giant-green-anemone', url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],results=[];
const run=(page,fn,arg)=>page.evaluate(async({fn,arg})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return await (new Function('v','arg',`return (${fn})(v,arg)`))(v,arg);},{fn:fn.toString(),arg});
try {
 for(const backend of ['webgpu','webgl']) {
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(backend+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(backend+': '+m.text());});
  await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),ws=>ws.send(JSON.stringify({type:'connected'})));
  await page.goto(`${url}?tab=objects&quality=standard${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  await page.selectOption('#object-select','giant-green-anemone');
  await run(page,async v=>{await v.lod.ready();v.state.running=false;await new Promise(requestAnimationFrame);v.controls.enableDamping=false;v.objects.turntable.rotation.y=0;v.renderer.info.autoReset=false;});
  const stats=await run(page,v=>({backend:v.state.backend,levels:v.lod.stats(v.objects.selected),seed:v.objects.selected.userData.seed}));
  if(stats.backend!==(backend==='webgl'?'WebGL 2':'WebGPU'))throw Error('Wrong backend');
  for(const level of ['near','mid','far']) {
   await page.selectOption('#lod-select',level);
   for(const view of level==='near'?['top','oblique','side']:['oblique']) {
    const measured=await run(page,(v,{view})=>{
      const y=.045;v.camera.up.set(0,1,0);v.camera.position.set(...(view==='top'?[0,.46,.001]:view==='side'?[.24,.075,.24]:[.22,.23,.22]));
      v.controls.target.set(0,y,0);v.camera.lookAt(v.controls.target);v.camera.updateProjectionMatrix();v.lod.update(v.camera,900,0,true);
      v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};
      v.objects.selected.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};
      v.objects.selected.visible=true;v.renderer.render(v.scene,v.camera);
      return {triangles:full.triangles-empty.triangles,draws:full.drawCalls-empty.drawCalls,camera:v.camera.position.toArray()};
    },{view});
    if(measured.triangles!==stats.levels[level].triangles||measured.draws!==1)throw Error(`${backend}/${level} submissions ${JSON.stringify(measured)}`);
    await page.screenshot({path:`${out}/${backend}-${level}-${view}.png`});results.push({backend,level,view,...measured});
   }
  }
  await page.selectOption('#lod-select','auto');
  const transitions=await run(page,v=>[.3,2,12,.3].map(d=>{v.camera.position.set(0,.05,d);v.lod.update(v.camera,900,0,true);return v.lod.inspect(v.objects.selected).map(m=>m.level);}));
  if(!transitions[0].includes('near')||!transitions[2].includes('far')||!transitions[3].includes('near'))throw Error('Automatic detail does not restore');
  // Same factory used by reefs: verify a one-draw instanced bed with actual renderer submissions.
  const bedStats=await run(page,async v=>{
    const {createAnemoneBed}=await import('/src/models/habitat/anemone/createAnemone.ts');
    const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');const Vector3=v.camera.position.constructor;
    const bed=createAnemoneBed('giant-green',Array.from({length:8},(_,i)=>({position:new Vector3((i%4-1.5)*.19,0,(Math.floor(i/4)-.5)*.20),normal:new Vector3(0,1,0)})),14);
    v.objects.turntable.add(bed.root);v.objects.selected.visible=false;applyNodeStyle(bed.root);await v.lod.register(bed.root);
    v.setLodMode('near');v.camera.position.set(.65,.75,.9);v.controls.target.set(0,.03,0);v.camera.lookAt(v.controls.target);v.lod.update(v.camera,900,0,true);
    v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};bed.root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};bed.root.visible=true;v.renderer.render(v.scene,v.camera);
    const result={levels:v.lod.stats(bed.root),triangles:full.triangles-empty.triangles,draws:full.drawCalls-empty.drawCalls};v.anemoneReviewBed=bed;return result;
  });
  if(bedStats.draws!==1||bedStats.triangles!==8*388)throw Error('Bed budget');
  await page.screenshot({path:`${out}/${backend}-bed.png`});
  results.push({backend,stats,transitions,bed:bedStats});
  await run(page,v=>{v.anemoneReviewBed.dispose();delete v.anemoneReviewBed;});
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),ws=>ws.send(JSON.stringify({type:'connected'})));
 await page.goto(`${url}?tab=objects&quality=base&webgl`,{waitUntil:'networkidle'});await page.selectOption('#object-select','giant-green-anemone');await run(page,async v=>await v.lod.ready());
 if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Mobile overflow');
 await page.screenshot({path:`${out}/mobile-base.png`});await page.close();
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS anemone browser: both backends, LOD submissions, auto transitions, beds, mobile Base');
} finally {await fs.writeFile(`${out}/browser.json`,JSON.stringify({date:new Date().toISOString(),results,errors},null,2)+'\n');await browser.close();}
