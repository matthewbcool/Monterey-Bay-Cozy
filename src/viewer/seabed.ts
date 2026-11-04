import {BufferGeometry,Color,DodecahedronGeometry,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,Mesh,MeshBasicMaterial,Object3D,PlaneGeometry} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {abs,cameraPosition,distance,exp,float,Fn,max,positionWorld,pow,select,sin,uniform,vec2,vec4} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HARBOR_SIZE,seabedDepth} from './bathymetry';
import {createToonMaterial} from '../models/shared/style';
import {createGiantKelp} from '../models/habitat/giantKelp';
import {disposeObject} from '../models/props/primitives';

/** Five rendering batches: sand, caustic light, instanced rocks, kelp, outside volume sides. */
export function createSeabed(){
 const root=new Group();root.name='Sloping seabed in metres';
 const floorGeo=new PlaneGeometry(HARBOR_SIZE.width,HARBOR_SIZE.depth,32,24);floorGeo.rotateX(-Math.PI/2);
 const pos=floorGeo.attributes.position,colors=new Float32Array(pos.count*3),color=new Color();
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),depth=seabedDepth(x,z);pos.setY(i,-depth);
  const ripple=Math.sin(x*7+Math.sin(z*.7))*.024;
  color.set('#b4bd94').multiplyScalar(.90-depth*.044+ripple);color.toArray(colors,i*3);
 }
 floorGeo.setAttribute('color',new Float32BufferAttribute(colors,3));floorGeo.computeVertexNormals();
 const sand=new Mesh(floorGeo,createToonMaterial({vertexColors:true,name:'sand-toon',rim:false}));sand.name='Sandy shelf';sand.receiveShadow=true;root.add(sand);
 const rockGeo=new DodecahedronGeometry(1,0);rockGeo.computeVertexNormals(); // non-indexed: per-face normals keep facets
 const rocks=new InstancedMesh(rockGeo,createToonMaterial({color:'#6f8c78',name:'rock-toon'}),18);
 const dummy=new Object3D();
 for(let i=0;i<18;i++){
  const x=-4+(i%6)*2.6+Math.sin(i*2)*.6,z=-7+Math.floor(i/6)*6+Math.cos(i)*1.5;
  dummy.position.set(x,-seabedDepth(x,z)+.16,z);dummy.scale.set(.35+(i%4)*.18,.24+(i%3)*.10,.45+(i%3)*.18);dummy.rotation.set(i*.17,i*1.3,0);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
 }rocks.name='18 instanced seabed rocks';rocks.receiveShadow=true;root.add(rocks);
 // Kelp forest: each plant is the shared giant-kelp factory, sized to the local depth so fronds reach
 // the surface canopy, then merged into one double-sided draw for the whole shelf.
 const kelpParts:BufferGeometry[]=[];
 for(let i=0;i<11;i++){
  const x=-3.7+(i%4)*2.3+Math.sin(i*1.7)*.35,z=-3.8+Math.floor(i/4)*3.9+Math.cos(i*2.3)*.4,depth=seabedDepth(x,z);
  const plant=createGiantKelp({height:depth,fronds:depth>4?3:2,canopy:.5+(i%3)*.3,bladeSpacing:.62,canopyDensity:1,seed:i+11}); // scene LOD: sparser blades than the inspector plant
  plant.position.set(x,-depth,z);plant.rotation.y=i*1.3;plant.updateMatrixWorld(true);
  plant.traverse(o=>{if(o instanceof Mesh)kelpParts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});disposeObject(plant);
 }
 const kelpGeo=mergeGeometries(kelpParts)!;kelpParts.forEach(g=>g.dispose());
 const kelp=new Mesh(kelpGeo,createToonMaterial({vertexColors:true,side:DoubleSide,name:'kelp-toon'}));kelp.name='Giant kelp forest (11 plants, one batch)';root.add(kelp);
 const causticGeometry=floorGeo.clone();causticGeometry.translate(0,.014,0);
 // Refracted light on the shelf: TSL, so it renders on both WebGPU and the WebGL 2 backend.
 const causticTime=uniform(0),causticVisibility=uniform(14);
 const causticMaterial=new MeshBasicNodeMaterial({name:'seabed-caustics',transparent:true,depthWrite:false,fog:false});
 causticMaterial.colorNode=Fn(()=>{
  const world=positionWorld,t=causticTime.mul(.23),q=world.xz.mul(2.2);
  const p=q.add(vec2(sin(q.y.mul(.83).add(t)),sin(q.x.mul(.74).sub(t))).mul(.65));
  const a=sin(p.x.add(t)).add(sin(p.y.mul(1.14).sub(t.mul(.8)))),b=sin(p.x.mul(.73).sub(p.y.mul(.82)).sub(t.mul(.6))).add(sin(p.y.mul(.9).add(t)));
  const light=pow(max(0,float(1).sub(abs(a).mul(.62))),15).add(pow(max(0,float(1).sub(abs(b).mul(.62))),15).mul(.5));
  const haze=exp(pow(distance(cameraPosition,world).mul(1.35).div(causticVisibility),2).negate());
  const fade=exp(world.y.mul(.17)).mul(select(cameraPosition.y.lessThan(0),haze,float(1)));
  return vec4(.62,.87,.75,light.mul(.16).mul(fade));
 })();
 const caustics=new Mesh(causticGeometry,causticMaterial);caustics.name='Refracted seabed light';root.add(caustics);
 // Exterior-only faces make the diorama's depth readable; the inside remains open.
 const sides:number[]=[],sideColors:number[]=[],corners=[[-16,-12],[16,-12],[16,12],[-16,12]];
 const topColor=new Color('#1b6571'),bottomColor=new Color('#123e50');
 for(let edge=0;edge<4;edge++){
  const a=corners[edge],b=corners[(edge+1)%4],steps=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
  for(let i=0;i<steps;i++){
   const x=a[0]+(b[0]-a[0])*i/steps,z=a[1]+(b[1]-a[1])*i/steps,nx=a[0]+(b[0]-a[0])*(i+1)/steps,nz=a[1]+(b[1]-a[1])*(i+1)/steps;
   const ta=[x,0,z],tb=[nx,0,nz],ba=[x,-seabedDepth(x,z),z],bb=[nx,-seabedDepth(nx,nz),nz];
   sides.push(...ta,...tb,...ba,...tb,...bb,...ba);
   for(const c of [topColor,topColor,bottomColor,topColor,bottomColor,bottomColor])sideColors.push(c.r,c.g,c.b);
  }
 }
 const sideGeo=new BufferGeometry();sideGeo.setAttribute('position',new Float32BufferAttribute(sides,3));sideGeo.setAttribute('color',new Float32BufferAttribute(sideColors,3));sideGeo.computeVertexNormals();
 const shell=new Mesh(sideGeo,new MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.93,depthWrite:false}));shell.name='Exterior water depth';root.add(shell);
 return {root,sand,rocks,kelp,caustics,shell,uniforms:{time:causticTime,visibility:causticVisibility},update(time:number){causticTime.value=time;},setVisibility(metres:number){causticVisibility.value=metres;}};
}
