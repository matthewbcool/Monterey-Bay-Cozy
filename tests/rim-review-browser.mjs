import {chromium} from 'playwright';
import fs from 'node:fs/promises';
// Renders the TSL rim review on native WebGPU and the WebGL 2 backend, with rim on and off.
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/',out='artifacts/rim-light/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan']});
const results=[],errors=[];
try{
  for(const close of [false,true])for(const webgl of [false,true])for(const rim of [true,false]){
    const page=await browser.newPage({viewport:{width:1280,height:820}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(url+'tests/rim-review.html?'+[webgl?'webgl':'',rim?'':'rim=0',close?'close':''].filter(Boolean).join('&'));
    const result=await page.evaluate(()=>window.rimReview);results.push(result);console.log(JSON.stringify(result));
    if(!webgl&&result.backend!=='WebGPUBackend')throw Error('Native WebGPU unavailable; do not claim it verified');
    await page.screenshot({path:`${out}${close?'close-':''}${webgl?'webgl2':'webgpu'}-${rim?'rim':'no-rim'}.png`});await page.close();
  }
  if(errors.length)throw Error(errors.join('\n'));
}finally{await fs.writeFile(out+'results.json',JSON.stringify({results,errors},null,1));await browser.close();}
