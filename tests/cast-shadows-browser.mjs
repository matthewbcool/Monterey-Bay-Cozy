import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/cast-shadows';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const results=[],errors=[];
try{for(const webgl of [false,true]){
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::'))errors.push(m.text())});
 await page.goto('http://127.0.0.1:5191/?quality=standard'+(webgl?'&webgl':''));
 await page.waitForFunction(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;window.qaViewer=v;return v.renderer.info.render.drawCalls>0});
 // A fixed receiver and caster, with identical camera/time, prove actual shadow pixels
 // rather than merely checking castShadow flags. Test the real tank receiver too.
 const pixels=await page.evaluate(async(webgl)=>{
  const T=await import('/node_modules/.vite/deps/three_webgpu.js');
  const {createTankWater}=await import('/src/viewer/openSea/waterLook.ts');
  const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');
  const {createToonMaterial}=await import('/src/models/shared/style.ts');
  const r=new T.WebGPURenderer({forceWebGL:webgl});r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;await r.init();r.setSize(256,256);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,50),target=new T.RenderTarget(256,256);
  camera.position.set(6,8,9);camera.lookAt(0,0,0);
  const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-6,8,-4);sun.castShadow=true;sun.shadow.camera.left=sun.shadow.camera.bottom=-8;sun.shadow.camera.top=sun.shadow.camera.right=8;sun.shadow.camera.far=30;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.02;
  scene.add(sun,new T.HemisphereLight(0xffffff,0x777777,1));
  const box=new T.Mesh(new T.BoxGeometry(1.5,2,1.5),createToonMaterial({color:'#caa77a',rim:false}));box.position.y=1;box.castShadow=box.receiveShadow=true;scene.add(box);
  const floor=new T.Mesh(new T.PlaneGeometry(16,16),createToonMaterial({color:'#91b688',rim:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);applyNodeStyle(scene,false);
  const read=async()=>{await new Promise(requestAnimationFrame);r.setRenderTarget(target);await r.renderAsync(scene,camera);return new Uint8Array(await r.readRenderTargetPixelsAsync(target,0,0,256,256));};
  const compare=async()=>{box.castShadow=true;await read();await read();const on=await read();box.castShadow=false;await read();const off=await read();let changed=0,darker=0;for(let i=0;i<on.length;i+=4){if(Math.abs(on[i]-off[i])>3){changed++;if(on[i]<off[i])darker++;}}return {changed,darker,max:Math.max(...on.filter((_,i)=>i%4===0)),sample:Array.from(on.slice(131584,131600))};};
  const type=floor.material.type;const toon=await compare();floor.material=new T.MeshLambertNodeMaterial({color:0x91b688});const lambert=await compare();r.setRenderTarget(null);box.castShadow=true;await r.renderAsync(scene,camera);const screenshot=r.domElement.toDataURL();scene.remove(floor);
  const tank=createTankWater(16,10,16);tank.root.position.y=0;scene.add(tank.root);tank.setShadowLight(sun);box.position.y=-4;camera.position.set(6,2,7);camera.lookAt(0,-5,0);
  const water=await compare();tank.dispose();target.dispose();sun.shadow.dispose();r.dispose();return {toon,water,screenshot,type,lambert};
 },webgl);
 await fs.writeFile(`${out}/probe-${webgl}.png`,Buffer.from(pixels.screenshot.split(',')[1],'base64'));delete pixels.screenshot;
 console.log('PIXELS',JSON.stringify(pixels));assert(pixels.toon.darker>100&&pixels.water.darker>100,JSON.stringify(pixels));
 const v=()=>page.evaluate(()=>qaViewer.state.backend);const backend=await v();assert.equal(backend,webgl?'WebGL 2':'WebGPU');
 await page.getByRole('tab',{name:'Objects',exact:true}).click();await page.selectOption('#object-select','rowboat');await page.waitForTimeout(500);await page.screenshot({path:`${out}/${backend}-objects.png`});
 await page.getByRole('tab',{name:'Avatars',exact:true}).click();await page.waitForFunction(()=>qaViewer.avatarWorkbench?.getSnapshot().frameCount>2);await page.waitForTimeout(500);await page.screenshot({path:`${out}/${backend}-avatar.png`});
 await page.getByRole('tab',{name:'Testing Gym',exact:true}).click();await page.waitForFunction(()=>qaViewer.avatarWorkbench?.getSnapshot().gymReady,{timeout:60000});
 await page.locator('#gym-menu > summary').click();await page.locator('.gym-weather > summary').click();await page.selectOption('#gym-weather-mode','clear');await page.selectOption('#gym-weather-clock','preview');await page.fill('#gym-weather-date','2026-10-24T14:00');await page.locator('#gym-weather-date').dispatchEvent('change');await page.waitForTimeout(1200);
 await page.locator('#gym-menu summary').first().click();
 const gym=await page.evaluate(()=>{const w=qaViewer.avatarWorkbench;return {groundReceives:(()=>{let yes=false;w.scene.traverse(o=>{if(o.userData.singleGroundSurface)yes=o.receiveShadow});return yes})(),enabled:w.renderer.shadowMap.enabled,sun:w.weather.sun.castShadow,shadows:w.weather.shadows.getSnapshot(),draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles}});
 assert(gym.enabled&&gym.sun&&gym.shadows.maps.filter(s=>s.allocated).length===3&&gym.groundReceives,JSON.stringify(gym));await page.screenshot({path:`${out}/${backend}-gym.png`});
 results.push({backend,pixels,gym});console.log('PASS',JSON.stringify(results.at(-1)));await page.close();
}assert.deepEqual(errors,[]);}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({results,errors},null,2)+'\n');await browser.close();}
