import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/asset-catalog-audit';await fs.mkdir(out,{recursive:true});
const ids=['park-bench','park-litter-bin','cafe-chair','cafe-table','cafe-parasol','aggregating-anemone'];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const records=[],errors=[];
try{for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1280,height:900}});p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error'&&/shader|validation|wgsl|glsl/i.test(m.text()))errors.push(m.text());});
 await p.route('https://api.weather.gov/**',r=>r.abort());await p.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 await p.goto('http://127.0.0.1:5191/?tab=objects'+(backend==='webgl'?'&webgl':''));
 await p.evaluate(async()=>{window.auditViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await auditViewer.started;});
 assert.equal(await p.locator('#object-select optgroup[label="Furniture"] option').count(),5);
 for(const id of ids){
  await p.selectOption('#object-select',id);
  const result=await p.evaluate(async id=>{const v=auditViewer,r=v.objects.selected;await v.lod.register(r);const levels=[];for(const level of ['near','mid','far']){v.setLodMode(level);await v.renderer.compileAsync(v.scene,v.camera);await new Promise(requestAnimationFrame);levels.push({level,stats:v.lod.stats(r)});}v.setLodMode('near');return{id,backend:v.state.backend,assetId:r.userData.assetId,levels};},id);
  assert.equal(result.backend,backend==='webgpu'?'WebGPU':'WebGL 2');assert.equal(result.assetId,id);assert(result.levels.every(l=>l.stats.near.draws===1&&l.stats.far.draws===1));records.push(result);
  await p.waitForTimeout(120);await p.screenshot({path:`${out}/${backend}-${id}.png`});console.log('PASS',backend,id,'all LODs');
 }
 await p.locator('#tab-gym').click();await p.waitForFunction(()=>document.querySelector('#panel-gym')?.dataset.gymLoad==='ready',null,{timeout:120000});
 const gym=await p.evaluate(async()=>{const w=auditViewer.avatarWorkbench;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));w.camera.position.set(-21,20,72);w.camera.lookAt(14,10,78);w.camera.updateMatrixWorld();await w.renderer.renderAsync(w.scene,w.camera);return w.lod.stats(w.gym.root);});records.push({backend,gym});await p.screenshot({path:`${out}/${backend}-gym-cafe.png`});await p.close();
}
assert.deepEqual(errors,[]);
}finally{await fs.writeFile(`${out}/browser.json`,JSON.stringify({records,errors},null,2));await browser.close();}
