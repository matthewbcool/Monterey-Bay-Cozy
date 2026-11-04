/** Shared metre-scale source parts. Scene owners retain placement, collisions and batching. */
import {BufferGeometry,CylinderGeometry,Float32BufferAttribute,Group} from 'three';
import {box,cylinder,mat,mesh} from './primitives';
import {finishStaticAsset} from '../shared/staticAsset';
export const FURNITURE = {
 'park-bench':{name:'Cypress apron bench',label:'1.70 m wide · 0.46 m seat height',triangles:84},
 'park-litter-bin':{name:'Green park litter bin',label:'0.54 m diameter · 0.93 m overall height',triangles:64},
 'cafe-chair':{name:'Terrace café chair',label:'0.43 m wide · 0.46 m seat height',triangles:48},
 'cafe-table':{name:'Round café table',label:'1.06 m diameter · 0.795 m overall height',triangles:48},
 'cafe-parasol':{name:'Terrace parasol',label:'2.50 m canopy diameter · 2.65 m height',triangles:24},
} as const;
export type FurnitureId=keyof typeof FURNITURE;
export const furnitureIds=Object.keys(FURNITURE) as FurnitureId[];
export const FURNITURE_SCALE={'park-bench':[1,1,1],'park-litter-bin':[1,1,1],'cafe-chair':[1,1,1],'cafe-table':[1,1,1],'cafe-parasol':[1,1,1]} as const;
export const FURNITURE_BUDGETS=Object.fromEntries(furnitureIds.map(id=>[id,{triangles:FURNITURE[id].triangles,drawCalls:1}])) as Record<FurnitureId,{triangles:number;drawCalls:number}>;
export const FURNITURE_REFERENCES=Object.fromEntries(furnitureIds.map(id=>[id,{label:FURNITURE[id].label,basis:'Provisional authored dimensions from the existing Lovers Point photo study; not surveyed furniture or a product replica. See docs/asset-catalog-audit.md.',url:null}])) as Record<FurnitureId,{label:string;basis:string;url:null}>;
/** Raw parts use the same primitives as scenery and are consumed by its existing static batch.
 * Callers own every returned material/geometry; never render these before style conversion. */
export function createFurnitureSource(id:FurnitureId,pink=false){
 const root=new Group();root.name=FURNITURE[id].name;
 if(id==='park-bench'){
  const wood=mat('#9a8767'),metal=mat('#465b50');
  for(const z of [-.18,0,.18])box(root,'Cypress apron bench · wood seat slat',[1.7,.07,.14],wood,[0,.46,z]);
  for(const y of [.75,.98])box(root,'Cypress apron bench · back slat',[1.7,.12,.065],wood,[0,y,-.25]);
  for(const x of [-.6,.6])box(root,'Cypress apron bench · support',[.07,.48,.44],metal,[x,.24,0]);
 }else if(id==='park-litter-bin'){
  cylinder(root,'Cypress apron · green litter bin',.27,.87,mat('#465b50'),[0,.435,0]);
  cylinder(root,'Litter bin · recessed dark opening',.22,.06,mat('#253c34'),[0,.90,0]);
 }else if(id==='cafe-chair'){
  const cream=mat('#f2dfc4'),metal=mat('#394f4d');
  box(root,'Grill terrace · chair seat',[.43,.055,.43],cream,[0,.46,0]);
  box(root,'Grill terrace · chair back',[.43,.35,.045],cream,[0,.70,.19]);
  for(const x of [-.17,.17])box(root,'Grill terrace · chair frame',[.04,.44,.36],metal,[x,.22,0]);
 }else if(id==='cafe-table'){
  mesh(root,'Grill terrace · round cafe table',new CylinderGeometry(.53,.53,.07,8),mat('#f2dfc4'),0,.76,0);
  mesh(root,'Grill terrace · table pedestal',new CylinderGeometry(.07,.13,.73,4),mat('#394f4d'),0,.365,0);
 }else{
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,b=(i+1)*Math.PI/4,n=vertices.length/3;
   vertices.push(0,2.65,0,Math.cos(a)*1.25,2.19,Math.sin(a)*1.25,Math.cos(b)*1.25,2.19,Math.sin(b)*1.25);
   vertices.push(...vertices.slice(n*3));indices.push(n,n+2,n+1,n+3,n+4,n+5);
  }
  const canopy=new BufferGeometry();canopy.setAttribute('position',new Float32BufferAttribute(vertices,3));canopy.setIndex(indices);canopy.computeVertexNormals();
  mesh(root,'Grill terrace · eight-panel parasol',canopy,mat(pink?'#e29b9c':'#cd5362'));
  mesh(root,'Grill terrace · parasol pole',new CylinderGeometry(.025,.025,2.6,4,1,true),mat('#f2dfc4'),0,1.3,0);
 }
 return root;
}
export function createFurniture(id:FurnitureId){return finishStaticAsset(createFurnitureSource(id),id,[1,1,1]);}
