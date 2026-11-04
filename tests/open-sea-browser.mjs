import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const backend of ['webgpu','webgl'])for(const animal of ['urchin','jelly']){
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:5191/tests/open-sea-review.html?animal=${animal}${backend==='webgl'?'&webgl':''}`);
  const metrics=await page.evaluate(async()=>{const r=await window.faunaReview;return {calls:r.renderer.info.render.drawCalls,triangles:r.renderer.info.render.triangles,native:!!r.renderer.backend.isWebGPUBackend};});
  assert.equal(metrics.native,backend==='webgpu');
  assert.equal(metrics.calls,animal==='urchin'?2:3); // includes node color output
  assert.equal(metrics.triangles,animal==='urchin'?1819:1483);
  for(const pose of ['top','side']){
   await page.evaluate(async pose=>{const r=await window.faunaReview;await r.pose(pose);},pose);
   await page.screenshot({path:`artifacts/open-sea/${animal}-${backend}-${pose}.png`});
  }
  if(animal==='jelly')assert.ok(await page.evaluate(async()=>{const r=await window.faunaReview;const a=r.root.children[0].morphTargetInfluences[0];r.update(.5);await r.pose();return a!==r.root.children[0].morphTargetInfluences[0];}));
  assert.deepEqual(errors,[]);results.push({backend,animal,...metrics});await page.close();
 }
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:320,height:720},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5191/'+(backend==='webgl'?'?webgl':''),{waitUntil:'networkidle'});
  await page.getByRole('tab',{name:'Objects',exact:true}).click();
  await page.selectOption('#object-select','purple-sea-urchin');
  assert.match(await page.locator('#object-stats').innerText(),/1,818/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`artifacts/open-sea/urchin-mobile-${backend}.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 await writeFile('artifacts/open-sea/backend-metrics.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
