import { drapeGeometry } from './elevation';
import { RECREATION_TERRACE } from './recreationGrade';
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Vector3, type Material } from 'three';
import map from '../../data/lovers-point-gym.json';
import { box, mat, mesh } from '../../models/props/primitives';
import { insidePolygon, type GymCollider, type GymPoint } from '../avatarController';
import { points2D, polygon, surface } from './geometry';

/** Closed, collision-solid building masses: the roof covers the wall cap and
 * terrain covers the foundation bottom. Avoid rendering those buried surfaces. */
function shell(points:readonly GymPoint[],height:number) {
  const solid=new ExtrudeGeometry(polygon(points),{depth:height,bevelEnabled:false,steps:1,curveSegments:1});
  const sides=solid.groups.find(group=>group.materialIndex===1)!;
  const geometry=new BufferGeometry();
  for(const [name,a] of Object.entries(solid.attributes))geometry.setAttribute(name,new Float32BufferAttribute(a.array.slice(sides.start*a.itemSize,(sides.start+sides.count)*a.itemSize),a.itemSize));
  solid.dispose();geometry.rotateX(-Math.PI/2);return geometry;
}

interface Facade { a: GymPoint; b: GymPoint; length: number; tangent: GymPoint; normal: GymPoint }
type Point3 = readonly [number, number, number];

function facades(points: readonly GymPoint[]): Facade[] {
  const area = points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const sign = Math.sign(area) || 1;
    return { a, b, length, tangent: [dx / length, dz / length], normal: [dz / length * sign, -dx / length * sign] };
  });
}

function onWall(edge: Facade, fraction: number, height: number, offset = 0): Point3 {
  return [edge.a[0] + (edge.b[0] - edge.a[0]) * fraction + edge.normal[0] * offset, height, edge.a[1] + (edge.b[1] - edge.a[1]) * fraction + edge.normal[1] * offset];
}

/** A single painted patch, with explicit face orientation instead of double-sided
 * materials. Color and silhouette carry the detail; no glass or PBR reflections. */
