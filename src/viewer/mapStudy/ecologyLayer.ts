import { surveyedHeight } from '../testingGym/bathymetry';
import { GYM_WATER_LEVEL } from '../testingGym/elevation';
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import region from '../../data/monterey-bay-region.json';
import { createEcologyService, ECOLOGY_REEF, ECOLOGY_SPECIES, ECOLOGY_SPECIES_IDS, LIFE_STAGE_LABELS, habitatAt, planPopulation, type EcologyFilter, type Evidence, type LifeStage, type SpeciesId } from '../../data/ecology';
import type { FeedLocation } from '../../data/liveFeeds';
interface Options {
  host: HTMLElement; mount: HTMLElement; camera: PerspectiveCamera;
  project: (point: [number, number]) => Vector2;
  unproject: (x: number, z: number) => [number, number];
  focus: (locations: FeedLocation[], includeCoverage: boolean) => void;
  draw: () => void;
}
const names: Record<Evidence['status'], string> = { detected: 'Detected historically', 'not-detected': 'Explicit zero catches', 'not-recorded': 'Stage/species not recorded', 'no-survey': 'No survey in selected period', 'outside-coverage': 'Outside cache' };
const colors: Record<Evidence['status'], string> = { detected: '#69d6a6', 'not-detected': '#efb66f', 'not-recorded': '#bbb9e1', 'no-survey': '#a2b4b8', 'outside-coverage': '#a2b4b8' };
/** Demand-rendered DOM canvas overlay: zero 3D submissions, textures, animation loops or provider calls. */
export function createEcologyLayer(o: Options) {
  const service = createEcologyService(), abort = new AbortController();
  let mapVisible = true, selected: [number, number] = [ECOLOGY_REEF.longitude, ECOLOGY_REEF.latitude], selectedLabel = 'Lovers Point authored reef';
  let filter: EcologyFilter = { speciesId: 'blue-rockfish', lifeStage: 'Y' }, summaries = service.summarize(filter);
  const panel = document.createElement('details'); panel.id = 'map-ecology'; panel.className = 'map-ecology-tools';
  panel.innerHTML = `<summary>Fish ecology · NOAA surveys</summary><label><input id="ecology-show" type="checkbox"> Show survey grid</label><p>Historical midwater-trawl evidence · 2 km cells · 2015–2025. Select a water cell on the map to inspect it.</p><label>Species <select id="ecology-species">${ECOLOGY_SPECIES_IDS.map(id => `<option value="${id}">${ECOLOGY_SPECIES[id].name}</option>`).join('')}</select></label><label>Life stage <select id="ecology-stage">${(['Y','A','U','all'] as const).map(stage => `<option value="${stage}">${LIFE_STAGE_LABELS[stage]}</option>`).join('')}</select></label><label>Year <select id="ecology-year"><option value="">All sampled years</option>${Array.from({length:11},(_,i)=>`<option>${2015+i}</option>`).join('')}</select></label><label>Month <select id="ecology-month"><option value="">All sampled months</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}">${new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2025,i,15)))}</option>`).join('')}</select></label><p class="ecology-key"><span style="color:#69d6a6">● Detected</span> <span style="color:#efb66f">● Explicit zero</span><br><span style="color:#bbb9e1">● Not recorded</span> <span style="color:#a2b4b8">● No survey</span></p><p id="ecology-summary" role="status"></p><label>Survey cell <select id="ecology-cell"><option value="">Choose sampled cell…</option>${service.cells.filter(c=>service.query(c.longitude,c.latitude,filter).representedHauls>0).map(c=>`<option value="${c.id}">${c.id} · ${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}</option>`).join('')}</select></label><div class="ecology-actions"><button id="ecology-focus">Focus selected cell</button><button id="ecology-reef">Lovers Point reef</button></div><div id="ecology-inspector" aria-live="polite"></div><details><summary>Game population recipe</summary><p>Older/post-settlement representatives only. Counts and habitat scores are authored game tuning. A seed reproduces the plan; it does not estimate real population size.</p><label>Seed <input id="ecology-seed" type="number" value="6256" step="1"></label><label><input id="ecology-infer" type="checkbox"> Allow inferred habitat placements</label><p id="ecology-plan" role="status"></p><button id="ecology-download">Download game recipe</button></details><details><summary>Sources &amp; limits</summary><p>${service.data.hauls.length} represented hauls, ${service.data.observations.length} species/stage records. NOAA RREAS net-in points; all catches are historical samples. Cells are our aggregation, not NOAA DisMAP.</p><p>Grey means no survey in this selection; it does not mean no fish. Zero catches are non-detections. Missing species/stages are not zero. Juvenile detections do not establish adult abundance. Tow effort and catchability are unavailable here, so population estimates and relative abundance remain uncalibrated.</p><p>Reef habitat is the authored Gym footprint. Other seabed habitat is unknown. Depth uses retained USGS samples near Lovers Point and coarse ETOPO1 offshore, relative to authored water levels. Game callers can supply their own detailed sampler.</p><p><a href="${service.data.source.metadataUrl}" target="_blank" rel="noopener">NOAA survey metadata ↗</a><br><a id="ecology-species-source" target="_blank" rel="noopener">Species habitat reference ↗</a></p></details>`;
  const style = document.createElement('style'); style.textContent = `.map-ecology-tools{border-top:1px solid #bdd4be35;padding-top:8px}.map-ecology-tools summary{color:#ffe0ac;font-weight:600;min-height:30px}.map-ecology-tools p{line-height:1.5;overflow-wrap:anywhere}.map-ecology-tools select{flex:1;font-size:11px}.map-ecology-tools button{min-height:44px;background:#315151;color:inherit;border-radius:7px;padding:8px;font-size:11px}.map-ecology-tools button:focus-visible,.map-ecology-tools a:focus-visible{outline:3px solid #ffe0ac}.map-ecology-tools a{color:#ffe0ac}.ecology-actions{display:flex;gap:6px;flex-wrap:wrap}.map-ecology-tools input[type=number]{max-width:110px;background:#315151;color:inherit;border:1px solid #bdd4be55;border-radius:5px;min-height:36px}.ecology-overlay{position:absolute;inset:0;pointer-events:none}.ecology-status{color:#ffe0ac;font-weight:600}`;
  panel.prepend(style);o.host.querySelector('.map-status')!.after(panel);
  const canvas = document.createElement('canvas');canvas.className='ecology-overlay';canvas.setAttribute('aria-hidden','true');o.mount.append(canvas);
  const ctx=canvas.getContext('2d')!;
  const $ = <T extends HTMLElement>(id:string)=>panel.querySelector<T>('#'+id)!;
  const show = ()=>$<HTMLInputElement>('ecology-show').checked;
  const on=(id:string,event:string,fn:()=>void)=>$(id).addEventListener(event,fn,{signal:abort.signal});
  function contextAt(lon:number,lat:number) {
    const context=habitatAt(lon,lat),x=(lon+121.91685)*(6371008.8*Math.PI/180*Math.cos(36.6256*Math.PI/180)),z=-(lat-36.6256)*(6371008.8*Math.PI/180),height=surveyedHeight(x,z);
    if(context.isWater&&height!==undefined&&height<GYM_WATER_LEVEL)return {...context,bottomDepthMeters:GYM_WATER_LEVEL-height,basis:context.habitat==='kelp-reef'?ECOLOGY_REEF.basis+'; retained USGS bathymetry relative to authored Gym water level':'Unknown substrate; retained USGS bathymetry relative to authored Gym water level'};
    return context;
  }
  function recipe() { const seed = Number($<HTMLInputElement>('ecology-seed').value);return planPopulation(service,{ longitude:selected[0],latitude:selected[1],seed,year:filter.year,month:filter.month,lifeStage:'A',contextAt,allowHabitatInference:$<HTMLInputElement>('ecology-infer').checked }); }
  function inspect() {
    const e=service.query(...selected,filter),habitat=contextAt(...selected),species=ECOLOGY_SPECIES[filter.speciesId];
    const nodes=[selectedLabel, `${selected[1].toFixed(5)}° N, ${Math.abs(selected[0]).toFixed(5)}° W · Cell ${e.cell?.id??'outside'}`, names[e.status], `${e.detectedHauls}/${e.speciesHauls} species/stage hauls detected; ${e.explicitZeroRows} explicit zero rows.`, `${e.catchCount.toLocaleString()} specimens caught across samples · not a local population count.`, `Sample years: ${e.years.join(', ')||'none'}; last sample: ${e.lastSample?.slice(0,10)??'none'}.`, `Habitat: ${habitat.habitat}; depth: ${habitat.bottomDepthMeters===null?'unknown':habitat.bottomDepthMeters.toFixed(1)+' m (source-relative)'}.`, 'Relative abundance and population: uncalibrated.', species.habitat];
    $('ecology-inspector').replaceChildren(...nodes.map((text,i)=>{const p=document.createElement('p');p.textContent=text;if(i===2)p.className='ecology-status';return p;}));
    $<HTMLAnchorElement>('ecology-species-source').href=species.references[0];
    try { const plan=recipe();$('ecology-plan').textContent=`${plan.individualCount} game representatives in ${plan.groups.length} groups (all three pilot species; older stage). ${plan.groups.filter(g=>g.basis==='inferred-habitat').length} groups use inferred habitat. Cap: ${plan.maxIndividuals}.`; $<HTMLButtonElement>('ecology-download').disabled=false; }
    catch { $('ecology-plan').textContent='Enter an integer seed to create a recipe.';$<HTMLButtonElement>('ecology-download').disabled=true; }
    $<HTMLSelectElement>('ecology-cell').value=e.cell?.id??'';
  }
  function refresh() {
    filter={speciesId:$<HTMLSelectElement>('ecology-species').value as SpeciesId,lifeStage:$<HTMLSelectElement>('ecology-stage').value as LifeStage|'all',year:Number($<HTMLSelectElement>('ecology-year').value)||undefined,month:Number($<HTMLSelectElement>('ecology-month').value)||undefined};
    summaries=service.summarize(filter);
    const observed=summaries.filter(e=>e.status==='detected').length,zeros=summaries.filter(e=>e.status==='not-detected').length;
    $('ecology-summary').textContent=`${observed} detected cells · ${zeros} cells with explicit zeros · ${summaries.filter(e=>e.status==='no-survey').length} cells without survey records in this selection.`;
    inspect();o.draw();
  }
  const world=new Vector3(),screen=new Vector2(),ray=new Raycaster(),plane=new Plane(new Vector3(0,1,0),-12);
  function point(lon:number,lat:number,w:number,h:number) { const p=o.project([lon,lat]);world.set(p.x,12,-p.y).project(o.camera);return {x:(world.x*.5+.5)*w,y:(-world.y*.5+.5)*h,visible:world.z>=-1&&world.z<=1}; }
  function polygon(points: number[][],w:number,h:number) {let valid=true;points.forEach((p,i)=>{const v=point(p[0],p[1],w,h);if(!v.visible)valid=false;i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y);});ctx.closePath();return valid;}
  function update() {
    const visible=mapVisible&&show();canvas.hidden=!visible;if(!visible)return;
    const w=o.mount.clientWidth,h=o.mount.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.save();
    // Clip the diagnostic surface to cached regional water, including polygon holes.
    ctx.beginPath();for(const p of region.water)for(const ring of p)polygon(ring.map(([x,z])=>[region.origin[0]+x/(6371008.8*Math.PI/180*Math.cos(region.origin[1]*Math.PI/180)),region.origin[1]-z/(6371008.8*Math.PI/180)]),w,h);ctx.clip('evenodd');
    for(const e of summaries){const c=e.cell!,[west,south,east,north]=c.bounds;ctx.beginPath();if(!polygon([[west,south],[east,south],[east,north],[west,north]],w,h))continue;ctx.fillStyle=colors[e.status];ctx.globalAlpha=e.status==='no-survey'?.06:.32;ctx.fill();ctx.globalAlpha=.45;ctx.lineWidth=.5;ctx.strokeStyle=colors[e.status];ctx.stroke();}
    const selectedCell=service.cellAt(...selected);if(selectedCell){const [west,south,east,north]=selectedCell.bounds;ctx.beginPath();polygon([[west,south],[east,south],[east,north],[west,north]],w,h);ctx.globalAlpha=1;ctx.lineWidth=2;ctx.strokeStyle='#fff0c5';ctx.stroke();}
    const p=point(...selected,w,h);if(p.visible){ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.globalAlpha=1;ctx.fillStyle='#fff0c5';ctx.fill();}
    ctx.restore();
  }
  let down: [number,number]|undefined;
  o.mount.addEventListener('pointerdown',e=>{if(e.target instanceof HTMLCanvasElement&&e.target!==canvas)down=[e.clientX,e.clientY];else down=undefined;},{signal:abort.signal});
  o.mount.addEventListener('pointerup',e=>{if(!down||!show()||!mapVisible)return;const start=down;down=undefined;if(Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;const rect=o.mount.getBoundingClientRect();screen.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(screen,o.camera);if(ray.ray.intersectPlane(plane,world)){selected=o.unproject(world.x,world.z);selectedLabel='Selected map location';inspect();o.draw();}},{signal:abort.signal});
  function focusSelected() { o.focus([{id:'ecology-selection',name:selectedLabel,longitude:selected[0],latitude:selected[1],positionKind:'venue',uncertaintyMeters:1000,basis:'Authored ecology inspection cell',sourceUrls:[service.data.source.metadataUrl],gamePlace:'ecology'}],false); }
  for(const id of ['ecology-species','ecology-stage','ecology-year','ecology-month'])on(id,'change',refresh);
  on('ecology-show','change',()=>o.draw());on('ecology-infer','change',inspect);on('ecology-seed','input',inspect);
  on('ecology-cell','change',()=>{const c=service.cells.find(c=>c.id===$<HTMLSelectElement>('ecology-cell').value);if(c){selected=[c.longitude,c.latitude];selectedLabel='Selected survey cell';inspect();o.draw();}});
  on('ecology-focus','click',focusSelected);
  on('ecology-reef','click',()=>{selected=[ECOLOGY_REEF.longitude,ECOLOGY_REEF.latitude];selectedLabel='Lovers Point authored reef';inspect();o.focus([{id:'ecology-reef',name:selectedLabel,longitude:selected[0],latitude:selected[1],positionKind:'venue',uncertaintyMeters:40,basis:ECOLOGY_REEF.basis,sourceUrls:[service.data.source.metadataUrl],gamePlace:'ecology'}],false);});
  on('ecology-download','click',()=>{const blob=new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='monterey-ecology-recipe.json';a.click();URL.revokeObjectURL(url);});
  const open=new URLSearchParams(location.search).has('ecology');panel.open=open;$<HTMLInputElement>('ecology-show').checked=open;
  // Defer the first draw until the parent has assigned this layer.
  filter={speciesId:'blue-rockfish',lifeStage:'Y'};summaries=service.summarize(filter);inspect();$('ecology-summary').textContent=`${service.data.hauls.length} historical hauls · ${service.data.observations.length} species/stage records · 2 km cells.`;
  return {service,canvas,panel,update,setMapVisible(value:boolean){mapVisible=value;canvas.hidden=!value||!show();},get selection(){return [...selected];},get filter(){return {...filter};},dispose(){abort.abort();canvas.remove();panel.remove();}};
}
