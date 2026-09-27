// OWNER: world agent. Side-effect registrations for this module, imported once at startup:
// registerTicker(...), registerBonusProvider(...), registerPowerProvider(...), on('event', ...).
import { registerTicker } from '../core/tick';
import * as world from '../systems/world';
import { schedulePrewarm } from '../modes/world/prewarm';

// 1 Hz: map generation/upkeep, stamina regen, march phases (arrive -> battle/gather -> return), radar refresh.
registerTicker('world', world.worldTick);

// Build the world map's static scenery in idle time while the player is in the base (first visit is instant).
schedulePrewarm();

if (import.meta.env.DEV) {
  // Dev/test handle: window.__osWorld.<fn>(game, ...) — e.g. __osWorld.refreshRadar(__os.game, __os.now()).
  (window as any).__osWorld = world;
}
