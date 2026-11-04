import { CatmullRomCurve3, Euler, Group, IcosahedronGeometry, InstancedMesh, Material, MathUtils, Matrix3, Matrix4, Mesh, Object3D, Raycaster, Vector3 } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { attribute, cos, float, instanceIndex, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { fishCollection, type FishEntry } from '../../models/catalogue';
import { createGiantKelp } from '../../models/habitat/giantKelp';
import { createBatStarColony } from '../../models/habitat/batStarColony';
import { createUrchinColony } from '../../models/habitat/purple-urchin/colony';
import { createAnemoneBed, type AnemonePlacement } from '../../models/habitat/anemone/createAnemone';
import { createMoonJelly, updateMoonJelly } from '../../models/habitat/moon-jelly/createMoonJelly';
import { createSardineSchool } from '../../models/pacific-sardine/createSardineSchool';
import { surfaceAnchorFromHit, type SurfaceAnchor } from '../../models/shared/surfaceAttachment';
import { disposeObject, mat, mesh } from '../../models/props/primitives';
import { finishStaticAsset } from '../../models/shared/staticAsset';
import { createDemoSchool } from '../demoSchool';
import { DEMO_SCHOOLS } from '../demoPopulation';

/** Temperate rocky reef and kelp forest for the gym's dive site (granite boulders, no coral: Monterey
 * Bay has no coral reefs), all from the shared library. Species are
 * Monterey Bay kelp-forest residents; counts, placement and routes are artistic staging, not a
 * survey. Garibaldi (a Southern California reef fish) is deliberately left out. */
export const GYM_REEF = {
  kelp: 24, rocks: 9, stars: 10, urchins: 4, giantGreen: 8, aggregating: 16,
  fish: { 'blue-rockfish': 5, 'kelp-greenling': 2, 'california-sheephead': 1, lingcod: 1 } as Record<string, number>,
  sardines: 16, jellies: 3,
  /** The reef renders and simulates only while the player is this close (metres, plan view). */
  activeRadius: 85,
  /** Separate from the park's world ceiling; costs only apply while the reef is active. */
  budget: { drawCalls: 44, triangles: 80_000 },
} as const;

function seeded(seed: number) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>> 0) / 4294967296); }

interface Swimmer { model: { root: Object3D; update(dt: number): void }; curve: CatmullRomCurve3; length: number; distance: number; speed: number; orient: boolean }

