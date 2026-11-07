import {createGymSurrey} from './testingGym/surrey';
import {createWaterEffectsPanel} from './waterEffectsPanel';
import type {createEnhancedWater} from './enhancedWater';
import type { createGymDeer } from './testingGym/deer';
import { createGymDiagnostics } from './gymDiagnostics';
import { setGymLoading, paintLoadingStage } from './gymLoading';
import type { createCaledoniaLabels } from './mapStudy/caledoniaLabels';
import { MUSEUM_SITE } from '../data/pacificGroveMuseum';
import { applyGymSurfaceStyle } from './gymSurfaceStyle';
import './avatarWorkbench.css';
import { CircleGeometry, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { createGamepadReader, PAD } from './gamepad';
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAvatarModel } from '../models/avatar';
import { AVATAR_SIZE_LIMITS, DEFAULT_AVATAR_DESIGN, normalizeAvatarDesign, type AvatarDesign } from '../models/avatar/design';
import { createToonMaterial, STYLE } from '../models/shared/style';
import { createOtterDiveEffects } from './testingGym/otterDiveEffects';
import { createFlightController } from './testingGym/flightController';
import { createLodController } from '../models/shared/lod/controller';
import { LOD_LEVELS, type LodMode } from '../models/shared/lod/geometry';
import { applyNodeStyle, refreshNodeStyle } from './nodeStyle';
import { createGymWeatherSystem } from './gymWeatherSystem';
import { modelStats } from './modelStats';
import { pickTier, TIER_SETTINGS } from './quality';
import { AVATAR_SAVE_LIMIT, AVATAR_STORAGE_KEY, avatarDownload, emptyAvatarCollection, parseAvatarCollection, parseAvatarDownload, type AvatarCollection } from '../data/avatarSaves';
import { AVATAR_SWIMMING, canStandAt, createAvatarController, SCUBA_AIR, type AvatarControllerState } from './avatarController';
import type { createTestingGym, GymInteraction } from './testingGym';
import type { createGymBayExtension } from './testingGym/bayExtension';
import type { createGymBayLabels } from './testingGym/bayLabels';

type ActiveView = 'avatars' | 'gym' | null;
type GymDestination = 'lovers-point' | 'caledonia-park' | 'museum';
const DESTINATION_NAMES:Record<GymDestination,string>={'lovers-point':'Lovers Point','caledonia-park':'Caledonia Park',museum:'Natural History Museum'};
type Emote = 'none' | 'wave' | 'cheer' | 'sit' | 'cast';
const PALETTES = {
  skinTone: [['Porcelain','#f5d5b7'],['Peach','#e8b58a'],['Golden','#dba477'],['Honey','#c78c59'],['Warm brown','#a96d47'],['Chestnut','#855134'],['Deep brown','#603a2c'],['Umber','#432a24']],
  hairColor: [['Ink','#282e31'],['Espresso','#53392c'],['Chestnut','#784533'],['Copper','#aa5437'],['Golden','#d0a05b'],['Silver','#c7cbbd'],['Berry','#704556'],['Ocean','#477d7b']],
  eyeColor: [['Brown','#573e30'],['Teal','#337b82'],['Blue','#477aa7'],['Green','#6d8654'],['Charcoal','#344548'],['Hazel','#ad7d39']],
  topColor: [['Sea glass','#2c8d91'],['Ocean','#477999'],['Sunshine','#edb857'],['Coral','#d97d65'],['Berry','#946282'],['Cream','#ece2c8'],['Moss','#829560'],['Night','#354c59']],
  bottomColor: [['Navy','#3d596c'],['Denim','#648999'],['Sand','#baa578'],['Olive','#687654'],['Charcoal','#414d50'],['Rose','#ab7372']],
  shoeColor: [['Cream','#f3dfb9'],['Clay','#b86e4b'],['Ink','#36484a'],['Sea glass','#55958a'],['Ochre','#c8a04d'],['Berry','#8d5663']],
} as const;
const STYLE_OPTIONS: Partial<Record<keyof AvatarDesign, readonly [string,string][]>> = {
  hairStyle: [['crop','Short crop'],['sweep','Side sweep'],['bob','Coastal bob'],['curls','Soft curls'],['bun','Top bun']],
  eyeStyle: [['round','Round'],['almond','Almond'],['sleepy','Relaxed']],
  mouthStyle: [['smile','Smile'],['grin','Grin']],
  faceLines: [['none','None'],['soft','Soft'],['defined','Defined']],
  topStyle: [['tee','Everyday tee'],['hoodie','Cozy hoodie'],['vest','Fishing vest']],
  bottomStyle: [['shorts','Shorts'],['trousers','Trousers'],['skirt','Skirt']],
};
const HAIR_PATHS:Record<string,string>={crop:'M9 26Q4 8 29 7Q54 8 51 27L43 22L37 25L32 20L24 25L18 21Z',sweep:'M8 29Q4 9 29 6Q53 6 52 30L44 25L37 15Q25 31 8 29Z',bob:'M8 44L7 25Q6 7 29 6Q53 8 52 27L51 45L41 44L43 23Q33 24 24 16L16 24L17 44Z',curls:'M8 28C0 24 6 16 9 16C3 6 18 5 20 10C20 0 32 2 33 8C42 1 50 8 47 14C58 16 56 27 49 29L44 23L17 22Z',bun:'M9 28Q6 9 28 8Q52 9 51 29L43 20Q25 26 16 19ZM21 9Q13 -1 30 1Q44 0 39 11Z'};
function hairIcon(style:string){return `<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="30" cy="32" rx="20" ry="22" fill="#e5c39e"/><path d="${HAIR_PATHS[style]}" fill="#665044"/><circle cx="23" cy="34" r="2" fill="#55524a"/><circle cx="37" cy="34" r="2" fill="#55524a"/><path d="M27 41Q30 44 33 41" fill="none" stroke="#98634d" stroke-width="1.5"/></svg>`;}
function options(field:keyof AvatarDesign,label:string){return `<fieldset class="av-field"><legend>${label}</legend><div class="av-options">${STYLE_OPTIONS[field]!.map(([value,name])=>`<button type="button" data-design="${field}" data-value="${value}" aria-pressed="false"${field==='hairStyle'?' class="av-hair-option"':''}>${field==='hairStyle'?hairIcon(value):''}${name}</button>`).join('')}</div></fieldset>`;}
function swatches(field:keyof typeof PALETTES,label:string){return `<fieldset class="av-field"><legend>${label}</legend><div class="av-swatches">${PALETTES[field].map(([name,value])=>`<button type="button" class="av-swatch" style="--swatch:${value}" data-design="${field}" data-value="${value}" aria-label="${label}: ${name}" title="${name}" aria-pressed="false"></button>`).join('')}</div></fieldset>`;}
function sizeControls(){return `<fieldset class="av-field av-size"><legend>Height &amp; build</legend><div class="av-size-heading"><label for="avatar-height-control">Height</label><output id="avatar-height-value" for="avatar-height-control"></output></div><input id="avatar-height-control" type="range" data-size="heightMeters" min="${AVATAR_SIZE_LIMITS.heightMeters.min}" max="${AVATAR_SIZE_LIMITS.heightMeters.max}" step="${AVATAR_SIZE_LIMITS.heightMeters.step}" aria-describedby="avatar-size-hint"><div class="av-size-ends" aria-hidden="true"><span>1.20 m</span><span>1.80 m</span></div><div class="av-size-heading"><label for="avatar-build-control">Build</label><output id="avatar-build-value" for="avatar-build-control"></output></div><input id="avatar-build-control" type="range" data-size="bodyBuild" min="${AVATAR_SIZE_LIMITS.bodyBuild.min}" max="${AVATAR_SIZE_LIMITS.bodyBuild.max}" step="${AVATAR_SIZE_LIMITS.bodyBuild.step}" aria-describedby="avatar-size-hint"><div class="av-size-ends" aria-hidden="true"><span>Slimmer</span><span>Broader</span></div><div class="av-size-footer"><p id="avatar-size-hint">Outfits fit your shape. Change your size anytime.</p><button id="avatar-size-reset" type="button" class="secondary">Reset size</button></div></fieldset>`;}
/** Gym emote wheel entries: value, label, quick key. Add a pose to the rig, then list it here. */
const GYM_EMOTES:readonly (readonly [Emote,string,string])[]=[['wave','Wave','1'],['cheer','Cheer','2'],['sit','Sit','3']];
function lodOptions(){return '<option value="auto">Auto · distance</option><option value="near">Near</option><option value="mid">Mid</option><option value="far">Far</option>';}

