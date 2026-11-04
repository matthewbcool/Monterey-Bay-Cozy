import { Group, type Material } from 'three';
import features from '../../data/lovers-point-features.json';
import { box, cylinder, mat, mesh } from '../../models/props/primitives';
import type { GymCollider, GymPoint } from '../avatarController';
import { ribbon, surface } from './geometry';
import { groundHeight } from './elevation';
import { addRecreationTrail, fenceRun, segmentCollider } from './parkFurniture';
import { createPoolGate, POOL_GATE_SIZE } from './poolGate';
import { addCafeTerrace } from './cafeTerrace';
import { GROUND_KIND } from './pathStyle';
import { BATH_HOUSE_APRON_POLYGONS, RECREATION_RETAINING, RECREATION_TRAIL } from './recreationGrade';

// OSM way/350647473 and way/350647475, projected into the gym's metre grid.
// Only the ground footprints are mapped. Deck width, fence/pole heights and the
// inset playing lines are authored from the city's facilities photo survey.
function footprint(id:string): GymPoint[] {
  const ring=features.polygons.find(feature=>feature.id===id)?.rings.find(r=>r.role==='outer');
  if(!ring)throw new Error(`Missing mapped landmark ${id}`);
  return ring.points.slice(0,-1).map(([x,z])=>[x,z]);
}
const POOL=footprint('way/350647473'),COURT=footprint('way/350647475');

function loop(points: readonly GymPoint[]): GymPoint[] { return [...points, points[0]]; }
function centre(points: readonly GymPoint[]): GymPoint {
  return [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length];
}
function enlarged(points: readonly GymPoint[], factor: number): GymPoint[] {
  const c = centre(points);
  return points.map(p => [c[0] + (p[0] - c[0]) * factor, c[1] + (p[1] - c[1]) * factor]);
}

/** Draw a horizontal rectangular beam without dense tubes or a separate material. */
function beam(parent: Group, name: string, a: GymPoint, b: GymPoint, y: number, thickness: number, material: Material) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const part = box(parent, name, [Math.hypot(dx, dz), thickness, thickness], material, [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]);
  part.rotation.y = -Math.atan2(dz, dx);
}

/** Photo-led pool and volleyball silhouettes. The caller folds these pieces into
 * the existing scenery and ground batches; no new render pass or texture needed.
 * The owner lifts rigid pieces before batching. Return the independently moving gate separately;
 * the deck is walkable while the basin remains decorative. */
