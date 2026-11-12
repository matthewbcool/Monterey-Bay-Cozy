import {createGymSquirrels} from './testingGym/squirrels';
import {addPierApron} from './testingGym/pierApron';
import { createCaledoniaArea, inCaledonia, caledoniaHeight } from './mapStudy/caledonia';
import { createGymSeafloor, SEAFLOOR } from './testingGym/seafloor';
import { GROUND_KIND, pathStyle } from './testingGym/pathStyle';
/** Composes the mapped park, authored exercise stations, water and vessel/swim world.
 * The reef is a separate owned root: register, update, budget and dispose it with the park owner.
 * Browser input/camera/HUD belong to avatarWorkbench; geometry sources and limits are in
 * docs/testing-gym-geography.md and docs/gym-dive-site.md. Public placements are X/Z metres.
 */
import { PARK_TREES } from './testingGym/placement';
import { composeGroundSurface } from './testingGym/groundSurface';
import { Group, InstancedMesh, Mesh, Object3D, Vector3 } from 'three';
import map from '../data/lovers-point-gym.json';
import features from '../data/lovers-point-features.json';
import { createParkNature } from './testingGym/nature';
import { addShoreEdges } from './testingGym/shore';
import { addParkBuildings } from './testingGym/buildings';
import { points2D, surface, ribbon } from './testingGym/geometry';
import { finishSpatialBatches } from './testingGym/spatialBatches';
import { addParkLandmarks } from './testingGym/landmarks';
import { finishStaticAsset } from '../models/shared/staticAsset';
import { disposeObject, mat, mesh } from '../models/props/primitives';
import { createFishingRod } from '../models/props/rods';
import { createDock, createTackleBox } from '../models/props/dock';
import { createCabinBoat, createRowboat } from '../models/props/boats';
import { createScubaRack } from '../models/props/scuba';
import { createBatStar } from '../models/habitat/batStar';
import { canStandAt, insidePolygon, type GymBounds, type GymCollider, type GymPoint } from './avatarController';
import { createWater } from './water';
import { createShoreFoam } from './testingGym/shoreFoam';
import { createGymOceanGeometry } from './testingGym/oceanGeometry';
import { accessHeight, addBeachAccess } from './testingGym/access';
import { groundHeight, terrainSkirt, GYM_WATER_LEVEL, GYM_GROUND_CLEARANCE } from './testingGym/elevation';
import { createGymBoatController, GYM_BOAT_BERTH, type BoatObstacle } from './testingGym/boatController';
import { createGymSwimming } from './testingGym/swimming';
import { addParkStatues } from './testingGym/statues';
import { createWaterfrontArea, WATERFRONT, inWaterfront, waterfrontHeight } from './mapStudy/waterfront';
import { createOtterManSuit } from '../models/props/otterMan';
import { createMuseumArea } from './mapStudy/museum';
import { createCoastalLife, coastalIsWater } from './testingGym/coastalLife';
import { createGymReef } from './testingGym/reef';
import { createGymButterflies } from './testingGym/butterflies';
import { createGymWhaleSighting } from './testingGym/whalePod';
import { createGymGulls } from './testingGym/gulls';

export type { GymBounds, GymCollider } from './avatarController';
export interface GymInteraction { id: string; label: string; description: string; position: Vector3; radius: number; action: 'sit' | 'inspect' | 'collect' | 'cast' | 'board' | 'board-dive' | 'suit' | 'gate'; object?: Object3D; seatPosition?: Vector3; yaw?: number }

/** Authored mooring off the end of the mapped concrete pier route (OSM way/633871951), which ends at
 * the shoreline. The stern faces the pier and the bow points out along the pier's axis. Local points
 * are on the cabin boat's metre-scale deck: +Z is the bow, +X starboard (the seaward side). */
