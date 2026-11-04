import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/ecology';await fs.mkdir(out,{recursive:true});
const checks=[],errors=[],remote=[],metrics=[];
const check=(v,label)=>{if(!v)throw Error(label);checks.push(label);console.log('PASS',label);};
const read=(p,fn)=>p.evaluate(async fn=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('m',`return (${fn})(m)`)(viewer.mapStudy);},fn.toString());
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try{for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 // Keep a coherent loaded app while other chats edit this shared checkout.
 await p.routeWebSocket(/.*/,socket=>{const server=socket.connectToServer();socket.onMessage(message=>server.send(message));server.onMessage(message=>{try{if(JSON.parse(String(message)).type==='connected')socket.send(message);}catch{}});});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(m.text()))errors.push(m.text());});p.on('request',r=>{if(/^https?:\/\//.test(r.url())&&!r.url().includes('127.0.0.1')&&!/fonts\./.test(r.url()))remote.push(r.url());});
 await p.goto('http://127.0.0.1:5191/?tab=map&ecology'+(backend==='webgl'?'&webgl':''));
 await p.waitForFunction(async()=>{const e=document.querySelector('script[type="module"][src*="/src/main.ts"]');if(!e)return false;const {viewer}=await import(e.src);return !!viewer.mapStudy?.ecology&&!!document.querySelector('#panel-map')?.dataset.mapBackend;},undefined,{timeout:120000});
 check(await p.locator('#panel-map').getAttribute('data-map-backend')===(backend==='webgpu'?'webgpu':'webgl2'),backend+' actual backend: '+await p.locator('#panel-map').getAttribute('data-map-backend'));
 check(await p.locator('#ecology-show').isChecked(),backend+' ecology deep link enables grid');
 check(await p.locator('.ecology-overlay').isVisible(),backend+' diagnostic overlay visible');
 await read(p,async m=>{await m.lod.ready();const info=m.renderer.info;window.ecologyOriginalUpdate=info.update;window.ecologySubmissions=0;info.update=function(...args){window.ecologySubmissions++;return window.ecologyOriginalUpdate.apply(this,args);};});
 await p.locator('#ecology-show').uncheck();const draws=await p.evaluate(()=>window.ecologySubmissions);
 await p.evaluate(()=>window.ecologySubmissions=0);await p.locator('#ecology-show').check();const withOverlay=await p.evaluate(()=>window.ecologySubmissions);
 check(draws>0&&withOverlay===draws,backend+' overlay adds zero 3D submissions ('+draws+' base)');
 await read(p,m=>{m.renderer.info.update=window.ecologyOriginalUpdate;});
 const c=await read(p,m=>m.ecology.service.summarize({speciesId:'blue-rockfish',lifeStage:'Y'}).find(e=>e.status==='detected').cell.id);
 await p.selectOption('#ecology-cell',c);check((await p.locator('#ecology-inspector').textContent()).includes('Detected historically'),backend+' historical positive inspection');
 await p.selectOption('#ecology-stage','A');check((await p.locator('#ecology-inspector').textContent()).includes('Stage/species not recorded'),backend+' young fish never imply older fish detections');
 await p.selectOption('#ecology-stage','Y');await p.selectOption('#ecology-month','1');check((await p.locator('#ecology-inspector').textContent()).includes('No survey in selected period'),backend+' unsurveyed month stays unknown');await p.selectOption('#ecology-month','');
 const zero=await read(p,m=>m.ecology.service.summarize({speciesId:'blue-rockfish',lifeStage:'Y'}).find(e=>e.status==='not-detected').cell.id);await p.selectOption('#ecology-cell',zero);check((await p.locator('#ecology-inspector').textContent()).includes('Explicit zero catches'),backend+' explicit non-detection inspection');
 await p.selectOption('#ecology-species','pacific-sardine');await p.locator('[data-view=top]').click();await p.locator('.map-tools').evaluate(e=>e.scrollTop=0);await p.screenshot({path:`${out}/${backend}-grid.png`});
 const target=await read(p,m=>{const c=m.ecology.service.summarize({speciesId:'pacific-sardine',lifeStage:'Y'}).find(e=>e.status==='detected').cell,point=m.bay.point(c.longitude,c.latitude);point.y=12;point.project(m.camera);const rect=m.renderer.domElement.getBoundingClientRect();return {id:c.id,x:rect.left+(point.x*.5+.5)*rect.width,y:rect.top+(-point.y*.5+.5)*rect.height};});
 await p.mouse.click(target.x,target.y);check(await p.locator('#ecology-cell').inputValue()===target.id,backend+' pointer selects the geographic grid cell');

 await p.locator('#ecology-reef').click();await p.locator('#ecology-plan').locator('..').locator('summary').click();
 check((await p.locator('#ecology-plan').textContent()).startsWith('0 game'),backend+' habitat inference starts disabled');await p.locator('#ecology-infer').check();
 check(!(await p.locator('#ecology-plan').textContent()).startsWith('0 game'),backend+' explicit inferred reef recipe is populated');
 const downloadPromise=p.waitForEvent('download');await p.locator('#ecology-download').click();const download=await downloadPromise;await download.saveAs(`${out}/${backend}-recipe.json`);const recipe=JSON.parse(await fs.readFile(`${out}/${backend}-recipe.json`,'utf8'));
 check(recipe.individualCount>0&&recipe.individualCount<=64&&recipe.groups.every(g=>g.basis==='inferred-habitat'&&g.habitat.basis.includes('USGS')),backend+' portable recipe preserves caps and depth/inference provenance');
 await p.screenshot({path:`${out}/${backend}-reef.png`});
 const frames=await read(p,m=>m.renderedFrames);await p.waitForTimeout(300);check(await read(p,m=>m.renderedFrames)===frames,backend+' map still renders on demand');
 await p.getByRole('button',{name:'Inside aquarium →',exact:true}).click();check(await p.locator('.ecology-overlay').isHidden(),backend+' ecology hidden inside aquarium');await p.locator('.aq-back').click();
 await p.locator('[data-view=overview]').click();await p.setViewportSize({width:390,height:844});await p.locator('#map-ecology > summary').click();await p.screenshot({path:`${out}/${backend}-phone.png`});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),backend+' narrow viewport fits');
 metrics.push({backend,draws,recipeIndividuals:recipe.individualCount,recipeGroups:recipe.groups.length,canvas:await p.locator('.ecology-overlay').evaluate(c=>({width:c.width,height:c.height}))});await p.close();
}check(errors.length===0,'no browser/shader errors');check(remote.length===0,'no external ecology or map requests');}
finally{await fs.writeFile(`${out}/browser-checks.json`,JSON.stringify({checks,errors,remote,metrics},null,2));await browser.close();}
