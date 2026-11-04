/** City gallery silhouettes on cached OSM beds. Dimensions/orientation are estimates,
 * not a playground survey or an accessibility certification. Static, batched scenery. */
import { Box3, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Material, Vector3 } from 'three';
import data from '../../data/caledonia-park.json';
import { box, mat, mesh } from '../../models/props/primitives';
import { beam, polygon } from '../../models/locations/pacificGroveMuseum/helpers';
import type { GymCollider, GymPoint } from '../avatarController';

type Floor = (x: number, z: number) => number;
export type ParkEquipment = {
  name: string; sourceBed: string | null; footprint: GymPoint[];
  minX: number; maxX: number; minZ: number; maxZ: number; top: number;
};
const heading = -Math.atan2(.436, .9);
const beds = data.features.filter(f => f.kind === 'playground');

export function addCaledoniaPlaygrounds(source: Group, floorAt: Floor) {
  const blue = mat('#355f90'), red = mat('#b95b51'), yellow = mat('#dfbe68');
  const deck = mat('#72766b'), timber = mat('#a99d81'), cream = mat('#d7bc83');
  const equipment: ParkEquipment[] = [], colliders: GymCollider[] = [];
  const flightObstacles: ParkEquipment[] = [];
  const world = new Vector3();

  function placed(name: string, x: number, z: number, angle = heading) {
    const group = new Group(); group.name = name;
    group.position.set(x, floorAt(x, z), z); group.rotation.y = angle;
    source.add(group); group.updateMatrixWorld(true); return group;
  }
  function localFloor(g: Group, x: number, z: number) {
    world.set(x, 0, z).applyMatrix4(g.matrixWorld);
    return floorAt(world.x, world.z) - g.position.y;
  }
  function post(g: Group, x: number, z: number, top: number, material = blue, width = .09) {
    beam(g, 'Play support grounded in woodchips', [x, localFloor(g, x, z) - .08, z], [x, top, z], width, material);
  }
  // Geometry bounds drive conservative, rotated footprints; physics does not depend on LOD.
  function finish(g: Group, sourceBed: string | null) {
    const local = new Box3();
    // Sample in the assembly's local frame to retain its rotated footprint.
    const inverse = g.matrixWorld.clone().invert();
    g.traverse(child => {
      if (!('geometry' in child)) return;
      const object = child as import('three').Mesh;
      const p = object.geometry.getAttribute('position'); object.updateWorldMatrix(true, false);
      for (let i = 0; i < p.count; i++) local.expandByPoint(world.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld).applyMatrix4(inverse));
    });
    const footprint: GymPoint[] = [[local.min.x, local.min.z], [local.max.x, local.min.z], [local.max.x, local.max.z], [local.min.x, local.max.z]].map(([x,z]) => {
      world.set(x, 0, z).applyMatrix4(g.matrixWorld); return [world.x, world.z];
    });
    const bounds = new Box3().setFromObject(g);
    const record = { name: g.name, sourceBed, footprint, minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, top: bounds.max.y };
    equipment.push(record); flightObstacles.push(record); colliders.push({ kind: 'box', ...record });
  }
  function rail(g: Group, a: number[], b: number[], material = yellow) {
    beam(g, 'Play handrail', a, b, .055, material);
  }
  function platform(g: Group, x: number, z: number, height: number, w = 1.6) {
    box(g, 'Raised play deck', [w, .12, w], deck, [x, height, z]);
    for (const dx of [-w/2, w/2]) for (const dz of [-w/2, w/2]) post(g, x+dx, z+dz, height+1.08);
  }
  function guard(g: Group, x: number, z: number, height: number, length: number, material = yellow) {
    rail(g, [x-length/2,height+.82,z], [x+length/2,height+.82,z], material);
    for (let i=0;i<=4;i++) rail(g,[x-length/2+i*length/4,height+.08,z],[x-length/2+i*length/4,height+.82,z],material);
  }
  function ladder(g: Group, x: number, z: number, height: number, material = red) {
    const bottom=localFloor(g,x,z-1.25)+.08;
    for(const dx of [-.44,.44])rail(g,[x+dx,bottom,z-1.25],[x+dx,height+.75,z],material);
    for(let i=0;i<5;i++){const t=i/4;rail(g,[x-.44,bottom+(height-bottom)*t,z-1.25+1.25*t],[x+.44,bottom+(height-bottom)*t,z-1.25+1.25*t],material);}
  }
  /** Closed six-station trough: colored side lips and a curved runout, no alpha or tubes. */
  function slide(g: Group, x: number, z: number, height: number, length: number, material: Material, width=.65, curve=0) {
    const profile=[[0,1],[.15,.98],[.35,.73],[.58,.3],[.8,.04],[1,0]];
    const bottom=localFloor(g,x+curve,z+length)+.08;
    const section=[[-width/2-.06,.18],[-width/2,.18],[-width/2,0],[width/2,0],[width/2,.18],[width/2+.06,.18],[width/2+.06,-.06],[-width/2-.06,-.06]];
    const vertices:number[]=[],indices:number[]=[];
    for(const [t,h] of profile)for(const [sx,sy] of section)vertices.push(x+curve*t*t+sx,bottom+(height-bottom)*h+sy,z+length*t);
    for(let i=0;i<profile.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}
    // Section is concave. Four rectangles close each end without spanning the open trough.
    for(const row of [0,40])for(const [a,b,c,d]of [[0,1,2,7],[2,3,6,7],[3,4,5,6]]){if(row===0)indices.push(row+a,row+c,row+b,row+a,row+d,row+c);else indices.push(row+a,row+b,row+c,row+a,row+c,row+d);}
    for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    mesh(g,'Molded slide with raised side lips',geometry,material);
  }
  function roof(g: Group, x: number, z: number, eave: number) {
    for(const s of [-1,1]){
      const top=[[x,eave+.6,z-1],[x+s*1.05,eave,z-1],[x+s*1.05,eave,z+1],[x,eave+.6,z+1]];
      const under=[[x,eave+.55,z+1],[x+s*1.05,eave-.05,z+1],[x+s*1.05,eave-.05,z-1],[x,eave+.55,z-1]];
      polygon(g,'Red playhouse roof',s>0?top.reverse():top,red);
      polygon(g,'Roof underside',s>0?under.reverse():under,red);
    }
    for(const dz of [-1,1]){const points=[[x-1.05,eave,z+dz],[x+1.05,eave,z+dz],[x,eave+.6,z+dz]];polygon(g,'Playhouse gable',dz<0?points.reverse():points,red);}
  }

  // Timber follows the same triangular ground sampler as walking. Shared bed edge is emitted once.
  // Retain the mapped footway contact on the smaller bed; the larger west opening is inferred.
  const emitted = new Set<string>(), entrances: GymPoint[]=[];
  for(const bed of beds){
    const edges=bed.points.map((a,i)=>({a,b:bed.points[(i+1)%bed.points.length]}));
    const mappedEntry=bed.points.find(p=>data.paths.some(path=>path.kind==='footway'&&path.points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.02)));
    if(mappedEntry)entrances.push([mappedEntry[0],mappedEntry[1]]);
    const entry=edges.filter(e=>Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1])>7&&Math.abs(e.a[1]-e.b[1])>Math.abs(e.a[0]-e.b[0])).sort((a,b)=>(a.a[0]+a.b[0])-(b.a[0]+b.b[0]))[0];
    for(const edge of edges){
      const {a,b}=edge,key=[a.join(','),b.join(',')].sort().join('|');if(emitted.has(key))continue;emitted.add(key);
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/3);
      const spans=mappedEntry?[[a===mappedEntry?1/length:0,b===mappedEntry?1-1/length:1]]:edge===entry?[[0,.5-1/length],[.5+1/length,1]]:[[0,1]];
      if(!mappedEntry&&edge===entry)entrances.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);
      for(const [start,end]of spans)for(let j=0;j<n;j++){
        const point=(t:number)=>{const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return [x,floorAt(x,z)+.09,z];};
        beam(source,'Weathered timber playground edging',point(start+(end-start)*j/n),point(start+(end-start)*(j+1)/n),.18,timber);
      }
    }
  }

  // Photo 1: blue uprights, red climbing ladder, yellow panels and disc climber.
  const older=placed('Blue-post climbing playground',-248.8,220);
  platform(older,0,0,1.5);platform(older,0,-3.2,1.25);
  box(older,'Connecting play bridge',[1.25,.12,1.6],deck,[0,1.38,-1.6]);
  for(const x of [-.68,.68])rail(older,[x,2.15,-2.4],[x,2.4,-.8]);
  for(const z of [-3.2,0])guard(older,0,z-.8,z===0?1.5:1.25,1.6,red);
  box(older,'Yellow activity panel',[.08,.75,1.4],yellow,[.82,1.95,0]);
  ladder(older,-2,-3.2,1.25);box(older,'Climber landing',[1.3,.12,1.2],deck,[-1.3,1.25,-3.2]);
  for(const x of [-2.1,-.8])post(older,x,-3.8,2.35);
  slide(older,0,.8,1.5,3.3,yellow,.75,.55);
  post(older,2,-2,2.65,yellow,.11);
  for(let i=0;i<6;i++){const angle=i*1.7;mesh(older,'Alternating yellow climbing disc',new CylinderGeometry(.25,.25,.09,6),yellow,2+Math.cos(angle)*.22,.3+i*.34,-2+Math.sin(angle)*.22);}
  finish(older,'way/633507464');

  // Photos 2/3/5: tan house, red gable, dark blue slides and yellow access rails.
  const house=placed('Red-roof playhouse and blue slide',-260,237);
  platform(house,0,0,.95);
  for(const x of [-.78,.78]){
    box(house,'Tan playhouse wall',[.08,1.15,1.55],cream,[x,1.57,0]);
    box(house,'Recessed playhouse window',[.095,.34,.28],deck,[x,1.82,-.25]);
  }
  roof(house,0,0,2.2);slide(house,0,.8,.95,2.7,blue,.68,-.45);
  ladder(house,0,-.8,.95,yellow);finish(house,'way/633507463');

  const junior=placed('Junior blue slide and yellow handrails',-263.7,239);
  platform(junior,0,0,1.15,1.25);guard(junior,0,-.63,1.15,1.25);
  ladder(junior,-1.1,-.6,1.15,yellow);slide(junior,0,.63,1.15,2.6,blue,.62,.35);
  box(junior,'Red curved-style safety panel',[.1,.85,1.25],red,[.68,1.65,0]);finish(junior,'way/633507463');

  const tot=placed('Low twin toddler slide',-247,210);
  platform(tot,0,0,.65,1.35);
  for(const x of [-.36,.36])slide(tot,x,.7,.65,1.7,yellow,.47);
  for(let i=0;i<3;i++)box(tot,'Toddler access step',[.8,.16, .35],deck,[0,.16*(i+1),-1.35+i*.3]);
  guard(tot,0,-.67,.65,1.35,red);finish(tot,'way/633507464');

  const rider=placed('Low spring rider',-256.9,235.8);
  // A few angular loops read as a spring without the hundreds of triangles of a tube.
  for(let i=0;i<8;i++){const a=i*Math.PI/2,b=(i+1)*Math.PI/2;beam(rider,'Spring coil',[Math.cos(a)*.1,.12+i*.045,Math.sin(a)*.1],[Math.cos(b)*.1,.12+(i+1)*.045,Math.sin(b)*.1],.035,red);}
  box(rider,'Spring rider seat',[.32,.09,.75],blue,[0,.55,0]);
  for(const z of [-.23,.23])rail(rider,[-.24,.79,z],[.24,.79,z],blue);
  rail(rider,[0,.55,-.23],[0,.79,-.23],blue);finish(rider,'way/633507463');

  // The city confirms picnic tables; these two positions are provisional, outside the play beds.
  for(const [x,z]of [[-246,191],[-241,180]]){
    const table=placed('Lawn picnic table',x,z);
    box(table,'Picnic tabletop',[1.8,.09,.75],timber,[0,.77,0]);
    for(const s of [-1,1]){
      box(table,'Picnic bench',[1.8,.09,.28],timber,[0,.45,s*.64]);
      for(const dx of [-.62,.62])beam(table,'Picnic trestle',[dx,localFloor(table,dx,s*.65),s*.65],[dx,.73,s*.23],.07,deck);
    }
    finish(table,null);
  }
  return {equipment,colliders,flightObstacles,entrances};
}
