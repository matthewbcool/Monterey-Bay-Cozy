import './viewer/gymDiagnostics.css';
import { setGymLoading } from './viewer/gymLoading';
/** Browser composition root for Tank/Area/Objects and lazy Map/Avatar workbenches.
 * Importing this module creates the app; inspection must reuse the document's loaded entry URL.
 * Models remain independent of this owner. See docs/codebase.md and src/viewer/README.md.
 */
import './style.css';
import { Box3 } from 'three';
import { createLodController } from './models/shared/lod/controller';
import { LOD_LEVELS, type LodMode } from './models/shared/lod/geometry';
import { modelStats } from './viewer/modelStats';
import { Color, DirectionalLight, Fog, FogExp2, HemisphereLight, MathUtils, Mesh, PerspectiveCamera, Scene, Vector3, PCFShadowMap, Spherical } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fishCollection } from './models/catalogue';
import { formatSizeRange } from './models/sizeRanges';
import type { FishLifeState, FishModel, SwimMode } from './models/types';
import { createSardineSchool, type SardineSchool } from './models/pacific-sardine/createSardineSchool';
import { createTank } from './viewer/tank';
import { createTankDemo } from './viewer/tankDemo';
import { createSwimmer, TANK_SIZE } from './viewer/swimPath';
import { createHarbor } from './viewer/harbor';
import {sampleWater} from './viewer/water';
import {seabedDepth} from './viewer/bathymetry';
import { createObjectPreview } from './viewer/objects';
import { propCollection, SIZE_REFERENCES } from './models/props/catalogue';
import { STYLE, exportableClone } from './models/shared/style';
import { createSky } from './viewer/sky';
import { applyNodeStyle, RIM, RIM_STRENGTH } from './viewer/nodeStyle';
import { lowerTier, pickTier, QUALITY_TIERS, shouldStepDown, TIER_SETTINGS, type QualityTier } from './viewer/quality';

