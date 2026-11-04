import { Material, Mesh, MeshToonMaterial, Object3D, Vector3, Color, type Texture } from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial, NodeMaterial } from 'three/webgpu';
import { attribute, cameraPosition, cos, dot, float, mix, normalView, normalWorld, positionViewDirection, positionWorld, materialColor, sin, smoothstep, texture, uniform, vec2 } from 'three/tsl';
import { STYLE } from '../models/shared/style';
import { paintedFishLight } from '../models/shared/fish/paintedLight';
import { stabilizeToonLighting } from './toonLighting';
import { createCausticTexture } from './openSea/caustics';

/**
 * WebGPU-path style layers (TSL). Model factories still emit plain MeshToonMaterial; the viewer
 * upgrades them here, so geometry and model code never fork. TSL compiles to WGSL on native
 * WebGPU and GLSL on WebGPURenderer's WebGL 2 backend.
 */
/** A viewer owns its lighting uniforms; weather must never rewrite the shared art tokens. */
export function createNodeStyleEnvironment() {
  return {
    /** 1 − N·V where the rim starts (higher = thinner rim) and its inner softness. */
    width: uniform(.66), softness: uniform(.05),
    strength: uniform(.38), shadowed: uniform(.3),
    /** Painted fish bypass scene lights; their base paint needs the same local day/night exposure. */
    paintExposure: uniform(1),
    color: uniform(STYLE.sun.color.clone()),
    sun: uniform(STYLE.sun.direction.clone()),
    /** Underwater light shared by everything styled in this environment: seabed, rocks, kelp,
     * anemones, fish and avatars read the same pattern. Opt in (set `enabled` before styling);
     * other viewers compile exactly as before. `level` is the water surface Y in world metres. */
    waterLighting: undefined as undefined|{caustics:(p:any,n:any)=>any;attenuation:(p:any)=>any},
    caustics: { enabled: false, level: uniform(-1e4), time: uniform(0), strength: uniform(.34), illumination: uniform(0), map: undefined as Texture | undefined },
    headlamp: { enabled: false, position: uniform(new Vector3()), direction: uniform(new Vector3(0,0,1)), strength: uniform(0), color: uniform(new Color('#fff1c4')) },
    reset() {
      this.width.value=.66;this.softness.value=.05;this.strength.value=.38;this.shadowed.value=.3;this.paintExposure.value=1;
      this.color.value.copy(STYLE.sun.color);this.sun.value.copy(STYLE.sun.direction);this.caustics.illumination.value=0;this.headlamp.strength.value=0;
    },
    /** The viewer owns the generated field; materials only borrow it. */
    dispose() { this.caustics.map?.dispose(); this.caustics.map=undefined; },
  };
}
export type NodeStyleEnvironment = ReturnType<typeof createNodeStyleEnvironment>;
/** Legacy viewers share this default; workbenches with weather create their own environment. */
export const RIM = createNodeStyleEnvironment();
/** Rim strength chosen in the style tokens; quality tiers scale it to zero rather than recompiling. */
export const RIM_STRENGTH = .38;

/** Rim = hard-edged Fresnel band × sun-facing mask × sideways mask. About ten ALU ops per pixel. */
export function rimNode(environment: NodeStyleEnvironment = RIM) {
  const facing = dot(normalView, positionViewDirection).saturate();
  const edge = smoothstep(environment.width, environment.width.add(environment.softness), facing.oneMinus());
  const sunSide = smoothstep(float(-.15), float(.35), dot(normalWorld, environment.sun));
  // Upward faces (decks, tops) would light up as broad bands at grazing views; keep rim on silhouettes.
  const sideways = smoothstep(float(.85), float(.55), normalWorld.y);
  return environment.color.mul(edge.mul(sideways).mul(mix(environment.shadowed, float(1), sunSide)).mul(environment.strength));
}

/** World-space caustics, using the Open Sea exhibit's procedural cell field and two-sample warp so
 * both read as one style. Masked to below the surface, fading with depth, strongest on up-facing
 * surfaces. Weather supplies direct-sun illumination separately from the key colour;
 * moonlight never creates a focused web. Translucent tissue receives only a trace.
 * Two texture samples per pixel; the shared 256 KiB field is generated once per environment. */
