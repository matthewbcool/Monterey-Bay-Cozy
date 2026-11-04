import { BoxGeometry, CylinderGeometry, SphereGeometry, type Material } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { finish,plain } from './geometry';

export function buildBody(a:ModelAssembly,material:Material,span:number,seed:number){
 const body=a.addPart('mantle-head'),eyes=a.addPart('eyes'),caught=a.addPart('eyes-caught');
 const ellipsoid=(x:number,y:number,z:number,rx:number,ry:number,rz:number,bone=0,segments=12,rings=8)=>{
  const g=new SphereGeometry(1,segments,rings).scale(rx,ry,rz).translate(x,y,z);finish(g,seed,bone);g.scale(span,span,span);a.addMesh(body,g,material);return g;
 };
 ellipsoid(-.09,.108,0,.135,.1,.087,1,16,10);
 // A tucked, tapered arm crown. The old full ellipsoid hung below the roots
 // and its cel-shadow cap read as a separate circular disc from underneath.
 const crown=new SphereGeometry(1,12,8),positions=crown.attributes.position;
 for(let i=0;i<positions.count;i++){
  const taper=1+Math.min(0,positions.getY(i))*.45;
  positions.setXYZ(i,positions.getX(i)*taper,positions.getY(i),positions.getZ(i)*taper);
 }
 crown.scale(.09,.047,.073).translate(.038,.082,0);crown.computeVertexNormals();finish(crown,seed);crown.scale(span,span,span);a.addMesh(body,crown,material,'tapered-arm-crown');
 for(const side of [-1,1]){
  ellipsoid(.018,.112,side*.063,.035,.034,.033,0,10,6);
  const iris=new SphereGeometry(1,10,6).scale(.023,.016,.010).translate(.022,.115,side*.091);plain(iris,'#cb9857');iris.scale(span,span,span);a.addMesh(eyes,iris,material);
  const pupil=new SphereGeometry(1,8,4).scale(.016,.0038,.004).translate(.024,.115,side*.099);plain(pupil,'#242c29');pupil.scale(span,span,span);a.addMesh(eyes,pupil,material);
  for(const tilt of [-.75,.75]){
   const x=new BoxGeometry(.036,.006,.004).rotateZ(tilt).translate(.022,.115,side*.100);plain(x,'#30312b');x.scale(span,span,span);a.addMesh(caught,x,material);
  }
 }
 const siphon=a.addPart('siphon');
 const tube=new CylinderGeometry(.015,.022,.073,8,1,true).rotateZ(-Math.PI/2).rotateY(-.4).translate(.015,.05,.069);finish(tube,seed);tube.scale(span,span,span);a.addMesh(siphon,tube,material);
 const opening=new SphereGeometry(1,8,4).scale(.003,.011,.012).rotateY(-.4).translate(.050,.05,.083);plain(opening,'#5f382b');opening.scale(span,span,span);a.addMesh(siphon,opening,material);
}