export const DIVE_BOAT = {
  x: 81.17, z: 28.51, yaw: .709,
  boarding: [77.39, 24.11] as GymPoint,
  stand: [.1, .33, -1.45] as [number, number, number],
  rack: [.48, .33, -.7] as [number, number, number],
  /** Where a diver enters the water off the starboard side, and the ladder a swimmer returns to. */
  entry: [1.95, 0, -.3] as [number, number, number],
  ladder: [1.6, 0, -.6] as [number, number, number], ladderRadius: 2.6,
  /** Centre of the kelp-forest dive site, about 18 m beyond the mooring along the pier axis. */
  reef: [92.71, 41.95] as GymPoint,
  /** Swim/rowboat collision circles along the keel: [local z, radius]. */
  hull: [[-1.9, 1.25], [-.6, 1.25], [.7, 1.2], [1.9, .9]] as [number, number][],
  /** Driving: an outboard cabin boat is quicker but turns wider than the rowboat. Game tuning. */
  motion: { cruise: 3.4, fast: 5.5, reverse: 1.3, turn: .75, clearance: .5 },
  /** Land/coast test points around the 5.5 × 2.4 m hull plus the outboard. */
  hullSamples: [[0, 0], [-1.15, 0], [1.15, 0], [-1.05, -2.3], [1.05, -2.3], [-1, 2.1], [1, 2.1], [0, -2.95], [0, 2.85]] as GymPoint[],
} as const;

/** Eight irregular kelp mats 18–40 m off the coast, from the gym seed. Water-surface paint only. */
function kelpCanopy(coast: readonly GymPoint[], land: readonly GymPoint[]) {
  let seed = 6256 * 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const patches: GymPoint[][] = [];
  for (let n = 0; n < 40 && patches.length < 8; n++) {
    const i = 4 + Math.floor(random() * (coast.length - 8)), a = coast[i - 1], b = coast[i + 1], p = coast[i];
    let nx = b[1] - a[1], nz = a[0] - b[0]; const length = Math.hypot(nx, nz) || 1; nx /= length; nz /= length;
    if (insidePolygon(p[0] + nx, p[1] + nz, land)) { nx = -nx; nz = -nz; }
    const offset = 18 + random() * 22, cx = p[0] + nx * offset, cz = p[1] + nz * offset, rx = 7 + random() * 6, rz = 5 + random() * 5, turn = random() * Math.PI;
    const ring: GymPoint[] = Array.from({ length: 9 }, (_, k) => { const t = k / 9 * Math.PI * 2, wobble = .75 + random() * .5;
      return [cx + (Math.cos(t) * rx * Math.cos(turn) - Math.sin(t) * rz * Math.sin(turn)) * wobble, cz + (Math.cos(t) * rx * Math.sin(turn) + Math.sin(t) * rz * Math.cos(turn)) * wobble]; });
    if (ring.some(([x, z]) => insidePolygon(x, z, land) || Math.hypot(x - DIVE_BOAT.x, z - DIVE_BOAT.z) < 12)) continue;
    patches.push(ring);
  }
  return patches;
}

export const GYM_GEOGRAPHY = {
  origin: map.origin as [number, number],
  source: '© OpenStreetMap contributors · ODbL',
  mapDate: features.downloaded,
  sourceUrl: 'https://www.openstreetmap.org/copyright',
  photoAssessment: 'November 3 contributor photos: two-level pier, red-capped hut, turquoise kiosk, three-storey lodge; dimensions remain estimates.',
  photoSource: 'https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Lovers%20Point%20Park.pdf?t=202510301223500',
  limits: 'Mapped coast, roads, paths, beaches, pool, court and building footprints. USGS DEM land and separate survey-backed bathymetry in NAVD88 metres; shore joins, gaps, walls, stairs, widths, planting, building heights and exercise placements remain approximations.',
  seed: 6256,
};

/** A bounded, metre-scale place to exercise the avatar and existing collection.
 * OSM positions are static; photo-inspired scenery has explicitly authored heights.
 * Caller supplies camera, lighting, input, shared style conversion and LOD registration. */