/** One lazy renderer shared by the creator and the gym; sleeps when neither tab is active. */
export function createAvatarWorkbench(studioHost:HTMLElement,gymHost:HTMLElement,navigate:(tab:'avatars'|'gym')=>void){
  const abort=new AbortController(),{signal}=abort;
  studioHost.className=gymHost.className='avatar-workbench';
  studioHost.innerHTML=`<div class="av-studio"><div class="av-preview"><div class="av-intro"><span class="av-eyebrow">Make yourself at home</span><h1>Your coastal character</h1><p>A little personality for a big bay.</p></div><div id="avatar-viewport" class="av-viewport"></div><div class="av-preview-bottom"><div class="av-preview-label">Drag to turn · scroll to zoom<br><span id="avatar-height">Original design · metre scale</span></div><div class="av-animation"><select id="avatar-pose" aria-label="Preview animation"><option value="idle">Idle</option><option value="walk">Walk</option><option value="run">Run</option><option value="swim">Swim</option><option value="tread">Tread water</option></select><button data-emote="wave">Wave</button><button data-emote="cheer">Cheer</button></div></div></div><div class="av-controls"><div class="av-controls-header"><label for="avatar-name">Character name</label><input id="avatar-name" maxlength="32" autocomplete="off" spellcheck="false"></div><div class="av-category-tabs" role="tablist" aria-label="Character options">${[['you','You'],['hair','Hair'],['face','Face'],['outfit','Outfit']].map(([id,name],i)=>`<button id="av-category-${id}" role="tab" data-category="${id}" aria-controls="av-options-${id}" aria-selected="${i===0}" tabindex="${i===0?'0':'-1'}">${name}</button>`).join('')}</div><div class="av-customize"><section id="av-options-you" role="tabpanel" aria-labelledby="av-category-you">${sizeControls()}${swatches('skinTone','Skin tone')}<p class="av-hint">Every hairstyle, face, and outfit is yours to mix. Outfits can change whenever you like.</p><button id="avatar-shuffle" class="secondary">Try a new combination</button></section><section id="av-options-hair" role="tabpanel" aria-labelledby="av-category-hair" hidden>${options('hairStyle','Hairstyle')}${swatches('hairColor','Hair color')}</section><section id="av-options-face" role="tabpanel" aria-labelledby="av-category-face" hidden>${options('eyeStyle','Eyes')}${swatches('eyeColor','Eye color')}${options('mouthStyle','Expression')}${options('faceLines','Face lines')}</section><section id="av-options-outfit" role="tabpanel" aria-labelledby="av-category-outfit" hidden>${options('topStyle','Top')}${swatches('topColor','Top color')}${options('bottomStyle','Bottoms')}${swatches('bottomColor','Bottom color')}${swatches('shoeColor','Shoes')}</section></div><div class="av-save-area"><div class="av-save-actions"><button id="avatar-save" class="primary">Save character</button><button id="avatar-to-gym" class="secondary">Try in Testing Gym →</button></div><output id="avatar-message" class="av-message" aria-live="polite">Saved characters stay in this browser. Download a copy to keep.</output><details class="av-library"><summary>Saved characters &amp; files <span id="avatar-save-count">· 0</span></summary><div class="av-library-row"><select id="avatar-saved" aria-label="Saved characters"></select><button id="avatar-load">Load</button></div><div class="av-download-row"><button id="avatar-save-copy">Save as new</button><button id="avatar-export">Download JSON</button><button id="avatar-import-button">Import JSON</button><input id="avatar-import" type="file" accept=".json,application/json" hidden></div></details><details class="av-performance"><summary id="avatar-budget-summary">Rendering budget</summary><label>Detail <select id="avatar-lod">${lodOptions()}</select></label><table><thead><tr><th>Detail</th><th>Triangles</th><th>Draws</th></tr></thead><tbody id="avatar-lod-rows"></tbody></table><p id="avatar-budget"></p></details></div></div></div>`;
  // Play HUD: the world stays visible. Contextual prompts appear only when useful; tools live
  // in one menu; touch controls appear only for touch input. No per-player state is global UI.
  gymHost.innerHTML=`<div class="gym-layout"><div id="gym-viewport" class="av-viewport"></div><div class="gym-toolbar"><div class="gym-place"><span class="av-eyebrow">Testing Gym</span><h1>Lovers Point</h1></div><div class="gym-toolbar-controls"><button id="gym-back">← Edit character</button><details id="gym-menu" class="gym-menu"><summary aria-label="Gym menu">Menu</summary><div class="gym-menu-panel"><label class="gym-menu-character">Character <select id="gym-avatar" aria-label="Gym character"></select></label><label class="gym-menu-character">Destination <select id="gym-destination" aria-label="Gym destination"><option value="lovers-point">Lovers Point</option><option value="caledonia-park">Caledonia Park</option><option value="museum">Natural History Museum</option></select></label><div class="gym-menu-actions"><button id="gym-reset">Back to start</button><button id="gym-swim-start">Try swimming</button><button id="gym-caledonia-visit">Visit Caledonia Park</button><button id="gym-caledonia-top">Caledonia · top view</button><button id="gym-meals-visit">Meals on Wheels center</button><button id="gym-pool-visit">Pool &amp; volleyball court</button><button id="gym-surrey-visit">Ride a surrey</button><button id="gym-suit-station">Otter Man station</button><button id="gym-museum-visit">Visit Natural History Museum</button><button id="gym-museum-upper">Visit museum mezzanine</button><button id="gym-museum-overview">Museum exterior study</button><button id="gym-waterfront-view">Waterfront overview</button><button id="gym-coastal-view">Coastal wildlife</button><button id="gym-whale-view">Whale lookout</button><label class="gym-menu-character">Deer <select id="gym-deer-place" aria-label="Find deer"><option value="">Choose a place</option></select></label><button id="gym-bay-overview" aria-pressed="false">Monterey Bay overview</button><label class="gym-menu-character">Bay place <select id="gym-bay-place" aria-label="Focus a Monterey Bay place"><option value="">Whole bay</option></select></label><button id="gym-overview" aria-pressed="false">Park overview</button></div><dl class="gym-help" aria-label="Controls"><dt>WASD / arrows</dt><dd>Move</dd><dt>Space</dt><dd>Jump · swim up · suit lift</dd><dt>C</dt><dd>Dive · descend in suit</dd><dt>Shift</dt><dd>Run · row faster · flight boost</dd><dt>E</dt><dd>Interact</dd><dt>Q</dt><dd>Emote wheel · 1–3 quick emotes</dd><dt>Drag · scroll</dt><dd>Look · zoom</dd></dl><dl class="gym-help" aria-label="Controller"><dt>Left stick</dt><dd>Move</dd><dt>Right stick</dt><dd>Look</dd><dt>A</dt><dd>Jump · swim up · suit lift</dd><dt>B</dt><dd>Run · dive · boat faster</dd><dt>X</dt><dd>Interact</dd><dt>Y</dt><dd>Emote wheel · second choice on the dive boat</dd><dt>D-pad</dt><dd>Quick emotes</dd><dt>Menu</dt><dd>This menu</dd></dl><details class="gym-performance"><summary>World &amp; rendering notes</summary><p>Coast, paths, beaches, pool and court follow map data. Terrain follows USGS elevation data. Structures, planting and play stations remain approximations.</p><label>Detail <select id="gym-lod">${lodOptions()}</select></label><p id="gym-budget"></p><table aria-label="Park detail levels"><thead><tr><th>Detail</th><th>Triangles</th><th>Draws</th></tr></thead><tbody id="gym-lod-rows"></tbody></table><p id="gym-storage"></p></details></div></details></div></div><p id="gym-hint" class="gym-hint"><span class="for-keys"><kbd>WASD</kbd> move <kbd>Space</kbd> jump <kbd>Shift</kbd> run <kbd>E</kbd> interact <kbd>Q</kbd> emotes</span><span class="for-pad"><kbd>L</kbd> move <kbd>A</kbd> jump <kbd>B</kbd> run <kbd>X</kbd> interact <kbd>Y</kbd> emotes</span></p><div id="gym-breath" class="gym-breath" hidden><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="gym-breath-track" cx="22" cy="22" r="18"/><circle id="gym-breath-ring" class="gym-breath-fill" cx="22" cy="22" r="18" pathLength="100"/></svg><span id="gym-breath-time" class="gym-breath-time" aria-hidden="true"></span><progress id="gym-breath-meter" class="gym-sr-only" max="${AVATAR_SWIMMING.breathSeconds}" value="${AVATAR_SWIMMING.breathSeconds}" aria-label="Breath remaining"></progress><p id="gym-breath-hint" class="gym-sr-only">Return to shore before it runs out.</p></div><div class="gym-prompt-area"><p id="gym-message" role="status"></p><div class="gym-prompt-row"><button id="gym-interact" class="gym-prompt" hidden disabled><kbd aria-hidden="true"><span class="for-keys">E</span><span class="for-pad">X</span></kbd><span id="gym-interact-label"></span></button><button id="gym-interact-alt" class="gym-prompt gym-prompt-alt" hidden><kbd aria-hidden="true"><span class="for-keys">R</span><span class="for-pad">Y</span></kbd><span id="gym-interact-alt-label"></span></button></div></div><div id="gym-emote-menu" class="gym-emote-wheel" role="menu" aria-label="Emotes" hidden>${GYM_EMOTES.map(([value,name,key],i)=>`<button role="menuitem" data-emote="${value}" aria-pressed="false" style="--angle:${-90+i*360/GYM_EMOTES.length}deg">${name}<small aria-hidden="true">${key}</small></button>`).join('')}<span class="gym-emote-hub" aria-hidden="true"><span class="for-keys">Q</span><span class="for-pad">Y</span> close</span></div><div class="gym-controls"><div class="gym-movement"><div class="gym-dpad" role="group" aria-label="Movement"><button data-move="forward" aria-label="Walk forward" aria-pressed="false">↑</button><button data-move="left" aria-label="Walk left" aria-pressed="false">←</button><button data-move="back" aria-label="Walk backward" aria-pressed="false">↓</button><button data-move="right" aria-label="Walk right" aria-pressed="false">→</button></div><button id="gym-run" aria-pressed="false">Run</button></div><div class="gym-actions"><div class="gym-emotes"><button id="gym-suit-return" hidden>Return suit to station</button><button id="gym-return-rod" hidden>Return rod</button><button id="gym-emote-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="gym-emote-menu">Emotes <kbd class="for-keys" aria-hidden="true">Q</kbd><kbd class="for-pad" aria-hidden="true">Y</kbd></button></div><div class="gym-jump-pair"><button id="gym-dive" class="gym-dive" aria-label="Dive">Dive</button><button id="gym-jump" class="gym-jump" aria-label="Jump">Jump</button></div></div></div><div class="gym-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · USGS terrain · Local prototype</div></div>`;
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const on=(id:string,type:string,listener:EventListener)=>$(id).addEventListener(type,listener,{signal});
  const params=new URLSearchParams(location.search),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const waterPanel=createWaterEffectsPanel(gymHost.querySelector('.gym-menu-panel')!,params,signal);
  let enhancedWater:ReturnType<typeof createEnhancedWater>|undefined;
  const tier=pickTier({requested:params.get('quality'),coarsePointer:matchMedia('(pointer: coarse)').matches,deviceMemory:(navigator as Navigator&{deviceMemory?:number}).deviceMemory}).tier;
  setGymLoading(gymHost,'Preparing your character…');
  const diagnostics=createGymDiagnostics(gymHost.querySelector<HTMLElement>('.gym-layout')!);
  const renderer=new WebGPURenderer({antialias:true,alpha:true,forceWebGL:params.has('webgl'),trackTimestamp:new URLSearchParams(location.search).has('profileGPU')});
  renderer.info.autoReset=false;
  renderer.setPixelRatio(Math.min(devicePixelRatio,TIER_SETTINGS[tier].maxPixelRatio));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Character preview. Drag to turn and scroll to zoom.');
  const camera=new PerspectiveCamera(38,1,.05,600),orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enablePan=false;orbit.enableDamping=!reduced.matches;orbit.dampingFactor=.12;orbit.maxPolarAngle=Math.PI*.49;
  const studio=new Scene(),studioRoot=new Group();studio.add(studioRoot);
  const gymScene=new Scene();gymScene.background=STYLE.dome.horizon.clone();gymScene.fog=new Fog(STYLE.dome.horizon,160,480);
  const gymLocal=new Group();gymLocal.name='Gym detailed local area';gymScene.add(gymLocal);
  const gymRegional=new Group();gymRegional.name='Gym regional map visibility';gymScene.add(gymRegional);
  const weather=createGymWeatherSystem(gymScene,camera,gymHost,tier),gymSky=weather.sky;
  // Shared underwater light: enabled before anything is styled so every gym material compiles it.
  weather.environment.caustics.enabled=true;weather.environment.headlamp.enabled=true;
  const otterDive=createOtterDiveEffects(weather.environment);gymScene.add(otterDive.mesh);
  for(const scene of [studio]){scene.add(new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity));const light=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);light.position.set(-5,9,7);light.castShadow=true;light.shadow.mapSize.setScalar(TIER_SETTINGS[tier].shadowMapSize);light.shadow.camera.left=light.shadow.camera.bottom=-3;light.shadow.camera.right=light.shadow.camera.top=3;light.shadow.camera.far=25;light.shadow.normalBias=.015;light.shadow.bias=-.0001;scene.add(light);}
  const plinth=new Mesh(new CylinderGeometry(.79,.85,.07,48),createToonMaterial({color:'#eff1d9',rim:false}));plinth.position.y=-.045;plinth.name='avatar-studio-platform';plinth.receiveShadow=true;studioRoot.add(plinth);
  const contact=new Mesh(new CircleGeometry(.31,32),createToonMaterial({color:'#b4c4a4',rim:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.008;contact.scale.y=.7;contact.name='avatar-studio-contact';contact.visible=false;studioRoot.add(contact);
  applyNodeStyle(studio,tier==='standard',weather.environment);
  const footShadow=new Mesh(new CircleGeometry(.28,24),createToonMaterial({color:'#355a42',rim:false}));
  footShadow.name='gym-avatar-ground-contact';footShadow.visible=false;footShadow.rotation.x=-Math.PI/2;footShadow.material.depthWrite=false;footShadow.material.transparent=true;footShadow.material.opacity=.22;gymScene.add(footShadow);applyNodeStyle(footShadow,false,weather.environment);
  const lod=createLodController();
  let collection:AvatarCollection=emptyAvatarCollection(),storageError='';
  try{collection=parseAvatarCollection(localStorage.getItem(AVATAR_STORAGE_KEY));}catch{storageError='Saved characters could not be read. You can still edit and download a character.';}
  let currentId=collection.selectedId;
  let design=normalizeAvatarDesign(collection.avatars.find(a=>a.id===currentId)?.design??DEFAULT_AVATAR_DESIGN);
  let avatar=createAvatarModel(design);applyNodeStyle(avatar.root,tier==='standard',weather.environment);studio.add(avatar.root);
  let active:ActiveView=null,disposed=false,initialized=false,gymInitialized=false,gymFirstFramePending=true,gymFailed=false,frame=0,previous=0,time=0,frameCount=0,budgetTime=0;
  let deer:ReturnType<typeof createGymDeer>|undefined,deerViewId='';
  let gym:ReturnType<typeof createTestingGym>|undefined,bayExtension:ReturnType<typeof createGymBayExtension>|undefined,bayLabels:ReturnType<typeof createGymBayLabels>|undefined,controller:ReturnType<typeof createAvatarController>|undefined,gymLoading:Promise<void>|undefined;
  let surrey:ReturnType<typeof createGymSurrey>|undefined,ridingSurrey=false;
  let pose='idle',emote:Emote='none',emoteTime=0,runToggle=false,lastSpeed=0,dirty=false,boating=false;
  let nearest:GymInteraction|undefined,interactionMessage='',interactionUntil=0,revision=0,editIntent=0;
  const keys=new Set<string>(),touchDirections=new Set<string>();
  let heldRod:{object:Group;position:Vector3;rotation:import('three').Euler}|undefined;
  let seatReturn:Vector3|undefined;
  let caledoniaOverview=false,caledoniaLabels:ReturnType<typeof createCaledoniaLabels>|undefined;
  const requestedDestination=params.get('destination');
  const initialDestination:GymDestination=requestedDestination==='caledonia-park'||requestedDestination==='museum'?requestedDestination:'lovers-point';
  let destination:GymDestination='lovers-point';
  let overview=false,bayOverview=false,bayFocusId='',sizeTimer=0;
  const motion={pedalPhase:undefined as number|undefined,speed:0,emote:'none' as Emote,reducedMotion:reduced.matches,carrying:false,swimming:false,airborne:false,verticalVelocity:0,landing:0,flying:false,boosting:false,submerged:false};
  let gymControllerState:AvatarControllerState|undefined,swimControlsActive=false,breathDisplay=-1,wasLowBreath=false;
  // A touch tap can begin and end between two frames; the latch guarantees one controller step sees it.
  let otterSuit=false,flight:ReturnType<typeof createFlightController>|undefined;
  let aboard=false,scuba=false,nearLadder=false,stickReleased=true,jumpTouch=false,jumpLatch=false,diveTouch=false,supportY=0,airborne=false,hintDistance=0,promptKey='',underwater=false;
  const pad=createGamepadReader(),lookOffset=new Spherical();
  const input={x:0,z:0,run:false,jump:false,dive:false},followTarget=new Vector3(),followDelta=new Vector3(),forward=new Vector3(),right=new Vector3();
  const controllerPosition=new Vector3();
  function message(text:string){if(!disposed)$('avatar-message').textContent=text;}
  function updateSizeControls(){
    const buildLabel=design.bodyBuild<.98?'Slimmer':design.bodyBuild>1.02?'Broader':'Balanced';
    $<HTMLInputElement>('avatar-height-control').value=String(design.heightMeters);
    $<HTMLInputElement>('avatar-build-control').value=String(design.bodyBuild);
    $('avatar-height-value').textContent=`${design.heightMeters.toFixed(2)} m`;
    $('avatar-build-value').textContent=buildLabel;
    $('avatar-height-control').setAttribute('aria-valuetext',`${design.heightMeters.toFixed(2)} metres`);
    $('avatar-build-control').setAttribute('aria-valuetext',`${buildLabel}, ${Math.round(design.bodyBuild*100)} percent of original build`);
    $('avatar-height').textContent=`${design.heightMeters.toFixed(2)} m · original coastal character`;
  }
  function updateSizePresentation(){
    const factor=avatar.dimensions.controllerRadius/.28;
    contact.scale.set(factor,.7*factor,1);footShadow.scale.setScalar(factor);
    if(active==='avatars'){
      const delta=avatar.dimensions.cameraTargetHeight-orbit.target.y;
      orbit.target.y+=delta;camera.position.y+=delta;
    }
  }
  function cancelSizeChange(){if(sizeTimer){window.clearTimeout(sizeTimer);sizeTimer=0;}}
  function flushSizeChange(){if(sizeTimer){cancelSizeChange();void replaceAvatar(design);}}
  function updateSelections(){
    updateSizeControls();
    $<HTMLInputElement>('avatar-name').value=design.name;
    studioHost.querySelectorAll<HTMLButtonElement>('[data-design]').forEach(b=>b.setAttribute('aria-pressed',String(design[b.dataset.design as keyof AvatarDesign]===b.dataset.value)));
    studioHost.querySelectorAll('[data-custom-swatch]').forEach(node=>node.remove());
    for(const field of Object.keys(PALETTES) as (keyof typeof PALETTES)[]){
      if(PALETTES[field].some(([,value])=>value===design[field]))continue;
      const container=studioHost.querySelector<HTMLButtonElement>(`[data-design="${field}"]`)!.parentElement!;
      const swatch=document.createElement('button');swatch.type='button';swatch.className='av-swatch';swatch.dataset.customSwatch=field;swatch.style.setProperty('--swatch',design[field]);swatch.setAttribute('aria-label',`Current imported color: ${design[field]}`);swatch.setAttribute('aria-pressed','true');swatch.title=`Current color ${design[field]}`;container.append(swatch);
    }
    $('avatar-save').textContent=currentId?'Save changes':'Save character';
  }
  function updateLibrary(){
    const select=$<HTMLSelectElement>('avatar-saved'),gymSelect=$<HTMLSelectElement>('gym-avatar');select.replaceChildren();gymSelect.replaceChildren(new Option(`${design.name} · current`,''));
    for(const saved of collection.avatars){select.add(new Option(saved.design.name,saved.id));gymSelect.add(new Option(saved.design.name,saved.id));}
    select.disabled=!collection.avatars.length;$<HTMLButtonElement>('avatar-load').disabled=!collection.avatars.length;
    if(currentId)select.value=currentId;gymSelect.value='';$('avatar-save-count').textContent=`· ${collection.avatars.length}`;
  }
  function budget(){
    const stats=lod.stats(avatar.mesh),actual=modelStats(avatar.mesh).model;
    $('avatar-budget-summary').textContent=`${actual.drawCalls} draw · ${actual.triangles.toLocaleString()} triangles · no image textures`;
    $('avatar-lod-rows').innerHTML=LOD_LEVELS.map(level=>`<tr><th>${level}</th><td>${stats[level].triangles.toLocaleString()}</td><td>${stats[level].draws}</td></tr>`).join('');
    $('avatar-budget').textContent=`Per color pass; target ≤2 draws / 5,000 triangles. ${(stats.bytes/1024).toFixed(0)} KB geometry across detail levels. Shared toon ramp and GPU bone data are additional. Design recipe: ${new TextEncoder().encode(avatarDownload(design)).byteLength} bytes. ${studioHost.dataset.backend??'Loading renderer'}.`;
    if(gym){const levels=lod.stats(gym.root);const region=lod.stats(gym.waterfront.root);$('gym-lod-rows').innerHTML=LOD_LEVELS.map(level=>`<tr><th>${level}</th><td>${levels[level].triangles.toLocaleString()}</td><td>${levels[level].draws}</td></tr>`).join('');$('gym-storage').textContent=`${(levels.bytes/1024/1024).toFixed(2)} MiB unique geometry across detail levels; trees and rocks share buffers. Counts above include all park batches before culling. Deer families separately: ${deer?`${lod.stats(deer.root).near.draws} draws / ${lod.stats(deer.root).near.triangles.toLocaleString()} Near, ${lod.stats(deer.root).far.triangles.toLocaleString()} Far triangles before interest culling`: 'loading'}. Caledonia separately: ${lod.stats(gym.caledonia.root).near.draws} draws / ${lod.stats(gym.caledonia.root).near.triangles.toLocaleString()} Near triangles. Waterfront separately: ${region.near.draws} draws / ${region.near.triangles.toLocaleString()} Near triangles, ${(region.bytes/1048576).toFixed(2)} MiB. Coastal wildlife/kelp separately: ${gym.coastalLife.stats().draws} asset draws / ${gym.coastalLife.stats().triangles.toLocaleString()} triangles before interest and frustum culling. Gulls separately: ${lod.stats(gym.gulls.root).near.draws} draws / ${lod.stats(gym.gulls.root).near.triangles.toLocaleString()} Near, ${lod.stats(gym.gulls.root).far.triangles.toLocaleString()} Far triangles before interest and frustum culling. When present, the gray-whale pod adds seven steady draws / 4,566 Near triangles, up to 13 draws / 5,200 triangles during surface effects; three whales share the world LOD controller. Regional bay separately: ${bayExtension?`${lod.stats(bayExtension.root).near.draws} draws / ${lod.stats(bayExtension.root).near.triangles.toLocaleString()} Near triangles, ${(lod.stats(bayExtension.root).bytes/1048576).toFixed(2)} MiB across LOD`: 'loading'}. The close-detail roots hide in bay overview.`;const world=modelStats(gymScene).model;$('gym-budget').textContent=`Visible scene before culling: ${world.drawCalls} draws · ${world.triangles.toLocaleString()} triangles. Three blended sun shadow maps; no postprocessing. Avatar: ${actual.drawCalls} draw. ${studioHost.dataset.backend}.`;}
  }
  async function replaceAvatar(next:AvatarDesign){
    if(disposed)return;
    cancelSizeChange();
    if(otterSuit)swapGear(false);
    if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);
    if(aboard)leaveDiveBoat('pier');
    if(seatReturn)chooseEmote('none');
    const generation=++revision,old=avatar;editIntent++;design=normalizeAvatarDesign(next);
    const position=old.root.position.clone(),rotation=old.root.rotation.clone();
    avatar=createAvatarModel(design,{gear:scuba?'scuba':otterSuit?'otter-man':'none'});avatar.root.position.copy(position);avatar.root.rotation.copy(rotation);applyNodeStyle(avatar.root,tier==='standard',weather.environment);
    if(heldRod)attachRod();old.root.removeFromParent();old.dispose();(active==='gym'?gymScene:studio).add(avatar.root);
    if(gym&&active==='gym'){makeController(position);avatar.root.rotation.copy(rotation);}
    updateSizePresentation();updateSelections();updateLibrary();dirty=true;message('Unsaved changes · save when you’re ready.');
    await lod.register(avatar.root);if(disposed||generation!==revision)return;budget();
  }
  /** Put scuba gear on or take it off. Gear rebuilds the one skinned batch but never touches the
   * saved design, the unsaved-changes state or the creator controls. */
  function swapGear(on:boolean,otter=false){
    if(disposed||(on===scuba&&otter===otterSuit))return;
    if(otterSuit&&!otter&&gym){flight?.stop();avatar.root.position.copy(gym.spawn);makeController(undefined,true);}
    scuba=on;otterSuit=otter;motion.flying=false;motion.boosting=false;motion.submerged=false;
    if(gym)gym.otterSuit.visible=!otter;
    gymHost.querySelector('.gym-layout')?.classList.toggle('is-flying-suit',otter);
    $('gym-suit-return').hidden=!otter;
    $('gym-hint').innerHTML=otter?'<span class="for-keys"><kbd>WASD</kbd> fly <kbd>Space</kbd> up <kbd>C</kbd> down <kbd>Shift</kbd> boost</span><span class="for-pad"><kbd>L</kbd> fly <kbd>A</kbd> up <kbd>B</kbd> down</span>':'<span class="for-keys"><kbd>WASD</kbd> move <kbd>Space</kbd> jump <kbd>Shift</kbd> run <kbd>E</kbd> interact</span><span class="for-pad"><kbd>L</kbd> move <kbd>A</kbd> jump <kbd>X</kbd> interact</span>';
    $('gym-hint').classList.remove('is-done');
    $('gym-run').textContent=otter?'Boost':'Run';$('gym-jump').textContent=otter?'Up':'Jump';$('gym-dive').textContent=otter?'Down':'Dive';
    $('gym-jump').setAttribute('aria-label',otter?'Lift off or ascend':'Jump');$('gym-dive').setAttribute('aria-label',otter?'Descend and land':'Dive');
    const generation=++revision,old=avatar,position=old.root.position.clone(),rotation=old.root.rotation.clone();
    avatar=createAvatarModel(design,{gear:on?'scuba':otter?'otter-man':'none'});avatar.root.position.copy(position);avatar.root.rotation.copy(rotation);applyNodeStyle(avatar.root,tier==='standard',weather.environment);
    if(heldRod)attachRod();old.root.removeFromParent();old.dispose();(active==='gym'?gymScene:studio).add(avatar.root);
    if(gym&&active==='gym'&&!aboard){makeController(position);avatar.root.rotation.copy(rotation);}
    if(otter&&gym)flight=createFlightController(avatar.root,bayExtension?.flightBounds??gym.flightBounds,bayExtension?.floorAt??gym.flightFloor,gym.flightObstacles,bayExtension?.waterAt??gym.flightWater,bayExtension?.canLandAt);else flight=undefined;
    updateSizePresentation();breathDisplay=-1;
    void lod.register(avatar.root).then(()=>{if(!disposed&&generation===revision)budget();});
  }
  let museumFloor:'ground'|'upper'|null=null;
  function makeController(position?:Vector3,fresh=false,resumeState?:AvatarControllerState){
    if(!gym)return;
    let state=fresh?undefined:resumeState??controller?.getState()??gymControllerState;
    if(state&&position)state={...state,position:position.toArray(),heading:avatar.root.rotation.y,velocity:[0,0]};
    controller=createAvatarController({root:avatar.root,spawn:gym.spawn,bounds:museumFloor==='upper'?gym.museum.upperBounds:gym.bounds,colliders:museumFloor==='upper'?gym.museum.upperColliders:gym.colliders,
      groundHeight:seatReturn?undefined:(x,z)=>museumFloor==='upper'?MUSEUM_SITE.floor+MUSEUM_SITE.upper+.045:gym!.swimGroundHeight(x,z)+.045,water:seatReturn||museumFloor==='upper'?undefined:gym.swimming,state,
      body:{radius:avatar.dimensions.controllerRadius,swimDepth:avatar.dimensions.swimDepth,swimImmersion:avatar.dimensions.swimImmersion},air:scuba?SCUBA_AIR:undefined});
    if(!state&&position)controller.restoreState({...controller.getState(),position:position.toArray(),velocity:[0,0]});
    // A seat is a visual placement above the ground; the controller must not snap it down.
    if(seatReturn&&position)avatar.root.position.copy(position);
    gymControllerState=controller.getState();
  }
  function swimControls(swimming:boolean){
    if(swimControlsActive===swimming)return;
    swimControlsActive=swimming;gymHost.querySelector('.gym-layout')?.classList.toggle('is-swimming',swimming);
    $<HTMLButtonElement>('gym-run').disabled=swimming;
    $('gym-run').textContent=swimming?'Swimming':otterSuit?'Boost':boating?'Row faster':'Run';
    // In water the touch Jump button swims up and a Dive button appears beside it.
    $('gym-jump').textContent=swimming||otterSuit?'Up':'Jump';$('gym-jump').setAttribute('aria-label',swimming?'Swim up':otterSuit?'Lift off or ascend':'Jump');
    if(swimming){runToggle=false;$('gym-run').setAttribute('aria-pressed','false');closeEmotes();}
    else{nearest=undefined;setPrompt();}
  }
  /** One contextual action at a time. Hidden when there is nothing to do, so the world stays clear. */
  function setPrompt(label?:string,enabled=true,alt?:string){
    const key=label===undefined?'':`${label}|${enabled}|${alt??''}`;if(key===promptKey)return;promptKey=key;
    const second=$<HTMLButtonElement>('gym-interact-alt');second.hidden=alt===undefined;$('gym-interact-alt-label').textContent=alt??'';
    if(alt===undefined)second.removeAttribute('aria-label');else second.setAttribute('aria-label',`${alt} (R)`);
    const button=$<HTMLButtonElement>('gym-interact');button.hidden=label===undefined;button.disabled=label===undefined||!enabled;
    $('gym-interact-label').textContent=label??'';
    if(label===undefined)button.removeAttribute('aria-label');else button.setAttribute('aria-label',enabled?`${label} (E)`:label);
  }
  function notify(text:string,seconds:number){interactionMessage=text;interactionUntil=time+seconds;$('gym-message').textContent=text;}
  /** A small ring that rides beside the character, like a stamina wheel. The progress element
   * and hint stay in the DOM (visually hidden) for assistive technology and tests. */
  function showBreath(state:{swimming:boolean;wading:boolean;breath:number;lowBreath:boolean;exhausted:boolean;submerged:boolean}){
    const display=Math.ceil(state.breath*10)*256+128*Number(scuba||aboard)+Number(state.swimming)+2*Number(state.wading)+4*Number(state.lowBreath)+8*Number(state.exhausted)+16*Number(boating)+32*Number(state.submerged);
    if(display===breathDisplay)return;breathDisplay=display;
    const panel=$('gym-breath');panel.hidden=boating||aboard||scuba||!state.submerged;
    panel.classList.toggle('is-low',state.lowBreath||state.exhausted);panel.classList.toggle('is-under',state.submerged);
    $('gym-breath-ring').style.strokeDashoffset=String(100-100*state.breath/AVATAR_SWIMMING.breathSeconds);
    $<HTMLProgressElement>('gym-breath-meter').value=state.breath;
    $<HTMLProgressElement>('gym-breath-meter').setAttribute('aria-valuetext',`${Math.ceil(state.breath)} seconds remaining`);
    $('gym-breath-time').textContent=String(Math.ceil(state.breath));
    $('gym-breath-hint').textContent=state.lowBreath?'Low breath — swim up to the surface!':'Surface to refill your breath.';
  }
  const breathAnchor=new Vector3(),ladderPoint=new Vector3();
  /** Keep the ring just right of the character's head in screen space. */
  function placeBreath(){
    const panel=$('gym-breath');if(panel.hidden)return;
    breathAnchor.copy(avatar.root.position);breathAnchor.y+=1.25*avatar.dimensions.heightScale;breathAnchor.project(camera);
    const mount=$('gym-viewport'),x=(breathAnchor.x*.5+.5)*mount.clientWidth+46,y=(-breathAnchor.y*.5+.5)*mount.clientHeight-22;
    panel.style.transform=`translate(${Math.round(Math.max(8,Math.min(mount.clientWidth-56,x)))}px,${Math.round(Math.max(8,Math.min(mount.clientHeight-56,y)))}px)`;
  }
  function startSwimmingPractice(){
    if(!gym)return;if(otterSuit)swapGear(false);if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);returnRod();chooseEmote('none');clearInput();
    const old=controller?.getState()??gymControllerState,position=gym.swimStart.toArray();
    const state=old?{...old,position,velocity:[0,0] as [number,number],safePosition:[...position] as [number,number,number]}:undefined;
    avatar.root.position.copy(gym.swimStart);avatar.root.rotation.y=Math.atan2(gym.swimDirection.x,gym.swimDirection.z);
    museumFloor=null;makeController(gym.swimStart,false,state);frameGym();
    camera.position.copy(orbit.target).addScaledVector(gym.swimDirection,-6);camera.position.y+=3.2;orbit.update();
    notify(`Walk forward into the bay. You have ${AVATAR_SWIMMING.breathSeconds} seconds of breath while swimming; dry sand refills it.`,8);closeMenu();focusCanvas();
  }
  on('gym-swim-start','click',startSwimmingPractice);
  on('gym-suit-return','click',()=>{swapGear(false);clearInput();frameGym();notify('Otter Man returned. Your own outfit is back on.',4);focusCanvas();});
  on('gym-surrey-visit','click',()=>{if(!surrey)return;resetGym();const point=surrey.exit();if(point)makeController(point,true);frameGym();closeMenu();notify('Press E to ride the surrey.',4);});
  on('gym-suit-station','click',()=>{resetGym();closeMenu();notify('The Otter Man suit is beside you. Press E to put it on.',5);});
  function save(copy=false){
    flushSizeChange();editIntent++;
    if(storageError){message(storageError);return;}
    // Merge against the latest stored collection so another tab's new characters survive.
    let latest:AvatarCollection;
    try{latest=parseAvatarCollection(localStorage.getItem(AVATAR_STORAGE_KEY));}catch{message('Saved characters could not be read. Download this design to keep it.');return;}
    design=normalizeAvatarDesign({...design,name:$<HTMLInputElement>('avatar-name').value});
    const id=!copy&&currentId?currentId:crypto.randomUUID();
    if(!latest.avatars.some(a=>a.id===id)&&latest.avatars.length>=AVATAR_SAVE_LIMIT){message('This browser has 24 characters. Update an existing character or download this one.');return;}
    const record={id,design:{...design},savedAt:new Date().toISOString()};
    const next:AvatarCollection={version:1,selectedId:id,avatars:latest.avatars.some(a=>a.id===id)?latest.avatars.map(a=>a.id===id?record:a):[...latest.avatars,record]};
    try{localStorage.setItem(AVATAR_STORAGE_KEY,JSON.stringify(next));collection=next;currentId=id;dirty=false;updateSelections();updateLibrary();message(`“${design.name}” saved in this browser. Download a copy for another device.`);}catch{message('This browser could not save. Download JSON to keep your character.');}
  }
  async function loadSaved(id:string){
    if(disposed)return;
    if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);
    let latest:AvatarCollection;
    try{latest=parseAvatarCollection(localStorage.getItem(AVATAR_STORAGE_KEY));}catch{message('Saved characters could not be read.');return;}
    const saved=latest.avatars.find(a=>a.id===id);if(!saved){message('That saved character is no longer available.');return;}
    chooseEmote('none');currentId=id;collection={...latest,selectedId:id};let selectedSaved=true;
    try{localStorage.setItem(AVATAR_STORAGE_KEY,JSON.stringify(collection));}catch{selectedSaved=false;}
    const intent=editIntent+1;await replaceAvatar(saved.design);if(disposed||editIntent!==intent)return;dirty=false;
    message(`Loaded “${design.name}”. ${selectedSaved?'Outfits remain editable.':'This browser could not remember the selection.'}`);
  }
  window.addEventListener('storage',event=>{
    if(event.key!==AVATAR_STORAGE_KEY&&event.key!==null)return;
    try{collection=parseAvatarCollection(event.key===null?null:event.newValue);storageError='';if(currentId&&!collection.avatars.some(a=>a.id===currentId))currentId=null;updateSelections();updateLibrary();if(!dirty)message('Saved character list updated in another tab.');}catch{storageError='Saved characters could not be read. Download this design to keep it.';message(storageError);}
  },{signal});
  on('avatar-name','input',()=>{editIntent++;design=normalizeAvatarDesign({...design,name:$<HTMLInputElement>('avatar-name').value});dirty=true;message('Unsaved changes · save when you’re ready.');});
  studioHost.querySelectorAll<HTMLButtonElement>('[data-design]').forEach(b=>b.addEventListener('click',()=>{void replaceAvatar({...design,[b.dataset.design!]:b.dataset.value});},{signal}));
  studioHost.querySelectorAll<HTMLInputElement>('[data-size]').forEach(control=>{
    control.addEventListener('input',()=>{
      editIntent++;design=normalizeAvatarDesign({...design,[control.dataset.size!]:control.valueAsNumber});
      dirty=true;updateSizeControls();message('Unsaved changes · save when you’re ready.');
      // Rebuild only during editing, at a bounded rate; the animation loop never edits geometry.
      if(!sizeTimer)sizeTimer=window.setTimeout(()=>{sizeTimer=0;void replaceAvatar(design);},80);
    },{signal});
    control.addEventListener('change',flushSizeChange,{signal});
  });
  on('avatar-size-reset','click',()=>{void replaceAvatar({...design,heightMeters:AVATAR_SIZE_LIMITS.heightMeters.default,bodyBuild:AVATAR_SIZE_LIMITS.bodyBuild.default});});
  const categoryButtons=[...studioHost.querySelectorAll<HTMLButtonElement>('[data-category]')];
  function category(button:HTMLButtonElement){categoryButtons.forEach(b=>{const selected=b===button;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('av-options-'+b.dataset.category).hidden=!selected;});}
  categoryButtons.forEach((b,i)=>{b.addEventListener('click',()=>category(b),{signal});b.addEventListener('keydown',e=>{const offset=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!offset)return;e.preventDefault();e.stopPropagation();const next=categoryButtons[(i+offset+categoryButtons.length)%categoryButtons.length];category(next);next.focus();},{signal});});
  let shuffleIndex=0;
  on('avatar-shuffle','click',()=>{shuffleIndex++;const next={...design};for(const [field,choices] of Object.entries(STYLE_OPTIONS)){(next as unknown as Record<string,string>)[field]=choices[(shuffleIndex+field.length)%choices.length][0];}for(const [field,choices] of Object.entries(PALETTES)){(next as unknown as Record<string,string>)[field]=choices[(shuffleIndex+field.length)%choices.length][1];}void replaceAvatar(next);});
  on('avatar-save','click',()=>save());on('avatar-save-copy','click',()=>save(true));
  on('avatar-load','click',()=>{void loadSaved($<HTMLSelectElement>('avatar-saved').value);});
  on('avatar-export','click',()=>{flushSizeChange();const blob=new Blob([avatarDownload(design)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${design.name.replace(/[^a-z0-9-]/gi,'-').slice(0,32)||'coastal-character'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Character recipe downloaded. Import it on another browser to continue.');});
  on('avatar-import-button','click',()=>$<HTMLInputElement>('avatar-import').click());
  on('avatar-import','change',()=>{void (async()=>{
    const input=$<HTMLInputElement>('avatar-import'),file=input.files?.[0];if(!file)return;
    flushSizeChange();let intent=++editIntent;
    try{
      if(file.size>32768)throw Error('Avatar files must be smaller than 32 KB.');
      const text=await file.text();if(disposed||editIntent!==intent)return;
      const next=parseAvatarDownload(text);currentId=null;intent=editIntent+1;
      await replaceAvatar(next);if(disposed||editIntent!==intent)return;
      message('Imported character · save to add it to this browser.');
    }catch(error){if(!disposed&&editIntent===intent)message(error instanceof Error?error.message:'This avatar file could not be read.');}
    finally{if(input.files?.[0]===file)input.value='';}
  })();});
  on('avatar-to-gym','click',()=>navigate('gym'));on('gym-back','click',()=>navigate('avatars'));
  on('avatar-pose','change',()=>{pose=$<HTMLSelectElement>('avatar-pose').value;chooseEmote('none');contact.visible=pose!=='swim'&&pose!=='tread';});
  on('gym-avatar','change',()=>{const id=$<HTMLSelectElement>('gym-avatar').value;if(id)void loadSaved(id);});
  function chooseEmote(value:Emote){if(value==='cast'&&emote==='cast')avatar.update(0,{...motion,emote:'none'});if(value!=='sit'&&seatReturn){avatar.root.position.copy(seatReturn);seatReturn=undefined;makeController(avatar.root.position.clone());}emote=value;emoteTime=0;studioHost.querySelectorAll('[data-emote]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.emote===value)));gymHost.querySelectorAll('[data-emote]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.emote===value)));}
  // In the gym an emote button toggles: pressing the active one (or moving) stands back up.
  function gymEmote(value:Emote){if(ridingSurrey||boating||motion.swimming||airborne||motion.flying)return;chooseEmote(emote===value?'none':value);}
  [studioHost,gymHost].forEach(host=>host.querySelectorAll<HTMLButtonElement>('[data-emote]').forEach(b=>b.addEventListener('click',()=>{if(active==='gym'){gymEmote(b.dataset.emote as Emote);closeEmotes(true);return;}if(pose==='swim'||pose==='tread'){pose='idle';$<HTMLSelectElement>('avatar-pose').value=pose;contact.visible=true;}chooseEmote(b.dataset.emote as Emote);},{signal})));
  function clearInput(){keys.clear();touchDirections.clear();jumpTouch=jumpLatch=diveTouch=false;pad.clear();gymHost.querySelectorAll('[data-move]').forEach(b=>b.setAttribute('aria-pressed','false'));}
  on('gym-run','click',()=>{runToggle=!runToggle;$('gym-run').setAttribute('aria-pressed',String(runToggle));});
  const jumpButton=$('gym-jump');
  jumpButton.addEventListener('pointerdown',e=>{e.preventDefault();jumpButton.setPointerCapture(e.pointerId);jumpTouch=jumpLatch=true;jumpButton.classList.add('is-pressed');},{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])jumpButton.addEventListener(type,()=>{jumpTouch=false;jumpButton.classList.remove('is-pressed');},{signal});
  // Keyboard/switch activation of the on-screen button still produces one hop.
  jumpButton.addEventListener('click',e=>{if(e.detail===0)jumpLatch=true;},{signal});
  const diveButton=$('gym-dive');
  diveButton.addEventListener('pointerdown',e=>{e.preventDefault();diveButton.setPointerCapture(e.pointerId);diveTouch=true;diveButton.classList.add('is-pressed');},{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])diveButton.addEventListener(type,()=>{diveTouch=false;diveButton.classList.remove('is-pressed');},{signal});
  // Emote wheel: Q / Y / the Emotes button opens it; click, arrow keys or the stick choose.
  const emoteMenu=$('gym-emote-menu'),emoteItems=[...emoteMenu.querySelectorAll<HTMLButtonElement>('[data-emote]')];
  let emoteAim=-1;
  function aimEmote(index:number){emoteAim=index;emoteItems.forEach((b,i)=>b.classList.toggle('is-aimed',i===index));}
  function openEmotes(focusFirst=false){
    if(!gym||boating||motion.swimming||motion.flying||!emoteMenu.hidden)return;
    clearInput();emoteMenu.hidden=false;$('gym-emote-toggle').setAttribute('aria-expanded','true');aimEmote(-1);
    if(focusFirst)emoteItems[0].focus({preventScroll:true});
  }
  function closeEmotes(refocus=false){
    if(emoteMenu.hidden)return;emoteMenu.hidden=true;$('gym-emote-toggle').setAttribute('aria-expanded','false');aimEmote(-1);
    // The button that confirmed (A, B or a key) must not also jump, run or dive on the next frame,
    // and the stick that aimed must return to centre before it walks (walking cancels the emote).
    clearInput();stickReleased=false;
    if(refocus)focusCanvas();
  }
  /** Pick the wheel item nearest a screen-space direction (y down), as the item angles are laid out. */
  function aimEmoteAt(x:number,y:number){
    if(Math.hypot(x,y)<.45)return;const angle=Math.atan2(y,x);let best=-1,bestDelta=Infinity;
    GYM_EMOTES.forEach((_,i)=>{const itemAngle=(-90+i*360/GYM_EMOTES.length)*Math.PI/180,delta=Math.abs(Math.atan2(Math.sin(angle-itemAngle),Math.cos(angle-itemAngle)));if(delta<bestDelta){bestDelta=delta;best=i;}});
    if(best!==emoteAim)aimEmote(best);
  }
  function confirmEmote(){const item=emoteItems[emoteAim];if(item){gymEmote(item.dataset.emote as Emote);closeEmotes(true);}else closeEmotes(true);}
  on('gym-emote-toggle','click',()=>{if(emoteMenu.hidden)openEmotes();else closeEmotes(true);});
  emoteMenu.addEventListener('keydown',e=>{
    const index=emoteItems.indexOf(document.activeElement as HTMLButtonElement),step=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
    if(step){e.preventDefault();e.stopPropagation();const next=emoteItems[(Math.max(0,index)+step+emoteItems.length)%emoteItems.length];next.focus({preventScroll:true});aimEmote(emoteItems.indexOf(next));}
    else if(e.key==='Escape'||e.code==='KeyQ'){e.preventDefault();e.stopPropagation();closeEmotes(true);}
  },{signal});
  document.addEventListener('pointerdown',e=>{const target=e.target as Node;if(!emoteMenu.hidden&&!emoteMenu.contains(target)&&!$('gym-emote-toggle').contains(target))closeEmotes();},{signal});
  // Touch controls follow the input actually in use, so desktop players never see a d-pad.
  const layout=gymHost.querySelector<HTMLElement>('.gym-layout')!;
  layout.classList.toggle('uses-touch',matchMedia('(pointer: coarse)').matches);
  gymHost.addEventListener('pointerdown',e=>{layout.classList.remove('uses-gamepad');if(e.pointerType==='touch')layout.classList.add('uses-touch');else if(e.pointerType==='mouse')layout.classList.remove('uses-touch');},{signal,capture:true});
  // A pointer click on a HUD button hands focus back to the world so Space/WASD keep playing.
  gymHost.addEventListener('click',e=>{const target=e.target as HTMLElement;if(e.detail>0&&target.closest('.gym-controls button,.gym-prompt-area button'))focusCanvas();},{signal});
  const menu=$<HTMLDetailsElement>('gym-menu');
  function closeMenu(){menu.open=false;}
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeMenu();menu.querySelector('summary')!.focus();}},{signal});
  document.addEventListener('pointerdown',e=>{if(menu.open&&!menu.contains(e.target as Node))closeMenu();},{signal});
  gymHost.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchDirections.add(button.dataset.move!);button.setAttribute('aria-pressed','true');},{signal});
    const release=()=>{touchDirections.delete(button.dataset.move!);button.setAttribute('aria-pressed','false');};
    button.addEventListener('pointerup',release,{signal});button.addEventListener('pointercancel',release,{signal});button.addEventListener('lostpointercapture',release,{signal});
  });
  function focusCanvas(){renderer.domElement.focus({preventScroll:true});}
  function frameStudio(){camera.near=.05;camera.far=600;avatar.root.position.set(0,0,0);avatar.root.rotation.set(0,.06,0);orbit.minDistance=2;orbit.maxDistance=6;orbit.minPolarAngle=.6;orbit.maxPolarAngle=Math.PI*.51;orbit.target.set(0,avatar.dimensions.cameraTargetHeight,0);camera.fov=38;camera.position.set(.1,avatar.dimensions.cameraTargetHeight+.44,3.7);camera.updateProjectionMatrix();orbit.update();}
  /** Under the surface the world closes in to a short teal fog (the shared `below` tone) and the
   * sky dome hides. The water's existing underside shading supplies the surface from beneath. */
  const UNDERWATER_FOG={near:.8,far:24};
  function setUnderwater(next:boolean){
    if(next===underwater)return;underwater=next;const fog=gymScene.fog as Fog;
    if(next&&!enhancedWater){fog.color.copy(STYLE.dome.below);fog.near=UNDERWATER_FOG.near;fog.far=UNDERWATER_FOG.far;gymScene.background=STYLE.dome.below.clone();}
    else{fog.color.copy(STYLE.dome.horizon);fog.near=160;fog.far=480;gymScene.background=STYLE.dome.horizon.clone();}
    gymSky.root.visible=enhancedWater?true:!next;layout.classList.toggle('is-underwater',next);
  }
  function setDestination(next:GymDestination){
    destination=next;$<HTMLSelectElement>('gym-destination').value=next;
    gymHost.querySelector('.gym-place h1')!.textContent=DESTINATION_NAMES[next];
    const url=new URL(location.href);if(url.searchParams.get('destination')!==next){url.searchParams.set('destination',next);history.replaceState(history.state,'',url);}
    if(!overview)$('gym-overview').textContent=next==='caledonia-park'?'Caledonia overview':'Park overview';
  }
  function frameGym(){if(!gym)return;deerViewId='';caledoniaOverview=false;setUnderwater(false);overview=false;bayOverview=false;gymHost.querySelector('.gym-layout')?.classList.remove('is-bay-overview');gymLocal.visible=true;if(bayExtension){gymRegional.visible=false;bayExtension.setDetailed(true);}gym.water.root.visible=true;$('gym-bay-overview').setAttribute('aria-pressed','false');camera.near=.25;camera.far=3500;(gymScene.fog as Fog).near=160;(gymScene.fog as Fog).far=480;$('gym-overview').setAttribute('aria-pressed','false');$('gym-overview').textContent=destination==='caledonia-park'?'Caledonia overview':'Park overview';orbit.minDistance=3.5;orbit.maxDistance=otterSuit?45:17;orbit.minPolarAngle=.35;orbit.maxPolarAngle=Math.PI*.46;orbit.target.copy(avatar.root.position).add(new Vector3(0,.9*avatar.dimensions.heightScale,0));camera.fov=49;camera.position.copy(orbit.target).add(new Vector3(-4.5,3.2,6));camera.updateProjectionMatrix();orbit.update();}
  function resetGym(){if(!gym)return;ridingSurrey=false;surrey?.stop();boatControls(false);setDestination('lovers-point');museumFloor=null;gym.museum.setView('exterior');if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);if(aboard)leaveDiveBoat('pier');gym.diveBoat.vessel.reset();swapGear(false);gym.vessel.reset();clearInput();chooseEmote('none');avatar.root.position.copy(gym.spawn);avatar.root.rotation.set(0,0,0);makeController(undefined,true);motion.swimming=false;airborne=false;swimControls(false);wasLowBreath=false;footShadow.visible=true;frameGym();notify('Back at the park entrance.',3);focusCanvas();}
  function frameOverview(){
    if(!gym)return;deerViewId='';caledoniaOverview=false;
    setUnderwater(false);overview=true;bayOverview=false;gymHost.querySelector('.gym-layout')?.classList.remove('is-bay-overview');gymLocal.visible=true;if(bayExtension){gymRegional.visible=false;bayExtension.setDetailed(true);}gym.water.root.visible=true;$('gym-bay-overview').setAttribute('aria-pressed','false');orbit.maxDistance=2200;orbit.maxPolarAngle=Math.PI*.46;
    orbit.target.set(0,0,-15);
    const direction=new Vector3(.72,1,.95).normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize(),up=new Vector3().crossVectors(direction,right);
    const vertical=Math.tan(camera.fov*Math.PI/360),horizontal=vertical*camera.aspect;
    let distance=0;
    // Fit the bounded land, excluding the offshore water plane. Horizontal FOV
    // matters on phones; camera framing never rescales the mapped geometry.
    for(const x of [-145,145])for(const z of [-160,130])for(const y of [0,10]){
      const corner=new Vector3(x,y,z).sub(orbit.target),depth=corner.dot(direction);
      distance=Math.max(distance,depth+Math.abs(corner.dot(right))/horizontal,depth+Math.abs(corner.dot(up))/vertical);
    }
    distance*=1.12;camera.position.copy(orbit.target).addScaledVector(direction,distance);
    camera.near=20;camera.far=Math.max(2000,distance*6);camera.updateProjectionMatrix();
    (gymScene.fog as Fog).near=distance+80;(gymScene.fog as Fog).far=distance+650;
    orbit.update();$('gym-overview').setAttribute('aria-pressed','true');$('gym-overview').textContent='Walk view';
  }
  function frameBayOverview(){
    if(!gym||!bayExtension)return;deerViewId='';
    setUnderwater(false);overview=true;bayOverview=true;gymHost.querySelector('.gym-layout')?.classList.add('is-bay-overview');gymLocal.visible=false;gymRegional.visible=true;bayExtension.setDetailed(false);gym.water.root.visible=false;
    gymHost.querySelector('.gym-place h1')!.textContent='Monterey Bay';
    const box=bayExtension.bounds,center=box.getCenter(new Vector3()),direction=new Vector3(0,1,.2).normalize();
    const place=bayExtension.places.find(item=>item.id===bayFocusId);
    const focus=place?bayExtension.point(place.longitude,place.latitude):center;
    orbit.target.set(focus.x,place?Math.max(0,focus.y):0,focus.z);orbit.minDistance=place?100:500;orbit.maxDistance=place?20000:110000;orbit.minPolarAngle=.05;orbit.maxPolarAngle=Math.PI*.48;
    const right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize(),up=new Vector3().crossVectors(direction,right);
    const vertical=Math.tan(camera.fov*Math.PI/360),horizontal=vertical*camera.aspect;
    let distance=0;
    for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])for(const y of [0,600]){
      const corner=new Vector3(x,y,z).sub(orbit.target),depth=corner.dot(direction);
      distance=Math.max(distance,depth+Math.abs(corner.dot(right))/horizontal,depth+Math.abs(corner.dot(up))/vertical);
    }
    camera.position.copy(orbit.target).addScaledVector(direction,place?8000:distance*1.12);
    camera.near=place?2:50;camera.far=place?50000:200000;camera.updateProjectionMatrix();orbit.update();
    $('gym-bay-overview').setAttribute('aria-pressed','true');$('gym-overview').setAttribute('aria-pressed','false');$('gym-overview').textContent='Park overview';
  }
  function visitMuseum(upper=false){
    if(!gym)return;returnRod();resetGym();museumFloor=upper?'upper':'ground';gym.museum.setView(museumFloor);
    const position=(upper?gym.museum.upstairs:gym.museum.entrance).clone();avatar.root.position.copy(position);avatar.root.rotation.y=Math.atan2(MUSEUM_SITE.back[0],MUSEUM_SITE.back[1]);makeController(position,true);setDestination('museum');frameGym();camera.position.copy(orbit.target).add(new Vector3(2.5,4.8,-6.7));orbit.update();$('gym-hint').classList.add('is-done');closeMenu();
    notify(upper?'Changes · museum mezzanine. Use the menu to return to the ground floor.':'Pacific Grove Museum of Natural History · ground floor study',5);focusCanvas();
  }
  on('gym-museum-visit','click',()=>visitMuseum());on('gym-museum-upper','click',()=>visitMuseum(true));
  on('gym-museum-overview','click',()=>{if(!gym)return;frameOverview();gym.museum.setView('exterior');orbit.target.copy(gym.museum.point(19,18,2));const distance=85/Math.min(1,camera.aspect);camera.near=.25;camera.position.copy(orbit.target).add(new Vector3(.25,.78,-1).normalize().multiplyScalar(distance));camera.updateProjectionMatrix();orbit.update();closeMenu();});
  function visitCaledonia(){
    if(!gym)return;returnRod();resetGym();makeController(gym.caledonia.spawn.clone(),true);setDestination('caledonia-park');frameGym();
    const entry=gym.caledonia.parkEntrances[0],direction=new Vector3(entry.inside[0]-entry.outside[0],0,entry.inside[1]-entry.outside[1]).normalize();
    orbit.target.copy(avatar.root.position).add(new Vector3(0,1,0));camera.position.copy(orbit.target).addScaledVector(direction,-6).add(new Vector3(0,3,0));orbit.update();closeMenu();
    notify('Caledonia Park · enter through the park gate to explore the court, playgrounds and lawn.',6);focusCanvas();
  }
  function frameCaledonia(){
    if(!gym)return;frameOverview();caledoniaOverview=true;setDestination('caledonia-park');orbit.minPolarAngle=0;orbit.target.copy(gym.caledonia.center);
    const distance=Math.max(350,200/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360));camera.position.copy(orbit.target).add(new Vector3(0,distance,.001));camera.near=1;camera.far=Math.max(2000,distance*4);camera.updateProjectionMatrix();
    (gymScene.fog as Fog).near=distance+200;(gymScene.fog as Fog).far=distance+1000;orbit.update();
  }
  function visitDestination(next:GymDestination){if(next==='caledonia-park')visitCaledonia();else if(next==='museum')visitMuseum();else{returnRod();resetGym();closeMenu();}}
  on('gym-destination','change',()=>visitDestination($<HTMLSelectElement>('gym-destination').value as GymDestination));
  on('gym-caledonia-visit','click',visitCaledonia);
  on('gym-meals-visit','click',()=>{
    if(!gym)return;returnRod();resetGym();const m=gym.caledonia.meals,entry=m.entry.clone();entry.y+=.045;makeController(entry,true);setDestination('caledonia-park');frameGym();
    camera.position.copy(orbit.target).add(new Vector3(m.front[0]*10,3,m.front[1]*10));orbit.update();closeMenu();notify('Meals on Wheels Community Center · 700 Jewell Avenue. Photo-informed exterior study.',6);focusCanvas();
  });
  on('gym-caledonia-top','click',()=>{if(!gym)return;if(destination!=='caledonia-park')visitCaledonia();frameCaledonia();closeMenu();notify('Caledonia Park · north-up plan. Court to the south, playgrounds and lawn to the north. Drag to orbit.',7);});
  on('gym-pool-visit','click',()=>{
    if(!gym)return;returnRod();resetGym();
    const point=gym.interactions.find(item=>item.id==='pool-gate')!.position.clone();
    makeController(point);frameGym();camera.position.copy(avatar.root.position).add(new Vector3(5.77,3,-1.65));orbit.update();closeMenu();notify('Pool and volleyball court. Walk to the gate and press E, X, or tap the prompt.',6);
  });
  on('gym-coastal-view','click',()=>{if(!gym)return;frameOverview();orbit.target.set(165,0,-65);camera.position.set(240,35,5);orbit.update();closeMenu();notify('Kelp beds and an offshore shark patrol. Use scuba gear for a closer look below the surface.',6);});
  function frameDeer(id:string){
    const group=deer?.groups.find(g=>g.site.id===id);if(!group||!gym||!bayExtension)return;
    frameOverview();deerViewId=id;gymRegional.visible=true;bayExtension.setDetailed(true);
    const [x,z]=group.site.home,y=bayExtension.floorAt(x,z);
    orbit.minDistance=3;orbit.maxDistance=80;camera.near=.1;camera.far=2000;camera.fov=49;
    orbit.target.set(x,y+.7,z);camera.position.set(x+9,y+4,z+12);camera.updateProjectionMatrix();orbit.update();
    gymHost.querySelector('.gym-place h1')!.textContent=group.site.name;
    deer?.setViewer(x,z);$('gym-deer-place').setAttribute('data-current',id);
  }
  on('gym-deer-place','change',()=>{
    const id=$<HTMLSelectElement>('gym-deer-place').value,group=deer?.groups.find(g=>g.site.id===id);if(!group||!gym)return;
    if(id==='caledonia'){
      returnRod();resetGym();const [x,z]=group.site.home;let arrival:Vector3|undefined;
      for(let i=0;i<24&&!arrival;i++){const angle=i*Math.PI/12,px=x+Math.sin(angle)*10,pz=z+Math.cos(angle)*10;
        if(canStandAt(px,pz,gym.bounds,gym.colliders,.4))arrival=new Vector3(px,gym.groundHeight(px,pz)+.02,pz);}
      if(arrival){makeController(arrival,true);setDestination('caledonia-park');frameGym();
        const away=arrival.clone().sub(new Vector3(x,arrival.y,z)).normalize();camera.position.copy(orbit.target).addScaledVector(away,6);camera.position.y+=2.6;orbit.update();
      }else frameDeer(id);
    }else frameDeer(id);
    closeMenu();notify(id==='caledonia'?'Deer on the north lawn. They will move away if you approach.':'Deer at '+group.site.name+'. Drag to look around; Back to start returns to walking.',7);focusCanvas();
  });
  on('gym-whale-view','click',()=>{if(!gym)return;frameOverview();orbit.target.set(220,1,20);camera.position.set(170,24,-20);orbit.update();closeMenu();notify(gym.whalePod.stats().sighting?'Gray whales travel together offshore. Watch for spouts, tail-first dives, and rare breaches.':'No gray whales are visible offshore on this visit.',6);});
  on('gym-waterfront-view','click',()=>{
    if(!gym)return;frameOverview();orbit.target.copy(gym.waterfront.center);const size=gym.waterfront.bounds.getSize(new Vector3());
    const distance=Math.max(size.z,size.x/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.5;
    camera.position.copy(orbit.target).add(new Vector3(.4,1,1).normalize().multiplyScalar(distance));camera.far=6000;camera.updateProjectionMatrix();orbit.update();closeMenu();
  });
  on('gym-bay-overview','click',()=>{if(bayOverview)frameGym();else{bayFocusId='';$<HTMLSelectElement>('gym-bay-place').value='';frameBayOverview();}closeMenu();});
  on('gym-bay-place','change',()=>{if(!bayExtension)return;bayFocusId=$<HTMLSelectElement>('gym-bay-place').value;frameBayOverview();closeMenu();});
  on('gym-overview','click',()=>{if(overview&&!bayOverview)frameGym();else if(destination==='caledonia-park')frameCaledonia();else frameOverview();closeMenu();});
  on('gym-reset','click',()=>visitDestination(destination));
  function attachRod(){if(!heldRod)return;avatar.anchors.rightHand.add(heldRod.object);heldRod.object.position.set(0,-.14,.03);heldRod.object.rotation.set(0,0,0);}
  function returnRod(){if(!heldRod||!gym)return;gym.root.add(heldRod.object);heldRod.object.position.copy(heldRod.position);heldRod.object.rotation.copy(heldRod.rotation);heldRod=undefined;gym.setRodEquipped(false);motion.carrying=false;$('gym-return-rod').hidden=true;}
  function equipRod(){if(heldRod||!gym)return;const rod=gym.interactions.find(item=>item.id==='spinning-rod')?.object;if(!(rod instanceof Group))return;heldRod={object:rod,position:rod.position.clone(),rotation:rod.rotation.clone()};attachRod();gym.setRodEquipped(true);motion.carrying=true;$('gym-return-rod').hidden=false;}
  on('gym-return-rod','click',()=>{returnRod();notify('Rod returned to its station.',3);});
  function boatControls(enabled:boolean,faster='Row faster',verb='Row'){
    gymHost.querySelector('.gym-layout')?.classList.toggle('is-boating',enabled);
    $('gym-run').hidden=false;$('gym-run').textContent=enabled?faster:'Run';
    $('gym-run').setAttribute('aria-pressed','false');runToggle=false;
    for(const [move,walking,rowing] of [['forward','Walk forward',`${verb} forward`],['back','Walk backward',`${verb} backward`],['left','Walk left','Steer left'],['right','Walk right','Steer right']]){
      const button=gymHost.querySelector<HTMLButtonElement>(`[data-move="${move}"]`);button?.setAttribute('aria-label',enabled?rowing:walking);
    }
    footShadow.visible=!enabled;clearInput();
  }
  function resetBoatBreath(){
    controller?.leaveWater();gymControllerState=controller?.getState();
    motion.submerged=false;wasLowBreath=false;breathDisplay=-1;
    showBreath({swimming:false,wading:false,submerged:false,breath:AVATAR_SWIMMING.breathSeconds,lowBreath:false,exhausted:false});
  }
  function boardBoat(){
    if(!gym||boating||motion.swimming||aboard)return;
    returnRod();if(seatReturn)chooseEmote('none');
    motion.swimming=false;swimControls(false);boating=true;resetBoatBreath();boatControls(true);chooseEmote('sit');
    gym.vessel.seatPose(avatar.root.position);avatar.root.position.y+=.27-avatar.dimensions.seatedContactHeight;avatar.root.rotation.y=gym.vessel.heading;
    motion.speed=lastSpeed=0;airborne=false;
    notify('W/S row · A/D steer · Shift rows faster. Come back to the dock to step ashore.',5);
    if(overview)frameGym();focusCanvas();
  }
  function leaveBoat(force=false){
    if(!gym||!boating||(!force&&!gym.vessel.nearDock()))return false;
    boating=false;gym.vessel.reset();boatControls(false);chooseEmote('none');
    avatar.root.position.set(gym.vessel.landingX,gym.groundHeight(gym.vessel.landingX,gym.vessel.landingZ),gym.vessel.landingZ);
    avatar.root.rotation.y=0;makeController(avatar.root.position.clone());
    notify('Back on the dock. The rowboat is moored and ready again.',4);
    return true;
  }
  /** Dive boat: stand on the moored boat's deck. The controller pauses; the deck bob places the root. */
  function boardDiveBoat(){
    if(!gym||aboard)return;if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);returnRod();chooseEmote('none');clearInput();closeEmotes();
    aboard=true;resetBoatBreath();nearest=undefined;motion.swimming=airborne=false;swimControls(false);layout.classList.add('is-aboard');footShadow.visible=false;
    gym.diveBoat.deckPoint(gym.diveBoat.stand,avatar.root.position);avatar.root.rotation.y=gym.diveBoat.yaw+Math.PI/2;
    boatControls(true,'Faster','Drive');footShadow.visible=false;
    notify(scuba?'Back on deck. Dive in again whenever you like.':'W/S drive · A/D steer · Shift faster. The scuba locker is on deck: suit up, then dive in anywhere.',6);
    if(overview)frameGym();focusCanvas();
  }
  /** Leave the deck onto the pier, or into the water off the stern (always at the surface). */
  function leaveDiveBoat(to:'pier'|'water'){
    if(!gym||!aboard)return;aboard=false;layout.classList.remove('is-aboard');boatControls(false);footShadow.visible=true;
    // Stepping (or being sent) ashore returns the boat to its mooring so it can be boarded again.
    if(to==='pier')gym.diveBoat.vessel.reset();
    const target=to==='pier'?gym.diveBoat.boarding:gym.diveBoat.entryPoint(new Vector3());
    avatar.root.position.copy(target);avatar.root.rotation.y=gym.diveBoat.yaw+(to==='pier'?Math.PI:Math.PI/2);
    makeController(avatar.root.position.clone());
    if(to==='water')notify(scuba?'Splash! Hold C (or B, or Dive) to go down. Space swims up.':'Splash! Swim back to the ladder at the stern to climb aboard.',5);
  }
  function primaryAboard(){if(scuba)leaveDiveBoat('water');else{swapGear(true);notify('Suited up. The tank never runs out, so take your time down there.',4);}}
  function secondaryAboard(){if(scuba){swapGear(false);notify('Scuba gear stowed in the locker.',3);}else if(gym?.diveBoat.vessel.nearDock()){leaveDiveBoat('pier');notify('Back on the pier.',3);}}
  function idleMessage(text:string){if(time>interactionUntil&&$('gym-message').textContent!==text)$('gym-message').textContent=text;}
  function nearestInteraction(){
    if(!gym)return;
    if(ridingSurrey){setPrompt('Stop & leave surrey',true);return;}
    if(surrey&&!airborne&&!otterSuit&&!boating&&!aboard&&!motion.swimming&&!motion.flying&&avatar.root.position.distanceTo(surrey.root.position)<3){nearest=undefined;setPrompt('Ride pedal surrey',true);return;}
    if(otterSuit){nearest=undefined;setPrompt();idleMessage(motion.flying?(motion.submerged?'Otter Man · underwater · headlamp on · Space / A up · C / B down · Shift boost':'Otter Man · Space / A up · C / B down · Shift boost · release to hover'):'Otter Man · hold Space / A to lift off.');return;}
    if(boating){nearest=undefined;const docked=gym.vessel.nearDock();setPrompt(docked?'Dock & step ashore':'Row back to the dock',docked);idleMessage('');return;}
    if(aboard){nearest=undefined;const moored=gym.diveBoat.vessel.nearDock();setPrompt(scuba?'Dive in':'Put on scuba gear',true,scuba?'Take off scuba gear':moored?'Step onto the pier':undefined);idleMessage(moored||scuba?'':'Drive back to the pier to step ashore.');return;}
    if(motion.swimming){
      // The stern ladder is the one station a swimmer (or diver) can use.
      nearest=undefined;const ladder=gym.diveBoat.ladderPoint(ladderPoint);
      nearLadder=Math.hypot(ladder.x-avatar.root.position.x,ladder.z-avatar.root.position.z)<=gym.diveBoat.ladderRadius;
      setPrompt(nearLadder?'Climb aboard':undefined);idleMessage('');return;
    }
    nearLadder=false;
    let found:GymInteraction|undefined,best=Infinity;
    // Mid-hop is not a time to start an interaction; the prompt returns on landing.
    // The pier boarding prompt only appears while the dive boat is moored there.
    if(!airborne)for(const item of gym.interactions){if(item.action==='board-dive'&&!gym.diveBoat.vessel.nearDock())continue;const d=Math.hypot(item.position.x-avatar.root.position.x,item.position.z-avatar.root.position.z);if(d<=item.radius&&d<best){best=d;found=item;}}
    if(found!==nearest||found?.action==='gate'||!found){nearest=found;setPrompt(found?.action==='gate'?gym.poolGate.label:found?.label);}
    idleMessage(found?.description??'');
  }
  const interacted=new Set<string>();
  function leaveSurrey(force=false){
    if(!surrey||!ridingSurrey)return true;
    const exit=surrey.exit();if(!exit&&!force){notify('Move to a clear spot before stepping off.',3);return false;}
    surrey.stop();ridingSurrey=false;boatControls(false);chooseEmote('none');makeController(exit??gym!.spawn,true);nearest=undefined;setPrompt();clearInput();return true;
  }
  function interact(){
    if(ridingSurrey){leaveSurrey();return;}
    if(surrey&&!airborne&&!otterSuit&&!boating&&!aboard&&!motion.swimming&&!motion.flying&&avatar.root.position.distanceTo(surrey.root.position)<3){returnRod();clearInput();ridingSurrey=true;airborne=false;motion.airborne=false;footShadow.visible=false;chooseEmote('sit');boatControls(true,'Pedal','Pedal');$('gym-run').hidden=true;notify('W/S to pedal or reverse · A/D to steer · release to brake · E to step off.',6);return;}
    if(boating){if(leaveBoat())focusCanvas();return;}
    if(aboard){primaryAboard();focusCanvas();return;}
    if(motion.swimming&&nearLadder){boardDiveBoat();return;}
    if(otterSuit||motion.swimming||airborne||!nearest)return;interacted.add(nearest.id);interactionUntil=time+5;
    if(nearest.action==='gate'){
      const result=gym!.poolGate.toggle(avatar.root.position,avatar.dimensions.controllerRadius);
      nearest.label=gym!.poolGate.label;setPrompt(nearest.label);notify(result.message,4);focusCanvas();return;
    }
    if(nearest.action==='suit'){
      returnRod();chooseEmote('none');clearInput();closeEmotes();swapGear(false,true);swimControls(false);$('gym-breath').hidden=true;
      notify('Otter Man equipped. Hold Space to lift off, C to descend, Shift to boost. Release movement to hover.',8);frameGym();focusCanvas();return;
    }
    if(nearest.action==='sit'){
      if(!seatReturn)seatReturn=avatar.root.position.clone();
      if(nearest.seatPosition){avatar.root.position.copy(nearest.seatPosition);avatar.root.position.y-=avatar.dimensions.seatedContactHeight;avatar.root.rotation.y=nearest.yaw??0;makeController(avatar.root.position.clone());avatar.root.rotation.y=nearest.yaw??0;}
      clearInput();chooseEmote('sit');interactionMessage='Taking a seaside break. Move or choose Stand to get up.';
    }
    else if(nearest.action==='collect'){equipRod();chooseEmote('none');interactionMessage='Rod equipped. Walk over to the casting station beside the dock.';}
    else if(nearest.action==='cast'){equipRod();chooseEmote('cast');interactionMessage='Practice cast! Try the rod pose and reach; catching fish comes next.';}
    else if(nearest.action==='board'){boardBoat();}
    else if(nearest.action==='board-dive'){boardDiveBoat();return;}
    else{chooseEmote('wave');interactionMessage=nearest.description;}
    $('gym-message').textContent=interactionMessage;focusCanvas();
  }
  on('gym-interact','click',interact);
  on('gym-interact-alt','click',()=>{if(aboard){secondaryAboard();focusCanvas();}});
  window.addEventListener('keydown',e=>{
    if(active!=='gym'||!gymInitialized||gymFirstFramePending||e.altKey||e.ctrlKey||e.metaKey)return;
    layout.classList.remove('uses-gamepad');
    const target=e.target as HTMLElement;if(target.closest('input,select,textarea,[role="tab"],summary,.gym-menu-panel')||target.isContentEditable)return;
    const emoteKey=GYM_EMOTES.find(([,,key])=>e.code==='Digit'+key)?.[0];
    // While the wheel is open it owns the keyboard (its own handler moves focus); quick keys still pick.
    if(!emoteMenu.hidden){if(emoteKey&&!e.repeat){e.preventDefault();gymEmote(emoteKey);closeEmotes(true);}return;}
    // A focused button or link keeps its own Space/Enter activation for keyboard users.
    if(e.code==='Space'&&target.closest('button,a'))return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyC','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact();}
    if(e.code==='KeyR'&&!e.repeat&&aboard){e.preventDefault();secondaryAboard();}
    if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();openEmotes(true);}
    if(emoteKey&&!e.repeat){e.preventDefault();gymEmote(emoteKey);}
  },{signal});
  window.addEventListener('keyup',e=>keys.delete(e.code),{signal});window.addEventListener('blur',clearInput,{signal});
  const setLod=(value:string)=>{if(value!=='auto'&&!LOD_LEVELS.includes(value as never))return;lod.setMode(value as LodMode);$<HTMLSelectElement>('avatar-lod').value=value;$<HTMLSelectElement>('gym-lod').value=value;budget();};
  on('avatar-lod','change',()=>setLod($<HTMLSelectElement>('avatar-lod').value));on('gym-lod','change',()=>setLod($<HTMLSelectElement>('gym-lod').value));
  setLod(params.get('lod')??'auto');
  async function ensureGym(){
    if(gymInitialized||gymFailed)return;if(gymLoading)return gymLoading;
    gymLoading=(async()=>{
      try{
        setGymLoading(gymHost,'Loading the park and its assets…');await paintLoadingStage();
        const module=await import('./testingGym');if(disposed)return;
        setGymLoading(gymHost,'Building Lovers Point and its wildlife…');await paintLoadingStage();if(disposed)return;
        const whalePreview=import.meta.env.DEV?params.get('whales'):null;
        gym=module.createTestingGym({whaleSightingRoll:whalePreview==='show'?0:whalePreview==='hide'?.99:undefined});
        surrey=createGymSurrey(gym.groundHeight,gym.bounds,gym.colliders);gym.root.add(surrey.root);
        await ready;if(disposed)return;
        const waterSettings=waterPanel.setCapability((renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend===true);
        if(waterSettings.mode==='enhanced'){
          setGymLoading(gymHost,'Preparing enhanced water…');await paintLoadingStage();
          try{const module=await import('./enhancedWater');if(disposed)return;enhancedWater=module.createEnhancedWater(renderer,gym.water,gymSky,weather.environment,waterSettings);waterPanel.setOnChange(enhancedWater.setSettings);refreshNodeStyle(avatar.root,tier==='standard',weather.environment);}
          catch(error){console.warn('Enhanced water initialization failed',error);waterPanel.fail();return;}
        }
        weather.environment.caustics.level.value=gym.water.root.position.y;gymLocal.add(gym.caledonia.root,gym.root,gym.reef.root,gym.whalePod.root,gym.waterfront.root,gym.museum.root);gymLocal.add(gym.coastalLife.root,gym.gulls.root,gym.seafloor.root);applyNodeStyle(gym.gulls.root,tier==='standard',weather.environment);applyNodeStyle(gym.seafloor.root,tier==='standard',weather.environment);applyNodeStyle(gym.coastalLife.root,tier==='standard',weather.environment);gym.coastalLife.swayKelp();applyNodeStyle(gym.caledonia.root,tier==='standard',weather.environment);applyNodeStyle(gym.museum.root,tier==='standard',weather.environment);applyNodeStyle(gym.waterfront.root,tier==='standard',weather.environment);applyNodeStyle(gym.root,tier==='standard',weather.environment);applyGymSurfaceStyle(gym.root,weather.environment);applyNodeStyle(gym.reef.root,tier==='standard',weather.environment);applyNodeStyle(gym.whalePod.root,tier==='standard',weather.environment);gym.reef.swayKelp();setGymLoading(gymHost,'Preparing Monterey Bay…');await paintLoadingStage();if(disposed)return;bayExtension=(await import('./testingGym/bayExtension')).createGymBayExtension(gym);if(disposed){bayExtension.dispose();return;}gymRegional.add(bayExtension.root);const places=$<HTMLSelectElement>('gym-bay-place');places.replaceChildren(new Option('Whole bay',''),...bayExtension.places.map(place=>new Option(place.name,place.id)));caledoniaLabels=(await import('./mapStudy/caledoniaLabels')).createCaledoniaLabels($('gym-viewport'),camera);bayLabels=(await import('./testingGym/bayLabels')).createGymBayLabels(gymHost.querySelector<HTMLElement>('.gym-layout')!,camera,bayExtension,id=>{bayFocusId=id;places.value=id;frameBayOverview();});applyNodeStyle(bayExtension.root,tier==='standard',weather.environment);
        deer=(await import('./testingGym/deer')).createGymDeer({floorAt:bayExtension.floorAt,waterAt:bayExtension.waterAt,colliders:gym.colliders});
        gymLocal.add(deer.root);applyNodeStyle(deer.root,tier==='standard',weather.environment);
        $<HTMLSelectElement>('gym-deer-place').replaceChildren(new Option('Choose a place',''),...deer.groups.map(group=>new Option(group.site.name,group.site.id)));
        setGymLoading(gymHost,'Preparing detail levels…');await paintLoadingStage();if(disposed)return;
        await lod.register(gymScene);await ready;if(disposed||gymFailed)return;
        if(active==='gym'){gymScene.add(avatar.root);visitDestination(initialDestination);}
        setGymLoading(gymHost,'Preparing the first view…');await paintLoadingStage();if(disposed)return;
        await renderer.compileAsync(gymScene,camera);if(disposed)return;
        budget();gymInitialized=true;diagnostics.reset();resume();
      }catch(error){if(disposed)return;gymFailed=true;console.error('Testing Gym initialization failed',error);setGymLoading(gymHost,'Some assets could not be prepared. Please reload the page to try again.','error');}
    })();return gymLoading;
  }
  function resize(){if(!active||disposed)return;const mount=active==='avatars'?$('avatar-viewport'):$('gym-viewport');if(!mount.clientWidth||!mount.clientHeight)return;renderer.setSize(mount.clientWidth,mount.clientHeight);camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();if(active==='gym'&&overview){if(bayOverview)frameBayOverview();else if(deerViewId)frameDeer(deerViewId);else if(caledoniaOverview)frameCaledonia();else frameOverview();}}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(studioHost);resizeObserver.observe(gymHost);
  function showError(host:HTMLElement,text:string){let e=host.querySelector<HTMLElement>('.av-error');if(!e){e=document.createElement('p');e.className='av-error';e.setAttribute('role','alert');host.append(e);}e.textContent=text;}
  function tick(now:number){
    frame=0;if(disposed||!active||document.hidden||!initialized)return;
    if(active==='gym'&&!gymInitialized){if(!gymFailed)frame=requestAnimationFrame(tick);return;}
    const workStarted=performance.now();
    const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;time+=dt;frameCount++;
    motion.reducedMotion=reduced.matches;
    if(active==='gym'&&gym&&controller){
      const stick=pad.poll(),wheelOpen=!emoteMenu.hidden;
      if(stick.active)layout.classList.add('uses-gamepad');
      if(pad.pressed(PAD.start))menu.open=!menu.open;
      // Gamepad: the wheel takes the stick while open; otherwise X interacts, Y opens the wheel, d-pad quick-emotes.
      if(wheelOpen){aimEmoteAt(stick.moveX,stick.moveY);if(pad.pressed(PAD.a)||pad.pressed(PAD.x)||pad.pressed(PAD.y))confirmEmote();else if(pad.pressed(PAD.b))closeEmotes(true);}
      else if(stick.connected){
        if(pad.pressed(PAD.x))interact();
        if(pad.pressed(PAD.y)){if(aboard)secondaryAboard();else openEmotes();}
        for(const [button,value] of [[PAD.up,'wave'],[PAD.right,'cheer'],[PAD.down,'sit']] as const)if(pad.pressed(button))gymEmote(value);
      }
      if(!stickReleased&&Math.hypot(stick.moveX,stick.moveY)<.3)stickReleased=true;
      const moveX=wheelOpen||!stickReleased?0:stick.moveX,moveY=wheelOpen||!stickReleased?0:stick.moveY;
      const clampAxis=(v:number)=>Math.max(-1,Math.min(1,v));
      const horizontal=wheelOpen?0:clampAxis(Number(keys.has('KeyD')||keys.has('ArrowRight')||touchDirections.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touchDirections.has('left'))+moveX);
      const vertical=wheelOpen?0:clampAxis(Number(keys.has('KeyW')||keys.has('ArrowUp')||touchDirections.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||touchDirections.has('back'))-moveY);
      if(ridingSurrey&&surrey){surrey.update(dt,vertical,horizontal);surrey.seat(avatar.root.position);avatar.root.position.y-=avatar.dimensions.seatedContactHeight;avatar.root.rotation.y=surrey.root.rotation.y;lastSpeed=surrey.speed;motion.speed=0;motion.swimming=motion.airborne=false;gym.update(reduced.matches?0:time);
      }else if(aboard){
        gym.diveBoat.vessel.update(dt,{throttle:vertical,steer:horizontal,fast:runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight')||pad.held(PAD.b)});
        gym.update(reduced.matches?0:time);gym.diveBoat.deckPoint(gym.diveBoat.stand,avatar.root.position);avatar.root.rotation.y=gym.diveBoat.yaw+Math.PI/2;
        lastSpeed=motion.speed=0;motion.swimming=motion.airborne=false;motion.landing=0;
      }else if(boating){
        gym.vessel.update(dt,{throttle:vertical,steer:horizontal,fast:runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight')||pad.held(PAD.b)});
        gym.update(reduced.matches?0:time);
        gym.vessel.seatPose(avatar.root.position);avatar.root.position.y+=.27-avatar.dimensions.seatedContactHeight;avatar.root.rotation.y=gym.vessel.heading;
        lastSpeed=gym.vessel.speed;motion.speed=0;motion.swimming=motion.airborne=false;motion.landing=0;
      }else{
        camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.set(-forward.z,0,forward.x);
        input.x=right.x*horizontal+forward.x*vertical;input.z=right.z*horizontal+forward.z*vertical;input.run=runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight')||pad.held(PAD.b);
        input.jump=!wheelOpen&&(keys.has('Space')||jumpTouch||jumpLatch||pad.held(PAD.a));
        // B runs on land and dives in water; swimmers never run, so one button serves both.
        input.dive=keys.has('KeyC')||diveTouch||pad.held(PAD.b);
        // Getting up from a bench takes a fresh controller; the held jump then counts as a new press.
        if((horizontal||vertical||input.jump)&&seatReturn)chooseEmote('none');
        if(otterSuit&&flight&&(flight.active||input.jump||motion.swimming)){
          if(!flight.active){flight.launch();swimControls(false);followDelta.copy(camera.position).sub(orbit.target);followDelta.y=Math.max(followDelta.y,7);camera.position.copy(orbit.target).add(followDelta);}
          // B descends in flight; keyboard Shift / touch Boost controls forward speed.
          input.run=runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight');
          const result=flight.update(dt,input);jumpLatch=false;lastSpeed=result.speed;motion.speed=result.speed;
          motion.flying=result.flying;motion.submerged=result.submerged;motion.boosting=input.run;motion.swimming=motion.airborne=airborne=false;motion.landing=0;motion.verticalVelocity=result.verticalVelocity;
          footShadow.visible=false;$('gym-breath').hidden=true;supportY=avatar.root.position.y;
          if(result.landed){const state=controller.getState();makeController(avatar.root.position.clone(),false,{...state,grounded:true,verticalVelocity:0,diveDepth:0});notify('Landed. Hold Space to fly again, or return the suit to its station.',4);}
        }else{
        motion.flying=false;motion.boosting=false;motion.submerged=false;
        const result=controller.update(dt,input);jumpLatch=false;lastSpeed=result.speed;motion.speed=result.speed;motion.swimming=result.swimming;
        airborne=result.airborne;motion.airborne=result.airborne;motion.verticalVelocity=result.verticalVelocity;motion.landing=result.landed?result.landingSpeed:0;
        if(result.airborne)supportY=Math.min(supportY,result.supportY);else supportY=avatar.root.position.y;
        if(result.swimming){if(heldRod)returnRod();if(emote!=='none')chooseEmote('none');}
        if((horizontal||vertical||result.jumped)&&emote!=='none')chooseEmote('none');
        swimControls(result.swimming);showBreath(result);
        if(result.rescued){clearInput();notify('Out of breath — safely back on shore, with your breath restored.',6);}
        else if(result.lowBreath&&!wasLowBreath)notify('Low breath! Swim up to the surface.',5);
        wasLowBreath=result.lowBreath;
        footShadow.visible=!result.swimming&&!result.wading;
        const groundY=museumFloor==='upper'?MUSEUM_SITE.floor+MUSEUM_SITE.upper:gym.groundHeight(avatar.root.position.x,avatar.root.position.z);
        // The contact shadow stays on the ground and tightens with height: the clearest cue for judging a hop.
        const lift=Math.max(0,avatar.root.position.y-groundY),shadowScale=avatar.dimensions.controllerRadius/.28/(1+lift*1.6);
        footShadow.scale.setScalar(shadowScale);footShadow.position.set(avatar.root.position.x,groundY+.046,avatar.root.position.z);
        if(hintDistance<12){hintDistance+=result.speed*dt+(result.jumped?4:0);if(hintDistance>=12)$('gym-hint').classList.add('is-done');}
        }
        gym.update(reduced.matches?0:time);
      }
      if(!overview){
        const room=gym.museum.roomAt(avatar.root.position.x,avatar.root.position.z);
        gym.museum.setView(museumFloor==='upper'?'upper':room||avatar.root.position.distanceTo(gym.museum.entrance)<20?'ground':'exterior');
        const p=avatar.root.position;
        const next:GymDestination=room||p.distanceTo(gym.museum.entrance)<35?'museum':gym.caledonia.containsDistrict(p.x,p.z)?'caledonia-park':'lovers-point';
        if(next!==destination)setDestination(next);
        const title=gymHost.querySelector('.gym-place h1')!,place=museumFloor==='upper'?'Museum · mezzanine':DESTINATION_NAMES[destination];if(title.textContent!==place)title.textContent=place;
        // Follow the ground under a hop, not the hop itself, and ease toward the player instead of
        // locking rigidly. Reduced motion keeps the immediate follow without easing.
        followTarget.copy(avatar.root.position);if(airborne)followTarget.y=supportY;followTarget.y+=.9*avatar.dimensions.heightScale;
        followDelta.copy(followTarget).sub(orbit.target);
        if(!reduced.matches){const ease=1-Math.exp(-11*dt),lift=1-Math.exp(-6*dt);followDelta.x*=ease;followDelta.z*=ease;followDelta.y*=lift;}
        camera.position.add(followDelta);orbit.target.add(followDelta);
        followDelta.copy(camera.position).sub(orbit.target);lookOffset.setFromVector3(followDelta);
        // Right stick orbits like a mouse drag (push up to look up).
        if(stick.lookX||stick.lookY){lookOffset.theta-=stick.lookX*2.6*dt;lookOffset.phi=Math.max(orbit.minPolarAngle,Math.min(orbit.maxPolarAngle,lookOffset.phi-stick.lookY*1.8*dt));}
        // A deep diver pulls the camera under the surface with them; surfacing eases it back above.
        const waterY=gym.water.root.position.y;
        if(!boating&&orbit.target.y<waterY-.6){
          orbit.maxPolarAngle=Math.PI*.8;
          const below=waterY-.35-orbit.target.y,y=Math.cos(lookOffset.phi)*lookOffset.radius;
          if(y>below){const wanted=Math.acos(Math.max(-.95,Math.min(.95,below/lookOffset.radius)));lookOffset.phi+=(wanted-lookOffset.phi)*(reduced.matches?1:1-Math.exp(-6*dt));}
        }else orbit.maxPolarAngle=Math.max(Math.PI*.46,Math.min(orbit.maxPolarAngle,lookOffset.phi)-(reduced.matches?1:1.2*dt));
        lookOffset.makeSafe();camera.position.setFromSpherical(lookOffset).add(orbit.target);
      }
      // Reef interest management: it renders and simulates only near the player. Reduced motion
      // freezes the decorative fish loops; attached animals keep their imperceptible crawl.
      gym.reef.setViewer(avatar.root.position.x,avatar.root.position.z);gym.reef.update(dt,!reduced.matches);gym.whalePod.setViewer(overview?orbit.target.x:avatar.root.position.x,overview?orbit.target.z:avatar.root.position.z,overview);gym.whalePod.update(dt,!reduced.matches);gym.coastalLife.setViewer(overview?orbit.target.x:avatar.root.position.x,overview?orbit.target.z:avatar.root.position.z,overview);gym.coastalLife.update(dt,!reduced.matches);
      // Small sky cells retain independent LOD; asleep groups do no animation work.
      if(!bayOverview){gym.gulls.setPlayer(avatar.root.position.x,avatar.root.position.y,avatar.root.position.z,!overview&&!motion.flying&&!boating&&!aboard);gym.gulls.setViewer(overview?orbit.target.x:avatar.root.position.x,overview?orbit.target.z:avatar.root.position.z,overview);gym.gulls.update(dt,!reduced.matches);}
      if(deer){deer.setPlayer(avatar.root.position.x,avatar.root.position.y,avatar.root.position.z,!overview&&!boating&&!aboard);
        deer.setViewer(overview?orbit.target.x:avatar.root.position.x,overview?orbit.target.z:avatar.root.position.z,!bayOverview);deer.update(dt,!reduced.matches);}
      if(!reduced.matches)weather.environment.caustics.time.value=time;
      if(bayExtension&&!bayOverview)gymRegional.visible=!!deerViewId||!overview&&motion.flying&&(avatar.root.position.x<-200||avatar.root.position.x>1200||avatar.root.position.z<-700||avatar.root.position.z>650);
      setUnderwater(!overview&&camera.position.y<gym.water.root.position.y);
      gymSky.root.position.copy(camera.position);nearestInteraction();placeBreath();
    }else{motion.airborne=false;motion.landing=0;motion.swimming=pose==='swim'||pose==='tread';motion.speed=pose==='walk'?1.7:pose==='run'?3.5:pose==='swim'?AVATAR_SWIMMING.speed:0;lastSpeed=motion.speed;}
    if(emote!=='none'&&emote!=='sit'){emoteTime+=dt;if(emoteTime>3)chooseEmote('none');}
    motion.pedalPhase=ridingSurrey?surrey?.crank.rotation.x:undefined;motion.emote=emote;avatar.update(dt,motion);orbit.update();bayLabels?.update(active==='gym'&&bayOverview);caledoniaLabels?.update(active==='gym'&&overview&&!bayOverview&&caledoniaOverview);
    otterDive.update(dt,avatar,active==='gym'&&otterSuit,motion.submerged,motion.boosting,reduced.matches,gym?.water.root.position.y??1);
    if(active==='gym'){weather.update({time,dt,underwater:enhancedWater?false:underwater,overview:overview||motion.flying,reducedMotion:reduced.matches,water:gym?.water});if(bayOverview){const fog=gymScene.fog as Fog;fog.near=95000;fog.far=180000;}if(weather.sun.intensity>.1)footShadow.visible=false;}
    lod.update(camera,renderer.domElement.clientHeight,dt);
    renderer.info.reset();
    if(active==='gym'&&enhancedWater&&!bayOverview)enhancedWater.render(gymScene,camera);
    else renderer.render(active==='gym'?gymScene:studio,camera);
    budgetTime+=dt;if(budgetTime>.6){budgetTime=0;budget();}
    if(active==='gym'){
      if(gymFirstFramePending){gymFirstFramePending=false;setGymLoading(gymHost,'','ready');notify('Welcome to Lovers Point. Fishing gear is beside the rowboat.',5);diagnostics.reset();}
      diagnostics.record(now,performance.now()-workStarted,renderer.info,studioHost.dataset.backend??'Preparing',renderer.domElement,renderer.getPixelRatio(),lod.mode);
    }
    frame=requestAnimationFrame(tick);
  }
  function resume(){if(initialized&&active&&!document.hidden&&!frame&&!disposed){previous=performance.now();diagnostics.reset();frame=requestAnimationFrame(tick);}}
  function setActive(view:ActiveView){
    if(disposed)return;flushSizeChange();const changed=active!==view;if(changed&&active==='gym'){if(ridingSurrey)leaveSurrey(true);if(boating)leaveBoat(true);if(aboard)leaveDiveBoat('pier');swapGear(false);if(seatReturn)chooseEmote('none');controllerPosition.copy(avatar.root.position);gymControllerState=controller?.getState();returnRod();}
    active=view;weather.setActive(view==='gym');clearInput();cancelAnimationFrame(frame);frame=0;
    if(!view){delete document.body.dataset.avatarView;return;}
    document.body.dataset.avatarView=view;
    (view==='avatars'?$('avatar-viewport'):$('gym-viewport')).append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label',view==='avatars'?'Character preview. Drag to turn and scroll to zoom.':'Testing Gym. WASD or arrows to walk, swim and row. Space to jump. Shift to run or row faster. E to interact. 1, 2 and 3 to wave, cheer and sit. Diving uses breath; surface to reset it to 20 seconds. Drag to look.');
    resize();
    if(changed){chooseEmote('none');if(view==='avatars'){studio.add(avatar.root);frameStudio();}else if(gymInitialized&&gym){gymScene.add(avatar.root);avatar.root.position.copy(controllerPosition.lengthSq()?controllerPosition:gym.spawn);makeController(undefined,false,gymControllerState);frameGym();}else{gymScene.add(avatar.root);void ensureGym();}}
    resume();
  }
  document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();},{signal});
  reduced.addEventListener('change',()=>{orbit.enableDamping=!reduced.matches;},{signal});
  updateSizePresentation();updateSelections();updateLibrary();if(storageError)message(storageError);
  const ready=Promise.all([renderer.init(),lod.register(studio),lod.register(otterDive.mesh)]).then(()=>{if(disposed)return;initialized=true;studioHost.dataset.backend=gymHost.dataset.backend=(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL 2';resize();budget();resume();}).catch(error=>{gymFailed=true;setGymLoading(gymHost,'Graphics could not start. Please reload to try again.','error');showError(studioHost,`The 3D preview could not start: ${error instanceof Error?error.message:'please reload'}`);});
  function getSnapshot(){return {waterGraphics:enhancedWater?.getSnapshot()??{mode:'balanced'},active,destination,overview,caledoniaOverview,deerViewId,deer:deer?.stats()??null,weather:weather.getSnapshot(),backend:studioHost.dataset.backend,frameCount,dirty,currentId,savedCount:collection.avatars.length,design:{...design},dimensions:{...avatar.dimensions},emote,pose,carrying:!!heldRod,swimming:motion.swimming,airborne,aboard,scuba,controller:(active==='gym'?controller?.getState():gymControllerState)??null,reef:gym?{active:gym.reef.active,...gym.reef.stats()}:null,diveBoatPosition:gym?gym.diveBoat.root.position.toArray():null,surrey:surrey?{riding:ridingSurrey,position:surrey.root.position.toArray(),heading:surrey.root.rotation.y,speed:surrey.speed,pedalPhase:surrey.crank.rotation.x}:null,boating,boat: gym ? {position:gym.boat.position.toArray(),heading:gym.vessel.heading,speed:gym.vessel.speed,nearDock:gym.vessel.nearDock()} : null,animation:avatar.getState(),speed:lastSpeed,position:avatar.root.position.toArray(),heading:avatar.root.rotation.y,otterSuit,flight:flight?.getState()??null,otterDive:otterDive.getState(),museum:gym?{floor:museumFloor,view:gym.museum.view,room:gym.museum.roomAt(avatar.root.position.x,avatar.root.position.z)}:null,coastalLife:gym?gym.coastalLife.stats():null,gulls:gym?gym.gulls.stats():null,whalePod:gym?gym.whalePod.stats():null,waterfront:gym?{name:gym.waterfront.root.name,bounds:gym.waterfront.bounds}:null,bay:bayExtension?{bounds:bayExtension.bounds,overview:bayOverview,focus:bayFocusId,regionalWaterVisible:gymRegional.visible&&bayExtension.ocean.visible}:null,interacted:[...interacted],nearest:nearest?.id,model:modelStats(avatar.mesh).model,lod:lod.stats(avatar.mesh),renderer:{drawCalls:renderer.info.render.drawCalls,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries},performance:diagnostics.getSnapshot(),gymReady:gymInitialized&&!gymFirstFramePending};}
  function dispose(){if(disposed)return;cancelSizeChange();disposed=true;cancelAnimationFrame(frame);abort.abort();waterPanel.dispose();enhancedWater?.dispose();diagnostics.dispose();gymHost.querySelector('.gym-loading')?.remove();resizeObserver.disconnect();orbit.dispose();lod.dispose();otterDive.dispose();returnRod();avatar.dispose();bayLabels?.dispose();caledoniaLabels?.dispose();deer?.dispose();bayExtension?.dispose();surrey?.dispose();gym?.dispose();weather.dispose();for(const mesh of [plinth,contact,footShadow]){mesh.geometry.dispose();if(!Array.isArray(mesh.material))mesh.material.dispose();}renderer.dispose();delete document.body.dataset.avatarView;}
  return {ready,renderer,camera,lod,weather,setActive,dispose,getSnapshot,get scene(){return active==='gym'?gymScene:studio;},get avatar(){return avatar;},get controller(){return controller;},get gym(){return gym;},get surrey(){return surrey;},get enhancedWater(){return enhancedWater;},get deer(){return deer;}};
}
