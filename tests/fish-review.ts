import { applyNodeStyle } from '../src/viewer/nodeStyle';
import { AmbientLight, Box3, Color, DirectionalLight, GridHelper, Mesh, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { fishCollection } from '../src/models/catalogue';
import {formatSizeRange} from '../src/models/sizeRanges';

export async function reviewFish() {
  const params = new URLSearchParams(location.search), compare = params.has('compare'), species = params.get('species');
  // The tuna's material is TSL, so the full-collection comparison uses the node renderer like the main viewer.
  const renderer = params.has('classic') ? new WebGLRenderer({ antialias: true }) : new WebGPURenderer({ antialias: true, forceWebGL: params.has('webgl') });
  renderer.setSize(innerWidth, innerHeight); document.body.append(renderer.domElement);
  if (renderer instanceof WebGPURenderer) await renderer.init();
  renderer.info.autoReset = false;
  const scene = new Scene(); scene.background = new Color('#153740');
  scene.add(new AmbientLight('#d7e8df', 2)); const sun = new DirectionalLight('#e5f4d9', 2.2); sun.position.set(-1, 3, 4); scene.add(sun);
  const entries = species ? fishCollection.filter(entry => entry.id === species) : compare ? fishCollection : fishCollection.slice(1);
  const fish = entries.map(entry => entry.create());
  const sizes = fish.map(model => new Box3().setFromObject(model.root, true).getSize(new Vector3()));
  const rowHeights = sizes.map(size => Math.max(size.y, .26));
  const contentHeight = rowHeights.reduce((sum, row) => sum + row, 0) + Math.max(0, fish.length - 1) * .18;
  const aspect = innerWidth / innerHeight;
  const height = Math.max(contentHeight + .80, (Math.max(...sizes.map(size => size.x)) + .80) / aspect), width = height * aspect;
  let rowTop = contentHeight / 2;
  fish.forEach((model, i) => { model.root.position.set(species ? 0 : .18, rowTop - rowHeights[i] / 2, 0); rowTop -= rowHeights[i] + .18; scene.add(model.root); if (renderer instanceof WebGPURenderer) applyNodeStyle(model.root); });
  const gridWidth = Math.ceil(Math.max(height, width) * 10) / 10;
  const grid = new GridHelper(gridWidth, Math.round(gridWidth * 10), '#3a6065', '#254a53'); grid.rotation.x = Math.PI / 2; grid.position.z = -.35; grid.visible = !species; scene.add(grid);
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .01, 20); camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
  document.getElementById('labels')!.innerHTML = species ? '' : entries.map((entry, i) => `<div style="position:absolute;top:calc(${((height / 2 - fish[i].root.position.y) / height) * 100}% - 24px)">${entry.name}<small>${Math.round(fish[i].root.userData.lengthMeters * 100)} cm</small></div>`).join('');
  if (species) { document.querySelector('h1')!.textContent = entries[0].name; document.querySelector('header p')!.textContent = `${formatSizeRange(entries[0].sizeRange)} · ${Math.round(fish[0].root.userData.lengthMeters * 100)} cm model ${entries[0].sizeRange.measurement==='Bell diameter'?'bell':entries[0].sizeRange.measurement==='Arm span'?'extended arm span':'body'}`; }
  async function render() {
    renderer.info.reset();
    if (renderer instanceof WebGPURenderer) await renderer.renderAsync(scene, camera); else renderer.render(scene, camera);
  }
  await render();
  async function pose(state: 'slow' | 'fast' | 'caught', angle: 'side' | 'oblique' | 'underside' | 'far' = 'side') {
    for (const model of fish) {
      model.setLifeState('alive'); model.setSwimMode(state === 'fast' ? 'fast' : 'slow', true);
      for (let i = 0; i < 8; i++) model.update(.05);
      if (state === 'caught') model.setLifeState('caught');
    }
    if (angle === 'side') camera.position.set(0, 0, 5);
    if (angle === 'oblique') camera.position.set(-3.5, 1.2, 5);
    if (angle === 'underside') camera.position.set(-2, -3, 5);
    if (angle === 'far') camera.position.set(.3, 0, -5);
    camera.lookAt(0, 0, 0);
    await render();
  }
  await pose('fast');
  const result = {
    backend: renderer instanceof WebGPURenderer ? renderer.backend.constructor.name : 'WebGLRenderer',
    models: fish.map((model, i) => {
      let triangles = 0, drawCalls = 0;
      model.root.traverseVisible(o => { if (o instanceof Mesh) { triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; drawCalls++; } });
      return { id: entries[i].id, lengthMeters: model.root.userData.lengthMeters, triangles, drawCalls };
    }),
  };
  return { result, pose, fish, renderer, scene, camera, render, dispose() { fish.forEach(model => model.dispose()); grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); renderer.dispose(); } };
}
