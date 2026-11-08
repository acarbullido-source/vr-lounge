/**
 * Lightweight stub for `@iwer/sem` (Synthetic Environment Module).
 *
 * `@pmndrs/xr` transitively imports `@iwer/sem` for mixed-reality room-capture
 * emulation, which pulls 4.64 MB of sample room meshes (`music_room`, `living_room`,
 * `office_large`, `meeting_room`, `office_small`) into the build even when
 * `emulate: false` and `meshDetection: false` are configured.
 */
export class SyntheticEnvironmentModule {
  planesVisible = false
  boundingBoxesVisible = false
  meshesVisible = false
  version = '0.0.0-stub'

  loadDefaultEnvironment(): void {}
  loadEnvironment(): void {}
}

export default {
  SyntheticEnvironmentModule,
}
