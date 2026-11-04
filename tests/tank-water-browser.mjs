import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.OUTPUT_DIR??'artifacts/tank-water/',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[],metrics=[];
const check=(ok,text)=>{assert.ok(ok,text);checks.push(text);console.log('PASS',text);};
try {
 for(const backend of ['webgpu','webgl2']){
  const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  p.on('pageerror',e=>errors.push(backend+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(backend+': '+m.text());});
  await p.goto(url+'?quality=standard'+(backend==='webgl2'?'&webgl':''),{waitUntil:'networkidle'});
  const get=()=>p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return {backend:v.state.backend,time:v.tank.water.uniforms.time.value,state:{...v.state},triangles:v.renderer.info.render.triangles,draws:v.renderer.info.render.drawCalls,texture:v.tank.water.field.uuid,textureVersion:v.tank.water.field.version};});
  await p.waitForFunction(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.renderer.info.render.drawCalls>0;});
  check((await get()).backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' renderer confirmed');
  await p.screenshot({path:out+backend+'-whole.png'});
  await p.getByRole('button',{name:'Follow fish',exact:true}).click();await p.screenshot({path:out+backend+'-tuna.png'});
  const first=await get();await p.waitForTimeout(150);check((await get()).time===first.time,backend+' reduced motion freezes caustics');
  await p.getByRole('button',{name:'Play animation',exact:true}).click();await p.waitForTimeout(650);check((await get()).time>first.time+.1,backend+' water animates on play');
  await p.getByRole('button',{name:'Pause animation',exact:true}).click();const frozen=await get();
  // Use the fixed gallery camera: follow-camera easing may settle after pause.
  await p.getByRole('button',{name:'Whole tank',exact:true}).click();
  await p.waitForTimeout(100);const a=await p.locator('#stage canvas').screenshot();await p.waitForTimeout(180);const b=await p.locator('#stage canvas').screenshot();
  check((await get()).time===frozen.time&&a.equals(b),backend+' pause freezes the rendered water and creature');
  // Hold the fish and camera still; only advance tank lighting to prove the water image changes.
  await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.tank.update(v.state.simulationTime+7);});
  await p.waitForTimeout(100);const c=await p.locator('#stage canvas').screenshot();check(!b.equals(c),backend+' moving caustics change pixels without moving the creature');
  // Rejoin the normal simulation clock after the isolated animation sample.
  await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);v.state.simulationTime=v.tank.water.uniforms.time.value;});
  await p.getByRole('button',{name:'Follow fish',exact:true}).click();
  const ids=await p.locator('#creature-select option').evaluateAll(os=>os.map(o=>o.value));
  for(const id of ids){await p.selectOption('#creature-select',id);await p.waitForTimeout(120);check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);let ok=true;v.fish.root.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])ok&&=m.userData.tankWater===true;}});return ok;}),backend+' water light on '+id);}
  await p.selectOption('#creature-select','moon-jelly');await p.screenshot({path:out+backend+'-jelly.png'});
  check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);let n=0;v.fish.root.traverse(o=>{if(o.isMesh&&o.material.transparent&&o.material.outputNode)n++;});return n>0;}),backend+' jelly transparency retained');
  await p.selectOption('#creature-select','pacific-sardine');await p.selectOption('#school-count','48');await p.waitForTimeout(150);await p.screenshot({path:out+backend+'-school.png'});
  await p.getByLabel('State',{exact:true}).selectOption('caught');await p.waitForTimeout(120);check(await p.locator('#mode-fast').isDisabled(),backend+' caught controls preserved');
  await p.getByLabel('State',{exact:true}).selectOption('alive');await p.selectOption('#creature-select','tuna');
  for(const quality of ['base','standard']){
    await p.selectOption('#quality-select',quality);await p.waitForTimeout(150);
    const state=await get();metrics.push({backend,quality,view:'follow-tuna',draws:state.draws,triangles:state.triangles});
    check(state.draws<=(20),backend+' '+quality+' scene budget including scene passes');
    await p.screenshot({path:out+backend+'-'+quality+'.png'});
  }
  await p.getByRole('tab',{name:'Area & buildings',exact:true}).click();await p.getByRole('button',{name:'Underwater',exact:true}).click();await p.waitForTimeout(120);
  check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !v.tank.root.visible&&v.harbor.root.visible&&v.state.underwater;}),backend+' coastal water remains independent');
  await p.getByRole('tab',{name:'Objects',exact:true}).click();await p.selectOption('#object-select','rowboat');await p.waitForTimeout(120);
  check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);let contaminated=false;v.objects.root.traverse(o=>{if(o.isMesh)contaminated||=!!o.material.userData.tankWater;});return !contaminated;}),backend+' object materials unchanged');
  await p.getByRole('tab',{name:'Tank',exact:true}).click();const last=await get();check(last.texture===first.texture&&last.textureVersion===first.textureVersion,backend+' one texture reused across selection, quality and tabs');
  await p.getByRole('button',{name:'Whole tank',exact:true}).click();await p.locator('#stage canvas').focus();await p.keyboard.press('ArrowRight');check((await get()).state.creatureId==='pacific-sardine',backend+' keyboard selection');
  await p.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push('mobile: '+e.message));
 await p.goto(url+'?quality=base&webgl',{waitUntil:'networkidle'});await p.waitForFunction(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.renderer.info.render.drawCalls>0;});
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px no overflow');await p.screenshot({path:out+'mobile-whole.png'});
 await p.getByRole('button',{name:'Follow fish',exact:true}).tap();await p.screenshot({path:out+'mobile-follow.png'});await p.getByRole('button',{name:'Play animation',exact:true}).tap();await p.waitForTimeout(350);
 check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.tank.water.uniforms.time.value>0;}),'Touch starts water animation');await p.close();
 check(errors.length===0,'No browser or shader errors: '+errors.slice(0,5).join('; '));
 await fs.writeFile(out+'browser-qa.json',JSON.stringify({date:new Date().toISOString(),checks,errors,metrics},null,2)+'\n');
}finally {await browser.close();}
