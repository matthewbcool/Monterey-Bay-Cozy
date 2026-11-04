import {chromium} from 'playwright';
import fs from 'node:fs/promises';
// Visual evidence for the shared toon style. PREVIEW_URL overrides the dev server address.
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out='artifacts/toon-style/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],checks=[],stats={};
const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label)};
const render=p=>p.evaluate(async()=>{const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
  const toon=new Set(),standard=[];v.scene.traverseVisible(o=>{if(o.isMesh){const m=o.material;if(m.isMeshToonMaterial)toon.add(m.gradientMap?.name);else if(m.isMeshStandardMaterial)standard.push(o.name);}});
  return {render:{...v.renderer.info.render},toonRamps:[...toon],standard};});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GLTFExporter/.test(m.text()))errors.push(m.text())});
  await page.goto(url+'?tab=area',{waitUntil:'networkidle'});await page.waitForTimeout(150);
  stats.area=await render(page);await page.screenshot({path:out+'harbor-overview.png'});
  assert(stats.area.standard.length===0,'No standard-material meshes remain in the harbor');
  await page.getByRole('button',{name:'Water detail',exact:true}).click();await page.waitForTimeout(120);await page.screenshot({path:out+'water-detail.png'});
  await page.getByRole('button',{name:'Underwater',exact:true}).click();await page.waitForTimeout(120);stats.underwater=await render(page);await page.screenshot({path:out+'underwater.png'});
  await page.getByRole('tab',{name:'Objects',exact:true}).click();await page.waitForTimeout(120);stats.objects=await render(page);await page.screenshot({path:out+'rowboat.png'});
  assert(stats.objects.standard.length===0,'Object preview uses toon materials only');
  await page.selectOption('#object-select','cabin-boat');await page.waitForTimeout(120);await page.screenshot({path:out+'cabin-boat.png'});
  await page.selectOption('#object-select','giant-kelp');await page.waitForTimeout(150);await page.screenshot({path:out+'giant-kelp.png'});
  const seeds=new Set();for(let i=0;i<3;i++){await page.getByRole('button',{name:'Regenerate',exact:true}).click();await page.waitForTimeout(120);seeds.add(await page.locator('#object-stats').textContent());await page.screenshot({path:out+`giant-kelp-variant-${i+1}.png`});}
  assert(seeds.size===3,'Regenerate produces new random kelp plants');
  await page.selectOption('#object-select','tackle-box');await page.waitForTimeout(120);await page.screenshot({path:out+'tackle-box.png'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save GLB',exact:true}).click();await download;
  assert(await page.locator('#export-status').textContent()==='Model saved.','GLB export still succeeds through the standard-material clone');
  await page.getByRole('button',{name:'Compare sizes',exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:out+'compare.png'});
  await page.getByRole('tab',{name:'Tank',exact:true}).click();await page.getByRole('button',{name:'Follow fish',exact:true}).click();await page.waitForTimeout(150);stats.tank=await render(page);await page.screenshot({path:out+'tuna.png'});
  await page.selectOption('#creature-select','blue-rockfish');await page.waitForTimeout(150);await page.screenshot({path:out+'rockfish.png'});
  await page.selectOption('#creature-select','pacific-sardine');await page.waitForTimeout(150);await page.screenshot({path:out+'sardine-school.png'});
  assert(errors.length===0,'No browser, shader or export warnings: '+errors.join(' | '));
}finally{await fs.writeFile(out+'browser-qa.json',JSON.stringify({checks,errors,stats},null,1));await browser.close();}
