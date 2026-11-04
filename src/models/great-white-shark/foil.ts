import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { skinGeometry } from '../shared/fish/geometry';

export type FinPoint = readonly [number,number,number];
export interface FinSection { leading:FinPoint; trailing:FinPoint; thickness:number }

/** Six vertices per airfoil section, a sealed root and one tip. Thickness tapers along the span. */
export function createSharkFoil(sections:readonly FinSection[],tip:FinPoint,axis:'y'|'z',colors:readonly [string,string],bone?:number) {
  const positions:number[]=[],palette:number[]=[],indices:number[]=[];
  const top=new Color(colors[0]),bottom=new Color(colors[1]);
  const chord=[0,.25,.65,1,.65,.25];
  for(const section of sections)for(let j=0;j<6;j++) {
    const t=chord[j],p=new Vector3(...section.leading).lerp(new Vector3(...section.trailing),t);
    p[axis]+=(j<4?1:-1)*section.thickness*Math.sin(Math.PI*t)**.7;
    positions.push(...p.toArray());
    const c=j===0||j===3?top.clone().lerp(bottom,.5):j<4?top:bottom;palette.push(c.r,c.g,c.b);
  }
  for(let r=0;r<sections.length-1;r++)for(let j=0;j<6;j++) {
    const a=r*6+j,b=r*6+(j+1)%6,c=a+6,d=b+6;indices.push(a,b,c,b,d,c);
  }
  const root=positions.length/3,p=new Vector3(...sections[0].leading).lerp(new Vector3(...sections[0].trailing),.5);
  positions.push(...p.toArray(),...tip);palette.push(top.r,top.g,top.b,top.r,top.g,top.b);
  for(let j=0;j<6;j++){indices.push(root,(j+1)%6,j);const a=(sections.length-1)*6+j,b=(sections.length-1)*6+(j+1)%6;indices.push(a,b,root+1);}
  // Mirroring or changing the span axis reverses winding. Keep every closed foil outward.
  const a=new Vector3(),b=new Vector3(),c=new Vector3();let volume=0;
  for(let i=0;i<indices.length;i+=3){a.fromArray(positions,indices[i]*3);b.fromArray(positions,indices[i+1]*3);c.fromArray(positions,indices[i+2]*3);volume+=a.dot(b.cross(c));}
  if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(palette,3));
  g.setIndex(indices);g.computeVertexNormals();skinGeometry(g,bone);
  g.userData.rootSeam=[sections[0].leading,sections[0].trailing];
  return g;
}
