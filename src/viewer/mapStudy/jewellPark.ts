/** Jewell Park: OSM footprint/gazebo/bench pins; city inventory types, authored dimensions. */
import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, Group } from 'three';
import data from '../../data/pacific-grove-waterfront.json';
import { box, mat, mesh, beam, roof, windowGrid } from '../../models/locations/pacificGroveMuseum/helpers';
import { insidePolygon, type GymCollider, type GymPoint } from '../avatarController';
export const JEWELL_BUILDING_ID='way/558769043';
export const JEWELL_PARK={name:'Jewell Park',osmId:'way/36809611',gazeboId:'node/8156311269',gazebo:[1.78,373.99],seed:241025,
 sources:{inventory:'https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Parks%20Maintenance/Parks%20Inventory.pdf',visit:'https://www.pgmuseum.org/plan-your-visit'},
 limits:'OSM boundary, gazebo and one bench are mapped. Dimensions, other furniture, trees and construction are illustrative; city inventory is historical.'} as const;
const outline=data.polygons.find(p=>p.name==='Jewel Park')!.points.map(p=>[p[0],p[1]] as GymPoint);
export const inJewellPark=(x:number,z:number)=>insidePolygon(x,z,outline);
export function addJewellPark(source:Group,height:(x:number,z:number)=>number,colliders:GymCollider[],obstacles:{minX:number;maxX:number;minZ:number;maxZ:number;top:number}[]){
 const white=mat('#e7e5cc'),roofPaint=mat('#718c78'),wood=mat('#927552'),stone=mat('#afa994'),dark=mat('#556d6d'),leaf=mat('#82976c'),bark=mat('#7e6c53');
 const gazebo=new Group(),gx=JEWELL_PARK.gazebo[0],gz=JEWELL_PARK.gazebo[1],gy=height(gx,gz)+.22;gazebo.position.set(gx,gy,gz);source.add(gazebo);
 mesh(gazebo,'Jewell gazebo supported octagonal platform',new CylinderGeometry(3.5,3.7,.8,8),stone,0,-.3,0);
 mesh(gazebo,'Jewell gazebo eight-sided roof',new ConeGeometry(4.3,1.6,8),roofPaint,0,3.6,0);
 mesh(gazebo,'Gazebo finial',new ConeGeometry(.15,.5,8),white,0,4.65,0);
 for(let i=0;i<8;i++){const a=(i+.5)/8*Math.PI*2,b=(i+1.5)/8*Math.PI*2,x=Math.sin(a)*3.1,z=Math.cos(a)*3.1,xx=Math.sin(b)*3.1,zz=Math.cos(b)*3.1;
  box(gazebo,'White gazebo post',[.15,2.9,.15],white,[x,1.45,z]);beam(gazebo,'Gazebo eave fascia',[x,2.85,z],[xx,2.85,zz],.2,white);
  colliders.push({kind:'circle',x:gx+x,z:gz+z,radius:.16});
  if(i===0||i===4)continue;
  beam(gazebo,'Gazebo rail',[x,1,z],[xx,1,zz],.09,white);for(let n=1;n<5;n++)beam(gazebo,'Gazebo baluster',[x+(xx-x)*n/5,.15,z+(zz-z)*n/5],[x+(xx-x)*n/5,1,z+(zz-z)*n/5],.05,white);
 }
 // Existing OSM Little House/toilet footprint is replaced rather than overlaid.
 const house=data.buildings.find(b=>b.id===JEWELL_BUILDING_ID)!,ring=house.rings[0],base=Math.max(...ring.map(p=>height(p[0],p[1])));
 const building=new Group();building.position.set(12,base,348.5);building.rotation.y=-.335;source.add(building);
 box(building,'Little House foundation',[9.3,1.6,10.5],stone,[0,-.8,0]);box(building,'Little House walls',[9.3,3.1,10.5],white,[0,1.55,0]);
 roof(building,'Little House roof study',-4.9,-5.5,4.9,5.5,3.15,1.15,roofPaint,dark);
 box(building,'Little House public doorway',[1.3,2.2,.08],dark,[0,1.1,5.29]);for(const x of [-2.8,2.8])windowGrid(building,x,1.9,5.30,1.5,1.3,wood,dark);
 box(building,'Little House patio cover',[9.3,.16,2.5],roofPaint,[0,2.8,6.3]);for(const x of [-4.2,4.2])box(building,'Patio support',[.15,2.8,.15],white,[x,1.4,7.3]);
 const bb={minX:5,maxX:19,minZ:341,maxZ:356};colliders.push({kind:'box',...bb});obstacles.push({...bb,top:base+4.4},{minX:gx-4.3,maxX:gx+4.3,minZ:gz-4.3,maxZ:gz+4.3,top:gy+4.9});
 const benches=[[-8.79,367.22],[-23,374],[-27,359],[-15,335],[10,362],[-9,382],[-2,345]];
 for(const [x,z]of benches){const g=new Group();g.position.set(x,height(x,z),z);g.rotation.y=Math.atan2(gx-x,gz-z);source.add(g);box(g,'Jewell bench seat',[1.8,.1,.5],wood,[0,.48,0]);box(g,'Jewell bench back',[1.8,.38,.08],wood,[0,.83,-.22]);for(const dx of [-.65,.65]){box(g,'Bench foot',[.1,.5,.4],dark,[dx,.25,0]);box(g,'Bench back support',[.08,.5,.08],dark,[dx,.7,-.22]);}colliders.push({kind:'circle',x,z,radius:.95});}
 for(const [x,z]of [[-30,379],[7,358]])for(let i=0;i<2;i++){const xx=x+i*.85;box(source,i?'Jewell recycling container':'Jewell litter bin',[.6,.8,.6],i?roofPaint:wood,[xx,height(xx,z)+.4,z]);colliders.push({kind:'circle',x:xx,z,radius:.4});}
 // Keep openings at the Central/Forest entrances. Fence follows only bounded spans.
 for(const [a,b]of [[[-37,383],[-25,386]],[[-22,386],[-12,387]],[[-8,387],[1,384]],[[6,339],[18,343]]] as [number[],number[]][]){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let i=0;i<n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,xx=a[0]+(b[0]-a[0])*(i+1)/n,zz=a[1]+(b[1]-a[1])*(i+1)/n;box(source,'Jewell low stone boundary',[.3,.45,Math.hypot(xx-x,zz-z)],stone,[(x+xx)/2,height((x+xx)/2,(z+zz)/2)+.225,(z+zz)/2]).rotation.y=Math.atan2(xx-x,zz-z);box(source,'Jewell wood fence post',[.12,1,.12],wood,[x,height(x,z)+.5,z]);beam(source,'Jewell boundary rail',[x,height(x,z)+.9,z],[xx,height(xx,zz)+.9,zz],.085,wood);}}
 let seed=JEWELL_PARK.seed as number;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const trees=[[-25,367],[-21,345],[-15,328],[1.26,337.07],[15,340],[-31,378],[-12,377],[-5,350]];
 for(const [x,z]of trees){const y=height(x,z),h=5+rand()*2;beam(source,'Jewell specimen tree trunk',[x,y,z],[x+.15,y+h,z],.32,bark);for(let i=0;i<3;i++){const canopy=mesh(source,'Jewell tree canopy',new IcosahedronGeometry(1,0),leaf,x+(i-1)*1.2,y+h+i*.3,z+(rand()-.5));canopy.scale.set(2.3,1.1,2);}colliders.push({kind:'circle',x,z,radius:.38});}
 const lx=-11,lz=357,ly=height(lx,lz);beam(source,'Jewell park lamp',[lx,ly,lz],[lx,ly+3.7,lz],.11,dark);box(source,'Park lantern',[.4,.6,.4],white,[lx,ly+3.8,lz]);
 return {source:JEWELL_PARK,benches:benches.length,trees:trees.length,bins:4,gazebo:{x:gx,y:gy,z:gz},buildingId:JEWELL_BUILDING_ID};
}
