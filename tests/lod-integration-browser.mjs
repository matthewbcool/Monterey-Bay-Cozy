import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']}),checks=[],errors=[],records=[];
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${url}?tab=objects&quality=standard${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  await p.selectOption('#object-select','giant-kelp');await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;await v.lod.ready();});
  await p.selectOption('#lod-select','far');
  const selected=await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {id:v.state.objectId,seed:v.objects.selected.userData.seed,stats:v.lod.stats(v.objects.selected).far};});
  check(selected.id==='giant-kelp'&&Number.isFinite(selected.seed),backend+' exports the selected seeded kelp');
  const download=p.waitForEvent('download');await p.locator('#export-object').click();const file=await download;const path=`artifacts/lod/${backend}-kelp-far.glb`;await file.saveAs(path);
  const bytes=await fs.readFile(path),exported=await p.evaluate(async bytes=>{const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const {modelStats}=await import('/src/viewer/modelStats.ts');const gltf=await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer,'');return {root:gltf.scene.children[0].userData,stats:modelStats(gltf.scene).model};},[...bytes]);
  check(exported.root.seed===selected.seed&&exported.root.lod==='far',backend+' export preserves displayed seed and detail');check(exported.stats.triangles===selected.stats.triangles,backend+' exported triangle count matches Far');records.push({backend,selected,exported});
  await p.locator('#tab-map').click();await p.locator('#map-lod').waitFor();
  for(const level of ['near','mid','far','auto']){await p.selectOption('#map-lod',level);await p.screenshot({path:`artifacts/lod/${backend}-map-${level}.png`});}
  await p.locator('.aquarium-entry').click();await p.selectOption('#map-lod','far');await p.screenshot({path:`artifacts/lod/${backend}-interior-far.png`});
  check(await p.locator('.aquarium-tools').isVisible(),backend+' interior remains inspectable with LOD');await p.close();
 }
 const p=await browser.newPage({viewport:{width:320,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 await p.goto(url+'?webgl',{waitUntil:'networkidle'});await p.locator('#view-follow').click();await p.selectOption('#lod-select','mid');await p.locator('.lod-control summary').click();
 check(await p.locator('#lod-variants tr').count()===3,'320px library displays all three variant costs');
 check(await p.evaluate(()=>{const r=document.querySelector('.lod-control').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight-70;}),'Expanded mobile LOD panel stays in view');
 await p.screenshot({path:'artifacts/lod/mobile-320-lod-panel.png'});await p.close();check(errors.length===0,'No map/export errors');
}finally{await fs.writeFile('artifacts/lod/integration-metrics.json',JSON.stringify({checks,errors,records},null,2));await browser.close();}
console.log(`PASS ${checks.length} LOD integration checks`);
