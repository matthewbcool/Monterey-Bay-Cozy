import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const out='artifacts/fish-style-pass',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[],measurements=[];
function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
try {
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${url}?quality=standard${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
   await v.started;v.state.running=false;await new Promise(requestAnimationFrame);v.renderer.info.autoReset=false;
   v.controls.enableDamping=false;v.renderer.shadowMap.enabled=false;
  });
  const ids=await page.locator('#creature-select option').evaluateAll(os=>os.map(o=>o.value).filter(id=>!['moon-jelly','green-sea-turtle'].includes(id)));
  for(const id of ids){
   const result=await page.evaluate(async id=>{
    const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    const {modelStats}=await import('/src/viewer/modelStats.ts');
    v.selectCreature(id);if(id==='pacific-sardine')v.setSchoolCount(0);v.setLifeState('alive');
    v.chooseMode('fast');v.fish.setSwimMode('fast',true);for(let i=0;i<20;i++)v.fish.update(.05);
    v.fish.root.position.set(0,0,0);v.fish.root.rotation.set(0,0,0);v.setView('follow');
    const l=v.fish.root.userData.lengthMeters;v.camera.position.set(-l*.65,-l*.65,l*(id==='ocean-sunfish'?3:1.8));
    v.controls.maxPolarAngle=Math.PI-.1;v.controls.target.set(0,0,0);v.controls.update();
    v.fish.root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};
    v.fish.root.visible=true;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};
    return {id,backend:v.state.backend,...modelStats(v.fish.root),submittedFishDraws:full.drawCalls-empty.drawCalls,submittedFishTriangles:full.triangles-empty.triangles};
   },id);
   measurements.push(result);
   check(result.model.drawCalls===2,`${backend} ${id}: two model draws`);
   check(result.submittedFishDraws===2&&result.submittedFishTriangles===result.model.triangles,`${backend} ${id}: GPU submissions match the model budget`);
   await page.screenshot({path:`${out}/${backend}-${id}-standard-under.png`});
   const before=await page.locator('canvas').screenshot();
   await page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);for(let i=0;i<7;i++)v.fish.update(.07);v.renderer.render(v.scene,v.camera);});
   check(!before.equals(await page.locator('canvas').screenshot()),`${backend} ${id}: GPU swimming changes fish pixels with tank time frozen`);
   await page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.setLifeState('caught');v.camera.position.z*=-1;v.controls.update();v.renderer.render(v.scene,v.camera);});
   await page.screenshot({path:`${out}/${backend}-${id}-standard-caught-far.png`});
  }
  await page.close();
 }
 check(errors.length===0,'No browser or shader errors');
 await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({date:new Date().toISOString(),checks,errors,measurements},null,2)+'\n');
 console.log(`${checks.length} fish-style checks passed`);
} finally {await browser.close();}
