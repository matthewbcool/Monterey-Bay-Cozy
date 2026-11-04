import {BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, Shape, ShapeGeometry, ExtrudeGeometry, Vector2, Path, CylinderGeometry, SphereGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createToonMaterial} from '../shared/style';
import {TANKS,tankOutline,UPPER_FLOOR, type Floor, type Point} from './layout';
export const AQUARIUM_BUDGET={triangles:3500,draws:8};
function polygon(points:readonly Point[],height:number,base=0,holes:readonly Point[][]=[]){
  const shape=new Shape(points.map(([x,bay])=>new Vector2(x,bay)));
  holes.forEach(ring=>shape.holes.push(new Path(ring.map(([x,bay])=>new Vector2(x,bay)))));
  const g=height?new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1}):new ShapeGeometry(shape);
  g.rotateX(-Math.PI/2);g.translate(0,base,0);return g;
}
function box(x:number,bay:number,w:number,d:number,h:number,base:number){return new BoxGeometry(w,h,d).translate(x,base+h/2,-bay);}
function colored(g:BufferGeometry,color:string){
  const geometry=g.index?g.toNonIndexed():g;if(geometry!==g)g.dispose();geometry.deleteAttribute('uv');
  const c=new Color(color),values=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}
  geometry.setAttribute('color',new Float32BufferAttribute(values,3));return geometry;
}
/** Independently reusable procedural model. No renderer, DOM, textures or GLB dependencies. */
export function createAquarium(outer:readonly Point[]){
  const root=new Group();root.name='aquarium-interior';
  const floors=[new Group(),new Group()],shared=new Group();root.add(...floors,shared);
  const parts=new Map<string,{group:Group;transparent:boolean;geometry:BufferGeometry[]}>();
  function add(group:Group,key:string,g:BufferGeometry,color:string,transparent=false){
    if(!parts.has(key))parts.set(key,{group,transparent,geometry:[]});parts.get(key)!.geometry.push(colored(g,color));
  }
  // OSM records roof/atrium holes; the visitor floor is a continuous inferred slab here.
  add(floors[0],'floor0',polygon(outer,.35,-.35),'#c8c8b3');
  // Quiet colored floor zones, plus low partitions: no speculative back-of-house rooms.
  const zones:[number,number,number,number,string][]=[[-53,10,42,30,'#a9bfa9'],[-52,34,28,19,'#a9bfa9'],[-53,54,16,22,'#bac6a1'],[-17,3,18,10,'#bca78b'],[3,7,16,12,'#cfba98'],[25,6,23,10,'#acb7b4'],[30,49,19,26,'#c7c4aa'],[74,26,29,35,'#aeb8cf']];
  for(const [x,z,w,d,c] of zones)add(floors[0],'floor0',box(x,z,w,d,.04,.02),c);
  // Boundary curb, cut away at the public entrance and east-west gallery connections.
  for(let i=1;i<outer.length;i++){
    const a=outer[i-1],b=outer[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.2||Math.min(a[0],b[0])<0&&Math.max(a[0],b[0])>-13&&a[1]<2&&b[1]<2)continue;
    const g=new BoxGeometry(length,.75,.28);g.rotateY(Math.atan2(dz,dx));g.translate((a[0]+b[0])/2,.375,-(a[1]+b[1])/2);add(floors[0],'structure0',g,'#e7dfc7');
  }
  for(const [x,z,w,d,h] of [[-19,4,9,4,2.5],[4,6,10,5,1.1],[25,2,20,.3,1.4],[25,10,20,.3,1.4],[33,50,9,4,1],[75,33,19,.3,1.4]])add(floors[0],'structure0',box(x,z,w,d,h,0),'#d2c6a8');
  // Auditorium seating is instanced in the batch: six broad rows, not individual chairs.
  for(let i=0;i<6;i++)add(floors[0],'structure0',box(25,3.5+i,16,.4,.65,0),'#7c9695');
  // Great Tide Pool is outside the mapped roof outline. Basin extent/depth are estimated.
  add(floors[0],'water0',polygon([[-27,39],[-5,35],[0,48],[-4,65],[-20,65],[-29,53]],.12,-.15),'#478c93');
  // Upper public galleries and 5 m-wide bridge; all elevations and slab edges inferred.
  add(floors[1],'floor1',polygon([[-55,-5],[-25,-5],[-25,31],[-34,31],[-34,15],[-55,15]],.3,UPPER_FLOOR-.3),'#e1d6bb');
  add(floors[1],'floor1',box(8,14,75,5,.3,UPPER_FLOOR-.3),'#e1d6bb');
  add(floors[1],'floor1',polygon([[46,0],[106,0],[106,49],[46,49]],.3,UPPER_FLOOR-.3,[tankOutline(TANKS.find(t=>t.id==='open-sea')!)]),'#e1d6bb');
  for(const bay of [11.4,16.6])add(floors[1],'structure1',box(8,bay,72,.15,.85,UPPER_FLOOR),'#b19c75');
  for(const [x,z] of [[-27,25],[50,14]]){
    add(floors[0],'structure0',box(x,z,2.6,2.6,.1,.02),'#d1a76c');
    add(floors[1],'structure1',box(x,z,2.6,2.6,.1,UPPER_FLOOR+.02),'#d1a76c');
    // Simple elevator/stair core marker, with open visitor approaches.
    add(shared,'cores',box(x+1.6,z,.22,2.6,UPPER_FLOOR+1,0),'#b9bca9');
  }
  for(const t of TANKS){
    const group=t.floors.length===2?shared:floors[t.floors[0]],suffix=t.floors.length===2?'Shared':String(t.floors[0]);
    const points=tankOutline(t);
    add(group,'tank-base'+suffix,polygon(points,.18,t.base),'#38616b');
    add(group,'glass'+suffix,polygon(points,t.size[2]-.18,t.base+.18),t.color,true);
    // Thin top ring gives a readable rim without another material or texture.
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1];
      const g=new BoxGeometry(Math.hypot(dx,dz),.12,.18);g.rotateY(Math.atan2(dz,dx));g.translate((a[0]+b[0])/2,t.base+t.size[2],-(a[1]+b[1])/2);
      add(group,'tank-base'+suffix,g,'#c2d4c5');
    }
  }
  // A reusable 1.7 m scale figure at the entrance; geometry, never a resized scene.
  add(floors[0],'structure0',new CylinderGeometry(.18,.22,1.25,6).translate(-7,.625,-1),'#e5ac71');
  add(floors[0],'structure0',new SphereGeometry(.225,8,5).translate(-7,1.475,-1),'#eed3a0');
  for(const {group,transparent,geometry} of parts.values()){
    const g=mergeGeometries(geometry,false)!;geometry.forEach(p=>p.dispose());
    const material=createToonMaterial({vertexColors:true,rim:false});
    if(transparent){material.transparent=true;material.opacity=.76;material.depthWrite=false;}
    const mesh=new Mesh(g,material);mesh.name=transparent?'tank-envelopes':'architecture-batch';group.add(mesh);
  }
  function setFloor(floor:Floor){floors.forEach((g,i)=>g.visible=i===floor);}
  setFloor(0);
  function stats(){let triangles=0,draws=0;root.traverseVisible(o=>{if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws++;}});return {triangles,draws};}
  return {root,floors,shared,setFloor,stats};
}
