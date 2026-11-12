import {createGroundSquirrel,createSquirrelBatch,animateGroundSquirrel,setGroundSquirrelPose} from '../habitat/ground-squirrel/createGroundSquirrel';
import {createSurrey,animateSurrey} from './surrey';
import { createSeaOtter, updateSeaOtter, setSeaOtterPose } from '../habitat/sea-otter/createSeaOtter';
import {FURNITURE,furnitureIds,createFurniture} from './furniture';
import { createDeer, updateDeer, setDeerPose } from '../habitat/deer/createDeer';
import { createCoastalTree, TREE_SPECIES, type TreeSpecies } from '../habitat/trees/createCoastalTree';
import { createPurpleUrchin } from '../habitat/purple-urchin/createPurpleUrchin';
import { createAnemone } from '../habitat/anemone/createAnemone';
import {SIZE_REFERENCES, type PropId} from './dimensions';
import type { Group } from 'three';
import { createFishingRod } from './rods';
import { createCabinBoat, createRowboat } from './boats';
import { createOtterManSuit } from './otterMan';
import { createScubaRack } from './scuba';
import { createDock, createTackleBox } from './dock';
import { createGiantKelp } from '../habitat/giantKelp';
import { createBatStar } from '../habitat/batStar';
import { createSailingBoyStatue } from './loversPointStatues/boy';
import { createButterflyStatue } from './loversPointStatues/butterfly';
import { createMonarchButterfly, setMonarchPose, updateMonarchButterfly } from '../habitat/monarch-butterfly/createMonarchButterfly';
import { createMonarchBatch, getMonarchBatch } from '../habitat/monarch-butterfly/createMonarchBatch';
import { createWesternGull, getGullState, setGullPose, updateWesternGull } from '../habitat/western-gull/createWesternGull';
import { createGullFlock, getGullFlock } from '../habitat/western-gull/createGullFlock';

