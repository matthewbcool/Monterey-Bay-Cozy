import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/gym-shadow-coverage';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});const results=[],errors=[];
try{for(const [backend,tier]of [['webgpu','standard'],['webgl','standard'],['webgl','base']]){
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|validation|wgsl|glsl/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 await page.goto('http://127.0.0.1:5191/?tab=objects'+(backend==='webgl'?'&webgl':''));
 const record=await page.evaluate(async({backend,tier})=>{
  const T=await import('/node_modules/.vite/deps/three_webgpu.js');const {createSunShadows}=await import('/src/viewer/sunShadows.ts');
  const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');const {createToonMaterial}=await import('/src/models/shared/style.ts');
  const r=new T.WebGPURenderer({forceWebGL:backend==='webgl'});r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;await r.init();r.setSize(512,512);r.info.autoReset=false;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.1,3600),sun=new T.DirectionalLight(0xffffff,3),target=new T.RenderTarget(512,512);scene.add(sun,sun.target,new T.HemisphereLight(0xffffff,0x777777,1));
  const shadows=createSunShadows(sun,camera,tier);shadows.update(new T.Vector3(.6,.8,.3).normalize());
  const floor=new T.Mesh(new T.PlaneGeometry(5000,5000),createToonMaterial({color:'#91b688',rim:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const box=new T.Mesh(new T.BoxGeometry(16,30,16),createToonMaterial({color:'#caa77a',rim:false}));box.position.y=15;box.castShadow=true;scene.add(box);applyNodeStyle(scene,false);
  const read=async()=>{await new Promise(requestAnimationFrame);r.setRenderTarget(target);r.info.reset();await r.renderAsync(scene,camera);return new Uint8Array(await r.readRenderTargetPixelsAsync(target,0,0,512,512));};
  const views=[];
  for(const [distance,height]of [[40,12],[78,12],[82,12],[150,90],[354,12],[366,12],[500,180],[900,180]]){
   camera.position.set(0,height,distance);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);box.castShadow=true;await read();await read();const on=await read();const render={...r.info.render};box.castShadow=false;await read();const off=await read();let darker=0,darkness=0;
   for(let i=0;i<on.length;i+=4){const delta=off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2];if(delta>12){darker++;darkness+=delta;}}
   views.push({distance,height,darker,darkness,passes:render.frameCalls,draws:render.drawCalls});
  }
  const snapshot=shadows.getSnapshot();shadows.dispose();target.dispose();floor.geometry.dispose();floor.material.dispose();box.geometry.dispose();box.material.dispose();r.dispose();return{backend,tier,views,snapshot};
 },{backend,tier});
 results.push(record);console.log(JSON.stringify({backend,tier,views:record.views}));for(const v of record.views)assert(v.darker>8,`${backend}/${tier} missing actual shadow pixels at ${v.distance} m`);await page.close();
}assert.deepEqual(errors,[]);}finally{await fs.writeFile(`${out}/pixels.json`,JSON.stringify({results,errors},null,2)+'\n');await browser.close();}
