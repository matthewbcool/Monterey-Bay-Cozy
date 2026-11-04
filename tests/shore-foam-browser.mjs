import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.ARTIFACT_DIR??'artifacts/shore-foam';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],results=[];
try{for(const backend of ['webgpu','webgl']){
 const page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'});
 await page.route('https://api.weather.gov/**',r=>r.abort());
 await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});page.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|pipeline|validation/i.test(m.text()))errors.push(m.text());});
 console.log('OPEN',backend);await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide${backend==='webgl'?'&webgl':''}`);
 console.log('LOADED',backend);const deadline=Date.now()+120000;
 while(!await page.evaluate(async()=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench;if(!w?.getSnapshot().gymReady)return false;window.foamW=w;return true;})){assert(Date.now()<deadline);await page.waitForTimeout(250);}
 console.log('READY',backend);
 const setup=await page.evaluate(async()=>{const w=window.foamW;window.foamScene=w.scene;w.setActive(null);await w.lod.ready();w.lod.setMode('near');w.camera.position.set(90,25,15);w.camera.lookAt(58,1,-15);w.camera.updateMatrixWorld(true);w.gym.water.uniforms.lightLevel.value=1;
 const f=w.gym.root.getObjectByName('Shore foam · advancing and retreating');window.foamMesh=f;
 return {backend:w.getSnapshot().backend,triangles:f.geometry.index.count/3,draws:1,time:w.gym.water.uniforms.time.value};});
 console.log('SETUP',JSON.stringify(setup));
 assert.equal(setup.backend,backend==='webgl'?'WebGL 2':'WebGPU');assert(setup.triangles<5000);
 for(const time of [0,2,4,6]){console.log('FRAME',backend,time);await page.evaluate(async time=>{const w=window.foamW;w.gym.water.update(time);await w.renderer.renderAsync(window.foamScene,w.camera);},time);await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-${time}.png`});}
 // Isolate the actual material for pixel evidence of a moving edge, independent of water glints.
 const pixels=await page.evaluate(async()=>{const w=window.foamW,T=await import('/node_modules/.vite/deps/three_webgpu.js');const mesh=window.foamMesh,parent=mesh.parent,scene=new T.Scene();scene.background=new T.Color(0);scene.add(mesh);const target=new T.RenderTarget(256,256),oldAspect=w.camera.aspect;w.camera.aspect=1;w.camera.updateProjectionMatrix();const frames=[];
 for(const time of [0,2,4,6]){w.gym.water.update(time);w.renderer.setRenderTarget(target);await w.renderer.renderAsync(scene,w.camera);const data=new Uint8Array(await w.renderer.readRenderTargetPixelsAsync(target,0,0,256,256));frames.push(data);}
 const counts=frames.map(a=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]>20)n++;return n;});let changed=0;for(let i=0;i<frames[0].length;i+=4)if(Math.abs(frames[0][i]-frames[1][i])>15)changed++;
 parent.add(mesh);w.renderer.setRenderTarget(null);w.camera.aspect=oldAspect;w.camera.updateProjectionMatrix();target.dispose();return {counts,changed};});
 assert(pixels.counts.every(n=>n>20),'Foam visible at each phase');assert(pixels.changed>30,'Foam changes across the wash cycle');
 results.push({backend,...setup,...pixels});console.log('PASS',backend,JSON.stringify(pixels));await page.close();
}assert.deepEqual(errors,[]);await fs.writeFile(`${out}/metrics.json`,JSON.stringify({results,errors},null,2));}finally{await browser.close();}
