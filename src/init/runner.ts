// OWNER: runner agent. Side-effect registrations for this module, imported once at startup.
// Registers the runner's inline SVG icons (rn_skull, rn_star, rn_tank, ...) into the shared Icon set so
// other modules (e.g. a base-screen "Special Ops" entry) can use them, and the replay-pass regen ticker.
import { registerTicker } from '../core/tick';
import { registerRunnerIcons } from '../modes/runner/icons';
import { refreshPasses } from '../modes/runner/progress';

registerRunnerIcons();

// Rewarded-replay passes: +1 every 30 min up to 5 (absolute timestamps, so offline time counts).
registerTicker('runnerPasses', (s, t) => refreshPasses(s, t));
