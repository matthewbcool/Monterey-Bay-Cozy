# Otter Man exploration suit

An original powered otter suit for the Testing Gym: rounded otter ears, a cream muzzle and belly, metal whiskers, a dark visor, copper armor plates, pale aqua palm/sole outlets, twin back turbines and a tapered tail stabilizer. Silver-teal armor and copper plates now use scoped metallic highlights; soft facial details keep their matte finish. It is fictional equipment, not a model of real protective gear.

## Try it

Open **Testing Gym**. The suit stands beside the arrival point and **E / Interact** equips it. **Menu → Otter Man station** returns to that starting point. The same model is inspectable in **Objects → Otter Man exploration suit**.

- WASD/arrows or left stick: move relative to the camera.
- Hold Space / A / touch Up: lift off and ascend.
- Hold C / B / touch Down: descend; landing on accessible land restores walking.
- Shift / touch Boost: accelerate from 18 to 42 m/s. Climb/descent is 12 m/s.
- Forward movement smoothly pitches the body into a prone flight pose; releasing movement returns it upright. The head looks along the flight direction.
- Underwater, cruise/boost are 4 / 8 m/s and vertical travel is 3 m/s. The sealed suit has unlimited air; ordinary swimming keeps its existing breath limit. Walk into water or fly down through the surface, then use the same controls to explore and resurface.
- A forehead lamp automatically lights nearby surfaces while submerged. Four wrist/sole outlets release rising bubbles in water and switch back to jets above it.
- Four wrist/sole jets fire while airborne. Boost makes the foot exhaust more than twice as long and 35% wider, with a smaller change at the hands. Reduced motion removes the subtle plume pulse.
- Release input: hover. Drag or right stick looks around; scroll/pinch adjusts the camera.
- **Return suit to station** returns the player to the park entrance and restores the original outfit. Changing tabs also returns the suit.

The suit can observe the park and the southeast [waterfront extension](waterfront-extension.md). The flight volume is X -140..1500, Z -230..900 m, capped at Y 180 m. The water surface is traversable; the [survey-backed seabed](bathymetry.md) is the underwater floor. Rooftops remain hover surfaces and ordinary landing is for dry terrain. Rotated park buildings, waterfront buildings and the pool use their actual polygon footprints inside fast bounding-box checks. Visible fence/wall/building heights replace the old blanket eight-metre flight barriers. Fine mesh collision, flying under structures and realistic aerodynamics are outside this experiment.

## Ownership and performance

`buildAvatarGeometry(design, 'otter-man', true)` builds the suit and exhaust into one skinned batch. Four exhaust bones extend the existing 17-bone avatar rig to 21 bones for this equipment only. `createOtterManSuit()` uses the same armor builder without the animated plumes for the object/station display; there is no second armor design. The public roots stay at scale one. Height/build adjustments use the existing avatar sizing contract. The saved avatar recipe, skin/hair choices and outfit colors are preserved while equipment temporarily replaces the visible model.

The worn suit is **2,848 triangles / one color-pass draw** at Near, with no downloaded image textures. It retains the avatar ceiling of 5,000 triangles, one material, with a suit-specific ceiling of 21 bones. Shared distance LOD reduces the same geometry; current Near/Mid/Far counts are 2,848 / 1,424 / 568, each one draw. The static display is 2,560 Near triangles. Current underwater controls, path repairs and screenshots are in the diving review (historical authoring evidence omitted from this public snapshot). Earlier air-flight screenshots are in the thruster review (historical authoring evidence omitted from this public snapshot); the initial integration review (historical authoring evidence omitted from this public snapshot) preserves the older pre-thruster measurements. The station has one static draw while unequipped and hides while worn. Lighting, the shared toon ramp and skeleton data are scene/runtime costs in addition to these model counts.

`testingGym/flightController.ts` owns bounded movement and obstacle clearance. `avatarWorkbench.ts` owns equip/return transitions, keyboard/touch/gamepad input and camera following. The rig reads `flying`, `submerged` and speed to pose the body without moving the root. Inputs and flight snapshots are plain state suitable for a future network adapter; this remains a local single-player exercise. Reduced motion keeps flight functional while suppressing decorative animation.

Focused checks cover hover, landing, boundaries, obstacle tunnelling, invalid input, long frame gaps, size extremes and LOD. The browser journey uses actual controls to equip, lift, land, cross into the extension, return the suit, compare Map Study and inspect a 390px touch layout.

## Metallic finish and exhaust implementation

A single categorical vertex attribute distinguishes armor, matte details and illuminated outlets/exhaust. The existing TSL material conversion adds sun-facing specular highlights and a restrained view-dependent edge reflection on armor, plus self-lit blue/white exhaust. This remains the shared toon rendering path on WebGPU and WebGL 2. The air exhaust adds no environment-map downloads, additional materials, bloom passes or transparent layers. The underwater bubble effect adds one separate instanced draw. These are stylized highlights, not ray-traced reflections.

The four plumes use 288 triangles within the body batch. Their dedicated bones scale only exhaust geometry and follow their parent hands/feet. They collapse inside the outlets on the ground. The physical root remains untouched; pose, boost strength and thrust are exposed in the animation snapshot. Conservative skinned bounds include the longest boosted plume at every LOD.

## Underwater effects and limits

`testingGym/otterDiveEffects.ts` owns a fixed pool of **24 bubbles**, capped at **864 triangles / one additional color-pass draw / one material / zero image textures**. Bubbles originate at the four animated nozzle bones, remain in world space as the player moves, rise and disappear at the water surface. Boost increases emission rate. Reduced motion uses sparse stationary bubbles with short lifetimes. The deterministic pattern uses seed 6256; it has no per-frame particle allocation. Shared LOD registration applies to this mesh as well.

The headlamp lens is included in the existing skinned draw. A scoped TSL cone illuminates shared styled terrain, rocks, kelp and creatures on both renderers. It follows the head, fades over 16 m, and adds fragment work but no light draw, image texture or shadow map. It does not cast occlusion shadows; nearby intervening objects can therefore allow light through. Water itself retains its own shader. This is an inexpensive exploration light rather than a physical lighting simulation.

The bounded study water now uses USGS bathymetry, replacing the old five-metre floor and flat extension. The nearshore join and missing-data fallbacks remain explicitly authored; see [source coverage and limits](bathymetry.md). Ordinary swimming and boats retain their smaller existing play bounds. Hull interiors, tunnels and precise under-structure collision remain outside this prototype. Returning equipment or changing views clears bubbles and turns off the lamp.
