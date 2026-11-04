import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='artifacts/monarch-batch',url='http://127.0.0.1:5191/';await fs.mkdir(out,{recursive:true});
const sourcePaths=['src/main.ts','src/viewer/objects.ts','src/models/props/catalogue.ts','src/style.css',...(await fs.readdir('src/models/habitat/monarch-butterfly')).filter(p=>p.endsWith('.ts')).map(p=>'src/models/habitat/monarch-butterfly/'+p)];
const hash=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await hash(),checks=[],errors=[],records=[];
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const run=(page,fn,arg)=>page.evaluate(({fn,arg})=>new Function('r','arg',`return (${fn})(r,arg)`)(window.monarchReview,arg),{fn:fn.toString(),arg});
async function context(){const c=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await c.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));return c;}
function watch(page,backend){page.on('pageerror',e=>errors.push(`${backend}: ${e.message}`));page.on('console',e=>{if(['error','warning'].includes(e.type())&&!e.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(`${backend}: ${e.text()}`);});}
try{
 for(const backend of ['webgpu','webgl']){
  const c=await context(),page=await c.newPage();watch(page,backend);
  await page.goto(`${url}tests/monarch-batch-review.html${backend==='webgl'?'?webgl':''}`);await page.waitForFunction(()=>!!window.monarchReview);
  for(const count of [0,1,32,128,256,1,0,32]){
   const row=await run(page,async(r,count)=>{r.batch.setCount(count);r.frame();r.lod.setMode('near');const full=await r.render();r.batch.mesh.visible=false;const empty=await r.render();r.batch.mesh.visible=count>0;await r.render();return {count,draws:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles,stats:r.lod.stats(r.batch.root)};},count);
   records.push({backend,...row});check(row.draws===(count?1:0)&&row.triangles===912*count,`${backend}: ${count} instances use ${count?1:0} draw and exact triangles`);
  }
  for(const level of ['near','mid','far']){
   const row=await run(page,async(r,level)=>{r.batch.setCount(128);r.batch.setPose('flight');r.lod.setMode(level);r.batch.update(.19);r.frame();await r.render();return {level,stats:r.lod.stats(r.batch.root),active:r.lod.inspect(r.batch.root),rendered:{...r.renderer.info.render}};},level);
   records.push({backend,...row});check(row.stats[level].draws===1&&row.stats[level].triangles===128*({near:912,mid:560,far:212}[level]),`${backend}: ${level} group keeps one draw`);
   await page.screenshot({path:`${out}/${backend}-128-${level}.png`});
   const image=await page.screenshot();await run(page,async r=>{r.batch.update(.11);await r.render();});check(!image.equals(await page.screenshot()),`${backend}: ${level} wings animate`);
  }
  await run(page,async r=>{r.batch.setCount(1);r.batch.setTransformAt(0,new r.Matrix4());r.batch.setPose('basking');r.lod.setMode('near');r.frame();await r.render();});
  const open=await page.screenshot({path:`${out}/${backend}-open.png`});
  await run(page,async r=>{r.batch.setPose('perched');r.frame(true);await r.render();});await page.screenshot({path:`${out}/${backend}-folded.png`});
  const folded=await page.screenshot();await run(page,async r=>{r.batch.update(.5);await r.render();});check(folded.equals(await page.screenshot()),`${backend}: perched wings stay still`);check(!open.equals(folded),`${backend}: folded pose changes silhouette`);
  await run(page,async r=>{r.batch.setCount(32);r.batch.setPose('flight');r.frame();r.lod.setMode('auto');r.camera.position.set(0,0,20);r.camera.lookAt(0,0,0);await r.render();});
  check(await run(page,r=>r.lod.inspect(r.batch.root).every(m=>m.level==='far')),`${backend}: distance selects Far for whole batch`);
  await page.close();
  // Actual library controls and canonical single-model path.
  const ui=await c.newPage();watch(ui,backend);
  await ui.goto(`${url}?tab=objects${backend==='webgl'?'&webgl':''}`);
  await ui.evaluate(async()=>{window.v=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await window.v.started;});
  await ui.selectOption('#object-select','monarch-butterfly');
  check(await ui.locator('#object-group').isVisible(),`${backend}: group selector available`);
  for(const count of [32,128,256,1,32]){
   await ui.selectOption('#object-group',String(count));await ui.evaluate(async()=>{await window.v.lod.ready();});
   check(await ui.evaluate(count=>window.v.state.objectInstances===count&&window.v.lod.stats(window.v.objects.selected).near.triangles===912*count,count),`${backend}: library selects ${count} butterflies`);
  }
  check(await ui.locator('#export-object').isHidden(),`${backend}: group does not offer an inaccurate GPU-animation export`);
  await ui.selectOption('#object-pose','perched');check(await ui.locator('#object-motion').isHidden(),`${backend}: folded group stays still`);
  await ui.selectOption('#object-pose','flight');check(await ui.evaluate(()=>!window.v.state.objectMotion),`${backend}: reduced motion remains paused`);
  await ui.click('#object-motion');await ui.waitForTimeout(120);check(await ui.evaluate(()=>window.v.state.objectMotion),`${backend}: explicit Play enables group motion`);await ui.click('#object-motion');
  await ui.screenshot({path:`${out}/${backend}-library.png`});
  await ui.click('#object-regenerate');check(await ui.evaluate(()=>window.v.state.objectInstances===32),`${backend}: regeneration retains group size`);
  await ui.click('#object-compare');await ui.click('#object-compare');check(await ui.evaluate(()=>window.v.state.objectInstances===32),`${backend}: comparison restores group size`);
  await ui.setViewportSize({width:320,height:844});await ui.screenshot({path:`${out}/${backend}-mobile.png`});
  check(await ui.evaluate(()=>{const r=document.querySelector('#object-group').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight;}),`${backend}: 320px group control fits`);
  await ui.selectOption('#object-select','rowboat');check(await ui.locator('#object-group-control').isHidden()&&await ui.locator('#export-object').isVisible(),`${backend}: ordinary assets retain export without group control`);
  await c.close();
 }
 check(errors.length===0,'No browser or shader errors: '+errors.slice(0,5).join(' | '));
 const after=await hash();check(JSON.stringify(before)===JSON.stringify(after),'Production source stayed stable during capture');
 await fs.writeFile(`${out}/browser-metrics.json`,JSON.stringify({checks,errors,records,before,after},null,2)+'\n');
}finally{await fs.writeFile(`${out}/browser-progress.json`,JSON.stringify({checks,errors,records},null,2)+'\n');await browser.close();}
console.log(`PASS ${checks.length} monarch batch browser checks`);
