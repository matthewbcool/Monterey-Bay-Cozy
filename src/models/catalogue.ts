import { createGiantPacificOctopusModel } from './giant-pacific-octopus/createGiantPacificOctopusModel';
import { createGiantSeaBassModel } from './giant-sea-bass/createGiantSeaBassModel';
import { createGreatWhiteSharkModel } from './great-white-shark/createGreatWhiteSharkModel';
import { createGreenSeaTurtleModel } from './green-sea-turtle/createGreenSeaTurtleModel';
import { createGrayWhaleModel } from './gray-whale/createGrayWhaleModel';
import { createSeaOtterModel } from './sea-otter/createSeaOtterModel';
import { createMoonJellyModel } from './moon-jelly/createMoonJellyModel';
import { createGaribaldiModel } from './garibaldi/createGaribaldiModel';
import { createLingcodModel } from './lingcod/createLingcodModel';
import { createTunaModel } from './tuna/createTunaModel';
import { createPacificSardineModel } from './pacific-sardine/createPacificSardineModel';
import { createBlueRockfishModel } from './blue-rockfish/createBlueRockfishModel';
import { createOceanSunfishModel } from './ocean-sunfish/createOceanSunfishModel';
import { createCaliforniaSheepheadModel } from './california-sheephead/createCaliforniaSheepheadModel';
import { createKelpGreenlingModel } from './kelp-greenling/createKelpGreenlingModel';
import { createChinookSalmonModel } from './chinook-salmon/createChinookSalmonModel';
import type { FishModel } from './types';
import { speciesSizeRanges, type SpeciesSizeRange } from './sizeRanges';

