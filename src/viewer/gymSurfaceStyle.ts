/** Gym-only material detail. Factories stay plain toon; this layer modulates their albedo,
 * retaining the existing lights, fog and caustics. All distances are world metres.
 * Original procedural marks interpret the supplied cozy references; no reference pixels. */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, Object3D, RGBAFormat } from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { abs, add, attribute, dot, float, floor, fract, fwidth, max, mix, positionWorld, sin, smoothstep, texture, vec2, vec3 } from 'three/tsl';
import { PARK_TREES } from './testingGym/placement';
import type { NodeStyleEnvironment } from './nodeStyle';

// Node expression typing cannot express mixed scalar/vector arithmetic precisely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any;
const hash=(p:N)=>fract(sin(dot(p,vec2(127.1,311.7))).mul(43758.5453));
function noise(p:N){const i=floor(p),f=fract(p),s=f.mul(f).mul(vec2(3).sub(f.mul(2)));return mix(mix(hash(i),hash(i.add(vec2(1,0))),s.x),mix(hash(i.add(vec2(0,1))),hash(i.add(vec2(1,1))),s.x),s.y);}

/** Soft ambient contact under the authored crowns. This is static occlusion, not a cast sun
 * shadow: it must not rotate incorrectly when the astronomical sun changes. One 256 KiB
 * generated field, mipmapped (~341 KiB total), sampled only by the ground material. */
function canopyContact(){
  const size=256,data=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=-145+(i+.5)/size*295,z=-160+(j+.5)/size*290;
    let shade=0;
    for(const tree of PARK_TREES){const d=(x-tree.x)**2+(z-tree.z)**2,r=tree.height*.58;shade=Math.max(shade,.20*Math.exp(-d/(r*r))+.13*Math.exp(-d/2));}
    const n=(j*size+i)*4;data[n]=Math.round(255*(1-shade));data[n+1]=data[n+2]=data[n];data[n+3]=255;
  }
  const map=new DataTexture(data,size,size,RGBAFormat);map.name='gym-canopy-ambient-contact';map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}

export function applyGymSurfaceStyle(root:Object3D,environment:NodeStyleEnvironment){
  const seen=new Set<MeshToonNodeMaterial>();
  root.traverse(object=>{
    if(!(object instanceof Mesh)||!(object.material instanceof MeshToonNodeMaterial))return;
    const material=object.material;
    if(seen.has(material)||material.userData.gymSurfaceStyle)return;
    const ground=object.userData.singleGroundSurface===true,tree=object.name.startsWith('gym-tree-'),stone=object.name.startsWith('gym-rock:');
    if(!ground&&!tree&&!stone&&!/^gym-(scenery|buildings|terrain-skirt)/.test(object.name))return;
    seen.add(material);
    const p=positionWorld.xz,broad=noise(p.mul(.22)).sub(.5),grain=noise(p.mul(19)).sub(.5);
    // Filter tiny detail by its pixel footprint instead of allowing sparkle at a grazing view.
    const footprint=max(fwidth(p.x),fwidth(p.y));
    const fine=float(1).sub(smoothstep(.12,.65,footprint)),grainFade=float(1).sub(smoothstep(.025,.10,footprint));
    let modifier:N=vec3(1).mul(broad.mul(.07).add(1).add(grain.mul(.035).mul(grainFade)));
    if(ground){
      const kind=attribute('groundKind','float'),grass=kind.equal(1),sand=kind.equal(2),paved=kind.equal(3).or(kind.equal(6));
      const cell=p.mul(1.8),q=fract(cell).sub(.5),jitter=hash(floor(cell));
      // Scattered small triangular leaf flecks; soft edges and low contrast keep the lawn calm.
      const triangle=max(abs(q.x.add(jitter.sub(.5).mul(.22))).mul(1.4).add(q.y.mul(.6)),q.y.negate());
      const edge=max(fwidth(triangle),float(.025));
      const leaf=float(1).sub(smoothstep(float(.16).sub(edge),float(.16).add(edge),triangle)).mul(smoothstep(.35,.65,jitter)).mul(fine);
      const grassValue=broad.mul(.14).add(1).add(leaf.mul(.13));
      const sandValue=noise(p.mul(.45)).sub(.5).mul(.06).add(1).add(grain.mul(.045).mul(grainFade));
      // Weathered paving joints are art direction, not a surveyed slab layout.
      const slab=abs(fract(p.div(2.4)).sub(.5)),joint=smoothstep(.48,.495,max(slab.x,slab.y)).mul(fine);
      const pavingValue=broad.mul(.055).add(.99).sub(joint.mul(.07)).add(grain.mul(.035).mul(grainFade));
      modifier=mix(modifier,vec3(grassValue),grass);modifier=mix(modifier,vec3(sandValue),sand);modifier=mix(modifier,vec3(pavingValue),paved);
      const contact=canopyContact(),uv=p.sub(vec2(-145,-160)).div(vec2(295,290));
      modifier=modifier.mul(texture(contact,uv).r);
      let released=false;material.addEventListener('dispose',()=>{if(!released){released=true;contact.dispose();}});
      material.userData.gymContactTexture=contact;
    }else if(tree){
      const color=attribute('color','vec3'),foliage=smoothstep(.005,.04,color.g.sub(color.r));
      modifier=modifier.mul(mix(float(1),broad.mul(.10).add(1.24),foliage));
    }
    // NodeMaterial still multiplies the vertex paint once. Keep detail in diffuse albedo,
    // so night, fog and underwater illumination continue to work through the shared style.
    material.colorNode=modifier;
    const fill=attribute('color','vec3').mul(environment.paintExposure).mul(tree?.06:.018);
    const styled=material as MeshToonNodeMaterial & {emissiveNode?:N};
    Object.assign(material,{emissiveNode:styled.emissiveNode?add(styled.emissiveNode,fill):fill});
    material.userData.gymSurfaceStyle=true;material.needsUpdate=true;
  });
}
