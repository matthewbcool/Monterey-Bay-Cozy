import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),evidence=[];
try{
 for(const backend of ['webgpu','webgl']){
  for(const species of ['green-sea-turtle','moon-jelly']){
   const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5191/tests/fish-review.html?species=${species}${backend==='webgl'?'&webgl':''}`);
   await page.evaluate(async()=>await window.fishBackendCheck);
   for(const [state,angle] of [['slow','oblique'],['fast','side'],['caught','underside']]){
    const result=await page.evaluate(async([state,angle])=>{const r=await window.fishBackendCheck;await r.pose(state,angle);return {...r.renderer.info.render};},[state,angle]);
    assert.equal(result.drawCalls,3);evidence.push({backend,species,state,...result});
    await page.screenshot({path:`artifacts/green-sea-turtle/${species}-${backend}-${state}.png`});
   }
   if(species==='green-sea-turtle'){
    await page.evaluate(async()=>{const r=await window.fishBackendCheck;await r.pose('slow','oblique');r.camera.position.set(-.5,5,1.5);r.camera.zoom=.7;r.camera.lookAt(0,0,0);r.camera.updateProjectionMatrix();await r.render();});
    await page.screenshot({path:`artifacts/green-sea-turtle/${species}-${backend}-top.png`});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const get=()=>page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {state:{...v.state},fish:v.fish.getState(),count:v.tank.root.children.length,names:v.tank.root.children.map(o=>o.name),harborUrchins:v.harbor.urchins.batch.count,render:{...v.renderer.info.render}};});
  await page.goto('http://127.0.0.1:5191/'+(backend==='webgl'?'?webgl':''),{waitUntil:'networkidle'});
  assert.equal(await page.locator('#creature-select option').count(),15); // sardine school is a separate group control
  // Size labels, source notes and specimen scale must track every selector entry.
  const ranges=await page.evaluate(async()=>{const {fishCollection}=await import('/src/models/catalogue.ts');const {formatSizeRange}=await import('/src/models/sizeRanges.ts');return fishCollection.map(e=>({id:e.id,label:formatSizeRange(e.sizeRange)}));});
  for(const {id,label} of ranges){
   await page.selectOption('#creature-select',id);assert.equal(await page.locator('#fish-size').textContent(),label);
   await page.locator('#fish-size-details summary').focus();await page.keyboard.press('Space');assert.ok(await page.locator('#fish-size-details').evaluate(e=>e.open));assert.ok(await page.locator('#fish-size-sources a').count()>0);
   assert.match(await page.locator('#fish-model-size').textContent(),/This model/);
   await page.locator('#fish-size-details summary').click();
  }
  for(const species of ['moon-jelly','green-sea-turtle']){
   await page.selectOption('#creature-select',species);await page.getByRole('button',{name:'Follow fish',exact:true}).click();
   assert.equal((await get()).state.creatureId,species);assert.ok((await get()).state.paused);
   await page.screenshot({path:`artifacts/green-sea-turtle/${species}-${backend}-tank.png`});
   await page.locator('canvas').first().focus();await page.keyboard.press('Space');await page.waitForTimeout(300);assert.ok((await get()).fish.phase>0);
   await page.keyboard.press('Space');const phase=(await get()).fish.phase;await page.waitForTimeout(150);assert.equal((await get()).fish.phase,phase);
  }
  const s=await get();assert.ok(s.names.includes('Open Sea water volume')&&s.names.includes('Open Sea gallery')); assert.equal(s.harborUrchins,6);assert.ok(!s.names.some(n=>/urchin|star|jelly|shoal|fish|turtle|ray/.test(n)));
  await page.locator('canvas').first().focus();await page.keyboard.press('ArrowLeft');assert.equal((await get()).state.creatureId,'moon-jelly');await page.keyboard.press('ArrowRight');assert.equal((await get()).state.creatureId,'green-sea-turtle');
  await page.getByRole('tab',{name:'Objects',exact:true}).click();assert.equal(await page.locator('#object-select option[value="moon-jelly"]').count(),0);assert.equal(await page.locator('#object-select option[value="bat-star"]').count(),1);assert.equal(await page.locator('#object-select option[value="purple-sea-urchin"]').count(),1);
  await page.getByRole('tab',{name:'Tank',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:320,height:740});await page.waitForTimeout(200);
  for(const species of ['green-sea-turtle','pacific-sardine']){
   await page.selectOption('#creature-select',species);
   const layout=await page.evaluate(()=>{const panel=document.querySelector('.creature-control').getBoundingClientRect(),camera=document.querySelector('.camera-controls').getBoundingClientRect();return {contained:panel.left<=camera.left&&panel.top<=camera.top&&camera.right<=panel.right&&camera.bottom<=panel.bottom,panelBottom:panel.bottom,playbackTop:document.querySelector('.playback').getBoundingClientRect().top,width:document.documentElement.scrollWidth};});
   assert.ok(layout.contained&&layout.panelBottom<layout.playbackTop,JSON.stringify(layout));assert.ok(layout.width<=320);
   await page.locator('#fish-size-details summary').click();
   const notes=await page.locator('#fish-size-details .size-notes').boundingBox();assert.ok(notes.x>=0&&notes.x+notes.width<=320);
   await page.locator('#fish-size-sources a').first().focus();assert.ok(await page.locator('#fish-size-sources a').first().evaluate(e=>e===document.activeElement));
   await page.locator('#fish-size-details summary').click();
  }
  await page.selectOption('#creature-select','green-sea-turtle');
  await page.screenshot({path:`artifacts/green-sea-turtle/turtle-${backend}-mobile.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 await writeFile('artifacts/green-sea-turtle/browser-metrics.json',JSON.stringify(evidence,null,2)+'\n');console.log('PASS: both creatures, both backends, caught/slow/fast, selector/arrows, reduced motion, 320px layout and sourced size ranges for all species, tank cleanup and habitat placement');
}finally{await browser.close();}
