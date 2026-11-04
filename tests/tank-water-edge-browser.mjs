import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const output='artifacts/tank-water/edges';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],errors=[];
try{
 for(const backend of ['webgpu','webgl2']){
  const page=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5191/?quality=standard'+(backend==='webgl2'?'&webgl':''),{waitUntil:'networkidle'});
  await page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;v.state.running=false;await new Promise(requestAnimationFrame);v.fish.root.visible=false;v.controls.enableDamping=false;});
  const views=[['whole',null,null],['sill',[0,-2,9],[0,-4.5,5.8]],['upper',[0,2,9],[0,4.5,5.8]],['right',[11,0,9],[13.716,0,5.8]],['left',[-11,0,9],[-13.716,0,5.8]]];
  for(const [name,camera,target] of views){
   const render=async order=>{
    await page.evaluate(async({camera,target,order})=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);if(camera){v.camera.position.set(...camera);v.controls.target.set(...target);v.controls.update();}v.tank.water.enclosure.renderOrder=order;v.renderer.render(v.scene,v.camera);await new Promise(requestAnimationFrame);},{camera,target,order});
    return page.locator('#stage canvas').screenshot();
   };
   const first=await render(-10),last=await render(10);
   const identical=first.equals(last);results.push({backend,view:name,orderIndependent:identical});
   await writeFile(`${output}/${backend}-${name}.png`,last);
   assert.ok(identical,`${backend} ${name}: water/frame pixels must not depend on which surface draws first`);
   console.log('PASS',backend,name,'water/frame drawing order');
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/browser-qa.json',JSON.stringify({date:new Date().toISOString(),results,errors},null,2)+'\n');
}finally{await browser.close();}
