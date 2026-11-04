import {chromium} from 'playwright';
import fs from 'node:fs/promises';
// Visual evidence for the schooling algorithm: side and top views of a live 128-fish school.
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/',out='artifacts/schooling/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.selectOption('#creature-select','pacific-sardine');await page.selectOption('#school-count','128');
  await page.getByRole('button',{name:'Follow fish',exact:true}).click();await page.waitForTimeout(4000);
  await page.screenshot({path:out+'school-follow.png'});
  const look=async(name,offset)=>{await page.evaluate(async o=>{const {viewer:v}=await import('/src/main.ts');v.state.paused=true;const c=v.fish.root.getWorldPosition(new v.camera.position.constructor());v.controls.target.copy(c);v.camera.position.set(c.x+o[0],c.y+o[1],c.z+o[2]);v.camera.lookAt(c);v.controls.update();},offset);await page.waitForTimeout(150);await page.screenshot({path:out+name});};
  await look('school-side.png',[0,.2,4.2]);await look('school-top.png',[0,4.5,.01]);await look('school-front.png',[-4.2,.3,0]);
  await page.getByRole('button',{name:'Fast swim',exact:false}).click();
  console.log(errors.length?'ERRORS '+errors.join(' | '):'PASS no browser errors');
}finally{await browser.close();}
