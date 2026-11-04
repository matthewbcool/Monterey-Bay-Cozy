/** Original, deliberately coarse blockout. All lengths are metres, not an architectural plan.
 * x follows Cannery Row toward the southeast; bay points toward the water (scene z = -bay).
 * Coordinates/room sizes are estimates fitted to the OSM outer outline and visitor maps. */
export const AQUARIUM_ANCHOR = [-121.901918, 36.618084] as const;
export const AQUARIUM_HEADING = -Math.atan2(.82, .57);
export const UPPER_FLOOR = 5.2; // Estimated floor-to-floor rise, NOT a published measurement.
export const SOURCES = {
  map: 'https://www.montereybayaquarium.org/visit/aquarium-maps',
  figures: 'https://www.montereybayaquarium.org/about-us/about-the-aquarium/newsroom/media-kits/facts-and-figures',
  exhibits: 'https://www.montereybayaquarium.org/about-us/about-the-aquarium/newsroom/media-kits/exhibit-descriptions',
};
export type Point = readonly [x: number, bay: number];
export type Floor = 0 | 1;
export interface Tank {
  id: string; name: string; center: Point; size: readonly [width: number, depth: number, height: number];
  base: number; floors: Floor[]; shape: 'octagon' | 'habitats' | 'oval'; color: string;
  evidence: string; verified: readonly ('width' | 'depth' | 'height')[];
}
export const TANKS: Tank[] = [
  {id:'habitats',name:'Monterey Bay Habitats',center:[-63,18],size:[13,28,4.1],base:0,floors:[0],shape:'habitats',color:'#448f9b',verified:[],evidence:'Published length is over 27.43 m (90 ft). This 28 m long envelope, width, height and hourglass outline are approximate.'},
  {id:'kelp',name:'Kelp Forest',center:[-45,23],size:[18,12,8.5344],base:0,floors:[0,1],shape:'octagon',color:'#4d9e89',verified:['height'],evidence:'Published tank height: 28 ft / 8.53 m. The 18 × 12 m footprint and exact location are estimated.'},
  {id:'octopus',name:'Octopus',center:[-43,-1],size:[4.2,3.2,2.6],base:0,floors:[0],shape:'octagon',color:'#9b769f',verified:[],evidence:'Small display envelope estimated from the supplied first-floor visitor map; no measured tank dimensions available.'},
  {id:'touch',name:'Touch Pools',center:[-53,65],size:[12,7,1.05],base:0,floors:[0],shape:'octagon',color:'#83b8ab',verified:[],evidence:'Grouped shallow pools, simplified to one estimated envelope. Individual basins and their depths are not measured.'},
  {id:'otters',name:'Sea Otters',center:[8,47],size:[10,9,4.572],base:0,floors:[0],shape:'octagon',color:'#559caa',verified:['height'],evidence:'Published exhibit height: 15 ft / 4.57 m. The 10 × 9 m pool-and-shore envelope is an estimate, not a water-volume calculation.'},
  {id:'open-sea',name:'Open Sea',center:[96,23],size:[15.8496,27.432,10.668],base:0,floors:[0,1],shape:'oval',color:'#426f9e',verified:['width','depth','height'],evidence:'Published tank envelope: 90 ft across × 52 ft front-to-back × 35 ft tall (27.43 × 15.85 × 10.67 m). Orientation, rounded outline and vertical placement are estimated; visitor viewing is on floor 2.'},
  {id:'deep',name:'Into the Deep displays',center:[77,37],size:[12,4,3],base:0,floors:[0],shape:'octagon',color:'#647eae',verified:[],evidence:'Placeholder grouping for several smaller Into the Deep displays. Count, sizes and partitions are approximate.'},
  {id:'jellies',name:'Jellies',center:[70,11],size:[10,3.2,2.7],base:UPPER_FLOOR,floors:[1],shape:'octagon',color:'#ae95bb',verified:[],evidence:'Simplified upper gallery display grouping from the official second-floor map; all dimensions estimated.'},
  {id:'upper-touch',name:'Upper Touch Pools',center:[-46,5],size:[9,4,1.05],base:UPPER_FLOOR,floors:[1],shape:'octagon',color:'#83b8ab',verified:[],evidence:'Upper touch-pool grouping estimated from the official second-floor map.'},
];
export interface Place {id:string; name:string; floor:Floor; point:Point; tank?:string; note:string}
export const PLACES: Place[] = [
  {id:'entrance',name:'Entrance & exit',floor:0,point:[-7,-1],note:'Front entrance on Cannery Row. Position and doorway width are approximate.'},
  {id:'cannery',name:'Hovden Cannery',floor:0,point:[-19,8],note:'Historic cannery interpretation near the main entrance. Interior envelope estimated.'},
  {id:'tide-pool',name:'Great Tide Pool',floor:0,point:[-15,33],note:'Outdoor tidal basin beyond the Ocean’s Edge galleries. Basin outline and depth are approximate.'},
  {id:'habitats',name:'Monterey Bay Habitats',floor:0,point:[-52,9],tank:'habitats',note:'Ocean’s Edge · first floor'},
  {id:'kelp',name:'Kelp Forest',floor:0,point:[-33,23],tank:'kelp',note:'Ocean’s Edge · first-floor window'},
  {id:'octopus',name:'Octopus',floor:0,point:[-39,2],tank:'octopus',note:'Ocean’s Edge · street-side gallery'},
  {id:'aviary',name:'Aviary',floor:0,point:[-55,49],note:'Walk-through aviary near the seaward end of Ocean’s Edge. Extent estimated.'},
  {id:'touch',name:'Touch Pools',floor:0,point:[-49,58],tank:'touch',note:'Seaward end of Ocean’s Edge'},
  {id:'otters',name:'Sea Otters',floor:0,point:[8,39],tank:'otters',note:'Lower viewing area near the Great Tide Pool'},
  {id:'cafe',name:'Cafe & bay deck',floor:0,point:[30,43],note:'Cafe and viewing deck. Furniture and internal service rooms omitted.'},
  {id:'auditorium',name:'Auditorium',floor:0,point:[24,12],note:'Street-side auditorium beside the east connection. Seating layout is schematic.'},
  {id:'deep',name:'Into the Deep',floor:0,point:[75,29],tank:'deep',note:'First-floor eastern wing; grouped display placeholders.'},
  {id:'upper-kelp',name:'Kelp Forest · upper window',floor:1,point:[-33,23],tank:'kelp',note:'Upper window; estimated floor height 5.2 m. Observation deck on floor 3 is omitted.'},
  {id:'upper-touch',name:'Upper Touch Pools',floor:1,point:[-38,5],tank:'upper-touch',note:'Upper Ocean’s Edge gallery'},
  {id:'jellies',name:'Jellies',floor:1,point:[70,17],tank:'jellies',note:'Upper eastern wing'},
  {id:'open-sea',name:'Open Sea',floor:1,point:[78,24],tank:'open-sea',note:'Upper eastern wing · large viewing window'},
  {id:'seabirds',name:'Seabirds',floor:1,point:[84,43],note:'Upper bay-side gallery; aviary extent and partitions estimated.'},
];
export interface Waypoint {id:string; point:Point; floor:Floor}
export const WAYPOINTS: Waypoint[] = [
  ...PLACES.map(({id,point,floor})=>({id,point,floor})),
  {id:'lobby',point:[-8,10],floor:0},{id:'west',point:[-27,10],floor:0},
  {id:'habitat-turn',point:[-52,2],floor:0},{id:'north',point:[-30,34],floor:0},
  {id:'aviary-turn',point:[-47,39],floor:0},{id:'bay-hall',point:[-8,24],floor:0},
  {id:'otter-turn',point:[8,30],floor:0},{id:'east',point:[44,12],floor:0},
  {id:'deep-entry',point:[61,12],floor:0},{id:'deep-hall',point:[75,22],floor:0},
  {id:'west-lift',point:[-27,25],floor:0},{id:'west-lift-up',point:[-27,25],floor:1},
  {id:'upper-west',point:[-27,14],floor:1},{id:'bridge-east',point:[44,14],floor:1},
  {id:'east-lift',point:[50,14],floor:0},{id:'east-lift-up',point:[50,14],floor:1},
  {id:'upper-entry',point:[61,20],floor:1},{id:'upper-bay',point:[77,43],floor:1},
];
export const EDGES: readonly (readonly [string,string])[] = [
  ['entrance','lobby'],['lobby','cannery'],['bay-hall','tide-pool'],['lobby','west'],['west','octopus'],['octopus','habitat-turn'],['habitat-turn','habitats'],
  ['west','kelp'],['kelp','north'],['north','aviary-turn'],['aviary-turn','aviary'],['aviary','touch'],
  ['lobby','bay-hall'],['bay-hall','north'],['bay-hall','otter-turn'],['otter-turn','otters'],['otters','cafe'],
  ['lobby','auditorium'],['auditorium','east'],['east','deep-entry'],['deep-entry','deep-hall'],['deep-hall','deep'],
  ['west','west-lift'],['west-lift','west-lift-up'],['west-lift-up','upper-kelp'],['west-lift-up','upper-west'],
  ['upper-west','upper-touch'],['upper-west','bridge-east'],['bridge-east','east-lift-up'],['east','east-lift'],
  ['east-lift','east-lift-up'],['east-lift-up','upper-entry'],['upper-entry','jellies'],['jellies','open-sea'],
  ['jellies','upper-bay'],['upper-bay','seabirds'],
];
export function waypointPosition(p:Waypoint):[number,number,number] {return [p.point[0],p.floor*UPPER_FLOOR,-p.point[1]];}
export function routeTo(destination:string) {
  const nodes=new Map(WAYPOINTS.map(p=>[p.id,p])),distance=new Map<string,number>([['entrance',0]]),previous=new Map<string,string>(),pending=new Set(nodes.keys());
  if(!nodes.has(destination))throw new Error('Unknown aquarium destination: '+destination);
  while(pending.size){
    const id=[...pending].sort((a,b)=>(distance.get(a)??Infinity)-(distance.get(b)??Infinity))[0];pending.delete(id);
    if(id===destination)break;
    for(const [a,b] of EDGES){const next=a===id?b:b===id?a:undefined;if(!next||!pending.has(next))continue;
      const pa=waypointPosition(nodes.get(id)!),pb=waypointPosition(nodes.get(next)!);
      const d=(distance.get(id)??Infinity)+Math.hypot(...pa.map((v,i)=>v-pb[i]));
      if(d<(distance.get(next)??Infinity)){distance.set(next,d);previous.set(next,id);}
    }
  }
  const path:Waypoint[]=[];let id:string|undefined=destination;
  while(id){path.unshift(nodes.get(id)!);id=previous.get(id);}
  if(path[0]?.id!=='entrance')throw new Error('Unreachable aquarium destination');
  return {path,distance:distance.get(destination)!};
}
/** Low-poly tank footprint. This is an envelope, not a measured water capacity. */
export function tankOutline(t:Tank):Point[] {
  const [w,d]=t.size;
  let outline:Point[];
  if(t.shape==='oval')outline=Array.from({length:20},(_,i)=>[Math.cos(i*Math.PI/10)*w/2,Math.sin(i*Math.PI/10)*d/2]);
  else if(t.shape==='habitats')outline=[[-.5,-.5],[.4,-.5],[.5,-.3],[.24,0],[.5,.3],[.4,.5],[-.5,.5],[-.32,0]].map(([x,z])=>[x*w,z*d]);
  else outline=[[-.35,-.5],[.35,-.5],[.5,-.3],[.5,.3],[.35,.5],[-.35,.5],[-.5,.3],[-.5,-.3]].map(([x,z])=>[x*w,z*d]);
  return outline.map(([x,z])=>[x+t.center[0],z+t.center[1]]);
}
