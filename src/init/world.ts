// OWNER: world agent. Side-effect registrations for this module, imported once at startup:
// registerTicker(...), registerBonusProvider(...), registerPowerProvider(...), on('event', ...).
import { registerTicker } from '../core/tick';
import * as world from '../systems/world';

// 1 Hz: map generation/upkeep, stamina regen, march phases (arrive -> battle/gather -> return), radar refresh.
registerTicker('world', world.worldTick);

if (import.meta.env.DEV) {
  // Dev/test handle: window.__osWorld.<fn>(game, ...) — e.g. __osWorld.refreshRadar(__os.game, __os.now()).
  (window as any).__osWorld = world;
}
