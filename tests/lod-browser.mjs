import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='artifacts/lod',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],checks=[],assets=[],scenes=[];
function check(ok,message){if(!ok)throw Error(message);checks.push(message);}
const run=(page,fn,arg)=>page.evaluate(async({fn,arg})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return (new Function('v','arg',`return (${fn})(v,arg)`))(v,arg);},{fn:fn.toString(),arg});
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(backend+': '+e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&!m.text().includes('renderAsync'))errors.push(backend+': '+m.text());});
  await page.goto(`${url}?quality=standard${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  await run(page,async v=>{v.state.running=false;await new Promise(requestAnimationFrame);v.controls.enableDamping=false;v.renderer.shadowMap.enabled=false;v.renderer.info.autoReset=false;});
  check((await page.locator('#quality-select option').allTextContents()).join(',')==='Base,Standard',backend+' removes High selector');
  check(await run(page,v=>!('post' in v)&&!('outlines' in v)&&v.state.backend===(location.search.includes('webgl')?'WebGL 2':'WebGPU')),backend+' has no High rendering hooks');
  for(const type of ['fish','object']){
   await page.locator(type==='fish'?'#tab-tank':'#tab-objects').click();
   const selector=type==='fish'?'#creature-select':'#object-select',ids=await page.locator(selector+' option').evaluateAll(os=>os.map(o=>o.value));
   for(const id of ids){
    await page.selectOption(selector,id);
    await run(page,async(v,type)=>{if(type==='fish'){if(v.state.creatureId==='pacific-sardine')v.setSchoolCount(0);v.setView('follow');}await v.lod.ready();},type);
    const variantStats=await run(page,(v,type)=>v.lod.stats(type==='fish'?v.fish.root:v.objects.selected),type);
    check(variantStats.far.triangles<variantStats.near.triangles*.7,`${backend} ${id}: far reduction`);
    const levels=[];
    for(const level of ['near','mid','far']){
     await page.selectOption('#lod-select',level);
     const measurement=await run(page,(v,{type,level})=>{
      const root=type==='fish'?v.fish.root:v.objects.selected;
      v.lod.update(v.camera,900,0,true);v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};
      root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};root.visible=true;v.renderer.render(v.scene,v.camera);
      return {level,draws:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles,active:v.lod.inspect(root).filter(m=>m.level===level).length};
     },{type,level});
     check(measurement.active>0&&measurement.triangles>0,`${backend} ${id}: ${level} renders`);levels.push(measurement);
     if(backend==='webgpu')await page.screenshot({path:`${out}/${id}-${level}.png`});
    }
    check(levels[2].triangles<levels[0].triangles&&levels[2].draws<=levels[0].draws,`${backend} ${id}: real GPU submissions reduce`);
    if(type==='fish'){
     for(const mode of ['slow','fast']){
      await run(page,(v,mode)=>{v.fish.setSwimMode(mode,true);for(let i=0;i<7;i++)v.fish.update(.07);v.renderer.render(v.scene,v.camera);},mode);
      const before=await page.locator('#stage canvas').screenshot();
      await run(page,v=>{for(let i=0;i<7;i++)v.fish.update(.07);v.renderer.render(v.scene,v.camera);});
      check(!before.equals(await page.locator('#stage canvas').screenshot()),`${backend} ${id}: ${mode} moves at Far`);
     }
     await page.selectOption('#life-state','caught');await run(page,v=>{v.lod.update(v.camera,900,0,true);v.renderer.render(v.scene,v.camera);});
     if(backend==='webgpu')await page.screenshot({path:`${out}/${id}-caught-far.png`});await page.selectOption('#life-state','alive');
    }
    assets.push({backend,id,type,...variantStats,submitted:levels});
   }
  }
  // School morph texture, caught state and one/many-instance shader path at reduced detail.
  await page.locator('#tab-tank').click();await page.selectOption('#creature-select','pacific-sardine');
  for(const count of [16,48,256]){
   await page.selectOption('#school-count',String(count));await run(page,async v=>{await v.lod.ready();v.setLodMode('far');v.fish.update(.05);v.renderer.render(v.scene,v.camera);});
   check(await run(page,v=>v.lod.stats(v.fish.root).far.draws===1),`${backend}: ${count} sardines stay one draw`);
  }
  await page.locator('#demo-mode').check();await run(page,async v=>{await v.lod.ready();});
  for(const level of ['near','auto','far']){
   await page.selectOption('#lod-select',level);scenes.push(await run(page,(v,level)=>{v.lod.update(v.camera,900,0,true);v.renderer.info.reset();v.renderer.render(v.scene,v.camera);return {backend:v.state.backend,scene:'demo',level,render:{...v.renderer.info.render},variants:v.lod.stats(v.demo.root)};},level));
   await page.screenshot({path:`${out}/${backend}-demo-${level}.png`});
  }
  await page.locator('#demo-mode').uncheck();await page.selectOption('#creature-select','tuna');await page.locator('#view-follow').click();
  await page.selectOption('#lod-select','auto');
  const distance=await run(page,v=>{const steps=[];for(const d of [2,10,80,2]){v.camera.position.copy(v.fish.root.position);v.camera.position.z+=d;v.camera.lookAt(v.fish.root.position);v.lod.update(v.camera,900,0,true);steps.push(v.lod.inspect(v.fish.root).map(m=>m.level));}return steps;});
  check(distance[0].includes('near')&&distance[2].every(x=>x==='far')&&distance[3].includes('near'),backend+' camera distance switches and restores detail');
  await page.locator('#tab-area').click();await page.selectOption('#lod-select','auto');await run(page,v=>{v.lod.update(v.camera,900,0,true);v.renderer.render(v.scene,v.camera);});await page.screenshot({path:`${out}/${backend}-area-auto.png`});
  await page.locator('#tab-objects').click();await page.locator('#object-compare').click();await run(page,async v=>{await v.lod.ready();v.lod.update(v.camera,900,0,true);v.renderer.render(v.scene,v.camera);});await page.screenshot({path:`${out}/${backend}-objects-auto.png`});
  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(`${url}?${backend==='webgl'?'webgl':''}`,{waitUntil:'networkidle'});await run(mobile,async v=>{await v.lod.ready();});
  for(const tab of ['tank','objects','area']){
   await mobile.locator('#tab-'+tab).click();await mobile.selectOption('#lod-select','far');
   check(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${backend} mobile ${tab}: fits viewport`);
   await mobile.screenshot({path:`${out}/${backend}-mobile-${tab}.png`});
  }
  await mobile.close();
 }
 check(errors.length===0,'No browser/shader warnings: '+errors.slice(0,10).join(' | '));
}finally{await fs.writeFile(`${out}/browser-metrics.json`,JSON.stringify({date:new Date().toISOString(),checks,errors,assets,scenes},null,2)+'\n');await browser.close();}
console.log(`PASS ${checks.length} LOD browser checks`);
