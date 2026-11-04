import {finishStaticAsset} from '../shared/staticAsset';
import {PROP_SCALE} from './dimensions';
import { CircleGeometry, Group } from 'three';
import { box, cylinder, mat, mesh, palette as p, ring, tube } from './primitives';

export function createDock(){
  const root=new Group();root.name='Timber dock section';
  const wood=mat(p.wood),light=mat(p.woodLight),dark=mat(p.woodDark),rope=mat(p.cream),metal=mat(p.navy,.45,.2);
  for(const x of [-.90,.90])box(root,'Longitudinal bearer',[.18,.30,5.3],dark,[x,.44,0]);
  for(let i=0;i<16;i++){
    const z=(i-7.5)*.33;box(root,'Weathered deck plank',[2.4,.14,.31],i%3===0?light:wood,[0,.66,z],.025);
    for(const x of [-.88,.88]){const nail=mesh(root,'Recessed nail',new CircleGeometry(.024,6),metal,x,.735,z);nail.rotation.x=-Math.PI/2;nail.castShadow=false;}
  }
  for(const x of [-1.12,1.12])for(const z of [-2.32,2.32]){
    cylinder(root,'Timber piling',.16,2.75,dark,[x,-.1,z],.145);
    cylinder(root,'Piling cap',.20,.10,light,[x,1.3,z]);
    for(let i=0;i<3;i++){const wrap=ring(root,'Piling rope wrap',.167,.023,rope,[x,1.05+i*.049,z]);wrap.rotation.x=Math.PI/2;}
  }
  for(const x of [-1.12,1.12])tube(root,'Soft rope rail',[[x,1.12,-2.3],[x,.88,-.9],[x,.84,.9],[x,1.12,2.3]],.028,rope,24);
  const cleat=box(root,'Mooring cleat',[.44,.09,.11],metal,[.80,.88,1.46]);cleat.rotation.y=.15;
  cylinder(root,'Cleat foot',.044,.13,metal,[.80,.79,1.46]);
  return finishStaticAsset(root,'dock',PROP_SCALE['dock']);
}

export function createTackleBox(){
  const root=new Group();root.name='Coral tackle box';
  const paint=mat(p.coral),cream=mat(p.cream),navy=mat(p.navy),metal=mat(p.brass,.35,.45);
  box(root,'Rounded tackle case',[1.25,.58,.70],paint,[0,.31,0],.075);
  box(root,'Cream lid',[1.30,.15,.74],cream,[0,.67,0],.06);
  box(root,'Lid seam',[1.27,.025,.72],navy,[0,.585,0],.012);
  for(const x of [-.38,.38]){
    box(root,'Brass latch',[.11,.22,.045],metal,[x,.56,.38]);
    box(root,'Case foot',[.16,.05,.14],navy,[x,.025,-.20]);
    box(root,'Case foot',[.16,.05,.14],navy,[x,.025,.20]);
  }
  tube(root,'Carry handle',[[-.29,.76,0],[-.25,.94,0],[.25,.94,0],[.29,.76,0]],.04,navy,18);
  return finishStaticAsset(root,'tackle-box',PROP_SCALE['tackle-box']);
}
