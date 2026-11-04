import {finishStaticAsset} from '../shared/staticAsset';
import {PROP_SCALE} from './dimensions';
import { CatmullRomCurve3, Group, TubeGeometry, Vector3 } from 'three';
import { box, cylinder, mat, mesh, palette as p, ring, sphere, tube } from './primitives';

export function createFishingRod(bamboo=false){
  const root=new Group();root.name=bamboo?'Bamboo float rod':'Harbor spinning rod';
  const blank=mat(bamboo?'#ac994d':p.navy),grip=mat(p.woodLight),wrap=mat(bamboo?p.woodDark:p.cream),metal=mat(p.metal,.3,.55),reel=mat(p.mint,.4,.25),line=mat('#d8e6cf',.45);
  const height=bamboo?4.7:4.5;
  const curve=new CatmullRomCurve3([[0,0,0],[0,1.25,0],[.08,2.7,0],[.3,3.85,0],[.68,height,0]].map(p=>new Vector3(...p as [number,number,number])));
  const shaft=new TubeGeometry(curve,24,bamboo?.029:.019,6,false),vertices=shaft.attributes.position;
  const vertex=new Vector3();
  for(let i=0;i<=24;i++){
    const center=curve.getPointAt(i/24),taper=1-i/24*.73;
    for(let j=0;j<=6;j++){const index=i*7+j;vertex.fromBufferAttribute(vertices,index).sub(center).multiplyScalar(taper).add(center);vertices.setXYZ(index,vertex.x,vertex.y,vertex.z);}
  }
  shaft.computeVertexNormals();mesh(root,'Tapered rod blank',shaft,blank);
  cylinder(root,'Cork grip',.072,.68,grip,[0,.36,0],.065);
  cylinder(root,'Butt cap',.08,.08,wrap,[0,.04,0]);
  cylinder(root,'Upper grip collar',.075,.045,metal,[0,.71,0]);
  const guides:number[][]=[];
  for(let i=0;i<6;i++){
    const t=.21+i*.135,point=curve.getPointAt(t),tangent=curve.getTangentAt(t),radius=(bamboo?.043:.029)*(1-t*.73);
    const binding=cylinder(root,bamboo?'Bamboo node':'Guide binding',radius+.007,bamboo?.065:.04,wrap,[point.x,point.y,point.z]);
    binding.quaternion.setFromUnitVectors(new Vector3(0,1,0),tangent);
    if(!bamboo){
      const guide=ring(root,'Line guide',.043-i*.004,.007,metal,[point.x,point.y,.043]);
      guide.quaternion.setFromUnitVectors(new Vector3(0,0,1),tangent);
      guides.push([point.x,point.y,.043]);
    }
  }
  if(!bamboo)tube(root,'Line through rod guides',[[0,.85,.36],...guides,[.68,height,0]],.004,line,48);
  if(!bamboo){
    box(root,'Reel foot',[.06,.33,.055],metal,[0,.77,.07]);
    tube(root,'Reel stem',[[0,.8,.08],[0,.67,.18],[0,.64,.27]],.035,metal,10);
    const housing=sphere(root,'Seafoam reel housing',.14,reel,[0,.65,.28]);housing.scale.set(.8,1,1);
    const spool=cylinder(root,'Line spool',.12,.14,metal,[0,.82,.30]);spool.rotation.x=Math.PI/2;
    const lineSpool=cylinder(root,'Wound line',.106,.085,wrap,[0,.82,.33]);lineSpool.rotation.x=Math.PI/2;
    tube(root,'Reel bail',[[-.13,.78,.32],[-.14,.94,.43],[0,1.01,.45],[.14,.94,.43],[.13,.78,.32]],.012,metal,18);
    tube(root,'Crank arm',[[.08,.63,.27],[.23,.63,.27],[.28,.76,.27]],.019,metal,10);
    const knob=cylinder(root,'Crank grip',.039,.12,grip,[.29,.76,.31]);knob.rotation.x=Math.PI/2;
  }
  tube(root,'Hanging fishing line',[[.68,height,0],[.92,height-.55,.015],[1.03,2.45,.035],[1.01,1.20,.04]],.0055,line,44);
  const float=new Group();float.name='Painted float';float.position.set(1.01,1.19,.04);root.add(float);
  const floatTop=sphere(float,'Float upper half',.087,mat(bamboo?p.yellow:p.coral),[0,.045,0]);floatTop.scale.y=.8;
  const floatBase=sphere(float,'Float cream lower half',.077,mat(p.cream),[0,-.032,0]);floatBase.scale.y=.8;
  cylinder(float,'Float antenna',.01,.22,wrap,[0,.13,0]);
  return finishStaticAsset(root,bamboo?'bamboo-rod':'spinning-rod',PROP_SCALE[bamboo?'bamboo-rod':'spinning-rod']);
}
