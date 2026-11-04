import { Box3, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import { mat, mesh } from '../../props/primitives';
import { finishStaticAsset } from '../../shared/staticAsset';
import { mulberry32 } from '../../shared/random';
import { defineGeometryLods } from '../../shared/lod/geometry';

/** Original, deliberately sparse silhouettes; dimensions are selected specimens, not maxima.
 * The last four entries represent introduced inventory trees, never native substitutes. */
export const TREE_SPECIES = {
  'monterey-cypress': {name:'Monterey cypress',botanical:'Hesperocyparis macrocarpa',native:true,height:8,bark:'#736655',leaf:'#587b4d',form:'cypress',url:'https://ask.ifas.ufl.edu/publication/ST224'},
  'monterey-pine': {name:'Monterey pine',botanical:'Pinus radiata',native:true,height:9,bark:'#785540',leaf:'#4d7552',form:'pine',url:'https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_pira2.pdf'},
  'coast-live-oak': {name:'Coast live oak',botanical:'Quercus agrifolia',native:true,height:6,bark:'#706657',leaf:'#6c814b',form:'oak',url:'https://research.fs.usda.gov/feis/species-reviews/queagr'},
  'pohutukawa': {name:'Pōhutukawa',botanical:'Metrosideros excelsus',native:false,height:5,bark:'#75675d',leaf:'#4d7562',form:'oak',url:'https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0'},
  'canary-island-date-palm': {name:'Canary Island date palm',botanical:'Phoenix canariensis',native:false,height:8,bark:'#8a7760',leaf:'#718957',form:'palm',url:'https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0'},
  'cabbage-tree': {name:'Cabbage tree',botanical:'Cordyline australis',native:false,height:4,bark:'#85755e',leaf:'#819460',form:'cordyline',url:'https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0'},
  'inventory-holly': {name:'Holly · inventory proxy',botanical:'Ilex spp.',native:false,height:3,bark:'#796958',leaf:'#54815c',form:'holly',url:'https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0'},
} as const;
export type TreeSpecies = keyof typeof TREE_SPECIES;
export interface CoastalTreeOptions {species:TreeSpecies;seed?:number;heightMetres?:number;}

/** One opaque vertex-colour batch. No leaf cards, textures, alpha sorting, animation or frame work.
 * All LODs use the same seeded branch/crown centres; only radial tessellation changes. */
function build(species:TreeSpecies,seed:number,height:number,level:0|1|2) {
  const record=TREE_SPECIES[species],random=mulberry32(seed),root=new Group();
  const bark=mat(record.bark),leaf=mat(record.leaf),sunLeaf=mat(record.leaf);sunLeaf.color.multiplyScalar(1.12);
  const sides=[6,4,3][level],width=[8,6,4][level],rings=[3,3,2][level];
  const up=new Vector3(0,1,0);
  function branch(a:number[],b:number[],radius:number,tip:number,cap=false){
    const start=new Vector3(...a),end=new Vector3(...b),delta=end.clone().sub(start);
    const m=mesh(root,'Exposed tapered branch',new CylinderGeometry(tip,radius,delta.length(),sides,1,!cap),bark);
    m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,delta.normalize());
  }
  const palm=record.form==='palm'||record.form==='cordyline';
  if(palm){
    const top=record.form==='palm'?.78:.68;
    branch([0,0,0],[.025,top,0],record.form==='palm'?.047:.025,.022,true);
    // Closed diamond-section fronds, not alpha cards. Eight triangles each at every tier.
    const fronds=[10,7,5][level];
    for(let i=0;i<fronds;i++){
      const a=i*Math.PI*2/fronds,reach=record.form==='palm'?.40:.27,lift=i%2?.09:.20,drop=record.form==='palm'?.05:-.05;
      const points=[[.025,top,0],[Math.cos(a)*reach*.55,top+lift,Math.sin(a)*reach*.55],[Math.cos(a)*reach,top-drop,Math.sin(a)*reach]];
      const vertices:number[]=[];const w=.055,dx=Math.cos(a+Math.PI/2)*w,dz=Math.sin(a+Math.PI/2)*w;
      const b=points[1],left=[b[0]+dx,b[1],b[2]+dz],right=[b[0]-dx,b[1],b[2]-dz],ridge=[b[0],b[1]+.025,b[2]],under=[b[0],b[1]-.015,b[2]];
      for(const [p,q,r]of [[points[0],left,ridge],[points[0],ridge,right],[left,points[2],ridge],[ridge,points[2],right],[points[0],under,left],[points[0],right,under],[left,under,points[2]],[under,right,points[2]]])vertices.push(...p,...q,...r);
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();mesh(root,'Solid arching frond',g,i%2?leaf:sunLeaf);
    }
  }else{
    const cypress=record.form==='cypress',pine=record.form==='pine',holly=record.form==='holly';
    const lean=cypress?.08:.025,trunkTop=pine?.78:holly?.6:cypress?.56:.48;
    branch([0,0,0],[lean,trunkTop,0],cypress?.025:.048,.019,true);
    const count=record.form==='oak'?5:4;
    for(let i=0;i<count;i++){
      const a=i*2.399+random()*.2,jitter=.92+random()*.16;
      const reach=(pine?.16:cypress?.22:holly?.10:.23)*jitter;
      const x=lean+Math.cos(a)*reach,z=Math.sin(a)*reach;
      const y=pine?.52+i*.125:cypress?.60+i*.078:holly?.49+i*.10:.52+i*.07;
      branch([lean*.65,pine?y-.18:trunkTop*.7,0],[x,y,z],cypress?.016:.023,cypress?.006:.009);
      const crown=mesh(root,'Opaque clustered crown',new SphereGeometry(1,width,rings),i%2?leaf:sunLeaf,x,y,z);
      const r=pine?.24-i*.025:holly?.22:.30;
      crown.scale.set(r*jitter,cypress?.115:pine?.12:holly?.23:.24,r*(.9+random()*.15));crown.rotation.y=a;
    }
  }
  // Normalize authored proportions in geometry, never the public root. Feet remain at Y=0.
  root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root),s=height/(bounds.max.y-bounds.min.y);
  for(const child of root.children)child.position.y-=bounds.min.y;
  finishStaticAsset(root,species,[s,s,s],{rim:false});
  return root;
}
export function createCoastalTree({species,seed=Math.floor(Math.random()*0xffffffff),heightMetres=TREE_SPECIES[species].height}:CoastalTreeOptions) {
  if(!Number.isFinite(heightMetres)||heightMetres<=0)throw new Error('Tree height must be positive metres');
  const root=build(species,seed,heightMetres,0),source=(root.children[0] as Mesh).geometry;
  defineGeometryLods(source,()=>{
    const variant=(level:1|2)=>{const group=build(species,seed,heightMetres,level),mesh=group.children[0] as Mesh;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();return mesh.geometry;};
    return {mid:variant(1),far:variant(2)};
  });
  root.name=TREE_SPECIES[species].name;
  Object.assign(root.userData,{seed,species,botanical:TREE_SPECIES[species].botanical,native:TREE_SPECIES[species].native,heightMetres,trunkRadiusMetres:heightMetres*(species==='monterey-cypress'?.03:.06),states:['static'],sizeBasis:'Authored representative specimen, not a measured tree'});
  return root;
}
