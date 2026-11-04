import { BufferGeometry, Color, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { skinGeometry, solidColor } from '../shared/fish/geometry';
import { OCTOPUS as O, armBone } from './definition';

/** Continuous position-based pigment avoids a random color seam at duplicated vertices. */
export function pigment(g:BufferGeometry,seed:number,underside=false){
 const p=g.attributes.position,c=new Color(),base=new Color(underside?'#ddb18d':'#af5032'),warm=new Color(underside?'#efc6a1':'#d87b4e'),dark=new Color('#713c30');
 const colors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),offset=(seed%997)*.13;
  const noise=Math.sin(x*115+offset+Math.sin(z*71))*Math.sin(y*123-z*83+offset);
  c.copy(base).lerp(noise>0?warm:dark,Math.abs(noise)*(underside?.1:.25));colors.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}
export function finish(g:BufferGeometry,seed:number,bone=0){skinGeometry(g,bone);pigment(g,seed);g.setAttribute('fishMatte',new Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(0),1));return g;}
export function plain(g:BufferGeometry,color:string,bone=0){skinGeometry(g,bone);solidColor(g,color);g.setAttribute('fishMatte',new Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(1),1));return g;}
export function weightArm(g:BufferGeometry,arm:number,us:readonly number[]){
 const indices:number[]=[],weights:number[]=[];
 for(const u of us){const f=Math.min(O.bonesPerArm-1.000001,Math.max(0,u)*(O.bonesPerArm-1)),j=Math.floor(f);indices.push(armBone(arm,j),armBone(arm,j+1),0,0);weights.push(1-(f-j),f-j,0,0);}
 g.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));return g;
}
