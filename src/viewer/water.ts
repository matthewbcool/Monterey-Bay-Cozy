import { BufferGeometry, Color, DoubleSide, Mesh, PlaneGeometry, Vector2, Vector3 } from 'three';
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import { abs, attribute, cameraFar, cameraNear, cameraPosition, clamp, cos, distance, dot, exp, float, fwidth, max, mix, modelWorldMatrix, normalize, perspectiveDepthToViewZ, positionLocal, positionView, pow, reflect, refract as refractRay, screenUV, select, sin, smoothstep, uniform, varying, vec2, vec3, vec4, viewportDepthTexture, viewportSharedTexture } from 'three/tsl';
import { seabedDepthNode } from './bathymetry';
import { STYLE } from '../models/shared/style';
import { oceanSurface, waterNoise as noise } from './oceanOptics';
import { createWaterDepth, waterDepthNode, type WaterDepthSource } from './waterDepth';

// TSL node graphs; @types/three cannot type uniform/expression mixes precisely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;
// One wave definition drives both the GPU surface and CPU buoyancy samples.
const waves = [
  { x: .86, z: .50, k: 1.65, speed: .82, amplitude: .041 },
  { x: .68, z: .73, k: 2.65, speed: 1.12, amplitude: .025 },
  { x: -.52, z: .85, k: 4.15, speed: 1.38, amplitude: .013 },
  { x: .91, z: .42, k: 6.6, speed: 1.63, amplitude: .007 },
];
/** TSL twin of sampleWater(): height and surface slope (x: height, yz: d/dx, d/dz). */
export function waveNode(p: N, t: N, chop: N) {
  let height: N = float(0), dx: N = float(0), dz: N = float(0);
  for (const w of waves) {
    const phase = dot(p, vec2(w.x, w.z)).mul(w.k).sub(t.mul(w.speed));
    const c = cos(phase).mul(w.k * w.amplitude);
    height = height.add(sin(phase).mul(w.amplitude)); dx = dx.add(c.mul(w.x)); dz = dz.add(c.mul(w.z));
  }
  return vec3(height, dx, dz).mul(chop);
}

export function sampleWater(x:number,z:number,time:number,chop=.75){
  let height=0,dx=0,dz=0;
  for(const w of waves){
    const phase=(x*w.x+z*w.z)*w.k-time*w.speed;
    height+=Math.sin(phase)*w.amplitude*chop;
    dx+=Math.cos(phase)*w.x*w.k*w.amplitude*chop;
    dz+=Math.cos(phase)*w.z*w.k*w.amplitude*chop;
  }
  return {height,dx,dz};
}

export interface AdvancedWaterOptics {
  patchOrigin:N;
  nearWet:N;
  sky:(direction:N)=>N;
  colorAt:(uv:N)=>N;
  viewAt:(uv:N)=>N;
  integrate:(color:N,start:N,direction:N,length:N)=>N;
}
export interface WaterEnvironment {
  sunDirection: Vector3;
  skyZenith: Color;
  skyHorizon: Color;
  /** Artistic exposure for the unlit water, 0 = dark, 1 = the authored daylight look. */
  lightLevel: number;
  /** Direct sunlight is attenuated separately by cloud/fog; sky fill remains. */
  sunStrength?: number;
  sunColor?: Color;
  /** Optional complete fog range in camera-to-surface metres; omission disables atmospheric fog. */
  fogColor?: Color;
  fogNear?: number;
  fogFar?: number;
}

/**
 * Teal ripple water in TSL (WGSL on WebGPU, GLSL on the WebGL 2 backend). Refraction reads the
 * renderer's viewport colour/depth copy, taken once per frame just before the water draws, so it
 * needs no second scene pass. Base quality builds the same look without the copy.
 */
