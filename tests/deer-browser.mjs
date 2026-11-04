import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='artifacts/deer',checks=[],errors=[],records=[];await fs.mkdir(out,{recursive:true});
const paths=[...(await fs.readdir('src/models/habitat/deer')).filter(p=>p.endsWith('.ts')).map(p=>'src/models/habitat/deer/'+p),'src/viewer/testingGym/deer.ts','src/viewer/testingGym/deerBehavior.ts','src/viewer/avatarWorkbench.ts','src/models/props/catalogue.ts','src/models/props/dimensions.ts','src/data/deer-habitats.json','tests/deer-browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')]))),before=await hashes();
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const run=(p,fn,arg)=>p.evaluate(({fn,arg})=>new Function('r','arg',`return (${fn})(r,arg)`)(window.deerReview,arg),{fn:fn.toString(),arg});
let failure;
async function wait(p,fn,label){for(let i=0;i<800;i++){if(await p.evaluate(fn))return;await p.waitForTimeout(150);}throw Error('Timeout: '+label+' '+errors.slice(-3).join(' | '));}
async function menu(p){if(!await p.locator('#gym-menu').evaluate(e=>e.open))await p.locator('#gym-menu > summary').click();}
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1100,height:850},reducedMotion:'reduce'});await context.route('https://api.weather.gov/**',r=>r.abort());await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191',s=>s.send(JSON.stringify({type:'connected'})));const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|pipeline|validation/i.test(m.text()))errors.push(m.text());});
  const suffix=backend==='webgl'?'?webgl':'';await p.goto('http://127.0.0.1:5191/tests/deer-review.html'+suffix);await wait(p,()=>!!window.deerReview,'asset fixture');
  for(const variant of ['adult','fawn']){
   await run(p,(r,v)=>r.select(v),variant);
   for(const pose of ['idle','walk','gallop','eat'])for(const level of ['near','mid','far']){
    const row=await run(p,async(r,{pose,level})=>{r.pose(pose,.3);r.lod.setMode(level);return r.render();},{pose,level});records.push({backend,variant,pose,level,...row});
    check(row.backend.toLowerCase().includes(backend),backend+' actual backend');check(row.rendered.draws===1&&row.rendered.triangles===row.stats[level].triangles,`${backend} ${variant} ${pose} ${level}: one draw / exact triangles`);
    if(level==='near'||pose==='idle')await p.screenshot({path:`${out}/${backend}-${variant}-${pose}-${level}.png`});
   }
   await run(p,async r=>{r.lod.setMode('near');r.pose('walk',.1);r.frame(true);await r.render();});const a=await p.screenshot();await run(p,async r=>{r.pose('walk',.35);await r.render();});check(!a.equals(await p.screenshot()),backend+' '+variant+' walking pixels move');
   await run(p,async r=>{r.pose('gallop',.17);await r.render();});await p.screenshot({path:`${out}/${backend}-${variant}-gallop-profile.png`});
   await run(p,async r=>{r.pose('eat',.8);await r.render();});await p.screenshot({path:`${out}/${backend}-${variant}-eat-profile.png`});
   for(const distance of [2,22,180]){const auto=await run(p,async(r,d)=>{r.lod.setMode('auto');r.camera.position.set(0,1,-d);r.camera.lookAt(0,.7,0);return r.render();},distance);records.push({backend,variant,distance,automatic:auto.active});}
  }
  await p.goto('http://127.0.0.1:5191/?tab=objects'+(backend==='webgl'?'&webgl':''));
  await wait(p,async()=>{const s=document.querySelector('script[type=module][src*="/src/main.ts"]');if(!s)return false;const{viewer}=await import(s.src);await viewer.started;window.deerReview=viewer;return !!viewer.objects;},'Objects');
  for(const id of ['black-tailed-deer','black-tailed-fawn']){
   await p.selectOption('#object-select',id);await wait(p,()=>window.deerReview.lod.stats(window.deerReview.objects.selected).ready,'object LOD');
   check(await p.locator('#object-pose option').count()===4,backend+' '+id+' four library poses');
   await p.selectOption('#object-pose','eat');check(await run(p,w=>!w.state.objectMotion)&&await p.locator('#object-pose').inputValue()==='eat',backend+' grazing selected and reduced motion paused');
   await p.selectOption('#object-pose','walk');
   const bones=w=>{const b=[];w.objects.selected.traverse(o=>{if(o.isSkinnedMesh)b.push(...o.skeleton.bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]));});return JSON.stringify(b);};
   const before=await run(p,bones);await p.locator('#object-motion').click();await p.waitForTimeout(350);await p.locator('#object-motion').click();const after=await run(p,bones);await p.waitForTimeout(160);
   check(before!==after&&after===await run(p,bones),backend+' library animation plays and pauses');
   await p.selectOption('#lod-select','far');check(await run(p,w=>w.lod.inspect(w.objects.selected).every(x=>x.level==='far')),backend+' library Far selection');
   await p.selectOption('#lod-select','near');await p.screenshot({path:`${out}/${backend}-library-${id}.png`});
  }
  await p.goto('http://127.0.0.1:5191/?tab=gym&whales=hide'+(backend==='webgl'?'&webgl':''));
  await wait(p,async()=>{const s=document.querySelector('script[type=module][src*="/src/main.ts"]');if(!s)return false;const{viewer}=await import(s.src);const w=viewer.avatarWorkbench;if(!w?.getSnapshot().gymReady)return false;window.deerReview=w;return !!w.deer;},'Gym');
  if(backend==='webgl')await p.setViewportSize({width:390,height:844});
  check(await run(p,w=>w.deer.stats().count===6),'six deer in three families');
  await menu(p);await p.selectOption('#gym-deer-place','caledonia');await p.waitForTimeout(300);
  check(await run(p,w=>!w.getSnapshot().overview&&w.getSnapshot().destination==='caledonia-park'),backend+' Caledonia encounter is walkable');
  const initial=await run(p,w=>w.deer.stats());await p.screenshot({path:`${out}/${backend}-caledonia.png`});await p.locator('#gym-viewport canvas').focus();await p.keyboard.down('w');await p.waitForTimeout(4200);await p.keyboard.up('w');
  const after=await run(p,w=>w.deer.stats());check(after.groups[0].alerts>initial.groups[0].alerts,backend+' real keyboard approach startles family');check(after.groups[0].members.some((m,i)=>Math.hypot(m.position[0]-initial.groups[0].members[i].position[0],m.position[2]-initial.groups[0].members[i].position[2])>.5),backend+' family actually retreats with reduced motion');await p.screenshot({path:`${out}/${backend}-retreat.png`});
  for(const id of ['pacific-grove-golf-links','del-monte-golf-course']){await menu(p);await p.selectOption('#gym-deer-place',id);await p.waitForTimeout(250);const row=await run(p,w=>({snapshot:w.getSnapshot(),cost:w.lod.stats(w.deer.root)}));check(row.snapshot.deerViewId===id&&row.snapshot.bay.regionalWaterVisible,backend+' '+id+' terrain and deer view');check(row.snapshot.deer.active===2,backend+' only nearby family active');records.push({backend,site:id,...row});await p.screenshot({path:`${out}/${backend}-${id}.png`});}
  await menu(p);await p.locator('#gym-bay-overview').click();await p.waitForTimeout(100);check(await run(p,w=>w.deer.stats().active===0),backend+' whole-bay view sleeps tiny deer');
  if(backend==='webgl'){check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone layout fits');await p.screenshot({path:out+'/phone-bay.png'});}
  await context.close();
 }
 check(!errors.length,'no browser/shader errors');check(JSON.stringify(await hashes())===JSON.stringify(before),'source stable during validation');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-checks.json',JSON.stringify({passed:!failure,failure,checks,errors,records,sourceHashes:before},null,2));await browser.close();}
