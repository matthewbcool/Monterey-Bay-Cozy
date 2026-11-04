import {createSunShadows} from './sunShadows';
/** Gym-only orchestration: DOM controls, provider lifecycle, astronomy, lights and water fog.
 * Weather transport is visibility/activation gated; update() only consumes cached snapshots.
 * Frame time/delta are animation seconds, while astronomy/provider instants use UTC milliseconds.
 * Sky rendering lives in gymWeatherSky; numerical/data provenance lives in docs/weather-sources.md.
 */
import './gymWeather.css';
import { Color, DirectionalLight, Fog, HemisphereLight, PerspectiveCamera, Scene, Vector2, Vector3 } from 'three';
import { STYLE } from '../models/shared/style';
import { computeSkyAstronomy } from '../data/skyAstronomy';
import { createGymWeatherClient, type GymWeatherSnapshot } from '../data/gymWeather';
import { createGymWeatherSky } from './gymWeatherSky';
import { createNodeStyleEnvironment, RIM_STRENGTH } from './nodeStyle';
import type { createWater } from './water';

const ZONE='America/Los_Angeles';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function pacificDateTime(time:number){const p=Object.fromEntries(formatter.formatToParts(time).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
/** Reject nonexistent spring-forward times instead of silently moving the user's preview. */
export function parsePacificDateTime(value:string):number|null{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))return null;
  const wall=Date.parse(value+'Z');if(!Number.isFinite(wall))return null;
  let utc=wall+8*3600000;
  for(let i=0;i<3;i++)utc+=wall-Date.parse(pacificDateTime(utc)+'Z');
  return pacificDateTime(utc)===value?utc:null;
}
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const PRESETS={clear:{cloud:.08,rain:0,visibility:18000,wind:2},clouds:{cloud:.48,rain:0,visibility:12000,wind:4},overcast:{cloud:.95,rain:0,visibility:7000,wind:5},fog:{cloud:.8,rain:0,visibility:140,wind:1.3},rain:{cloud:1,rain:4,visibility:1400,wind:8}};
type Mode='live'|keyof typeof PRESETS;
export interface WeatherFrame {time:number;dt:number;underwater:boolean;overview:boolean;reducedMotion:boolean;water?:ReturnType<typeof createWater>}