function panel(parent: Group, name: string, vertices: readonly Point3[], outward: Point3, material: Material) {
  const indices: number[] = [];
  const a = new Vector3(...vertices[0]), normal = new Vector3(...outward);
  for (let i = 1; i < vertices.length - 1; i++) {
    const ab = new Vector3(...vertices[i]).sub(a), ac = new Vector3(...vertices[i + 1]).sub(a), cross = ab.cross(ac);
    if (cross.lengthSq() < 1e-10) continue;
    const flip = cross.dot(normal) < 0;
    indices.push(0, flip ? i + 1 : i, flip ? i : i + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices.flat(), 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return mesh(parent, name, geometry, material);
}

function windowBand(parent: Group, edge: Facade, start: number, end: number, bottom: number, top: number, offset: number, material: Material, name: string) {
  return panel(parent, name, [onWall(edge, start, bottom, offset), onWall(edge, end, bottom, offset), onWall(edge, end, top, offset), onWall(edge, start, top, offset)], [edge.normal[0], 0, edge.normal[1]], material);
}

/** Clip one roof slope to the original mapped boundary. The height function is
 * planar on each side of the ridge, so four-sided footprints need only four roof
 * triangles and irregular buildings keep their mapped outline. */
function roofHalf(points: readonly GymPoint[], axis: GymPoint, middle: number, side: number): GymPoint[] {
  const result: GymPoint[] = [], distance = (p: GymPoint) => (p[0] * axis[0] + p[1] * axis[1] - middle) * side;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = distance(a), db = distance(b);
    if (da >= -1e-8) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

function pitchedRoof(parent: Group, name: string, points: readonly GymPoint[], edges: Facade[], height: number, rise: number, roof: Material, wall: Material) {
  const longest = [...edges].sort((a, b) => b.length - a.length)[0], axis: GymPoint = [-longest.tangent[1], longest.tangent[0]];
  const projections = points.map(p => p[0] * axis[0] + p[1] * axis[1]), low = Math.min(...projections), high = Math.max(...projections), middle = (low + high) / 2, half = (high - low) / 2;
  const top = (p: GymPoint) => height + rise * Math.max(0, 1 - Math.abs(p[0] * axis[0] + p[1] * axis[1] - middle) / half);
  for (const side of [-1, 1]) {
    const clipped = roofHalf(points, axis, middle, side);
    if (clipped.length < 3) continue;
    const geometry = surface(clipped, height), position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, top([position.getX(i), position.getZ(i)]));
    // A concave map footprint can cross the ridge several times. Discard any
    // triangulator bridge outside that footprint instead of filling its courtyards.
    const source = geometry.index!, indices: number[] = [];
    for (let i = 0; i < source.count; i += 3) {
      const a = source.getX(i), b = source.getX(i + 1), c = source.getX(i + 2);
      if (insidePolygon((position.getX(a) + position.getX(b) + position.getX(c)) / 3, (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3, points)) indices.push(a, b, c);
    }
    geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(parent, `${name} · approximate pitched roof / mapped outline`, geometry, roof);
  }
  for (const edge of edges) {
    const da = edge.a[0] * axis[0] + edge.a[1] * axis[1] - middle, db = edge.b[0] * axis[0] + edge.b[1] * axis[1] - middle;
    const fractions = [0, ...(da * db < -1e-8 ? [da / (da - db)] : []), 1];
    for (let i = 1; i < fractions.length; i++) {
      const a = onWall(edge, fractions[i - 1], height), b = onWall(edge, fractions[i], height);
      const ha = top([a[0], a[2]]), hb = top([b[0], b[2]]);
      if (ha - height < .001 && hb - height < .001) continue;
      panel(parent, `${name} · roof-end infill`, [a, b, [b[0], hb, b[2]], [a[0], ha, a[2]]], [edge.normal[0], 0, edge.normal[1]], wall);
    }
  }
}

function gable(parent: Group, edge: Facade, width: number, height: number, rise: number, wall: Material, roof: Material, cream: Material) {
  const half = width / edge.length / 2;
  const left = onWall(edge, .5 - half, height, .04), right = onWall(edge, .5 + half, height, .04), peak = onWall(edge, .5, height + rise, .04);
  const backLeft = onWall(edge, .5 - half, height, -3.4), backRight = onWall(edge, .5 + half, height, -3.4), backPeak = onWall(edge, .5, height + rise, -3.4);
  panel(parent, 'Beach House · photo-inspired front gable', [left, right, peak], [edge.normal[0], 0, edge.normal[1]], wall);
  panel(parent, 'Beach House · simple gable roof', [left, peak, backPeak, backLeft], [0, 1, 0], roof);
  panel(parent, 'Beach House · simple gable roof', [peak, right, backRight, backPeak], [0, 1, 0], roof);
  for (const [a, b] of [[left, peak], [peak, right], [left, right]]) {
    const start = new Vector3(...a), end = new Vector3(...b), delta = end.clone().sub(start), middle = start.clone().add(end).multiplyScalar(.5);
    const trim = box(parent, 'Beach House · cream gable trim', [.095, delta.length(), .095], cream, [middle.x + edge.normal[0] * .04, middle.y, middle.z + edge.normal[1] * .04]);
    trim.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  }
  windowBand(parent, edge, .5 - .50 / edge.length, .5 + .50 / edge.length, height + .26, height + .85, .10, cream, 'Beach House · gable window frame');
  windowBand(parent, edge, .5 - .37 / edge.length, .5 + .37 / edge.length, height + .34, height + .73, .12, roof, 'Beach House · gable window patch');
}

/** Mapped footprints and existing collision bounds; all roof heights, palette,
 * windows and awnings are stylized photo interpretation rather than survey data.
 * Caller batches these authoring materials into the shared matte toon pass. */
export function addParkBuildings(parent: Group, colliders: GymCollider[], groundHeight: (x:number,z:number)=>number = () => 0) {
  // City photos (2025 facilities assessment p13/p53): steep charcoal roof, crisp white trim and
  // saturated yellow awnings on the Beach House. Hex values are photo estimates.
  const sage = mat('#9ba5a0'), cream = mat('#f3f1e8'), navy = mat('#30545b'), charcoal = mat('#3d4246'), ochre = mat('#f0b428');
  // Other mapped buildings: Pacific Grove's pastel walls and dark or terracotta roofs, chosen per OSM id.
  const walls = ['#e6d08a', '#eeece4', '#a9c1cb', '#c9b9a6', '#9aa596'].map(c => mat(c)), roofs = [mat('#4a4d52'), mat('#9a5a45')];
  const pick = (id: string) => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; };
  for (const building of map.buildings) {
    const grill=building.id==='way/224525166',hut=building.id==='way/931232626';
    const lodge=building.id==='way/558778075';
    const points = points2D(building.points), height = lodge?8.4:grill?2.45:hut?2.3:building.height, edges = facades(points), beachHouse = building.id === 'way/224525165';
    // Sample every DEM plane under the footprint, including interior highs.
    // The old bath house has a lower waterfront floor opening onto the pool
    // terrace (city facilities photos p53); its rear is embedded in the hillside.
    // Other buildings retain their level, fully supported plinths.
    const sampled=drapeGeometry(surface(points)),p=sampled.attributes.position;
    const heights=Array.from({length:p.count},(_,i)=>groundHeight(p.getX(i),p.getZ(i)));sampled.dispose();
    const terrainMax=Math.max(...heights),base=(beachHouse?RECREATION_TERRACE.height:terrainMax)+.06,bottom=Math.min(...heights,base)-.15;
    const buildings = new Group(); buildings.position.y=base; parent.add(buildings);
    buildings.userData.foundation={sourceId:building.id,base,bottom,terrainMax,wallHeight:height};
    const foundation=shell(points,base-bottom);
    foundation.translate(0,bottom-base,0);
    mesh(buildings,`${building.name} · terrain foundation / mapped footprint`,foundation,mat('#898c7c'));
    const h = pick(building.id), wall = beachHouse ? sage : lodge ? mat('#828d89') : grill||hut ? cream : walls[h % walls.length], roof = lodge ? charcoal : grill ? navy : hut ? cream : roofs[(h >>> 3) % roofs.length];
    const geometry = shell(points,height);
    mesh(buildings, `${building.name} · mapped footprint / estimated height`, geometry, wall);
    const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
    colliders.push({ kind: 'box', footprint: points, top: base+height+(beachHouse?5.5:grill?.35:hut?.12:.85), minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
    pitchedRoof(buildings, building.name, points, edges, height, beachHouse ? 5.5 : grill ? .35 : hut ? .12 : .85, beachHouse ? charcoal : roof, wall);
    if(hut){
      const red=mat('#b94d35');
      for(const edge of edges){windowBand(buildings,edge,0,1,height-.06,height+.15,.06,red,'Pier utility hut · red parapet cap');windowBand(buildings,edge,.34,.66,.55,1.65,.04,mat('#d9d6c3'),'Pier utility hut · cream shutter');}
      continue;
    }
    if(lodge){
      // Three storeys, repeated white balcony bays and gray wall planes (photo 6).
      for(const edge of edges.filter(e=>e.length>15&&e.normal[0]>0)){
        const bays=Math.max(3,Math.round(edge.length/4.4));
        for(let floor=0;floor<3;floor++)for(let j=0;j<bays;j++){
          const a=(j+.12)/bays,b=(j+.88)/bays,y=.4+floor*2.7;
          windowBand(buildings,edge,a,b,y,y+2.1,.04,cream,'Lodge · white door surround');
          windowBand(buildings,edge,a+.05/bays,b-.05/bays,y+.1,y+2,.06,navy,'Lodge · recessed glazing');
          if(floor>0){
            windowBand(buildings,edge,a,b,y,y+.13,.72,cream,'Lodge · balcony slab edge');
            windowBand(buildings,edge,a,b,y+.82,y+.89,.72,cream,'Lodge · balcony top rail');
            for(let k=0;k<=8;k++){const t=a+(b-a)*k/8;windowBand(buildings,edge,t-.018/edge.length,t+.018/edge.length,y+.1,y+.86,.72,cream,'Lodge · balcony picket');}
          }
        }
      }
      continue;
    }
    if(grill) {
      const burgundy=mat('#329b9f');
      // Both the court-facing long facade and approach end carry service hatches.
      for(const edge of edges.filter(e=>e.normal[1]<-.6||e.normal[0]<-.8)) {
        windowBand(buildings,edge,.12,.88,1.04,2.05,.04,navy,'Grill · recessed serving hatch');
        windowBand(buildings,edge,.10,.90,.86,1.04,.08,ochre,'Grill · warm serving counter');
        windowBand(buildings,edge,.06,.94,2.16,2.37,.045,burgundy,'Grill · burgundy fascia');
      }
      const front=edges.find(e=>e.normal[1]<-.6)!;
      windowBand(buildings,front,.27,.73,height+.20,height+1.10,.06,burgundy,'Grill · roof sign');
      panel(buildings,'Grill · roof sign back',[onWall(front,.27,height+.20,.04),onWall(front,.73,height+.20,.04),onWall(front,.73,height+1.10,.04),onWall(front,.27,height+1.10,.04)],[-front.normal[0],0,-front.normal[1]],burgundy);
      for(const t of [.30,.70])box(buildings,'Grill · sign support',[.055,.85,.055],cream,onWall(front,t,height+.38,.03) as [number,number,number]);
      // Plain sign color block; no invented lettering from an oblique reference.
      continue;
    }
    if (!beachHouse) {
      // Broad painted patches add a readable coastal building scale without
      // multiplying individual panes across the distant residential blocks.
      for (const edge of [...edges].sort((a, b) => b.length - a.length).slice(0, 2)) {
        windowBand(buildings, edge, .17, .83, height * .38, height * .72, .035, cream, `${building.name} · broad window surround`);
        windowBand(buildings, edge, .19, .81, height * .42, height * .68, .05, navy, `${building.name} · painted window patch`);
      }
      continue;
    }
    const fronts = edges.filter(edge => edge.normal[0] > .8 && edge.length > 4);
    for (const edge of edges) for (const y of [3.30, 5.74]) windowBand(buildings, edge, 0, 1, y, y + .12, .025, cream, 'Beach House · cream horizontal facade band');
    fronts.forEach((edge, index) => {
      gable(buildings, edge, Math.min(4.4, edge.length - 1), height, index === 1 ? 2.0 : 1.70, sage, charcoal, cream);
      // City facilities survey PDF p13: the upper dining room reads as a continuous
      // white-framed glazed gallery, not separate punched windows. Pane widths and
      // transom heights are authored; the mapped wall stays exactly where it was.
      windowBand(buildings, edge, .025, .975, 3.55, 5.48, .045, cream, 'Beach House · continuous gallery surround');
      windowBand(buildings, edge, .035, .965, 3.65, 5.38, .060, navy, 'Beach House · continuous gallery glazing');
      const panes = Math.max(4, Math.round(edge.length / .95));
      for (let j = 1; j < panes; j++) {
        const t = .035 + .93 * j / panes, half = .035 / edge.length;
        windowBand(buildings, edge, t - half, t + half, 3.65, 5.38, .075, cream, 'Beach House · slim gallery mullion');
      }
      windowBand(buildings, edge, .035, .965, 4.99, 5.055, .075, cream, 'Beach House · upper gallery transom');
      const count = Math.max(2, Math.floor(edge.length / 2.05));
      for (let i = 0; i < count; i++) {
        const middle = (i + .5) / count, half = Math.min(.80 / edge.length, .37 / count), start = middle - half, end = middle + half;
        windowBand(buildings, edge, start, end, .36, 2.55, .04, cream, 'Beach House · cream storefront surround');
        windowBand(buildings, edge, start + .07 / edge.length, end - .07 / edge.length, .48, 2.47, .055, navy, 'Beach House · lower storefront opening');
        const a = onWall(edge, start - .10 / edge.length, 2.78, .06), b = onWall(edge, end + .10 / edge.length, 2.78, .06);
        const c = onWall(edge, end + .10 / edge.length, 2.42, 1.04), d = onWall(edge, start - .10 / edge.length, 2.42, 1.04);
        panel(buildings, 'Beach House · photo-inspired ochre awning', [a, b, c, d], [0, 1, 0], ochre);
        panel(buildings, 'Beach House · ochre awning underside', [a, b, c, d], [0, -1, 0], ochre);
        windowBand(buildings, edge, start - .10 / edge.length, end + .10 / edge.length, 2.07, 2.42, 1.04, ochre, 'Beach House · awning valance');
      }
    });
  }
}
