import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'artifacts/sea-otter',checks=[],errors=[],records=[];await fs.mkdir(out,{recursive:true});
const paths=[...(await fs.readdir('src/models/habitat/sea-otter')).filter(p=>p.endsWith('.ts')).map(p=>'src/models/habitat/sea-otter/'+p),'src/models/props/catalogue.ts','src/models/props/dimensions.ts','tests/sea-otter-review.ts','tests/sea-otter-browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')]))),before=await hashes();
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const run=(p,fn,arg)=>p.evaluate(({fn,arg})=>new Function('r','arg',`return (${fn})(r,arg)`)(window.otterReview,arg),{fn:fn.toString(),arg});
let failure;
async function wait(p,fn,label){for(let i=0;i<450;i++){if(await p.evaluate(fn))return;await p.waitForTimeout(100);}throw Error('Timeout: '+label+' '+errors.slice(-4).join(' | '));}
const bones=w=>{const b=[];w.objects.selected.traverse(o=>{if(o.isSkinnedMesh)b.push(...o.skeleton.bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]));});return JSON.stringify(b);};
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1100,height:850},reducedMotion:'reduce'});await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191',s=>s.send(JSON.stringify({type:'connected'})));const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|pipeline|validation/i.test(m.text()))errors.push(m.text());});
  await p.goto('http://127.0.0.1:5191/tests/sea-otter-review.html'+(backend==='webgl'?'?webgl':''));await wait(p,()=>!!window.otterReview,'asset fixture');
  for(const pose of ['float','swim','groom','dive'])for(const level of ['near','mid','far']){
   const row=await run(p,async(r,{pose,level})=>{r.pose(pose,.6);r.frame();r.lod.setMode(level);return r.render();},{pose,level});records.push({backend,pose,level,...row});
   check(row.backend.toLowerCase().includes(backend),backend+' actual backend');check(row.rendered.draws===1&&row.rendered.triangles===row.stats[level].triangles,`${backend} ${pose} ${level}: one draw / exact triangles`);
   check(row.scale.every(n=>n===1)&&row.root.every(n=>n===0),backend+' placement stays metre scale');
   await p.screenshot({path:`${out}/${backend}-${pose}-${level}.png`});
  }
  for(const view of ['profile','top','underside','face']){
   await run(p,async(r,view)=>{r.lod.setMode('near');r.pose('float',.2);r.frame(view);await r.render();},view);await p.screenshot({path:`${out}/${backend}-float-${view}.png`});
  }
  for(const pose of ['swim','groom']){
   await run(p,async(r,pose)=>{r.frame();r.pose(pose,.15);await r.render();},pose);const a=await p.screenshot();await run(p,async(r,pose)=>{r.pose(pose,.5);await r.render();},pose);
   check(!a.equals(await p.screenshot()),backend+' '+pose+' visibly animates');
   const root=await run(p,r=>r.model.root.position.toArray());await run(p,r=>r.model.update(.4,{reducedMotion:true}));check(JSON.stringify(root)===JSON.stringify(await run(p,r=>r.model.root.position.toArray())),backend+' '+pose+' leaves placement unchanged');
  }
  for(const [distance,level] of [[3,'near'],[50,'mid'],[180,'far']]){const row=await run(p,async(r,d)=>{r.lod.setMode('auto');r.camera.position.set(0,0,-d);r.camera.lookAt(0,0,0);return r.render();},distance);records.push({backend,distance,expected:level,...row});check(row.active[0].level===level,backend+' automatic '+level);}
  await p.goto('http://127.0.0.1:5191/?tab=objects'+(backend==='webgl'?'&webgl':''));
  await wait(p,async()=>{const s=document.querySelector('script[type=module][src*="/src/main.ts"]');if(!s)return false;const{viewer}=await import(s.src);await viewer.started;window.otterReview=viewer;return !!viewer.objects;},'Objects');
  await p.selectOption('#object-select','southern-sea-otter');await wait(p,()=>window.otterReview.lod.stats(window.otterReview.objects.selected).ready,'object LOD');
  check(await p.locator('#object-pose option').count()===4,backend+' four library poses');
  check((await p.locator('#object-dimensions').textContent()).includes('1.00–1.50'),backend+' sourced size range shown');
  for(const pose of ['swim','groom','dive','float']){
   await p.selectOption('#object-pose',pose);check(await run(p,w=>!w.state.objectMotion),backend+' '+pose+' respects reduced motion');
   const before=await run(p,bones);await p.locator('#object-motion').click();await p.waitForTimeout(360);await p.locator('#object-motion').click();const after=await run(p,bones);await p.waitForTimeout(120);
   check(before!==after&&after===await run(p,bones),backend+' '+pose+' plays and pauses');
  }
  for(const level of ['near','mid','far']){await p.selectOption('#lod-select',level);check(await run(p,(w,level)=>w.lod.inspect(w.objects.selected).every(x=>x.level===level),level),backend+' library '+level);}
  await p.selectOption('#lod-select','near');await p.screenshot({path:`${out}/${backend}-library.png`});
  const oldSeed=await run(p,w=>w.objects.selected.userData.seed);await p.locator('#object-regenerate').click();check(await run(p,w=>w.objects.selected.userData.seed)!==oldSeed,backend+' regenerate changes seed');
  await p.selectOption('#object-select','western-gull-male');await p.selectOption('#object-select','southern-sea-otter');await wait(p,()=>window.otterReview.lod.stats(window.otterReview.objects.selected).ready,'reselected LOD');check(await run(p,w=>w.lod.stats(w.objects.selected).near.draws===1),backend+' replacement retains one draw');
  // Actual GLB download: validates the standard library export path, not a custom serializer.
  const downloadPromise=p.waitForEvent('download');await p.locator('#export-object').click();const download=await downloadPromise;const exportPath=`${out}/${backend}-sea-otter.glb`;await download.saveAs(exportPath);const glb=await fs.readFile(exportPath);check(glb.readUInt32LE(0)===0x46546c67&&glb.length>1000,backend+' GLB export succeeds');
  const document=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  check(document.skins?.length===1&&document.skins[0].joints.length===12&&document.skins[0].joints.every(i=>document.nodes[i]?.name?.startsWith('sea-otter-'))&&document.meshes?.length===1&&document.meshes[0].primitives.length===1,backend+' GLB retains twelve joints and one primitive');
  if(backend==='webgl'){
   await p.setViewportSize({width:390,height:844});await p.waitForTimeout(220);check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone layout fits');await p.screenshot({path:`${out}/phone-library.png`});
  }
  await context.close();
 }
 check(!errors.length,'no browser/shader errors');check(JSON.stringify(await hashes())===JSON.stringify(before),'source stable during validation');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-checks.json',JSON.stringify({passed:!failure,failure,checks,errors,records,sourceHashes:before},null,2));await browser.close();}
