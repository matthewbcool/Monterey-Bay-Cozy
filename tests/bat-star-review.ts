import { Color, DirectionalLight, HemisphereLight, Matrix3, Mesh, OrthographicCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createBatStar } from '../src/models/habitat/batStar';
import { attachToSurface } from '../src/models/shared/surfaceAttachment';
import { STYLE, createToonMaterial } from '../src/models/shared/style';
import { disposeObject } from '../src/models/props/primitives';

export async function reviewBatStar() {
  const params = new URLSearchParams(location.search);
  const renderer = params.has('classic') ? new WebGLRenderer({ antialias: true }) : new WebGPURenderer({ antialias: true, forceWebGL: params.has('webgl') });
  renderer.setSize(innerWidth, innerHeight); renderer.info.autoReset = false; document.body.append(renderer.domElement);
  if (renderer instanceof WebGPURenderer) await renderer.init();
  const scene = new Scene(); scene.background = new Color('#193e48');
  scene.add(new HemisphereLight(STYLE.sky.color, STYLE.sky.ground, STYLE.sky.intensity));
  const sun = new DirectionalLight(STYLE.sun.color, STYLE.sun.intensity); sun.position.copy(STYLE.sun.direction); scene.add(sun);
  const star = createBatStar({ seed: 17, color: 'orange' }); scene.add(star);
  const surface = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), createToonMaterial({ color: '#5e8075', rim: false }));
  surface.visible = false; scene.add(surface);
  const binding = attachToSurface(star, { surface, point: new Vector3(), normal: new Vector3(0, 1, 0) });
  const span = .28, aspect = innerWidth / innerHeight, camera = new OrthographicCamera(-span * aspect / 2, span * aspect / 2, span / 2, -span / 2, .001, 10);
  async function render() { renderer.info.reset(); if (renderer instanceof WebGPURenderer) await renderer.renderAsync(scene, camera); else renderer.render(scene, camera); }
  async function pose(view: 'top' | 'oblique' | 'underside' | 'wall') {
    surface.rotation.z = view === 'wall' ? Math.PI / 2 : 0; surface.updateMatrixWorld(true); binding.update(0);
    sun.position.copy(STYLE.sun.direction);
    // Inspection lighting follows the camera below the animal so oral detail is readable.
    if (view === 'underside') sun.position.y *= -1;
    if (view === 'top') camera.position.set(.01, 1, .03);
    if (view === 'oblique') camera.position.set(.2, .4, .3);
    if (view === 'underside') camera.position.set(.1, -.4, .2);
    if (view === 'wall') camera.position.set(-1, .04, .12);
    camera.lookAt(star.position); await render();
  }
  const requested = params.get('view');
  await pose(requested === 'underside' || requested === 'oblique' || requested === 'wall' ? requested : 'top');
  return { renderer, camera, star, surface, binding, render, pose,
    result: { backend: renderer instanceof WebGPURenderer ? renderer.backend.constructor.name : 'WebGLRenderer', modelDrawCalls: 1, modelTriangles: (star.children[0] as Mesh).geometry.index!.count / 3 },
    async creep(seconds: number) { binding.update(seconds); await render(); },
    normal: () => new Vector3(0, 1, 0).applyMatrix3(new Matrix3().getNormalMatrix(surface.matrixWorld)).normalize(),
    dispose() { binding.detach(); disposeObject(star); disposeObject(surface); renderer.dispose(); },
  };
}