export function createWater({width,depth,tank=false,segments,profile='harbor',refract=true,geometry:providedGeometry,depthSource}:{depthSource?:WaterDepthSource;geometry?:BufferGeometry;width:number;depth:number;tank?:boolean;segments?:number;profile?:'harbor'|'open';refract?:boolean}){
  // Broad outdoor scenes retain the same shader detail without tessellating every metre.
  const geometry=providedGeometry??new PlaneGeometry(width,depth,segments??Math.ceil(width*1.5),segments??Math.ceil(depth*1.5));
  if(!providedGeometry)geometry.rotateX(-Math.PI/2);
  const depthField=profile==='open'&&depthSource?createWaterDepth(depthSource):undefined;
  const u={time:uniform(0),chop:uniform(.75),visibility:uniform(14),deep:uniform(new Color(profile==='open'?'#164e6c':'#063e56')),shallow:uniform(new Color(profile==='open'?'#18898f':'#08758b')),
    lightLevel:uniform(1),sunStrength:uniform(1),sunColor:uniform(STYLE.sun.color.clone()),fogEnabled:uniform(0),fogColor:uniform(STYLE.dome.horizon.clone()),fogNear:uniform(0),fogFar:uniform(1),wakePosition:uniform(new Vector2()),wakeDirection:uniform(new Vector2(0,1)),wakeStrength:uniform(0),
    skyZenith:uniform(STYLE.dome.zenith.clone()),skyHorizon:uniform(STYLE.dome.horizon.clone()),sun:uniform(STYLE.sun.direction.clone())};
  // Only refracting water needs the late transparent pass for its viewport copy. The open
  // ocean without refraction outputs alpha=1: render it as opaque so it cannot paint over
  // closer translucent jellyfish whose materials correctly leave depthWrite disabled.
  const material=new MeshBasicNodeMaterial({name:'Teal ripple water',side:DoubleSide,transparent:tank||profile==='harbor'||refract,depthWrite:!tank,fog:false});
  let optics:AdvancedWaterOptics|undefined;
  let vSurface:N,vWorld:N;
  function setupSurface(){
    const surface=optics?positionLocal.xz.add(optics.patchOrigin.mul(attribute('waterPatch'))):positionLocal.xz;
    const displaced=vec3(surface.x,positionLocal.y.add(waveNode(surface,u.time,u.chop).x),surface.y);
    material.positionNode=displaced;
    vSurface=varying(displaced.xz,'vSurface');vWorld=varying(modelWorldMatrix.mul(vec4(displaced,1)).xyz,'vWorld');
    if(optics){
      const local=abs(vSurface.sub(optics.patchOrigin)),inside=max(local.x,local.y).lessThan(7.95);
      material.maskNode=select(attribute('waterPatch').greaterThan(.5),inside,inside.not());
    }
  }
  setupSurface();

  function build(refraction:boolean):Node{
    const p=vSurface,t=u.time,chop=u.chop;
    let slope:N=waveNode(p,t,chop).yz;
    // Directional capillary ripples, spatially warped to break up a rigid crosshatch.
    const warp=noise(p.mul(1.35).add(vec2(t.mul(.045),t.mul(-.035)))).mul(4.5);
    slope=slope.add(vec2(.033,.048).mul(cos(dot(p,vec2(7.7,12.2)).add(warp).sub(t.mul(1.7)))).mul(chop));
    slope=slope.add(vec2(-.026,.019).mul(cos(dot(p,vec2(-14.2,8.7)).sub(warp.mul(.8)).sub(t.mul(2.1)))).mul(chop));
    slope=slope.add(vec2(.009,.006).mul(sin(dot(p,vec2(23.1,18.2)).add(warp).add(t.mul(2.4)))).mul(chop));
    const range=distance(cameraPosition,vWorld);
    let swell:N=float(0),crest:N=float(0),foam:N=float(0);
    if(profile==='open') {
      const optical=oceanSurface(p,t,chop);
      slope=optical.slope;swell=optical.swell;crest=optical.crest;
      const lace=optical.lace;
      const delta=p.sub(u.wakePosition),behind=dot(delta,u.wakeDirection).negate();
      const across=abs(dot(delta,vec2(u.wakeDirection.y,u.wakeDirection.x.negate())));
      const wakeLength=mix(float(3),float(12),u.wakeStrength),spread=behind.mul(.16).add(.35);
      const edge=exp(pow(across.sub(spread).mul(3.4),2).negate());
      const churn=exp(across.mul(-2.1)).mul(.5);
      const envelope=smoothstep(.8,2.3,behind).mul(float(1).sub(smoothstep(wakeLength.mul(.55),wakeLength,behind)));
      foam=edge.add(churn).mul(envelope).mul(u.wakeStrength).mul(smoothstep(.28,.70,lace)).mul(.65);
    }
    const n=normalize(vec3(slope.x.negate(),1,slope.y.negate()));
    const view=normalize(cameraPosition.sub(vWorld));
    const facing=clamp(abs(dot(n,view)),0,1);
    const fresnel=float(.025).add(pow(float(1).sub(facing),5).mul(.975));
    const reflected=reflect(view.negate(),n);
    // Broad sky tones become broken silver-blue patches under the ripple normals.
    const horizon=pow(float(1).sub(clamp(abs(reflected.y),0,1)),2);
    const clouds=noise(reflected.xz.div(max(.25,abs(reflected.y))).mul(.85).add(vec2(t.mul(.006),0)));
    // Same palette as the sky dome, held a little darker so the water keeps its body colour.
    let sky:N=mix(u.skyZenith,u.skyHorizon,horizon).mul(.62).add(vec3(.10,.10,.09).mul(smoothstep(.45,.62,clouds)));
    if(profile==='open') sky=mix(u.skyZenith,u.skyHorizon,horizon).mul(.68).add(vec3(.07,.075,.07).mul(smoothstep(.48,.7,clouds)));
    if(optics)sky=optics.sky(normalize(reflected.add(vec3(0,.000001,0))));
    // The gym samples its existing surveyed/authored floor once into a small optical field.
    // Unmapped open-water callers retain a representative depth; no camera-distance tint.
    const shelf=profile==='harbor'?seabedDepthNode(p):depthField?waterDepthNode(depthField,vWorld.xz):float(8);
    let body:N=mix(u.shallow,u.deep,smoothstep(.5,7.5,shelf));
    if(profile==='open') {
      // Per-channel absorption leaves warm turquoise on shelves and blue-green offshore.
      // This is optical depth, not screen-space refraction or a change to the seabed itself.
      const transmission=exp(vec3(.29,.115,.075).negate().mul(shelf).mul(float(14).div(max(1,u.visibility))));
      body=mix(u.deep,u.shallow,transmission).mul(swell.mul(.07).add(.96));
      const backlight=pow(max(dot(view,u.sun.negate()),0),3).mul(smoothstep(-.25,.75,swell)).mul(.055).mul(u.sunStrength);
      body=body.add(vec3(.12,.55,.4).mul(backlight));
    }
    let captured:N=body;
    if(refraction){
      const uv=screenUV,surfaceDistance=positionView.z.negate();
      const viewDepth=(at:N):N=>optics?optics.viewAt(at).z.negate():(perspectiveDepthToViewZ(viewportDepthTexture(at).x,cameraNear,cameraFar) as N).negate();
      const shifted=clamp(uv.add(slope.mul(.017).mul(clamp(shelf.mul(.3),0,1))),vec2(.001),vec2(.999));
      // Reject displaced samples from geometry above the surface (boats/shore).
      const refracted=select(viewDepth(shifted).lessThan(surfaceDistance),uv,shifted);
      const path=clamp(viewDepth(refracted).sub(surfaceDistance),0,shelf.div(max(.2,facing)));
      const transmission=exp(vec3(.48,.22,.17).negate().mul(path).mul(float(14).div(u.visibility)));
      captured=optics?optics.colorAt(refracted):viewportSharedTexture(refracted).rgb;
      body=mix(body,mix(body,captured,transmission),tank?0:1);
      if(optics){
        const ray=refractRay(view.negate(),n,1/1.333);
        const rayLength=clamp(optics.viewAt(refracted).sub(positionView).length(),0,80);
        body=optics.integrate(captured,vWorld,normalize(ray),rayLength);
      }
    }
    const reflection=clamp(fresnel.add(float(profile==='open'?.06:.045).add(horizon.mul(.08)).mul(float(1).sub(facing))),0,profile==='open'?.94:.93);
    let color:N=mix(body,sky,reflection);
    const half=normalize(u.sun.add(view));
    const sunVisible=profile==='open'?smoothstep(-.04,.08,u.sun.y):float(1);
    if(profile==='open') {
      // Bounded GGX-shaped glints. Normal derivatives broaden sub-pixel highlights;
      // the continuous lobe avoids the old hard white flecks and distance sparkle.
      const variance=dot(fwidth(n),fwidth(n));
      const rough2=float(.026).add(clamp(variance.mul(2),0,.12));
      const alpha2=rough2.mul(rough2),noH=max(dot(n,half),0);
      const denominator=pow(noH.mul(noH).mul(alpha2.sub(1)).add(1),2).mul(Math.PI);
      const lobe=alpha2.div(max(.00001,denominator)).mul(.018);
      const glint=lobe.div(lobe.add(1)).mul(.85).mul(sunVisible).mul(u.sunStrength);
      color=color.add(u.sunColor.mul(glint));
    } else {
      const sparkle=pow(max(dot(n,half),0),120);
      color=color.add(vec3(1,.97,.88).mul(smoothstep(.32,.4,sparkle)).mul(.55));
    }
    if(profile==='open') {
      const paleCrest=vec3(.62,.82,.79);
      color=mix(color,paleCrest,clamp(crest.add(foam),0,.8));
      // A gentle aerial blend joins distant blue water to the shared sky palette.
      color=mix(color,mix(u.deep,u.skyHorizon,.35),smoothstep(450,2800,range).mul(.4));
    }
    // Snell-like light window and the darker reflected underside at grazing angles.
    const window=smoothstep(.61,.72,facing);
    const bands=float(.5).add(sin(dot(p,vec2(3.8,5.2)).add(warp).sub(t.mul(.8))).mul(.5));
    const haze=float(1).sub(exp(pow(distance(cameraPosition,vWorld).mul(1.35).div(u.visibility),2).negate()));
    const underside0=mix(u.deep.mul(.95),vec3(.19,.40,.44),window).add(vec3(.014,.025,.028).mul(bands));
    let underside:N=mix(mix(underside0,vec3(.0052,.0802,.1068),haze),captured,window.mul(refraction?.33:0));
    if(profile==='open') {
      // Critical cosine for air/water n=1.333. Outside this window the underside
      // reflects the water body; inside it, the compressed sky remains visible.
      const critical=Math.sqrt(1-1/(1.333*1.333));
      const snell=smoothstep(critical-.025,critical+.035,facing);
      const skyY=pow(max(0,float(1).sub(float(1).sub(facing.mul(facing)).mul(1.333*1.333))),.5);
      const windowSky=mix(u.skyHorizon,u.skyZenith,skyY).mul(.7);
      const internal=u.deep.mul(.85).add(u.shallow.mul(swell.mul(.06).add(.06)));
      underside=mix(mix(internal,windowSky,snell),u.deep.mul(.65),haze.mul(.7));
    }
    if(optics){
      const ray=refractRay(view.negate(),n.negate(),1.333),valid=dot(ray,ray).greaterThan(.001);
      const refractedSky=optics.sky(normalize(ray.add(vec3(0,.000001,0))));
      const transmission=float(1).sub(fresnel);
      underside=select(valid,refractedSky.mul(transmission).mul(1.333*1.333),u.deep.mul(.8));
    }
    if(profile==='open'&&!tank){
      color=color.mul(u.lightLevel);underside=underside.mul(u.lightLevel);
      // Match the world's smooth near/far fog response while retaining radial distance over the
      // wide ocean. Atmospheric fog belongs above the surface; diving keeps the water's own haze.
      color=mix(color,u.fogColor,smoothstep(u.fogNear,u.fogFar,range).mul(u.fogEnabled));
    }
    const below=optics?optics.nearWet.greaterThan(.5):view.y.lessThan(0);
    const alpha=tank?select(below,float(.22),mix(float(.12),float(.38),fresnel)):float(1);
    return vec4(select(below,underside,color),alpha);
  }
  let refraction=!tank&&refract;
  material.colorNode=build(refraction);
  const root=new Mesh(geometry,material);root.name='Ripple water';
  // Refracting harbor water draws after its transparent caustics/volume shell so the
  // viewport copy contains them. Opaque open ocean uses the same order in the opaque pass.
  root.renderOrder=2;
  return {root,material,uniforms:u,depthField,get refraction(){return refraction;},
    setAdvancedOptics(next:AdvancedWaterOptics,nextGeometry:BufferGeometry){
      optics=next;root.geometry=nextGeometry;root.frustumCulled=false;refraction=true;
      material.transparent=true;material.forceSinglePass=true;setupSurface();material.colorNode=build(true);material.needsUpdate=true;
    },
    update(time:number){u.time.value=time;},setChop(value:number){u.chop.value=value;},
    setVisibility(metres:number){u.visibility.value=metres;},
    /** Local water metres; a subtle straight trailing wake for the small rowboat.
     * No particle system or simulation force. Reverse travel reverses the trail. */
    setWake(x:number,z:number,heading:number,speed:number){
      if(!Number.isFinite(x+z+heading+speed)){u.wakeStrength.value=0;return;}
      const direction=speed<0?-1:1;
      u.wakePosition.value.set(x,z);u.wakeDirection.value.set(Math.sin(heading)*direction,Math.cos(heading)*direction);
      u.wakeStrength.value=Math.min(1,Math.abs(speed)/3.2);
    },
    /** Per-ocean uniforms; harbor/tank lighting and global STYLE remain untouched. */
    setEnvironment(environment:WaterEnvironment){
      if(profile!=='open'||tank)return;
      const {sunDirection,skyZenith,skyHorizon,lightLevel}=environment;
      if(!Number.isFinite(sunDirection.x+sunDirection.y+sunDirection.z+skyZenith.r+skyZenith.g+skyZenith.b+skyHorizon.r+skyHorizon.g+skyHorizon.b+lightLevel)||sunDirection.lengthSq()<1e-12)return;
      u.sun.value.copy(sunDirection).normalize();u.skyZenith.value.copy(skyZenith);u.skyHorizon.value.copy(skyHorizon);
      u.lightLevel.value=Math.max(0,Math.min(1,lightLevel));
      u.sunStrength.value=Number.isFinite(environment.sunStrength)?Math.max(0,Math.min(1,environment.sunStrength!)):1;
      const sunColor=environment.sunColor;
      if(sunColor&&Number.isFinite(sunColor.r+sunColor.g+sunColor.b))u.sunColor.value.copy(sunColor);
      else u.sunColor.value.copy(STYLE.sun.color);
      const {fogColor,fogNear,fogFar}=environment;
      const validFog=fogColor!==undefined&&fogNear!==undefined&&fogFar!==undefined&&Number.isFinite(fogColor.r+fogColor.g+fogColor.b+fogNear+fogFar)&&fogNear>=0&&fogFar>fogNear;
      u.fogEnabled.value=validFog?1:0;
      if(validFog){u.fogColor.value.copy(fogColor);u.fogNear.value=fogNear;u.fogFar.value=fogFar;}
    },
    resetEnvironment(){
      if(profile!=='open'||tank)return;
      u.sun.value.copy(STYLE.sun.direction);u.skyZenith.value.copy(STYLE.dome.zenith);u.skyHorizon.value.copy(STYLE.dome.horizon);u.lightLevel.value=1;u.sunStrength.value=1;u.sunColor.value.copy(STYLE.sun.color);
      u.fogEnabled.value=0;u.fogColor.value.copy(STYLE.dome.horizon);u.fogNear.value=0;u.fogFar.value=1;
    },
    /** Base quality skips the per-frame colour/depth copy; the surface keeps its body colour. */
    setRefraction(enabled:boolean){if(tank||enabled===refraction)return;refraction=enabled;material.transparent=profile==='harbor'||enabled;material.colorNode=build(enabled);material.needsUpdate=true;},
    dispose(){depthField?.dispose();if(root.geometry!==geometry)root.geometry.dispose();geometry.dispose();material.dispose();root.removeFromParent();}};
}
