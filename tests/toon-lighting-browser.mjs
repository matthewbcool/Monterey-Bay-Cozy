import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out='artifacts/camera-lighting-trees';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const results=[],errors=[];
try { for(const forceWebGL of [false,true]) {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/lighting-probe.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto(url+'lighting-probe.html');
 const result=await page.evaluate(async forceWebGL=>{
  const T=await import('/node_modules/.vite/deps/three_webgpu.js');
  const {stabilizeToonLighting}=await import('/src/viewer/toonLighting.ts');
  const {createToonMaterial}=await import('/src/models/shared/style.ts');
  const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');
  const renderer=new T.WebGPURenderer({forceWebGL,antialias:false});await renderer.init();renderer.setSize(128,128);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,50),light=new T.DirectionalLight(0xffffff,Math.PI);light.position.set(4,8,2);scene.add(light);
  const target=new T.RenderTarget(128,128),geometry=new T.PlaneGeometry(4,4),matrix=new T.Matrix4().makeRotationX(-Math.PI/2);
  const render=async()=>{scene.updateMatrixWorld(true);renderer.setRenderTarget(target);await renderer.renderAsync(scene,camera);return Array.from(await renderer.readRenderTargetPixelsAsync(target,63,63,1,1)).slice(0,3);};
  const series=async(mesh)=>{scene.add(mesh);const pixels=[];for(const a of [0,.8,1.6,2.4,3.2,4,4.8,5.6]){camera.position.set(Math.sin(a)*6,5,Math.cos(a)*6);camera.lookAt(0,0,0);pixels.push(await render());}scene.remove(mesh);return {pixels,spread:Math.max(...pixels.map(p=>p[0]))-Math.min(...pixels.map(p=>p[0]))};};
  const stock=new T.MeshToonNodeMaterial({color:0xa9bf8a}),fixed=new T.MeshToonNodeMaterial({color:0xa9bf8a});stabilizeToonLighting(fixed);
  const mesh=new T.Mesh(geometry,stock);mesh.rotation.x=-Math.PI/2;const negative=await series(mesh);mesh.material=fixed;const positive=await series(mesh);
  const instances=new T.InstancedMesh(geometry,fixed,1);instances.setMatrixAt(0,matrix.multiply(new T.Matrix4().makeScale(1.3,.7,1)));instances.instanceMatrix.needsUpdate=true;const instanced=await series(instances);
  light.position.set(4,-8,2);const dark=await series(mesh);light.position.set(4,8,2);
  const descriptor=createToonMaterial({color:0xa9bf8a,rim:false}),styled=new T.Mesh(geometry,descriptor);styled.rotation.x=-Math.PI/2;applyNodeStyle(styled,false);const gradient=await series(styled);
  const backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL 2';target.dispose();geometry.dispose();stock.dispose();fixed.dispose();styled.material.dispose();renderer.dispose();return {backend,negative,positive,instanced,dark,gradient};
 },forceWebGL);
 if(result.negative.spread<10)throw Error('Negative control did not reproduce camera defect');
 for(const key of ['positive','instanced','gradient'])if(result[key].spread>2)throw Error(`${result.backend} ${key}: camera moved diffuse band`);
 if(result.positive.pixels[0][0]-result.dark.pixels[0][0]<10)throw Error('Sun no longer changes illumination');
 results.push(result);console.log('PASS',result.backend,JSON.stringify(result));await page.close();
 } if(errors.length)throw Error(errors.join('\n'));
}finally{await fs.writeFile(out+'/toon-lighting.json',JSON.stringify({results,errors},null,2)+'\n');await browser.close();}
