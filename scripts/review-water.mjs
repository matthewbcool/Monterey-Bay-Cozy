import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5191/?tab=area',{waitUntil:'networkidle'});await page.waitForTimeout(400);
 await page.screenshot({path:'artifacts/water-depth/overview.png'});
 await page.getByRole('button',{name:'Water detail',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:'artifacts/water-depth/surface.png'});
 await page.getByRole('button',{name:'Underwater',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:'artifacts/water-depth/underwater.png'});
 const stats=await page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {render:v.renderer.info.render,capture:v.harbor.water.captureStats,position:v.camera.position.toArray(),underwater:v.state.underwater}});
 await page.locator('#dive-depth').fill('5.5');await page.waitForTimeout(200);await page.screenshot({path:'artifacts/water-depth/deep.png'});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto('http://127.0.0.1:5191/?tab=area&view=underwater',{waitUntil:'networkidle'});await mobile.screenshot({path:'artifacts/water-depth/mobile.png'});
 console.log(JSON.stringify({errors,stats},null,2));await fs.writeFile('artifacts/water-depth/first-review.json',JSON.stringify({errors,stats},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