export function causticNode(environment: NodeStyleEnvironment = RIM) {
  if(environment.waterLighting)return environment.waterLighting.caustics(positionWorld,normalWorld);
  const c = environment.caustics; c.map ??= createCausticTexture();
  const p = positionWorld, depth = c.level.sub(p.y), t = c.time.mul(.16);
  // Light refracted at the surface lands offset with depth, so the pattern drifts across layers.
  const q = vec2(p.x.add(depth.mul(.19)), p.z.add(depth.mul(.36))).mul(.17);
  const warp = vec2(sin(q.y.mul(7).add(t)), cos(q.x.mul(6).sub(t.mul(.8)))).mul(.035);
  const a = texture(c.map, q.add(warp).add(vec2(t.mul(.018), t.mul(-.024)))).r;
  const b = texture(c.map, q.mul(1.16).sub(warp).add(vec2(.31, .59)).add(vec2(t.mul(-.021), t.mul(.015)))).r;
  const focus = sin(q.x.mul(4.3).add(q.y.mul(3.1)).add(t.mul(.25))).mul(.18).add(.82);
  // One web only: the second sample modulates brightness along it instead of adding a second,
  // offset network of lines (which read as a doubled layer on large flat seabed).
  const light = a.mul(b.mul(.45).add(.55)).mul(focus);
  const under = smoothstep(float(.05), float(.5), depth), fade = depth.max(0).mul(-.14).exp();
  // Light falls from above: floors and tops carry the pattern; sides of fish, kelp and rock get a trace.
  const facing = smoothstep(float(-.1), float(.8), normalWorld.y).mul(.9).add(.1);
  return environment.color.mul(light.mul(under).mul(fade).mul(facing).mul(c.strength).mul(c.illumination));
}
/** The lighting add-on for one material: rim and/or caustics, or undefined for neither. */
type RimMask = Parameters<ReturnType<typeof rimNode>['mul']>[0];
function styleLight(environment: NodeStyleEnvironment, rim: boolean, rimMask?: RimMask, translucent = false) {
  const caustics = environment.caustics.enabled ? causticNode(environment).mul(translucent ? .2 : 1) : undefined;
  const edge = rim ? (rimMask === undefined ? rimNode(environment) : rimNode(environment).mul(rimMask)) : undefined;
  let light=edge&&caustics?edge.add(caustics):edge??caustics;
  if(environment.headlamp.enabled){
    const h=environment.headlamp,offset=positionWorld.sub(h.position),distance=offset.length().max(.01),ray=offset.div(distance);
    const cone=smoothstep(float(.82),float(.96),dot(ray,h.direction));
    const fade=distance.div(16).oneMinus().clamp(0,1).pow(2);
    const facing=dot(normalWorld,ray.negate()).max(0).mul(.85).add(.15);
    const lamp=h.color.mul(cone.mul(fade).mul(facing).mul(h.strength)).mul(translucent?.2:1);
    light=light?light.add(lamp):lamp;
  }
  return light;
}

type StyledMaterial = MeshToonNodeMaterial | MeshBasicNodeMaterial;
const upgraded = new WeakMap<NodeStyleEnvironment, {rim: WeakMap<Material, StyledMaterial>; plain: WeakMap<Material, StyledMaterial>}>();
const sourceUsers = new WeakMap<Material, number>();
function environmentCache(environment: NodeStyleEnvironment) {
  let cache=upgraded.get(environment);
  if(!cache){cache={rim:new WeakMap(),plain:new WeakMap()};upgraded.set(environment,cache);}
  return cache;
}
/** Node equivalent of a shared toon material; cached so shared materials stay shared. */
export function toNodeToon(source: MeshToonMaterial, rim = true, environment: NodeStyleEnvironment = RIM) {
  const caches=environmentCache(environment),cache = rim ? caches.rim : caches.plain, cached = cache.get(source);
  if (cached) return cached;
  const MaterialType=source.userData.paintedFish?MeshBasicNodeMaterial:MeshToonNodeMaterial;
  const material = new MaterialType({
    name: source.name + ':node', color: source.color, vertexColors: source.vertexColors,
    side: source.side, transparent: source.transparent, opacity: source.opacity,
  });
  if (material instanceof MeshToonNodeMaterial) material.gradientMap = source.gradientMap;
  material.opacity = source.opacity; material.transparent = source.transparent;
  material.depthWrite = source.depthWrite; material.forceSinglePass = source.forceSinglePass;
  material.polygonOffset = source.polygonOffset; material.polygonOffsetFactor = source.polygonOffsetFactor; material.polygonOffsetUnits = source.polygonOffsetUnits;
  const withRim = rim && source.userData.rim !== false;
  if(source.userData.paintedFish){
    // The shader reads vertex paint itself; NodeMaterial must not multiply it a second time.
    material.vertexColors=false;
    const mask=attribute('fishMatte','float');
    let paint=paintedFishLight(attribute('color','vec3'),normalWorld,mask).mul(environment.paintExposure);
    if(environment.waterLighting)paint=paint.mul(environment.waterLighting.attenuation(positionWorld));
    const light=styleLight(environment,withRim,mask.oneMinus());
    material.colorNode=light?paint.add(light):paint;
  }else{
    // NodeMaterial adds emissiveNode after lighting: rim and caustics both ride on top of the toon response.
    let light=styleLight(environment,withRim,undefined,source.transparent);
    if(source.userData.otterArmor){
      const channel=attribute('otterSurface','float'),metal=smoothstep(.5,.75,channel).mul(smoothstep(1.5,1.25,channel));
      const view=cameraPosition.sub(positionWorld).normalize(),half=view.add(environment.sun).normalize();
      const glint=smoothstep(.91,.985,dot(normalWorld,half)).mul(dot(normalWorld,environment.sun).max(0));
      const edge=dot(normalWorld,view).abs().oneMinus().pow(3).mul(.32);
      const reflection=environment.color.mul(glint.mul(.95).add(edge)).mul(metal).mul(environment.paintExposure.min(1));
      const exhaust=attribute('color','vec3').mul(smoothstep(1.5,1.75,channel)).mul(1.4);
      const finish=reflection.add(exhaust);light=light?light.add(finish):finish;
    }
    if(light)Object.assign(material,{emissiveNode:light});
    if(environment.waterLighting)material.colorNode=materialColor.rgb.mul(environment.waterLighting.attenuation(positionWorld));
  }
  // Factories that vary their shader per state (the sardine school's one/many morph source) keep
  // that key; they flag `needsUpdate` on the mesh's current material, which is this one.
  if (Object.prototype.hasOwnProperty.call(source, 'customProgramCacheKey')) material.customProgramCacheKey = () => source.customProgramCacheKey();
  material.userData = { ...source.userData, rim: withRim, nodeSource: source, styleEnvironment: environment };
  if (material instanceof MeshToonNodeMaterial) stabilizeToonLighting(material);
  // The source is never compiled once replaced; release it with its node twin.
  sourceUsers.set(source,(sourceUsers.get(source)??0)+1);
  let disposed=false;
  material.addEventListener('dispose', () => {
    if(disposed)return;disposed=true;cache.delete(source);
    const remaining=(sourceUsers.get(source)??1)-1;
    if(remaining>0)sourceUsers.set(source,remaining);else{sourceUsers.delete(source);source.dispose();}
  });
  cache.set(source, material);
  return material;
}

