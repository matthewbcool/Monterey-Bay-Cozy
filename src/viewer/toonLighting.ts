import { LightingModel, MeshToonNodeMaterial } from 'three/webgpu';
import { BRDF_Lambert, diffuseColor, float, materialReference, mix, normalView, smoothstep, vec2, vec3 } from 'three/tsl';

/** Three r180's toon model dots an object-space normal with a view-space light.
 * Keep both in view space: orbiting the camera must not move the diffuse bands.
 * normalView includes instancing, skinning, deformation and face orientation.
 * This adapter preserves the engine's ramp, Lambert response, shadows and AO.
 * Remove only after the fixed-camera pixel regression passes with the upstream model. */
class StableToonLightingModel extends LightingModel {
  direct({lightDirection, lightColor, reflectedLight}: Parameters<LightingModel['direct']>[0], builder: Parameters<LightingModel['direct']>[1]) {
    const coord = vec2(normalView.dot(lightDirection).mul(.5).add(.5), 0);
    const fw = coord.fwidth().mul(.5);
    const ramp = (builder.material as MeshToonNodeMaterial).gradientMap
      ? vec3(materialReference('gradientMap', 'texture').context({getUV: () => coord}).r)
      : mix(vec3(.7), vec3(1), smoothstep(float(.7).sub(fw.x), float(.7).add(fw.x), coord.x));
    // Three's public LightingModel types erase the fluent TSL assignment methods.
    (reflectedLight.directDiffuse as any).addAssign(ramp.mul(lightColor).mul(BRDF_Lambert({diffuseColor: diffuseColor.rgb})));
  }
  indirect(builder: Parameters<LightingModel['indirect']>[0]) {
    const {ambientOcclusion, irradiance, reflectedLight} = (builder as any).context;
    reflectedLight.indirectDiffuse.addAssign(irradiance.mul(BRDF_Lambert({diffuseColor})));
    reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion);
  }
}
export function stabilizeToonLighting(material: MeshToonNodeMaterial) {
  if (material.userData.stableToonLighting) return;
  material.setupLightingModel = () => new StableToonLightingModel();
  material.userData.stableToonLighting = true;
  material.needsUpdate = true;
}
