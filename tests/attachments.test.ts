import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { createModelAssembly, disposeModelResources } from '../src/models/shared/assembly';
import { buildTunaBody } from '../src/models/tuna/components/body';
import { buildTunaFins } from '../src/models/tuna/components/fins';
import { createTunaMaterials } from '../src/models/tuna/materials';
import { TUNA_GEOMETRY } from '../src/models/tuna/definition';

// Test the authored seam against the actual low-poly body, not just its profile formula.
test('Every lower fin embeds its root seam in the body mesh', () => {
  const assembly = createModelAssembly('attachment-test');
  const materials = createTunaMaterials();
  buildTunaBody(assembly, materials);
  buildTunaFins(assembly, materials);
  assembly.root.updateMatrixWorld(true);
  const body = assembly.parts.get('body')!.children[0] as Mesh;
  const ray = new Raycaster();
  function embedded(mesh: Mesh, seam: [Vector3, Vector3], halfDepth: number) {
    for (let step = 0; step <= 4; step++) for (const z of [-halfDepth, 0, halfDepth]) {
      const local = seam[0].clone().lerp(seam[1], step / 4);
      local.z = z;
      const point = mesh.localToWorld(local);
      ray.set(new Vector3(point.x, -5, point.z), new Vector3(0, 1, 0));
      const hit = ray.intersectObject(body, false)[0];
      assert.ok(hit, `${mesh.name}: seam must lie beneath the body footprint`);
      assert.ok(point.y - hit.point.y >= .005, `${mesh.name}: root gap at x=${point.x}, overlap=${point.y - hit.point.y}`);
    }
  }
  for (const side of ['near', 'far']) {
    const mesh = assembly.parts.get(`pelvic-${side}`)!.children[0] as Mesh;
    embedded(mesh, [new Vector3(-.07, -.045, 0), new Vector3(.52 * TUNA_GEOMETRY.lowerFins.pelvic.length, -.025, 0)], .015);
  }
  embedded(assembly.parts.get('anal')!.children[0] as Mesh, [new Vector3(-.07, .04, 0), new Vector3(.30, .18, 0)], .0225);
  assembly.parts.get('finlets-bottom')!.children.forEach((mesh, i) => {
    const size = .10 - i * .0055;
    embedded(mesh as Mesh, [new Vector3(-.07, -.045, 0), new Vector3(.52 * size * .96, -.025, 0)], .011);
  });
  disposeModelResources(assembly.root);
  // The face materials were not used by this focused fixture.
  materials.dark.dispose(); materials.eyeRim.dispose();
});
