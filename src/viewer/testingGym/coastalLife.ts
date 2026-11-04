/** Additional coastal habitat. Locations/populations are authored, not a wildlife survey. */
import { CatmullRomCurve3, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Material, Mesh, Object3D, Vector3 } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { attribute, cos, float, instanceIndex, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import park from '../../data/lovers-point-gym.json';
import waterfront from '../../data/pacific-grove-waterfront.json';
import { insidePolygon, type GymPoint } from '../avatarController';
import { createGiantKelp } from '../../models/habitat/giantKelp';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGreatWhiteSharkModel } from '../../models/great-white-shark/createGreatWhiteSharkModel';
import { createBlueRockfishModel } from '../../models/blue-rockfish/createBlueRockfishModel';
import { createKelpGreenlingModel } from '../../models/kelp-greenling/createKelpGreenlingModel';
import { createSardineSchool } from '../../models/pacific-sardine/createSardineSchool';
import type { FishModel } from '../../models/types';
export const COASTAL_LIFE={seed:241027,beds:12,kelpPerBed:10,sardines:48,rockfish:3,greenling:2,sharks:1,budget:{triangles:140000,draws:32},activeRadius:210} as const;
const coast:GymPoint[]=[...park.coast.map(p=>[p[0],p[1]] as GymPoint).reverse(),...[...waterfront.coast].map(p=>[p[0],p[1]] as GymPoint)];
const land:GymPoint[]=[...coast,[-145,900],[-145,-135]];
export function coastalDistance(x:number,z:number){
 let distance=Infinity;for(let i=1;i<coast.length;i++){const a=coast[i-1],b=coast[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return distance;
}
export const coastalIsWater=(x:number,z:number)=>!insidePolygon(x,z,land);
export function createCoastalLife(floorAt:(x:number,z:number)=>number,surfaceY=1){
 const root=new Group();root.name='Coastal wildlife and kelp beds';root.userData={seed:COASTAL_LIFE.seed,budget:COASTAL_LIFE.budget,units:'metres'};
 let seed=COASTAL_LIFE.seed as number;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const sway=uniform(0),placement=new Object3D();
 const prototypes=[1,2].map(n=>createGiantKelp({height:8,fronds:1,canopy:3.5,bladeSpacing:1.4,canopyDensity:1.4,juvenile:0,seed:COASTAL_LIFE.seed+n}).children[0] as Mesh);
 // Merge a small rock into each plant prototype: support and kelp share one instance/draw.
 for(const proto of prototypes){const rock=new IcosahedronGeometry(1,0);rock.scale(.7,.32,.65);rock.translate(0,-.16,0);rock.deleteAttribute('uv');const paint=new Float32Array(rock.attributes.position.count*3);for(let i=0;i<paint.length;i+=3)paint.set([.16,.19,.13],i);rock.setAttribute('color',new Float32BufferAttribute(paint,3));const combined=mergeGeometries([proto.geometry,rock]);if(!combined)throw Error('Kelp/holdfast attributes do not match');proto.geometry.dispose();rock.dispose();proto.geometry=combined;}
 const kelpBatches:InstancedMesh[]=[],beds:{center:Vector3;root:Group;plants:Vector3[]}[]=[];
 const candidates:GymPoint[]=[[110,-195],[190,-90],[125,-15],[120,85]];
 // Distribute extension beds along the actual irregular coast; use the water-facing normal.
 for(let k=0;k<8;k++){
  const i=Math.min(waterfront.coast.length-2,15+k*36),a=waterfront.coast[i-1],b=waterfront.coast[i+1],p=waterfront.coast[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  let nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;if(!coastalIsWater(p[0]+nx*30,p[1]+nz*30)){nx=-nx;nz=-nz;}candidates.push([p[0]+nx*30,p[1]+nz*30]);
 }
 for(const [index,[cx,cz]] of candidates.entries()){
  const group=new Group();group.name=`Coastal kelp bed ${index+1}`;const plants:Vector3[]=[];
  for(let attempt=0;attempt<400&&plants.length<COASTAL_LIFE.kelpPerBed;attempt++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random())*14,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;
   if(!coastalIsWater(x,z)||coastalDistance(x,z)<9||plants.some(p=>Math.hypot(p.x-x,p.z-z)<2.4))continue;
   // Anchor all beds to the shared survey-backed seafloor, including the waterfront.
   const y=floorAt(x,z);plants.push(new Vector3(x,y,z));
  }
  if(!plants.length)continue;
  const proto=prototypes[index%2],batch=new InstancedMesh(proto.geometry,proto.material,plants.length);
  batch.name=`coastal-kelp-${index}`;
  plants.forEach((p,i)=>{placement.position.copy(p);placement.rotation.set(0,random()*Math.PI*2,0);placement.scale.set(1,(surfaceY+.22-p.y)/8,1);placement.updateMatrix();batch.setMatrixAt(i,placement.matrix);});
  for(const m of [batch]){m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();}
  batch.boundingBox!.expandByScalar(.5);batch.boundingSphere!.radius+=.5;
  group.add(batch);root.add(group);kelpBatches.push(batch);beds.push({center:new Vector3(cx,0,cz),root:group,plants});
 }
 type Swimmer={id:string;model:Pick<FishModel,'root'|'update'|'dispose'|'setSwimMode'|'setMotionOwner'>;curve:CatmullRomCurve3;length:number;distance:number;speed:number;active:boolean};
 const swimmers:Swimmer[]=[];
 function add(id:string,model:Swimmer['model'],cx:number,cz:number,rx:number,rz:number,y:number,speed:number,phase=0){
  const points=Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;const x=cx+Math.cos(a)*rx,z=cz+Math.sin(a)*rz;return new Vector3(x,Math.min(surfaceY-.65,Math.max(floorAt(x,z)+.85,y+Math.sin(a*2)*.12)),z);});
  const curve=new CatmullRomCurve3(points,true,'centripetal');curve.arcLengthDivisions=256;
  model.setMotionOwner('path');model.setSwimMode('slow',true);root.add(model.root);swimmers.push({id,model,curve,length:curve.getLength(),distance:curve.getLength()*phase,speed,active:true});
 }
 // Broad offshore patrol. No pursuit, damage or player-targeting behavior.
 add('great-white-shark',createGreatWhiteSharkModel({seed:COASTAL_LIFE.seed+3}),180,-55,28,60,-.1,1.25,.2);
 for(let i=0;i<2;i++)add('sardines',createSardineSchool({count:24,capacity:24}),i?156:195,i?65:-120,12,9,-.6,.6,i*.4);
 for(let i=0;i<3;i++)add('blue-rockfish',createBlueRockfishModel(),132+i*2,-8,6,8,-1.8,.28,i/3);
 for(let i=0;i<2;i++)add('kelp-greenling',createKelpGreenlingModel(),132+i*3,65,5,4,-2.7,.22,i/2);
 const point=new Vector3(),direction=new Vector3();
 function place(s:Swimmer){s.curve.getPointAt(s.distance/s.length,point);s.model.root.position.copy(point);s.curve.getTangentAt(s.distance/s.length,direction);s.model.root.rotation.set(0,Math.atan2(direction.z,-direction.x),-Math.asin(Math.max(-1,Math.min(1,direction.y))),'YZX');}
 swimmers.forEach(s=>{place(s);s.model.update(.016);});
 let disposed=false;
 const census={triangles:0,draws:0};
 function countVisible(o:Object3D){if(!o.visible)return;if(o instanceof Mesh){census.draws++;census.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof InstancedMesh?o.count:1);}for(const c of o.children)countVisible(c);}
 countVisible(root);
 return {root,beds,swimmers,kelpBatches,
  swayKelp(){for(const batch of kelpBatches){const m=batch.material as NodeMaterial;if(!(m instanceof NodeMaterial)||m.userData.coastalKelpSway)continue;
   const y=attribute('position','vec3').y,lift=y.div(8).clamp(0,1).pow(1.5),phase=sway.mul(.6).add(float(instanceIndex).mul(1.83));m.positionNode=positionLocal.add(vec3(sin(phase.add(y.mul(.3))).mul(.35),0,cos(phase.mul(.8)).mul(.25)).mul(lift));m.userData.coastalKelpSway=true;m.needsUpdate=true;}
  },
  setViewer(x:number,z:number,overview=false){for(const bed of beds)bed.root.visible=overview||Math.hypot(x-bed.center.x,z-bed.center.z)<COASTAL_LIFE.activeRadius;for(const s of swimmers){s.active=overview||Math.hypot(x-s.model.root.position.x,z-s.model.root.position.z)<COASTAL_LIFE.activeRadius;s.model.root.visible=s.active;}},
  update(dt:number,animate=true){if(disposed||!animate||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);sway.value+=dt;for(const s of swimmers)if(s.active){s.distance=(s.distance+s.speed*dt)%s.length;place(s);s.model.update(dt);}},
  stats(){return {...census,kelp:beds.reduce((n,b)=>n+b.plants.length,0),beds:beds.length,animals:54,activeBeds:beds.filter(b=>b.root.visible).length,activeSwimmers:swimmers.filter(s=>s.active).length};},
  dispose(){if(disposed)return;disposed=true;swimmers.forEach(s=>s.model.dispose());const geometries=new Set(),materials=new Set<Material>();root.traverse(o=>{if(o instanceof InstancedMesh){o.dispose();geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries as Set<import('three').BufferGeometry>)g.dispose();materials.forEach(m=>m.dispose());root.removeFromParent();},
 };
}
