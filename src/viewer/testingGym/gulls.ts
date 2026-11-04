/** Ambient Western gulls. Locations, population and routes are authored scenery,
 * not live wildlife records. Rigid world motion remains separate from model LOD. */
import { Group, Object3D, Vector3 } from 'three';
import park from '../../data/lovers-point-gym.json';
import waterfront from '../../data/pacific-grove-waterfront.json';
import { createGullFlock } from '../../models/habitat/western-gull/createGullFlock';
import { createWesternGull, getGullState, setGullPose, updateWesternGull } from '../../models/habitat/western-gull/createWesternGull';
import { GULL, type GullPose } from '../../models/habitat/western-gull/definition';
import { disposeObject } from '../../models/props/primitives';
import { createGullEscape, GULL_ESCAPE } from './gullEscape';
import { createGullFlightRoutes, GULL_FLIGHT_ENVELOPE } from './gullFlight';

export const GYM_GULLS = {
  seed: 261026,
  groundCount: 6,
  flightCells: 3,
  birdsPerCell: 6,
  interestInterval: .25,
  groundEnterRadius: 90,
  groundExitRadius: 140,
  flightEnterRadius: 500,
  flightExitRadius: 550,
  scareRadius: GULL_ESCAPE.scareRadius,
  budget: { drawCalls: 9, nearTriangles: 8_112, midTriangles: 3_360, farTriangles: 624 },
} as const;

/** Small open patches checked against the park DEM and colliders. Walking lanes
 * remain on the flattest lawns; beach birds stand clear of the water and paths. */
export const GYM_GULL_GROUND_SITES = [
  { id: 'arrival-lawn', x: 36, z: -39, sex: 'female', walking: true, heading: .7, phase: 10 },
  { id: 'arrival-companion', x: 41, z: -40, sex: 'male', walking: false, heading: 1.1, phase: 0 },
  { id: 'coastal-lawn', x: 45, z: -68, sex: 'female', walking: false, heading: -.8, phase: 0 },
  { id: 'point-lawn', x: 57, z: -90, sex: 'male', walking: true, heading: 1.5, phase: 19 },
  { id: 'east-beach', x: 62, z: -23, sex: 'male', walking: false, heading: 2, phase: 0 },
  { id: 'north-beach', x: 35, z: 21, sex: 'female', walking: false, heading: -.4, phase: 0 },
] as const;

/** Tangents use a wider coast window so individual rocks do not kink the route.
 * Individual routes cross the coast into the park and inland neighborhoods. */
export const GYM_GULL_FLIGHT_SITES = [
  { id: 'lovers-point-beach', region: 'park', index: 20, offset: 5, normalSign: 1, altitude: 16, sex: 'male' },
  { id: 'lovers-point-headland', region: 'park', index: 48, offset: 5, normalSign: 1, altitude: 21, sex: 'female' },
  { id: 'waterfront-coast', region: 'waterfront', index: 30, offset: 5, normalSign: -1, altitude: 18, sex: 'male' },
] as const;

interface GymGullOptions {
  groundHeight: (x: number, z: number) => number;
  surfaceY: number;
  /** Optional world mask, checked at construction rather than every animation frame. */
  isWater?: (x: number, z: number) => boolean;
  canLandAt?: (x: number, z: number) => boolean;
}

const smooth = (t: number) => { const value = Math.max(0, Math.min(1, t)); return value * value * (3 - 2 * value); };

