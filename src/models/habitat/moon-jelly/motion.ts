import {Box3,BufferGeometry,Float32BufferAttribute,Sphere,Vector3,type Mesh} from 'three';
const TAU=Math.PI*2;
const smooth=(t:number)=>t*t*(3-2*t);
/** Short contraction, longer relaxation. Rates remain art direction, not a measured swimming speed. */
export function jellyContraction(phase:number){const t=((phase%TAU)+TAU)%TAU/TAU;return t<.30?smooth(t/.30):1-smooth((t-.30)/.70);}
export function applyJellyPose(meshes:readonly Mesh[],phase:number,caught=false){
 const contraction=caught?1:jellyContraction(phase),trail=caught?0:jellyContraction(phase-.8);
 for(const mesh of meshes){mesh.morphTargetInfluences![0]=contraction;mesh.morphTargetInfluences![1]=trail;}
}
/** Two static shape targets: bell contraction and delayed soft-tissue recovery. */
export function addJellyMorphs(geometry:BufferGeometry,diameter:number){
 const p=geometry.attributes.position,radius=diameter/2,targets=[new Float32Array(p.count*3),new Float32Array(p.count*3)];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),edge=Math.min(1,Math.hypot(x,z)/radius),pull=1-.16*edge**2,loose=Math.max(0,-y/radius-.04);
  targets[0].set([x*pull,y+radius*(.055*(1-edge*edge)-.12*edge**4)+Math.max(0,-y)*.12,z*pull],i*3);
  // Starts at zero below attachment roots; the rim/canals remain welded to the bell.
  const bend=Math.min(1,loose*3)**2;
  targets[1].set([x+radius*.038*bend,y+radius*.028*bend,z-radius*.026*bend],i*3);
 }
 geometry.morphAttributes.position=targets.map(values=>new Float32BufferAttribute(values,3));
 // Lighting follows the shape as well as the silhouette, with no runtime normal uploads.
 geometry.morphAttributes.normal=targets.map(values=>{
  const target=new BufferGeometry();target.setAttribute('position',new Float32BufferAttribute(values,3));target.setIndex(geometry.index);target.computeVertexNormals();
  const normals=target.attributes.normal.clone() as Float32BufferAttribute;target.dispose();return normals;
 });
 // Both absolute morphs can act at once. Bound their combined extremes once at construction.
 const box=new Box3(),point=new Vector3();
 for(let i=0;i<p.count;i++)for(const a of [0,1])for(const b of [0,1]){
  const values=[p.getX(i),p.getY(i),p.getZ(i)].map((value,axis)=>value+a*(targets[0][i*3+axis]-value)+b*(targets[1][i*3+axis]-value));
  box.expandByPoint(point.set(values[0],values[1],values[2]));
 }
 geometry.boundingBox=box.expandByScalar(diameter*.00001);geometry.boundingSphere=box.getBoundingSphere(new Sphere());
}
