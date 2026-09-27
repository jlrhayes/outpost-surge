// OWNER: world agent. Signals shared between the world HUD/screens (Preact) and the 3D WorldMode.
import { signal } from '@preact/signals';

/** Entity currently highlighted on the map (selection ring). */
export const selectedEntity = signal<string | null>(null);
/** March currently highlighted (tapped chip / vehicle). */
export const selectedMarch = signal<string | null>(null);

export interface CamRequest {
  /** World x/z to centre on (the target is framed above the info sheet when `sheet` is true). */
  x: number;
  z: number;
  /** Optional camera distance. */
  dist?: number;
  /** Follow a march vehicle instead of a fixed point. */
  marchId?: string;
  sheet?: boolean;
  instant?: boolean;
  t: number;
}
/** Camera commands for the world mode (pan/zoom/follow). */
export const camRequest = signal<CamRequest | null>(null);

/** Tile under the camera centre (for the coordinates readout); updated only when it changes. */
export const camTile = signal<{ tx: number; ty: number }>({ tx: 32, ty: 32 });

let stamp = 0;
export function requestCam(req: Omit<CamRequest, 't'>): void {
  camRequest.value = { ...req, t: ++stamp };
}

/** Screens rendered as bottom sheets over the live map (taps on the map pass through them). */
export const WORLD_SHEETS = new Set(['worldEntity', 'hordeInfo', 'worldMarch']);