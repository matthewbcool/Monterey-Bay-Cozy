import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const mode='after',out='artifacts/fish-style-pass';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true}),results=[],errors=[];
try{for(const backend of ['webgpu','webgl2']){
 const p=await b.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5191/?quality=standard'+(backend==='webgl2'?'&webgl':''),{waitUntil:'networkidle'});
 await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;v.state.running=false;await new Promise(requestAnimationFrame);v.renderer.info.autoReset=false;v.controls.enableDamping=false;});
 const ids=await p.locator('#creature-select option').evaluateAll(os=>os.map(o=>o.value).filter(id=>!['moon-jelly','green-sea-turtle'].includes(id)));
 for(const id of ids){for(const pose of ['slow','fast','caught']){
  const row=await p.evaluate(async({id,pose})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const {modelStats}=await import('/src/viewer/modelStats.ts');v.setLifeState('alive');v.selectCreature(id,true);if(id==='pacific-sardine')v.setSchoolCount(0);v.fish.root.position.set(0,0,0);v.fish.root.rotation.set(0,0,0);v.setView('follow');v.setLifeState('alive');v.chooseMode(pose==='fast'?'fast':'slow');v.fish.setSwimMode(pose==='fast'?'fast':'slow',true);v.fish.update(.1);if(pose==='caught')v.setLifeState('caught');const l=v.fish.root.userData.lengthMeters;v.camera.position.set(l*.1,l*.18,l*(id==='ocean-sunfish'?3.2:1.9));v.controls.target.set(0,0,0);v.controls.update();v.renderer.info.reset();v.renderer.render(v.scene,v.camera);const stats=modelStats(v.fish.root);return {id,pose,backend:v.state.backend,state:v.fish.getState(),...stats};},{id,pose});results.push(row);
  await p.screenshot({path:`${out}/${mode}-${backend}-${id}-${pose}.png`});
 }}await p.close();
}await fs.writeFile(`${out}/${mode}.json`,JSON.stringify({results,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(mode,results.length,'views',errors.length,'errors');}finally{await b.close();}
