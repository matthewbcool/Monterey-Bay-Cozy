import {finishStaticAsset} from '../shared/staticAsset';
import {PROP_SCALE} from './dimensions';
import { Group } from 'three';
import { box, cylinder, hull, mat, palette as p, ring, sphere, tube } from './primitives';

export function createRowboat(){
  const root=new Group();root.name='Seafoam rowboat';
  const paint=mat(p.mint),cream=mat(p.cream),wood=mat(p.woodLight),dark=mat(p.woodDark),metal=mat(p.brass,.35,.35);
  hull(root,5.6,2.15,paint,cream,wood);
  for(let i=-2;i<=2;i++)box(root,'Floor board',[.21,.075,3.6],i%2?wood:dark,[i*.23,.015,-.22],.015);
  for(const z of [-1.6,-.25,1.35]){
    box(root,'Bench seat',[z===1.35?1.58:1.88,.12,.47],wood,[0,.49,z]);
    for(const x of [-.57,.57])box(root,'Bench support',[.08,.51,.23],cream,[x,.22,z]);
  }
  for(const side of [-1,1]){
    const oar=new Group();oar.name='Removable wooden oar';oar.position.set(side*1.05,.76,-.2);oar.rotation.y=side*.29;oar.rotation.z=side*-.07;root.add(oar);
    const shaft=cylinder(oar,'Oar shaft',.039,3.55,wood,[0,0,0]);shaft.rotation.x=Math.PI/2;
    box(oar,'Rounded paddle blade',[.28,.075,.78],wood,[0,0,-1.83],.07);
    const collar=cylinder(oar,'Leather oar collar',.057,.18,dark,[0,0,0]);collar.rotation.x=Math.PI/2;
    const lock=ring(root,'Brass oarlock',.085,.025,metal,[side*1.09,.76,-.22]);lock.rotation.y=Math.PI/2;
  }
  tube(root,'Bow painter rope',[[0,.90,2.65],[.12,.92,2.26],[.25,.56,1.9],[.48,.57,1.52]],.022,cream,24);
  for(let i=0;i<3;i++){const coil=ring(root,'Coiled bow rope',.18+i*.035,.015,cream,[.26,.57,1.4]);coil.rotation.x=Math.PI/2;}
  return finishStaticAsset(root,'rowboat',PROP_SCALE['rowboat']);
}

export function createCabinBoat(){
  const root=new Group();root.name='Marigold cabin boat';
  const paint=mat(p.yellow),cream=mat(p.cream),navy=mat(p.navy),wood=mat(p.woodLight),glass=mat('#477b85',.22,.2),metal=mat(p.metal,.3,.4),coral=mat(p.coral);
  hull(root,7.4,2.75,paint,cream,navy);
  box(root,'Working deck',[1.90,.14,4.3],wood,[0,.25,-.50]);
  for(let i=-4;i<=4;i++)box(root,'Deck seam',[.013,.01,4.25],navy,[i*.21,.324,-.50],0);
  const cabin=new Group();cabin.name='Wheelhouse';cabin.position.set(0,.43,.45);root.add(cabin);
  box(cabin,'Cream cabin',[1.93,1.6,1.94],cream,[0,.78,0],.11);
  box(cabin,'Front windscreen',[1.64,.70,.035],glass,[0,1.05,1.0],.055);
  box(cabin,'Windscreen divider',[.07,.78,.06],cream,[0,1.05,1.04]);
  for(const side of [-1,1]){
    box(cabin,'Side window',[.045,.69,1.45],glass,[side*.977,1.05,.07],.035);
    box(cabin,'Side window divider',[.065,.75,.06],cream,[side*.992,1.05,.09]);
  }
  box(cabin,'Cabin door',[.66,1.28,.06],navy,[.3,.66,-1.0],.06);
  box(cabin,'Door window',[.48,.46,.025],glass,[.3,.91,-1.04]);
  sphere(cabin,'Brass door handle',.028,metal,[.53,.54,-1.07]);
  box(cabin,'Overhanging roof',[2.24,.19,2.23],navy,[0,1.67,0],.10);
  box(cabin,'Roof accent',[2.04,.06,2.01],cream,[0,1.79,0],.035);
  cylinder(cabin,'Mast',.027,.95,metal,[0,2.28,-.47]);
  cylinder(cabin,'Mast light',.085,.13,cream,[0,2.8,-.47]);
  box(cabin,'Radar bar',[.8,.065,.1],cream,[0,2.50,-.47]);
  for(const side of [-1,1]){
    const fender=cylinder(root,'Cream side fender',.14,.52,cream,[side*1.40,.37,-.63]);fender.rotation.z=side*.13;
    sphere(root,'Fender end',.14,cream,[side*1.44,.10,-.63]);
    tube(root,'Fender rope',[[side*1.34,.70,-.62],[side*1.42,.78,-.62],[side*1.4,.57,-.63]],.015,navy,10);
  }
  // Bow rail leaves the stern deck open and keeps the silhouette legible.
  for(const side of [-1,1]){
    tube(root,'Bow safety rail',[[side*1.20,1.03,1.47],[side*.96,1.18,2.25],[side*.55,1.31,3.10],[0,1.43,3.64]],.035,metal,24);
    for(const [x,z,y] of [[1.2,1.47,.73],[.96,2.25,.82],[.55,3.1,.94]])cylinder(root,'Rail stanchion',.026,.36,metal,[side*x,y+.13,z]);
  }
  const lifering=ring(root,'Life ring',.27,.075,coral,[-1.02,1.16,.15]);lifering.rotation.y=Math.PI/2;
  for(const z of [-2.7,-1.8])box(root,'Stern locker',[.64,.37,.61],cream,[-.66,.53,z]);
  const motor=new Group();motor.name='Outboard motor';motor.position.set(0,.47,-3.70);root.add(motor);
  box(motor,'Outboard cover',[.55,.49,.50],navy,[0,0,0],.11);
  box(motor,'Motor stripe',[.56,.07,.36],cream,[0,.03,-.08]);
  box(motor,'Outboard shaft',[.17,.81,.19],metal,[0,-.61,-.04]);
  const hub=cylinder(motor,'Propeller hub',.075,.24,metal,[0,-1.02,-.13]);hub.rotation.x=Math.PI/2;
  box(motor,'Propeller',[.44,.06,.05],navy,[0,-1.02,-.26]);
  return finishStaticAsset(root,'cabin-boat',PROP_SCALE['cabin-boat']);
}
