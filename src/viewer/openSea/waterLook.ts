import {Color,DirectionalLight,Group,Mesh,Object3D,PlaneGeometry,Vector3} from 'three';
import {MeshBasicNodeMaterial,NodeMaterial} from 'three/webgpu';
import {abs,cameraPosition,cos,exp,float,Fn,If,max,min,mix,normalLocal,normalWorld,output,positionWorld,pow,select,shadow,sin,smoothstep,texture,uniform,vec2,vec3,vec4} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {STYLE} from '../../models/shared/style';
import {createCausticTexture} from './caustics';
// TSL's overloaded node expression types cannot express all vector/scalar arithmetic here.
type N=any;
export const TANK_WATER_BUDGET={triangles:12,draws:1,textureBytes:256*256*4};
/** CPU reference for the optical path used by the shader. Gallery air never counts as water. */
export function submergedDistance(camera:Vector3,point:Vector3,size:{width:number;height:number;depth:number}){
  let entry=0,exit=1;const bounds=[size.width/2,size.height/2,size.depth/2];
  for(let axis=0;axis<3;axis++){
    const a=camera.getComponent(axis),delta=point.getComponent(axis)-a,b=bounds[axis];
    if(Math.abs(delta)<1e-8){if(a< -b||a>b)return 0;continue;}
    const t0=(-b-a)/delta,t1=(b-a)/delta;entry=Math.max(entry,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
  }
  return Math.max(0,exit-entry)*camera.distanceTo(point);
}
/** Underwater room, both surface faces and caustics share one twelve-triangle batch.
 * Lighting is an artistic approximation, not a fluid simulation or measured water optics. */
export function createTankWater(width:number,height:number,depth:number){
  const field=createCausticTexture(),time=uniform(0),chop=uniform(.75),strength=uniform(1);
  const u={time,chop,strength};
  const deep=uniform(new Color('#071d38')),upper=uniform(new Color('#105778'));
  const lightColor=uniform(STYLE.sky.color.clone().lerp(STYLE.sun.color,.25));
  function caustic(p:N):N{
    const t=time.mul(.16).mul(chop),q=p.mul(.17);
    const warp=vec2(sin(q.y.mul(7).add(t)),cos(q.x.mul(6).sub(t.mul(.8)))).mul(.035).mul(chop);
    const a=texture(field,q.add(warp).add(vec2(t.mul(.018),t.mul(-.024)))).r;
    const b=texture(field,q.mul(1.16).sub(warp).add(vec2(.31,.59)).add(vec2(t.mul(-.021),t.mul(.015)))).r;
    const focus=sin(q.x.mul(4.3).add(q.y.mul(3.1)).add(t.mul(.25))).mul(.18).add(.82);
    // A single web: the second sample varies its brightness, never adds crossing lines.
    // This matches the reef response without changing its separate weather controls.
    return a.mul(b.mul(.45).add(.55)).mul(focus).mul(strength);
  }
  function pathLength(p:N):N{
    const delta=p.sub(cameraPosition);
    const safe=vec3(select(abs(delta.x).lessThan(.0001),float(.0001),delta.x),select(abs(delta.y).lessThan(.0001),float(.0001),delta.y),select(abs(delta.z).lessThan(.0001),float(.0001),delta.z));
    const a=vec3(-width/2,-height/2,-depth/2).sub(cameraPosition).div(safe),b=vec3(width/2,height/2,depth/2).sub(cameraPosition).div(safe);
    const lo=min(a,b),hi=max(a,b),entry=max(0,max(lo.x,max(lo.y,lo.z))),exit=min(1,min(hi.x,min(hi.y,hi.z)));
    return max(0,exit.sub(entry)).mul(delta.length());
  }
  function absorb(color:N,p:N):N{
    const transmission=exp(vec3(-.055,-.026,-.016).mul(pathLength(p)));
    return mix(deep.mul(.85),color,transmission);
  }
  const material=new MeshBasicNodeMaterial({name:'tank-water-light',fog:false});
  const base=Fn(()=>{
    const p=positionWorld,vertical=p.y.add(height/2).div(height).clamp(),waterDepth=float(height/2).sub(p.y).max(0);
    const drift=time.mul(.11).mul(chop),projected=vec2(p.x.add(waterDepth.mul(.19)),p.z.add(waterDepth.mul(.36)));
    const cells=caustic(projected);
    // Light columns broaden as they descend; unlike a screen overlay these stay on the enclosure.
    const bend=sin(p.y.mul(.32).add(drift)).mul(.27).add(sin(p.x.mul(.43).sub(drift)).mul(.15));
    const shaft=pow(max(0,sin(p.x.mul(.74).add(bend).add(p.z.mul(.16)))),14)
      .add(pow(max(0,sin(p.x.mul(1.21).sub(bend).sub(p.z.mul(.11)).add(1.8))),22).mul(.4));
    const heightLight=pow(vertical,.8);
    const color=mix(deep,upper,heightLight.mul(.72)).toVar();
    color.addAssign(lightColor.mul(shaft).mul(heightLight).mul(.038));
    // Focused overhead light belongs on receiving surfaces. Projecting XZ onto the
    // vertical enclosure stretches cells into stripes; keep the distant walls hazy.
    const floor=normalLocal.y.greaterThan(.5).and(p.y.lessThan(0));
    If(floor,()=>{
      const shade=float(.75).add(sin(p.x.mul(.23)).mul(.025)).sub(p.z.add(depth/2).div(depth).mul(.08));
      color.assign(vec3(.018,.058,.068).mul(shade).add(lightColor.mul(cells).mul(.055)));
    });
    If(abs(normalLocal.y).greaterThan(.5).and(p.y.greaterThan(0)),()=>{
      // Broad, curved surface reflections rather than a second caustic grid.
      // No camera-dependent UVs, crossing sine-product checkerboard or sharp crests.
      const ripple=sin(p.x.mul(.85).add(p.z.mul(1.4))
        .add(sin(p.x.mul(.44).sub(p.z.mul(.38)).add(drift)).mul(1.2)).sub(drift));
      const broad=sin(p.x.mul(.31).add(p.z.mul(.47)).sub(drift.mul(.6)));
      color.assign(vec3(.012,.068,.095)
        .add(vec3(.009,.025,.03).mul(ripple.mul(.5).add(.5)))
        .add(lightColor.mul(smoothstep(.65,1,ripple)).mul(.025))
        .add(vec3(.004,.012,.016).mul(broad.mul(.5).add(.5))));
    });
    // Slightly darker side walls establish perspective without adding modeled clutter.
    color.mulAssign(select(abs(normalLocal.x).greaterThan(.5),float(.76),float(1)));
    return absorb(color,p);
  })();
  material.colorNode=base;material.userData={styleBase:base,rim:false,tankWater:true};
  const parts=[new PlaneGeometry(width,height).translate(0,0,-depth/2),
    new PlaneGeometry(width,depth).rotateX(-Math.PI/2).translate(0,-height/2,0),
    new PlaneGeometry(width,depth).rotateX(Math.PI/2).translate(0,height/2,0),
    // Opposite winding makes the surface visible from an otter-follow camera
    // above the water. Back-face culling selects one face without another draw.
    new PlaneGeometry(width,depth).rotateX(-Math.PI/2).translate(0,height/2,0),
    new PlaneGeometry(depth,height).rotateY(Math.PI/2).translate(-width/2,0,0),
    new PlaneGeometry(depth,height).rotateY(-Math.PI/2).translate(width/2,0,0)];
  const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
  const root=new Group();root.name='Open Sea water volume';const enclosure=new Mesh(geometry,material);enclosure.name='Water enclosure and surface';enclosure.receiveShadow=true;root.add(enclosure);
  const shaded=new WeakSet<NodeMaterial>();
  function shadeCreature(creature:Object3D){
    creature.traverse(object=>{
      if(!(object instanceof Mesh))return;
      // Opaque bodies cast silhouettes; translucent jelly tissue must not cast a solid bell.
      object.castShadow=(Array.isArray(object.material)?object.material:[object.material]).some(m=>!m.transparent);
      object.receiveShadow=true;
      for(const m of Array.isArray(object.material)?object.material:[object.material]){
        if(!(m instanceof NodeMaterial)||shaded.has(m))continue;shaded.add(m);
        const p=positionWorld,waterDepth=float(height/2).sub(p.y).max(0);
        const light=caustic(vec2(p.x.add(waterDepth.mul(.19)),p.z.add(waterDepth.mul(.36))))
          .mul(normalWorld.y.max(0).mul(.8).add(.12)).mul(exp(waterDepth.mul(-.12))).mul(m.transparent?.2:1)
          .mul(float(1).sub(smoothstep(height/2-.04,height/2+.01,p.y)));
        const original:N=m.outputNode??output;
        // Work after the shared toon/rim lighting, retaining skinning, morphs and original alpha.
        m.outputNode=vec4(absorb(original.rgb.mul(light.mul(.7).add(1)).add(lightColor.mul(light).mul(.045)),p),original.a);
        m.userData.tankWater=true;m.needsUpdate=true;
      }
    });
  }
  let disposed=false;
  return {root,material,enclosure,field,uniforms:u,refraction:false,shadeCreature,
    /** Unlit water retains its painted colour but receives the scene's actual cast shadows. */
    setShadowLight(light:DirectionalLight){
      // Three's analytic lights accept this shared shadow node as well: the unlit
      // receiver must not allocate/render a duplicate map alongside toon receivers.
      const settings=light.shadow as typeof light.shadow & {shadowNode?:ReturnType<typeof shadow>};
      settings.shadowNode??=shadow(light);
      const shadedBase=base.mul(mix(vec3(.55),vec3(1),settings.shadowNode));
      material.colorNode=shadedBase;material.userData.styleBase=shadedBase;material.needsUpdate=true;
    },
    update(elapsed:number){time.value=elapsed;},setChop(value:number){if(Number.isFinite(value))chop.value=clampNumber(value,0,1.5);},
    dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();field.dispose();root.removeFromParent();}};
}
function clampNumber(value:number,lo:number,hi:number){return Math.min(hi,Math.max(lo,value));}
