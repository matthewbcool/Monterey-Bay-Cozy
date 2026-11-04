import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']}),records=[];
const paths=['src/models/habitat/deer/createDeer.ts','src/models/habitat/deer/geometry.ts','src/models/habitat/deer/definition.ts','src/models/habitat/deer/motion.ts','tests/deer-review.ts','tests/deer-auto-lod-browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')]))),before=await hashes();
let failure;
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1100,height:850}});await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191',s=>s.send(JSON.stringify({type:'connected'})));await page.goto('http://127.0.0.1:5191/tests/deer-review.html'+(backend==='webgl'?'?webgl':''));
  let ready=false;for(let i=0;i<250&&!ready;i++){ready=await page.evaluate(()=>!!window.deerReview);if(!ready)await page.waitForTimeout(100);}if(!ready)throw Error('Fixture not ready');
  for(const variant of ['adult','fawn'])for(const [distance,level] of [[3,'near'],[50,'mid'],[180,'far']]){
   const r=await page.evaluate(async({variant,distance})=>{const r=window.deerReview;await r.select(variant);r.pose('walk',.3);r.lod.setMode('auto');r.camera.position.set(0,1,-distance);r.camera.lookAt(0,.7,0);r.camera.updateMatrixWorld(true);return r.render();},{variant,distance});
   if(r.active[0]?.level!==level||r.rendered.draws!==1||r.rendered.triangles!==r.stats[level].triangles)throw Error(backend+' '+variant+' expected '+level);
   records.push({backend,variant,distance,expected:level,...r});console.log('PASS',backend,variant,distance,level);
  }
  await page.close();
 }
 if(JSON.stringify(await hashes())!==JSON.stringify(before))throw Error('Source changed during review');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile('artifacts/deer/automatic-lod.json',JSON.stringify({passed:!failure,failure,records,sourceHashes:before},null,2));await browser.close();}