export interface PropPose {id:string;label:string;apply:(root:Group)=>void;animated?:boolean;/** Optional finite action; Replay explicitly opts into motion. */finished?:(root:Group)=>boolean;}
export interface PropEntry {id:PropId;name:string;category:'Vehicles'|'Furniture'|'Fishing gear'|'Boats'|'Dockside'|'Habitat'|'Landmarks'|'Trees'|'Special objects';description:string;create:()=>Group;/** Each create() is a new random variation (seed in userData.seed). */random?:boolean;animate?:(root:Group,dt:number)=>void;instances?:{counts:readonly number[];sizeLabel?:string;create:(count:number)=>Group;poses?:readonly PropPose[]};poses?:readonly PropPose[];}
export const propCollection:PropEntry[]=[
  {id:'otter-man-suit',name:'Otter Man exploration suit',category:'Special objects',description:'Otter helmet, cream muzzle, copper armor, sea-glass jets and a tail stabilizer. Equip at the Gym station to fly.',create:createOtterManSuit},
  {id:'spinning-rod',name:'Harbor spinning rod',category:'Fishing gear',description:'Cork grip, seafoam reel, brass details and a coral float.',create:()=>createFishingRod()},
  {id:'bamboo-rod',name:'Bamboo float rod',category:'Fishing gear',description:'A simple warm bamboo pole with wrapped nodes and an ochre float.',create:()=>createFishingRod(true)},
  {id:'rowboat',name:'Seafoam rowboat',category:'Boats',description:'An open clinker-style hull, three benches, wooden oars and a bow rope.',create:createRowboat},
  {id:'cabin-boat',name:'Marigold cabin boat',category:'Boats',description:'A little wheelhouse, open stern deck, fenders and an outboard motor.',create:createCabinBoat},
  {id:'dock',name:'Timber dock section',category:'Dockside',description:'A repeatable plank deck with timber pilings, soft rope rails and a mooring cleat.',create:createDock},
  {id:'tackle-box',name:'Coral tackle box',category:'Dockside',description:'A rounded case with a cream lid, carry handle and brass latches.',create:createTackleBox},
  {id:'scuba-rack',name:'Scuba gear rack',category:'Dockside',description:'A dive locker crate with a folded wetsuit, upright tank, mask and fins.',create:createScubaRack},
  {id:'giant-kelp',name:'Giant kelp',category:'Habitat',description:'Monterey Bay\'s forest-forming brown alga: branching holdfast, flexible stipes, a gas bladder at each blade and a surface canopy.',create:()=>createGiantKelp(),random:true},
  {id:'bat-star',name:'Bat star',category:'Habitat',description:'A native Monterey sea star with five broad webbed arms. It clings to surfaces and creeps almost imperceptibly.',create:()=>createBatStar(),random:true},
  {id:'purple-sea-urchin',name:'Purple sea urchin',category:'Habitat',description:'A tiny purple grazer with blunt spines and fine tube feet; real-time surface crawling.',create:()=>createPurpleUrchin(),random:true},
  {id:'giant-green-anemone',name:'Giant green anemone',category:'Habitat',description:'A broad olive oral disc, recessed mouth and three staggered rows of fleshy mint-green tentacles. The reef uses a lighter instanced version.',create:()=>createAnemone({species:'giant-green',seed:14})},
  {id:'sailing-boy-statue',name:'Lovers Point · sailing boy',category:'Landmarks',description:'A stylized study of Dorothy Fowler’s Yesterday’s Dream—Tomorrow’s Memory: a bronze boy reaching forward with a model sailboat, standing on granite.',create:createSailingBoyStatue},
  {id:'butterfly-statue',name:'Lovers Point · Monarch Butterfly',category:'Landmarks',description:'A stylized study of Gordon Newell’s granite Monarch Butterfly: folded, raised wings above a tall stone pedestal.',create:createButterflyStatue},
  {id:'monarch-butterfly',name:'Monarch butterfly',category:'Habitat',description:'Orange and cream-spotted wings, dark veins and a muted leaf-brown underside. A living monarch with wingbeats and gentle glides, native to the wider Monterey region.',create:createMonarchButterfly,random:true,
    instances:{counts:[1,32,128,256],sizeLabel:'8.5–12 cm wingspan · varied sizes',create:count=>createMonarchBatch({count,capacity:count}).root},
    animate:(root,dt)=>{const batch=getMonarchBatch(root);if(batch)batch.update(dt);else updateMonarchButterfly(root,dt);},poses:[
    {id:'flight',label:'Flying',apply:root=>{setMonarchPose(root,'flight');getMonarchBatch(root)?.setPose('flight');},animated:true},
    {id:'basking',label:'Wings open',apply:root=>{setMonarchPose(root,'basking');getMonarchBatch(root)?.setPose('basking');}},
    {id:'perched',label:'Wings folded',apply:root=>{setMonarchPose(root,'perched');getMonarchBatch(root)?.setPose('perched');}},
  ]},
];

for (const variant of ['adult','fawn'] as const) {
  propCollection.push({id:variant==='adult'?'black-tailed-deer':'black-tailed-fawn',
    name:variant==='adult'?'Black-tailed deer · doe':'Black-tailed deer · fawn',category:'Habitat',
    description:variant==='adult'?'A local Columbian black-tailed doe with long ears, a dark tail and a soft brown coat.':'A young black-tailed deer with large ears, slender legs and cream spots. Stays close to its mother in the Gym.',
    create:()=>createDeer({variant}).root,random:true,animate:updateDeer,
    poses:[
      {id:'idle',label:'Standing',apply:root=>setDeerPose(root,'idle',0)},
      {id:'walk',label:'Walking',animated:true,apply:root=>setDeerPose(root,'walk',0)},
      {id:'gallop',label:'Galloping',animated:true,apply:root=>setDeerPose(root,'gallop',0)},
      {id:'eat',label:'Grazing',animated:true,apply:root=>setDeerPose(root,'eat',0)},
    ]});
}

