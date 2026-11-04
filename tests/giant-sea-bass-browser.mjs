import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const folder='artifacts/giant-sea-bass',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
await mkdir(folder,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),evidence=[];
const errors=[];
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1200,height:900}});watch(page);
  await page.goto(`${url}tests/fish-review.html?species=giant-sea-bass${backend==='webgl'?'&webgl':''}`);
  const initial=await page.evaluate(async()=>{const r=await window.fishBackendCheck;
   const {createGiantSeaBassModel}=await import('/src/models/giant-sea-bass/createGiantSeaBassModel.ts');
   r.scene.remove(r.fish[0].root);r.fish[0].dispose();r.fish[0]=createGiantSeaBassModel({seed:42});r.scene.add(r.fish[0].root);const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');applyNodeStyle(r.fish[0].root);return r.result;
  });
  assert.equal(initial.backend,backend==='webgpu'?'WebGPUBackend':'WebGLBackend');
  for(const [state,angle]of [['slow','side'],['slow','oblique'],['fast','side'],['fast','underside'],['caught','oblique'],['caught','far']]){
   const result=await page.evaluate(async([state,angle])=>{const r=await window.fishBackendCheck;await r.pose(state,angle);return {drawCalls:r.renderer.info.render.drawCalls,triangles:r.renderer.info.render.triangles};},[state,angle]);
   assert.equal(result.drawCalls,3);assert.equal(result.triangles,state==='caught'?1993:2181);
   evidence.push({backend,state,angle,modelDraws:2,modelTriangles:state==='caught'?1992:2180,renderer:result});
   await page.screenshot({path:`${folder}/${backend}-${state}-${angle}.png`});
  }
  // Elevated inspection angle supplements the side and underside views.
  await page.evaluate(async()=>{const r=await window.fishBackendCheck;await r.pose('slow','oblique');r.camera.position.set(-2.2,1.4,3);r.camera.lookAt(0,0,0);r.camera.zoom=.90;r.camera.updateProjectionMatrix();await r.render();});
  await page.screenshot({path:`${folder}/${backend}-reference-angle.png`});
  await page.evaluate(async()=>{const r=await window.fishBackendCheck;r.camera.zoom=1;r.camera.updateProjectionMatrix();await r.pose('slow','oblique');});
  const before=await page.screenshot();await page.evaluate(async()=>{const r=await window.fishBackendCheck;for(let i=0;i<8;i++)r.fish[0].update(.1);await r.render();});assert.ok(!before.equals(await page.screenshot()));
  if(backend==='webgpu'){
   const exported=await page.evaluate(async()=>{
    const r=await window.fishBackendCheck,m=r.fish[0];
    const {exportableClone}=await import('/src/models/shared/style.ts'),{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    m.setLifeState('caught');m.setLifeState('alive');m.root.updateMatrixWorld(true);
    const copy=exportableClone(m.root),data=await new GLTFExporter().parseAsync(copy.clone,{binary:true,onlyVisible:true});copy.dispose();
    const loaded=await new GLTFLoader().parseAsync(data,''),meshes=[];
    loaded.scene.traverse(o=>{if(o.isMesh)meshes.push({skinned:!!o.isSkinnedMesh,bones:o.skeleton?.bones.length??0,triangles:o.geometry.index.count/3});});
    return {meshes,bytes:data.byteLength,base64:btoa(Array.from(new Uint8Array(data),b=>String.fromCharCode(b)).join(''))};
   });
   assert.equal(exported.meshes.length,2);assert.ok(exported.meshes.some(m=>m.skinned&&m.bones===6));assert.equal(exported.meshes.reduce((n,m)=>n+m.triangles,0),2180);
   await writeFile(`${folder}/giant-sea-bass.glb`,Buffer.from(exported.base64,'base64'));evidence.push({export:{bytes:exported.bytes,meshes:exported.meshes}});
  }
  await page.close();
  const live=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});watch(live);
  await live.goto(url+(backend==='webgl'?'?webgl':''),{waitUntil:'networkidle'});
  const get=()=>live.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {id:v.state.creatureId,paused:v.state.paused,fish:v.fish.getState(),scale:v.fish.root.scale.toArray(),position:v.fish.root.position.toArray(),size:v.fish.root.userData.lengthMeters,renderer:{...v.renderer.info.render}};});
  assert.equal(await live.locator('#creature-select option').count(),15);
  await live.selectOption('#creature-select','giant-pacific-octopus');await live.locator('canvas').first().focus();await live.keyboard.press('ArrowLeft');assert.equal((await get()).id,'giant-sea-bass');
  await live.keyboard.press('ArrowRight');assert.equal((await get()).id,'giant-pacific-octopus');await live.keyboard.press('ArrowLeft');
  assert.ok((await get()).paused);assert.equal((await get()).size,1.5);assert.deepEqual((await get()).scale,[1,1,1]);
  await live.getByRole('button',{name:'Follow fish',exact:true}).click();assert.match(await live.locator('#fish-size').textContent(),/1–2.3 m/);
  for(const mode of ['Slow cruise','Fast swim']){
   await live.getByRole('button',{name:mode,exact:false}).click();await live.getByRole('button',{name:'Play animation',exact:true}).click();
   const before=await get();await live.waitForTimeout(350);const after=await get();assert.notEqual(after.fish.phase,before.fish.phase);assert.notDeepEqual(after.position,before.position);
   await live.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await get();await live.waitForTimeout(150);assert.equal((await get()).fish.phase,paused.fish.phase);
  }
  await live.selectOption('#life-state','caught');const dead=await get();await live.waitForTimeout(150);assert.equal((await get()).fish.phase,dead.fish.phase);
  assert.ok(await live.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.fish.parts.get('caught-details').visible&&!v.fish.parts.get('head-details').visible;}));
  await live.selectOption('#life-state','alive');
  for(const tier of ['base','standard']){
   await live.selectOption('#quality-select',tier);await live.waitForTimeout(300);evidence.push({backend,tier,sceneRenderer:(await get()).renderer});
   await live.screenshot({path:`${folder}/${backend}-tank-${tier}.png`});
  }
  await live.selectOption('#quality-select','standard');await live.setViewportSize({width:320,height:740});await live.waitForTimeout(250);
  assert.ok(await live.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const fits=await live.evaluate(async()=>{
   const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src),{Vector3}=await import('/node_modules/three/build/three.module.js');
   v.fish.root.updateMatrixWorld(true);v.camera.updateMatrixWorld(true);let outside=0,vertices=0,minY=Infinity,maxY=-Infinity;
   v.fish.root.traverseVisible(o=>{if(o.isMesh)for(let i=0;i<o.geometry.attributes.position.count;i++){
    const p=o.getVertexPosition(i,new Vector3()).applyMatrix4(o.matrixWorld).project(v.camera);vertices++;if(Math.abs(p.x)>.98||Math.abs(p.y)>.98)outside++;
    const y=(1-p.y)*innerHeight/2;minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   }});return {outside,vertices,minY,maxY,controlsBottom:document.querySelector('.camera-controls').getBoundingClientRect().bottom,playTop:document.querySelector('#pause').getBoundingClientRect().top};
  });assert.equal(fits.outside,0,JSON.stringify(fits));assert.ok(fits.minY>fits.controlsBottom&&fits.maxY<fits.playTop,JSON.stringify(fits));
  await live.locator('#fish-size-details summary').click();assert.ok(await live.locator('#fish-size-sources a').count()>0);await live.locator('#fish-size-details summary').click();
  await live.screenshot({path:`${folder}/${backend}-mobile.png`});
  // Verify replaced models release their resources and caught mode persists across arrows.
  await live.selectOption('#life-state','caught');await live.evaluate(async()=>{window.oldBass=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer.fish;});
  await live.locator('canvas').first().focus();await live.keyboard.press('ArrowLeft');assert.equal((await get()).id,'great-white-shark');
  assert.ok(await live.evaluate(()=>window.oldBass.getState().disposed));await live.keyboard.press('ArrowRight');assert.equal((await get()).fish.lifeState,'caught');
  await live.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${folder}/browser-metrics.json`,JSON.stringify({date:new Date().toISOString(),evidence,errors},null,2)+'\n');
 console.log('PASS: sea bass slow/fast/caught and multi-angle views, 2 model draws on both backends, all tiers, 320px framing, arrows, pause/reduced motion, disposal and six-bone GLB round trip');
}finally{await browser.close();}
