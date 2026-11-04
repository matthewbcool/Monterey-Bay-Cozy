import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
export type JellyPoint=readonly [number,number,number];
/** Build-time indexed strips; every anatomy system remains named before sharing one render batch. */
export function jellySurface(){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],parts:{name:string;start:number;count:number}[]=[];
 const vertex=(p:JellyPoint,color:Color)=>{positions.push(...p);colors.push(color.r,color.g,color.b);return positions.length/3-1;};
 const triangle=(a:number,b:number,c:number)=>indices.push(a,b,c);
 function strip(name:string,rows:readonly (readonly JellyPoint[])[],palette:readonly Color[]){
  const start=indices.length,base=positions.length/3,width=rows[0].length;
  for(let r=0;r<rows.length;r++)for(let c=0;c<width;c++){
   vertex(rows[r][c],palette[Math.min(c,palette.length-1)]);
   if(r<rows.length-1&&c<width-1){const a=base+r*width+c;triangle(a,a+width,a+1);triangle(a+1,a+width,a+width+1);}
  }
  parts.push({name,start,count:indices.length-start});
 }
 function build(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.userData.components=parts;return g;}
 return {vertex,triangle,strip,build};
}
