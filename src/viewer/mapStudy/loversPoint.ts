import { GROUND_KIND, pathStyle } from '../testingGym/pathStyle';
import { PARK_TREES } from '../testingGym/placement';
import { composeGroundSurface } from '../testingGym/groundSurface';
import { Box3, BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import map from '../../data/lovers-point-gym.json';
import features from '../../data/lovers-point-features.json';
import elevation from '../../data/lovers-point-elevation.json';
import { disposeObject, mat, mesh } from '../../models/props/primitives';
import { finishStaticAsset } from '../../models/shared/staticAsset';
import { insidePolygon, type GymCollider, type GymPoint } from '../avatarController';
import { addBeachAccess } from '../testingGym/access';
import { addParkBuildings } from '../testingGym/buildings';
import { drapeGeometry, groundHeight, terrainSkirt } from '../testingGym/elevation';
import { points2D, ribbon, surface } from '../testingGym/geometry';
import { addParkLandmarks } from '../testingGym/landmarks';
import { createParkNature } from '../testingGym/nature';
import { addShoreEdges } from '../testingGym/shore';
import { finishSpatialBatches } from '../testingGym/spatialBatches';
import { withinPolygon } from './clip';
import { addParkStatues } from '../testingGym/statues';

type GeoPoint = readonly [longitude: number, latitude: number];
const RADIANS = Math.PI / 180, EARTH_RADIUS = 6371008.8;
const PARK_ORIGIN = map.origin as [number, number];
const LAND: GymPoint[] = [...points2D(map.coast), [-145, -135], [-145, 130], [72, 130]];
let landSamples: GymPoint[] | undefined;

/** These OSM footprints are supplied by the detailed park instead of map massing. */
export const replacedBuildingIds = new Set(map.buildings.map(building => building.id));

/** Same local equirectangular projection as Map Study, without importing its UI.
 * Cached park X uses its own latitude; apply the exact cosine ratio before translation. */
function frame(origin: GeoPoint) {
  return {
    eastScale: Math.cos(origin[1] * RADIANS) / Math.cos(PARK_ORIGIN[1] * RADIANS),
    x: (PARK_ORIGIN[0] - origin[0]) * RADIANS * EARTH_RADIUS * Math.cos(origin[1] * RADIANS),
    z: -(PARK_ORIGIN[1] - origin[1]) * RADIANS * EARTH_RADIUS,
  };
}

export function projectLoversPointPoint(point: readonly [number, number], origin: GeoPoint): GymPoint {
  const transform = frame(origin);
  return [point[0] * transform.eastScale + transform.x, point[1] + transform.z];
}

/** Regional X/Z crop, open ring with positive signed X/Z area (counterclockwise
 * in the mathematical X/Z plane). Use this same boundary to clip base-map lines.
 * This is a display crop, not the mapped park ownership or land boundary. */
export function loversPointFootprint(origin: GeoPoint): GymPoint[] {
  const [west, north, east, south] = features.crop;
  return ([[west, north], [east, north], [east, south], [west, south]] as GymPoint[])
    .map(point => projectLoversPointPoint(point, origin));
}

function localPoint([longitude, latitude]: GeoPoint): GymPoint {
  return [(longitude - PARK_ORIGIN[0]) * RADIANS * EARTH_RADIUS * Math.cos(PARK_ORIGIN[1] * RADIANS),
    -(latitude - PARK_ORIGIN[1]) * RADIANS * EARTH_RADIUS];
}

function terrainVertices(points: readonly GymPoint[]): GymPoint[] {
  const geometry = drapeGeometry(surface(points)), vertices = geometry.attributes.position;
  const samples = Array.from({ length: vertices.count }, (_, i) => [vertices.getX(i), vertices.getZ(i)] as GymPoint);
  geometry.dispose(); return samples;
}

function onBoundary([x, z]: GymPoint, ring: readonly GymPoint[]) {
  return ring.some((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    return length > 0 && Math.abs((x - a[0]) * dz - (z - a[1]) * dx) / length < 1e-5
      && x >= Math.min(a[0], b[0]) - 1e-5 && x <= Math.max(a[0], b[0]) + 1e-5
      && z >= Math.min(a[1], b[1]) - 1e-5 && z <= Math.max(a[1], b[1]) + 1e-5;
  });
}

/** Foundation offset for regional buildings touching the detailed land. Input
 * rings are geographic [longitude,latitude], outer first with optional holes.
 * No offset is applied to building height itself. A caller can translate its
 * normal h-metre mass and fill 0..offset with a separately styled foundation.
 *
 * A plane reaches its maximum at an intersection vertex: collect DEM cuts on
 * both footprints plus their boundary crossings. This catches thin edge strips,
 * concave coast inlets and fully enclosed terrain peaks, not just centroids. */
export function resolveParkBuildingElevation(rings: readonly (readonly GeoPoint[])[]): number | null {
  if (!rings[0] || rings[0].length < 3) return null;
  const local = rings.map(ring => ring.map(localPoint)), outer = local[0];
  const xs = outer.map(p => p[0]), zs = outer.map(p => p[1]);
  if (Math.max(...xs) < -145 || Math.min(...xs) > 150 || Math.max(...zs) < -160 || Math.min(...zs) > 130) return null;
  const inBuilding = (point: GymPoint) => withinPolygon(point, outer)
    && !local.slice(1).some(hole => withinPolygon(point, hole) && !onBoundary(point, hole));
  let highest: number | null = null;
  const consider = (point: GymPoint) => {
    if (!withinPolygon(point, LAND) || !inBuilding(point)) return;
    const height = groundHeight(...point);
    highest = highest === null ? height : Math.max(highest, height);
  };
  landSamples ??= terrainVertices(LAND);
  landSamples.forEach(consider);
  local.forEach(ring => { terrainVertices(ring).forEach(consider); ring.forEach(consider); });
  LAND.forEach(consider);
  for (const ring of local) for (let i = 0; i < ring.length; i++) for (let j = 0; j < LAND.length; j++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], c = LAND[j], d = LAND[(j + 1) % LAND.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], ex = d[0] - c[0], ez = d[1] - c[1];
    const denominator = dx * ez - dz * ex;
    if (Math.abs(denominator) < 1e-10) continue;
    const cx = c[0] - a[0], cz = c[1] - a[1], t = (cx * ez - cz * ex) / denominator, u = (cx * dz - cz * dx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) consider([a[0] + dx * t, a[1] + dz * t]);
  }
  return highest;
}

