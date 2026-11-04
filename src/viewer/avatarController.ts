import { Object3D, Vector3 } from 'three';

export type GymPoint = readonly [number, number];
export interface GymBounds { minX: number; maxX: number; minZ: number; maxZ: number; /** Authored playable land outline, X/Z metres. */ walkable?: readonly GymPoint[] }
export type GymCollider = { kind: 'circle'; x: number; z: number; radius: number } | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; /** Exact footprint inside the broad-phase box. */ footprint?: readonly GymPoint[]; /** Absolute visible top for suit collision. */ top?: number };
/** Plain, serializable intent for one step. `jump` is the held button state; the controller
 * detects presses itself, so a replayed or networked input stream yields the same result. */
export interface AvatarInput { x: number; z: number; run: boolean; jump?: boolean; /** Held while swimming to descend; `jump` held swims up. */ dive?: boolean }
export const AVATAR_MOVEMENT = { walk: 1.7, run: 3.5, radius: .28, acceleration: 12, maxFrameStep: .1 } as const;
/** Game-feel tuning, not a physical model. Height is the same for every body size so play stays fair.
 * A press shortly before landing is buffered; releasing early cuts the rise for a short hop. */
export const AVATAR_JUMP = { height: .55, gravity: 24, bufferSeconds: .14, releaseCut: .45, airControl: .45 } as const;

export function insidePolygon(x: number, z: number, points: readonly GymPoint[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Circle versus a polygon, including its edge clearance. No oversized rotated AABBs. */
export function touchesFootprint(x:number,z:number,points:readonly GymPoint[],radius:number){
  if(insidePolygon(x,z,points))return true;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz;
    const t=n?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/n)):0;
    if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<radius)return true;
  }
  return false;
}
/** Circle clearance is tested against exact boundary segments and simple solid proxies.
 * Landscape art and render LOD never alter this collision contract. */
export function canStandAt(x: number, z: number, bounds: GymBounds, colliders: readonly GymCollider[], radius: number = AVATAR_MOVEMENT.radius) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return false;
  if (bounds.walkable) {
    const points = bounds.walkable;
    if (!insidePolygon(x, z, points)) return false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
      const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
      const ex = x - a[0] - t * dx, ez = z - a[1] - t * dz;
      if (ex * ex + ez * ez < radius * radius) return false;
    }
  }
  for (const c of colliders) {
    if (c.kind === 'circle') {
      const dx = x - c.x, dz = z - c.z, r = radius + c.radius;
      if (dx * dx + dz * dz < r * r) return false;
    } else {
      if(x<c.minX-radius||x>c.maxX+radius||z<c.minZ-radius||z>c.maxZ+radius)continue;
      if(c.footprint){if(touchesFootprint(x,z,c.footprint,radius))return false;continue;}
      const dx = x - Math.max(c.minX, Math.min(c.maxX, x)), dz = z - Math.max(c.minZ, Math.min(c.maxZ, z));
      if (dx * dx + dz * dz < radius * radius) return false;
    }
  }
  return true;
}

export const AVATAR_SWIMMING = {
  speed: 1.35, depth: .85, immersion: .78, breathSeconds: 20,
  refillPerSecond: 5, lowBreathSeconds: 5, reentryBreathSeconds: 5,
} as const;
/** Authored dive rules, not a physiological model. Depth is measured below the surface float line;
 * releasing the dive control lets the swimmer drift back up. Breath drains only while submerged. */
export const AVATAR_DIVE = {
  descend: 1.3, ascend: 1.6, buoyancy: .55, response: 5, speed: 1.15,
  /** Depth (m) at which the head is under and the swimmer counts as submerged. */
  submerged: .45, seabedClearance: .3, underwaterDrain: 1,
} as const;
/** Breath rules for a body without equipment use AVATAR_SWIMMING / AVATAR_DIVE. Scuba swaps them. */
export interface AvatarAir { seconds: number; surfaceDrain: number; underwaterDrain: number; diveSpeed: number; descend: number }
/** Scuba is unlimited by design: the gym is cozy exploration, so there is no air to manage or refill.
 * Gear only makes diving quicker. */