/** `center` is a seabed point in gym metres; `floorAt` is the controller's survey-backed seabed. */
export function createGymReef({ center, floorAt, surfaceY, seed = 6256 }: { center: Vector3; floorAt: (x: number, z: number) => number; surfaceY: number; seed?: number }) {
  const rand = seeded(seed), root = new Group(); root.name = 'Lovers Point rocky reef and kelp forest · library habitat';
  const between = (a: number, b: number) => a + (b - a) * rand();
  // Granite boulders: one instanced batch that also anchors the attached fauna.
  const rockSource = new Group(), rockGeometry = new IcosahedronGeometry(1, 1), v = rockGeometry.getAttribute('position');
  for (let i = 0; i < v.count; i++) { const x = v.getX(i), y = v.getY(i), z = v.getZ(i), d = 1 + .16 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4); v.setXYZ(i, x * d, y * d, z * d); }
  rockGeometry.computeVertexNormals(); mesh(rockSource, 'Reef granite boulder', rockGeometry, mat('#6c665a'));
  const rockProto = finishStaticAsset(rockSource, 'gym-reef-rock', [1, 1, 1], { rim: false }).children[0] as Mesh;
  const rocks: { x: number; z: number; y: number; r: number; h: number }[] = [];
  for (let n = 0; n < 60 && rocks.length < GYM_REEF.rocks; n++) {
    const a = rand() * Math.PI * 2, d = between(1, 8), x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, r = between(.8, 1.7);
    if (rocks.some(o => Math.hypot(o.x - x, o.z - z) < (o.r + r) * .75)) continue;
    rocks.push({ x, z, r, y: floorAt(x, z) - r * .25, h: r * between(.55, .75) });
  }
  const rockBatch = new InstancedMesh(rockProto.geometry, rockProto.material, rocks.length); rockBatch.name = 'gym-reef-rocks';
  const placement = new Object3D();
  rocks.forEach((rock, i) => { placement.position.set(rock.x, rock.y, rock.z); placement.rotation.set(0, rand() * Math.PI * 2, 0); placement.scale.set(rock.r, rock.h, rock.r * between(.8, 1)); placement.updateMatrix(); rockBatch.setMatrixAt(i, placement.matrix); });
  rockBatch.instanceMatrix.needsUpdate = true; rockBatch.computeBoundingBox(); rockBatch.computeBoundingSphere(); root.add(rockBatch); root.updateMatrixWorld(true);
  // Contact points on boulder tops, found by raycasting the real instanced geometry.
  const ray = new Raycaster(), down = new Vector3(0, -1, 0), instance = new Matrix4(), normalMatrix = new Matrix3();
  function onRock(): { anchor: SurfaceAnchor; point: Vector3; normal: Vector3 } | undefined {
    const index = Math.floor(rand() * rocks.length), rock = rocks[index], a = rand() * Math.PI * 2, d = rand() * rock.r * .55;
    ray.set(new Vector3(rock.x + Math.cos(a) * d, rock.y + rock.h + 3, rock.z + Math.sin(a) * d), down);
    const hit = ray.intersectObject(rockBatch, false).find(h => h.instanceId === index);
    if (!hit?.face) return undefined;
    rockBatch.getMatrixAt(index, instance); instance.premultiply(rockBatch.matrixWorld);
    const normal = hit.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(instance)).normalize();
    return normal.y > .35 ? { anchor: surfaceAnchorFromHit(hit), point: hit.point.clone(), normal } : undefined;
  }
  const anchors = (count: number) => { const out: NonNullable<ReturnType<typeof onRock>>[] = []; for (let n = 0; n < count * 8 && out.length < count; n++) { const a = onRock(); if (a) out.push(a); } return out; };
  const stars = createBatStarColony(anchors(GYM_REEF.stars).map(a => a.anchor), { seed: seed + 1 }); root.add(stars.root); stars.update(0);
  const urchins = createUrchinColony(anchors(GYM_REEF.urchins).map(a => a.anchor), seed + 2); root.add(urchins.root); urchins.update(0);
  const bed = (count: number, scale: [number, number]): AnemonePlacement[] => anchors(count).map(a => ({ position: a.point, normal: a.normal, scale: between(...scale), yaw: rand() * Math.PI * 2 }));
  const anemones = [createAnemoneBed('giant-green', bed(GYM_REEF.giantGreen, [.8, 1.3]), seed + 3), createAnemoneBed('aggregating', bed(GYM_REEF.aggregating, [.8, 1.2]), seed + 4)];
  anemones.forEach(a => root.add(a.root));
  // Giant kelp: three seeded plants, each instanced around the reef. Holdfasts on the sand; mature
  // fronds reach just above the display water level and spread a floating canopy that is visible
  // from boats and the shore, as Monterey kelp beds are. Juvenile fronds stay below.
  const kelpHeight = 5.06, kelpPrototypes = [1, 2, 3].map(k => createGiantKelp({ height: kelpHeight, fronds: 2, bladeSpacing: .7, canopy: 2, canopyDensity: 1.5, juvenile: .2, seed: seed + 10 + k }));
  const kelpBatches: InstancedMesh[] = [], sway = uniform(0);
  const kelpSpots: [number, number][] = [];
  for (let n = 0; n < 200 && kelpSpots.length < GYM_REEF.kelp; n++) {
    const a = rand() * Math.PI * 2, d = between(4, 13), x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d;
    if (rocks.some(o => Math.hypot(o.x - x, o.z - z) < o.r + .4) || kelpSpots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.2)) continue;
    kelpSpots.push([x, z]);
  }
  kelpPrototypes.forEach((plant, k) => {
    const source = plant.children[0] as Mesh, spots = kelpSpots.filter((_, i) => i % 3 === k);
    const batch = new InstancedMesh(source.geometry, source.material, Math.max(1, spots.length)); batch.count = spots.length; batch.name = `gym-reef-kelp-${k}`;
    spots.forEach(([x, z], i) => { placement.position.set(x, floorAt(x, z), z); placement.rotation.set(0, rand() * Math.PI * 2, 0); placement.scale.set(1,(surfaceY+.06-floorAt(x,z))/kelpHeight,1); placement.updateMatrix(); batch.setMatrixAt(i, placement.matrix); });
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingBox(); batch.computeBoundingSphere();
    // Shader surge reaches 0.48 m horizontally; include it in CPU frustum bounds once.
    batch.boundingBox!.expandByScalar(.48); batch.boundingSphere!.radius += .48;
    root.add(batch); kelpBatches.push(batch);
  });
  // Swimmers follow closed, gently undulating loops around the reef between seabed and surface.
  const swimmers: Swimmer[] = [], top = surfaceY - .7, bottom = floorAt(center.x, center.z) + .6;
  function loop(radius: number, level: number, wave: number, phase: number, reverse: number) {
    const y = MathUtils.clamp(level, bottom + wave, top - wave), squash = between(.65, .95), turn = rand() * Math.PI;
    const points = Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2 * reverse, px = Math.cos(a) * radius, pz = Math.sin(a) * radius * squash;
      return new Vector3(center.x + px * Math.cos(turn) - pz * Math.sin(turn), y + Math.sin(a * 2 + phase) * wave, center.z + px * Math.sin(turn) + pz * Math.cos(turn));
    });
    const curve = new CatmullRomCurve3(points, true, 'centripetal'); curve.arcLengthDivisions = 256; return curve;
  }
  function addSwimmer(model: Swimmer['model'], curve: CatmullRomCurve3, speed: number, orient = true) {
    const length = curve.getLength(); swimmers.push({ model, curve, length, distance: rand() * length, speed, orient }); root.add(model.root);
  }
  const entries = new Map<string, FishEntry>(fishCollection.map(e => [e.id, e]));
  const habitat: Record<string, { level: number; radius: [number, number]; wave: number }> = {
    'blue-rockfish': { level: bottom + 2.4, radius: [6, 8], wave: .3 },
    'kelp-greenling': { level: bottom + .5, radius: [3, 5], wave: .15 },
    'california-sheephead': { level: bottom + 1, radius: [5, 7], wave: .2 },
    lingcod: { level: bottom + .15, radius: [2.5, 3.5], wave: 0 },
  };
  const fish: { root: Object3D; dispose(): void }[] = [];
  for (const [id, count] of Object.entries(GYM_REEF.fish)) {
    const entry = entries.get(id), place = habitat[id]; if (!entry || !place) continue;
    const speed = entry.swimSpeed?.slow ?? .2, traits = DEMO_SCHOOLS[id];
    const groups = traits ? [createDemoSchool(entry, count, traits)] : Array.from({ length: count }, () => entry.create());
    for (const [i, model] of groups.entries()) {
      if ('setMotionOwner' in model) model.setMotionOwner('path'); model.setSwimMode('slow', true);
      addSwimmer(model, loop(between(...place.radius), place.level + i * .3, place.wave, rand() * 6, i % 2 ? -1 : 1), speed); fish.push(model);
    }
  }
  const sardines = createSardineSchool({ count: GYM_REEF.sardines, capacity: GYM_REEF.sardines }); sardines.setSwimMode('slow', true);
  addSwimmer(sardines, loop(10.5, top - .6, .3, 1, 1), .55); fish.push(sardines);
  const jellies = Array.from({ length: GYM_REEF.jellies }, (_, i) => createMoonJelly({ seed: seed + 40 + i }));
  // Jellies drift on slow, small loops near the surface; their bells stay upright.
  jellies.forEach(j => addSwimmer({ root: j, update: dt => updateMoonJelly(j, dt) }, loop(between(1.5, 3), top - between(0, .8), .2, rand() * 6, 1), .035, false));
  const position = new Vector3(), direction = new Vector3(), ahead = new Vector3(), rotation = new Euler(0, 0, 0, 'YZX');
  function place(s: Swimmer) {
    const u = s.distance / s.length; s.curve.getPointAt(u, position);
    // The measured bottom slopes beneath each route; do not bury bottom dwellers in it.
    position.y=Math.min(top,Math.max(position.y,floorAt(position.x,position.z)+.35));s.model.root.position.copy(position);
    if (!s.orient) return;
    // Same convention as the tank routes: fish heads point along −X in model space.
    s.curve.getTangentAt(u, direction).normalize(); s.curve.getTangentAt((u + .006) % 1, ahead);
    const bank = MathUtils.clamp((direction.z * ahead.x - direction.x * ahead.z) * 1.8, -.12, .12);
    s.model.root.rotation.copy(rotation.set(bank, Math.atan2(direction.z, -direction.x), -Math.asin(MathUtils.clamp(direction.y, -1, 1)), 'YZX'));
  }
  swimmers.forEach(s => { place(s); s.model.update(.016); });
  let active = true, disposed = false;
  /** Plan-view top of the boulders, so divers glide over them instead of through them. */
  function rockTop(x: number, z: number) {
    let height = -Infinity;
    for (const r of rocks) { const d = Math.hypot(x - r.x, z - r.z) / (r.r * .92); if (d < 1) height = Math.max(height, r.y + r.h * Math.sqrt(1 - d * d)); }
    return height;
  }
  /** Surge sway for kelp, added after the viewer styles the batches (it needs their node materials).
   * Displacement grows toward the tips and is horizontal only, so canopies stay on the surface;
   * each plant gets its own phase from its instance index. Vertex shader only; no buffer uploads. */
  function swayKelp() {
    for (const batch of kelpBatches) {
      const material = batch.material as NodeMaterial; if (!(material instanceof NodeMaterial) || material.userData.kelpSway) continue;
      // Three r180 evaluates positionNode after instancing: measure height from the original
      // geometry, so the holdfast stays fixed even when its instance sits below world Y=0.
      const plantY = attribute('position', 'vec3').y;
      const lift = plantY.div(kelpHeight).clamp(0, 1).pow(1.5), phase = sway.mul(.55).add(float(instanceIndex).mul(1.7));
      const along = plantY.mul(.32);
      material.positionNode = positionLocal.add(vec3(sin(phase.add(along)).mul(.38), 0, cos(phase.mul(.8).add(along).add(1.3)).mul(.28)).mul(lift));
      material.userData.kelpSway = true; material.needsUpdate = true;
    }
  }
  return {
    root, center, rocks, swimmers, rockTop, swayKelp,
    get active() { return active; },
    /** Interest management: hide and stop simulating the reef when the player is far away. */
    setViewer(x: number, z: number) { const next = Math.hypot(x - center.x, z - center.z) < GYM_REEF.activeRadius; if (next !== active) { active = next; root.visible = next; } },
    update(dt: number, animate = true) {
      if (disposed || !active || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1); stars.update(dt); urchins.update(dt);
      if (!animate) return;
      sway.value += dt;
      for (const s of swimmers) { s.distance = (s.distance + dt * s.speed) % s.length; place(s); s.model.update(dt); }
    },
    dispose() {
      if (disposed) return; disposed = true;
      fish.forEach(f => f.dispose()); jellies.forEach(j => disposeObject(j)); stars.dispose(); urchins.dispose(); anemones.forEach(a => a.dispose());
      root.traverse(o => { if (o instanceof InstancedMesh) o.dispose(); });
      // The batches replace their prototype toon materials with node materials after styling.
      // Release the material actually rendered; its node-style disposal hook owns the toon source.
      const releaseBatch = (source: Mesh, batch: InstancedMesh) => {
        const rendered = batch.material as Material, original = source.material as Material;
        rendered.dispose(); source.geometry.dispose();
        if (rendered !== original && !(rendered instanceof NodeMaterial && rendered.userData.nodeSource === original)) original.dispose();
      };
      kelpPrototypes.forEach((plant, i) => releaseBatch(plant.children[0] as Mesh, kelpBatches[i]));
      releaseBatch(rockProto, rockBatch); root.removeFromParent();
    },
    stats() { let draws = 0, triangles = 0; root.traverse(o => { if (o instanceof Mesh && o.visible) { draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof InstancedMesh ? o.count : 1); } }); return { draws, triangles }; },
  };
}
