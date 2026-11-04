import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, TubeGeometry, Vector3 } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { FishDesign } from '../shared/fish/design';
import { buildFishEyes } from '../shared/fish/face';
import { bellyAt, flankAt, sectionAt, skinGeometry, solidColor } from '../shared/fish/geometry';

/** Five separate gill slits and a ventral U-mouth, rather than a bony fish's gill cover. */
export function buildSharkFace(a:ModelAssembly,d:FishDesign,material:MeshToonMaterial,length:number) {
  buildFishEyes(a,d,material,length,'#273a39');
  const marks=a.addPart('gills-mouth-nares');
  function line(points:Vector3[],segments:number,radius:number,name:string) {
    const g=new TubeGeometry(new CatmullRomCurve3(points),segments,radius,3,false);
    solidColor(g,'#344944');skinGeometry(g,0);g.scale(length,length,length);a.addMesh(marks,g,material,name);
  }
  for(const side of [-1,1]) {
    for(let i=0;i<5;i++) {
      const x=-.319+i*.022,p=sectionAt(d.profile,x);
      const positions:number[]=[],indices:number[]=[];
      // Thin conforming ribbons make a slit rather than a raised, constant-width cord.
      for(let j=0;j<=5;j++) {
        const t=j/5,h=(.66-i*.035)*(1-t)+(-.55+i*.025)*t;
        const center=x+.013*Math.sin(Math.PI*t),y=p.y+p.depth*h;
        const halfWidth=.0002+.0015*Math.sin(Math.PI*t)**.7;
        for(const edge of [-1,1]) {
          const gx=center+edge*halfWidth;
          positions.push(gx,y,flankAt(d.profile,gx,y,side)+side*.001);
        }
        if(j<5){const a=j*2;if(side===1)indices.push(a,a+2,a+1,a+1,a+2,a+3);else indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
      solidColor(g,'#485752');skinGeometry(g,0);g.scale(length,length,length);a.addMesh(marks,g,material,`gill-${side}-${i+1}`);
    }
    line([-.456,-.444].map(x=>new Vector3(x,-.005,flankAt(d.profile,x,-.005,side))),2,.001,`nostril-${side}`);
  }
  const mouth=Array.from({length:13},(_,i)=>{
    const t=(i-6)/6,z=t*.057,x=-.442+.095*t*t;
    return new Vector3(x,bellyAt(d.profile,x,z)-.002,z);
  });
  line(mouth,12,.0015,'ventral-mouth');
}