export const SCUBA_AIR: AvatarAir = { seconds: AVATAR_SWIMMING.breathSeconds, surfaceDrain: 0, underwaterDrain: 0, diveSpeed: 1.6, descend: 1.7 };
export interface AvatarWater { surfaceHeight: (x: number, z: number) => number | undefined; bounds: GymBounds }
export interface AvatarControllerState {
  version: 1; position: [number, number, number]; heading: number; velocity: [number, number];
  breath: number; exhausted: boolean; safePosition: [number, number, number]; swimming: boolean; wading: boolean;
  /** Optional for older snapshots; absent means grounded. */
  verticalVelocity?: number; grounded?: boolean;
  /** Optional for older snapshots; absent means at the surface. */
  diveDepth?: number;
}
export interface AvatarControllerBody { radius: number; swimDepth: number; swimImmersion: number }
export interface AvatarControllerOptions {
  root: Object3D; spawn: Vector3; bounds: GymBounds; colliders: readonly GymCollider[];
  groundHeight?: (x: number, z: number) => number; water?: AvatarWater; state?: AvatarControllerState;
  /** Metre-scale physical dimensions, captured when this controller is created. */
  body?: AvatarControllerBody;
  /** Worn equipment that changes the breath rules, captured at creation like `body`. */
  air?: AvatarAir;
}

/** Kinematic land/water movement. Input and skeleton animation remain caller-owned.
 * Water needs a finite floor sample. Land/water share an internal coastline seam;
 * solid proxies, outer bounds and the original step/slope limit remain authoritative. */
