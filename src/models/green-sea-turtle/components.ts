import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CircleGeometry, MeshToonMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { skinGeometry, solidColor } from '../shared/fish/geometry';
import { buildShell } from './shell';
import { buildFlipper } from './flippers';
import { buildHead, headFlank } from './head';

/** Anatomy is authored in full-body fractions, then merged into the shared two-draw creature contract. */
export function buildTurtle(a:ModelAssembly,material:MeshToonMaterial,length:number,seed:number){
 const add=(name:string,g:BufferGeometry,color?:string,bone=0)=>{if(color)solidColor(g,color);if(!g.attributes.skinIndex)skinGeometry(g,bone);g.scale(length,length,length);a.addMesh(a.parts.get(name)??a.addPart(name),g,material);};
 const shell=buildShell(seed,material);add('carapace-plastron',shell.body);shell.seams.forEach(g=>add('shell-scutes',g,'#bbad7c'));
 add('head-neck-beak',buildHead());
 add('tail',new SphereGeometry(1,8,4).scale(.055,.014,.019).translate(.445,-.020,0),'#7d7957');
 for(const [i,side] of [1,-1].entries()){
  add('front-flippers',buildFlipper(side,false,i+1));add('rear-flippers',buildFlipper(side,true,i+3));
  const eyeX=-.442,eyeY=.052,z=side*.052;
  add('eyes',new SphereGeometry(1,8,5).scale(.017,.016,.006).translate(eyeX,eyeY,z),'#b7a477');
  add('eyes',new SphereGeometry(1,8,5).scale(.012,.012,.006).translate(eyeX-.001,eyeY,z+side*.004),'#202a25');
  add('eyes',new SphereGeometry(1,5,3).scale(.0025,.0025,.002).translate(eyeX-.004,eyeY+.004,z+side*.009),'#e5dfbd');
  for(const sign of [-1,1])add('eyes-caught',new BoxGeometry(.034,.005,.004).rotateZ(sign*Math.PI/4).translate(eyeX,eyeY,z+side*.007),'#263028');
  const mouth=[[-.496,.018],[-.484,.009],[-.469,.006],[-.451,.012]].map(([x,y])=>new Vector3(x,y,(headFlank(x,y)+.0008)*side));
  add('mouth',new TubeGeometry(new CatmullRomCurve3(mouth),5,.0017,3,false),'#514b39');
  // Small cheek scales sit on the head surface; no separate draw per marking.
  for(const [x,y,r] of [[-.405,.047,.010],[-.413,.027,.008],[-.43,.019,.006],[-.395,.034,.007]]){
   const dz=headFlank(x,y);
   add('head-scales',new CircleGeometry(r,5).rotateY(side<0?Math.PI:0).translate(x,y,side*(dz+.0008)),'#5f5b43');
  }
  add('nostrils',new SphereGeometry(1,5,3).scale(.003,.002,.002).translate(-.487,.037,side*.018),'#514b39');
 }
 // Paired prefrontal scales: distinguish the head without a high-detail texture map.
 for(const side of [-1,1])add('prefrontal-scales',new CircleGeometry(.012,5).rotateX(-Math.PI/2).translate(-.452,.073,side*.014),'#706749');
}
