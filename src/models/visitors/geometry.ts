import {BufferGeometry, BoxGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, SphereGeometry, Uint16BufferAttribute, Vector3} from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VisitorDefinition} from './definition';

/** Connected jacket outline, with shoulder width and torso depth expressed as fractions of height. */
function torso() {
  const rings=[[.48,.084,.060],[.57,.086,.061],[.70,.096,.063],[.795,.125,.057],[.835,.048,.044]];
  const positions:number[]=[],indices:number[]=[];
  rings.forEach(([y,w,d],i)=>{
    for(let j=0;j<8;j++){
      const angle=j/8*Math.PI*2;positions.push(Math.sin(angle)*w,y,Math.cos(angle)*d);
      if(i) {const a=(i-1)*8+j,b=(i-1)*8+(j+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}
    }
  });
  for(const [ring,reverse] of [[0,true],[4,false]] as const){
    const center=positions.length/3;positions.push(0,rings[ring][0],0);
    for(let j=0;j<8;j++){const a=ring*8+j,b=ring*8+(j+1)%8;indices.push(center,reverse?b:a,reverse?a:b);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** Connected sleeve/trouser rings prevent cracks at bent elbows and knees without extra triangles. */
function limb(points:Vector3[],radii:number[]) {
  const positions:number[]=[],indices:number[]=[];
  points.forEach((center,i)=>{
    const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
    const u=new Vector3().crossVectors(tangent,new Vector3(0,0,1)).normalize();
    const v=new Vector3().crossVectors(tangent,u).normalize();
    for(let j=0;j<5;j++){
      const angle=j/5*Math.PI*2,p=center.clone().addScaledVector(u,Math.cos(angle)*radii[i]).addScaledVector(v,Math.sin(angle)*radii[i]);
      positions.push(p.x,p.y,p.z);
      if(i){const a=(i-1)*5+j,b=(i-1)*5+(j+1)%5;indices.push(a,b,a+5,b,b+5,a+5);}
    }
  });
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

const point=(x:number,y:number,z=0)=>new Vector3(x,y,z);
/** One person in normalized authoring coordinates; no component becomes a separate draw. */
export function buildVisitorGeometry(person:VisitorDefinition,placement:Matrix4,bones:{spine:number;head:number;arm:number},personIndex:number) {
  const pieces:BufferGeometry[]=[];
  function add(g:BufferGeometry,bone:number,blendTorso=false) {
    g.deleteAttribute('uv');const p=g.attributes.position,indices:number[]=[],weights:number[]=[];
    for(let i=0;i<p.count;i++){
      const weight=blendTorso?Math.max(0,Math.min(1,(p.getY(i)-.48)/.12)):1;
      indices.push(bone,0,0,0);weights.push(weight,1-weight,0,0);
    }
    g.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
    g.setAttribute('visitorId',new Float32BufferAttribute(new Float32Array(p.count).fill(personIndex),1));
    g.scale(person.height,person.height,person.height).applyMatrix4(placement);pieces.push(g);
  }
  add(torso().scale(person.build,1,1),bones.spine,true);
  add(new CylinderGeometry(.031,.038,.08,5,1,true).translate(0,.85,0),bones.spine);
  const headHeight=person.height<1.4?.155:.137;
  add(new SphereGeometry(1,8,5).scale(.054,headHeight/2,.059).translate(0,1-headHeight/2,-.006),bones.head);
  for(const side of [-1,1]){
    // Shoes remain on Y=0; the slightly staggered stance gives each leg its own readable contour.
    const ankle=point(side*.054,.045,side===-1?.012:-.008),knee=point(side*.059,.275,side*.01),hip=point(side*.052,.51);
    add(limb([hip,knee,ankle],[.043,.032,.022]),0);
    add(new BoxGeometry(.063,.04,.123).translate(ankle.x,.02,ankle.z-.025),0);
    const shoulder=point(side*.112*person.build,.79),bone=side===1?bones.arm:bones.spine;
    let elbow=point(side*.141,.62,.006),wrist=point(side*.135,.47,-.014);
    if(person.pose==='hip'&&side===1){elbow=point(.21,.65,.015);wrist=point(.09,.58,-.025);}
    if(person.pose==='fold'){elbow=point(side*.14,.63,-.065);wrist=point(-side*.035,.68,-.095);}
    if(person.pose==='point'&&side===1){elbow=point(.18,.78,-.12);wrist=point(.21,.87,-.29);}
    add(limb([shoulder,elbow,wrist],[.033,.026,.019]),bone);
    add(new SphereGeometry(1,4,3).scale(.023,.035,.022).translate(wrist.x,wrist.y-.012,wrist.z),bone);
  }
  if(person.backpack)add(new SphereGeometry(1,6,4).scale(.086,.119,.048).translate(0,.68,.072),bones.spine);
  const merged=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
  const indexed=mergeVertices(merged,1e-7);merged.dispose();return indexed;
}
