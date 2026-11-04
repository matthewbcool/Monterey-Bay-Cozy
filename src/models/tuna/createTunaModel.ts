import {Box3,Vector3} from 'three';
import { createModelAssembly } from '../shared/assembly';
import type { FishModel } from '../types';
import { buildTunaBody } from './components/body';
import { buildTunaFace } from './components/face';
import { buildTunaFins } from './components/fins';
import { TUNA_BATCHES, TUNA_PHYSICS } from './definition';
import { createTunaMaterials, type TunaOptions } from './materials';
import { attachTunaMotion } from './motion';
import { batchTuna } from './batching';

/** Public species entry point: compose, batch, then attach behavior. No viewer code. */
export function createTunaModel(options: TunaOptions = {}): FishModel {
  const lengthMeters=options.lengthMeters??1.2;
  if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw new Error('Fish length must be positive metres');
  const assembly = createModelAssembly('tuna');
  const materials = createTunaMaterials(options);
  buildTunaBody(assembly, materials);
  buildTunaFins(assembly, materials);
  buildTunaFace(assembly, materials);

  for (const batch of TUNA_BATCHES) assembly.batchParts(batch.components, batch.name, { discardUVs: true });
  const size=new Box3().setFromObject(assembly.visual,true).getSize(new Vector3());
  const k=lengthMeters/size.x;
  assembly.visual.scale.setScalar(k);
  const point=(p:readonly number[])=>p.map(v=>v*k) as [number,number,number];
  const physics={colliders:TUNA_PHYSICS.colliders.map(c=>({...c,center:point(c.center),radius:c.radius*k,halfLength:c.halfLength*k})),centerOfMass:point(TUNA_PHYSICS.centerOfMass),anchors:{mouth:point(TUNA_PHYSICS.anchors.mouth),grip:point(TUNA_PHYSICS.anchors.grip)}};
  assembly.root.userData={units:'metres',lengthMeters,sizeBasis:'Provisional design target; photographed species and physical size unverified'};
  const batch=batchTuna(assembly,materials.skin.uniforms);
  return attachTunaMotion(assembly.root, assembly.visual, assembly.parts, physics,batch);
}
