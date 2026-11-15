# GT01 vehicle and material rendering

The candidate combines the GT01 vehicle from the project Page's playable
preview with the recovered material renderer and the verification fixes. Its
five routes, four-car race, collision geometry, input handling, clocks and score
rules use the existing simulation.

## Visual implementation

`dist/car.js` contains the original procedural GT01 asset and a cached adapter
for `DriveArt.carMesh`. Hardware renderers use LOD 1 for the player and LOD 2 for computers. Software GPU and Canvas renderers use the same asset's economy tessellation. The mesh
includes a continuous body loft, open wheel arches, curved canopy, mirrors,
vents, splitter, diffuser, wing, wheels and separate lamp surfaces. Smoothed
normals follow the same body-height shear as the vertices in `playerCarMesh`.
The visual asset does not replace collision bodies.

`dist/materials.js` shades actual depth-tested geometry using GGX specular and
Schlick Fresnel, static-world directional shadows and sky-image environment
reflections. Those reflections approximate the environment; they are not
ray-traced moving-car reflections. The original `dusk-sky.webp` remains a
relative same-origin asset.

Software GPU renderers use a 256-pixel maximum render-target dimension and a
128-pixel shadow map. Other GPU renderers retain the existing resolution and
768-pixel shadow map. This bounds software rasterization cost while preserving
material execution, gameplay, input and camera rules. It does not establish
hardware or physical-phone frame rates.

## Verification fixes

- The mountain probe compares the complete vehicle with an entirely missing
  mesh at all 240 route positions. It retains the existing region thresholds
  instead of comparing one shaded pixel with an unlit paint RGB value.
- A relative `favicon.svg` removes the browser's missing-icon HTTP 404. The
  zero-console-error assertion remains enabled.
- The effects matrix retains all 486 paired vehicle comparisons. A redundant
  restoration draw runs once per viewport. Transient rebounds are recorded on
  native animation frames, still requiring actual negative velocity and impact
  greater than 0.5.
- The natural-race driver prepares the camera and uses the normal restart
  button before driving. Independent keyboard events are sent together;
  screenshot writes do not block the controller. A longer path lookahead
  reduces steering oscillation under variable protocol latency. Physics,
  clocks, finish conditions and the 60–90-second acceptance window are intact.
- Flicker and camera probes restore their exact sampled image instead of
  drawing that same pose a third time. Terrain-ray checks reject only disjoint
  triangle bounding boxes before the unchanged intersection calculation.
- Mountain partial-occlusion checks keep every body ray and compare the actual
  car-only pixel mask exactly with fresh renderer resources at the same pose
  and backend. Portrait, landscape and subpixel transitions are replayed in
  both renderers. A tiny exposed geometric fragment can rasterize to zero
  pixels; the fresh full-mesh reference must then agree exactly. Four positive
  partial-pose controls must reject a missing whole mesh. Ordinary visibility
  limits, full occlusion and actual recovery with one penalty remain required.

The complete local verification passed: 32 commands, 614 screenshots,
8 recordings and 69 matching source hashes. The normal 1000×600 keyboard race
finished in 66.15 seconds with 3 physical AI contacts and 1011 native
frames, saved its score and froze the finish ranking. The original cameras
remain unchanged. [Exact acceptance scope](../verification/gt01-acceptance/acceptance.md).

Observed race intervals were p50 66.6 ms and p95 100.0 ms on the shared
software-GPU host. This is not a 60 FPS or physical-phone claim.

## Publication and rollback

The upstream repository connection is read-only. The user has authorized
continuing in a fork, on `main`, with the complete verification requirements
preserved. A fork must exist and provide write access before pushing.

A commit containing `[verify only]` runs CI without deployment. A subsequent
normal verified commit or explicit workflow dispatch can publish the same
runtime after visual review. Deployment remains dependent on the full
verification job. Reverting the candidate restores the prior renderer and
vehicle; player data requires no migration.

Photographic concept fidelity, physical Android/iPhone behavior and phone frame
rates remain separate acceptance work.
