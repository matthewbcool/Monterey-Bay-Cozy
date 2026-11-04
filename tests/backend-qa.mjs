import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
try{
 for(const force of [false,true]){
  const page=await browser.newPage({viewport:{width:1100,height:780}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url+'tests/webgpu-assets.html'+(force?'?webgl':''));
  const result=await page.evaluate(async()=>{const check=await window.assetBackendCheck;return check.result;});
  console.log(JSON.stringify(result));results.push(result);
  if(force&&result.backend!=='WebGLBackend')throw Error('WebGL backend did not initialize');
  if(!force&&result.backend!=='WebGPUBackend')throw Error('Native WebGPU unavailable; do not claim verified');
  await page.screenshot({path:'artifacts/performance/'+(force?'webgl2':'webgpu')+'.png'});await page.evaluate(async()=>{(await window.assetBackendCheck).dispose();});await page.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile('artifacts/performance/backends.json',JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
