import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Only silhouette detail survives at insect scale: three body lobes, antennae and sparse legs.
 * Millimetre design coordinates are baked into metres and rigidly bound to bone 0. */
export function buildMonarchBody(wingspanMeters: number, detail: 'near' | 'mid' | 'far' = 'near') {
  const parts: BufferGeometry[] = [], unit = wingspanMeters / 100;
  function add(g: BufferGeometry, color = '#282a29') {
    g.deleteAttribute('uv'); g.clearGroups(); g.scale(unit, unit, unit);
    const c = new Color(color), count = g.attributes.position.count;
    g.setAttribute('color', new Float32BufferAttribute(Array.from({length:count},()=>c.toArray()).flat(),3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count*4),4));
    const weights = new Float32Array(count*4); for(let i=0;i<count;i++) weights[i*4]=1;
    g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));parts.push(g);
  }
  /** One or two six-sided rings give attached, closed lobes without sphere tessellation. */
  function lobe(start: number, end: number, rings: [number,number,number][], y: number, color?: string) {
    const vertices=[0,y,start], indices:number[]=[];
    for(const [z,rx,ry] of rings) for(let j=0;j<6;j++){
      const angle=j*Math.PI/3;vertices.push(Math.cos(angle)*rx,y+Math.sin(angle)*ry,z);
    }
    const tip=vertices.length/3;vertices.push(0,y,end);
    for(let j=0;j<6;j++){
      const next=(j+1)%6;
      indices.push(0,1+next,1+j);
      for(let r=0;r<rings.length-1;r++){
        const a=1+r*6+j,b=1+r*6+next,c=a+6,d=b+6;indices.push(a,b,c,b,d,c);
      }
      const last=1+(rings.length-1)*6;indices.push(tip,last+j,last+next);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();add(g,color);
  }
  function stem(a: number[], b: number[], radius: number) {
    const start=new Vector3(...a),end=new Vector3(...b),delta=end.clone().sub(start);
    const g=new CylinderGeometry(radius*.7,radius,delta.length(),3,1,true);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g);
  }
  lobe(-13.4,-9,[[-11.2,1.8,1.65]],-.25,'#202625');
  lobe(-10,3,[[-6,2.2,1.9],[.8,2.4,1.9]],-.55);
  lobe(-1.1,16.2,[[3,1.7,1.5],[10,1.25,1.1]],-.85,'#30312b');
  for(const side of [-1,1]){
    const antenna=[[side*.9,.8,-12.5],[side*3,1.2,-18],[side*4.4,1.8,-21.5]];
    if(detail==='far'){stem(antenna[0],antenna[2],.17);continue;}
    for(let i=1;i<antenna.length;i++)stem(antenna[i-1],antenna[i],.17);
    const club=new SphereGeometry(1,4,2);club.scale(.35,.35,.8);club.translate(...antenna[2] as [number,number,number]);add(club);
    const legs=[
      [[side*1,-1,-8],[side*2,-2.5,-10]],
      [[side*1.5,-1,-4],[side*4,-3,-6],[side*5,-5,-8]],
      [[side*1.5,-1,-1],[side*4.5,-3,3],[side*5.7,-5,5.8]],
    ];
    for(const points of legs)for(let i=1;i<points.length;i++)stem(points[i-1],points[i],.22);
  }
  const combined=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  const result=mergeVertices(combined,1e-7);combined.dispose();result.name='monarch-body-antennae-and-legs';return result;
}
