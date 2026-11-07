import {Group,CylinderGeometry,TorusGeometry,Vector3,Mesh} from 'three';
import {box,mat,mesh} from '../primitives';
import {finishStaticAsset} from '../../shared/staticAsset';
import {defineGeometryLods} from '../../shared/lod/geometry';
const rigs=new WeakMap<Group,ReturnType<typeof createSurrey>>();
 const addBeam=(g:Group,a:number[],b:number[],r:number,m:ReturnType<typeof mat>)=>{const p=new Vector3(...a),q=new Vector3(...b),d=q.clone().sub(p);const part=mesh(g,'Tubular frame',new CylinderGeometry(r,r,d.length(),5),m);part.position.copy(p).add(q).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize());};
function createFrame(detail:'near'|'mid'|'far'){
 const body=new Group();
 const green=mat('#238e72'),yellow=mat('#efc52d'),black=mat('#273633'),silver=mat('#aeb8aa'),cream=mat('#ded29c');
 const beam=(g:Group,a:number[],b:number[],r:number,m=green)=>addBeam(g,a,b,r,m);
 for(const x of [-.57,.57]){beam(body,[x,.35,-.9],[x,.35,1.03],.035);beam(body,[x,.45,-.7],[x,1.05,-.7],.03);beam(body,[x,.65,1],[x,1.08,.5],.03);for(const z of [-.75,.85])beam(body,[x,.55,z],[x,2.03,z],.018,silver);}
 box(body,'Low foot deck',[1.12,.06,1.72],silver,[0,.38,0]);
 box(body,'Adult bench cushion',[1.12,.09,.4],black,[0,.9,-.48]);box(body,'Adult bench back',[1.12,.32,.07],black,[0,1.16,-.72]);
 box(body,'Front child seat',[.92,.055,.36],cream,[0,.72,.65]);box(body,'Child seat back',[.92,.32,.05],cream,[0,.9,.47]);
 for(const x of [-.47,.47])beam(body,[x,.74,.84],[x,1.04,.84],.025);
 // Low fabric crown: broad planes, no simulated cloth or micro folds.
 for(const side of [-1,1]){const panel=box(body,'Crowned fabric canopy panel',[.765,.025,2.12],yellow,[side*.38,2.135,0]);panel.rotation.z=-side*Math.atan2(.07,.76);}
 for(const z of [-1.06,1.06])box(body,'Black canopy hem',[1.52,.025,.04],black,[0,1.94,z]);
 box(body,'Blue front rental placard',[.95,.28,.025],mat('#3d98af'),[0,.55,1.04]);
 box(body,'Placard yellow border',[.99,.025,.03],yellow,[0,.70,1.04]);
 for(const x of [-.68,.68])for(const z of [-.78,.78]){
   const fender=mesh(body,'Silver wheel mudguard',new TorusGeometry(.345,.025,3,8,Math.PI),silver,x,.33,z);fender.rotation.y=Math.PI/2;
 }
 for(const x of [-.22,.22])box(body,'Child seat belt',[.04,.32,.02],black,[x,.9,.505]);
 for(const x of [-.76,.76])box(body,'Canopy black piping',[.025,.035,2.12],black,[x,2.04,0]);
 for(const z of [-1.06,1.06])box(body,'Canopy valance',[1.52,.23,.035],yellow,[0,2.055,z]);
 for(const x of [-.32,.32]){beam(body,[x,.55,.15],[x,1.15,.25],.02,silver);const wheel=mesh(body,'Steering wheel',new TorusGeometry(.16,.018,4,10),black,x,1.16,.25);wheel.rotation.x=-.7;}
 // Authored coarse frame retains every load-bearing tube; generic error-based
 // reduction erased the slender canopy supports in the enlarged Far review.
 if(detail!=='near')for(const child of [...body.children])if(child instanceof Mesh){
   if(detail==='far'&&/Steering wheel|mudguard|seat belt|piping|Placard yellow/.test(child.name)){child.geometry.dispose();child.removeFromParent();continue;}
   if(child.geometry instanceof CylinderGeometry){const p=child.geometry.parameters;child.geometry.dispose();child.geometry=new CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,detail==='far'?3:4);}
 }
 finishStaticAsset(body,'surrey-frame',[1,1,1]);
 return body;
}
/** Provisional photo-derived dimensions, metres. Front faces +Z. */
export function createSurrey(){
 const root=new Group(),body=createFrame('near'),beam=addBeam;root.name='Pedal surrey';root.add(body);
 defineGeometryLods((body.children[0] as Mesh).geometry,()=>{
   const take=(level:'mid'|'far')=>{const group=createFrame(level),part=group.children[0] as Mesh;const materials=Array.isArray(part.material)?part.material:[part.material];materials.forEach(m=>m.dispose());return part.geometry;};
   return {mid:take('mid'),far:take('far')};
 });
 const wheels:Group[]=[],steering:Group[]=[];
 for(const x of [-.68,.68])for(const z of [-.78,.78]){
  const pivot=new Group(),spin=new Group();pivot.position.set(x,.33,z);root.add(pivot);pivot.add(spin);
  const tire=mesh(spin,'Bicycle tire',new TorusGeometry(.29,.04,4,12),mat('#273633'));tire.rotation.y=Math.PI/2;
  for(let i=0;i<4;i++){const a=i*Math.PI/4;beam(spin,[0,Math.cos(a)*.27,Math.sin(a)*.27],[0,-Math.cos(a)*.27,-Math.sin(a)*.27],.009,mat('#bbc4b6'));}
  finishStaticAsset(spin,'surrey-wheel',[1,1,1]);wheels.push(spin);if(z>0)steering.push(pivot);
 }
 const crank=new Group();crank.position.set(0,.42,-.05);root.add(crank);
 for(const [x,phase] of [[-.45,1],[-.15,-1],[.15,1],[.45,-1]]){beam(crank,[x,0,0],[x,.14*phase,0],.018,mat('#aeb8aa'));box(crank,'Pedal',[.14,.04,.12],mat('#273633'),[x,.14*phase,0]);}
 finishStaticAsset(crank,'surrey-pedals',[1,1,1]);
 root.userData={assetId:'pedal-surrey',units:'metres',budget:{triangles:3000,drawCalls:6},physics:{halfWidth:.78,halfLength:1.15},lengthMeters:2.26};
 const result={root,wheels,steering,crank,animate(distance:number,steer=0){for(const wheel of wheels)wheel.rotation.x+=distance/.33;for(const pivot of steering)pivot.rotation.y=steer*.45;crank.rotation.x+=distance*2.4;}};rigs.set(root,result);return result;
}
export function animateSurrey(root:Group,dt:number){rigs.get(root)?.animate(dt*.8);}
