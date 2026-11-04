import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'artifacts/monterey-bay-region';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],measurements=[],remote=[];
const check=(v,label)=>{if(!v)throw Error(label);checks.push(label);console.log('PASS',label);};
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('m','arg',`return (${fn})(m,arg)`)(viewer.mapStudy,arg);},{fn:fn.toString(),arg});
async function ready(p){await p.waitForFunction(async()=>{const e=document.querySelector('script[type="module"][src*="/src/main.ts"]');if(!e)return false;const {viewer}=await import(e.src);return !!viewer.mapStudy?.bay;},undefined,{timeout:90000});}
const hashFiles=['src/viewer/mapStudy.ts','src/viewer/mapStudy/bayRegion.ts','src/viewer/mapStudy/bayPlaces.ts','src/data/monterey-bay-region.json','src/viewer/liveFeedLayer.ts','src/style.css'];
const hashes=async()=>Object.fromEntries(await Promise.all(hashFiles.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const before=await hashes();
try{for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(m.text()))errors.push(m.text());});
 p.on('request',r=>{if(/^https:\/\/(?!fonts\.)/.test(r.url()))remote.push(r.url());});
 await p.goto('http://127.0.0.1:5191/?tab=map'+(backend==='webgl'?'&webgl':''));await ready(p);
 check(await p.locator('#panel-map').getAttribute('data-map-backend')===(backend==='webgpu'?'webgpu':'webgl2'),backend+' actual backend: '+await p.locator('#panel-map').getAttribute('data-map-backend'));
 check((await p.locator('.map-status').textContent()).includes('53.4 km'),backend+' whole-bay coverage');
 const stats=await read(p,async m=>{await m.lod.ready();return {bay:m.lod.stats(m.bay.root),camera:m.camera.position.toArray(),range:m.camera.far,frames:m.renderedFrames};});
 check(stats.bay.near.triangles<85000&&stats.bay.near.draws<=40,backend+' regional asset budget');
 check(stats.bay.far.triangles<stats.bay.near.triangles,backend+' shared LOD reduction');
 await p.screenshot({path:out+'/'+backend+'-overview.png'});
 await p.locator('[data-view=top]').click();check(await p.locator('#panel-map').getAttribute('data-map-view')==='top',backend+' top view');await p.screenshot({path:out+'/'+backend+'-top.png'});
 for(const id of ['santa-cruz','capitola','moss-landing','marina','monterey']){
  await p.selectOption('#map-bay-place',id);
  const centered=await read(p,(m,id)=>{const place=m.bay.places.find(p=>p.id===id),point=m.bay.point(place.longitude,place.latitude).project(m.camera);return {visible:Math.abs(point.x)<.8&&Math.abs(point.y)<.8&&point.z<1,range:m.camera.far};},id);
  check(centered.visible,backend+' focus '+id);if(id==='moss-landing'||id==='santa-cruz')await p.screenshot({path:out+'/'+backend+'-'+id+'.png'});
 }
 await p.locator('[data-view=overview]').click();await p.locator('#map-seafloor').check();
 check(await read(p,m=>m.bay.seabed.visible&&!m.bay.ocean.visible),backend+' sourced seafloor cutaway');await p.screenshot({path:out+'/'+backend+'-seafloor.png'});await p.locator('#map-seafloor').uncheck();
 await p.locator('[data-view=park]').click();check(await read(p,m=>m.park.root.visible&&m.camera.position.distanceTo(m.park.center)<1600),backend+' detailed Lovers Point retained');await p.screenshot({path:out+'/'+backend+'-park.png'});
 await p.locator('#map-park').uncheck();check(await read(p,m=>!m.park.root.visible&&m.bay.root.getObjectByName('Flat comparison under detailed study').visible),backend+' source comparison has a filled terrain crop');await p.locator('#map-park').check();
 await p.locator('[data-view=museum]').click();check(await read(p,m=>m.museum.root.visible),backend+' museum retained');
 await p.locator('[data-view=overview]').click();await p.locator('#panel-map canvas[tabindex="0"]').focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('+');await p.keyboard.press('Home');check(await p.locator('#panel-map').getAttribute('data-map-view')==='overview',backend+' keyboard navigation reset');
 const frame=await read(p,m=>m.renderedFrames);await p.waitForTimeout(350);check(await read(p,m=>m.renderedFrames)===frame,backend+' idle remains demand rendered');
 await p.locator('#tab-tank').click();const paused=await read(p,m=>m.renderedFrames);await p.waitForTimeout(300);check(await read(p,m=>m.renderedFrames)===paused,backend+' inactive map does not render');await p.locator('#tab-map').click();
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),backend+' narrow viewport fits');
 const phone=await read(p,m=>{const p=m.bay.point(-121.786908,36.804405).project(m.camera);return {x:p.x,y:p.y,z:p.z};});check(phone.z<1&&Math.abs(phone.x)<1&&Math.abs(phone.y)<1,backend+' phone frames bay');await p.screenshot({path:out+'/'+backend+'-phone.png'});
 measurements.push({backend,...stats,phone});await p.close();
}check(errors.length===0,'no browser or shader errors');check(remote.length===0,'no external map/data requests');
 check(JSON.stringify(before)===JSON.stringify(await hashes()),'map sources stable throughout verification');
}finally{await fs.writeFile(out+'/browser-checks.json',JSON.stringify({checks,errors,measurements,remote,sourceHashes:before},null,2));await browser.close();}
