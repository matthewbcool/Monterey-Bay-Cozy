import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out='artifacts/water-depth/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label)};
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})};
const get=p=>p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const {seabedDepth}=await import('/src/viewer/bathymetry.ts');return {underwater:v.state.underwater,mode:v.state.harborView,paused:v.state.paused,time:v.state.waterTime,camera:v.camera.position.toArray(),floor:-seabedDepth(v.camera.position.x,v.camera.position.z),fish:v.harbor.wildlife.map(f=>f.getState().phase),fog:v.scene.fog?{exponential:v.scene.fog.isFogExp2===true,density:v.scene.fog.density}:null,visibility:v.harbor.water.uniforms.visibility.value,caustics:v.harbor.seabed.uniforms.time.value,refraction:v.harbor.water.refraction,render:{...v.renderer.info.render},memory:{...v.renderer.info.memory},polar:v.controls.maxPolarAngle};});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});watch(page);await page.goto(url+'?tab=area',{waitUntil:'networkidle'});let a=await get(page);
 assert(a.paused&&!a.underwater,'Reduced motion starts the harbor still and above water');
 assert(a.refraction===true,'Viewport colour/depth refraction is active at Standard quality');await page.screenshot({path:out+'overview.png'});
 await page.getByRole('button',{name:'Water detail',exact:true}).click();await page.waitForTimeout(80);await page.screenshot({path:out+'surface.png'});
 await page.getByRole('button',{name:'Underwater',exact:true}).click();await page.waitForTimeout(80);a=await get(page);
 assert(a.underwater&&a.fog?.exponential===true,'Underwater preset activates water haze');assert(Math.abs(a.camera[1]+2)<.01,'Camera starts two metres below the water datum');assert(a.polar>Math.PI/2,'Orbit can inspect the surface from underneath');await page.screenshot({path:out+'underwater.png'});
 await page.locator('#dive-depth').fill('5.5');await page.waitForTimeout(80);a=await get(page);assert(Math.abs(a.camera[1]+5.5)<.01&&a.camera[1]>a.floor,'Deep preset reaches 5.5 metres without entering the seabed');await page.screenshot({path:out+'deep.png'});
 await page.locator('#dive-depth').fill('2');await page.locator('#water-visibility').fill('6');await page.waitForTimeout(80);a=await get(page);const murky=await page.screenshot({path:out+'coastal-visibility.png'});
 await page.locator('#water-visibility').fill('24');await page.waitForTimeout(80);const clear=await page.screenshot({path:out+'clear-visibility.png'});let b=await get(page);
 assert(b.visibility===24&&b.fog.density<a.fog.density,'Visibility changes both water absorption and underwater haze');assert(!murky.equals(clear),'Visibility has a visible rendering effect');await page.locator('#water-visibility').fill('14');
 a=await get(page);await page.waitForTimeout(200);b=await get(page);assert(a.time===b.time&&a.caustics===b.caustics&&JSON.stringify(a.fish)===JSON.stringify(b.fish),'Pause freezes water, fish and seabed light');
 await page.getByRole('button',{name:'Play water',exact:true}).click();await page.waitForTimeout(250);b=await get(page);assert(b.time>a.time&&b.caustics>a.caustics&&JSON.stringify(a.fish)!==JSON.stringify(b.fish),'Explicit play animates water, fish and seabed light');await page.getByRole('button',{name:'Pause water',exact:true}).click();
 await page.locator('canvas').focus();for(let i=0;i<10;i++)await page.keyboard.press('ArrowUp');await page.waitForTimeout(80);b=await get(page);assert(!b.underwater&&b.fog===null,'Crossing the actual surface removes underwater haze');
 for(let i=0;i<20;i++)await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);b=await get(page);assert(b.underwater&&b.camera[1]>=b.floor+.24,'Manual descent stays above the seabed');
 await page.getByRole('tab',{name:'Tank',exact:true}).click();await page.waitForTimeout(80);assert((await get(page)).fog===null,'Leaving the harbor clears water haze from the tank');
 await page.selectOption('#creature-select','pacific-sardine');assert(await page.locator('#school-count').isVisible(),'Concurrent sardine-school controls remain available');
 await page.selectOption('#school-count','16');assert(await page.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.fish.count===16}),'Sardine-school population still changes after visiting underwater');
 await page.selectOption('#creature-select','tuna');
 await page.getByRole('tab',{name:'Objects',exact:true}).click();assert((await get(page)).fog===null,'Object inspection stays unaffected by underwater haze');
 await page.getByRole('tab',{name:'Area & buildings'}).click();await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(80);assert(!(await get(page)).underwater&&await page.locator('#dive-controls').isHidden(),'Reset returns to the surface overview');
 const before=(await get(page)).memory;for(let i=0;i<6;i++){await page.getByRole('button',{name:'Underwater',exact:true}).click();await page.getByRole('button',{name:'Water detail',exact:true}).click();}await page.waitForTimeout(80);assert(JSON.stringify((await get(page)).memory)===JSON.stringify(before),'Repeated water-view changes reuse GPU resources');
 await page.getByRole('button',{name:'Underwater',exact:true}).click();
 for(const width of [390,320]){
  const mobile=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);await mobile.goto(url+'?tab=area&view=underwater',{waitUntil:'networkidle'});
  assert((await get(mobile)).underwater,`${width}px: direct underwater link works`);
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px: no horizontal overflow`);
  assert(await mobile.evaluate(()=>{const a=document.querySelector('.dive-controls').getBoundingClientRect(),b=document.querySelector('#panel-area .object-actions').getBoundingClientRect();return a.right<b.left}),`${width}px: depth panel and view buttons do not overlap`);
  await mobile.locator('#dive-depth').focus();await mobile.keyboard.press('ArrowRight');await mobile.waitForTimeout(80);assert(Math.abs((await get(mobile)).camera[1]+2.1)<.01,`${width}px: depth control responds to keyboard`);
  await mobile.screenshot({path:out+`mobile-${width}.png`});await mobile.getByRole('button',{name:'Water detail',exact:true}).tap();await mobile.waitForTimeout(80);assert(!(await get(mobile)).underwater,`${width}px: touch returns above water`);await mobile.close();
 }
 assert(errors.length===0,'No browser or shader errors');const final=await get(page);await fs.writeFile(out+'browser-qa.json',JSON.stringify({checks,errors,final,browser:await browser.version()},null,2));
}finally{await browser.close();}