export interface FishEntry { id:string; name:string; number:string; description:string; reference:string; sizeRange:SpeciesSizeRange; swimSpeed?:{readonly slow:number;readonly fast:number}; motionLabels?:{slow:string;fast:string;cycle?:string}; create:()=>FishModel; }
/** Register each future fish here; the viewer consumes the same model contract. */
export const fishCollection: readonly FishEntry[] = [{
  id:'tuna',sizeRange:speciesSizeRanges['tuna'],name:'Tuna',number:'001',
  description:'A study in silver, blue, and motion.',
  reference:'https://www.fisheries.noaa.gov/species/pacific-bluefin-tuna',
  create:()=>createTunaModel(),
}, {
  id:'pacific-sardine',sizeRange:speciesSizeRanges['pacific-sardine'], name:'Pacific sardine', number:'002',
  description:'A slender silver schooling fish with a spotted flank and forked tail.',
  reference:'https://www.fisheries.noaa.gov/species/pacific-sardine',
  swimSpeed:{slow:.18,fast:.72}, create:()=>createPacificSardineModel(),
}, {
  id:'blue-rockfish',sizeRange:speciesSizeRanges['blue-rockfish'], name:'Blue rockfish', number:'003',
  description:'A slate-blue kelp-forest fish with a deep body and spiny dorsal.',
  reference:'https://montereybay.noaa.gov/gallery/photos-and-videos.html',
  swimSpeed:{slow:.14,fast:.60}, create:()=>createBlueRockfishModel(),
}, {
  id:'ocean-sunfish',sizeRange:speciesSizeRanges['ocean-sunfish'], name:'Ocean sunfish', number:'004',
  description:'A silvery ocean sunfish with a deep disc body, tall paddling fins and a scalloped clavus.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/ocean-sunfish',
  swimSpeed:{slow:.28,fast:.66}, create:()=>createOceanSunfishModel(),
}, {
  id:'california-sheephead',sizeRange:speciesSizeRanges['california-sheephead'], name:'California sheephead', number:'005',
  description:'A male sheephead with a dark forehead, coral-red midriff, white chin and small canines.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead',
  swimSpeed:{slow:.18,fast:.62}, create:()=>createCaliforniaSheepheadModel(),
}, {
  id:'kelp-greenling',sizeRange:speciesSizeRanges['kelp-greenling'], name:'Kelp greenling', number:'006',
  description:'A freckled female greenling with golden fins, brow cirri and a long notched dorsal.',
  reference:'https://nrimp.dfw.state.or.us/mrp/default.aspx?page=74',
  swimSpeed:{slow:.14,fast:.55}, create:()=>createKelpGreenlingModel(),
}, {
  id:'chinook-salmon',sizeRange:speciesSizeRanges['chinook-salmon'], name:'Chinook salmon', number:'007',
  description:'An ocean-phase king salmon: blue-green back, bright silver flanks, black spots on back and both tail lobes, and a small adipose fin.',
  reference:'https://www.fisheries.noaa.gov/species/chinook-salmon-protected',
  swimSpeed:{slow:.30,fast:1.10}, create:()=>createChinookSalmonModel(),
}, {
  id:'garibaldi',sizeRange:speciesSizeRanges['garibaldi'], name:'Garibaldi', number:'008',
  description:'An orange adult reef fish with a deep body and heart-shaped tail.',
  reference:'https://www.montereybayaquarium.org/es/animales-y-el-oceano/animales-de-la-a-a-la-z/jaqueta-garibaldi',
  swimSpeed:{slow:.12,fast:.48}, create:()=>createGaribaldiModel(),
}, {
  id:'lingcod',sizeRange:speciesSizeRanges['lingcod'], name:'Lingcod', number:'009',
  description:'A broad-headed reef ambush predator with olive mottling, fan-shaped pectorals and small fangs.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/lingcod',
  swimSpeed:{slow:.15,fast:.85}, create:()=>createLingcodModel(),
}, {
  id:'moon-jelly',sizeRange:speciesSizeRanges['moon-jelly'], name:'Moon jelly', number:'010',
  description:'A translucent pulsing bell with four horseshoes and a short fringe.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/moon-jelly',
  swimSpeed:{slow:.015,fast:.035}, create:()=>createMoonJellyModel(),
}, {
  id:'green-sea-turtle',sizeRange:speciesSizeRanges['green-sea-turtle'], name:'Green sea turtle', number:'011',
  description:'An olive-shelled sea turtle propelled by broad front flippers, with small rear rudders.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/green-turtle',
  swimSpeed:{slow:.20,fast:.65}, create:()=>createGreenSeaTurtleModel(),
}, {
  id:'great-white-shark',sizeRange:speciesSizeRanges['great-white-shark'], name:'Great white shark', number:'012',
  description:'A powerful grey-and-white shark with five gill slits, swept pectorals and a crescent tail.',
  reference:'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/',
  swimSpeed:{slow:.70,fast:1.8}, create:()=>createGreatWhiteSharkModel(),
}, {
  id:'giant-sea-bass',sizeRange:speciesSizeRanges['giant-sea-bass'],name:'Giant sea bass',number:'013',
  description:'A heavy grey reef fish with a steep forehead, thick lips, dark flank spots and broad fins.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-sea-bass',
  swimSpeed:{slow:.16,fast:.72},create:()=>createGiantSeaBassModel(),
}, {
  id:'giant-pacific-octopus',sizeRange:speciesSizeRanges['giant-pacific-octopus'],name:'Giant Pacific octopus',number:'014',
  description:'A copper-red octopus with eight exploring arms, pale paired suckers and a pulsing mantle.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-pacific-octopus',
  swimSpeed:{slow:.045,fast:.65},motionLabels:{slow:'Slow crawl',fast:'Jet swim'},create:()=>createGiantPacificOctopusModel(),
}, {
  id:'gray-whale',sizeRange:speciesSizeRanges['gray-whale'],name:'Gray whale',number:'015',
  description:'A mottled coastal whale with a long rostrum, low dorsal knuckles and broad horizontal flukes.',
  reference:'https://www.fisheries.noaa.gov/species/gray-whale',
  swimSpeed:{slow:.8,fast:2.0},create:()=>createGrayWhaleModel(),
}, {
  id:'southern-sea-otter',sizeRange:speciesSizeRanges['southern-sea-otter'],name:'Southern sea otter',number:'016',
  description:'A pale-faced coastal otter that rests and grooms on its back at the surface, then dives to swim with its broad hind feet.',
  reference:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-otter',
  swimSpeed:{slow:.055,fast:.7},motionLabels:{slow:'Surface rest',fast:'Underwater swim',cycle:'Natural cycle'},create:()=>createSeaOtterModel(),
}];