const entry=fishCollection[0];
const icons={
  pause:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  play:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7Z" fill="currentColor"/></svg>',
};
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
  <nav class="asset-tabs" role="tablist" aria-label="Asset debuggers">
    <button id="tab-tank" role="tab" aria-selected="true" aria-controls="stage" tabindex="0">Tank</button>
    <button id="tab-area" role="tab" aria-selected="false" aria-controls="stage" tabindex="-1">Area &amp; buildings</button>
    <button id="tab-objects" role="tab" aria-selected="false" aria-controls="stage" tabindex="-1">Objects</button>
    <button id="tab-map" role="tab" aria-selected="false" aria-controls="panel-map" tabindex="-1">Map study</button>
    <button id="tab-avatars" role="tab" aria-selected="false" aria-controls="panel-avatars" tabindex="-1">Avatars</button>
    <button id="tab-gym" role="tab" aria-selected="false" aria-controls="panel-gym" tabindex="-1">Testing Gym</button>
  </nav>
  <div class="quality-control"><label for="quality-select">Quality</label><select id="quality-select" title="Base: phones · Standard: rim light and refraction"></select></div>
  <aside class="lod-control" aria-label="Level of detail"><label for="lod-select">Detail</label><select id="lod-select"><option value="auto">Auto · distance</option><option value="near">Near · LOD 0</option><option value="mid">Mid · LOD 1</option><option value="far">Far · LOD 2</option></select><details><summary>Detail levels</summary><p>Zoom out to reduce detail automatically. Pin a level to inspect its shape and animation.</p><table><thead><tr><th>Level</th><th>Triangles</th><th>Draws</th></tr></thead><tbody id="lod-variants"></tbody></table><output id="lod-status" aria-live="polite"></output></details></aside>
  <div id="stage" role="tabpanel" aria-labelledby="tab-tank"></div>
  <section id="panel-area" class="scene-interface" aria-label="Dockside study controls" hidden>
    <div class="scene-toolbar"><div><span class="eyebrow">Water study</span><strong>Quiet dockside</strong></div><div class="object-actions"><button id="water-detail" aria-pressed="false">Water detail</button><button id="water-underwater" aria-pressed="false">Underwater</button><button id="harbor-reset">Reset view</button></div></div>
    <div class="water-controls"><label for="water-chop">Ripples <span id="water-value">Gentle</span></label><input id="water-chop" type="range" min="0" max="1.5" step=".05" value=".75"><button id="harbor-pause" aria-label="Pause water">Pause</button></div>
    <div class="dive-controls" id="dive-controls" hidden><label for="dive-depth">Viewing depth <output id="dive-value">2.0 m</output></label><input id="dive-depth" type="range" min=".5" max="5.5" step=".1" value="2"><label for="water-visibility">Visibility <output id="visibility-value">14 m</output></label><input id="water-visibility" type="range" min="6" max="24" step="1" value="14"></div>
    <p class="scene-caption" id="water-caption">Rippling reflections · a sandy shelf below</p>
  </section>
  <section id="panel-objects" class="scene-interface" aria-label="Object inspection controls" hidden>
    <div class="scene-toolbar"><div class="object-picker"><label for="object-select">Collection <span id="object-total"></span></label><select id="object-select"></select></div><div class="object-actions"><button id="object-compare" aria-pressed="false">Compare sizes</button><button id="object-regenerate" hidden>Regenerate</button><button id="object-reset">Reset view</button><button id="export-object">Save GLB</button></div></div>
    <div class="object-details"><span id="object-category" class="eyebrow"></span><h1 id="object-name"></h1><p id="object-description"></p><p id="object-dimensions" class="asset-measure"></p><p id="object-stats" class="asset-measure"></p><label id="object-group-control" for="object-group" hidden>Group <select id="object-group"></select></label><label id="object-pose-control" for="object-pose" hidden>Pose <select id="object-pose"></select></label><p id="scale-key" hidden>1 m grid · 1.8 m height marker</p><div class="object-navigation"><button id="object-prev" aria-label="Previous object" aria-keyshortcuts="ArrowLeft" title="Previous object (Left arrow)">←</button><span id="object-count"></span><button id="object-next" aria-label="Next object" aria-keyshortcuts="ArrowRight" title="Next object (Right arrow)">→</button><button id="object-rotate" aria-pressed="false">Turntable</button><button id="object-motion" aria-pressed="false" hidden>Play motion</button></div><span id="export-status" role="status"></span></div>
  </section>
  <section id="panel-map" role="tabpanel" aria-labelledby="tab-map" hidden></section>
  <section id="panel-avatars" role="tabpanel" aria-labelledby="tab-avatars" hidden></section>
  <section id="panel-gym" role="tabpanel" aria-labelledby="tab-gym" hidden></section>
  <div class="interface">
    <div class="creature-control"><label for="creature-select">Creature</label><select id="creature-select" title="Left and right arrows switch fish when the tank is focused"></select><label class="demo-toggle" for="demo-mode"><input id="demo-mode" type="checkbox" aria-keyshortcuts="D"> Demo mode <kbd class="demo-key" aria-hidden="true">D</kbd></label><label for="school-count" id="school-label" hidden>Group</label><select id="school-count" hidden><option value="0">Single fish</option><option value="16">School of 16</option><option value="48" selected>School of 48</option><option value="128">School of 128</option><option value="256">School of 256</option></select><div class="view-state-controls"><div class="camera-controls" role="group" aria-label="Camera view"><button id="view-tank" title="Up / Down arrows toggle camera view" aria-pressed="true" class="active">Whole tank</button><button id="view-follow" title="Up / Down arrows toggle camera view" aria-pressed="false">Follow fish</button></div><label id="life-state-label" for="life-state">State</label><select id="life-state"><option value="alive">Swimming</option><option value="caught">Caught</option></select></div><div class="fish-size"><output id="fish-size"></output><span id="demo-population" hidden>6 tuna · 256 sardines<br>1 great white · 2 turtles</span><output id="fish-mesh-stats" class="fish-mesh-stats"></output><span class="fish-mesh-scope">Model per color pass · tank / shadows extra</span><details id="fish-mesh-details"><summary>Mesh notes</summary><div class="size-notes"><p id="fish-mesh-note"></p></div></details><details id="fish-size-details"><summary>Size notes</summary><div class="size-notes"><p id="fish-model-size"></p><p id="fish-size-basis"></p><p id="fish-size-note"></p><p>Foreground visitors: adults 1.58–1.85 m tall; children 1.20 m and 1.30 m. Fish and people share the same physical scale. Perspective changes their apparent size.</p><div id="fish-size-sources"></div></div></details></div></div>
    <p id="visitor-scale" class="visitor-scale">Visitors · 1.20–1.85 m tall</p>
    <footer><div class="playback" role="group" aria-label="Swimming controls"><button id="mode-slow" aria-pressed="true" class="active"><span class="speed-symbol">≈</span> Slow cruise</button><button id="mode-fast" aria-pressed="false"><span class="speed-symbol">»</span> Fast swim</button><button id="mode-cycle" aria-pressed="false"><span class="speed-symbol">↻</span> Cycle</button><span class="divider"></span><span id="demo-motion-label" class="demo-motion-label" hidden>Natural swim · varied pace</span><button id="pause" class="pause" aria-label="Pause animation">${icons.pause}</button></div></footer>
  </div><p class="error" id="error" role="alert" hidden></p>`;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const stage=$('stage');
const creatureSelect=$<HTMLSelectElement>('creature-select');
for(const creature of fishCollection)creatureSelect.add(new Option(creature.name,creature.id));
const params=new URLSearchParams(location.search);
document.querySelector('.creature-control')!.append(document.querySelector('.lod-control')!);
function showError(message:string){$('error').hidden=false;$('error').textContent=message;}
// One renderer for the primary asset scenes (the map has a lazy, demand-rendered viewport): native WebGPU where available, otherwise its WebGL 2 backend (`?webgl` forces it).
const renderer=new WebGPURenderer({antialias:true,alpha:false,powerPreference:'high-performance',forceWebGL:params.has('webgl')});
const lod=createLodController();
renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap; // crisp toon-friendly shadow edge; cheaper than soft PCF
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Aquarium. Left and right arrows switch fish; up and down toggle camera view. Drag to orbit; use the controls to change swimming.');stage.append(renderer.domElement);
const scene=new Scene();scene.background=new Color('#081524');scene.fog=new Fog('#0e2a33',180,280);
// Warm key + cool sky fill: the hemisphere color is what core shadows show.
const ambient=new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity);scene.add(ambient);
const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);sun.position.copy(STYLE.sun.direction).multiplyScalar(24);scene.add(sun);
const sky=createSky();sky.root.visible=false;scene.add(sky.root);
sun.castShadow=true;sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.camera.far=80;sun.shadow.normalBias=.06;sun.shadow.bias=-.0006;
const camera=new PerspectiveCamera(40,1,.02,320);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=1;controls.maxDistance=190;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.15;
let fish:FishModel|SardineSchool=entry.create(),swimmer=createSwimmer(fish,entry.swimSpeed);
const tank=createTank();tank.water.setShadowLight(sun);scene.add(tank.root,fish.root);
const harbor=createHarbor(),objects=createObjectPreview();scene.add(harbor.root,objects.root);harbor.root.visible=false;objects.root.visible=false;
// Node toon materials with the TSL rim; call again whenever new assets join the scene (cached per source material).
applyNodeStyle(scene);tank.shadeCreature(fish.root);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let objectSize=new Vector3(3,3,6);
let demo:ReturnType<typeof createTankDemo>|undefined;
let preDemoView:'tank'|'follow'='tank';
const state={demo:false,paused:reducedMotion.matches,mode:'slow' as SwimMode|'cycle',cycleTime:0,simulationTime:0,view:'tank' as 'tank'|'follow',creatureId:entry.id,schoolCount:48,tab:'tank',objectId:'rowboat',objectInstances:1,compare:false,objectHeight:3,waterTime:0,chop:.75,harborView:'overview' as 'overview'|'surface'|'underwater',diveDepth:2,visibility:14,underwater:false,turntable:false,objectMotion:false,running:true,quality:'standard' as QualityTier,qualityReason:'',backend:'pending' as 'pending'|'WebGPU'|'WebGL 2'};
let surfaceFollowBaseY=0,surfaceFollowOffsetY=0;
function surfaceFollowHeight(targetY:number){
  const depth=TANK_SIZE.height/2-targetY;
  const t=Math.max(0,Math.min(1,(.20-depth)/.15)),exposed=t*t*(3-2*t);
  // Stay below the opaque water while submerged, then lift as the head emerges.
  return MathUtils.lerp(Math.min(surfaceFollowBaseY,depth-.08),surfaceFollowBaseY,exposed);
}
const abort=new AbortController(),signal=abort.signal;
const on=(id:string,type:string,fn:EventListener)=>$(id).addEventListener(type,fn,{signal});
function fitDistance(base:number){return base*Math.max(1,1.35/camera.aspect);}
function tankDistance(){
  // The reference crops the 90-foot window; frame a central 22 m span from visitor eye height.
  const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;
  return TANK_SIZE.depth/2+Math.max((state.demo?TANK_SIZE.width/2+.4:11)/(tanH*.94),(TANK_SIZE.height/2+.5)/(tanV*.87));
}
function setView(view:'tank'|'follow'){
  if(state.demo&&state.tab==='tank')view='tank';
  camera.clearViewOffset();
  state.view=view;tank.gallery.visible=view==='tank';$('visitor-scale').hidden=view!=='tank';
  if(state.tab==='area'){setHarborView(state.harborView);return;}
  if(state.tab==='objects'){
    controls.target.set(0,state.objectHeight*.48,0);const direction=new Vector3(.85,.55,1).normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize(),up=new Vector3().crossVectors(direction,right).normalize();
    const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;
    const heightFill=camera.aspect<.8?.52:.72;
    let distance=.08;controls.minDistance=Math.max(.015,Math.min(objectSize.x,objectSize.y,objectSize.z)*.5);
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      const corner=new Vector3(x*objectSize.x/2,y*objectSize.y/2,z*objectSize.z/2);
      distance=Math.max(distance,Math.abs(corner.dot(right))/(tanH*.80)+corner.dot(direction),Math.abs(corner.dot(up))/(tanV*heightFill)+corner.dot(direction));
    }
    camera.position.copy(controls.target).add(direction.multiplyScalar(distance));camera.lookAt(controls.target);controls.update();return;
  }
  const length=fish.root.userData.lengthMeters??1.2;
  controls.minDistance=Math.max(.06,length*.75);
  const halfFov=camera.fov*Math.PI/360;
  const schoolDistance='bounds' in fish?fish.bounds.getSize(new Vector3()).length()*.5/Math.sin(Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect)))/.82:0;
  const size=fish.root.userData.inspectionSizeMeters as readonly number[]|undefined;
  // Tall species need independent width/height framing, especially on narrow phones.
  const fishDistance=size?Math.max(size[0]/(2*Math.tan(halfFov)*camera.aspect*.78),size[1]/(2*Math.tan(halfFov)*.70))+size[2]:fitDistance(length*2.25);
  const distance=view==='tank'?tankDistance():(schoolDistance||fishDistance)*(fish.root.userData.locomotion==='surface-otter'?1.35:1);
  controls.target.copy(view==='tank'?new Vector3(0,-.4,0):fish.root.position);
  const followDirection=fish.root.userData.followDirection as readonly [number,number,number]|undefined;
  const viewDirection=view==='tank'?new Vector3(0,-.10,1):followDirection?new Vector3(...followDirection):new Vector3(.17,.17,1);
  camera.position.copy(controls.target).add(viewDirection.normalize().multiplyScalar(distance));
  surfaceFollowBaseY=camera.position.y-controls.target.y;surfaceFollowOffsetY=surfaceFollowBaseY;
  if(view==='follow'&&fish.root.userData.locomotion==='surface-otter'){
    surfaceFollowOffsetY=surfaceFollowHeight(controls.target.y);
    camera.position.y=controls.target.y+surfaceFollowOffsetY;
  }
  camera.lookAt(controls.target);controls.update();
  // Surface-follow poses also rise toward the panel on desktop; keep their
  // head in the same usable space below the controls as narrow-screen fish.
  if(view==='follow'&&(camera.aspect<.8||fish.root.userData.locomotion==='surface-otter')){
    const canvas=renderer.domElement.getBoundingClientRect(),top=document.querySelector('.creature-control')!.getBoundingClientRect().bottom;
    const bottom=$('pause').getBoundingClientRect().top;
    const center=(top+bottom)/2-canvas.top,offset=center-canvas.height/2;
    camera.setViewOffset(stage.clientWidth,stage.clientHeight,0,-offset,stage.clientWidth,stage.clientHeight);
  }
  for(const name of ['tank','follow']){$('view-'+name).classList.toggle('active',view===name);$('view-'+name).setAttribute('aria-pressed',String(view===name));}
}
function resize(){
  if(stage.hidden||!stage.clientWidth||!stage.clientHeight)return;
  camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();renderer.setSize(stage.clientWidth,stage.clientHeight);setView(state.view);
}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
function updateMeshStats(){
  if(demo){
    const {model}=modelStats(demo.root),number=(n:number)=>n.toLocaleString('en-US');
    $('fish-mesh-stats').textContent=`${number(model.drawCalls)} draw calls · ${number(model.triangles)} triangles`;
    $('fish-mesh-note').textContent=`All ${demo.count} demo creatures at active LOD before camera culling. The 256 sardines share one instanced draw; other creatures keep their individual animation rigs. Tank, shadows, extra transparency passes and postprocessing are excluded. LOD counts reflect the currently selected detail.`;
    return;
  }
  if(!fish.root.visible)return;
  const {model}=modelStats(fish.root);
  const count='count' in fish?fish.count:1;
  const number=(n:number)=>n.toLocaleString('en-US');
  $('fish-mesh-stats').textContent=`${count>1?`${count} fish · `:''}${number(model.drawCalls)} draw ${model.drawCalls===1?'call':'calls'} · ${number(model.triangles)} triangles`;
  $('fish-mesh-note').textContent=`Visible ${fish.getState().lifeState==='caught'?'caught':'swimming'} model, before camera culling. ${count>1?`School total across ${count} instances (${number(model.triangles/count)} triangles per fish); shared geometry keeps the draw count low. `:''}Tank, habitat, shadows, extra transparency passes and postprocessing are excluded. LOD counts reflect the currently selected detail.`;
}
function updateLabels(){
  updateMeshStats();
  const caught=!state.demo&&fish.getState().lifeState==='caught';
  const sardine=!state.demo&&state.creatureId==='pacific-sardine';
  $<HTMLInputElement>('demo-mode').checked=state.demo;
  creatureSelect.disabled=state.demo;
  $<HTMLButtonElement>('view-follow').disabled=state.demo;
  $('life-state').hidden=$('life-state-label').hidden=state.demo;
  $('fish-size-details').hidden=state.demo;
  $('demo-population').hidden=!state.demo;
  $('school-label').hidden=$('school-count').hidden=!sardine;
  $<HTMLSelectElement>('school-count').value=String(state.schoolCount);
  const entry=fishCollection.find(e=>e.id===state.creatureId)!,size=entry.sizeRange;
  for(const mode of ['slow','fast','cycle'] as const){const button=$('mode-'+mode);button.lastChild!.textContent=' '+(entry.motionLabels?.[mode]??(mode==='slow'?'Slow cruise':mode==='fast'?'Fast swim':'Cycle'));}
  $<HTMLSelectElement>('life-state').options[0].textContent=entry.motionLabels?'Moving':'Swimming';
  $('fish-size').textContent=demo?`${demo.speciesCount} species · ${demo.count} creatures`:formatSizeRange(size);
  const total=Math.round((fish.root.userData.lengthMeters??1.2)*100);
  const shell=fish.root.userData.shellLengthMeters;
  $('fish-model-size').textContent=shell?`This model · ${Math.round(shell*100)} cm shell / ${total} cm nose to tail`:`This model · ${total} cm${size.measurement==='Bell diameter'?' bell diameter':size.measurement==='Arm span'?' extended arm span':''}${'count' in fish?' nominal per fish (±10% in the school)':''}`;
  $('fish-size-basis').textContent=`Basis: ${size.basis}.`;
  $('fish-size-note').textContent=size.note;
  $('fish-size-sources').replaceChildren(...size.sources.map(source=>{
    const link=document.createElement('a');link.textContent=source.title;link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';return link;
  }));
  $<HTMLSelectElement>('life-state').value=fish.getState().lifeState;
  for(const mode of ['slow','fast','cycle']){$<HTMLButtonElement>('mode-'+mode).disabled=caught||state.demo;$('mode-'+mode).hidden=state.demo;}
  document.querySelector<HTMLElement>('.playback .divider')!.hidden=state.demo;
  $('demo-motion-label').hidden=!state.demo;
  for(const mode of ['slow','fast','cycle']){$('mode-'+mode).classList.toggle('active',state.mode===mode);$('mode-'+mode).setAttribute('aria-pressed',String(state.mode===mode));}
  $('pause').innerHTML=state.paused?icons.play:icons.pause;$('pause').setAttribute('aria-label',state.paused?'Play animation':'Pause animation');
}
function chooseMode(mode:SwimMode|'cycle'){
  if(state.demo||fish.getState().lifeState==='caught')return;
  state.mode=mode;state.cycleTime=0;
  fish.setSwimMode(mode==='cycle'?'slow':mode);
  if('setActivity' in swimmer)swimmer.setActivity(mode==='slow'?'surface':mode==='fast'?'swim':'cycle');
  updateLabels();
}
function selectCreature(id:string,refresh=false){
  if(state.demo)return;
  const next=fishCollection.find(creature=>creature.id===id);
  if(!next||id===state.creatureId&&!refresh)return;
  const replacement=id==='pacific-sardine'&&state.schoolCount>0?createSardineSchool({count:state.schoolCount}):next.create();
  const nextMode=next.motionLabels?.cycle?'cycle':state.mode;
  replacement.setSwimMode(nextMode==='cycle'?(next.motionLabels?.cycle?'slow':state.cycleTime>=6&&state.cycleTime<12?'fast':'slow'):nextMode,true);
  replacement.setLifeState(fish.getState().lifeState);
  const nextSwimmer=createSwimmer(replacement,next.swimSpeed);
  if('setActivity' in nextSwimmer)nextSwimmer.setActivity(nextMode==='slow'?'surface':nextMode==='fast'?'swim':'cycle');

  fish.dispose();fish=replacement;swimmer=nextSwimmer;scene.add(fish.root);applyNodeStyle(fish.root);tank.shadeCreature(fish.root);void prepareLod(fish.root);
  state.creatureId=id;state.mode=nextMode;creatureSelect.value=id;$<HTMLDetailsElement>('fish-size-details').open=false;$<HTMLDetailsElement>('fish-mesh-details').open=false;updateLabels();
  if(state.view==='follow')setView('follow');
}
function stepCreature(direction:-1|1){
  const index=fishCollection.findIndex(creature=>creature.id===state.creatureId);
  selectCreature(fishCollection[(index+direction+fishCollection.length)%fishCollection.length].id);
}
on('creature-select','change',()=>selectCreature(creatureSelect.value));
function setSchoolCount(count:number){
  if(state.demo)return;
  if(![0,16,48,128,256].includes(count))return;
  state.schoolCount=count;
  if(state.creatureId!=='pacific-sardine')return;
  if('setCount' in fish&&count>0){fish.setCount(count);applyNodeStyle(fish.root);updateLabels();if(state.view==='follow')setView('follow');}
  else selectCreature(state.creatureId,true);
}
on('school-count','change',()=>setSchoolCount(Number($<HTMLSelectElement>('school-count').value)));
function setLifeState(next:FishLifeState){
  if(state.demo)return;
  const released=fish.getState().lifeState==='caught'&&next==='alive';
  fish.setLifeState(next);
  // A surface creature selected while caught has never acquired a route.
  // The explicit Swimming action hands it back, while physics stays authoritative.
  if(released&&fish.getState().motionOwner==='external')swimmer.resume();
  updateLabels();
}
on('life-state','change',()=>setLifeState($<HTMLSelectElement>('life-state').value as FishLifeState));
function setDemoMode(enabled:boolean){
  if(enabled===state.demo)return;
  if(enabled){
    const next=createTankDemo();
    try{applyNodeStyle(next.root);tank.shadeCreature(next.root);}catch(error){next.dispose();throw error;}
    preDemoView=state.view;demo=next;scene.add(demo.root);void prepareLod(demo.root);demo.root.visible=state.tab==='tank';
    fish.root.visible=false;
  }else{
    demo?.dispose();demo=undefined;fish.root.visible=state.tab==='tank';
    // The inspected model was frozen, so retain its exact phase and blend.
  }
  state.demo=enabled;
  $<HTMLDetailsElement>('fish-mesh-details').open=$<HTMLDetailsElement>('fish-size-details').open=false;
  updateLabels();setView(enabled?'tank':preDemoView);
}
on('demo-mode','change',()=>setDemoMode($<HTMLInputElement>('demo-mode').checked));
// Reframe follow view when the combined panel changes height (for example, a school selector appears).
const creatureObserver=new ResizeObserver(()=>{
  if(state.tab==='tank'&&state.view==='follow')setView('follow');
});
creatureObserver.observe(document.querySelector('.creature-control')!);

const assetTabs=['tank','area','objects','map','avatars','gym'] as const;
type AssetTab=typeof assetTabs[number];
let mapStudy:Awaited<ReturnType<typeof import('./viewer/mapStudy').createMapStudy>>|undefined;
let mapLoading:Promise<void>|undefined;
let avatarWorkbench:ReturnType<typeof import('./viewer/avatarWorkbench').createAvatarWorkbench>|undefined;
let avatarLoading:Promise<void>|undefined;
function selectTab(tab:AssetTab){
  state.tab=tab;
  stage.hidden=tab==='avatars'||tab==='gym'||tab==='map';
  document.querySelector<HTMLElement>('.quality-control')!.hidden=tab==='map'||tab==='avatars'||tab==='gym';
  if(tab==='gym'&&!avatarWorkbench)setGymLoading($('panel-gym'),'Opening the character workbench…');
  avatarWorkbench?.setActive(tab==='avatars'||tab==='gym'?tab:null);
  if((tab==='avatars'||tab==='gym')&&!avatarWorkbench&&!avatarLoading){
    avatarLoading=import('./viewer/avatarWorkbench').then(module=>{
      if(!state.running)return;
      avatarWorkbench=module.createAvatarWorkbench($('panel-avatars'),$('panel-gym'),selectTab);
      avatarWorkbench.setActive(state.tab==='avatars'||state.tab==='gym'?state.tab:null);
    }).catch(error=>{setGymLoading($('panel-gym'),'Please reload the page to try again.','error');const host=$('panel-avatars');host.textContent=`The character workbench could not load: ${error instanceof Error?error.message:'please reload'}`;avatarLoading=undefined;});
  }
  mapStudy?.setActive(tab==='map');
  if(tab==='map'&&!mapStudy&&!mapLoading){
    mapLoading=import('./viewer/mapStudy').then(module=>module.createMapStudy($('panel-map'))).then(viewer=>{mapStudy=viewer;viewer.setActive(state.tab==='map');if(!state.running)viewer.dispose();}).catch(()=>{$('panel-map').textContent='The map preview could not load. Reload to try again.';mapLoading=undefined;});
  }
  stage.setAttribute('aria-labelledby','tab-'+tab);
  renderer.domElement.setAttribute('aria-label',tab==='tank'?'Aquarium. Left and right arrows switch fish; up and down toggle camera view. Drag to orbit.':tab==='area'?'Dockside water study. Drag to orbit.':'Object preview. Drag to orbit.');
  tank.root.visible=tab==='tank';fish.root.visible=tab==='tank'&&!state.demo;if(demo)demo.root.visible=tab==='tank';harbor.root.visible=tab==='area';objects.root.visible=tab==='objects';
  scene.background=new Color(tab==='objects'?'#173a3f':tab==='area'?'#193e48':'#081524');
  scene.fog=null;
  sky.root.visible=tab==='area'||tab==='objects';
  // Fit the shadow frustum to the tab: a single prop needs ~8 m, not the 44 m harbor (sharper, no acne, same cost).
  const extent=tab==='objects'?8:22;sun.shadow.camera.left=sun.shadow.camera.bottom=-extent;sun.shadow.camera.right=sun.shadow.camera.top=extent;sun.shadow.camera.updateProjectionMatrix();sky.setColors(tab==='objects'?STYLE.studio:STYLE.dome);
  ambient.intensity=tab==='tank'?1.8:STYLE.sky.intensity;sun.intensity=tab==='tank'?2:STYLE.sun.intensity;
  controls.minDistance=tab==='objects'?.25:tab==='tank'?1:8;controls.maxDistance=tab==='objects'?55:190;
  controls.maxPolarAngle=tab==='area'?Math.PI-.08:tab==='objects'?Math.PI*.53:Math.PI*.49;
  if(tab!=='area')state.underwater=false;
  controls.enableDamping=!reducedMotion.matches;
  const url=new URL(location.href);if(tab==='tank')url.searchParams.delete('tab');else url.searchParams.set('tab',tab);history.replaceState(null,'',url);
  document.querySelector<HTMLElement>('.interface')!.hidden=tab!=='tank';
  for(const name of assetTabs){
    const button=$('tab-'+name),selected=name===tab;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    if(name!=='tank')$('panel-'+name).hidden=!selected;
  }
  previous=performance.now();
  if(tab==='tank')updateMeshStats();
  const lodPanel=document.querySelector<HTMLElement>('.lod-control')!;lodPanel.hidden=tab==='map'||tab==='avatars'||tab==='gym';
  document.querySelector(tab==='objects'?'.object-details':tab==='area'?'.water-controls':'.creature-control')!.append(lodPanel);
  if(tab!=='avatars'&&tab!=='gym'&&tab!=='map')resize();
  lod.update(camera,stage.clientHeight,0,true);updateLodPanel();
}
for(const tab of assetTabs){
  on('tab-'+tab,'click',()=>selectTab(tab));
  on('tab-'+tab,'keydown',event=>{
    const e=event as KeyboardEvent,index=assetTabs.indexOf(tab);
    const next=e.key==='ArrowRight'?(index+1)%assetTabs.length:e.key==='ArrowLeft'?(index+assetTabs.length-1)%assetTabs.length:e.key==='Home'?0:e.key==='End'?assetTabs.length-1:-1;
    if(next<0)return;
    e.preventDefault();selectTab(assetTabs[next]);$('tab-'+assetTabs[next]).focus();
  });
}
function togglePause(){state.paused=!state.paused;updateLabels();updateWaterLabels();}
function updateWaterLabels(){
  $('harbor-pause').textContent=state.paused?'Play':'Pause';$('harbor-pause').setAttribute('aria-label',state.paused?'Play water':'Pause water');
}
const objectSelect=$<HTMLSelectElement>('object-select');
const objectCategories=new Map<string,HTMLOptGroupElement>();
for(const entry of propCollection){let group=objectCategories.get(entry.category);if(!group){group=document.createElement('optgroup');group.label=entry.category;objectCategories.set(entry.category,group);objectSelect.append(group);}group.append(new Option(entry.name,entry.id));}
$('object-total').textContent=`${propCollection.length} objects`;
function selectObject(id:string,count=id===state.objectId?state.objectInstances:1){
  const result=objects.select(id,count);state.objectInstances=count;applyNodeStyle(objects.root);void prepareLod(objects.root);state.objectId=id;state.objectHeight=result.height;objectSize=result.size;objectSelect.value=id;state.compare=false;$('object-compare').setAttribute('aria-pressed','false');$('scale-key').hidden=true;
  $('object-category').textContent=result.entry.category;$('object-name').textContent=result.entry.name;$('object-description').textContent=result.entry.description;
  $('object-dimensions').textContent=(count>1?result.entry.instances?.sizeLabel:undefined)??SIZE_REFERENCES[result.entry.id].label;$('object-dimensions').title=SIZE_REFERENCES[result.entry.id].basis;
  const seed=objects.selected?.userData.seed;$('object-regenerate').hidden=!result.entry.random;
  $('object-stats').textContent=`${result.drawCalls} draws · ${result.triangles.toLocaleString()} triangles · procedural${result.entry.random?` · seed ${seed}`:''}`;
  $('object-count').textContent=`${propCollection.findIndex(e=>e.id===id)+1} / ${propCollection.length}`;
  $('export-status').textContent='';$('export-object').hidden=count>1;
  const groupSelect=$<HTMLSelectElement>('object-group');groupSelect.replaceChildren();
  for(const size of result.entry.instances?.counts??[])groupSelect.add(new Option(size===1?'Single':`Group of ${size}`,String(size)));
  groupSelect.value=String(count);$('object-group-control').hidden=!result.entry.instances;
  const poseSelect=$<HTMLSelectElement>('object-pose');poseSelect.replaceChildren();
  const poses=count>1?result.entry.instances?.poses??result.entry.poses:result.entry.poses;
  for(const pose of poses??[])poseSelect.add(new Option(pose.label,pose.id));
  $('object-pose-control').hidden=!poses?.length;
  const animated=Boolean(result.entry.animate||objects.selected?.userData.crawlSpeedMetersPerSecond);
  state.objectMotion=animated&&!reducedMotion.matches;$('object-motion').hidden=!animated;updateObjectMotionLabel();
  if(state.tab==='objects')setView(state.view);
}
selectObject(state.objectId);
on('object-select','change',()=>selectObject(objectSelect.value));
on('object-group','change',()=>selectObject(state.objectId,Number($<HTMLSelectElement>('object-group').value)));
function selectedObjectPose(){
  const entry=propCollection.find(e=>e.id===state.objectId);
  const poses=state.objectInstances>1?entry?.instances?.poses??entry?.poses:entry?.poses;
  return poses?.find(p=>p.id===$<HTMLSelectElement>('object-pose').value);
}
on('object-pose','change',()=>{
  const pose=selectedObjectPose();
  if(!pose||!objects.selected)return;pose.apply(objects.selected);
  state.objectMotion=Boolean(pose.animated)&&!reducedMotion.matches;$('object-motion').hidden=!pose.animated;updateObjectMotionLabel();
});
on('object-regenerate','click',()=>selectObject(state.objectId)); // random entries rebuild with a new seed
function stepObject(step:-1|1){
  const index=propCollection.findIndex(e=>e.id===state.objectId);
  selectObject(propCollection[(index+step+propCollection.length)%propCollection.length].id);
}
for(const [id,step] of [['object-prev',-1],['object-next',1]] as const)on(id,'click',()=>stepObject(step));
on('object-compare','click',()=>{
  state.compare=!state.compare;objects.setCompare(state.compare);applyNodeStyle(objects.root);void prepareLod(objects.root);$('object-compare').setAttribute('aria-pressed',String(state.compare));$('scale-key').hidden=!state.compare;
  if(state.compare){objectSize=new Box3().setFromObject(objects.comparison).getSize(new Vector3());state.objectHeight=objectSize.y;}else selectObject(state.objectId);
  setView(state.view);
});
on('object-reset','click',()=>{objects.turntable.rotation.y=objects.selected?.userData.inspectionHeadingRadians??0;setView(state.view);});
const surfaceBackground=new Color('#193e48'),underwaterBackground=new Color('#10505c');
const diveFog=new FogExp2(underwaterBackground,1.35/14);
function setHarborView(view:'overview'|'surface'|'underwater'){
  state.harborView=view;controls.minDistance=.4;controls.maxDistance=80;controls.maxPolarAngle=Math.PI-.08;
  if(view==='overview'){
    controls.target.set(-2,-.35,0);camera.position.copy(controls.target).add(new Vector3(.55,.64,1).normalize().multiplyScalar(fitDistance(49)));
  }else if(view==='surface'){
    controls.target.set(4.5,-.25,2.4);camera.position.set(6.7,3.8,10.2);
  }else{
    const offshore=Math.max(0,state.diveDepth-3)*2.7;
    controls.target.set(offshore,-state.diveDepth-.15,-1);camera.position.set(2.3+offshore,-state.diveDepth,5.9);
  }
  camera.lookAt(controls.target);controls.update();
  $('water-detail').setAttribute('aria-pressed',String(view==='surface'));
  $('water-underwater').setAttribute('aria-pressed',String(view==='underwater'));
  $('dive-controls').hidden=view!=='underwater';
  $('water-caption').textContent=view==='underwater'?'Drag to look around · scroll or pinch to explore':'Rippling reflections · a sandy shelf below';
}
function updateWaterView(){
  // The medium follows actual camera position, including manual crossings of the surface.
  if(camera.position.y<0){
    camera.position.x=Math.max(-15.5,Math.min(15.5,camera.position.x));camera.position.z=Math.max(-11.5,Math.min(11.5,camera.position.z));
    camera.position.y=Math.max(camera.position.y,-seabedDepth(camera.position.x,camera.position.z)+.25);
  }
  const height=sampleWater(camera.position.x,camera.position.z,state.waterTime,state.chop).height;
  const underwater=camera.position.y<height-.015;
  state.underwater=underwater;scene.background=underwater?underwaterBackground:surfaceBackground;
  diveFog.density=1.35/state.visibility;scene.fog=underwater?diveFog:null;
  ambient.intensity=underwater?1.3:STYLE.sky.intensity;sun.intensity=underwater?1.4:STYLE.sun.intensity;sky.root.visible=!underwater;
  $('dive-value').textContent=`${Math.max(0,-camera.position.y).toFixed(1)} m`;
}
on('harbor-reset','click',()=>setHarborView('overview'));
on('water-detail','click',()=>setHarborView('surface'));
on('water-underwater','click',()=>setHarborView(state.harborView==='underwater'?'surface':'underwater'));
on('dive-depth','input',()=>{state.diveDepth=Number($<HTMLInputElement>('dive-depth').value);setHarborView('underwater');});
on('water-visibility','input',()=>{state.visibility=Number($<HTMLInputElement>('water-visibility').value);harbor.water.setVisibility(state.visibility);harbor.seabed.setVisibility(state.visibility);$('visibility-value').textContent=`${state.visibility} m`;});
on('harbor-pause','click',togglePause);updateWaterLabels();
function updateObjectMotionLabel(){
  const finished=objects.selected&&selectedObjectPose()?.finished?.(objects.selected);
  $('object-motion').textContent=state.objectMotion?'Pause motion':finished?'Replay motion':'Play motion';$('object-motion').setAttribute('aria-pressed',String(state.objectMotion));
}
on('object-motion','click',()=>{
  const pose=selectedObjectPose();if(objects.selected&&pose?.finished?.(objects.selected))pose.apply(objects.selected);
  state.objectMotion=!state.objectMotion;updateObjectMotionLabel();
});
on('object-rotate','click',()=>{state.turntable=!state.turntable;$('object-rotate').setAttribute('aria-pressed',String(state.turntable));});
on('water-chop','input',()=>{
  state.chop=Number($<HTMLInputElement>('water-chop').value);harbor.setChop(state.chop);tank.water.setChop(state.chop);harbor.update(state.waterTime);
  $('water-value').textContent=state.chop===0?'Still':state.chop<1?'Gentle':'Breezy';
});
async function exportObject(){
  if(state.objectInstances>1)return; // GPU-driven group animation is not a portable GLB pose.
  const entry=propCollection.find(e=>e.id===state.objectId)!;
  const button=$<HTMLButtonElement>('export-object');button.disabled=true;$('export-status').textContent='Preparing model…';
  try{
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    await lod.ready();
    const model=objects.selected;if(!model)throw Error('No selected object');
    const exportable=exportableClone(model),detail=lod.mode;
    exportable.clone.position.set(0,0,0);exportable.clone.quaternion.identity();exportable.clone.scale.set(1,1,1);
    exportable.clone.userData={...model.userData,lod:detail,collection:'Monterey Bay',units:'metres',sizeBasis:SIZE_REFERENCES[entry.id].basis};
    // Snapshot the displayed seed and geometry; later selection changes cannot dispose this export.
    exportable.clone.traverse(o=>{if(o instanceof Mesh)o.geometry=o.geometry.clone();});
    let data;try{data=await new GLTFExporter().parseAsync(exportable.clone,{binary:true,onlyVisible:true});}finally{exportable.clone.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});exportable.dispose();}
    const href=URL.createObjectURL(new Blob([data as ArrayBuffer],{type:'model/gltf-binary'}));
    const link=document.createElement('a');link.href=href;link.download=entry.id+'-'+detail+'.glb';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
    $('export-status').textContent='Displayed detail saved.';
  }catch{ $('export-status').textContent='Could not export this model. Please try again.'; }
  finally{button.disabled=false;}
}
on('export-object','click',()=>void exportObject());
for(const mode of ['slow','fast','cycle'] as const)on('mode-'+mode,'click',()=>chooseMode(mode));
on('pause','click',togglePause);on('view-tank','click',()=>setView('tank'));on('view-follow','click',()=>setView('follow'));
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||(state.tab==='avatars'||state.tab==='gym'||state.tab==='map'))return;
  const el=e.target instanceof HTMLElement?e.target:document.activeElement instanceof HTMLElement?document.activeElement:document.body;
  if(el.isContentEditable||el.closest('input,select,textarea,a,summary,[role="tab"]'))return;
  if(state.tab==='objects'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
    e.preventDefault();
    if(!e.repeat)stepObject(e.key==='ArrowLeft'?-1:1);
    return;
  }
  if(state.tab==='tank'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();
    if(!e.repeat){
      if(e.key==='ArrowUp'||e.key==='ArrowDown')setView(state.view==='tank'?'follow':'tank');
      else stepCreature(e.key==='ArrowLeft'?-1:1);
    }
    return;
  }
  if(state.tab==='tank'&&e.key.toLowerCase()==='d'){e.preventDefault();if(!e.repeat)setDemoMode(!state.demo);return;}
  if(['OPTION','BUTTON'].includes(el.tagName))return;
  if(e.code==='Space'){e.preventDefault();if(state.tab==='objects')$('object-rotate').click();else togglePause();}
  if(state.tab!=='tank')return;
  if(e.key==='1')chooseMode('slow');if(e.key==='2')chooseMode('fast');if(e.key==='3')chooseMode('cycle');
},{signal});
renderer.domElement.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  // Collection arrows bubble to selection shortcuts; remaining arrows retain orbit.
  if(state.tab==='tank'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  if(state.tab==='objects'&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))return;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
  e.preventDefault();
  if(e.key==='Home'){setView(state.view);return;}
  const offset=camera.position.clone().sub(controls.target),sphere=new Spherical().setFromVector3(offset);
  if(e.key==='ArrowLeft')sphere.theta-=.12;if(e.key==='ArrowRight')sphere.theta+=.12;
  if(e.key==='ArrowUp')sphere.phi=Math.max(controls.minPolarAngle,sphere.phi-.10);
  if(e.key==='ArrowDown')sphere.phi=Math.min(controls.maxPolarAngle,sphere.phi+.10);
  if(e.key==='+'||e.key==='=')sphere.radius=Math.max(controls.minDistance,sphere.radius*.9);
  if(e.key==='-')sphere.radius=Math.min(controls.maxDistance,sphere.radius/ .9);
  camera.position.copy(controls.target).add(offset.setFromSpherical(sphere));controls.update();
},{signal});
reducedMotion.addEventListener('change',e=>{if(e.matches){state.paused=true;state.turntable=false;state.objectMotion=false;updateObjectMotionLabel();controls.enableDamping=false;$('object-rotate').setAttribute('aria-pressed','false');updateLabels();updateWaterLabels();}},{signal});
function lodRoot(){return state.tab==='objects'?(state.compare?objects.comparison:objects.selected??objects.root):state.tab==='area'?harbor.root:demo?.root??fish.root;}
function updateLodPanel(){
  const stats=lod.stats(lodRoot());
  if(state.tab==='objects'&&objects.selected){const {model}=modelStats(state.compare?objects.comparison:objects.selected);$('object-stats').textContent=`${model.drawCalls} draws · ${model.triangles.toLocaleString()} triangles · active detail`;}
  $('lod-variants').innerHTML=LOD_LEVELS.map((level,i)=>`<tr><th>${level[0].toUpperCase()+level.slice(1)} · ${i}</th><td>${Math.round(stats[level].triangles).toLocaleString()}</td><td>${stats[level].draws}</td></tr>`).join('');
  const active=lod.inspect(lodRoot()).filter(e=>Number.isFinite(e.pixels));
  $('lod-status').textContent=`${lod.mode==='auto'?'Auto':lod.mode} · ${[...new Set(active.map(e=>e.level))].join(' / ')} · ${(stats.bytes/1024).toFixed(0)} KB geometry across levels`;
}
async function prepareLod(root:import('three').Object3D){await lod.register(root);if(!state.running)return;lod.update(camera,stage.clientHeight,0,true);updateLodPanel();updateMeshStats();}
function setLodMode(mode:LodMode){if(!['auto',...LOD_LEVELS].includes(mode))return;lod.setMode(mode);$<HTMLSelectElement>('lod-select').value=mode;lod.update(camera,stage.clientHeight,0,true);updateLodPanel();updateMeshStats();}
on('lod-select','change',()=>setLodMode($<HTMLSelectElement>('lod-select').value as LodMode));
setLodMode((params.get('lod')??'auto') as LodMode);

/* Device settings keep the same palette; mesh detail is chosen independently by projected size. */
const qualitySelect=$<HTMLSelectElement>('quality-select');
for(const tier of QUALITY_TIERS)qualitySelect.add(new Option(TIER_SETTINGS[tier].label,tier));
{const picked=pickTier({requested:params.get('quality'),coarsePointer:matchMedia('(pointer: coarse)').matches,deviceMemory:(navigator as Navigator & {deviceMemory?:number}).deviceMemory});state.quality=picked.tier;state.qualityReason=picked.reason;}
qualitySelect.value=state.quality;
function setQuality(tier:QualityTier,force=false){
  if(!QUALITY_TIERS.includes(tier)||(tier===state.quality&&!force))return;
  state.quality=tier;qualitySelect.value=tier;const settings=TIER_SETTINGS[tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.maxPixelRatio));
  sun.shadow.mapSize.set(settings.shadowMapSize,settings.shadowMapSize); // the shadow node resizes its map on the next render
  RIM.strength.value=settings.rim?RIM_STRENGTH:0;
  harbor.water.setRefraction(settings.refraction);

  resize();
}
on('quality-select','change',()=>{state.qualityReason='selected';setQuality(qualitySelect.value as QualityTier);});
// One automatic step down if the first ~2 s of active frames miss ~45 fps; an explicit choice is never overridden.
const probe:number[]=[];let probed=false,lastProbe=0;
function probeFrame(now:number){
  if(probed||state.qualityReason==='requested'||state.qualityReason==='selected'){lastProbe=now;return;}
  if(lastProbe)probe.push(now-lastProbe);lastProbe=now;
  if(probe.length<120)return;
  probed=true;
  if(shouldStepDown(state.quality,probe)){state.qualityReason=`stepped down after a slow first frames probe`;setQuality(lowerTier(state.quality));}
}

updateLabels();
let previous=performance.now(),frame=0;
const followTarget=new Vector3(),followDelta=new Vector3();
function tick(now:number){
  if(!state.running)return;
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(state.tab==='avatars'||state.tab==='gym'||state.tab==='map'){frame=requestAnimationFrame(tick);return;}
  if(state.tab==='area'&&!state.paused){state.waterTime+=dt;harbor.update(state.waterTime);}
  if(state.tab==='objects'){
    if(state.turntable)objects.turntable.rotation.y+=dt*.3;
    if(state.objectMotion){objects.update(dt);if(objects.selected&&selectedObjectPose()?.finished?.(objects.selected)){state.objectMotion=false;updateObjectMotionLabel();}}
  }
  if(state.tab==='tank'&&!state.paused){
    state.simulationTime+=dt;
    if(!demo&&state.mode==='cycle'&&!('setActivity' in swimmer)&&fish.getState().lifeState==='alive'){
      state.cycleTime=(state.cycleTime+dt)%16;
      const next=state.cycleTime>=6&&state.cycleTime<12?'fast':'slow';
      if(fish.getState().mode!==next){fish.setSwimMode(next);updateLabels();}
    }
    if(demo)demo.update(dt);else{fish.update(dt);swimmer.update(dt,fish.getState().blend);}
    tank.update(state.simulationTime);
  }
  if(state.tab==='tank'&&state.view==='follow'){
    followTarget.copy(controls.target).lerp(fish.root.position,1-Math.exp(-Math.max(5,6/(fish.root.userData.lengthMeters??1.2))*dt));
    followDelta.copy(followTarget).sub(controls.target);camera.position.add(followDelta);controls.target.copy(followTarget);
    if(fish.root.userData.locomotion==='surface-otter'){
      const offset=surfaceFollowHeight(controls.target.y);
      camera.position.y+=offset-surfaceFollowOffsetY;surfaceFollowOffsetY=offset;
    }
  }
  controls.update();sky.root.position.copy(camera.position);if(state.tab==='area')updateWaterView();
  if(lod.update(camera,stage.clientHeight,dt)){updateMeshStats();updateLodPanel();}
  renderer.render(scene,camera);
  probeFrame(now);frame=requestAnimationFrame(tick);
}
harbor.update(0);
const initialTab=new URLSearchParams(location.search).get('tab');
if(initialTab&&assetTabs.includes(initialTab as AssetTab))selectTab(initialTab as AssetTab);
if(initialTab==='area'&&new URLSearchParams(location.search).get('view')==='underwater')setHarborView('underwater');
if(params.get('creature'))selectCreature(params.get('creature')!);
if(state.tab==='tank'&&params.get('view')==='follow')setView('follow');
let ready=false;
const started=Promise.all([renderer.init(),lod.register(scene)]).then(()=>{
  ready=true;state.backend=(renderer.backend as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL 2';
  setQuality(state.quality,true);setLodMode(lod.mode);previous=performance.now();if(state.running&&!document.hidden)frame=requestAnimationFrame(tick);
},error=>{showError('The aquarium needs WebGPU or WebGL 2. Try a current browser with graphics acceleration enabled.');throw error;});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden&&ready){previous=performance.now();probe.length=0;frame=requestAnimationFrame(tick);}},{signal});
function interrupted(){state.paused=true;updateLabels();showError('The graphics preview was interrupted. Reload the page to restore it.');}
renderer.onDeviceLost=interrupted;
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();interrupted();},{signal});
function dispose(){if(!state.running)return;state.running=false;cancelAnimationFrame(frame);abort.abort();mapStudy?.dispose();avatarWorkbench?.dispose();resizeObserver.disconnect();creatureObserver.disconnect();controls.dispose();lod.dispose();demo?.dispose();fish.dispose();tank.dispose();harbor.dispose();objects.dispose();renderer.dispose();}
if(import.meta.hot)import.meta.hot.dispose(dispose);
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal});
export const viewer={get mapStudy(){return mapStudy;},get avatarWorkbench(){return avatarWorkbench;},started,setQuality,lod,setLodMode,state,setDemoMode,get demo(){return demo;},selectTab,selectObject,harbor,objects,setView,setHarborView,setLifeState,chooseMode,togglePause,selectCreature,setSchoolCount,get fish(){return fish;},get swimmer(){return swimmer;},tank,camera,scene,renderer,controls,dispose};
