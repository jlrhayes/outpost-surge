// OWNER: runner agent. Side-effect registrations for this module, imported once at startup.
// Registers the runner's inline SVG icons (rn_skull, rn_star, rn_tank, ...) into the shared Icon set so
// other modules (e.g. a base-screen "Special Ops" entry) can use them.
import { registerRunnerIcons } from '../modes/runner/icons';

registerRunnerIcons();