export function createGymGulls({ groundHeight, surfaceY, isWater, canLandAt }: GymGullOptions) {
  const root = new Group(); root.name = 'Park and coastal Western gulls';
  const player = { position:new Vector3(), enabled:false };
  root.userData = { units: 'metres', seed: GYM_GULLS.seed, budget: GYM_GULLS.budget, placement: 'Authored ambient park and shoreline birds; not a wildlife survey' };
  const grounded = GYM_GULL_GROUND_SITES.map((site, i) => {
    const bird = createWesternGull({ sex: site.sex, seed: GYM_GULLS.seed + i, pose: 'standing' });
    bird.name = `Park gull · ${site.id} · ${site.sex}`; root.add(bird);
    const home = new Vector3(site.x, groundHeight(site.x, site.z) + .02, site.z);
    const escape=createGullEscape(bird,home,GYM_GULLS.seed+i,{groundHeight,surfaceY,isWater,canLandAt},player);
    return { ...site, root: bird, home, escape, groundEpoch:0, restHeading:Number(site.heading), walkAllowed:Boolean(site.walking), active: true, pose: 'standing' as GullPose, resumed: true };
  });
  const flights = GYM_GULL_FLIGHT_SITES.map((site, i) => {
    const line = site.region === 'park' ? park.coast : waterfront.coast;
    const anchor = line[site.index], a = line[site.index - 6], b = line[site.index + 6];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    const nx = -tz * site.normalSign, nz = tx * site.normalSign;
    const center = new Vector3(anchor[0] + nx * site.offset, 0, anchor[1] + nz * site.offset);
    // Pick a fixed safe cruising height once. Broad routes can cross inland
    // terrain without expensive height queries or sudden climbs each frame.
    let cruiseAltitude: number = site.altitude;
    for(let along=-GULL_FLIGHT_ENVELOPE.along;along<=GULL_FLIGHT_ENVELOPE.along;along+=4)
      for(let across=-GULL_FLIGHT_ENVELOPE.across;across<=GULL_FLIGHT_ENVELOPE.across;across+=4)
        cruiseAltitude=Math.max(cruiseAltitude,groundHeight(center.x+tx*along+nx*across,center.z+tz*along+nz*across)-surfaceY+20);
    const routes=createGullFlightRoutes({center,tangent:new Vector3(tx,0,tz),normal:new Vector3(nx,0,nz),surfaceY,altitude:cruiseAltitude,seed:GYM_GULLS.seed+100+i,count:GYM_GULLS.birdsPerCell});
    const flock = createGullFlock({ count: GYM_GULLS.birdsPerCell, capacity: GYM_GULLS.birdsPerCell, seed: GYM_GULLS.seed + 100 + i, sex: site.sex });
    flock.root.name = `Coastal gull cell · ${site.id}`; flock.root.position.copy(center); root.add(flock.root);
    const sizes = Array.from({ length: GYM_GULLS.birdsPerCell }, (_, slot) => flock.getInstanceState(slot).wingspanMeters / flock.root.userData.wingspanMeters);
    return { ...site, flock, sizes, routes, center, normal:new Vector3(nx,0,nz), tangent:new Vector3(tx,0,tz), active: true, resumed: true };
  });
  const point = new Vector3(), direction = new Vector3(), placement = new Object3D();
  let elapsed = 0, disposed = false, viewerX = 25, viewerZ = -35, overview = false, interestDue = 0, interestDirty = true;

  function selectInterest() {
    for (const bird of grounded) {
      const active = overview || Math.hypot(viewerX - bird.home.x, viewerZ - bird.home.z) < (bird.active ? GYM_GULLS.groundExitRadius : GYM_GULLS.groundEnterRadius);
      bird.resumed ||= active && !bird.active; bird.active = bird.root.visible = active;
    }
    for (const cell of flights) {
      const active = overview || Math.hypot(viewerX - cell.center.x, viewerZ - cell.center.z) < (cell.active ? GYM_GULLS.flightExitRadius : GYM_GULLS.flightEnterRadius);
      cell.resumed ||= active && !cell.active; cell.active = cell.flock.root.visible = active;
    }
    interestDirty = false; interestDue = GYM_GULLS.interestInterval;
  }
  function placeGround(dt: number) {
    for (const bird of grounded) {
      if (!bird.active) continue;
      const wasAirborne=bird.escape.phase!=='grounded';
      if(dt>0&&bird.escape.update(dt)){
        bird.pose=getGullState(bird.root)!.pose;
        if(wasAirborne&&bird.escape.phase==='grounded'){
          bird.groundEpoch=elapsed+bird.phase;bird.restHeading=bird.root.rotation.y;bird.resumed=true;
          // A safe perch may not have room for a stroll. Check the whole new lane once.
          bird.walkAllowed=bird.walking;
          for(let step=1;bird.walkAllowed&&step<=12;step++){
            const d=GULL.walkSpeedMetersPerSecond*3*step/12,x=bird.home.x-Math.sin(bird.restHeading)*d,z=bird.home.z-Math.cos(bird.restHeading)*d,h=groundHeight(x,z);
            if(isWater?.(x,z)||canLandAt?.(x,z)===false||Math.abs(h-bird.home.y+.02)>.12)bird.walkAllowed=false;
          }
        }
        continue;
      }
      if(!bird.walkAllowed&&!bird.resumed)continue;
      const phase = (elapsed + bird.phase-bird.groundEpoch) % 30;
      // Three-second strolls alternate with long rests. Turn slowly while standing.
      const outbound = phase >= 10 && phase < 13, inbound = phase >= 20 && phase < 23;
      const walking = bird.walkAllowed && (outbound || inbound);
      const distance = bird.walkAllowed ? GULL.walkSpeedMetersPerSecond * (phase < 10 ? 0 : phase < 13 ? phase - 10 : phase < 20 ? 3 : phase < 23 ? 23 - phase : 0) : 0;
      const turn = bird.walkAllowed ? (phase < 13 ? 0 : phase < 20 ? smooth((phase - 15) / 2) : phase < 23 ? 1 : 1 - smooth((phase - 25) / 2)) : 0;
      const x = bird.home.x - Math.sin(bird.restHeading) * distance, z = bird.home.z - Math.cos(bird.restHeading) * distance;
      bird.root.position.set(x, groundHeight(x, z) + .02, z); bird.root.rotation.y = bird.restHeading + Math.PI * turn;
      const pose: GullPose = walking ? 'walking' : 'standing';
      if (pose !== bird.pose || bird.resumed) {
        setGullPose(bird.root, pose); bird.pose = pose;
        if (walking) updateWesternGull(bird.root, phase - (outbound ? 10 : 20));
      } else if (walking) updateWesternGull(bird.root, dt);
      bird.resumed = false;
    }
  }
  function placeFlights(dt: number) {
    for (const cell of flights) {
      if (!cell.active) continue;
      for (let i = 0; i < GYM_GULLS.birdsPerCell; i++) {
        const bank=cell.routes.sample(i,elapsed,point,direction);
        placement.position.set(point.x-cell.center.x,point.y,point.z-cell.center.z);
        placement.rotation.set(Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),Math.atan2(-direction.x,-direction.z),bank,'YXZ');
        placement.scale.setScalar(cell.sizes[i]); placement.updateMatrix(); cell.flock.setTransformAt(i, placement.matrix);
      }
      // One commit scans six members once; no per-bird bound rebuilding or skeletons.
      cell.flock.commitTransforms();
      const clockStep = cell.resumed ? Math.max(0, elapsed - cell.flock.timeSeconds) : dt;
      cell.flock.update(clockStep); cell.resumed = false;
    }
  }
  // Place every route before world LOD measures it, then apply initial interest.
  placeGround(0); placeFlights(0); selectInterest();
  return {
    root, grounded, flights,
    /** Actual actor feet, not the orbit/overview camera. Physics/network hosts can replace this input. */
    setPlayer(x:number,y:number,z:number,enabled=true){
      if(disposed)return;
      player.enabled=enabled&&Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z);
      if(player.enabled)player.position.set(x,y,z);
    },
    setViewer(x: number, z: number, showOverview = false) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return;
      if (showOverview !== overview) { overview = showOverview; interestDirty = true; }
      // Teleports settle immediately; ordinary movement uses the bounded cadence.
      if (Math.hypot(x - viewerX, z - viewerZ) > 30) interestDirty = true;
      viewerX = x; viewerZ = z;
      if (interestDirty) selectInterest();
    },
    update(dt: number, animate = true) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1); interestDue -= dt;
      if (interestDirty || interestDue <= 0) selectInterest();
      // Reduced motion also preserves an awakened cell's last displayed pose.
      // Catch up to canonical time only when motion is enabled again.
      if (!animate) return;
      elapsed += dt; placeGround(dt); placeFlights(dt);
    },
    stats() {
      let activeGround = 0, activeCells = 0, walking = 0, males = 0;
      for (const bird of grounded) { if (bird.active) activeGround++; if (bird.active && getGullState(bird.root)?.pose === 'walking') walking++; if (bird.sex === 'male') males++; }
      for (const cell of flights) { if (cell.active) activeCells++; if (cell.sex === 'male') males += GYM_GULLS.birdsPerCell; }
      return { birds: GYM_GULLS.groundCount + GYM_GULLS.flightCells * GYM_GULLS.birdsPerCell, ground: grounded.length, flying: GYM_GULLS.flightCells * GYM_GULLS.birdsPerCell,
        male: males, female: GYM_GULLS.groundCount + GYM_GULLS.flightCells * GYM_GULLS.birdsPerCell - males, activeGround, activeCells, activeFlying: activeCells * GYM_GULLS.birdsPerCell, walking,
        fleeing:grounded.filter(bird=>bird.escape.phase!=='grounded').length,departures:grounded.reduce((n,bird)=>n+bird.escape.departures,0),
        draws: grounded.length + flights.length, activeDraws: activeGround + activeCells, triangles: GYM_GULLS.budget.nearTriangles,
        nearTriangles: GYM_GULLS.budget.nearTriangles, midTriangles: GYM_GULLS.budget.midTriangles, farTriangles: GYM_GULLS.budget.farTriangles, elapsed };
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const cell of flights) cell.flock.dispose();
      disposeObject(root); root.clear(); root.removeFromParent();
    },
  };
}