export const LOVERS_POINT_GEOGRAPHY = {
  origin: PARK_ORIGIN,
  units: 'metres',
  source: '© OpenStreetMap contributors · ODbL',
  sourceUrl: features.attributionUrl,
  mapDate: features.downloaded,
  elevationSource: elevation.source,
  elevationUrl: elevation.sourceUrl,
  elevationDate: elevation.downloaded,
  verticalDatum: elevation.verticalDatum,
  photoSource: features.references[0].url,
  seed: 6256,
  limits: 'Cached OSM footprints and USGS DEM terrain; not live geography. Widths, planting, walls, access tread profiles and building heights are stylized estimates. No bathymetry or live water-level claim.',
} as const;

/** Shared park component factories, with the same map/elevation and seeded
 * scenery as the Testing Gym. This scene has no gym equipment, avatar, water,
 * interaction controller, renderer or animation loop. The caller owns lighting,
 * applyNodeStyle(), LOD registration and demand rendering. */
export function createLoversPointArea(origin: GeoPoint) {
  const root = new Group(); root.name = 'Lovers Point · detailed map area';
  const terrain = new Group(), overlays = new Group(), scenery = new Group(), buildings = new Group();
  // Existing component factories publish collision proxies for their gym owner;
  // the static map presentation does not attach a second simulation to them.
  const colliders: GymCollider[] = [];
  const coast = points2D(map.coast);
  const land = LAND;
  const stone = mat('#8b8d7e'), warmStone = mat('#b1ad94'), lawn = mat('#8ba46b');
  const sand = mat('#dcccae'), asphalt = mat('#7f8780');
  mesh(terrain, 'Terrain coast skirt · DEM top / authored submerged base', terrainSkirt(land), stone);
  mesh(terrain, 'Mapped land silhouette', surface(land), lawn);
  mesh(terrain, 'Photo-inspired exposed granite at the point', surface([...coast.slice(25, 74), [62, -109], [74, -98], [91, -88]], .009), warmStone);
  for (const feature of features.polygons) {
    const outline = feature.rings.find(ring => ring.role === 'outer');
    if (!outline || !['beach', 'parking', 'breakwater'].includes(feature.kind)) continue;
    mesh(overlays, `Mapped ${feature.kind} · ${feature.id}`, surface(points2D(outline.points), feature.kind === 'beach' ? .014 : .018), feature.kind === 'beach' ? sand : feature.kind === 'parking' ? asphalt : warmStone);
  }
  for(const route of features.paths){
    const style=pathStyle(route);
    const pathMesh=mesh(overlays,`Mapped ${route.highway} · ${route.id} / ${style.widthBasis} / ${style.surfaceBasis}`,ribbon(points2D(route.points),style.width,style.pedestrian?.029:.019),mat(style.color));
    pathMesh.userData.groundKind=style.kind;
  }

  let seed: number = LOVERS_POINT_GEOGRAPHY.seed;
  const random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const nature = createParkNature(random, groundHeight);
  for (let i = 20; i < coast.length - 5; i += 2) {
    const a = coast[i], b = coast[i + 1], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const size = 2.2 + random() * 2.4; nature.rock(x, z, size);
    nature.rock(x + (random() - .5) * 8, z + (random() - .5) * 8, size * .65);
  }
  for (const [x, z, size] of [[126, -133, 5], [121, -124, 4.7], [112, -120, 3.6], [94, -108, 3.1]]) nature.rock(x, z, size);
  const grassPatch = mat('#879f64'), grassShade = mat('#889f68');
  for (let i = 0; i < 42; i++) {
    const x = -14 + random() * 112, z = -114 + random() * 210;
    if (!insidePolygon(x, z, land)) continue;
    const rx = 2 + random() * 7, rz = 1.5 + random() * 3;
    const patch: GymPoint[] = Array.from({ length: 9 }, (_, j) => [x + Math.cos(j / 9 * Math.PI * 2) * rx, z + Math.sin(j / 9 * Math.PI * 2) * rz]);
    if (patch.every(([px, pz]) => insidePolygon(px, pz, land))) mesh(terrain, 'Broad painted lawn variation', surface(patch, .004), i % 2 ? grassPatch : grassShade);
  }
  for (const tree of PARK_TREES) nature.tree(tree);
  const {poolGate}=addParkLandmarks(scenery, overlays, colliders);
  // The map displays the closed gate as a static geographic component.
  poolGate.root.updateMatrixWorld(true);
  poolGate.root.traverse(o=>{if(o instanceof Mesh)o.geometry.applyMatrix4(o.matrixWorld);});
  poolGate.root.position.set(0,0,0);poolGate.root.rotation.set(0,0,0);root.add(poolGate.root);
  addShoreEdges(scenery, colliders);
  addBeachAccess(scenery,colliders);
  addParkBuildings(buildings, colliders, groundHeight);
  for (const child of scenery.children) {
    if (!(child instanceof Mesh) || child.userData.elevationPlaced) continue;
    child.geometry.computeBoundingBox(); child.updateMatrix();
    const center = child.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(child.matrix);
    child.position.y += groundHeight(center.x, center.z);
  }
  for(const group of [terrain,overlays])for(const part of group.children){
    if(part.userData.groundKind!==undefined)continue;
    part.userData.groundKind=/lawn|land silhouette|cypress ground shade/.test(part.name)?GROUND_KIND.grass:/beach|exercise path/.test(part.name)?GROUND_KIND.sand:/parking/.test(part.name)?GROUND_KIND.asphalt:/granite|breakwater/.test(part.name)?GROUND_KIND.stone:GROUND_KIND.plain;
  }
  const ground = composeGroundSurface(terrain, overlays, 'map-lovers-point-ground-surface');
  // Buildings and static scenery share the same matte response and spatial cells.
  scenery.add(...buildings.children);
  root.add(nature.finish(), ground, finishStaticAsset(terrain, 'map-lovers-point-terrain-skirt', [1,1,1], {rim:false}),
    finishSpatialBatches(scenery, 'map-lovers-point-scenery', 128));
  // Reproject once at construction, never per-frame. Static batches are already
  // in park coordinates; shared instance prototypes stay untouched and their
  // matrices absorb S*M. Translation stays on an unscaled root to avoid losing
  // local vertex precision. Each factory call owns its own geometry/materials.
  const transform = frame(origin), scale = new Matrix4().makeScale(transform.eastScale, 1, 1);
  const instance = new Matrix4(), transformed = new Set<BufferGeometry>();
  root.traverse(object => {
    if (object instanceof InstancedMesh) {
      for (let i = 0; i < object.count; i++) { object.getMatrixAt(i, instance); object.setMatrixAt(i, instance.premultiply(scale)); }
      object.instanceMatrix.needsUpdate = true; object.computeBoundingBox(); object.computeBoundingSphere();
    } else if (object instanceof Mesh && !transformed.has(object.geometry)) {
      object.geometry.applyMatrix4(scale); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere(); transformed.add(object.geometry);
    }
  });
  const statues = addParkStatues(root, colliders, transform.eastScale);
  root.position.set(transform.x, 0, transform.z);
  root.userData = { assetId: 'lovers-point-map-area', units: 'metres', geography: LOVERS_POINT_GEOGRAPHY };
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root), center = bounds.getCenter(new Vector3());
  let disposed = false;
  return {
    root, bounds, center, statues, footprint: loversPointFootprint(origin), geography: LOVERS_POINT_GEOGRAPHY,
    dispose() {
      if (disposed) return; disposed = true;
      root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
      disposeObject(root);
    },
  };
}
