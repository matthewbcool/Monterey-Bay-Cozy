import { SEA_OTTER } from '../habitat/sea-otter/definition';
import {ANEMONES,ANEMONE_BUDGET} from '../habitat/anemone/definition';
import {FURNITURE_SCALE,FURNITURE_BUDGETS,FURNITURE_REFERENCES} from './furniture';
import { DEER } from '../habitat/deer/definition';
import { TREE_SPECIES } from '../habitat/trees/createCoastalTree';
import { GULL } from '../habitat/western-gull/definition';
/** All public asset geometry, pivots and scene placement use metres (+Y up).
 * References establish a representative size, not a replica or measurement of our art.
 * Source builders may use design-space proportions; finishing bakes this conversion.
 */
export const PROP_SCALE = {
  'pedal-surrey':[1,1,1],
  'southern-sea-otter': [1,1,1],
  ...FURNITURE_SCALE,
  'aggregating-anemone':[1,1,1],
  'black-tailed-deer': [1,1,1],
  'black-tailed-fawn': [1,1,1],
  'monterey-cypress': [1,1,1],
  'monterey-pine': [1,1,1],
  'coast-live-oak': [1,1,1],
  'pohutukawa': [1,1,1],
  'canary-island-date-palm': [1,1,1],
  'cabbage-tree': [1,1,1],
  'inventory-holly': [1,1,1],

  'otter-man-suit': [1,1,1],
  'spinning-rod': [2.1336/4.57,2.1336/4.57,2.1336/4.57],
  'bamboo-rod': [3.6576/4.77,3.6576/4.77,3.6576/4.77],
  'rowboat': [1.45/2.15,.62,3.8/5.6],
  'cabin-boat': [2.40/2.75,1,5.52/7.4],
  'dock': [.5,.62,3/5.3],
  'tackle-box': [.41/1.3,.21/.745,.23/.7725],
  'scuba-rack': [1,1,1], // authored directly in metres
  'giant-kelp': [1,1,1], // authored directly in metres
  'bat-star': [1,1,1],
  'purple-sea-urchin': [1,1,1],
  'giant-green-anemone': [1,1,1],
  'sailing-boy-statue': [1,1,1],
  'butterfly-statue': [1,1,1],
  'monarch-butterfly': [1,1,1],
  'western-gull-male': [1,1,1],
  'western-gull-female': [1,1,1],
} as const;
export const DOCK_DECK_METRES=.73*PROP_SCALE.dock[1];
export const PROP_BUDGETS = {
  'pedal-surrey':{triangles:3000,drawCalls:6},
  'southern-sea-otter': {triangles:SEA_OTTER.budget.near,drawCalls:1},
  ...FURNITURE_BUDGETS,
  'aggregating-anemone':ANEMONE_BUDGET,
  'black-tailed-deer': {triangles:DEER.budget.near,drawCalls:1},
  'black-tailed-fawn': {triangles:DEER.budget.near,drawCalls:1},
  'monterey-cypress': {triangles:260,drawCalls:1},
  'monterey-pine': {triangles:260,drawCalls:1},
  'coast-live-oak': {triangles:260,drawCalls:1},
  'pohutukawa': {triangles:260,drawCalls:1},
  'canary-island-date-palm': {triangles:260,drawCalls:1},
  'cabbage-tree': {triangles:260,drawCalls:1},
  'inventory-holly': {triangles:260,drawCalls:1},

  'otter-man-suit': {triangles:5000,drawCalls:1},
  'spinning-rod': {triangles:2200,drawCalls:2},
  'bamboo-rod': {triangles:1200,drawCalls:2},
  'rowboat': {triangles:4000,drawCalls:2},
  'cabin-boat': {triangles:4500,drawCalls:2},
  'dock': {triangles:2500,drawCalls:2},
  'tackle-box': {triangles:600,drawCalls:2},
  'scuba-rack': {triangles:600,drawCalls:1},
  'giant-kelp': {triangles:2200,drawCalls:1}, // 6 m plant, random 2–4 fronds (worst case over 60 seeds is tested); one double-sided batch
  'bat-star': {triangles:850,drawCalls:1},
  'purple-sea-urchin': {triangles:2000,drawCalls:1},
  'giant-green-anemone': {triangles:2000,drawCalls:1},
  'sailing-boy-statue': {triangles:2400,drawCalls:1},
  'butterfly-statue': {triangles:1000,drawCalls:1},
  'monarch-butterfly': {triangles:1000,drawCalls:1},
  'western-gull-male': GULL.budget,
  'western-gull-female': GULL.budget,
} as const;
export type PropId=keyof typeof PROP_SCALE;
export const SIZE_REFERENCES = {
  'pedal-surrey':{label:'2.26 m long · 1.52 m canopy · provisional',basis:'Estimated from supplied front and oblique photographs, not a manufacturer measurement.',url:null},
  'southern-sea-otter': {label:'1.00–1.50 m adult range · 1.20 m specimen',basis:SEA_OTTER.sizeBasis,url:SEA_OTTER.source},
  ...FURNITURE_REFERENCES,
  'aggregating-anemone':{label:'5 cm disc · 4 cm column (provisional)',basis:ANEMONES.aggregating.sizeBasis,url:ANEMONES.aggregating.source},
  'black-tailed-deer': {label:'1.35–1.65 m body length · 1.58 m authored doe',basis:'California State Parks broad mule/black-tailed deer body-length range; not a measured Monterey population. Shoulder 0.86 m is authored. '+DEER.sizeBasis,url:'https://www.parks.ca.gov/pages/735/files/Natural%20History%20ADA%20compressed.pdf'},
  'black-tailed-fawn': {label:'0.96 m spotted fawn · 0.58 m shoulder (authored)',basis:DEER.sizeBasis,url:DEER.localSource},
  'monterey-cypress': {label: TREE_SPECIES['monterey-cypress'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['monterey-cypress'].botanical,url:TREE_SPECIES['monterey-cypress'].url},
  'monterey-pine': {label: TREE_SPECIES['monterey-pine'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['monterey-pine'].botanical,url:TREE_SPECIES['monterey-pine'].url},
  'coast-live-oak': {label: TREE_SPECIES['coast-live-oak'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['coast-live-oak'].botanical,url:TREE_SPECIES['coast-live-oak'].url},
  'pohutukawa': {label: TREE_SPECIES['pohutukawa'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['pohutukawa'].botanical,url:TREE_SPECIES['pohutukawa'].url},
  'canary-island-date-palm': {label: TREE_SPECIES['canary-island-date-palm'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['canary-island-date-palm'].botanical,url:TREE_SPECIES['canary-island-date-palm'].url},
  'cabbage-tree': {label: TREE_SPECIES['cabbage-tree'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['cabbage-tree'].botanical,url:TREE_SPECIES['cabbage-tree'].url},
  'inventory-holly': {label: TREE_SPECIES['inventory-holly'].height+' m specimen · estimated',basis:'Authored height and crown proportions. Static, seeded silhouette; neither a surveyed park individual nor a species maximum. '+TREE_SPECIES['inventory-holly'].botanical,url:TREE_SPECIES['inventory-holly'].url},

  'otter-man-suit': {label:'1.47 m display suit; fits avatar size',basis:'Original fictional otter-inspired exploration armor; all dimensions are authored.',url:null},
  'spinning-rod': {label:'2.13 m rod (7 ft)',basis:'Representative 7-foot spinning rod; curved shaft length, not hanging-line bounds.',url:'https://www.uglystik.com/collections/spinning-rods/products/gx2-spinning-rod-1624495'},
  'bamboo-rod': {label:'3.66 m pole (12 ft)',basis:'Representative 12-foot bamboo pole; curved shaft length.',url:'https://images.carid.com/bnm-fishing/products/pdf/bnm-fishing-product-catalog.pdf'},
  'rowboat': {label:'3.80 m hull · 1.45 m beam',basis:'Provisional small recreational rowboat design target. Exact boat and measured dimensions are not established.',url:null},
  'cabin-boat': {label:'5.52 m hull · 2.40 m beam',basis:'Representative small cabin-boat size from Beneteau Antares 6 hull specifications. Original design, not a replica; fittings extend beyond hull.',url:'https://brochures.beneteau.com/antares/FR/publication/contents/templates/BNT_ANTARES_2022.pdf'},
  'dock': {label:'3.00 × 1.20 m deck',basis:'Provisional modular dock design target; 0.45 m deck height above local water datum.',url:null},
  'scuba-rack': {label:'62 × 42 cm crate · 0.58 m tank',basis:'Artistic dive-locker display for the cabin boat deck. The tank is shortened from a typical 0.66 m aluminium 80 cylinder to suit the stylized avatar; not a product replica.',url:null},
  'giant-kelp': {label:'6.0 m plant · 2–4 fronds',basis:'Shallow-water inspection height; giant kelp commonly reaches about 30 m (up to 53 m). Anatomy from the Monterey Bay Aquarium species page; counts, spacing and blade size are stylized.',url:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-kelp'},
  'bat-star': {label:'18 cm across · five webbed arms',basis:'Artistic 18 cm bat star (Patiria miniata), below the Aquarium reference maximum of 20 cm. Five-arm shape, hues, markings and crawl speed are stylized.',url:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-star'},
  'giant-green-anemone': {label:'14 cm disc · 5.5 cm column (authored)',basis:'Representative Anthopleura xanthogrammica with an approximately 18 cm crown. Aquarium crown reference up to 17.8 cm, checked October 25; photos have no scale. Dimensions, tentacle count and colors are authored.',url:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-green-anemone'},
  'purple-sea-urchin': {label:'5 cm test · about 7 cm with spines',basis:'Representative adult, not a photo measurement. Grazing at 1 cm/min is a conservative choice below published active escape speeds.',url:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/purple-sea-urchin'},
  'tackle-box': {label:'41 × 23 × 21 cm case',basis:'Representative Plano three-tray case dimensions; raised handle adds to overall height.',url:'https://planofishing.com.au/product/three-tray-tackle-box/'},
  'sailing-boy-statue': {label:'About 2 m including boulder · provisional',basis:'Photo-proportioned reconstruction of Dorothy Fowler’s life-size bronze. Overall height and hidden surfaces are artistic estimates, not site measurements.',url:'https://www.pghsaa.org/newsletters/KOII-March-2014-Sm.pdf'},
  'butterfly-statue': {label:'About 1.75 m including pedestal · provisional',basis:'Photo-proportioned study of Gordon Newell’s granite Monarch Butterfly. Exact dimensions and the hidden back remain unmeasured.',url:'https://www.93950.com/public.htm'},
  'monarch-butterfly': {label:'8.5–12 cm wingspan · 10 cm specimen',basis:'Florida Museum adult wingspan range. The representative span is selected; body proportions, simplified markings and wingbeat timing are artistic choices.',url:'https://www.floridamuseum.ufl.edu/wildflowers/butterfly/monarch/'},
  'western-gull-male': {label:'56–66 cm adult length · 65 cm male specimen · 1.37 m wingspan',basis:GULL.sizeBasis,url:GULL.source},
  'western-gull-female': {label:'56–66 cm adult length · 60 cm female specimen · 1.26 m wingspan',basis:GULL.sizeBasis,url:GULL.source},
} as const;
