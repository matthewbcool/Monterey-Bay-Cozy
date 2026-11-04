import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/gym-butterfly-statue';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']}),checks=[],errors=[],records=[];
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
try{
 for(const backend of ['webgpu','webgl']){
  const c=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await c.route('https://api.weather.gov/**',r=>r.abort());
  await c.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:5191/?tab=gym${backend==='webgl'?'&webgl':''}`);
  await p.waitForSelector('#gym-overview',{state:'attached',timeout:45000});
  await p.evaluate(async()=>{window.v=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await window.v.started;});
  await p.waitForFunction(()=>window.v.avatarWorkbench?.getSnapshot().gymReady,null,{timeout:90000});
  await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').click();
  await p.selectOption('#gym-weather-clock','preview');await p.locator('#gym-weather-date').fill('2026-10-23T12:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.selectOption('#gym-weather-mode','clear');await p.locator('#gym-menu > summary').click();await p.waitForTimeout(150);
  await p.evaluate(()=>{const w=window.v.avatarWorkbench;window.gymScene=w.scene;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));const a=w.gym.statues.find(s=>s.record.id==='butterfly-statue').position;w.camera.position.set(a.x+3,a.y+2.4,a.z+4);w.camera.lookAt(a.x,a.y+1.3,a.z);w.camera.near=.02;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);w.gym.update(0);});
  for(const level of ['near','mid','far']){
   const row=await p.evaluate(async level=>{const w=window.v.avatarWorkbench,b=w.gym.butterflies;w.lod.setMode(level);w.lod.update(w.camera,900,0,true);await w.renderer.compileAsync(window.gymScene,w.camera);await new Promise(requestAnimationFrame);w.renderer.render(window.gymScene,w.camera);w.renderer.info.autoReset=false;w.renderer.info.reset();w.renderer.render(window.gymScene,w.camera);const full={...w.renderer.info.render};b.root.visible=false;w.renderer.info.reset();w.renderer.render(window.gymScene,w.camera);const empty={...w.renderer.info.render};b.root.visible=true;w.renderer.render(window.gymScene,w.camera);return {level,stats:w.lod.stats(b.root),draws:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles,count:b.batch.count};},level);
   records.push({backend,...row});check(row.count===6&&row.draws===1&&row.triangles===({near:5472,mid:3360,far:1272}[level]),`${backend} six ${level} monarchs submit one draw`);
   await p.screenshot({path:`${out}/${backend}-${level}.png`});
  }
  const proximity=await p.evaluate(()=>{const w=window.v.avatarWorkbench,b=w.gym.butterflies,a=w.gym.statues.find(s=>s.record.id==='butterfly-statue').position,m=b.root.matrix.clone(),p=a.clone(),distances=[];for(let i=0;i<b.batch.count;i++){b.batch.getTransformAt(i,m);p.setFromMatrixPosition(m).add(b.root.position);distances.push(Math.hypot(p.x-a.x,p.z-a.z));}return distances;});
  check(proximity.length===6&&proximity.every(d=>d<3&&d>.68),`${backend} all six butterflies stay beside the statue`);records.push({backend,statueDistances:proximity});
  const before=await p.evaluate(()=>Array.from(window.v.avatarWorkbench.gym.butterflies.batch.mesh.instanceMatrix.array));
  await p.evaluate(()=>{const w=window.v.avatarWorkbench;w.gym.update(1);w.renderer.render(window.gymScene,w.camera);});
  check(JSON.stringify(before)!==JSON.stringify(await p.evaluate(()=>Array.from(window.v.avatarWorkbench.gym.butterflies.batch.mesh.instanceMatrix.array))),`${backend} butterflies travel gently`);
  await p.evaluate(()=>{const w=window.v.avatarWorkbench;w.lod.setMode('auto');w.camera.position.set(30,80,100);w.camera.lookAt(25,8,-40);w.camera.updateMatrixWorld(true);w.lod.update(w.camera,900,0,true);});
  check(await p.evaluate(()=>window.v.avatarWorkbench.lod.inspect(window.v.avatarWorkbench.gym.butterflies.root)[0].level==='far'),`${backend} distant butterflies use Far`);
  await c.close();
 }
 check(errors.length===0,'No page errors');
}finally{await fs.writeFile(`${out}/browser-metrics.json`,JSON.stringify({checks,errors,records},null,2)+'\n');await browser.close();}