/** Custom painted fish publish a toon tag and styleBase; unlit sky/water nodes keep their own exposure. */
function styleCustom(material: NodeMaterial, rim: boolean, environment: NodeStyleEnvironment) {
  const data = material.userData;
  if(!data.styleBase)return;
  const painted=data.toon==='tuna-cel',withRim=rim&&data.rim!==false,caustics=environment.caustics.enabled;
  if(!painted&&!withRim&&!caustics)return;
  if(data.styleEnvironment===environment&&data.rimApplied===withRim&&data.causticsApplied===caustics)return;
  let base=painted?data.styleBase.mul(environment.paintExposure):data.styleBase;
  if(environment.waterLighting&&painted)base=base.mul(environment.waterLighting.attenuation(positionWorld));
  const light=styleLight(environment,withRim,data.rimMask??1,material.transparent);
  material.colorNode=light?base.add(light):base;
  data.rimApplied=withRim;data.causticsApplied=caustics;data.styleEnvironment=environment;material.needsUpdate=true;
}

/** Swap every toon material under `root` for its node version. Returns the materials it created. */
export function applyNodeStyle(root: Object3D, rim = true, environment: NodeStyleEnvironment = RIM) {
  const created = new Set<MeshToonNodeMaterial|MeshBasicNodeMaterial>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (object.material instanceof NodeMaterial) { if (object.material instanceof MeshToonNodeMaterial) stabilizeToonLighting(object.material); styleCustom(object.material,rim,environment); return; }
    if (!(object.material instanceof MeshToonMaterial)) return;
    const material = toNodeToon(object.material, rim, environment); object.material = material; created.add(material);
  });
  return created;
}

/** Rebind already-created avatar materials after optional Gym optics loads. Existing
 * shared source ownership is preserved; new environment cache entries are independent. */
export function refreshNodeStyle(root:Object3D,rim:boolean,environment:NodeStyleEnvironment){
  upgraded.delete(environment);
  const replacements=new Map<NodeMaterial,NodeMaterial>();
  root.traverse(object=>{
    if(!(object instanceof Mesh)||Array.isArray(object.material)||!(object.material instanceof NodeMaterial))return;
    const old=object.material,source=old.userData.nodeSource as MeshToonMaterial|undefined;
    if(source){let next=replacements.get(old);if(!next){next=toNodeToon(source,rim,environment);replacements.set(old,next);}object.material=next;}
    else if(old.userData.styleBase){old.userData.styleEnvironment=undefined;styleCustom(old,rim,environment);}
  });
  for(const old of replacements.keys())old.dispose();
}
