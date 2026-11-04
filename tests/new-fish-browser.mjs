import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[],backends=[];
const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);console.log('PASS',label);};
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
const page=await browser.newPage({viewport:{width:1440,height:1000}});watch(page);
const get=()=>page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {id:v.state.creatureId,paused:v.state.paused,fish:v.fish.getState(),position:v.fish.root.position.toArray(),cameraDistance:v.camera.position.distanceTo(v.controls.target),scale:v.fish.root.scale.toArray(),render:{...v.renderer.info.render}};});
try{
  await page.goto(url,{waitUntil:'networkidle'});await get();
  assert(await page.locator('#creature-select option').count()===14,'All fourteen creatures available');
  await page.getByRole('button',{name:'Follow fish',exact:true}).click();
  const tunaDistance=(await get()).cameraDistance;
  for(const id of ['pacific-sardine','blue-rockfish']){
    await page.selectOption('#creature-select',id);await page.waitForTimeout(150);
    if(id==='pacific-sardine')await page.selectOption('#school-count','0');
    assert((await get()).id===id,`${id}: selector loads model`);
    assert((await get()).cameraDistance<tunaDistance*.4,`${id}: camera frames actual small size`);
    assert((await get()).scale.every(n=>n===1),`${id}: viewer preserves metre scale`);
    await page.getByRole('button',{name:'Pause animation',exact:true}).click();
    for(const mode of ['slow','fast','caught']){
      if(mode==='caught')await page.getByLabel('State',{exact:true}).selectOption('caught');
      else{
        await page.getByRole('button',{name:mode==='fast'?'Fast swim':'Slow cruise',exact:false}).click();
        await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(1450);
        await page.getByRole('button',{name:'Pause animation',exact:true}).click();
      }
      const state=await get();assert(state.fish.lifeState===(mode==='caught'?'caught':'alive'),`${id}: ${mode} state`);
      if(mode==='fast')assert(state.fish.blend>.99&&state.fish.finExtension>.7,`${id}: fast fins stay visible`);
      for(const angle of ['side','underside']){
        await page.evaluate(async({angle})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const l=v.fish.root.userData.lengthMeters;v.fish.root.position.set(0,0,0);v.fish.root.quaternion.identity();v.controls.maxPolarAngle=Math.PI-.1;v.controls.target.set(0,0,0);v.camera.position.set(l*.20,l*(angle==='side'?.05:-1.15),l*2.05);v.camera.lookAt(v.controls.target);v.controls.update();},{angle});
        await page.waitForTimeout(150);await page.screenshot({path:`artifacts/${id}/${mode}-${angle}.png`});
      }
    }
    await page.getByRole('button',{name:'Play animation',exact:true}).click();const before=await get();await page.waitForTimeout(300);const after=await get();
    assert(before.fish.phase===after.fish.phase&&JSON.stringify(before.position)===JSON.stringify(after.position),`${id}: caught freezes pose and travel`);
    await page.getByLabel('State',{exact:true}).selectOption('alive');await page.waitForTimeout(300);
    assert((await get()).fish.phase!==after.fish.phase,`${id}: swimming resumes`);
  }
  // A caught variant and pause preference survive replacing the model.
  await page.getByLabel('State',{exact:true}).selectOption('caught');await page.selectOption('#creature-select','pacific-sardine');
  assert((await get()).fish.lifeState==='caught', 'Caught state survives species switching');
  await page.selectOption('#creature-select','tuna');assert((await get()).id==='tuna','Tuna remains selectable');
  for(const width of [390,320]){
    const mobile=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);await mobile.goto(url,{waitUntil:'networkidle'});
    await mobile.selectOption('#creature-select','blue-rockfish');await mobile.getByRole('button',{name:'Follow fish',exact:true}).tap();
    assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px: no overflow`);
    assert(await mobile.evaluate(()=>{const a=document.querySelector('.creature-control').getBoundingClientRect(),b=document.querySelector('.camera-controls').getBoundingClientRect();return a.left<=b.left&&a.top<=b.top&&b.right<=a.right&&b.bottom<=a.bottom;}),`${width}px: camera buttons stay inside the creature panel`);
    assert(await mobile.getByRole('button',{name:'Play animation',exact:true}).isVisible(),`${width}px: reduced motion remains paused`);
    await mobile.getByLabel('State',{exact:true}).selectOption('caught');await mobile.screenshot({path:`artifacts/blue-rockfish/mobile-${width}.png`});await mobile.close();
  }
  for(const mode of ['webgpu','webgl','compare']){
    const p=await browser.newPage({viewport:{width:1100,height:900}});watch(p);await p.goto(url+'tests/fish-review.html'+(mode==='webgpu'?'':`?${mode}`));
    const result=await p.evaluate(async()=>(await window.fishBackendCheck).result);backends.push(result);
    if(mode!=='compare')assert(result.backend===(mode==='webgpu'?'WebGPUBackend':'WebGLBackend'),`${mode}: new rigs render on requested backend`);
    await p.screenshot({path:`artifacts/fish-collection/${mode==='compare'?'scale-comparison':mode+'-fast'}.png`});
    if(mode!=='compare'){await p.evaluate(async()=>{await (await window.fishBackendCheck).pose('caught');});await p.screenshot({path:`artifacts/fish-collection/${mode}-caught.png`});}
    await p.evaluate(async()=>{(await window.fishBackendCheck).dispose();});await p.close();
  }
  assert(errors.length===0,'No browser or shader errors');
  await fs.writeFile('artifacts/fish-collection/browser-qa.json',JSON.stringify({date:new Date().toISOString(),checks,errors,backends},null,2)+'\n');
}finally{await browser.close();}
