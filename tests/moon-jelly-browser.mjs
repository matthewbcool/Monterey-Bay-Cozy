import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),evidence=[];
await mkdir('artifacts/moon-jelly',{recursive:true});
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:5191/tests/open-sea-review.html?animal=jelly${backend==='webgl'?'&webgl':''}`);
  await page.evaluate(async()=>await window.faunaReview);
  for(const [label,angle,phase,caught] of [['relaxed','top',0,false],['contracted','top',Math.PI*.6,false],['slow','oblique',Math.PI*.3,false],['fast','side',Math.PI*.8,false],['caught','underside',0,true]]){
   const result=await page.evaluate(async({angle,phase,caught})=>{
    const r=await window.faunaReview,{applyJellyPose}=await import('/src/models/habitat/moon-jelly/motion.ts');
    applyJellyPose(r.root.children,phase,caught);await r.pose(angle);
    if(angle==='underside'){r.camera.position.set(.3,-.32,.45);r.camera.lookAt(0,0,0);r.renderer.info.reset();await r.renderer.renderAsync(r.scene,r.camera);}
    return {native:!!r.renderer.backend.isWebGPUBackend,drawCalls:r.renderer.info.render.drawCalls,triangles:r.renderer.info.render.triangles,weights:r.root.children.map(m=>m.morphTargetInfluences)};
   },{angle,phase,caught});
   assert.equal(result.native,backend==='webgpu');assert.equal(result.drawCalls,3);assert.equal(result.triangles,1483);assert.deepEqual(result.weights[0],result.weights[1]);
   if(caught)assert.deepEqual(result.weights[0],[1,0]);
   evidence.push({backend,label,...result});await page.screenshot({path:`artifacts/moon-jelly/${backend}-${label}.png`});
  }
  if(backend==='webgpu'){
   const exported=await page.evaluate(async()=>{
    const r=await window.faunaReview,{exportableClone}=await import('/src/models/shared/style.ts'),{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    for(const mesh of r.root.children)mesh.morphTargetInfluences.fill(0);
    const copy=exportableClone(r.root),data=await new GLTFExporter().parseAsync(copy.clone,{binary:true});copy.dispose();
    const loaded=await new GLTFLoader().parseAsync(data,''),meshes=[];loaded.scene.traverse(o=>{if(o.isMesh)meshes.push({opacity:o.material.opacity,transparent:o.material.transparent,targets:o.geometry.morphAttributes.position.length});});
    return {meshes,base64:btoa(Array.from(new Uint8Array(data),b=>String.fromCharCode(b)).join(''))};
   });
   assert.equal(exported.meshes.length,2);assert.ok(exported.meshes.every(m=>m.transparent&&m.targets===2));assert.deepEqual(exported.meshes.map(m=>m.opacity).sort(),[.22,.72]);
   await writeFile('artifacts/open-sea/models/moon-jelly.glb',Buffer.from(exported.base64,'base64'));
  }
  assert.deepEqual(errors,[]);await page.close();
  const live=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'reduce'});live.on('pageerror',e=>errors.push(e.message));
  await live.goto(`http://127.0.0.1:5191/${backend==='webgl'?'?webgl':''}`,{waitUntil:'networkidle'});
  await live.selectOption('#creature-select','moon-jelly');await live.getByRole('button',{name:'Follow fish',exact:true}).click();
  const get=()=>live.evaluate(async()=>{const {viewer:v}=await import('/src/main.ts');return {paused:v.state.paused,phase:v.fish.getState().phase,life:v.fish.getState().lifeState,weights:v.fish.visual.children.map(m=>[...m.morphTargetInfluences]),meshes:v.fish.visual.children.length};});
  assert.equal((await get()).paused,true);assert.equal((await get()).meshes,2);
  for(const mode of ['Slow cruise','Fast swim']){
   await live.getByRole('button',{name:mode,exact:false}).click();await live.getByRole('button',{name:'Play animation',exact:true}).click();
   const before=await get();await live.waitForTimeout(300);const after=await get();assert.notDeepEqual(after.weights,before.weights);
   await live.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await get();await live.waitForTimeout(150);assert.deepEqual((await get()).weights,paused.weights);
  }
  await live.selectOption('#life-state','caught');const dead=await get();assert.deepEqual(dead.weights,[[1,0],[1,0]]);await live.waitForTimeout(100);assert.deepEqual((await get()).weights,dead.weights);
  await live.selectOption('#life-state','alive');
  for(const tier of ['base','standard']){
   await live.selectOption('#quality-select',tier);await live.waitForTimeout(250);
   assert.ok(await live.evaluate(async()=>{const {viewer:v}=await import('/src/main.ts');return v.fish.visual.children.every(m=>m.material.transparent);}));
  }
  await live.selectOption('#quality-select','standard');await live.screenshot({path:`artifacts/moon-jelly/${backend}-tank.png`});
  await live.setViewportSize({width:320,height:740});await live.waitForTimeout(200);assert.ok(await live.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await live.locator('#fish-size').textContent(),/Bell diameter range/);await live.screenshot({path:`artifacts/moon-jelly/${backend}-mobile.png`});
  assert.deepEqual(errors,[]);await live.close();
 }
 await writeFile('artifacts/moon-jelly/browser-metrics.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('PASS: both backends, top/side/underside pulse views, all quality tiers, slow/fast, pause/reduced motion, caught, mobile and translucent two-morph GLB round trip');
}finally{await browser.close();}
