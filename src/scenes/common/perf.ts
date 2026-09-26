/** Live performance counters (written inside the render loop, read by the HUD). */
export const perfStats = {
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
  gpuMemMB: 0,
  activeObjects: 0,
  dpr: 1,
  procedural: 0,
}