export function addParkLandmarks(scenery: Group, overlays: Group, colliders: GymCollider[]) {
  const cream = mat('#ded3b3'), brick = mat('#a66d58'), poolWater = mat('#76beb9');
  const railing = mat('#303c3b'), sand = mat('#e4d4a9'), red = mat('#bc6656'), pole = mat('#9caeaa');
  addRecreationTrail(scenery,overlays,colliders);
  addCafeTerrace(scenery,colliders);
  // The court's inland rise is masonry in the reference photos. Paint the actual
  // graded face into the single ground mesh so there is no second wall surface.
  const r=RECREATION_RETAINING,wallLength=Math.hypot(r.end[0]-r.start[0],r.end[1]-r.start[1]),nx=-(r.end[1]-r.start[1])/wallLength,nz=(r.end[0]-r.start[0])/wallLength;
  const edge=(p:GymPoint,n:number):GymPoint=>[p[0]+nx*n,p[1]+nz*n];
  const retaining=mesh(overlays,'Court inland retaining wall · photo-inferred granite face',surface([r.start,r.end,edge(r.end,RECREATION_TRAIL.bankWidth),edge(r.start,RECREATION_TRAIL.bankWidth)],.043),mat('#a59e8f'));
  retaining.userData.groundKind=GROUND_KIND.stone;
  for(const points of BATH_HOUSE_APRON_POLYGONS){
    const apron=mesh(overlays,'Old bath house · continuous lower waterfront approach',surface(points,.042),cream);
    apron.userData.groundKind=GROUND_KIND.concrete;
  }
  const patio=mesh(overlays,'Grill terrace · photo-inferred paved apron',surface([[-6,75],[-1,71],[4,71],[14,72],[16,76],[13,84],[0,84],[-6,82]],.028),cream);
  patio.userData.groundKind=GROUND_KIND.concrete;
  const deck = enlarged(POOL, 1.52);
  const fence:GymPoint[]=[[-7.4,43.1],[-11.2,29.8],[-23.6,33.6],[-22.9,47.6]];
  const deckPart=mesh(overlays, 'Lovers Point pool · photo-estimated cream deck', surface(deck, .040), cream);deckPart.userData.groundKind=GROUND_KIND.concrete;
  mesh(overlays, 'Lovers Point pool · OSM way/350647473 water footprint', surface(POOL, .050), poolWater);
  mesh(overlays, 'Lovers Point pool · photo-inspired brick coping', ribbon(loop(POOL), .32, .061), brick);
  const pc=centre(POOL);
  for(const z of [-1.7,1.1])mesh(overlays,'Pool water · painted light band',ribbon([[pc[0]-2.5,pc[1]+z],[pc[0]+1.5,pc[1]+z-.5]],.10,.055),cream);
  const a=fence[0],b=fence[1],edgeLength=Math.hypot(b[0]-a[0],b[1]-a[1]),at=(d:number):GymPoint=>[a[0]+(b[0]-a[0])*d/edgeLength,a[1]+(b[1]-a[1])*d/edgeLength];
  const hinge=at(edgeLength*.50),end=at(edgeLength*.50+POOL_GATE_SIZE.width);
  fenceRun(scenery,a,hinge,railing,colliders);fenceRun(scenery,end,b,railing,colliders);
  for(let i=1;i<fence.length;i++)fenceRun(scenery,fence[i],fence[(i+1)%fence.length],railing,colliders);
  const gate=createPoolGate(hinge,end,Math.max(groundHeight(...hinge),groundHeight(...end))+.025);colliders.push(gate.collider);
  // Only the visible basin is solid. The surrounding deck is accessible through the gate.
  colliders.push({kind:'box',footprint:POOL,top:Math.max(...POOL.map(p=>groundHeight(...p)))+.06,minX:Math.min(...POOL.map(p=>p[0])),maxX:Math.max(...POOL.map(p=>p[0])),minZ:Math.min(...POOL.map(p=>p[1])),maxZ:Math.max(...POOL.map(p=>p[1]))});
  const approach:GymPoint=[gate.center.x+2.3,gate.center.z-.65];
  const path=mesh(overlays,'Pool gate · photo-estimated paved approach',ribbon([[gate.center.x,gate.center.z],approach,[-.9,35.3]],1.65,.041),cream);path.userData.groundKind=GROUND_KIND.concrete;
  // Court-side boundary from the photographs; keep an entrance facing the cypress apron.
  fenceRun(scenery,COURT[1],COURT[2],railing,colliders,1.05);
  fenceRun(scenery,COURT[2],COURT[3],railing,colliders,1.05);
  const southA:GymPoint=[-8.7,73.77],southB:GymPoint=[-4.9,72.52];
  fenceRun(scenery,COURT[3],southA,railing,colliders,1.05);
  fenceRun(scenery,southB,COURT[0],railing,colliders,1.05);
  const courtSand=mesh(overlays, 'Lovers Point volleyball sand · OSM way/350647475 footprint', surface(COURT, .024), sand);courtSand.userData.groundKind=GROUND_KIND.sand;
  const c = centre(COURT), dx = COURT[1][0] - COURT[0][0], dz = COURT[1][1] - COURT[0][1], length = Math.hypot(dx, dz);
  const along: GymPoint = [dx / length, dz / length], across: GymPoint = [-along[1], along[0]];
  const point = (u: number, v: number): GymPoint => [c[0] + along[0] * u + across[0] * v, c[1] + along[1] * u + across[1] * v];
  // The mapped polygon covers the surrounding sand apron as well. An authored
  // 18 × 9 m inset court preserves its real-world sporting scale inside that apron.
  const lines = [point(-9, -4.5), point(9, -4.5), point(9, 4.5), point(-9, 4.5)];
  mesh(overlays, 'Volleyball court · authored red playing boundary', ribbon(loop(lines), .08, .037), red);
  const left = point(0, -5.6), right = point(0, 5.6);
  for (const p of [left, right]) {
    cylinder(scenery, 'Volleyball pole · approximate 2.55 m photo height', .055, 2.55, pole, [p[0], 1.275, p[1]], .045);
    colliders.push({ kind: 'circle', x: p[0], z: p[1], radius: .10 });
  }
  const netA = point(0, -4.7), netB = point(0, 4.7);
  beam(scenery, 'Volleyball net · red top band', left, right, 2.32, .065, red);
  beam(scenery, 'Volleyball net · red lower band', netA, netB, 1.39, .035, red);
  for (const y of [1.70, 2.01]) beam(scenery, 'Volleyball net · sparse dark row', netA, netB, y, .018, railing);
  // Six wide cells retain the net's identity nearby without modelling fine mesh.
  for (let i = 0; i <= 6; i++) {
    const p = point(0, -4.7 + 9.4 * i / 6);
    box(scenery, 'Volleyball net · sparse dark upright', [.018, .93, .018], railing, [p[0], 1.855, p[1]]);
  }
  // One exact thin footprint replaces a row of broad-phase boxes.
  colliders.push(segmentCollider(netA,netB,.04,Math.max(groundHeight(...netA),groundHeight(...netB))+2.4));
  return {poolGate:gate,gateApproach:approach};
}