export function createAvatarController({ root, spawn, bounds, colliders, groundHeight, water, state, body, air }: AvatarControllerOptions) {
  const capacity = air && Number.isFinite(air.seconds) && air.seconds > 0 ? air.seconds : AVATAR_SWIMMING.breathSeconds;
  // The warning scales with the tank: 5 s of 20, 18 s of a 120 s tank.
  const lowBreathAt = Math.max(AVATAR_SWIMMING.lowBreathSeconds, capacity * .15);
  const underwaterDrain = air?.underwaterDrain ?? AVATAR_DIVE.underwaterDrain;
  const diveSpeed = air?.diveSpeed ?? AVATAR_DIVE.speed, descend = air?.descend ?? AVATAR_DIVE.descend;
  let velocityX = 0, velocityZ = 0, breath: number = capacity, exhausted = false;
  // Vertical state is the controller's alone; the rig only reads `airborne`/`verticalVelocity`.
  let verticalVelocity = 0, grounded = true, jumpHeld = false, jumpBuffer = 0, jumpCut = false;
  let diveDepth = 0, diveVelocity = 0;
  // Copy scalar values so changing a design requires an explicit new controller.
  // Invalid external dimensions fall back independently; speed and breath stay fair.
  const positive = (value: number | undefined, fallback: number) => value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
  const radius = positive(body?.radius, AVATAR_MOVEMENT.radius);
  const swimDepth = positive(body?.swimDepth, AVATAR_SWIMMING.depth);
  const swimImmersion = positive(body?.swimImmersion, AVATAR_SWIMMING.immersion);
  const origin = spawn.clone(), safe = spawn.clone();
  const landBox: GymBounds = { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ };
  const wet = water && groundHeight ? water : undefined;
  const result = { speed: 0, moving: false, swimming: false, wading: false, breath, lowBreath: false, exhausted, rescued: false,
    grounded: true, airborne: false, verticalVelocity: 0, jumped: false, landed: false, landingSpeed: 0,
    diveDepth: 0, diving: false, submerged: false,
    /** Height the feet rest on (ground, or the swimming float line); cameras can follow it instead of the hop. */
    supportY: 0, breathCapacity: capacity };
  const floor = (x: number, z: number) => groundHeight?.(x, z);
  function surfaceAt(x: number, z: number) { const y = wet?.surfaceHeight(x, z); return y !== undefined && Number.isFinite(y) ? y : undefined; }
  function depth(x: number, z: number) {
    const y = floor(x, z), surface = surfaceAt(x, z);
    return y !== undefined && Number.isFinite(y) && surface !== undefined && Number.isFinite(surface) ? Math.max(0, surface - y) : 0;
  }
  function onLand(x: number, z: number) {
    if (!wet) return canStandAt(x, z, bounds, colliders, radius);
    // The capsule can straddle a shared beach edge. Its centre must still belong
    // to mapped land or actual water; an absent water sample never opens a void.
    return canStandAt(x, z, landBox, colliders, radius) && (!bounds.walkable || insidePolygon(x, z, bounds.walkable));
  }
  function canOccupy(x: number, z: number) {
    if (groundHeight && !Number.isFinite(floor(x, z))) return false;
    return surfaceAt(x, z) !== undefined && wet ? canStandAt(x, z, wet.bounds, colliders, radius) : onLand(x, z);
  }
  function safeGround(x: number, z: number) {
    return (!groundHeight || Number.isFinite(floor(x, z))) && depth(x, z) === 0 && canStandAt(x, z, bounds, colliders, radius);
  }
  function rememberSafe() {
    if (!safeGround(root.position.x, root.position.z)) return false;
    safe.copy(root.position); return true;
  }
  function support(x: number, z: number) {
    return depth(x, z) >= swimDepth ? wet!.surfaceHeight(x, z)! - swimImmersion : floor(x, z);
  }
  /** Deepest the swimmer's root may sink here: the float line down to just above the seabed. */
  function maxDive(x: number, z: number) {
    const top = support(x, z), bed = floor(x, z);
    return top !== undefined && bed !== undefined && Number.isFinite(top) && Number.isFinite(bed) ? Math.max(0, top - bed - AVATAR_DIVE.seabedClearance) : 0;
  }
  function sync() {
    const d = depth(root.position.x, root.position.z);
    // Airborne bodies are classified when they land; a hop over a puddle is not a swim.
    result.swimming = grounded && d >= swimDepth;
    result.wading = grounded && d > 0 && !result.swimming;
    // A rising seabed or the shore pushes a diver up; leaving deep water ends the dive.
    if (!result.swimming) { diveDepth = 0; diveVelocity = 0; } else diveDepth = Math.min(diveDepth, maxDive(root.position.x, root.position.z));
    const y = support(root.position.x, root.position.z);
    if (y !== undefined && Number.isFinite(y)) { result.supportY = y; if (grounded) root.position.y = y - diveDepth; }
    result.diveDepth = diveDepth; result.diving = diveDepth > .05; result.submerged = diveDepth >= AVATAR_DIVE.submerged;
    if (!result.submerged) refillBreath();
    result.grounded = grounded; result.airborne = !grounded; result.verticalVelocity = result.swimming ? diveVelocity : verticalVelocity;
    result.breath = breath; result.exhausted = exhausted; result.lowBreath = breath <= lowBreathAt;
  }
  /** Boarding pauses simulation, so explicitly clear water and air state there. */
  function leaveWater() {
    land(); refillBreath();
    result.swimming = result.wading = result.submerged = result.diving = false;
    result.diveDepth = 0;
  }
  function refillBreath() {
    breath = capacity; exhausted = false;
    result.breath = capacity; result.exhausted = result.lowBreath = false;
  }
  function land() { grounded = true; verticalVelocity = 0; jumpCut = false; diveDepth = diveVelocity = 0; }
  function stop() { velocityX = velocityZ = 0; result.speed = 0; result.moving = false; }
  function returnToSafety() {
    if (!safeGround(safe.x, safe.z) && safeGround(origin.x, origin.z)) safe.copy(origin);
    root.position.copy(safe); stop(); land(); jumpBuffer = 0;
    const y = floor(safe.x, safe.z); if (y !== undefined && Number.isFinite(y)) root.position.y = y;
    // If every recorded location was invalidated by a map change, keep the last
    // finite transform and wait for valid ground instead of entering unknown space.
    leaveWater();
  }
  function clampVelocity() {
    const limit = result.swimming ? AVATAR_SWIMMING.speed : AVATAR_MOVEMENT.run, magnitude = Math.hypot(velocityX, velocityZ);
    if (magnitude > limit) { velocityX *= limit / magnitude; velocityZ *= limit / magnitude; }
  }
  function reset() {
    root.position.copy(origin); root.rotation.y = 0; stop(); land(); jumpBuffer = 0; jumpHeld = false;
    breath = capacity; exhausted = false; result.rescued = false;
    sync(); rememberSafe();
  }
  function canMove(x: number, z: number) {
    if (!canOccupy(x, z)) return false;
    const toDepth = depth(x, z);
    if (toDepth >= swimDepth && exhausted) return false;
    if (!groundHeight) return true;
    // A swimmer may cross an underwater shelf. Entering/leaving water still
    // obeys grounded step limits, so a high cliff never becomes a beach route.
    if (toDepth >= swimDepth && depth(root.position.x, root.position.z) >= swimDepth) return true;
    const from = floor(root.position.x, root.position.z)!, to = floor(x, z)!;
    const limit = Math.max(.28, Math.hypot(x - root.position.x, z - root.position.z) * 1.1);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    // In the air the feet may pass over a ledge they have cleared, so a jump climbs
    // low walls and stair edges. Drops keep the grounded limit: no leaping off cliffs.
    if (!grounded) return to <= root.position.y + .02 && from - to <= limit;
    return Math.abs(to - from) <= limit;
  }
  function getState(): AvatarControllerState {
    return { version: 1, position: [root.position.x, root.position.y, root.position.z], heading: root.rotation.y,
      velocity: [velocityX, velocityZ], breath, exhausted, safePosition: [safe.x, safe.y, safe.z], swimming: result.swimming, wading: result.wading,
      verticalVelocity, grounded, diveDepth };
  }
  function restoreState(value: unknown) {
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return false;
    const saved = value as AvatarControllerState;
    const tuple = (v: unknown, size: number): v is number[] => Array.isArray(v) && v.length === size && v.every(Number.isFinite);
    breath = Number.isFinite(saved.breath) ? Math.max(0, Math.min(capacity, saved.breath)) : breath;
    exhausted = breath === 0 || (saved.exhausted === true && breath < AVATAR_SWIMMING.reentryBreathSeconds);
    if (tuple(saved.safePosition, 3) && safeGround(saved.safePosition[0], saved.safePosition[2])) safe.set(...saved.safePosition);
    const accepted = tuple(saved.position, 3) && canOccupy(saved.position[0], saved.position[2]);
    if (accepted) root.position.set(...saved.position); else returnToSafety();
    land(); jumpBuffer = 0;
    // Resume a hop only when it is still above its support; anything else lands.
    const supportY = support(root.position.x, root.position.z);
    if (accepted && saved.grounded === false && Number.isFinite(saved.verticalVelocity) && supportY !== undefined && root.position.y > supportY) {
      grounded = false; verticalVelocity = Math.max(-30, Math.min(30, saved.verticalVelocity!));
    }
    // Resume a dive at its saved depth; sync() clamps it to this spot's water.
    if (accepted && grounded && Number.isFinite(saved.diveDepth) && saved.diveDepth! > 0) diveDepth = saved.diveDepth!;
    root.rotation.y = Number.isFinite(saved.heading) ? Math.atan2(Math.sin(saved.heading), Math.cos(saved.heading)) : 0;
    velocityX = accepted && tuple(saved.velocity, 2) ? saved.velocity[0] : 0;
    velocityZ = accepted && tuple(saved.velocity, 2) ? saved.velocity[1] : 0;
    result.rescued = false; sync(); clampVelocity(); if (grounded) rememberSafe();
    result.speed = 0; result.moving = false;
    return accepted;
  }
  reset(); if (state) restoreState(state);
  return {
    position: root.position, reset, getState, restoreState, leaveWater,
    update(dt: number, input: AvatarInput) {
      result.rescued = result.jumped = result.landed = false; result.landingSpeed = 0;
      // Edge detection belongs here, not to the keyboard: a held key never auto-repeats a jump.
      const jumpDown = input.jump === true;
      if (jumpDown && !jumpHeld) jumpBuffer = AVATAR_JUMP.bufferSeconds;
      jumpHeld = jumpDown;
      if (!Number.isFinite(dt) || dt <= 0) return result;
      dt = Math.min(dt, AVATAR_MOVEMENT.maxFrameStep);
      if ((wet && !canOccupy(root.position.x, root.position.z)) || !Number.isFinite(root.position.x) || !Number.isFinite(root.position.y) || !Number.isFinite(root.position.z) || (wet && depth(root.position.x, root.position.z) >= swimDepth && exhausted)) {
        returnToSafety(); result.breath = breath; result.exhausted = exhausted; result.lowBreath = breath <= lowBreathAt; return result;
      }
      sync(); clampVelocity();
      // Swimmers tread water instead; a buffered press survives briefly so it fires on landing.
      if (jumpBuffer > 0 && grounded && !result.swimming) {
        grounded = false; jumpCut = false; jumpBuffer = 0; result.jumped = true;
        verticalVelocity = Math.sqrt(2 * AVATAR_JUMP.gravity * AVATAR_JUMP.height);
        result.swimming = result.wading = false;
      }
      jumpBuffer = Math.max(0, jumpBuffer - dt);
      if (!grounded && !jumpHeld && !jumpCut && verticalVelocity > 0) { verticalVelocity *= AVATAR_JUMP.releaseCut; jumpCut = true; }
      if (result.swimming) {
        // Dive holds descend, jump holds swim up, and otherwise gentle buoyancy returns to the surface.
        // An exhausted swimmer cannot dive. Depth stays between the float line and the seabed.
        const target = input.dive === true && !exhausted ? -descend : jumpDown ? AVATAR_DIVE.ascend : AVATAR_DIVE.buoyancy;
        diveVelocity += (target - diveVelocity) * (1 - Math.exp(-AVATAR_DIVE.response * dt));
        diveDepth = Math.max(0, Math.min(maxDive(root.position.x, root.position.z), diveDepth - diveVelocity * dt));
        if (diveDepth === 0 && diveVelocity > 0) diveVelocity = 0;
        jumpBuffer = 0;
      }
      const x = Number.isFinite(input.x) ? input.x : 0, z = Number.isFinite(input.z) ? input.z : 0;
      const magnitude = Math.hypot(x, z), normalizer = Math.max(1, magnitude);
      const speed = result.swimming ? (diveDepth >= AVATAR_DIVE.submerged ? diveSpeed : AVATAR_SWIMMING.speed) : input.run ? AVATAR_MOVEMENT.run : AVATAR_MOVEMENT.walk;
      const blend = 1 - Math.exp(-AVATAR_MOVEMENT.acceleration * (grounded ? 1 : AVATAR_JUMP.airControl) * dt);
      velocityX += (x / normalizer * speed - velocityX) * blend; velocityZ += (z / normalizer * speed - velocityZ) * blend;
      if (Math.abs(velocityX) < .001) velocityX = 0; if (Math.abs(velocityZ) < .001) velocityZ = 0;
      const startX = root.position.x, startZ = root.position.z;
      const steps = Math.max(1, Math.ceil(Math.hypot(velocityX, velocityZ) * dt / .1)), stepDt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const dx = velocityX * stepDt, dz = velocityZ * stepDt;
        if (canMove(root.position.x + dx, root.position.z)) root.position.x += dx;
        if (canMove(root.position.x, root.position.z + dz)) root.position.z += dz;
        if (!grounded) {
          verticalVelocity -= AVATAR_JUMP.gravity * stepDt; root.position.y += verticalVelocity * stepDt;
          const below = support(root.position.x, root.position.z);
          if (below !== undefined && Number.isFinite(below) && root.position.y <= below) {
            if (verticalVelocity <= 0) { result.landed = true; result.landingSpeed = -verticalVelocity; land(); }
            else root.position.y = below;
          }
        }
        sync(); clampVelocity();
        if (!grounded) continue;
        if (result.submerged) {
          breath = Math.max(0, breath - stepDt * underwaterDrain);
          if (breath < 1e-9) {
            breath = 0; exhausted = true; returnToSafety(); result.rescued = true; break;
          }
        } else {
          refillBreath(); rememberSafe();
        }
      }
      if (!result.rescued) {
        const movedX = root.position.x - startX, movedZ = root.position.z - startZ;
        result.speed = Math.hypot(movedX, movedZ) / dt; result.moving = result.speed > .04;
        if (result.moving) {
          const angle = Math.atan2(movedX, movedZ), difference = Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y));
          root.rotation.y += difference * (1 - Math.exp(-16 * dt));
        }
      }
      result.breath = breath; result.exhausted = exhausted; result.lowBreath = breath <= lowBreathAt;
      return result;
    },
  };
}