/** Owns weather data lifecycle, atmosphere and scoped lighting for this viewport only. */
export function createGymWeatherSystem(scene:Scene,camera:PerspectiveCamera,host:HTMLElement,tier:'base'|'standard'){
  const events=new AbortController(),client=createGymWeatherClient(),sky=createGymWeatherSky({tier,radius:450,seed:6256});
  const environment=createNodeStyleEnvironment();
  const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity),moon=new DirectionalLight('#bbcfff',.15);
  // Three overlapping, stabilized maps cover the camera view on both quality tiers.
  scene.add(sun.target);
  const shadows=createSunShadows(sun,camera,tier);
  const ambient=new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity);
  sun.name='Lovers Point astronomical sunlight';moon.name='Lovers Point moonlight';ambient.name='Lovers Point sky fill';scene.add(sky.root,sun,moon,ambient);
  const panel=document.createElement('details');panel.className='gym-weather';
  panel.innerHTML=`<summary>Sky &amp; weather <span id="gym-weather-badge">Live</span></summary><div class="gym-weather-panel"><p id="gym-weather-status" role="status">Looking up local weather…</p><label>Conditions<select id="gym-weather-mode"><option value="live">Live Lovers Point</option><option value="clear">Preview · clear</option><option value="clouds">Preview · scattered clouds</option><option value="overcast">Preview · overcast</option><option value="fog">Preview · coastal fog</option><option value="rain">Preview · rain</option></select></label><label>Sky clock<select id="gym-weather-clock"><option value="live">Real time · Pacific</option><option value="preview">Preview date &amp; time</option></select></label><label id="gym-weather-date-label" hidden>Pacific date &amp; time<input id="gym-weather-date" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59"></label><div class="gym-weather-buttons"><button id="gym-weather-refresh" type="button">Refresh weather</button><button id="gym-weather-live" type="button">Return to live</button></div><p id="gym-weather-sky-info"></p><details class="gym-weather-sources"><summary>Weather sources</summary><p id="gym-weather-source-info"></p><p>Sun and moon are calculated for Lovers Point. Clouds and rain are a stylized interpretation of nearby observations and regional forecasts.</p><a href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noopener">National Weather Service</a></details></div>`;
  host.querySelector('.gym-menu-panel')!.prepend(panel);
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>panel.querySelector<T>('#'+id)!;
  const modeControl=$<HTMLSelectElement>('gym-weather-mode'),clockControl=$<HTMLSelectElement>('gym-weather-clock'),dateControl=$<HTMLInputElement>('gym-weather-date');
  dateControl.value=pacificDateTime(Date.now());
  let mode:Mode='live',previewTime:number|null=null,active=false,disposed=false,timer:ReturnType<typeof setInterval>|undefined;
  let data:GymWeatherSnapshot=client.snapshot(),astro=computeSkyAstronomy(Date.now()),lastSample=0,lastUi=0,initialized=false;
  let cloud=.38,rain=0,visibility=15000,windSpeed=3,windBearing=300;
  const wind=new Vector2(),sunDirection=new Vector3(),moonDirection=new Vector3(),keyColor=new Color(),zenith=new Color(),horizon=new Color();
  const warmSun=new Color('#ffd29b'),moonColor=new Color('#b9cfff'),nightGround=new Color('#18262c'),marineFog=new Color('#b7c5ca');
  let lastFrame:WeatherFrame|undefined;
  const lunarName=()=>astro.moon.illumination<.02?'New moon':astro.moon.illumination>.98?'Full moon':(astro.moon.waxing?'Waxing ':'Waning ')+(astro.moon.illumination<.5?'crescent':'gibbous');
  function showStatus(){
    const preview=mode!=='live'||previewTime!==null;
    $('gym-weather-badge').textContent=preview?'Preview':data.refreshing?'Updating':'Live';
    const fields=[data.cloudCover01,data.rainMmHour,data.visibilityMetres,data.windSpeedMps];
    const usable=fields.filter(f=>f.value!==null),displayed=[...usable,...(data.summary?[data.summarySource]:[])],stale=displayed.some(f=>f.state==='stale');
    const sources=new Set(displayed.map(f=>f.source));
    const sourceLabel=sources.has('observation')&&sources.has('forecast')?'Nearby observations + forecast':sources.has('observation')?'Nearby observations':sources.has('forecast')?'Regional forecast':'Weather unavailable';
    $('gym-weather-status').textContent=preview?'Preview conditions · return to live for current weather.':data.refreshing?'Updating local weather…':usable.length?`${sourceLabel}${stale?' · some data is stale':''}${data.summary?' · '+data.summary:''}`:'Weather unavailable · illustrative clouds until data returns.';
    if(!preview&&!data.refreshing&&!usable.length)$('gym-weather-badge').textContent='Unavailable';
    if(!preview&&stale)$('gym-weather-badge').textContent='Stale';
    $('gym-weather-refresh').toggleAttribute('disabled',data.refreshing||mode!=='live'||!active);
    const local=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(Date.parse(astro.time));
    $('gym-weather-sky-info').textContent=`${local} Pacific · Sun ${Math.round(astro.sun.altitude*180/Math.PI)}° above horizon · ${lunarName()}, ${Math.round(astro.moon.illumination*100)}% lit`;
    const describe=(name:string,f:GymWeatherSnapshot['cloudCover01'],value:string)=>`${name}: ${f.value===null?'unavailable':value+' · '+f.source+(f.state==='stale'?' (stale)':'')+(f.time?' · '+new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric',minute:'2-digit',month:'short',day:'numeric'}).format(Date.parse(f.time)):'')}`;
    $('gym-weather-source-info').textContent=[data.station?`${data.station.name}${data.station.distanceKm!==null?' · '+data.station.distanceKm.toFixed(1)+' km from park':''}`:'No nearby station report available.',describe('Cloud cover',data.cloudCover01,Math.round((data.cloudCover01.value??0)*100)+'%'),describe('Rain average',data.rainMmHour,(data.rainMmHour.value??0).toFixed(1)+' mm/h'),describe('Visibility',data.visibilityMetres,((data.visibilityMetres.value??0)/1000).toFixed(1)+' km'),describe('Wind',data.windSpeedMps,(data.windSpeedMps.value??0).toFixed(1)+' m/s'),data.errors.length?'Some provider requests failed; available fields are retained.':'',fields.some(f=>f.value===null)?'Missing fields use an illustrative visual default.':''].filter(Boolean).join('\n');
  }
  async function refresh(force=false){
    if(disposed||!active||document.hidden||mode!=='live')return;
    const pending=client.refresh({force});data=client.snapshot();showStatus();
    try{await pending;}finally{if(!disposed){data=client.snapshot();lastSample=lastUi=0;showStatus();}}
  }
  function syncRefresh(){
    if(timer)clearInterval(timer);timer=undefined;
    if(active&&!document.hidden&&mode==='live'){void refresh();timer=setInterval(()=>void refresh(),15*60_000);}
    else client.cancel();
  }
  modeControl.addEventListener('change',()=>{mode=modeControl.value as Mode;lastSample=lastUi=0;syncRefresh();showStatus();},{signal:events.signal});
  clockControl.addEventListener('change',()=>{
    const preview=clockControl.value==='preview';$('gym-weather-date-label').hidden=!preview;
    previewTime=preview?parsePacificDateTime(dateControl.value):null;
    if(preview&&mode==='live'){mode='clouds';modeControl.value=mode;syncRefresh();}
    lastSample=lastUi=0;showStatus();
  },{signal:events.signal});
  dateControl.addEventListener('change',()=>{
    const parsed=parsePacificDateTime(dateControl.value);dateControl.setCustomValidity(parsed===null?'Choose a valid Pacific local date and time.':'');
    if(parsed!==null){previewTime=parsed;lastSample=lastUi=0;}else dateControl.reportValidity();
  },{signal:events.signal});
  $('gym-weather-refresh').addEventListener('click',()=>void refresh(true),{signal:events.signal});
  $('gym-weather-live').addEventListener('click',()=>{mode='live';modeControl.value='live';clockControl.value='live';previewTime=null;$('gym-weather-date-label').hidden=true;lastSample=lastUi=0;syncRefresh();showStatus();},{signal:events.signal});
  document.addEventListener('visibilitychange',syncRefresh,{signal:events.signal});
  function update(frame:WeatherFrame){
    if(disposed)return;lastFrame=frame;
    const now=Date.now();
    if(!lastSample||now-lastSample>=1000){lastSample=now;astro=computeSkyAstronomy(previewTime??now);data=client.snapshot(now);}
    const preset=mode==='live'?null:PRESETS[mode];
    const targetCloud=clamp(preset?.cloud??data.cloudCover01.value??.38);
    const targetRain=Math.max(0,preset?.rain??data.rainMmHour.value??0);
    const targetVisibility=clamp(preset?.visibility??data.visibilityMetres.value??15000,80,100000);
    const targetWind=clamp(preset?.wind??data.windSpeedMps.value??3,0,30),targetBearing=data.windFromDegrees.value??300;
    const ease=initialized&&!frame.reducedMotion?1-Math.exp(-frame.dt*.7):1;initialized=true;
    cloud+=(targetCloud-cloud)*ease;rain+=(targetRain-rain)*ease;visibility+=(targetVisibility-visibility)*ease;windSpeed+=(targetWind-windSpeed)*ease;windBearing+=(((targetBearing-windBearing+540)%360)-180)*ease;
    // FROM north means motion south: scene north is -Z, east +X.
    wind.set(-Math.sin(windBearing*Math.PI/180)*windSpeed,Math.cos(windBearing*Math.PI/180)*windSpeed);
    sunDirection.fromArray(astro.sun.direction);moonDirection.fromArray(astro.moon.direction);
    const altitude=astro.sun.altitude*180/Math.PI,daylight=smooth(-8,6,altitude),sunUp=smooth(-.6,5,altitude);
    const moonUp=smooth(-1,8,astro.moon.altitude*180/Math.PI),moonFill=moonUp*astro.moon.illumination*(1-daylight);
    const wet=clamp(rain/5),rainAmount=clamp(Math.sqrt(rain/5)),lightLevel=.07+.93*daylight*(1-.28*wet)+.09*moonFill;
    environment.paintExposure.value=lightLevel;
    const haze=1-smooth(250,3000,visibility);
    // Focused surface light needs direct sun. Moonlight, thick cloud and coastal fog
    // should not leave a bright emissive web across the seabed. No shader rebuild.
    environment.caustics.illumination.value=sunUp*(1-cloud)**2*(1-haze);
    sky.uniforms.horizon.value.copy(STYLE.dome.horizon).lerp(marineFog,haze*.9);
    sky.uniforms.zenith.value.copy(STYLE.dome.zenith).lerp(marineFog,haze*.4);
    keyColor.copy(STYLE.sun.color).lerp(warmSun,1-smooth(1,24,altitude));
    shadows.update(sunDirection);
    sun.shadow.intensity=1-.7*cloud;
    sun.shadow.autoUpdate=sunUp>.01;
    sun.color.copy(keyColor);sun.intensity=STYLE.sun.intensity*sunUp*(1-.72*cloud);
    moon.position.copy(moonDirection).multiplyScalar(100);moon.intensity=.24*moonFill*(1-.7*cloud);
    ambient.color.copy(moonColor).lerp(STYLE.sky.color,daylight);ambient.groundColor.copy(nightGround).lerp(STYLE.sky.ground,daylight);ambient.intensity=.16+.12*moonFill+(STYLE.sky.intensity-.16)*daylight*(1-.32*cloud);
    environment.sun.value.copy(sunUp>.03?sunDirection:moonDirection);environment.color.value.copy(sunUp>.03?keyColor:moonColor);environment.strength.value=RIM_STRENGTH*(sunUp*(1-.65*cloud)+.15*moonFill);
    sky.update({time:frame.time,sunDirection,moonDirection,daylight,cloudCover:cloud,rain:rainAmount,wind,cameraPosition:camera.position,siderealTime:astro.localSiderealTime,reducedMotion:frame.reducedMotion,underwater:frame.underwater});
    if(frame.overview)sky.rain.visible=false;
    zenith.copy(sky.colors.zenith);horizon.copy(sky.colors.horizon);
    // Surface geometry and buoyancy retain their authored scale; weather only changes shading.
    if(!frame.underwater){
      const fog=scene.fog as Fog;
      fog.color.copy(horizon);scene.background instanceof Color&&scene.background.copy(horizon);
      const far=Math.min(2400,visibility*(.18+.82*(1-smooth(800,10000,visibility))));
      const overviewOffset=frame.overview?camera.position.y*.65:0;
      fog.near=Math.max(3,Math.min(far*.12,160))+overviewOffset;fog.far=Math.max(fog.near+40,far+overviewOffset);
    }
    const waterFog=scene.fog as Fog;
    frame.water?.setEnvironment({sunDirection,sunColor:keyColor,sunStrength:sunUp*(1-cloud)**2*(1-haze),skyZenith:zenith,skyHorizon:horizon,lightLevel,fogColor:frame.underwater?undefined:waterFog.color,fogNear:waterFog.near,fogFar:waterFog.far});
    if(!lastUi||now-lastUi>5000){lastUi=now;showStatus();}
  }
  showStatus();
  return {root:sky.root,sky,environment,sun,moon,ambient,shadows,
    setActive(value:boolean){active=value;if(!value)environment.reset();syncRefresh();showStatus();},
    update,refresh,
    getSnapshot(){return {mode,previewTime,active,astronomy:astro,data,visual:{cloudCover:cloud,rainMmHour:rain,visibilityMetres:visibility,wind:wind.toArray(),sunIntensity:sun.intensity,moonIntensity:moon.intensity},budget:sky.budget,shadows:shadows.getSnapshot(),underwater:lastFrame?.underwater??false};},
    dispose(){disposed=true;events.abort();if(timer)clearInterval(timer);client.dispose();sky.dispose();environment.dispose();panel.remove();shadows.dispose();sun.shadow.dispose();scene.remove(sun,sun.target,moon,ambient);}
  };
}
