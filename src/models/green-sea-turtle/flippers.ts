import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { skinGeometry } from '../shared/fish/geometry';

/** Thin closed hydrofoils: rounded thickness at the root, swept tapered tips, blended shoulder weights. */
export function buildFlipper(side:number,rear:boolean,bone:number){
 const sections=rear?[[.28,.145,.075,-.027,.012],[.34,.23,.10,-.032,.010],[.42,.32,.075,-.04,.006],[.43,.365,.022,-.05,.002]]:[[-.245,.15,.080,-.018,.016],[-.25,.25,.125,-.020,.016],[-.205,.37,.115,-.03,.012],[-.11,.49,.085,-.05,.009],[.015,.59,.048,-.065,.004],[.085,.62,.004,-.060,.001]];
 const p:number[]=[],c:number[]=[],idx:number[]=[],upper=new Color('#827650'),lower=new Color('#b5ad82');
 for(let r=0;r<sections.length;r++){
  const [x,z,w,y,t]=sections[r];
  for(const [dx,dy] of [[-w/2,0],[0,t],[w/2,0],[0,-t]]){p.push(x+dx,y+dy,z*side);const color=dy<0?lower:upper;c.push(color.r,color.g,color.b);}
  if(r<sections.length-1)for(let q=0;q<4;q++){const a=r*4+q,b=r*4+(q+1)%4,d=(r+1)*4+q,e=(r+1)*4+(q+1)%4;side<0?idx.push(a,b,d,b,e,d):idx.push(a,d,b,b,d,e);}
 }
 const end=(sections.length-1)*4;side<0?idx.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3):idx.push(0,1,2,0,2,3,end,end+2,end+1,end,end+3,end+2);
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();skinGeometry(g,bone);
 // Root vertices remain attached to the body, transition to the flipper hinge outside the shell.
 for(let i=0;i<g.attributes.position.count;i++){const t=Math.max(0,Math.min(1,(Math.abs(g.attributes.position.getZ(i))-.15)/.10));g.attributes.skinIndex.setXYZW(i,0,bone,0,0);g.attributes.skinWeight.setXYZW(i,1-t,t,0,0);}
 return g;
}