export function createTestingGym(options: { whaleSightingRoll?: number } = {}) {
  const root = new Group(); root.name = 'Lovers Point · Testing Gym'; root.userData.geography = GYM_GEOGRAPHY;
  const terrain = new Group(), overlays = new Group(), scenery = new Group(), buildings = new Group();
  const colliders: GymCollider[] = [], interactions: GymInteraction[] = [];
  const coast = points2D(map.coast);
  const land: GymPoint[] = [...coast, [-145, -135], [-145, 130], [72, 130]];
  const playable: GymPoint[] = [...coast, [-100, -135], [-100, 130], [72, 130]];
  const bounds: GymBounds = { minX: -100, maxX: 144, minZ: -160, maxZ: 130, walkable: playable };
  const spawn = new Vector3(25, groundHeight(25, -35) + GYM_GROUND_CLEARANCE, -35);
  const swim = createGymSwimming({ coast, land });
  // Point granite is dark grey-brown with lichen and the beach sand slightly grey (city photos p33/p44).
  const stone = mat('#8b8d7e'), warmStone = mat('#7f776a'), lawn = mat('#8ba46b'), sand = mat('#dcccae');
  mesh(terrain, 'Terrain coast skirt · DEM top / authored submerged base', terrainSkirt(land), stone);
  const seafloor = createGymSeafloor();
  mesh(terrain, 'Mapped land silhouette', surface(land), lawn);
  // Only the mapped park (OSM relation/16861626) is irrigated lawn; the surrounding blocks read as
  // drier town ground. The park boundary is an outline, not evidence that all of it is grass.
  mesh(overlays, 'Town ground outside the mapped park', surface(land, .002), mat('#a9a688'));
  for (const feature of features.polygons.filter(p => p.kind === 'park')) {
    const outline = feature.rings.find(r => r.role === 'outer'); if (outline) mesh(overlays, `Mapped park lawn · ${feature.id}`, surface(points2D(outline.points), .003), lawn);
  }
  const granitePoint:GymPoint[]=[...coast.slice(25,74),[62,-109],[74,-98],[91,-88]];
  mesh(terrain,'Photo-inspired exposed granite at the point',surface(granitePoint,.009),warmStone);
  // Mapped areas replace guessed sand patches. Heights/widths remain authored.
  for(const feature of features.polygons.filter(p=>p.kind==='beach')) {
    const outline=feature.rings.find(r=>r.role==='outer');if(!outline)continue;
    mesh(overlays,`Mapped beach · ${feature.id}`,surface(points2D(outline.points),.014),sand);
  }
  const asphalt=mat('#7f8780'), jetty=mat('#a9a69c');
  for (const feature of features.polygons.filter(p=>p.kind==='parking'||p.kind==='breakwater')) {
    const outline=feature.rings.find(r=>r.role==='outer'); if(!outline)continue;
    mesh(overlays,`Mapped ${feature.kind} · ${feature.id}`,surface(points2D(outline.points),.018),feature.kind==='parking'?asphalt:jetty);
  }
  for(const route of features.paths){
    const style=pathStyle(route);
    const pathMesh=mesh(overlays,`Mapped ${route.highway} · ${route.id} / ${style.widthBasis} / ${style.surfaceBasis}`,ribbon(points2D(route.points),style.width,style.pedestrian?.029:.019),mat(style.color));
    pathMesh.userData.groundKind=style.kind;
  }
  // Keep the mapped paved network. The old exercise shortcuts were invented dirt paths.

  let seed = GYM_GEOGRAPHY.seed;
  const random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const nature = createParkNature(random, groundHeight);
  function rock(x: number, z: number, size: number, solid: boolean) {
    nature.rock(x,z,size);
    if (solid) colliders.push({ kind: 'circle', x, z, radius: size * 1.13 });
  }
  // Granite shelves flank the point. Beach footprints remain clear; the rock
  // distribution and exposed height are photo interpretation, not bathymetry.
  for (let i = 20; i < coast.length - 5; i += 2) {
    const a = coast[i], b = coast[i + 1], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const r = 2.2 + random() * 2.4; rock(x, z, r, true);
    rock(x + (random() - .5) * 8, z + (random() - .5) * 8, r * .65, false);
  }
  // A few larger rocks make the tip readable at player height and in Far LOD.
  for (const [x,z,size] of [[126,-133,5],[121,-124,4.7],[112,-120,3.6],[94,-108,3.1]]) rock(x,z,size,true);
  const grassPatch = mat('#879f64'), grassShade = mat('#889f68');
  for (let i = 0; i < 42; i++) {
    const x = -14 + random() * 112, z = -114 + random() * 210;
    if (!insidePolygon(x,z,land)) continue;
    const rx = 2 + random()*7, rz = 1.5 + random()*3;
    const patch: GymPoint[] = Array.from({length:9}, (_,j) => [x+Math.cos(j/9*Math.PI*2)*rx,z+Math.sin(j/9*Math.PI*2)*rz]);
    if (patch.every(([px,pz])=>insidePolygon(px,pz,land))) mesh(terrain,'Broad painted lawn variation',surface(patch,.004),i%2?grassPatch:grassShade);
  }
  for (const tree of PARK_TREES) {
    nature.tree(tree);
    // Canopy contact is already in the shared static field; no extra ground sheets.
    colliders.push({kind:'circle',x:tree.x,z:tree.z,radius:tree.trunkRadius});
  }
  const {poolGate,gateApproach}=addParkLandmarks(scenery,overlays,colliders);root.add(poolGate.root);
  interactions.push({id:'pool-gate',label:poolGate.label,description:'Open the gate to explore the pool deck. The basin is a visual study.',position:new Vector3(gateApproach[0],groundHeight(...gateApproach)+.045,gateApproach[1]),radius:4.3,action:'gate',object:poolGate.root});
  addShoreEdges(scenery,colliders);
  addBeachAccess(scenery,colliders);
  addPierApron(overlays);

  addParkBuildings(buildings,colliders,groundHeight);
  const statues = addParkStatues(root, colliders);
  for (const { record, object, position } of statues) {
    const approach = position.clone().add(new Vector3(Math.sin(record.yawRadians) * 1.8, 0, Math.cos(record.yawRadians) * 1.8));
    approach.y = groundHeight(approach.x, approach.z) + .04;
    interactions.push({
    id: record.id, label: `Look at ${record.id === 'sailing-boy-statue' ? 'the sailing boy' : 'Monarch Butterfly'}`,
    description: `${record.title}, by ${record.artist}. A low-poly study of the Lovers Point sculpture. Position follows a historic GPS pin; exact size and orientation are estimated.`,
    position: approach, radius: 2.4, action: 'inspect', object,
    });
  }

  // Fishing equipment belongs beside the rowboat landing, at original metre scale.
  function asset(group: Group, x: number, z: number, y = 0, yaw = 0) { group.position.set(x, y + groundHeight(x,z), z); group.rotation.y = yaw; root.add(group); return group; }
  function interaction(id: string, label: string, description: string, x: number, z: number, action: GymInteraction['action'], radius = 2.4) {
    const item: GymInteraction = { id, label, description, position: new Vector3(x, groundHeight(x,z) + .04, z), radius, action }; interactions.push(item);
    return item; // Prompts identify interactions; do not paint fictional dirt circles on the lawn.
  }
  const tackle = asset(createTackleBox(), 70, -32, .035);
  colliders.push({ kind: 'box', minX: 69.75, maxX: 70.25, minZ: -32.2, maxZ: -31.8 });
  interaction('tackle-box', 'Check the tackle box', 'Coral tackle box beside the rowboat landing. Equipment placement is authored for this prototype.', 70, -33.2, 'inspect').object = tackle;
  const rod = asset(createFishingRod(), 72, -32, .05, -.4);
  const rodCollider: GymCollider = { kind: 'circle', x: 72, z: -32, radius: .3 }; colliders.push(rodCollider);
  interaction('spinning-rod', 'Pick up a fishing rod', 'Equip the library spinning rod beside the rowboat. No live fishing rules or catch simulation are implied.', 72, -33.2, 'collect').object = rod;
  const boat = new Group(); boat.name = 'Seafoam rowboat · moving vessel';
  const boatVisual = createRowboat(); boat.add(boatVisual); root.add(boat);
  const dock = asset(createDock(), 74, -28, -.45, Math.PI / 2);
  interaction('rowboat', 'Board the rowboat', 'Board at the dock. W/S row, A/D steer, Shift rows faster, and E steps ashore when back at the dock.', 74, -28, 'board', 2.4).object = boat;
  interaction('casting', 'Practice a cast', 'Try a casting pose beside the dock. This exercise tests the rod and avatar animation; a catch simulation can follow.', 70, -26.6, 'cast', 2.5);
  // Dive boat hull and pier boarding marker; the boat itself is placed with the water below.
  const hullObstacles = DIVE_BOAT.hull.map(([local, radius]) => ({ kind: 'circle' as const,
    x: DIVE_BOAT.x + Math.sin(DIVE_BOAT.yaw) * local, z: DIVE_BOAT.z + Math.cos(DIVE_BOAT.yaw) * local, radius }));
  colliders.push(...hullObstacles);
  const boardAt = DIVE_BOAT.boarding;
  const diveBoarding = interaction('dive-boat', 'Board the dive boat', 'The Marigold dive boat keeps a scuba locker on deck. Suit up, then dive in to explore under the bay.', boardAt[0], boardAt[1], 'board-dive', 2.2);
  rock(35, -44, 1.1, true);
  asset(createBatStar({ seed: 6256 }), 35, -44, .80);
  interaction('bat-star', 'Meet the bat star', 'A seeded Monterey Bay bat star from the habitat library. Observe it without collecting wildlife.', 34, -42.2, 'inspect');
  // Lift authoring parts before batching. Furniture stays rigid; ground paint is
  // split on the exact same DEM planes as the movement sampler.
  for (const child of scenery.children) {
    if (!(child instanceof Mesh) || child.userData.elevationPlaced) continue;
    child.geometry.computeBoundingBox();
    const centre = child.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4((child.updateMatrix(), child.matrix));
    const y = groundHeight(centre.x,centre.z);
    child.position.y += y;
  }
  for(const group of [terrain,overlays])for(const part of group.children){
    if(part.userData.groundKind!==undefined)continue;
    part.userData.groundKind=/lawn|land silhouette|cypress ground shade/.test(part.name)?GROUND_KIND.grass:/beach/.test(part.name)?GROUND_KIND.sand:/parking/.test(part.name)?GROUND_KIND.asphalt:/granite|breakwater/.test(part.name)?GROUND_KIND.stone:GROUND_KIND.plain;
  }
  const ground = composeGroundSurface(terrain, overlays, 'gym-ground-surface');
  // Buildings and static scenery share the same matte response and spatial cells.
  scenery.add(...buildings.children);
  root.add(nature.finish(), ground, finishStaticAsset(terrain, 'gym-terrain-skirt', [1,1,1], {rim:false}),
    finishSpatialBatches(scenery, 'gym-scenery', 128));
  // Share the dockside ripple/reflection look. The large bay uses a bounded grid;
  // fragment normals carry the fine detail without millions of surface triangles.
  const water = createWater({ width: 10000, depth: 10000, segments: 20, profile: 'open', refract: false, geometry:createGymOceanGeometry(260,-180),
    depthSource:{bounds:SEAFLOOR.bounds,surfaceY:GYM_WATER_LEVEL,floorAt:seafloor.floorAt} });
  water.root.name = 'Gym bay · stylized level, not tide data';
  // Fine ripples are fragment shading; the coast-clipped mesh stays below 800 triangles.
  // Both above/below views render in one opaque pass; no viewport refraction capture.
  water.material.forceSinglePass = true;
  water.root.position.set(260, GYM_WATER_LEVEL, -180); water.root.receiveShadow = false; root.add(water.root);
  // Dive boat: the library cabin boat moored alongside the seaward end of the mapped concrete pier
  // (OSM way/633871951). The mooring and the scuba locker on its deck are authored placements.
  const diveBoat = new Group(); diveBoat.name = 'Marigold dive boat · moored at the pier';
  const diveVisual = createCabinBoat(); diveBoat.add(diveVisual);
  const rack = createScubaRack(); rack.position.set(...DIVE_BOAT.rack); rack.rotation.y = Math.PI / 2; diveVisual.add(rack);
  diveBoat.position.set(DIVE_BOAT.x, GYM_WATER_LEVEL, DIVE_BOAT.z); diveBoat.rotation.y = DIVE_BOAT.yaw; root.add(diveBoat);
  diveBoat.updateMatrixWorld(true); diveBoarding.object = diveBoat;
  // Each boat treats the other's hull as a moving obstacle; both lists are refreshed in syncHulls().
  const rowHull: BoatObstacle[] = [{ x: 0, z: 0, radius: .8 }, { x: 0, z: 0, radius: .8 }];
  const diveVessel = createGymBoatController({ root: diveBoat, visual: diveVisual, coast, land, obstacles: rowHull,
    berth: { x: DIVE_BOAT.x, z: DIVE_BOAT.z, yaw: DIVE_BOAT.yaw, landingX: boardAt[0], landingZ: boardAt[1] },
    motion: DIVE_BOAT.motion, hull: DIVE_BOAT.hullSamples, tilt: .35, dockRadius: 4,
    waterX: water.root.position.x, waterZ: water.root.position.z, waterY: GYM_WATER_LEVEL });
  // Kelp-forest dive site off the dive boat's bow, along the pier axis. A separate root with its own
  // budget: the caller adds it beside the park and it only renders/simulates near the player.
  const reef = createGymReef({ center: new Vector3(DIVE_BOAT.reef[0], 0, DIVE_BOAT.reef[1]), floorAt: swim.swimGroundHeight, surfaceY: GYM_WATER_LEVEL });
  const whalePod = createGymWhaleSighting(GYM_WATER_LEVEL, options.whaleSightingRoll ?? Math.random());
  const vessel = createGymBoatController({ root: boat, visual: boatVisual, coast, land, obstacles: hullObstacles,
    waterX: water.root.position.x, waterZ: water.root.position.z, waterY: GYM_WATER_LEVEL });
  if (!vessel.canFloatAt(GYM_BOAT_BERTH.x, GYM_BOAT_BERTH.z, GYM_BOAT_BERTH.yaw))
    throw new Error('Testing Gym rowboat berth is not safely offshore');
  const foam = new Group();
  mesh(foam, 'Mapped coast shallows', ribbon(coast, 7.5, -.90), mat('#5f8e8a'));
  root.add(createShoreFoam(coast, accessHeight, coastalIsWater, water));
  // Brown giant-kelp canopy mats just under the surface, as in the aerial photos; divers see them
  // overhead. Seeded; positions are artistic.
  for (const patch of kelpCanopy(coast, land)) mesh(foam, 'Kelp canopy patch · artistic placement', surface(patch, GYM_WATER_LEVEL - .08), mat('#4a4a2c'));
  // The shared water shader supplies moving flecks; only the mapped shoreline needs geometry.
  root.add(finishStaticAsset(foam, 'gym-shore-water', [1,1,1], { rim: false, doubleSided: true }));
  const waterfront=createWaterfrontArea(),museum=createMuseumArea(),caledonia=createCaledoniaArea();
  const coastalLife=createCoastalLife(swim.swimGroundHeight,GYM_WATER_LEVEL);
  // Wildlife owns its animation and distance interest separately from the static park budget.
  const gulls=createGymGulls({groundHeight:accessHeight,surfaceY:GYM_WATER_LEVEL,isWater:coastalIsWater,
    canLandAt:(x,z)=>!coastalIsWater(x,z)&&canStandAt(x,z,bounds,colliders,.65)});
  const flightObstacles=[...colliders.filter(c=>c.kind==='box').map(c=>Object.assign(c,{top:c.top??groundHeight((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2)+.6})),...waterfront.flightObstacles,...caledonia.flightObstacles,museum.flightObstacle];
  colliders.push(...waterfront.colliders,...museum.colliders,...caledonia.colliders);
  bounds.minX=-430;bounds.maxX=1500;bounds.maxZ=900;
  bounds.walkable=[...WATERFRONT.coast.map(p=>[p[0],p[1]] as GymPoint).reverse(),...coast,[-140,-135],[-140,15],[-240,15],[-240,90],[-430,90],[-430,450],[-140,450],[-140,900]];
  const otterSuit=asset(createOtterManSuit(),28,-31,.04,Math.PI*.2);
  interaction('otter-man-suit','Put on Otter Man','An otter-inspired exploration suit. Space lifts off, C descends, Shift boosts. Return to the station to remove it.',26,-34,'suit',2.8).object=otterSuit;
  const flightWater=(x:number,z:number)=>inCaledonia(x,z)||inWaterfront(x,z)||insidePolygon(x,z,land)?undefined:GYM_WATER_LEVEL;
  const flightFloor=(x:number,z:number)=>inCaledonia(x,z)?caledoniaHeight(x,z):inWaterfront(x,z)?waterfront.floorAt(x,z):insidePolygon(x,z,land)?accessHeight(x,z):Math.max(swim.swimGroundHeight(x,z),reef.rockTop(x,z));
  const flightBounds={minX:-430,maxX:1500,minZ:-230,maxZ:900};
  // Spawn is an invariant; authored object changes must not silently trap a newly loaded avatar.
  const squirrels=createGymSquirrels(accessHeight,bounds,colliders);
  if (!canStandAt(spawn.x, spawn.z, bounds, colliders)) throw new Error('Testing Gym spawn overlaps a collider');
  // The moored boat shares the water shader's wave function, like the rowboat's visual child.
  /** Move hull circles with their boats: swimmers collide with the dive boat wherever it is driven. */
  function syncHulls() {
    const c = Math.cos(diveBoat.rotation.y), s = Math.sin(diveBoat.rotation.y);
    DIVE_BOAT.hull.forEach(([local], i) => { hullObstacles[i].x = diveBoat.position.x + s * local; hullObstacles[i].z = diveBoat.position.z + c * local; });
    const rc = Math.cos(boat.rotation.y), rs = Math.sin(boat.rotation.y);
    [-1, 1].forEach((local, i) => { rowHull[i].x = boat.position.x + rs * local; rowHull[i].z = boat.position.z + rc * local; });
  }
  syncHulls();
  /** World position of a point on the dive boat's (bobbing) deck. */
  const deckPoint = (local: readonly [number, number, number], out: Vector3) => { diveVisual.updateWorldMatrix(true, false); return diveVisual.localToWorld(out.set(...local)); };
  const butterflyStatue=statues.find(({record})=>record.id==='butterfly-statue')!;
  const butterflies=createGymButterflies(groundHeight,butterflyStatue.position);root.add(butterflies.root);
  let disposed = false;
  return {
    poolGate,seafloor,reef,whalePod,butterflies,gulls,caledonia,waterfront,coastalLife,museum,otterSuit,flightObstacles,flightFloor,flightWater,flightBounds,
    diveBoat: { root: diveBoat, visual: diveVisual, rack, deckPoint, vessel: diveVessel, stand: DIVE_BOAT.stand, ladderRadius: DIVE_BOAT.ladderRadius,
      get yaw() { return diveBoat.rotation.y; },
      /** Water-level points beside the (possibly driven) boat, in world metres. */
      ladderPoint: (out: Vector3) => { diveBoat.updateMatrixWorld(); return diveBoat.localToWorld(out.set(...DIVE_BOAT.ladder)); },
      entryPoint: (out: Vector3) => { diveBoat.updateMatrixWorld(); return diveBoat.localToWorld(out.set(...DIVE_BOAT.entry)); },
      boarding: new Vector3(boardAt[0], accessHeight(boardAt[0], boardAt[1]) + GYM_GROUND_CLEARANCE, boardAt[1]) }, root, spawn, bounds, colliders, interactions, statues, ...swim, groundHeight: (x:number,z:number)=>museum.floorAt(x,z)??(inCaledonia(x,z)?caledoniaHeight(x,z):inWaterfront(x,z)?waterfront.floorAt(x,z):accessHeight(x,z)), terrainHeight: (x:number,z:number)=>inCaledonia(x,z)?caledoniaHeight(x,z):inWaterfront(x,z)?waterfrontHeight(x,z):groundHeight(x,z), swimGroundHeight: (x: number, z: number) => museum.floorAt(x,z)??(inCaledonia(x,z)?caledoniaHeight(x,z):inWaterfront(x,z)?waterfront.floorAt(x,z):Math.max(swim.swimGroundHeight(x, z), reef.rockTop(x, z))),
    squirrels, geography: GYM_GEOGRAPHY, boat, dock, water, vessel, targets: { rod, tackle },
    setRodEquipped(equipped: boolean) { const i = colliders.indexOf(rodCollider); if (equipped && i >= 0) colliders.splice(i, 1); else if (!equipped && i < 0) colliders.push(rodCollider); },
    update(time: number) { if (!disposed && Number.isFinite(time)) { water.update(time); butterflies.update(time); vessel.syncSurface(time); diveVessel.syncSurface(time); syncHulls();
      // The shader draws one wake: give it to whichever boat is moving faster.
      const wake = Math.abs(diveVessel.speed) > Math.abs(vessel.speed) ? diveVessel : vessel;
      water.setWake(wake.root.position.x-water.root.position.x,wake.root.position.z-water.root.position.z,wake.heading,wake.speed); } },
    dispose() { if (disposed) return; disposed = true; squirrels.dispose(); butterflies.dispose(); gulls.dispose(); seafloor.dispose(); reef.dispose(); whalePod.dispose(); coastalLife.dispose(); waterfront.dispose(); caledonia.dispose(); museum.dispose(); water.dispose(); root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); disposeObject(root); },
  };
}
