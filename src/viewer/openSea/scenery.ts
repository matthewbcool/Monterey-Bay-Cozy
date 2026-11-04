import { createGalleryVisitors } from '../../models/visitors/createGalleryVisitors';
import { BoxGeometry, BufferGeometry, Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '../../models/shared/style';

/** Photo-composition silhouettes, original low-detail geometry; not selectable animal assets. */
export function createGalleryScenery(width:number,height:number,depth:number) {
  const root=new Group();root.name='Open Sea gallery';
  function mesh(name:string,pieces:BufferGeometry[],color:string){const converted=pieces.map(g=>{g.deleteAttribute('uv');return g.index?g.toNonIndexed():g.clone();});const geometry=mergeGeometries(converted)!;converted.forEach(g=>g.dispose());pieces.forEach(g=>g.dispose());const result=new Mesh(geometry,createToonMaterial({color,rim:false}));result.name=name;root.add(result);return result;}
  // Keep the entire surround in the dry gallery, clear of the water planes.
  // Rails and facade panels meet at their edges instead of overlapping coplanar faces.
  const back=depth/2+.02;
  const panel=(w:number,h:number,d:number,x:number,y:number)=>new BoxGeometry(w,h,d).translate(x,y,back+d/2);
  const frame=[panel(width+1,.35,.45,0,height/2+.175),panel(width+1,.40,.65,0,-height/2-.2)];
  for(const side of [-1,1])frame.push(panel(.5,height,.6,side*(width/2+.25),0));
  frame.push(panel(width+60,20,.5,0,height/2+.35+10),panel(width+60,20,.5,0,-height/2-.40-10));
  mesh('viewing-window-surround',frame,'#101d2b');
  mesh('gallery-floor',[new BoxGeometry(width+3,.12,7).translate(0,-height/2-.46,depth/2+3.4)],'#203443');
  const visitors=createGalleryVisitors({span:width*.84});
  // Match the gallery floor top exactly; stay close to the glass to reduce perspective exaggeration.
  visitors.root.position.set(0,-height/2-.4,depth/2+1.2);root.add(visitors.root);
  return {root,visitors};
}
