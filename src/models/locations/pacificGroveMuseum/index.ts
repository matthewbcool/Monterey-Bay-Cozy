/** Renderer-independent, metre-scale architectural study. See docs/pacific-grove-museum.md. */
import { Group, Shape, Path, ExtrudeGeometry, ShapeGeometry, Vector2 } from 'three';
import { MUSEUM_SITE, MUSEUM_ROOMS, MUSEUM_WALLS, MUSEUM_UPPER } from '../../../data/pacificGroveMuseum';
import { finishStaticAsset } from '../../shared/staticAsset';
import { disposeObject } from '../../props/primitives';
import { box, mat, mesh, beam, blob, arch, archShape, windowGrid, polygon, roof, finishGeometry } from './helpers';
import polygonClipping from 'polygon-clipping';
import { addMuseumGarden } from './garden';
export type MuseumView = 'exterior'|'ground'|'upper';
export const MUSEUM_BUDGET = {triangles:26000,draws:8};
export function createPacificGroveMuseum(){
  const root=new Group(),site=new Group(),lower=new Group(),high=new Group(),roofs=new Group(),ground=new Group(),upper=new Group();
  const stucco=mat('#e7d6ad'),trim=mat('#cbb892'),tile=mat('#a66f53'),tileEdge=mat('#865e48'),walnut=mat('#71543f'),metal=mat('#455654'),glass=mat('#719396'),cream=mat('#eee2bf'),paving=mat('#c8b897');
  // Plinths extend below the estimated floor; terrain remains underneath, not a floating facade.
  for(const room of MUSEUM_ROOMS){const [x0,z0,x1,z1]=room.rect;box(lower,room.name+' foundation',[x1-x0,2.6,z1-z0],trim,[(x0+x1)/2,-1.35,(z0+z1)/2]);}
  // Later named rooms own overlaps (notably shop/services). Emit each floor once.
  const rectangle=(r:readonly number[])=>[[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]]] as polygonClipping.Polygon;
  MUSEUM_ROOMS.forEach((room,i)=>{
    const pieces=polygonClipping.difference(rectangle(room.rect),...MUSEUM_ROOMS.slice(i+1).map(r=>rectangle(r.rect)));
    for(const poly of pieces){const shape=new Shape(poly[0].map(p=>new Vector2(p[0],-p[1])));for(const hole of poly.slice(1))shape.holes.push(new Path(hole.map(p=>new Vector2(p[0],-p[1]))));const geo=new ShapeGeometry(shape);geo.rotateX(-Math.PI/2);mesh(ground,room.name+' floor',geo,mat(room.color));}
  });
  box(lower,'Entry courtyard foundation',[4.92,2.6,14],trim,[16.54,-1.36,7]);
  box(site,'Recessed entry courtyard',[4.92,.14,14],paving,[16.54,-.07,7]);
  // Closed risers reach below the adjacent DEM; no open wedge beneath the stairs.
  for(let i=0;i<6;i++){const top=-1.08+.18*(i+1);box(site,'Central Avenue entrance step',[4.92,top+4,.5],paving,[16.54,(top-4)/2,-2.75+i*.5]);}
  box(site,'Entrance lower landing and closed foundation',[4.92,2.92,3],paving,[16.54,-2.54,-4.5]);
  const approach=new Shape([new Vector2(-14,-4),new Vector2(-6,-4),new Vector2(-6,-1.08),new Vector2(-14,-2.70)]);
  const approachGeometry=new ExtrudeGeometry(approach,{depth:4.92,bevelEnabled:false,curveSegments:1});
  // Extrusion axis becomes plan X; profile X becomes plan Z (a reflection).
  const av=approachGeometry.attributes.position;for(let i=0;i<av.count;i++){const z=av.getX(i),x=av.getZ(i);av.setXYZ(i,14.08+x,av.getY(i),z);}
  for(const attr of Object.values(approachGeometry.attributes)){const values=attr.array,n=attr.itemSize;for(let i=0;i<attr.count;i+=3)for(let k=0;k<n;k++){const a=(i+1)*n+k,b=(i+2)*n+k,t=values[a];values[a]=values[b];values[b]=t;}}
  approachGeometry.computeVertexNormals();mesh(site,'Graded entrance approach',approachGeometry,paving);
  for(const x of [14.2,18.9]){beam(site,'Entrance stair handrail',[x,.05,-3],[x,1.12,0],.055,metal);for(const z of [-3,0])beam(site,'Entrance rail post',[x,-1.08+(z+3)*.36,z],[x,.05+(z+3)*.36,z],.055,metal);}
  const rampProfile=new Shape([new Vector2(19,-3),new Vector2(39.5,-3),new Vector2(39.5,-1.08),new Vector2(19,0)]);
  mesh(site,'Forest Avenue ramp and closed foundation',new ExtrudeGeometry(rampProfile,{depth:2,bevelEnabled:false,curveSegments:1}),paving,0,0,3.5);
  beam(site,'Ramp upper rail',[19,1.02,3.55],[39.5,-.06,3.55],.05,metal);for(let x=19;x<=39.5;x+=2.5)beam(site,'Ramp rail post',[x,-(x-19)/20.5*1.08,3.55],[x,1.02-(x-19)/20.5*1.08,3.55],.05,metal);
  // Walls retain a readable low sill in cutaway mode. Main facade has a true arched opening.
  for(const [x0,z0,x1,z1]of MUSEUM_WALLS){
    if(z0===5.7&&z1===5.7&&x0===19)continue;
    const length=Math.hypot(x1-x0,z1-z0),angle=Math.atan2(x1-x0,z1-z0),tall=((x0===x1&&(x0===19||x0===30.8)&&Math.max(z0,z1)<=20.82)||(z0===20.82&&z1===20.82&&x0>=19&&x1<=30.8))?7:3.7;
    box(lower,'Plan wall sill',[.24,1.1,length],stucco,[(x0+x1)/2,.55,(z0+z1)/2]).rotation.y=angle;
    box(high,'Plan wall upper',[.24,tall-1.1,length],stucco,[(x0+x1)/2,(tall+1.1)/2,(z0+z1)/2]).rotation.y=angle;
  }
  box(lower,'Main facade cutaway sill',[11.8,.45,.22],stucco,[24.9,.225,5.7]);
  const facade=new Shape([new Vector2(19,0),new Vector2(30.8,0),new Vector2(30.8,7.2),new Vector2(24.9,9.2),new Vector2(19,7.2)]);
  const hole=archShape(7.1,3.55,2.45);facade.holes.push(new Path(hole.getPoints(20).map(p=>p.add(new Vector2(24.9,.5)))));
  const wall=new ExtrudeGeometry(facade,{depth:.26,bevelEnabled:false,curveSegments:12});mesh(high,'Arched main gallery facade',wall,stucco,0,0,5.57);
  // Flat painted glass is opaque by design: no sorting cost, copied photos or transparency stacks.
  arch(high,'Arched main window',24.9,.5,5.54,7.1,3.55,glass,2.45);
  for(let i=0;i<=10;i++){const x=-3.55+i*.71,height=3.55+2.45*Math.sqrt(Math.max(0,1-x*x/(3.55*3.55)));box(high,'Main window mullion',[.055,height,.08],metal,[24.9+x,.5+height/2,5.49]);}
  for(let i=1;i<=6;i++){const y=i*.8;const w=y<=3.55?7.1:7.1*Math.sqrt(Math.max(0,1-((y-3.55)/2.45)**2));box(high,'Main window transom',[w,.055,.08],metal,[24.9,.5+y,5.48]);}
  box(high,'MVSEVM sign lintel',[7.45,.58,.4],cream,[24.9,3.12,5.39]);
  // Original vector stroke lettering, no font/network/texture dependency.
  const glyphs:number[][][]=[[[0,0],[0,1],[.5,.4],[1,1],[1,0]],[[0,1],[.5,0],[1,1]],[[1,1],[0,1],[0,.5],[1,.5],[1,0],[0,0]],[[1,1],[0,1],[0,0],[1,0]],[[0,.5],[.8,.5]],[[0,1],[.5,0],[1,1]],[[0,0],[0,1],[.5,.4],[1,1],[1,0]]];
  let gx=22.1;glyphs.forEach((points,i)=>{const x=i===4?gx-.82:gx;for(let j=1;j<points.length;j++)beam(high,'MVSEVM letter',[x+points[j-1][0]*.49,2.94+points[j-1][1]*.34,5.16],[x+points[j][0]*.49,2.94+points[j][1]*.34,5.16],.025,walnut);if(i!==4)gx+=1.02;});
  for(let i=0;i<13;i++){const x=19.6+i*.88,y=6.05+(1-Math.abs(x-24.9)/5.6)*1.7;arch(high,'Blind arcade recess',x,y,5.53,.47,.48,trim,.24);box(high,'Arcade sill',[.52,.08,.2],cream,[x,y-.045,5.47]);}
  for(const x of [31.8,34.3,36.8])windowGrid(high,x,2.35,5.54,1.65,1.65,metal,glass);
  // Bird wing front: photo-informed horizontal blind arcade and low pitched roof.
  for(let i=0;i<18;i++)arch(high,'Bird wing blind arcade',.6+i*.75,2.65,-.14,.38,.48,trim,.19);
  // Garden/side window cues and canopy stay outside the entrance opening.
  for(const x of [2,5,8,11])windowGrid(high,x,2.1,24.41,1.6,1.3,metal,glass);
  box(roofs,'Entry glazed canopy',[4.9,.1,2.1],glass,[16.55,2.9,13]);for(const x of [14.1,15.3,16.55,17.8,19])beam(roofs,'Canopy beam',[x,2.85,12],[x,2.85,14],.07,walnut);
  roof(roofs,'Main hall roof',18.7,5.4,31.1,21.15,7.2,2.1,tile,tileEdge);
  roof(roofs,'Bird wing roof',-.3,-.3,14.35,14.3,3.75,1.2,tile,tileEdge);
  roof(roofs,'Side gallery roof',30.7,5.4,38.1,26,3.75,.8,tile,tileEdge);
  roof(roofs,'Classroom roof',25.3,25.7,38.1,33.3,3.75,1,tile,tileEdge);
  roof(roofs,'Service wing roof',-.3,14,15.6,24.5,3.7,.7,tile,tileEdge);
  for(const [x0,x1,z0,z1,y,rise]of [[19,30.8,5.7,20.82,7.2,2],[0,14.08,0,14,3.7,1.2],[30.8,37.83,5.7,26,3.7,.8],[25.6,37.83,26,33.04,3.7,1]])for(const z of [z0,z1]){if(x0===19&&z===5.7)continue;polygon(roofs,'Stucco gable end',[[x0,y,z],[(x0+x1)/2,y+rise,z],[x1,y,z]],stucco);}
  box(roofs,'Lobby link roof',[4.9,.15,6.8],tile,[16.55,3.75,17.4]);
  // Roof trusses appear from the upper floor; ground cutaway removes overhead geometry.
  for(const z of [7,11.4,15.8,20]){beam(roofs,'Exposed roof tie',[19.1,7.05,z],[30.7,7.05,z],.18,walnut);beam(roofs,'Roof truss',[19.1,7.05,z],[24.9,9.1,z],.17,walnut);beam(roofs,'Roof truss',[24.9,9.1,z],[30.7,7.05,z],.17,walnut);}
  // Actual mezzanine is a ring, with a long bridge to the elevator/stair side.
  for(const [x0,z0,x1,z1]of MUSEUM_UPPER)box(upper,'Open mezzanine floor',[x1-x0,.2,z1-z0],walnut,[(x0+x1)/2,3.5,(z0+z1)/2]);
  for(const [a,b]of [[[21.7,9],[28.1,9]],[[21.7,9],[21.7,17.8]],[[21.7,17.8],[28.1,17.8]],[[28.1,9],[28.1,17.8]]]){beam(upper,'Mezzanine railing',[a[0],4.65,a[1]],[b[0],4.65,b[1]],.05,metal);const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.45);for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;beam(upper,'Railing baluster',[x,3.6,z],[x,4.65,z],.035,metal);}}
  // Two stair flights are shown at their published locations. Gym floor selection is explicit.
  for(const [x,z,width,run]of [[29.7,11,1.5,5.5],[10.1,14.7,1.4,3.5]])for(let i=0;i<20;i++)box(upper,'Study stair tread',[width,.12,run/20],walnut,[x,.18*(i+1)-.06,z+(i+.5)*run/20]);
  for(const x of [29,30.4])beam(upper,'Main stair handrail',[x,1,11],[x,4.6,16.5],.05,metal);
  // Door jambs leave the same gaps as the collider plan, even in floor cutaways.
  for(const [x,z]of [[16.4,14],[16.5,20.82],[12,14],[34.2,9.5],[34.2,18],[34.25,26]]){for(const d of [-1,1])box(ground,'Door jamb',[.09,2.3,.18],walnut,[x+d*.96,1.15,z]);box(ground,'Door lintel',[2,.12,.18],walnut,[x,2.3,z]);}
  // A few baked floor seams keep the large wooden room readable at close distances.
  for(let z=6.2;z<20.7;z+=.65)box(ground,'Wood floor joint',[11.45,.006,.016],mat('#9c7657'),[24.9,.009,z]);
  for(let z=.75;z<13.5;z+=1.25)box(site,'Courtyard paving joint',[4.6,.01,.018],trim,[16.5,.012,z]);
  // Front planting, banner and flagpole are original simplified site cues.
  const shrub=mat('#829465');for(const [x,z]of [[20.1,3],[23,3],[26,3],[29.4,3],[14.85,5],[14.85,9]]){box(site,'Stucco planter',[1.4,.5,.9],stucco,[x,.25,z]);blob(site,'Courtyard planting',[x,.65,z],[.7,.45,.45],shrub);}
  beam(site,'Front flagpole',[23.2,-1.05,.4],[23.2,8.4,.4],.065,cream);polygon(site,'Simplified flag',[[23.2,8.3,.4],[21.4,8.15,.4],[21.5,7.15,.4],[23.2,7.3,.4]],cream);
  box(high,'Original museum banner',[.95,2.2,.07],mat('#637f7d'),[20.1,2.6,5.35]);
  // Empty galleries retain their architectural floor plan for future content.
  addMuseumGarden(site);
  for(const [part,name]of [[site,'site'],[lower,'lower-walls'],[high,'upper-walls'],[roofs,'roofs'],[ground,'ground-floor'],[upper,'mezzanine']] as const){finishStaticAsset(part,'pg-museum-'+name,[1,1,1],{rim:false,doubleSided:name==='roofs'||name==='site'});finishGeometry(part);root.add(part);}
  site.traverse(o=>{if('geometry' in o)(o as import('three').Mesh).geometry.userData.lodMaxErrorMetres=.015;});
  root.name=MUSEUM_SITE.name;root.userData={assetId:MUSEUM_SITE.id,units:'metres',seed:MUSEUM_SITE.seed,source:MUSEUM_SITE.sources,limits:MUSEUM_SITE.limits,budget:MUSEUM_BUDGET};
  let mode:MuseumView='exterior',disposed=false;
  function setView(view:MuseumView){mode=view;high.visible=roofs.visible=view==='exterior';upper.visible=view!=='ground';ground.visible=true;}
  return {root,parts:{site,lower,high,roofs,ground,upper},get view(){return mode;},setView,dispose(){if(disposed)return;disposed=true;disposeObject(root);}};
}
