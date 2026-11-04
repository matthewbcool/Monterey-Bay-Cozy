import map from '../../data/lovers-point-gym.json';
import features from '../../data/lovers-point-features.json';
import { insidePolygon, type GymPoint } from '../avatarController';
import { groundHeight } from './elevation';

import { TREE_SCALE_STUDY } from './treeScaleStudy';
import inventory from '../../data/lovers-point-trees.json';
import { TREE_SPECIES, type TreeSpecies } from '../../models/habitat/trees/createCoastalTree';

function segmentDistance(x:number,z:number,a:readonly number[],b:readonly number[]) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
function ringDistance(x:number,z:number,points:readonly (readonly number[])[]) {
  if(insidePolygon(x,z,points as GymPoint[]))return 0;
  return Math.min(...points.map((p,i)=>segmentDistance(x,z,p,points[(i+1)%points.length])));
}
const park=features.polygons.find(p=>p.kind==='park')!.rings.find(r=>r.role==='outer')!.points;
const exclusions=features.polygons.filter(p=>['beach','pool','volleyball','parking','breakwater'].includes(p.kind)).flatMap(p=>p.rings.filter(r=>r.role==='outer').map(r=>r.points));
const links=[[[18,-35],[37,-35]],[[25,-35],[35,-43]],[[64,-20],[71,-26]]] as const;
/** Cross-source diagnostics only. GIS/OSM/DEM disagree at walls and planting strips;
 * report those disagreements instead of silently moving real tree records. */
export function treePlacementIssues(x:number,z:number,height:number):string[] {
  const issues:string[]=[];
  if(!insidePolygon(x,z,park.map(([x,z])=>[x,z] as GymPoint)))issues.push('outside park');
  if(exclusions.some(r=>ringDistance(x,z,r)<1))issues.push('facility/beach');
  if(map.buildings.some(b=>ringDistance(x,z,b.points)<height*.48+.3))issues.push('building crown clearance');
  if(features.paths.some(route=>route.points.some((p,i)=>i>0&&segmentDistance(x,z,route.points[i-1],p)<(['footway','path','pedestrian','steps','cycleway'].includes(route.highway)?1.8:route.highway==='secondary'?4.1:3.1))))issues.push('path/road');
  if(links.some(points=>points.some((p,i)=>i>0&&segmentDistance(x,z,points[i-1],p)<1.5)))issues.push('exercise approach');
  const y=groundHeight(x,z);
  if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>Math.abs(groundHeight(x+dx,z+dz)-y)>.55))issues.push('steep bank');
  return issues;
}
/** Photo-based site heights override the provisional size classes without editing GIS data.
 * DBH is a relative age/size hint only: its source units are unspecified. */
export function resolveParkTrees() {
  return inventory.trees.map(record=>{
    const species=record.species as TreeSpecies;
    const studyHeight=species==='monterey-cypress'?TREE_SCALE_STUDY.heights[record.sourceId]:undefined;
    const height=studyHeight??(species==='monterey-cypress'?(record.dbhSourceValue>45?9:record.dbhSourceValue>20?7:record.dbhSourceValue>8?5:2.8):TREE_SPECIES[species].height);
    const trunkRadius=height*(species==='monterey-cypress'?.03:.06);
    return {...record,species,height,trunkRadius,heightBasis:studyHeight===undefined?'authored size class':'photo-based site estimate',
      heightUncertaintyMetres:studyHeight===undefined?undefined:TREE_SCALE_STUDY.heightUncertaintyMetres,
      original:[record.x,record.z,height] as const,issues:treePlacementIssues(record.x,record.z,height)};
  });
}
export const PARK_TREES=resolveParkTrees();
