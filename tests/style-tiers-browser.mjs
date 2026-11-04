import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/',out='artifacts/style-tiers';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],results=[];
function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${url}?quality=high${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});
  check(await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;return v.state.quality==='standard'&&!('post' in v)&&!('outlines' in v);}),backend+' old High URLs safely use Standard; removed render paths');
  for(const quality of ['base','standard'])for(const tab of ['tank','area','objects']){
   await p.selectOption('#quality-select',quality);await p.locator('#tab-'+tab).click();
   const r=await p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.lod.ready();const nonNode=[];v.scene.traverse(o=>{if(o.isMesh&&o.material.isShaderMaterial)nonNode.push(o.name);});return {backend:v.state.backend,quality:v.state.quality,refraction:v.harbor.water.refraction,nonNode};});
   check(r.quality===quality&&r.nonNode.length===0,`${backend} ${tab} ${quality}: shared node style`);
   check(r.refraction===(quality==='standard'),`${backend} ${quality}: refraction policy`);results.push({tab,...r});
   await p.screenshot({path:`${out}/${backend}-${quality}-${tab}.png`});
  }
  await p.close();
 }
 check(errors.length===0,'No browser errors');
}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({checks,errors,results},null,2)+'\n');await browser.close();}
console.log(`PASS ${checks.length} style checks`);
