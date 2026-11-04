import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import { buildAnemoneGeometry, createAnemoneBed } from '../src/models/habitat/anemone/createAnemone';
import { createToonMaterial } from '../src/models/shared/style';
import { prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';

test('giant green anemone: seeded crown, finite metre geometry and bounded authored LODs', async () => {
  for (let seed = 1; seed <= 40; seed++) for (const colony of [false, true]) {
    const source = buildAnemoneGeometry('giant-green', seed, colony), same = buildAnemoneGeometry('giant-green', seed, colony);
    assert.deepEqual(source.attributes.position.array, same.attributes.position.array);
    same.dispose();
    const levels = await prepareGeometryLods(source);
    const counts = Object.values(levels).map(triangles);
    assert(counts[0] <= (colony ? 400 : 2000)); assert(counts[1] < counts[0]); assert(counts[2] < counts[1]);
    for (const geometry of Object.values(levels)) {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      assert.equal(p.count, n.count); assert.equal(p.count, geometry.attributes.color.count);
      for (const v of [...p.array, ...n.array, ...geometry.attributes.color.array]) assert(Number.isFinite(v));
      for (const i of geometry.index!.array) assert(i >= 0 && i < p.count);
      // Inspect real vertices: the LOD controller assigns conservative shared bounds.
      let minY = Infinity, maxY = -Infinity, maxRadius = 0;
      for (let i = 0; i < p.count; i++) { minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i)); maxRadius = Math.max(maxRadius, Math.hypot(p.getX(i), p.getZ(i))); }
      assert(Math.abs(minY) < 1e-7, 'base anchors on the contact plane');
      assert(maxY > .07 && maxY < .10 && maxRadius > .07 && maxRadius < .105, 'bounded specimen envelope');
      assert(geometry.userData.tentacleCount >= 18);
    }
    let releases = 0; for (const geometry of Object.values(levels)) geometry.addEventListener('dispose', () => releases++);
    source.dispose(); assert.equal(releases, 3, 'one family disposes every authored level');
  }
  const a=buildAnemoneGeometry('giant-green',14), b=buildAnemoneGeometry('giant-green',15);
  assert.notDeepEqual(a.attributes.position.array,b.attributes.position.array);a.dispose();b.dispose();
});

test('giant green anemone: open disk, recessed mouth, outward winding and embedded tentacle roots', async () => {
  const source=buildAnemoneGeometry('giant-green',14), material=createToonMaterial({vertexColors:true});
  const levels=await prepareGeometryLods(source);
  for(const geometry of Object.values(levels)) {
    const mesh=new Mesh(geometry,material);mesh.updateMatrixWorld(true);
    const heightAt=(x:number,z:number)=>new Raycaster(new Vector3(x,.2,z),new Vector3(0,-1,0)).intersectObject(mesh)[0]?.point.y;
    assert(heightAt(0,0)! < heightAt(.025,0)!-.003,'mouth recessed below exposed disk');
    for(let i=0;i<12;i++) {const a=i*Math.PI/6;const y=heightAt(Math.cos(a)*.03,Math.sin(a)*.03);assert(y && y>.045 && y<.057,'disk remains open, continuous and front-facing');}
    const parts=geometry.userData.sourceParts as {name:string;start:number;count:number}[];
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    for(const band of parts.filter(b=>b.name.endsWith('tentacles'))) {
      const ids=new Set(Array.from(geometry.index!.array.slice(band.start,band.start+band.count)));
      let roots=0;
      for(const i of ids) {
        if(p.getY(i)<.056) {roots++;assert(Math.hypot(p.getX(i),p.getZ(i))>.04,'roots stay peripheral');}
      }
      assert(roots>0,'each crown row embeds into disk');
      assert([...ids].some(i=>n.getY(i)>.2),'tentacle surface faces outward/up, not inside-out');
    }
  }
  source.dispose();material.dispose();
});

test('anemone bed: static matrices, tilted contact normals and idempotent resource disposal',async()=>{
  const normal=new Vector3(1,1,0).normalize(),position=new Vector3(2,3,4);
  const bed=createAnemoneBed('giant-green',[{position,normal,yaw:.4}],14);
  const before=bed.root.instanceMatrix.version;
  const levels=await prepareGeometryLods(bed.root.geometry);
  assert.equal(triangles(levels.near),388);assert.equal(bed.root.instanceMatrix.version,before);
  const e=bed.root.instanceMatrix.array;assert.deepEqual([...e.slice(12,15)],[2,3,4]);
  assert(Math.abs(e[4]-normal.x)<1e-6 && Math.abs(e[5]-normal.y)<1e-6 && Math.abs(e[6]-normal.z)<1e-6,'local +Y follows rock normal');
  let geometryDisposals=0,materialDisposals=0;
  for(const geometry of Object.values(levels))geometry.addEventListener('dispose',()=>geometryDisposals++);
  bed.root.material.addEventListener('dispose',()=>materialDisposals++);
  bed.dispose();bed.dispose();assert.equal(geometryDisposals,3);assert.equal(materialDisposals,1);
});
