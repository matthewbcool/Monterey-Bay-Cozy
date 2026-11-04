/** Small, authored gray-whale gathering offshore of Lovers Point. Routes and event timing
 * are game staging, not a live wildlife sighting. World motion is independent of mesh LOD. */
import { BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MathUtils, Mesh, Object3D, TorusGeometry, Vector3 } from 'three';
import { createGrayWhaleModel } from '../../models/gray-whale/createGrayWhaleModel';
import { createToonMaterial } from '../../models/shared/style';

export const GYM_WHALE_POD = {
  center: [220, 20] as const,
  sightingChance: .2,
  adultLengths: [12.5, 11.8] as const,
  calfLength: 5.7,
  activeRadius: 290,
  // Three whales use six model draws and share one instanced surface-wake draw.
  budget: { drawCalls: 13, triangles: 5_200 },
} as const;

type Role = 'mother' | 'calf' | 'adult';
const smoothstep = (value: number) => { const t = MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };

/** Two diverging plumes from the paired blowholes, combined in one small mesh. */
function sprayGeometry() {
  const positions: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI / 3, c = Math.cos(angle), s = Math.sin(angle), start = positions.length / 3;
    const local: readonly [number, number, number][] = [[-.19, 0, 0], [.19, 0, 0], [.28, 1.5, side * .10], [.08, 3.3, side * .38], [-.13, 1.4, side * .10]];
    for (const [x, y, z] of local) positions.push(x * c - z * s, y, x * s + z * c + side * .12);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3, start, start + 3, start + 4);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Two tiny tapered surface marks per whale, sharing one instanced draw for the whole pod. */
function wakeGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.13, 0, -.15,  .42, 0, -.42,  .30, 0, -.28,
    -.13, 0, .15,   .30, 0, .28,   .42, 0, .42,
  ], 3));
  geometry.computeVertexNormals(); return geometry;
}

