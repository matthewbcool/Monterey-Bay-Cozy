/** Small, deterministic ground herds. World collision owns safe space; neither
 * render LOD nor a creature rig participates in these metre-scale decisions.
 * This is bounded local steering, not a navigation mesh or wildlife telemetry. */
export type DeerBehaviorPose = 'idle' | 'eat' | 'walk' | 'gallop';
export interface DeerHerdMemberInput {
  id: string; age: 'adult' | 'fawn'; x: number; z: number; yaw?: number; radius?: number;
}
export interface DeerHerdMember {
  readonly id: string; readonly age: 'adult' | 'fawn'; readonly radius: number;
  x: number; y: number; z: number; yaw: number;
  pose: DeerBehaviorPose; speed: number;
  /** Continuous walking (0) to galloping (1) footfall mix for the model rig. */
  gaitBlend: number;
  velocity: { x: number; z: number }; timeSeconds: number;
}
export interface DeerBehaviorWorld {
  heightAt(x: number, z: number): number;
  /** Include collider clearance and the intended habitat polygon here. */
  canStandAt(x: number, z: number, radius: number): boolean;
  isWater?(x: number, z: number): boolean;
}
export interface DeerHerdOptions {
  seed: number; members: readonly DeerHerdMemberInput[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  world: DeerBehaviorWorld;
}
/** Authored game tuning, not measured species speeds or a safety guideline. */
export const DEER_BEHAVIOR = {
  stepSeconds: 1 / 30, maxFrameSeconds: .1,
  scareMeters: 6, releaseMeters: 11, playerVerticalMeters: 3,
  minimumFleeSeconds: 2.5, calmSeconds: 3,
  adultWalkMetersPerSecond: .72, adultGallopMetersPerSecond: 3.3,
  followMeters: 1.85, softLeashMeters: 3.8, maxSeparationMeters: 6.5,
  maxSlope: .65, stepToleranceMeters: .035, sweepMeters: .14,
  planSeconds: .4, turnRadiansPerSecond: 3.8,
} as const;
const turns = [0, .4, -.4, .8, -.8, 1.2, -1.2, 1.55, -1.55, Math.PI];
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const approach = (value: number, target: number, amount: number) => value + Math.max(-amount, Math.min(amount, target - value));

export function createDeerHerd({ seed, members: inputs, bounds, world }: DeerHerdOptions) {
  if (!inputs.length || inputs.length > 16) throw new RangeError('A deer herd requires 1–16 members');
  if (!Number.isFinite(seed) || ![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)
    || bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ) throw new RangeError('Invalid deer seed or habitat bounds');
  if (new Set(inputs.map(input => input.id)).size !== inputs.length) throw new Error('Deer member ids must be unique');
  let randomState = seed >>> 0;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  const leaderIndex = Math.max(0, inputs.findIndex(input => input.age === 'adult'));
  const members: DeerHerdMember[] = inputs.map(input => ({
    id: input.id, age: input.age, radius: input.radius ?? (input.age === 'fawn' ? .36 : .62),
    x: input.x, y: world.heightAt(input.x, input.z), z: input.z, yaw: input.yaw ?? random() * Math.PI * 2,
    pose: 'idle', speed: 0, gaitBlend: 0, velocity: { x: 0, z: 0 }, timeSeconds: 0,
  }));
  const leader = members[leaderIndex], homeX = leader.x, homeZ = leader.z;
  // All mutable working storage is allocated once, and public member identities
  // remain stable so a renderer/network adapter can retain direct references.
  const plans = members.map(() => ({ yaw: 0, due: 0, valid: false, rest: 1.5 + random() * 3, eat: random() > .45 }));
  let phase: 'resting' | 'walking' | 'fleeing' = 'resting';
  let phaseRemaining = 3.5 + random() * 3, fleeAge = 0, calmAge = 0;
  let targetX = leader.x, targetZ = leader.z, elapsed = 0, steps = 0, alerts = 0, accumulator = 0, active = true;
  let playerX = 0, playerY = 0, playerZ = 0, playerEnabled = false;

  /** The caller's radius-aware predicate blocks fences/buildings. Extra water
   * and footprint slope probes stop feet straddling a shore or steep bank. */
  function safeGround(x: number, z: number, radius: number) {
    if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius
      || !world.canStandAt(x, z, radius) || world.isWater?.(x, z)) return NaN;
    const y = world.heightAt(x, z);
    if (!Number.isFinite(y)) return NaN;
    for (let i = 0; i < 4; i++) {
      const xx = x + (i === 0 ? radius : i === 1 ? -radius : 0);
      const zz = z + (i === 2 ? radius : i === 3 ? -radius : 0);
      const h = world.heightAt(xx, zz);
      if (!Number.isFinite(h) || world.isWater?.(xx, zz)
        || Math.abs(h - y) > radius * DEER_BEHAVIOR.maxSlope + DEER_BEHAVIOR.stepToleranceMeters) return NaN;
    }
    return y;
  }
  for (const member of members) {
    if (!member.id || ![member.x, member.z, member.y, member.yaw, member.radius].every(Number.isFinite) || member.radius <= 0
      || !Number.isFinite(safeGround(member.x, member.z, member.radius))) throw new RangeError(`Unsafe deer spawn: ${member.id}`);
    if (Math.hypot(member.x - leader.x, member.z - leader.z) > DEER_BEHAVIOR.maxSeparationMeters)
      throw new RangeError('Deer members must spawn together');
    for (const other of members) if (other !== member
      && Math.hypot(member.x - other.x, member.z - other.z) < member.radius + other.radius)
      throw new RangeError('Deer members must not overlap at spawn');
  }
  function playerDistance(member: DeerHerdMember) {
    return playerEnabled && Math.abs(playerY - member.y) <= DEER_BEHAVIOR.playerVerticalMeters
      ? Math.hypot(member.x - playerX, member.z - playerZ) : Infinity;
  }
  function closestPlayerDistance() {
    let closest = Infinity;
    for (const member of members) closest = Math.min(closest, playerDistance(member));
    return closest;
  }
  function invalidatePlans() { for (const plan of plans) { plan.due = 0; plan.valid = false; } }
  function withinLeash(member: DeerHerdMember, x: number, z: number) {
    // Conservative ground circles cover the body through turns, so family
    // cohesion cannot steer a fawn through the adult's torso. As with fences,
    // this is tested along every swept segment rather than pushing actors apart.
    for (const other of members) if (other !== member) {
      const dx = other.x - x, dz = other.z - z, clearance = member.radius + other.radius;
      if (dx * dx + dz * dz < clearance * clearance) return false;
    }
    if (member === leader) {
      for (const other of members) if (other !== leader && Math.hypot(other.x - x, other.z - z) > DEER_BEHAVIOR.maxSeparationMeters) return false;
    } else if (Math.hypot(leader.x - x, leader.z - z) > DEER_BEHAVIOR.maxSeparationMeters) return false;
    return true;
  }
  /** Check the entire capsule path, not just a valid destination beyond a thin
   * fence. No state is changed until every intermediate sample is accepted. */
  function clearPath(member: DeerHerdMember, dx: number, dz: number) {
    const distance = Math.hypot(dx, dz), count = Math.max(1, Math.ceil(distance / Math.min(DEER_BEHAVIOR.sweepMeters, member.radius * .5)));
    let previousY = member.y;
    for (let i = 1; i <= count; i++) {
      const x = member.x + dx * i / count, z = member.z + dz * i / count;
      if (!withinLeash(member, x, z)) return false;
      const y = safeGround(x, z, member.radius);
      if (!Number.isFinite(y) || Math.abs(y - previousY) > DEER_BEHAVIOR.maxSlope * distance / count + DEER_BEHAVIOR.stepToleranceMeters) return false;
      previousY = y;
    }
    return true;
  }
  function chooseHeading(index: number, dx: number, dz: number, speed: number) {
    const member = members[index], plan = plans[index], direction = Math.atan2(-dx, -dz);
    const distance = Math.min(1.4, Math.max(.45, speed * .4));
    plan.valid = false; plan.due = DEER_BEHAVIOR.planSeconds;
    for (const turn of turns) {
      const yaw = direction + turn, x = -Math.sin(yaw) * distance, z = -Math.cos(yaw) * distance;
      // A frightened member must never choose a route back toward the player.
      // When cornered, remain in place instead of teleporting or crossing a wall.
      if (phase === 'fleeing'
        && x * (member.x - playerX) + z * (member.z - playerZ) <= 0) continue;
      if (clearPath(member, x, z)) { plan.yaw = yaw; plan.valid = true; return; }
    }
  }
  function startWalking() {
    phase = 'walking'; phaseRemaining = 3 + random() * 3;
    const homeDistance = Math.hypot(leader.x - homeX, leader.z - homeZ);
    const angle = homeDistance > 8 ? Math.atan2(homeX - leader.x, homeZ - leader.z) + (random() - .5) * .5 : random() * Math.PI * 2;
    const distance = 3 + random() * 3;
    targetX = leader.x + Math.sin(angle) * distance; targetZ = leader.z + Math.cos(angle) * distance;
    invalidatePlans();
  }
  function step(dt: number, ambient: boolean) {
    const closest = closestPlayerDistance();
    if (closest < DEER_BEHAVIOR.scareMeters && phase !== 'fleeing') {
      phase = 'fleeing'; fleeAge = 0; calmAge = 0; alerts++; invalidatePlans();
    }
    if (phase === 'fleeing') {
      fleeAge += dt;
      calmAge = closest > DEER_BEHAVIOR.releaseMeters ? calmAge + dt : 0;
      if (fleeAge >= DEER_BEHAVIOR.minimumFleeSeconds && calmAge >= DEER_BEHAVIOR.calmSeconds) {
        phase = 'resting'; phaseRemaining = 4 + random() * 3; invalidatePlans();
      }
    } else if (ambient) {
      phaseRemaining -= dt;
      if (phaseRemaining <= 0) {
        if (phase === 'resting') startWalking();
        else { phase = 'resting'; phaseRemaining = 3.5 + random() * 4; invalidatePlans(); }
      }
    }
    elapsed += dt; steps++;
    // The adult advances first; followers see its latest safe position. Input
    // order stays unchanged for stable member ids and model bindings.
    for (let order = 0; order < members.length; order++) {
      const index = order === 0 ? leaderIndex : order <= leaderIndex ? order - 1 : order;
      const member = members[index], plan = plans[index];
      let dx = 0, dz = 0, desiredSpeed = 0;
      if (member === leader && phase !== 'resting') {
        dx = phase === 'fleeing' ? member.x - playerX : targetX - member.x;
        dz = phase === 'fleeing' ? member.z - playerZ : targetZ - member.z;
        if (dx * dx + dz * dz < 1e-8) { dx = -Math.sin(member.yaw); dz = -Math.cos(member.yaw); }
        desiredSpeed = phase === 'fleeing' ? DEER_BEHAVIOR.adultGallopMetersPerSecond : DEER_BEHAVIOR.adultWalkMetersPerSecond;
        for (const other of members) if (other !== leader) {
          const separation = Math.hypot(other.x - member.x, other.z - member.z);
          if (separation > DEER_BEHAVIOR.softLeashMeters) desiredSpeed *= Math.max(0, (DEER_BEHAVIOR.maxSeparationMeters - separation) / (DEER_BEHAVIOR.maxSeparationMeters - DEER_BEHAVIOR.softLeashMeters));
        }
        if (phase === 'walking' && Math.hypot(dx, dz) < .4) desiredSpeed = 0;
      } else if (member !== leader) {
        // A staggered position behind the adult keeps the small animal visible.
        const side = (order % 2 ? 1 : -1) * (.65 + Math.floor(order / 2) * .55);
        const behind = DEER_BEHAVIOR.followMeters + Math.floor(order / 2) * .65;
        const x = leader.x + Math.sin(leader.yaw) * behind + Math.cos(leader.yaw) * side;
        const z = leader.z + Math.cos(leader.yaw) * behind - Math.sin(leader.yaw) * side;
        dx = x - member.x; dz = z - member.z;
        const distance = Math.hypot(dx, dz), separation = Math.hypot(leader.x - member.x, leader.z - member.z);
        if (distance > .45 && (phase !== 'resting' || separation > DEER_BEHAVIOR.softLeashMeters))
          desiredSpeed = Math.min(phase === 'fleeing' ? 4 : 1.05, Math.max(0, distance - .35) * 1.6);
        if (separation > DEER_BEHAVIOR.softLeashMeters) { dx = leader.x - member.x; dz = leader.z - member.z; }
      }
      plan.due -= dt;
      if (desiredSpeed > .02 && plan.due <= 0) chooseHeading(index, dx, dz, desiredSpeed);
      if (desiredSpeed <= .02 || !plan.valid) desiredSpeed = 0;
      if (desiredSpeed > 0) {
        const difference = wrap(plan.yaw - member.yaw);
        member.yaw = wrap(member.yaw + Math.max(-DEER_BEHAVIOR.turnRadiansPerSecond * dt, Math.min(DEER_BEHAVIOR.turnRadiansPerSecond * dt, difference)));
        // Turn in place before travelling; do not slide sideways through the
        // player or let a rapidly changing target create an instant U-turn.
        desiredSpeed *= Math.max(0, 1 - Math.abs(wrap(plan.yaw - member.yaw)) / .7);
      }
      let speed = approach(member.speed, desiredSpeed, (desiredSpeed > member.speed ? 5 : 9) * dt);
      let moveX = -Math.sin(member.yaw) * speed * dt, moveZ = -Math.cos(member.yaw) * speed * dt;
      if (speed > .001 && (phase === 'fleeing'
        && moveX * (member.x - playerX) + moveZ * (member.z - playerZ) < 0 || !clearPath(member, moveX, moveZ))) {
        speed = 0; moveX = 0; moveZ = 0; plan.valid = false;
        // A short retry cadence prevents a blocked animal oscillating left/right
        // every frame while still reacting to a newly opened safe route.
        plan.due = Math.min(plan.due, .2);
      }
      member.x += moveX; member.z += moveZ;
      if (speed > 0) member.y = world.heightAt(member.x, member.z);
      member.speed = speed; member.velocity.x = moveX / dt; member.velocity.z = moveZ / dt;
      if (speed > .06) member.pose = phase === 'fleeing' ? 'gallop' : 'walk';
      else if (phase === 'fleeing' || desiredSpeed > 0) member.pose = 'idle';
      else {
        plan.rest -= dt;
        if (plan.rest <= 0) { plan.eat = !plan.eat; plan.rest = 2 + random() * 4; }
        member.pose = plan.eat ? 'eat' : 'idle';
      }
      member.gaitBlend = approach(member.gaitBlend, phase === 'fleeing' && speed > .06 ? 1 : 0, dt * 5);
      member.timeSeconds += dt;
    }
  }
  return {
    members,
    get active() { return active; }, get phase() { return phase; }, get elapsed() { return elapsed; },
    get steps() { return steps; }, get alerts() { return alerts; },
    setPlayer(x: number, y: number, z: number, enabled = true) {
      playerEnabled = enabled && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
      if (playerEnabled) { playerX = x; playerY = y; playerZ = z; }
    },
    /** Interest/lifecycle owner may sleep this local simulation. Waking resumes
     * its last state without advancing missed time or rebuilding geometry. */
    setActive(value: boolean) { active = value; if (!active) accumulator = 0; },
    /** Reduced motion freezes ambient travel, but nearby player avoidance and
     * its calm-down phase still run. No active player means a frozen ambient
     * herd. Returns whether the caller should apply poses to its model rigs. */
    update(dt: number, motionEnabled = true) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return false;
      if (!motionEnabled && phase !== 'fleeing' && closestPlayerDistance() >= DEER_BEHAVIOR.scareMeters) { accumulator = 0; return false; }
      accumulator += Math.min(dt, DEER_BEHAVIOR.maxFrameSeconds);
      let advanced = false;
      while (accumulator + 1e-10 >= DEER_BEHAVIOR.stepSeconds) {
        accumulator = Math.max(0, accumulator - DEER_BEHAVIOR.stepSeconds);
        step(DEER_BEHAVIOR.stepSeconds, motionEnabled); advanced = true;
      }
      return advanced;
    },
  };
}
