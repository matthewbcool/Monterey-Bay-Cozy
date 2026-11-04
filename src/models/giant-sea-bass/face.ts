import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, Raycaster, TubeGeometry, Vector3 } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { FishDesign } from '../shared/fish/design';
import { buildFishEyes } from '../shared/fish/face';
import { flankAt, skinGeometry, solidColor } from '../shared/fish/geometry';

/** Broad opercular rim and fleshy, tapered lips fitted to the actual body facets. */
export function buildSeaBassFace(a:ModelAssembly,d:FishDesign,material:MeshToonMaterial,length:number){
  buildFishEyes(a,d,material,length,'#b0ad85');
  const group=a.addPart('jaw-and-gills'),body=a.parts.get('body')!.children[0] as Mesh,ray=new Raycaster();
  a.root.updateMatrixWorld(true);
  const surfaceZ=(x:number,y:number,side:number)=>{
    ray.set(new Vector3(x*length,y*length,side*length),new Vector3(0,0,-side));
    return (ray.intersectObject(body)[0]?.point.z??flankAt(d.profile,x,y,side)*length)/length;
  };
  function add(g:BufferGeometry,color:string,name:string){
    solidColor(g,color);skinGeometry(g,0);g.scale(length,length,length);a.addMesh(group,g,material,name);
  }
  for(const side of [-1,1]){
    const gx=d.gillX,curve=new CatmullRomCurve3([
      [gx-.070,.098],[gx+.005,.080],[gx+.024,.026],[gx+.004,-.030],
      [gx-.035,-.087],[gx-.105,-.100],[gx-.151,-.084],
    ].map(([x,y])=>new Vector3(x,y,0)));
    const positions:number[]=[],indices:number[]=[],segments=20;
    for(let i=0;i<=segments;i++){
      const t=i/segments,p=curve.getPoint(t),tangent=curve.getTangent(t),width=.0005+.003*Math.sin(Math.PI*t);
      for(const edge of [-1,1]){
        const x=p.x-tangent.y*width*edge,y=p.y+tangent.x*width*edge;
        positions.push(x,y,surfaceZ(x,y,side)+side*.003);
      }
      if(i<segments){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    if(g.attributes.normal.getZ(2)*side<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];g.setIndex(indices);g.computeVertexNormals();}
    add(g,'#566963',`gill-cover-${side}`);
  }
  const mouth=[[-.403,-.087],[-.455,-.066],[-.487,-.044]];
  const across=[...mouth.map(([x,y])=>new Vector3(x,y,-Math.abs(surfaceZ(x,y,1)))),new Vector3(-.494,-.041,0),...[...mouth].reverse().map(([x,y])=>new Vector3(x,y,Math.abs(surfaceZ(x,y,1))))];
  function lip(dy:number,dx:number,radius:number,segments:number,sides:number,color:string,label:string){
    const curve=new CatmullRomCurve3(across.map(p=>p.clone().add(new Vector3(dx,dy,0))));
    const g=new TubeGeometry(curve,segments,radius,sides,false),p=g.attributes.position;
    const vertex=new Vector3(),center=new Vector3(),direction=new Vector3();
    for(let i=0;i<p.count;i++){
      const t=Math.floor(i/(sides+1))/segments,c=curve.getPointAt(t);
      // Taper into the cheek at both mouth corners, instead of ending in blunt pipes.
      vertex.fromBufferAttribute(p,i).sub(c).multiplyScalar(.15+.85*Math.sin(Math.PI*t)**.6).add(c);
      center.set(-.30,vertex.y,0);direction.copy(vertex).sub(center).normalize();
      ray.set(center.clone().add(direction).multiplyScalar(length),direction.clone().negate());
      const hit=ray.intersectObject(body)[0];
      if(hit){
        const distance=hit.point.divideScalar(length).distanceTo(center)+.0008;
        if(vertex.distanceTo(center)<distance)vertex.copy(center).addScaledVector(direction,distance);
      }
      // Include the projecting lower lip inside the exact snout-to-tail length.
      p.setXYZ(i,Math.max(-.5,vertex.x),vertex.y,vertex.z);
    }
    g.computeVertexNormals();add(g,color,label);
  }
  lip(0,-.001,.0033,10,3,'#354743','closed-mouth');
  lip(.005,.001,.0045,10,4,'#9da99b','upper-lip');
  lip(-.011,-.004,.0095,12,4,'#b7beab','lower-lip');
}
