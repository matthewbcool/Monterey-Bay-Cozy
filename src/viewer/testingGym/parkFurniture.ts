import {createFurnitureSource} from '../../models/props/furniture';
import { CylinderGeometry, Group, Vector3, type Material } from 'three';
import { box, mat, mesh } from '../../models/props/primitives';
import { canStandAt, type GymCollider, type GymPoint } from '../avatarController';
import { groundHeight } from './elevation';
import { ribbon, surface } from './geometry';
import { GROUND_KIND } from './pathStyle';

/** Exact slender footprints keep diagonal fences from creating invisible corners. */
export function segmentCollider(a:GymPoint,b:GymPoint,width:number,top:number):Extract<GymCollider,{kind:'box'}> {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length*width/2,nz=(b[0]-a[0])/length*width/2;
  const footprint:GymPoint[]=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];
  return {kind:'box',footprint,top,minX:Math.min(...footprint.map(p=>p[0])),maxX:Math.max(...footprint.map(p=>p[0])),minZ:Math.min(...footprint.map(p=>p[1])),maxZ:Math.max(...footprint.map(p=>p[1]))};
}
export function rail(parent:Group,name:string,a:Vector3,b:Vector3,width:number,material:Material){
  const delta=b.clone().sub(a),middle=a.clone().add(b).multiplyScalar(.5);
  const part=box(parent,name,[delta.length(),width,width],material,[middle.x,middle.y,middle.z]);
  part.quaternion.setFromUnitVectors(new Vector3(1,0,0),delta.normalize());part.userData.elevationPlaced=true;return part;
}
/** One static batch at the owner; open-ended triangular pickets reduce hidden faces. */
export function fenceRun(parent:Group,a:GymPoint,b:GymPoint,material:Material,colliders:GymCollider[],height=1.15,pickets=true){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/2.5);
  const at=(t:number)=>{const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return new Vector3(x,groundHeight(x,z),z);};
  for(let i=0;i<=count;i++){
    const p=at(i/count),post=box(parent,'Recreation fence · terrain-seated post',[.075,height,.075],material,[p.x,p.y+height/2,p.z]);post.userData.elevationPlaced=true;
    if(i===count)continue;
    for(const y of [.18,height-.07])rail(parent,'Pool/court fence · terrain-following rail',at(i/count).add(new Vector3(0,y,0)),at((i+1)/count).add(new Vector3(0,y,0)),.045,material);
  }
  // A stylized 45 cm rhythm; not every bar in the photograph.
  if(pickets){const n=Math.ceil(length/.45);for(let i=1;i<n;i++){
    const p=at(i/n),bar=mesh(parent,'Recreation fence · slender infill',new CylinderGeometry(.014,.014,height-.25,3,1,true),material,p.x,p.y+(height+.11)/2,p.z);bar.userData.elevationPlaced=true;
  }}
  colliders.push(segmentCollider(a,b,.09,Math.max(...Array.from({length:count+1},(_,i)=>at(i/count).y))+height));
}

/** Photo interpretation of the cypress apron, seating, parking edge and trail markings.
 * Positions are authored against cached OSM; none are surveyed furniture locations. */
export function addRecreationTrail(scenery:Group,overlays:Group,colliders:GymCollider[]){
  const gravel=mat('#bcac8d'),wood=mat('#9a8767'),paint=mat('#e3dfbf');
  const apron:GymPoint[]=[[-21,25],[-39.5,71.6],[-35,75],[0,92],[22,102],[25,96],[14,77],[4,69],[-6,43],[-8,28]];
  const ground=mesh(overlays,'Cypress recreation apron · photo-estimated compacted sand',surface(apron,.020),gravel);ground.userData.groundKind=GROUND_KIND.gravel;
  function paintLine(name:string,points:GymPoint[],width:number,priority=.034){const p=mesh(overlays,name,ribbon(points,width,priority),paint);p.userData.groundKind=GROUND_KIND.asphalt;}
  // The two-lane strip follows the actual cached cycleway centreline.
  const a:GymPoint=[-34.732,76.358],b:GymPoint=[28.351,107.237],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const at=(s:number,offset=0):GymPoint=>[a[0]+dx/len*s-dz/len*offset,a[1]+dz/len*s+dx/len*offset];
  const shoulder=mesh(overlays,'Trail parking shoulder · photo-estimated compacted ground',surface([at(0,1.5),at(len,1.5),at(len,4.7),at(0,4.7)],.021),gravel);shoulder.userData.groundKind=GROUND_KIND.gravel;
  for(let s=3;s<len-2;s+=5)paintLine('Coastal trail · dashed centre paint',[at(s),at(s+2)],.07);
  for(const side of [-1,1])paintLine('Coastal trail · white edge',[at(0,side*1.45),at(len,side*1.45)],.06);
  for(const [s,side,dir] of [[12,-.72,1],[20,.72,-1]]){
    const tip=at(s+dir*1.0,side),tail=at(s-dir*.7,side);
    paintLine('Coastal trail · direction arrow shaft',[tail,tip],.09);
    paintLine('Coastal trail · direction arrow head',[at(s+dir*.35,side-.30),tip,at(s+dir*.35,side+.30)],.09);
  }
  // Parking separators have pedestrian gaps at the mapped crossing, with no curb across it.
  for(const [start,end] of [[0,30],[35,len-2]]){
    const n=Math.ceil((end-start)/3.5);
    for(let i=0;i<n;i++){
      const p=at(start+(end-start)*i/n,2.65),q=at(start+(end-start)*(i+1)/n,2.65);
      const h=groundHeight(...p),post=box(scenery,'Trail parking edge · timber bollard',[.15,.86,.15],wood,[p[0],h+.43,p[1]]);post.userData.elevationPlaced=true;
      rail(scenery,'Trail parking edge · low timber rail',new Vector3(p[0],h+.57,p[1]),new Vector3(q[0],groundHeight(...q)+.57,q[1]),.085,wood);
      colliders.push(segmentCollider(p,q,.16,Math.max(h,groundHeight(...q))+.86));
    }
  }
  for(let s=4;s<len-3;s+=3.2)paintLine('Parking · photo-estimated bay stripe',[at(s,5),at(s,9.1)],.065,.026);
  // Benches face the court/bay. The tree inventory is preserved; seats fit between trunks.
  for(const [x,z,yaw] of [[-31,64,1.25],[-27.5,53,1.25],[-22,80,-.45],[-11,84,-.45],[3,90,-.45]]){
    if(!canStandAt(x,z,{minX:-100,maxX:100,minZ:-100,maxZ:130},colliders,.65))continue;
    const bench=createFurnitureSource('park-bench'),h=groundHeight(x,z);bench.position.set(x,h,z);bench.rotation.y=yaw;
    bench.updateMatrixWorld(true);
    // Flatten into scenery now so the owning batch keeps the ground transform.
    for(const child of [...bench.children]){child.applyMatrix4(bench.matrix);child.userData.elevationPlaced=true;scenery.add(child);}
    const u:GymPoint=[Math.cos(yaw)*.85,-Math.sin(yaw)*.85];
    colliders.push(segmentCollider([x-u[0],z-u[1]],[x+u[0],z+u[1]],.52,h+1.05));
  }
  for(const [x,z] of [[-31,70],[-20,82],[7,92]]){
    const h=groundHeight(x,z);
    const bin=createFurnitureSource('park-litter-bin');bin.position.set(x,h,z);bin.updateMatrix();
    for(const child of [...bin.children]){child.applyMatrix4(bin.matrix);child.userData.elevationPlaced=true;scenery.add(child);}
    colliders.push({kind:'circle',x,z,radius:.28});
  }
}
