// OWNER: base agent (living world). Base-mode overlays for the simulated world around the outpost:
//  - AI ally "Help" bubbles beside running upgrade timers (anchored to 'ah:<uid>', see buildingsView.ts)
//  - the incoming-raid / outpost-shield chip (opens the world module's 'outpostDefense' panel)
import './livingWorld.css';
import { useGame, type GameState } from '../../core/store';
import { clock } from '../../core/tick';
import { openScreen, toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmtDuration } from '../../core/format';
import { ALLY_HELPS_PER_DAY } from '../../data/world';
import { allyHelpsAvailable, requestAllyHelp } from '../../systems/world';
import { canFinishFree } from '../../systems/buildings';
import { anchorRef, sceneBusy } from './anchors';

const Handshake = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M1.5 9.5l4-3.5 4.5 2 3-1.5 4 1 5.5 2.5-2 6-4.5 3.5-3.5-2-5-2.5z" fill="#ffd8a8" stroke="#6a3a14" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M10 8l-3 3 1.5 1.5 3-2 2 1.5 3.5 3" fill="none" stroke="#6a3a14" stroke-width="1.3" stroke-linecap="round" />
    <path d="M1.5 9.5L0.5 14l2.5 1.5 2.5-9.5zM22.5 10.5l1 4-2.5 1.5-.5-8z" fill="#3a8ad8" stroke="#123a64" stroke-width="1.1" />
  </svg>
);

const Swords = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 3l9 9-2 2-9-9V3zM20 3l-9 9 2 2 9-9V3z" fill="#e8eef5" stroke="#3a1a14" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M5 16l3 3-2 2-3-3zM19 16l-3 3 2 2 3-3z" fill="#b07a3a" stroke="#3a1a14" stroke-width="1.2" />
  </svg>
);

const Shield = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#6ac8ff" stroke="#0e3a5c" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M12 5v14" stroke="#e8f8ff" stroke-width="1.4" />
  </svg>
);

function help(uid: string): void {
  const r = requestAllyHelp(uid);
  if (!r) return;
  sfx.reward();
  toast(`${r.helps} ally help${r.helps > 1 ? 's' : ''}: -${fmtDuration(r.ms)} · ${r.left}/${ALLY_HELPS_PER_DAY} left today`, 'good');
}

function RaidChip(props: { s: GameState; t: number }) {
  const { s, t } = props;
  const inc = s.world.raid.incoming;
  const shield = s.world.raid.shieldUntil > t ? s.world.raid.shieldUntil : 0;
  if (!inc && !shield) return null;
  const open = () => {
    sfx.click();
    openScreen('outpostDefense');
  };
  return (
    <div class="lw-chips">
      {inc && (
        <button class="lw-raid interactive" onClick={open} aria-label={`Raid by ${inc.label}`}>
          <Swords />
          <span>
            <b>Raid</b> {fmtDuration(Math.max(0, inc.arriveAt - t))}
          </span>
        </button>
      )}
      {shield > 0 && !inc && (
        <button class="lw-shield interactive" onClick={open} aria-label="Outpost shield">
          <Shield />
          <span>{fmtDuration(shield - t)}</span>
        </button>
      )}
    </div>
  );
}

export function LivingWorldHud() {
  const s = useGame();
  const t = clock.value;
  const busy = sceneBusy.value;
  return (
    <div class={'lw-root' + (busy ? ' busy' : '')}>
      {s.base.buildings.map((b) => {
        // no bubble once the upgrade can be finished for free anyway
        if (b.upgradeEndsAt === null || canFinishFree(s, b, t)) return null;
        const n = allyHelpsAvailable(s, b.uid, t);
        if (n <= 0) return null;
        return (
          <div key={b.uid} class="lw-anchor" ref={anchorRef('ah:' + b.uid)}>
            <button class="lw-help interactive" onClick={() => help(b.uid)} aria-label="Ask allies for help">
              <Handshake />
              <span class="lw-help-n">{n}</span>
            </button>
          </div>
        );
      })}
      <RaidChip s={s} t={t} />
    </div>
  );
}
