/** Public room adjacency comes from the museum's September 2026 accessibility map.
 * Plan dimensions are fitted to OSM, NOT measured architectural dimensions.
 * Local X runs from Grand toward Forest; local Z goes inland from Central.
 */
export const MUSEUM_SITE = {
  id: 'pacific-grove-museum', osmId: 'way/1293958818', name: 'Pacific Grove Museum of Natural History',
  address: '165 Forest Avenue · Central Avenue', seed: 241024,
  anchor: [-3.382, 415.291] as const, right: [-.9363877958360378, -.35096708650431435] as const,
  back: [-.35096708650431435, .9363877958360378] as const,
  floor: 28.05, upper: 3.6, width: 37.83, depth: 33.04,
  sources: {
    footprint: 'https://www.openstreetmap.org/way/1293958818',
    access: 'https://www.pgmuseum.org/s/PGMNH-Accessibility-Map-2.pdf',
    visitor: 'https://www.pgmuseum.org/s/PG-Museum-Social-Story-Jul2026-1.pdf',
    layout: 'https://www.pgmuseum.org/facility-rentals', garden: 'https://www.pgmuseum.org/garden',
    exterior: 'https://www.pgmuseum.org/',
  },
  limits: 'Public room adjacency and features are sourced; room dimensions, heights, floor datum, garden plot extent and furnishings are fitted/photo-informed approximations. Not a survey or navigation guide. No basement/private collection reconstruction.',
} as const;
export type MuseumRect = readonly [number, number, number, number]; // x0,z0,x1,z1
export const MUSEUM_ROOMS = [
  {id:'birds',name:'Bird Room',rect:[0,0,14.08,14] as MuseumRect,color:'#a8b1aa'},
  {id:'workshop',name:'Workshop · staff area',rect:[0,14,5.5,24.27] as MuseumRect,color:'#a89e8a'},
  {id:'services',name:'Restrooms & elevator',rect:[5.5,14,14.08,24.27] as MuseumRect,color:'#bfa88a'},
  {id:'lobby',name:'Lobby & monarchs',rect:[14.08,14,19,20.82] as MuseumRect,color:'#b88660'},
  {id:'shop',name:'Gift shop',rect:[11.5,20.82,15.34,24.27] as MuseumRect,color:'#bc916c'},
  {id:'main',name:'Main Gallery · cultural history',rect:[19,5.7,30.8,20.82] as MuseumRect,color:'#b78b65'},
  {id:'exploration',name:'Exploration Station',rect:[30.8,5.7,37.83,9.5] as MuseumRect,color:'#c18c6b'},
  {id:'wonder',name:'Wonder',rect:[30.8,9.5,37.83,18] as MuseumRect,color:'#b58a65'},
  {id:'jade',name:'Jade Gallery',rect:[30.8,18,37.83,22.6] as MuseumRect,color:'#b19072'},
  {id:'family',name:'Family restroom & classroom passage',rect:[25.6,20.82,30.8,26] as MuseumRect,color:'#bfa88a'},
  {id:'passage',name:'Classroom passage',rect:[30.8,22.6,37.83,26] as MuseumRect,color:'#bfa88a'},
  {id:'classroom',name:'Classroom',rect:[25.6,26,37.83,33.04] as MuseumRect,color:'#c7b48c'},
] as const;
export const MUSEUM_UPPER: MuseumRect[] = [[19,5.7,30.8,9],[19,9,21.7,20.82],[28.1,9,30.8,20.82],[21.7,17.8,28.1,20.82],[8,18.1,19,20.82],[13,15,16,18.1]];
/** wall endpoints in plan metres; openings are explicit so collision matches doors.
 * Exterior/front and internal partitions are shared by geometry and collision.
 */
export const MUSEUM_WALLS: readonly (readonly [number,number,number,number])[] = [
  [0,0,14.08,0],[0,0,0,13],[0,15,0,24.27],[0,24.27,11.5,24.27],
  [14.08,0,14.08,14],[0,14,11,14],[13,14,14.08,14],
  [5.5,14,5.5,24.27],[5.5,18.5,8,18.5],[10,18.5,11.5,18.5],
  [11.5,14,11.5,17],[11.5,19,11.5,24.27],[5.5,21.7,11.5,21.7],
  [11.5,24.27,15.34,24.27],[15.34,22.4,15.34,24.27],
  [14.08,14,15.3,14],[17.5,14,19,14],[14.08,20.82,15.5,20.82],[17.6,20.82,25.6,20.82],
  [19,5.7,19,15.1],[19,17.4,19,20.82],[19,5.7,30.8,5.7],
  [30.8,5.7,37.83,5.7],[37.83,5.7,37.83,6.9],[37.83,8.7,37.83,26],
  [30.8,5.7,30.8,6.8],[30.8,8.7,30.8,18.7],[30.8,20.6,30.8,22.6],
  [30.8,9.5,33.2,9.5],[35.2,9.5,37.83,9.5],
  [30.8,18,33.2,18],[35.2,18,37.83,18],
  [25.6,20.82,25.6,28],[25.6,30,25.6,33.04],[25.6,33.04,37.83,33.04],
  [37.83,26,37.83,33.04],[25.6,26,33.2,26],[35.3,26,37.83,26],
  [30.8,22.6,33.2,22.6],[35.3,22.6,37.83,22.6],[30.8,22.6,30.8,26],
];
export function museumToWorld(x:number,z:number):[number,number]{return [MUSEUM_SITE.anchor[0]+x*MUSEUM_SITE.right[0]+z*MUSEUM_SITE.back[0],MUSEUM_SITE.anchor[1]+x*MUSEUM_SITE.right[1]+z*MUSEUM_SITE.back[1]];}
export function museumToLocal(x:number,z:number):[number,number]{const dx=x-MUSEUM_SITE.anchor[0],dz=z-MUSEUM_SITE.anchor[1];return [dx*MUSEUM_SITE.right[0]+dz*MUSEUM_SITE.right[1],dx*MUSEUM_SITE.back[0]+dz*MUSEUM_SITE.back[1]];}
export function inMuseumRect(x:number,z:number,r:MuseumRect,margin=1e-7){return x>=r[0]-margin&&x<=r[2]+margin&&z>=r[1]-margin&&z<=r[3]+margin;}
/** Authored grading over the coarse DEM, including the front stair and Forest ramp.
 * Returns undefined outside this small patch; the caller retains the regional terrain. */
export function museumSurface(x:number,z:number):number|undefined{
  const [u,v]=museumToLocal(x,z),floor=MUSEUM_SITE.floor;
  if(MUSEUM_ROOMS.some(r=>inMuseumRect(u,v,r.rect)))return floor;
  if(inMuseumRect(u,v,[14.08,0,19,14])||inMuseumRect(u,v,[15.34,20.82,25.6,24.27])||inMuseumRect(u,v,[-.3,24.27,25.6,40]))return floor;
  if(inMuseumRect(u,v,[14.08,-14,19,-6]))return floor-2.70+(v+14)/8*1.62;
  if(inMuseumRect(u,v,[14.08,-6,19,-3]))return floor-1.08;
  if(inMuseumRect(u,v,[14.08,-3,19,0]))return floor-1.08+Math.min(6,Math.floor((v+3)/.5)+1)*.18;
  if(inMuseumRect(u,v,[19,3.5,39.5,5.5]))return floor-(u-19)/20.5*1.08;
  return undefined;
}