for (const sex of ['male','female'] as const) {
  propCollection.push({id:`western-gull-${sex}`,name:`Western gull · ${sex}`,category:'Habitat',
    description:`A stylized Monterey Bay seagull with dark wingtips, a yellow bill and pink webbed feet. ${sex==='female'?'Cream body and lavender-gray wings are an artistic color distinction.':'The male retains the neutral cream and slate palette.'} The ${sex} specimen is ${sex==='male'?'slightly larger':'slightly smaller'}.`,
    create:()=>createWesternGull({sex}),random:true,
    instances:{counts:[1,32,256,1024],sizeLabel:`${sex==='male'?'1.37':'1.26'} m wingspan · sky flock`,create:count=>createGullFlock({sex,count}).root,
      poses:[{id:'flight',label:'Flying · flaps and glides',animated:true,apply:()=>{}}]},
    animate:(root,dt)=>{const flock=getGullFlock(root);if(flock)flock.update(dt);else updateWesternGull(root,dt);},
    poses:[
      {id:'flight',label:'Flying · flaps and glides',animated:true,apply:root=>setGullPose(root,'flight')},
      {id:'standing',label:'Standing',apply:root=>setGullPose(root,'standing')},
      {id:'walking',label:'Walking in place',animated:true,apply:root=>setGullPose(root,'walking')},
      {id:'pooping',label:'Pooping · once',animated:true,apply:root=>setGullPose(root,'pooping'),finished:root=>getGullState(root)?.pose!=='pooping'},
    ]});
}

for (const species of Object.keys(TREE_SPECIES) as TreeSpecies[]) {
  const record=TREE_SPECIES[species];
  propCollection.push({id:species,name:record.name,category:'Trees',description:record.botanical+'. '+(record.native?'Native to the Monterey region.':'Introduced park planting; inventory silhouette proxy.')+' '+({cypress:'Broad wind-shaped crowns and exposed branching.',pine:'An open trunk with layered evergreen crowns.',oak:'A broad, rounded evergreen crown.',palm:'Arching green fronds above a tall trunk.',cordyline:'A slender trunk and pointed leaf rosette.',holly:'A compact evergreen crown; exact species is unconfirmed.'}[record.form]),create:()=>createCoastalTree({species}),random:true});
}

propCollection.push(...furnitureIds.map((id):PropEntry=>({id,name:FURNITURE[id].name,category:'Furniture',description:'Shared with the Lovers Point scenery. Photo-informed design with provisional metre dimensions.',create:()=>createFurniture(id)})));
propCollection.push({id:'aggregating-anemone',name:'Aggregating anemone',category:'Habitat',description:'The small pink-tipped anemone already used in the Gym reef. Provisional five-centimetre disc; stylized colors.',create:()=>createAnemone({species:'aggregating',seed:14})});

propCollection.push({id:'southern-sea-otter',name:'Southern sea otter',category:'Habitat',
    description:'A Monterey coast sea otter with a pale whiskered face, small front paws and broad webbed hind feet. Float on its back, swim, groom or tuck into a dive.',
    create:()=>createSeaOtter().root,random:true,animate:updateSeaOtter,
    poses:[
      {id:'float',label:'Floating',animated:true,apply:root=>setSeaOtterPose(root,'float',0)},
      {id:'swim',label:'Swimming',animated:true,apply:root=>setSeaOtterPose(root,'swim',0)},
      {id:'groom',label:'Grooming',animated:true,apply:root=>setSeaOtterPose(root,'groom',0)},
      {id:'dive',label:'Diving',animated:true,apply:root=>setSeaOtterPose(root,'dive',0)},
    ]});

export {SIZE_REFERENCES};

propCollection.push({id:'pedal-surrey',name:'Pedal surrey',category:'Vehicles',description:'Photo-informed green pedal surrey with yellow canopy. Provisional 2.26 m length; ride it in the Gym.',create:()=>createSurrey().root,animate:animateSurrey});

propCollection.push({id:'california-ground-squirrel',name:'California ground squirrel',category:'Habitat',description:'A gray-brown rockside squirrel with a pale belly, small upright ears and bushy tail. Requested by Ramero1993.',create:()=>createGroundSquirrel().root,random:true,animate:animateGroundSquirrel,
 instances:{counts:[1,8,32],sizeLabel:'43 cm nose to tail · representative adult',create:count=>createSquirrelBatch({count}).root},
 poses:([{id:'alert',label:'Alert'},{id:'forage',label:'Foraging'},{id:'scurry',label:'Scurrying'}] as const).map(p=>({...p,animated:true,apply:root=>setGroundSquirrelPose(root,p.id)}))});
