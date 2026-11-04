import { Group, Sphere } from 'three';
import { fishCollection } from '../models/catalogue';
import type { FishModel } from '../models/types';
import { createSardineSchool, type SardineSchool } from '../models/pacific-sardine/createSardineSchool';
import { SWIM_SPEED } from './swimPath';
import { createDemoRoute, creatureRadius } from './demoRoute';
import { createDemoSchool } from './demoSchool';
import { DEMO_POPULATION, DEMO_SCHOOLS, DEMO_BUDGET, demoHabitat } from './demoPopulation';
export { DEMO_POPULATION, DEMO_BUDGET } from './demoPopulation';
export type DemoModel=FishModel|SardineSchool|ReturnType<typeof createDemoSchool>;

// Repeatable, species-independent offsets make every group drift at its own pace
// without changing simulation time, geometry, or draw-call count.
function variation(index:number,salt:number){
  const value=Math.sin((index+1)*127.1+salt*311.7)*43758.5453123;
  return value-Math.floor(value);
}

export function createTankDemo(){
  const root=new Group();root.name='tank-demo';root.userData.units='metres';
  const members:{speciesId:string;model:DemoModel;route:ReturnType<typeof createDemoRoute>;tempo:number;phase:number;wanderA:number;wanderB:number}[]=[];
  let disposed=false,elapsed=0;
  try{
    for(const entry of fishCollection){
      // Explicit population entries are the demo whitelist. Full-size assets such as
      // the gray whale remain inspectable without being placed in this small exhibit.
      const count=DEMO_POPULATION[entry.id];
      if(count===undefined)continue;
      const sardines=entry.id==='pacific-sardine',traits=DEMO_SCHOOLS[entry.id];
      for(let i=0;i<(sardines||traits?1:count);i++){
        const model=sardines?createSardineSchool({count,capacity:count}):traits?createDemoSchool(entry,count,traits):entry.create();
        root.add(model.root);
        for(let t=0;t<(members.length%13);t++)model.update(.07);
        const sphere='bounds' in model?model.bounds.getBoundingSphere(new Sphere()):undefined;
        const radius=sphere?sphere.radius+sphere.center.length()+.08:creatureRadius(model);
        const index=members.length,habitat=demoHabitat(entry.id,i);
        const tempo=.78+variation(index,0)*.65,phase=variation(index,1)*Math.PI*2;
        const wanderA=.25+.18*variation(index,2),wanderB=.10+.13*variation(index,3);
        model.setSwimMode('slow',true);
        const verticalRadius=traits&&habitat.wave===0&&'bounds' in model
          ?Math.max(Math.abs(model.bounds.min.y),Math.abs(model.bounds.max.y))+radius*.12+.08:undefined;
        // Brisker school travel suits the wide exhibit; individual species retain
        // their catalogue speeds. All travel speeds are artistic choices.
        const speed=sardines?{slow:.55,fast:1.25}:entry.swimSpeed??SWIM_SPEED;
        // Surface animals start beside the controls, in the open right window.
        const start=entry.id==='southern-sea-otter'?.05:sardines?.28:traits?.7:undefined;
        let route:ReturnType<typeof createDemoRoute>;
        try{route=createDemoRoute(model,{index,radius,verticalRadius,habitat,speed,start});}catch(error){model.dispose();throw error;}
        members.push({speciesId:entry.id,model,route,tempo,phase,wanderA,wanderB});
      }
    }
  }catch(error){members.forEach(({model})=>model.dispose());root.removeFromParent();throw error;}
  const count=members.reduce((total,{model})=>total+('count' in model?model.count:1),0);
  const speciesCount=new Set(members.map(member=>member.speciesId)).size;
  root.userData.population=count;root.userData.species=speciesCount;root.userData.budget=DEMO_BUDGET;
  return {root,members,count,speciesCount,
    update(dt:number){
      if(disposed||!Number.isFinite(dt)||dt<=0)return;
      const step=Math.min(dt,.1);elapsed+=step;
      for(const {model,route,tempo,phase,wanderA,wanderB} of members){
        const pace=Math.max(.6,Math.min(1.6,tempo+.10*Math.sin(elapsed*wanderA+phase)+.08*Math.sin(elapsed*wanderB+phase*1.7)));
        model.update(step*pace);route.update(step*pace,model.getState().blend);
      }
    },
    dispose(){if(disposed)return;disposed=true;members.forEach(({model})=>model.dispose());root.removeFromParent();},
  };
}
