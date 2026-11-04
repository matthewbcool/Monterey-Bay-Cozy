import { CylinderGeometry, DodecahedronGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { createCabinBoat, createRowboat } from '../models/props/boats';
import { createDock, createTackleBox } from '../models/props/dock';
import { DOCK_DECK_METRES } from '../models/props/dimensions';
import { createFishingRod } from '../models/props/rods';
import { box, cylinder, disposeObject, mat, palette, tube } from '../models/props/primitives';
import { createWater, sampleWater } from './water';
import {createSeabed} from './seabed';
import {finishStaticAsset} from '../models/shared/staticAsset';
import {seabedDepth} from './bathymetry';
import {createPacificSardineModel} from '../models/pacific-sardine/createPacificSardineModel';
import {createBlueRockfishModel} from '../models/blue-rockfish/createBlueRockfishModel';
import { createUrchinColony } from '../models/habitat/purple-urchin/colony';
import { createBatStarColony } from '../models/habitat/batStarColony';
import { surfaceAnchorFromHit } from '../models/shared/surfaceAttachment';

export function createHarbor(){
  const root=new Group();root.name='Dockside water study';
  const water=createWater({width:32,depth:24});root.add(water.root);
  const seabed=createSeabed();root.add(seabed.root);
  root.updateMatrixWorld(true);
  const ray=new Raycaster(),instance=new Matrix4(),origin=new Vector3();
  const rockAnchor=(instanceId:number)=>{
    seabed.rocks.getMatrixAt(instanceId,instance);origin.setFromMatrixPosition(instance).applyMatrix4(seabed.rocks.matrixWorld);origin.y+=1;
    ray.set(origin,new Vector3(0,-1,0));const hit=ray.intersectObject(seabed.rocks,false).find(hit=>hit.instanceId===instanceId);
    if(!hit)throw new Error('Missing seabed rock contact');return surfaceAnchorFromHit(hit);
  };
  const starAnchors=[7,8,13].map(rockAnchor);
  const urchins=createUrchinColony([4,6,10,12,15,17].map(rockAnchor));root.add(urchins.root);urchins.update(0);
  const seaStars=createBatStarColony(starAnchors);root.add(seaStars.root);seaStars.update(0);
  const wildlife=[createPacificSardineModel(),createPacificSardineModel(),createBlueRockfishModel()];
  wildlife.forEach(f=>root.add(f.root));
  const sand=new MeshStandardMaterial({color:'#ccb984',roughness:1}),grass=mat('#858f5d');
  const island=new Mesh(new CylinderGeometry(6.5,6.8,.60,48),sand);island.scale.z=1.15;island.position.set(-11,.06,0);island.receiveShadow=true;root.add(island);
  const bank=new Mesh(new CylinderGeometry(5.1,5.5,.35,40),grass);bank.scale.z=1.13;bank.position.set(-12,.4,0);bank.receiveShadow=true;root.add(bank);
  const dock=createDock();dock.rotation.y=-Math.PI/2;dock.position.set(-4.0,0,0);root.add(dock);
  const approach=createDock();approach.rotation.y=-Math.PI/2;approach.position.set(-7.0,0,0);root.add(approach);
  const rowboat=createRowboat();rowboat.position.set(-3.0,0,3.5);rowboat.rotation.y=-Math.PI/2+.08;root.add(rowboat);
  const cabinBoat=createCabinBoat();cabinBoat.position.set(2.9,0,-2.0);cabinBoat.rotation.y=-.37;root.add(cabinBoat);
  const tackle=createTackleBox();tackle.position.set(-5.0,DOCK_DECK_METRES,.28);tackle.rotation.y=.6;root.add(tackle);
  const rod=createFishingRod();rod.position.set(-3.2,DOCK_DECK_METRES,-.42);rod.rotation.z=-.45;rod.rotation.y=-Math.PI/2;root.add(rod);
  const bamboo=createFishingRod(true);bamboo.position.set(-7.3,DOCK_DECK_METRES,.40);bamboo.rotation.z=.18;bamboo.rotation.y=1.9;root.add(bamboo);
  const wood=mat(palette.woodDark),rope=mat(palette.cream);
  cylinder(root,'Rod holder',.055,.22,wood,[-3.2,DOCK_DECK_METRES+.11,-.42]);
  tube(root,'Slack mooring rope',[[-2.68,.68,.56],[-2.7,.18,2.0],[-2.9,.50,3.6]],.025,rope,26);
  const stone=mat('#858d7b');
  for(let i=0;i<14;i++){
    const a=-1.4+i*.215,x=-11+Math.cos(a)*6.1,z=Math.sin(a)*6.95;
    const rockGeo=new DodecahedronGeometry(.4+(i%3)*.18,0);rockGeo.computeVertexNormals();const rock=new Mesh(rockGeo,stone);rock.position.set(x,.3,z);rock.scale.set(1.4,.7,1);rock.rotation.set(i*.31,i*.73,0);rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
  }
  // Small grass tufts keep the shore readable without making it the asset focus.
  const blade=mat('#6b7d4b');
  for(const [x,z] of [[-8.5,4.3],[-9.0,-3.9],[-13,4.1],[-13,-4.2]])for(let i=0;i<5;i++){
    const g=box(root,'Coastal grass',[.055,.40+i*.045,.09],blade,[x+(i-2)*.1,.78,z+Math.sin(i)*.12],.01);g.rotation.z=(i-2)*.17;
  }
  // Pier extensions reach the actual shelf, instead of stopping in empty water.
  for(const x of [-8.45,-5.55,-5.45,-2.55])for(const z of [-.48,.48]){
    const bottom=-seabedDepth(x,z),top=-1.05;
    cylinder(root,'Submerged piling',.085,top-bottom,wood,[x,(bottom+top)/2,z]);
  }
  // Collapse static shore details/piling extensions to one palette batch.
  const scenery=new Group();scenery.name='Batched shore and pier supports';
  for(const child of [...root.children])if(child instanceof Mesh&&child.material instanceof MeshStandardMaterial)scenery.add(child);
  root.add(finishStaticAsset(scenery,'shore-setting',[1,1,1],{rim:false})); // terrain: no rim
  let chop=.75,previousTime=0;
  const floats=[{root:rowboat,x:-3.0,z:3.5,yaw:-Math.PI/2+.08},{root:cabinBoat,x:2.9,z:-2.0,yaw:-.37}];
  return {root,water,floats,seabed,wildlife,seaStars,urchins,setChop(value:number){chop=value;water.setChop(value);},update(time:number){
    water.update(time);seabed.update(time);
    const dt=Math.max(0,Math.min(.1,time-previousTime));previousTime=time;
    seaStars.update(dt);urchins.update(dt);
    wildlife.forEach((fish,i)=>{const phase=time*.14+i*.8;fish.root.position.set(-.4+Math.cos(phase)*1.15,-2.0-i*.20+Math.sin(phase*.7)*.09,Math.sin(phase)*.7+1.3-i*.4);fish.root.rotation.y=-phase+Math.PI/2;fish.update(dt);});
    for(const boat of floats){
      const sample=sampleWater(boat.x,boat.z,time,chop);
      boat.root.position.y=sample.height;
      // Match the surface normal in the boat's local heading; bounded gentle motion.
      const dx=sample.dx*Math.cos(boat.yaw)-sample.dz*Math.sin(boat.yaw);
      const dz=sample.dx*Math.sin(boat.yaw)+sample.dz*Math.cos(boat.yaw);
      boat.root.rotation.set(Math.atan(dz)*.65,boat.yaw,-Math.atan(dx)*.65,'YXZ');
    }
  },dispose(){urchins.dispose();seaStars.dispose();water.dispose();wildlife.forEach(f=>f.dispose());disposeObject(root);}};
}
