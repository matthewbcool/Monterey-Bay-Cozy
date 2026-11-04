/** Renderer-independent historical evidence, habitat queries and bounded gameplay recipes. No polling. */
import snapshot from './monterey-ecology.json';
import region from '../monterey-bay-region.json';
import { ECOLOGY_REEF, ECOLOGY_SPECIES, ECOLOGY_SPECIES_IDS } from './species';
import type { EcologyCell, EcologyDataset, EcologyFilter, Evidence, HabitatContext, LifeStage, SpeciesId } from './types';
export * from './types';
export * from './species';
export const ECOLOGY_DATA = snapshot as EcologyDataset;
const METRES = 6371008.8 * Math.PI / 180;
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function habitatAt(longitude: number, latitude: number): HabitatContext {
  const [west, south, east, north] = region.bounds;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < west || longitude > east || latitude < south || latitude > north) return { isWater: false, bottomDepthMeters: null, habitat: 'unknown', basis: 'Outside regional geography' };
  const x = (longitude - region.origin[0]) * METRES * Math.cos(region.origin[1] * Math.PI / 180), z = -(latitude - region.origin[1]) * METRES;
  const isWater = region.water.some(p => inRing(x, z, p[0]) && !p.slice(1).some(r => inRing(x, z, r)));
  if (!isWater) return { isWater: false, bottomDepthMeters: null, habitat: 'unknown', basis: 'Regional coastline mask: land' };
  const g = region.bathy, u = Math.max(0, Math.min(g.columns - 1.000001, (longitude - g.west) / g.stepLon)), v = Math.max(0, Math.min(g.rows - 1.000001, (g.north - latitude) / g.stepLat));
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, n = g.columns;
  const height = g.values[j * n + i] * (1 - a) * (1 - b) + g.values[j * n + i + 1] * a * (1 - b) + g.values[(j + 1) * n + i] * (1 - a) * b + g.values[(j + 1) * n + i + 1] * a * b;
  const reefDistance = Math.hypot((longitude - ECOLOGY_REEF.longitude) * METRES * Math.cos(latitude * Math.PI / 180), (latitude - ECOLOGY_REEF.latitude) * METRES);
  return { isWater, bottomDepthMeters: height < 0 ? -height : null, habitat: reefDistance <= ECOLOGY_REEF.radiusMeters ? 'kelp-reef' : 'unknown', basis: reefDistance <= ECOLOGY_REEF.radiusMeters ? ECOLOGY_REEF.basis + '; coarse NOAA ETOPO1 depth' : 'Regional coastline and coarse NOAA ETOPO1 depth; substrate/kelp unknown' };
}
export function validateEcologyData(data: EcologyDataset) {
  const [west, south, east, north] = data.bounds;
  if (data.schemaVersion !== 1 || data.bounds.length !== 4 || !data.bounds.every(Number.isFinite) || west >= east || south >= north || !Number.isFinite(data.cellSizeMeters) || data.cellSizeMeters <= 0) throw Error('Invalid ecology schema/grid');
  const ids = new Set<string>();
  for (const h of data.hauls) {
    if (ids.has(h.id) || !Number.isFinite(Date.parse(h.time)) || !Number.isFinite(h.longitude) || !Number.isFinite(h.latitude) || h.longitude < west || h.longitude > east || h.latitude < south || h.latitude > north || h.time < data.window.start || h.time > data.window.end) throw Error('Invalid/duplicate ecology haul');
    ids.add(h.id);
  }
  const observations = new Set<string>();
  for (const r of data.observations) {
    const key = `${r.haul}:${r.speciesId}:${r.lifeStage}`;
    if (!Number.isInteger(r.haul) || !data.hauls[r.haul] || !ECOLOGY_SPECIES_IDS.includes(r.speciesId) || !['Y', 'A', 'U'].includes(r.lifeStage) || !Number.isSafeInteger(r.count) || r.count < 0 || observations.has(key)) throw Error('Invalid/duplicate ecology observation');
    observations.add(key);
  }
}
function validateFilter(f: EcologyFilter) {
  if (!ECOLOGY_SPECIES_IDS.includes(f.speciesId) || (f.lifeStage !== undefined && !['Y', 'A', 'U', 'all'].includes(f.lifeStage)) || (f.month !== undefined && (!Number.isInteger(f.month) || f.month < 1 || f.month > 12)) || (f.year !== undefined && (!Number.isInteger(f.year) || f.year < 1900 || f.year > 9999))) throw Error('Invalid ecology filter');
}
export function createEcologyService(data: EcologyDataset = ECOLOGY_DATA) {
  validateEcologyData(data);
  const [west, south, east, north] = data.bounds, cos = Math.cos((south + north) * Math.PI / 360), dx = data.cellSizeMeters / (METRES * cos), dy = data.cellSizeMeters / METRES;
  const columns = Math.ceil((east - west) / dx), rows = Math.ceil((north - south) / dy);
  const cells: EcologyCell[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const bounds: EcologyCell['bounds'] = [west + column * dx, Math.max(south, north - (row + 1) * dy), Math.min(east, west + (column + 1) * dx), north - row * dy];
    cells.push({ id: `${column}:${row}`, column, row, bounds, longitude: (bounds[0] + bounds[2]) / 2, latitude: (bounds[1] + bounds[3]) / 2 });
  }
  function cellAt(lon: number, lat: number) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < west || lon > east || lat < south || lat > north) return null;
    const column = Math.min(columns - 1, Math.floor((lon - west) / dx)), row = Math.min(rows - 1, Math.floor((north - lat) / dy));
    return cells[row * columns + column];
  }
  const haulCells = new Map<string, number[]>(), records = new Map<number, typeof data.observations>();
  data.hauls.forEach((h, i) => { const id = cellAt(h.longitude, h.latitude)!.id; const a = haulCells.get(id) ?? []; a.push(i); haulCells.set(id, a); });
  for (const r of data.observations) { const a = records.get(r.haul) ?? []; a.push(r); records.set(r.haul, a); }
  function query(longitude: number, latitude: number, filter: EcologyFilter): Evidence {
    validateFilter(filter);
    const cell = cellAt(longitude, latitude), relevant: number[] = [];
    for (const i of cell ? haulCells.get(cell.id) ?? [] : []) {
      const time = data.hauls[i].time;
      if ((filter.year === undefined || Number(time.slice(0, 4)) === filter.year) && (filter.month === undefined || Number(time.slice(5, 7)) === filter.month)) relevant.push(i);
    }
    const stage = filter.lifeStage ?? 'all', observed = relevant.flatMap(i => (records.get(i) ?? []).filter(r => r.speciesId === filter.speciesId && (stage === 'all' || r.lifeStage === stage)));
    const targetHauls = new Set(observed.map(r => r.haul)), positiveHauls = new Set(observed.filter(r => r.count > 0).map(r => r.haul));
    return { cell, status: !cell ? 'outside-coverage' : !relevant.length ? 'no-survey' : !observed.length ? 'not-recorded' : positiveHauls.size ? 'detected' : 'not-detected', representedHauls: relevant.length, speciesHauls: targetHauls.size, detectedHauls: positiveHauls.size, explicitZeroRows: observed.filter(r => r.count === 0).length, catchCount: observed.reduce((n, r) => n + r.count, 0), years: [...new Set(observed.map(r => Number(data.hauls[r.haul].time.slice(0, 4))))].sort(), stages: [...new Set(observed.map(r => r.lifeStage))].sort() as LifeStage[], lastSample: observed.length ? observed.map(r => data.hauls[r.haul].time).sort().at(-1)! : null, detectionFraction: targetHauls.size ? positiveHauls.size / targetHauls.size : null, relativeAbundance: null, populationEstimate: null };
  }
  return { data, cells, cellAt, query, grid: { columns, rows, cellSizeMeters: data.cellSizeMeters }, summarize: (filter: EcologyFilter) => cells.map(c => query(c.longitude, c.latitude, filter)) };
}
export type EcologyService = ReturnType<typeof createEcologyService>;
export function habitatSuitability(speciesId: SpeciesId, context: HabitatContext) {
  const species = ECOLOGY_SPECIES[speciesId];
  if (!context.isWater || context.bottomDepthMeters === null || !Number.isFinite(context.bottomDepthMeters) || context.bottomDepthMeters < 1.5) return 0;
  if (species.maxBottomDepthMeters !== null && context.bottomDepthMeters > species.maxBottomDepthMeters) return 0;
  if (speciesId === 'pacific-sardine') return .65; // Water-column suitability, not a probability or abundance.
  return species.preferred.includes(context.habitat) ? .8 : 0;
}
export interface PopulationOptions {
  longitude: number; latitude: number; seed: number; lifeStage?: LifeStage;
  year?: number; month?: number; radiusMeters?: number; maxIndividuals?: number; maxGroups?: number;
  allowHabitatInference?: boolean;
  /** Prefer the game's detailed seabed/substrate sampler to coarse regional ETOPO1 near shore. */
  contextAt?: (longitude: number, latitude: number) => HabitatContext;
}
export interface PopulationGroup { id: string; speciesId: SpeciesId; lifeStage: LifeStage; assetId: SpeciesId | null; count: number; longitude: number; latitude: number; depthMeters: number; habitat: HabitatContext; basis: 'historical-detection-and-habitat' | 'inferred-habitat'; surveyStatus: Evidence['status'] }
function rng(seed: number) { let s = seed >>> 0; return () => { let t = s += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Plans bounded game representatives. Counts and positions are authored; nothing is rendered or allocated per frame. */
export function planPopulation(service: EcologyService, options: PopulationOptions) {
  if (!Number.isSafeInteger(options.seed)) throw Error('Population seed must be an integer');
  const finite = (n: number | undefined, fallback: number, max: number) => { if (n !== undefined && (!Number.isFinite(n) || n < 0)) throw Error('Invalid population budget/radius'); return Math.min(max, n ?? fallback); };
  const limit = Math.floor(finite(options.maxIndividuals, 64, 256)), maxGroups = Math.floor(finite(options.maxGroups, 6, 32)), radius = finite(options.radiusMeters, 15, 100);
  const stage = options.lifeStage ?? 'A';
  if (stage !== 'A') throw Error('Population recipes currently require older/post-settlement habitat rules and assets; juvenile/unknown stages are evidence-only');
  validateFilter({ speciesId: 'blue-rockfish', lifeStage: stage, year: options.year, month: options.month });
  const random = rng(options.seed), groups: PopulationGroup[] = [], contextAt = options.contextAt ?? habitatAt;
  let remaining = limit;
  for (let attempt = 0; attempt < 96 && groups.length < maxGroups && remaining > 0; attempt++) {
    const speciesId = ECOLOGY_SPECIES_IDS[attempt % ECOLOGY_SPECIES_IDS.length], species = ECOLOGY_SPECIES[speciesId];
    const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
    const longitude = options.longitude + Math.cos(angle) * distance / (METRES * Math.cos(options.latitude * Math.PI / 180)), latitude = options.latitude + Math.sin(angle) * distance / METRES;
    const evidence = service.query(longitude, latitude, { speciesId, lifeStage: stage, year: options.year, month: options.month });
    if (!evidence.cell || !habitatAt(longitude, latitude).isWater) continue;
    const context = contextAt(longitude, latitude), score = habitatSuitability(speciesId, context);
    if (!score || (evidence.status !== 'detected' && !options.allowHabitatInference) || random() > score) continue;
    const count = Math.min(remaining, Math.floor(species.groupSize[0] + random() * (species.groupSize[1] - species.groupSize[0] + 1)));
    const band = species.swimBand[0] + random() * (species.swimBand[1] - species.swimBand[0]);
    groups.push({ id: `${options.seed}:${groups.length}`, speciesId, lifeStage: stage, assetId: stage === 'A' ? speciesId : null, count, longitude, latitude, depthMeters: Math.max(.6, Math.min(context.bottomDepthMeters! - .5, species.maxSwimDepthMeters) * band), habitat: { ...context }, basis: evidence.status === 'detected' ? 'historical-detection-and-habitat' : 'inferred-habitat', surveyStatus: evidence.status });
    remaining -= count;
  }
  return { schemaVersion: 1 as const, kind: 'monterey-bay-cozy-ecology-recipe' as const, seed: options.seed, sourceId: service.data.source.id, sourceHash: service.data.source.files.catches.sha256, sourceWindow: service.data.window, center: [options.longitude, options.latitude], radiusMeters: radius, lifeStage: stage, year: options.year ?? null, month: options.month ?? null, allowHabitatInference: options.allowHabitatInference ?? false, maxIndividuals: limit, maxGroups, individualCount: limit - remaining, countsAre: 'authored-game-representatives' as const, groups };
}