export function createGymWhalePod(surfaceY: number) {
  const root = new Group(); root.name = 'Offshore gray whale mother, calf and adult';
  root.userData = { units: 'metres', seed: 6256, budget: GYM_WHALE_POD.budget, placement: 'authored migration illustration' };
  const sprayShape = sprayGeometry(), sprayPaint = createToonMaterial({ color: '#e4f0e7', side: DoubleSide, rim: false, name: 'whale-spout' });
  const splashShape = new TorusGeometry(1, .075, 3, 18), splashPaint = createToonMaterial({ color: '#c2ded7', rim: false, name: 'whale-splash' });
  const wakeShape = wakeGeometry(), wakePaint = createToonMaterial({ color: '#d0e3dc', side: DoubleSide, rim: false, name: 'whale-surface-wake' });
  const wakes = new InstancedMesh(wakeShape, wakePaint, 3); wakes.name = 'Whale surface wakes · one batch'; wakes.frustumCulled = false; root.add(wakes);
  const wakePlacement = new Object3D();
  const definitions: readonly { role: Role; length: number; seed: number; breath: number; offset: number; breachStart: number; breachPeriod: number; diveStart: number; divePeriod: number }[] = [
    { role: 'mother', length: 12.5, seed: 625601, breath: 13, offset: 0, breachStart: 40, breachPeriod: 220, diveStart: 15, divePeriod: 150 },
    { role: 'calf', length: 5.7, seed: 625602, breath: 10, offset: 5, breachStart: Infinity, breachPeriod: Infinity, diveStart: 15.5, divePeriod: 150 },
    { role: 'adult', length: 11.8, seed: 625603, breath: 17, offset: 8, breachStart: 130, breachPeriod: 260, diveStart: 60, divePeriod: 185 },
  ];
  const members = definitions.map(def => {
    const model = createGrayWhaleModel({ lengthMeters: def.length, seed: def.seed });
    model.setMotionOwner('path'); model.setSwimMode('slow', true);
    model.root.name = `Gray whale · ${def.role}`;
    const spray = new Mesh(sprayShape, sprayPaint); spray.name = `${def.role} spout`; spray.visible = false; spray.frustumCulled = false;
    const splash = new Mesh(splashShape, splashPaint); splash.name = `${def.role} breach splash`; splash.rotation.x = -Math.PI / 2; splash.visible = false;
    root.add(model.root, spray, splash);
    return { ...def, model, spray, splash, breaching: false, spouting: false, diving: false, tailRaised: false };
  });
  // The compact offshore circuit keeps the whole group clear of the mapped coast.
  const points = Array.from({ length: 20 }, (_, i) => {
    const angle = i / 20 * Math.PI * 2;
    return new Vector3(GYM_WHALE_POD.center[0] + 24 * Math.cos(angle), 0, GYM_WHALE_POD.center[1] + 14 * Math.sin(angle));
  });
  const route = new CatmullRomCurve3(points, true, 'centripetal'); route.arcLengthDivisions = 256;
  const routeLength = route.getLength(), position = new Vector3(), direction = new Vector3();
  const motherPosition = new Vector3(), motherDirection = new Vector3(), head = new Vector3();
  let elapsed = 0, disposed = false, active = true;
  function place() {
    members.forEach((member, index) => {
      const isAdult = member.role === 'adult';
      if (member.model.getState().motionOwner !== 'path') {
        // A later physics/network owner may take the rigid root without fighting this route.
        if (member.role === 'mother') {
          motherPosition.copy(member.model.root.position);
          motherDirection.set(-Math.cos(member.model.root.rotation.y), 0, Math.sin(member.model.root.rotation.y));
        }
        member.breaching = member.spouting = member.diving = member.tailRaised = member.spray.visible = member.splash.visible = false;
        wakePlacement.position.set(member.model.root.position.x, surfaceY + .12, member.model.root.position.z);
        wakePlacement.scale.setScalar(.001); wakePlacement.updateMatrix(); wakes.setMatrixAt(index, wakePlacement.matrix);
        return;
      }
      const progress = (elapsed * 1.08 / routeLength + (isAdult ? .14 : .02)) % 1;
      route.getPointAt(progress, position); route.getTangentAt(progress, direction).normalize();
      if (member.role === 'mother') { motherPosition.copy(position); motherDirection.copy(direction); }
      if (member.role === 'calf') {
        position.copy(motherPosition).addScaledVector(motherDirection, -2);
        position.x -= motherDirection.z * 5.5; position.z += motherDirection.x * 5.5;
        direction.copy(motherDirection);
      }
      const since = elapsed - member.breachStart;
      const breachPhase = since >= 0 && Number.isFinite(member.breachPeriod) ? since % member.breachPeriod : Infinity;
      const leap = breachPhase < 3.8 ? Math.sin(Math.PI * breachPhase / 3.8) : 0;
      member.breaching = leap > 0;
      // A short surface sound: bow down, flukes above water, then a shallow
      // submersion and gradual return. The Gym seabed is too shallow for a real dive.
      const diveSince = elapsed - member.diveStart;
      const divePhase = diveSince >= 0 ? diveSince % member.divePeriod : Infinity;
      member.diving = !member.breaching && divePhase < 9;
      const tailLift = member.diving ? smoothstep(divePhase / 1.4) * (1 - smoothstep((divePhase - 2.5) / 2.2)) : 0;
      const sink = member.diving ? .8 * smoothstep(divePhase / 2.2) * (1 - smoothstep((divePhase - 6.5) / 2.5)) : 0;
      member.tailRaised = tailLift > .3;
      const breathPhase = (elapsed + member.offset) % member.breath;
      const breath = !member.breaching && !member.diving && breathPhase < 1.55 ? Math.sin(Math.PI * breathPhase / 1.55) : 0;
      member.spouting = breath > .02;
      const baseline = surfaceY - member.length * .045;
      member.model.root.position.set(position.x, baseline + .12 * Math.sin(elapsed * .65 + member.seed) + .38 * breath + 4.1 * leap - sink, position.z);
      member.model.root.rotation.set(0, Math.atan2(direction.z, -direction.x), -.68 * leap + .42 * tailLift, 'YZX');
      wakePlacement.position.set(position.x, surfaceY + .12, position.z);
      wakePlacement.rotation.set(0, member.model.root.rotation.y, 0);
      const wakeScale = member.breaching ? .001 : member.diving ? MathUtils.lerp(.65, .001, sink / .8) : 1;
      wakePlacement.scale.set(member.length * wakeScale, 1, member.length * .45 * wakeScale);
      wakePlacement.updateMatrix(); wakes.setMatrixAt(index, wakePlacement.matrix);
      member.spray.visible = member.spouting;
      if (member.spouting) {
        member.model.root.updateMatrixWorld(true);
        member.model.root.localToWorld(head.set(-.412 * member.length, .065 * member.length, 0));
        member.spray.position.set(head.x, Math.max(surfaceY + .05, head.y), head.z);
        member.spray.scale.setScalar(member.role === 'calf' ? .55 : .95);
        member.spray.scale.y *= breath;
      }
      member.splash.visible = member.breaching;
      if (member.breaching) {
        member.splash.position.set(position.x, surfaceY + .06, position.z);
        member.splash.scale.setScalar(MathUtils.lerp(.85, member.length * .28, Math.sin(Math.PI * breachPhase / 3.8)));
      }
    });
    wakes.instanceMatrix.needsUpdate = true;
  }
  place();
  return {
    root, members,
    get active() { return active; },
    setViewer(x: number, z: number, overview = false) {
      active = overview || Math.hypot(x - GYM_WHALE_POD.center[0], z - GYM_WHALE_POD.center[1]) < GYM_WHALE_POD.activeRadius;
      root.visible = active;
    },
    update(dt: number, animate = true) {
      if (disposed || !animate || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1); elapsed += dt;
      place(); for (const member of members) member.model.update(dt);
    },
    stats() { return { sighting: true, adults: 2, calves: 1, active, spouting: members.filter(m => m.spouting).length, breaching: members.filter(m => m.breaching).length, diving: members.filter(m => m.diving).length, tailsRaised: members.filter(m => m.tailRaised).length, elapsed }; },
    dispose() {
      if (disposed) return; disposed = true;
      members.forEach(member => member.model.dispose());
      wakes.dispose(); wakeShape.dispose(); sprayShape.dispose(); splashShape.dispose(); wakes.material.dispose(); members[0].spray.material.dispose(); members[0].splash.material.dispose(); root.removeFromParent();
    },
  };
}

/** One roll per Gym creation. The caller can supply an authoritative world roll later. */
export function createGymWhaleSighting(surfaceY: number, roll: number) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Whale sighting roll must be in [0, 1)');
  if (roll < GYM_WHALE_POD.sightingChance) return createGymWhalePod(surfaceY);
  // No whales, effects, animation work, or LOD buffers on the other four visits.
  const root = new Group(); root.name = 'No gray-whale sighting';
  root.userData = { units: 'metres', sighting: false, sightingChance: GYM_WHALE_POD.sightingChance };
  root.visible = false;
  return {
    root, members: [] as [],
    get active() { return false; },
    setViewer(_x: number, _z: number, _overview = false) { root.visible = false; },
    update(_dt: number, _animate = true) {},
    stats() { return { sighting: false, adults: 0, calves: 0, active: false, spouting: 0, breaching: 0, diving: 0, tailsRaised: 0, elapsed: 0 }; },
    dispose() { root.removeFromParent(); },
  };
}
