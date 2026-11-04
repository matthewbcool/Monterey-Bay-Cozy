import { BufferGeometry, Color, Float32BufferAttribute, Uint16BufferAttribute, Vector3, type Material } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { OCTOPUS as O,armRadius,armBone } from './definition';
import { finish,plain,weightArm } from './geometry';

export function restPoint(arm:number,u:number,span:number,out=new Vector3()){
 const angle=O.angles[arm],r=O.armBase+O.armLength*u;
 return out.set(O.headX+Math.cos(angle)*r,armRadius(u)+.009,Math.sin(angle)*r).multiplyScalar(span);
}
export function buildArms(a:ModelAssembly,material:Material,span:number,seed:number){
 for(let arm=0;arm<8;arm++){
  const angle=O.angles[arm],side=new Vector3(-Math.sin(angle),0,Math.cos(angle));
  const part=a.addPart(`arm-${arm+1}`),cups=a.addPart(`arm-${arm+1}-suckers`),p:number[]=[],indices:number[]=[],us:number[]=[];
  for(let j=0;j<=O.sections;j++){
   const u=j/O.sections,center=restPoint(arm,u,span),r=armRadius(u)*span;
   for(let k=0;k<O.sides;k++){const theta=k/O.sides*Math.PI*2;p.push(center.x+side.x*Math.sin(theta)*r,center.y+Math.cos(theta)*r,center.z+side.z*Math.sin(theta)*r);us.push(u);}
   if(j)for(let k=0;k<O.sides;k++){const b=(j-1)*O.sides+k,n=(j-1)*O.sides+(k+1)%O.sides;indices.push(b,n,n+O.sides,b,n+O.sides,b+O.sides);}
  }
  // Close both ends without extra rings; the base is buried in the oral web.
  for(let k=1;k<O.sides-1;k++){indices.push(0,k+1,k);const t=O.sections*O.sides;indices.push(t,t+k,t+k+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();finish(g,seed);
  const colors=g.attributes.color,c=new Color(),pale=new Color('#c78d6c');
  for(let n=0;n<colors.count;n++){const underside=Math.max(0,-Math.cos((n%O.sides)/O.sides*Math.PI*2));c.fromBufferAttribute(colors,n).lerp(pale,underside*.72);colors.setXYZ(n,c.r,c.g,c.b);}
  weightArm(g,arm,us);a.addMesh(part,g,material);
  // A paired, deliberately sparse low-poly representation, not a biological cup count.
  for(let j=0;j<O.suckerPairs;j++)for(const sign of [-1,1]){
   const u=.10+j*.135,r=armRadius(u)*span,center=restPoint(arm,u,span).addScaledVector(side,sign*r*.46),radius=r*.46;
   const v:number[]=[],faces:number[]=[];center.y-=r*.78;
   for(let ring=0;ring<2;ring++)for(let k=0;k<6;k++){
    const theta=k/6*Math.PI*2,rr=radius*(ring?.48:1),along=Math.cos(theta)*rr,across=Math.sin(theta)*rr;
    v.push(center.x+Math.cos(angle)*along+side.x*across,center.y-(ring?.005:.009)*span,center.z+Math.sin(angle)*along+side.z*across);
   }
   v.push(center.x,center.y-.003*span,center.z);
   for(let k=0;k<6;k++){const n=(k+1)%6;faces.push(k,n+6,k+6,k,n,n+6,k+6,n+6,12);}
   const cup=new BufferGeometry();cup.setAttribute('position',new Float32BufferAttribute(v,3));cup.setIndex(faces);cup.computeVertexNormals();plain(cup,'#e8be97');
   const colors=cup.attributes.color,recess=new Color('#ba8669'),centerColor=new Color('#8d5c49');
   for(let k=6;k<13;k++){const c=k===12?centerColor:recess;colors.setXYZ(k,c.r,c.g,c.b);}
   weightArm(cup,arm,new Array(13).fill(u));a.addMesh(cups,cup,material,`cup-${j}-${sign}`);
  }
 }
 // Small scalloped saddles between the roots, not a flat circumferential plate.
 // The recessed middle of each edge stays close to the head during arm folding.
 const web=a.addPart('oral-web');
 for(let arm=0;arm<7;arm++){
  const p:number[]=[],weights:number[]=[],bones:number[]=[],indices:number[]=[];
  const left=restPoint(arm,0,span),right=restPoint(arm+1,0,span);
  for(const layer of [-1,1])for(let vertex=0;vertex<5;vertex++){
   if(vertex===2){
    const q=left.clone().lerp(right,.5);q.y=.05*span+layer*.002*span;p.push(q.x,q.y,q.z);
    bones.push(0,armBone(arm,0),armBone(arm+1,0),0);weights.push(.7,.15,.15,0);
   }else{
    const who=vertex<2?arm:arm+1,u=vertex===1||vertex===3?.09:0;
    const q=restPoint(who,u,span);q.y+=layer*.002*span;p.push(q.x,q.y,q.z);
    const f=u*(O.bonesPerArm-1),j=Math.floor(f);bones.push(armBone(who,j),armBone(who,j+1),0,0);weights.push(1-(f-j),f-j,0,0);
   }
  }
  indices.push(0,1,2,0,2,4,2,3,4,5,7,6,5,9,7,7,9,8);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();finish(g,seed);
  g.setAttribute('skinIndex',new Uint16BufferAttribute(bones,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));a.addMesh(web,g,material);
 }
}
