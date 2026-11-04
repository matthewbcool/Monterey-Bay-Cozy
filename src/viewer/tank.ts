import { BufferGeometry, Group, Material, Mesh, type Object3D } from 'three';
import { TANK_SIZE } from './swimPath';
import { createGalleryScenery } from './openSea/scenery';
import { createTankWater } from './openSea/waterLook';

/** Metre-scale Open Sea gallery; depth/height remain artistic inspection dimensions. */
export function createTank(){
  const root=new Group();root.name='Open Sea exhibit';
  const {width:w,height:h,depth:d}=TANK_SIZE;
  root.userData={units:'metres',windowWidthMeters:w,dimensionsBasis:'90 ft window width from MBA; 9 m height / 12 m depth are artistic, not surveyed',reference:'open-sea-rw11-472composite.webp'};
  const water=createTankWater(w,h,d),scenery=createGalleryScenery(w,h,d),gallery=scenery.root;root.add(water.root,gallery);
  let previousTime=0,disposed=false;
  return {root,water,gallery,visitors:scenery.visitors,shadeCreature(creature:Object3D){water.shadeCreature(creature);},update(elapsed:number){
    if(disposed||!Number.isFinite(elapsed)||elapsed<previousTime)return;
    previousTime=elapsed;water.update(elapsed);scenery.visitors.update(elapsed);
  },dispose(){if(disposed)return;disposed=true;water.dispose();scenery.visitors.dispose();
    const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
    gallery.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
  }};
}
