import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/tank-demo',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[],measurements=[],diagnostics=[],pageStages=new WeakMap();
const preview=new URL(url);
const holdRevision=p=>p.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),socket=>socket.send(JSON.stringify({type:'connected'})));
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
async function watch(p,label){
 pageStages.set(p,{label,phase:'startup'});
 const context=()=>({...pageStages.get(p),url:p.url(),lastPassedCheck:checks.at(-1)});
 p.on('pageerror',e=>{errors.push(e.message);diagnostics.push({...context(),type:'pageerror',message:e.message,stack:e.stack});});
 // CDP preserves the generating call stack; Playwright's ConsoleMessage.text()
 // alone hid which page and shader-build path caused a previous failure.
 const session=await p.context().newCDPSession(p);await session.send('Runtime.enable');
 session.on('Runtime.consoleAPICalled',event=>{if(event.type==='error'){
  const message=event.args.map(arg=>String(arg.value??arg.description??arg.type)).join(' ');errors.push(message);
  diagnostics.push({...context(),type:'console',message,stackTrace:event.stackTrace});
 }});
}
const stage=(p,phase)=>{pageStages.get(p).phase=phase;};
async function run(p,fn,arg){return p.evaluate(async({source,arg})=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return await (0,eval)(`(${source})`)(v,arg);},{source:fn.toString(),arg});}
const sample=p=>run(p,v=>({time:v.state.simulationTime,paused:v.state.paused,poses:v.demo?.members.map(({model})=>[model.root.position.toArray(),model.getState().phase,'specimens'in model?model.specimens.map(m=>[m.root.position.toArray(),m.getState().phase]):null])}));
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await watch(p,`${backend}: desktop`);
  await holdRevision(p);
  await p.goto(`${url}${backend==='webgl'?'?webgl':''}`,{waitUntil:'networkidle'});
  check(await run(p,v=>v.state.quality==='standard'),`${backend}: Standard is the desktop default`);
  check(await p.getByRole('checkbox',{name:'Demo mode'}).count()===1,`${backend}: native Demo mode checkbox`);
  const rectangles=await p.evaluate(()=>({picker:document.querySelector('#creature-select').getBoundingClientRect().toJSON(),toggle:document.querySelector('.demo-toggle').getBoundingClientRect().toJSON()}));
  check(rectangles.toggle.top>=rectangles.picker.bottom,`${backend}: checkbox is beneath creature selector`);
  check(await p.evaluate(()=>{const panel=document.querySelector('.creature-control'),camera=document.querySelector('.camera-controls'),state=document.querySelector('#life-state'),a=panel.getBoundingClientRect(),b=camera.getBoundingClientRect(),c=state.getBoundingClientRect();return panel.contains(camera)&&panel.contains(state)&&a.width>=700&&a.height<245&&panel.contains(document.querySelector('.lod-control'))&&a.left<=b.left&&b.right<=a.right&&a.top<=b.top&&b.bottom<=a.bottom&&c.top>=b.bottom&&c.right<=a.right;}),`${backend}: compact wide panel places State below the camera switcher`);
  await p.selectOption('#creature-select','pacific-sardine');
  check(await p.evaluate(()=>document.querySelector('.creature-control').getBoundingClientRect().height<290),`${backend}: school selection keeps the panel compact`);
  await p.selectOption('#school-count','16');await p.selectOption('#life-state','caught');await p.getByRole('button',{name:'Follow fish',exact:true}).click();
  const original=await run(p,v=>({uuid:v.fish.root.uuid,state:v.fish.getState(),position:v.fish.root.position.toArray(),view:v.state.view,school:v.state.schoolCount}));
  await p.locator('canvas').first().focus();await p.keyboard.down('d');
  check(await run(p,v=>v.state.demo&&v.state.view==='tank')&&await p.getByRole('checkbox',{name:'Demo mode'}).isChecked(),`${backend}: D enables demo from Follow fish`);
  await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',code:'KeyD',repeat:true,bubbles:true})));
  check(await run(p,v=>v.state.demo),`${backend}: held D cannot repeatedly toggle demo`);
  await p.keyboard.up('d');await p.keyboard.press('d');
  check(await run(p,v=>!v.state.demo&&v.state.view==='follow'),`${backend}: D disables demo and restores the prior view`);
  await p.locator('#creature-select').focus();await p.keyboard.press('d');
  check(await run(p,v=>!v.state.demo),`${backend}: typing while a selector is focused leaves demo unchanged`);
  await p.getByRole('checkbox',{name:'Demo mode'}).focus();await p.keyboard.press('Space');await p.waitForTimeout(500);
  const population=await run(p,v=>({backend:v.state.backend,count:v.demo.count,species:v.demo.speciesCount,view:v.state.view,singleVisible:v.fish.root.visible,actors:v.demo.members.map(m=>({id:m.speciesId,count:'count'in m.model?m.model.count:1,alive:m.model.getState().lifeState,scale:m.model.root.scale.toArray()}))}));
  check(population.backend===(backend==='webgpu'?'WebGPU':'WebGL 2')&&population.count===292&&population.species===15,`${backend}: all 15 species / 292 creatures`);
  const counts=Object.fromEntries(population.actors.map(a=>[a.id,a.count]));
  check(counts['tuna']===6&&counts['pacific-sardine']===256&&counts['great-white-shark']===1&&counts['green-sea-turtle']===1&&population.actors.filter(a=>a.id==='green-sea-turtle').length===2,`${backend}: six tuna, 256 sardines, one shark and two turtles`);
  check(population.actors.every(a=>a.alive==='alive'&&a.scale.every(n=>n===1))&&!population.singleVisible&&population.view==='tank',`${backend}: demo uses swimming metre-scale models and whole-tank framing`);
  check(await p.locator('#creature-select').isDisabled()&&await p.locator('#life-state').isHidden()&&await p.locator('#view-follow').isDisabled(),`${backend}: single-creature controls cannot mutate the demo`);
  let frozen=await sample(p);await p.waitForTimeout(200);check(frozen.paused&&JSON.stringify(frozen)===JSON.stringify(await sample(p)),`${backend}: reduced motion stays paused after enabling demo`);
  await p.getByRole('button',{name:'Play animation',exact:true}).click();await p.waitForTimeout(600);
  check(JSON.stringify(frozen.poses)!==JSON.stringify((await sample(p)).poses),`${backend}: play animates the mixed population`);
  check(await p.locator('#demo-motion-label').isVisible()&&await p.locator('#mode-slow').isHidden()&&await p.locator('#mode-fast').isHidden()&&await p.locator('#mode-cycle').isHidden(),`${backend}: demo shows ambient movement and only Pause/Play`);
  const beforePaces=await run(p,v=>v.demo.members.map(m=>({id:m.speciesId,phase:m.model.getState().phase,tempo:m.tempo})));await p.waitForTimeout(500);
  const afterPaces=await run(p,v=>v.demo.members.map(m=>m.model.getState().phase));
  check(new Set(beforePaces.map(m=>m.tempo.toFixed(3))).size>beforePaces.length/2&&beforePaces.some((m,i)=>Math.abs(afterPaces[i]-m.phase)>.01),`${backend}: demo groups animate at varied paces`);
  await p.locator('canvas').first().focus();await p.keyboard.press('2');await p.keyboard.press('3');
  check(await run(p,v=>v.demo.members.every(m=>m.model.getState().mode==='slow')&&v.state.mode==='slow'),`${backend}: speed shortcuts do not change demo movement`);
  await p.getByRole('button',{name:'Pause animation',exact:true}).click();frozen=await sample(p);await p.waitForTimeout(200);
  check(JSON.stringify(frozen)===JSON.stringify(await sample(p)),`${backend}: pause freezes routes, schools, bodies and water`);
  for(const quality of ['base','standard']){
   stage(p,`${quality}: quality change`);
   await run(p,(v,quality)=>v.setQuality(quality),quality);await p.waitForTimeout(150);
   stage(p,`${quality}: model statistics`);
   const stats=await run(p,async v=>{
    const {modelStats}=await import('/src/viewer/modelStats.ts');
    const before=modelStats(v.demo.root),autoReset=v.renderer.info.autoReset,casters=[];
    const school=v.demo.members.find(m=>m.speciesId==='pacific-sardine').model,demoVisible=v.demo.root.visible,schoolVisible=school.root.visible;
    // Keep the renderer's shadow capability enabled: the Tank water explicitly
    // samples a TSL ShadowNode, whose setup has no output when globally disabled.
    // Suppress casting meshes instead to measure body draws without shadow draws.
    v.scene.traverse(object=>{if(object.isMesh&&object.castShadow){casters.push(object);object.castShadow=false;}});
    v.renderer.info.autoReset=false;
    try{
     v.demo.root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const empty={...v.renderer.info.render};
     v.demo.root.visible=true;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const full={...v.renderer.info.render};
     school.root.visible=false;v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const noSchool={...v.renderer.info.render};
     return {quality:v.state.quality,backend:v.state.backend,model:before.model,actualDraws:full.drawCalls-empty.drawCalls,actualTriangles:full.triangles-empty.triangles,schoolDraws:full.drawCalls-noSchool.drawCalls};
    }finally{school.root.visible=schoolVisible;v.demo.root.visible=demoVisible;casters.forEach(object=>{object.castShadow=true;});v.renderer.info.autoReset=autoReset;}
   });measurements.push(stats);
   check(stats.model.drawCalls===72&&stats.model.triangles<=450000&&stats.actualDraws>=72&&stats.actualDraws<=80&&stats.schoolDraws===1,`${backend} ${quality}: model budget and one-draw sardine school`);
   await p.screenshot({path:`${out}/${backend}-${quality}.png`});
  }
  stage(p,'desktop restoration and disposal');
  await run(p,v=>v.setQuality('standard'));
  await p.getByRole('tab',{name:'Objects',exact:true}).click();check(await run(p,v=>!v.demo.root.visible&&!v.fish.root.visible),`${backend}: demo hides outside Tank`);
  await p.getByRole('tab',{name:'Tank',exact:true}).click();check(await run(p,v=>v.demo.root.visible&&!v.fish.root.visible),`${backend}: returning to Tank preserves demo`);
  await p.getByRole('checkbox',{name:'Demo mode'}).uncheck();
  const restored=await run(p,v=>({uuid:v.fish.root.uuid,state:v.fish.getState(),position:v.fish.root.position.toArray(),view:v.state.view,school:v.state.schoolCount,demo:!!v.demo,visible:v.fish.root.visible}));
  check(restored.uuid===original.uuid&&restored.state.lifeState==='caught'&&restored.school===16&&restored.view===original.view&&!restored.demo&&restored.visible&&JSON.stringify(restored.position)===JSON.stringify(original.position),`${backend}: unchecking restores original fish, state, group and camera`);
  check(await p.locator('#creature-select').isEnabled()&&await p.locator('#school-count').isVisible()&&await p.locator('#fish-size-details').isVisible()&&await p.locator('#mode-slow').isVisible()&&await p.locator('#demo-motion-label').isHidden(),`${backend}: inspection and single-fish speed controls restored`);
  // Render-backed resource cleanup over repeat toggles, including node materials/skeletons.
  const memory=[];
  for(let i=0;i<3;i++){
   await p.getByRole('checkbox',{name:'Demo mode'}).check();await p.waitForTimeout(120);
   await run(p,v=>{window.__lastDemo=v.demo;});
   await p.getByRole('checkbox',{name:'Demo mode'}).uncheck();await p.waitForTimeout(120);
   check(await run(p,v=>window.__lastDemo.members.every(m=>m.model.getState().disposed)&&!window.__lastDemo.root.parent),`${backend}: toggle ${i+1} disposes demo actors`);
   memory.push(await run(p,v=>({...v.renderer.info.memory})));
  }
  check(memory[2].geometries<=memory[0].geometries&&memory[2].textures<=memory[0].textures,`${backend}: repeated toggles do not grow GPU resources`);
  measurements.push({backend,memory});await p.close();
 }
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await watch(p,`${backend}: phone default`);
  await holdRevision(p);
  await p.goto(`${url}${backend==='webgl'?'?webgl':''}`,{waitUntil:'networkidle'});
  check(await run(p,v=>['base','standard'].includes(v.state.quality)),`${backend}: phone uses a supported quality`);
  await p.getByRole('checkbox',{name:'Demo mode'}).tap();
  check(await p.locator('#demo-motion-label').isVisible()&&await p.locator('#mode-cycle').isHidden(),`${backend}: phone demo shows ambient movement controls`);
  await p.screenshot({path:`${out}/mobile-390-${backend}-default.png`});await p.close();
 }
 for(const width of [320,390,700,820]){
  const p=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await watch(p,`webgpu: ${width}px layout`);
  await holdRevision(p);
  await p.goto(`${url}?quality=base`,{waitUntil:'networkidle'});
  await p.getByRole('checkbox',{name:'Demo mode'}).tap();await p.waitForTimeout(200);
  check(await run(p,v=>v.state.demo&&v.demo.count===292),`${width}px: touch enables demo`);
  for(const active of [true,false]){
   if(!active){await p.getByRole('checkbox',{name:'Demo mode'}).tap();await p.selectOption('#creature-select','pacific-sardine');}
   const layout=await p.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect();const a=rect('.creature-control'),b=rect('.camera-controls'),c=rect('.playback');
    const apart=(a,b)=>a.bottom<=b.top||a.top>=b.bottom||a.right<=b.left||a.left>=b.right;
    const state=rect('#life-state');return [a,b,c].every(r=>r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)&&a.left<=b.left&&a.top<=b.top&&b.right<=a.right&&b.bottom<=a.bottom&&(document.querySelector('#life-state').hidden||state.top>=b.bottom)&&apart(a,c);
   });check(layout,`${width}px: ${active?'demo':'single-school'} controls fit without overlap`);
   await p.screenshot({path:`${out}/mobile-${width}-${active?'demo':'single'}.png`});
  }
  await p.close();
 }
 if(errors.length)console.error('BROWSER_ERRORS',JSON.stringify(diagnostics));
 check(errors.length===0,'No browser or shader errors');
 await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({checks,measurements,errors,diagnostics},null,2));
}catch(error){
 await fs.writeFile(`${out}/browser-failure.json`,JSON.stringify({checks,measurements,errors,diagnostics,failure:{message:error.message,stack:error.stack}},null,2));
 throw error;
}finally{await browser.close();}
