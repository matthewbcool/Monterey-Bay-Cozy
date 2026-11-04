import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'artifacts/gym-weather',url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';await fs.mkdir(out,{recursive:true});
const files=['src/data/gymWeather.ts','src/data/skyAstronomy.ts','src/viewer/gymWeatherSystem.ts','src/viewer/gymWeatherSky.ts','src/viewer/gymWeather.css','src/viewer/avatarWorkbench.ts','src/viewer/nodeStyle.ts','src/viewer/water.ts','tests/gym-weather-browser.mjs'];
const sources=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await sources(),checks=[],errors=[],measurements=[],requests=[];let failure;
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const read=(page,fn,arg)=>page.evaluate(async({fn,arg})=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=v.avatarWorkbench;await w.ready;return new Function('v','w','arg',`return (${fn})(v,w,arg)`)(v,w,arg);},{fn:fn.toString(),arg});
const snapshot=p=>read(p,(_v,w)=>w.getSnapshot().weather);
async function ready(p){await p.waitForFunction(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return v.avatarWorkbench?.getSnapshot().gymReady;},undefined,{timeout:45000});}
async function menu(p){if(!await p.locator('#gym-menu').evaluate(e=>e.open))await p.locator('#gym-menu > summary').click();if(!await p.locator('.gym-weather').evaluate(e=>e.open))await p.locator('.gym-weather > summary').click();}
async function preview(p,mode,date){await menu(p);await p.selectOption('#gym-weather-mode',mode);await p.selectOption('#gym-weather-clock','preview');await p.locator('#gym-weather-date').fill(date);await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();await p.waitForTimeout(150);}
async function fixture(context,offline=false){
 const now=Date.now(),iso=n=>new Date(n).toISOString(),q=(value,unitCode)=>({value,unitCode:'wmoUnit:'+unitCode});
 const series=(value,uom)=>({uom:'wmoUnit:'+uom,values:[{value,validTime:iso(now-3600000)+'/PT6H'}]});
 await context.route('https://api.weather.gov/**',async route=>{const u=route.request().url();requests.push(u);if(offline)return route.abort();let body;
 if(u.includes('/points/'))body={properties:{forecastHourly:'https://api.weather.gov/gridpoints/MTR/92,51/forecast/hourly',forecastGridData:'https://api.weather.gov/gridpoints/MTR/92,51',observationStations:'https://api.weather.gov/gridpoints/MTR/92,51/stations'}};
 else if(u.endsWith('/stations'))body={features:[{id:'https://api.weather.gov/stations/KMRY',geometry:{coordinates:[-121.85,36.59]},properties:{stationIdentifier:'KMRY',name:'Monterey Airport · test fixture'}}]};
 else if(u.endsWith('/observations/latest'))body={properties:{timestamp:iso(now-600000),textDescription:'Partly Cloudy',cloudLayers:[{amount:'SCT'}],temperature:q(16,'degC'),windSpeed:q(14.4,'km_h-1'),windDirection:q(270,'degree_(angle)'),visibility:q(16000,'m'),precipitationLastHour:q(null,'m')}};
 else if(u.includes('/forecast/hourly'))body={properties:{updateTime:iso(now-1800000),periods:[{startTime:iso(now-3600000),endTime:iso(now+3600000),shortForecast:'Partly Cloudy',temperature:16,temperatureUnit:'C',windSpeed:'4 m/s',windDirection:'W',probabilityOfPrecipitation:q(85,'percent')} ]}};
 else body={properties:{updateTime:iso(now-1800000),skyCover:series(45,'percent'),visibility:series(16000,'m'),quantitativePrecipitation:series(0,'mm'),windSpeed:series(14.4,'km_h-1'),windDirection:series(270,'degree_(angle)')}};
 await route.fulfill({json:body,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
}
async function capture(p,name,view='coast',underwater=false,reduced=false){
 const metrics=await read(p,async(_v,w,{view,underwater,reduced})=>{
  const scene=w.gym.root.parent;w.setActive(null);const mount=document.getElementById('gym-viewport');w.renderer.setSize(mount.clientWidth,mount.clientHeight);w.camera.aspect=mount.clientWidth/mount.clientHeight;
  w.camera.position.set(105,14,30);w.camera.lookAt(40,17,-80);w.camera.near=.25;w.camera.far=2000;
  if(view==='moon'||view==='sun'){
    const sky=w.weather.getSnapshot().astronomy,body=view==='moon'?sky.moon:sky.sun;
    w.camera.position.set(86,10,-20);w.camera.lookAt(86+body.direction[0]*100,10+Math.max(.08,body.direction[1]*.65)*100,-20+body.direction[2]*100);
  }
  if(view==='underwater'){w.camera.position.set(120,-2,-25);w.camera.lookAt(130,1,-30);}
  w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);w.gym.update(12);
  w.weather.update({time:12,dt:60,underwater,overview:false,reducedMotion:reduced,water:w.gym.water});
  w.lod.update(w.camera,mount.clientHeight,0,true);await w.renderer.compileAsync(scene,w.camera);
  let skyDraws=0,rainDraws=0;const domeBefore=w.weather.sky.dome.onBeforeRender,rainBefore=w.weather.sky.rain.onBeforeRender;
  w.weather.sky.dome.onBeforeRender=function(...args){skyDraws++;domeBefore.apply(this,args);};w.weather.sky.rain.onBeforeRender=function(...args){rainDraws++;rainBefore.apply(this,args);};
  const autoReset=w.renderer.info.autoReset;w.renderer.info.autoReset=false;w.renderer.info.reset();w.renderer.render(scene,w.camera);
  const render={draws:w.renderer.info.render.drawCalls,triangles:w.renderer.info.render.triangles,skyDraws,rainDraws};w.renderer.info.autoReset=autoReset;w.weather.sky.dome.onBeforeRender=domeBefore;w.weather.sky.rain.onBeforeRender=rainBefore;
  return {weather:w.weather.getSnapshot(),skyVisible:w.weather.root.visible,rainVisible:w.weather.sky.rain.visible,rainInstances:w.weather.sky.rain.count,waterLight:w.gym.water.uniforms.lightLevel.value,paintExposure:w.weather.environment.paintExposure.value,waterFog:w.gym.water.uniforms.fogEnabled.value,waterFogFar:w.gym.water.uniforms.fogFar.value,sceneFogFar:scene.fog.far,render,positionVersion:w.weather.sky.dome.geometry.attributes.position.version,instanceVersion:w.weather.sky.rain.instanceMatrix.version};
 },{view,underwater,reduced});measurements.push({name,...metrics});await p.screenshot({path:`${out}/${name}.png`});return metrics;
}
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await fixture(context);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(backend+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT'))errors.push(backend+': '+m.text())});
  await p.goto(`${url}?tab=gym${backend==='webgl'?'&webgl':''}`);await ready(p);await p.waitForFunction(async()=>{const{viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!v.avatarWorkbench.weather.getSnapshot().data.fetchedAt;});
  const timeRules=await p.evaluate(async()=>{const{parsePacificDateTime:parse}=await import('/src/viewer/gymWeatherSystem.ts');return {winter:parse('2026-01-15T12:00'),summer:parse('2026-07-15T12:00'),gap:parse('2026-03-08T02:30')};});check(timeRules.winter===Date.parse('2026-01-15T20:00Z')&&timeRules.summer===Date.parse('2026-07-15T19:00Z')&&timeRules.gap===null,backend+' preview clock respects Pacific daylight saving time');
  const live=await snapshot(p);check(live.mode==='live'&&live.previewTime===null&&live.data.cloudCover01.source==='observation',backend+' loads nearby observations automatically');
  check(live.data.rainMmHour.value===0&&live.data.precipitationProbability01.value===.85,backend+' precipitation probability does not trigger rain');
  check(Math.abs(Date.parse(live.astronomy.time)-Date.now())<5000,backend+' sky uses actual UTC clock');
  const requestCount=requests.length;await p.waitForTimeout(1100);check(requests.length===requestCount,backend+' render loop does not refetch weather');
  await preview(p,'clouds','2026-10-23T13:00');const day=await capture(p,backend+'-clouds');
  check(day.weather.astronomy.sun.altitude>.4&&day.weather.visual.sunIntensity>0&&day.waterLight>.7,backend+' daylight illuminates land and water');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'rain','2026-10-23T13:00');const rain=await capture(p,backend+'-rain');
  check(day.render.skyDraws===1&&day.render.rainDraws===0&&rain.render.skyDraws===1&&rain.render.rainDraws===1,backend+' actual atmosphere submissions stay within two draws');
  check(rain.rainVisible&&rain.weather.visual.rainMmHour>3.9,backend+' rain preview shows instanced precipitation');
  check(rain.instanceVersion===day.instanceVersion&&rain.positionVersion===day.positionVersion,backend+' weather motion does not upload geometry');
  const overview=await read(p,(_v,w)=>{w.weather.update({time:12,dt:60,underwater:false,overview:true,reducedMotion:false,water:w.gym.water});return {rain:w.weather.sky.rain.visible,storm:w.weather.sky.uniforms.rain.value};});check(!overview.rain&&overview.storm>.8,backend+' overview keeps storm shading while hiding nearby rain streaks');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'fog','2026-10-23T13:00');const fog=await capture(p,backend+'-fog');
  check(fog.sceneFogFar<200&&fog.waterFog===1&&fog.waterFogFar===fog.sceneFogFar,backend+' fog affects ocean and land together');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'clouds','2026-10-23T18:15');await capture(p,backend+'-sunset','sun');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'clear','2026-10-23T21:30');const night=await capture(p,backend+'-night','moon');
  check(night.weather.visual.sunIntensity===0&&night.weather.visual.moonIntensity>0&&night.waterLight<.2&&night.paintExposure===night.waterLight,backend+' night uses moonlight and dims the ocean');
  check(night.weather.astronomy.moon.illumination>.9&&night.weather.astronomy.moon.waxing,backend+' October 23 shows a waxing gibbous moon');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'clear','2026-10-13T18:45');const crescent=await capture(p,backend+'-crescent','moon');
  check(crescent.weather.astronomy.moon.illumination<.2,backend+' changing preview date changes the lunar phase');
  await read(p,(_v,w)=>w.setActive('gym'));await preview(p,'rain','2026-10-23T13:00');const reduced=await capture(p,backend+'-reduced','coast',false,true);
  check(!reduced.rainVisible,backend+' reduced motion suppresses moving rain');
  const under=await capture(p,backend+'-underwater','underwater',true);check(!under.skyVisible&&!under.rainVisible,backend+' underwater hides sky and rain');
  await read(p,(_v,w)=>w.setActive('gym'));await menu(p);await p.locator('#gym-weather-live').click();await p.waitForTimeout(120);const restored=await snapshot(p);check(restored.mode==='live'&&restored.previewTime===null,backend+' Return to live clears previews');
  await p.locator('#tab-avatars').click();const studio=await read(p,(_v,w)=>({env:w.weather.environment.sun.value.toArray(),paint:w.weather.environment.paintExposure.value,active:w.weather.getSnapshot().active}));check(!studio.active&&studio.env[1]>.7&&studio.paint===1,backend+' creator restores its studio lighting');
  const left=requests.length;await p.waitForTimeout(300);check(requests.length===left,backend+' inactive gym makes no weather requests');
  await context.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await fixture(mobile,true);const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'?tab=gym&webgl');await ready(p);await p.waitForTimeout(300);await menu(p);await p.selectOption('#gym-weather-mode','rain');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px weather controls fit the viewport');
 await p.screenshot({path:out+'/phone-controls.png'});await p.selectOption('#gym-weather-mode','live');await p.waitForTimeout(200);check((await p.locator('#gym-weather-status').textContent()).includes('unavailable'),'offline state is labeled rather than shown as live clear weather');await mobile.close();
 check(errors.length===0,'No browser or shader errors');check(JSON.stringify(before)===JSON.stringify(await sources()),'Weather sources stayed stable during verification');
}catch(e){failure=String(e);throw e;}finally{await fs.writeFile(out+'/browser-qa.json',JSON.stringify({date:new Date().toISOString(),passed:!failure,failure,checks,errors,measurements,requests,sources:before,note:'Provider-shaped fixtures are test data. Fixed inspection cameras are separate from movement tests. Chrome on Mac; phone emulation, not physical-device testing.'},null,2)+'\n');await browser.close();}
