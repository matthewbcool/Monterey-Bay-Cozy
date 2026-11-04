import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='artifacts/gallery-visitors',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[],measurements=[];
function check(ok,label){if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);}
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
async function get(p){return p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return {paused:v.state.paused,time:v.state.simulationTime,poses:v.tank.visitors.people.map(p=>[...p.spine.rotation.toArray(),...p.head.rotation.toArray(),...p.arm.rotation.toArray()]),count:v.tank.visitors.people.length,backend:v.state.backend};});}
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});watch(p);
  await p.goto(`${url}?quality=standard${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  const a=await get(p);await p.waitForTimeout(180);check(a.paused&&JSON.stringify(a.poses)===JSON.stringify((await get(p)).poses),`${backend}: reduced motion starts with still visitors`);
  check(a.count===9&&a.backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),`${backend}: nine visitors on the requested backend`);
  check(await p.locator('#visitor-scale').isVisible()&&(await p.locator('#visitor-scale').textContent()).includes('1.20–1.85'),`${backend}: Whole tank identifies visitor heights`);
  await p.getByRole('button',{name:'Play animation',exact:true}).click();await p.waitForTimeout(700);
  check(JSON.stringify(a.poses)!==JSON.stringify((await get(p)).poses),`${backend}: explicit play starts slow independent idle movement`);
  await p.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await get(p);await p.waitForTimeout(220);
  check(JSON.stringify(paused)===(JSON.stringify(await get(p))),`${backend}: pause freezes visitors and the simulation clock`);
  await p.getByRole('button',{name:'Follow fish',exact:true}).click();check(await p.locator('#visitor-scale').isHidden(),`${backend}: height caption hides with the people in Follow fish`);
  await p.getByRole('button',{name:'Whole tank',exact:true}).click();
  await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.state.running=false;await new Promise(requestAnimationFrame);v.renderer.info.autoReset=false;v.renderer.shadowMap.enabled=false;v.controls.enableDamping=false;});
  for(const quality of ['base','standard']){
   const measured=await p.evaluate(async quality=>{
    const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.setQuality(quality);
    const c=v.tank.visitors;c.root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};
    c.root.visible=true;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};
    return {quality,backend:v.state.backend,drawCalls:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles};
   },quality);measurements.push(measured);check(measured.drawCalls===1&&measured.triangles===2682,`${backend} ${quality}: all nine visitors submit one draw / 2682 triangles`);
   await p.screenshot({path:`${out}/${backend}-${quality}.png`});
  }
  await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.setQuality('standard');v.controls.target.set(-6.4,-3.95,7.2);v.camera.position.set(-6.4,-3.7,14);v.controls.update();v.renderer.render(v.scene,v.camera);});
  await p.screenshot({path:`${out}/${backend}-closeup-rest.png`});const still=await p.locator('canvas').screenshot();
  await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.tank.visitors.update(12);v.renderer.render(v.scene,v.camera);});
  check(!still.equals(await p.locator('canvas').screenshot()),`${backend}: visitor-only idle changes rendered pixels with water and fish frozen`);
  await p.screenshot({path:`${out}/${backend}-closeup-idle.png`});await p.close();
 }
 for(const width of [320,390,700,820]){
  const p=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(p);await p.goto(`${url}?webgl&quality=base`,{waitUntil:'networkidle'});
  check(await p.evaluate(()=>{const a=document.querySelector('#visitor-scale').getBoundingClientRect(),b=document.querySelector('.playback').getBoundingClientRect();return (a.bottom<=b.top||a.right<=b.left||a.left>=b.right||a.top>=b.bottom)&&document.documentElement.scrollWidth<=innerWidth;}),`${width}px: height caption and playback fit without overlap`);
  await p.screenshot({path:`${out}/mobile-${width}.png`});await p.getByRole('button',{name:'Follow fish',exact:true}).tap();check(await p.locator('#visitor-scale').isHidden(),`${width}px: touch hides the reference when following fish`);
  await p.getByRole('button',{name:'Whole tank',exact:true}).tap();check(await p.locator('#visitor-scale').isVisible(),`${width}px: touch restores visitor reference`);await p.close();
 }
 check(errors.length===0,'No browser or shader errors');await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({checks,errors,measurements,date:new Date().toISOString()},null,2)+'\n');
}finally{await browser.close();}
