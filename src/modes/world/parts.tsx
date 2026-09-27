// OWNER: world agent. Small UI building blocks shared by the world HUD and screens.
import type { ComponentChildren } from 'preact';
import { closeScreen, openScreen, toast } from '../../core/nav';
import { fmt } from '../../core/format';
import type { Reward } from '../../core/types';
import type { GameState } from '../../core/store';
import { Icon } from '../../ui/components/Icon';
import { RewardList as KitRewardList } from '../../ui/components/RewardList';
import { rewardSummary, scaleReward } from '../../systems/items';
import { isEmptyReward } from '../../core/economy';
import { safeSquadPower, squadMarch, marchStatusLabel } from '../../systems/world';
import { squadReady } from '../../systems/heroes';
import { sfx } from '../../core/audio';

/**
 * Screen ids other modules implement per the contract in docs/ARCHITECTURE.md. Deliberately NOT read from the
 * `SCREENS` registry: importing `ui/screens` here formed a cycle (screens → world screens → sheets → parts →
 * screens) that crashed boot on HMR.
 */
const CONTRACT_SCREENS = new Set(['rewards', 'speedup', 'bag', 'quests', 'daily', 'research', 'formation', 'heroes', 'heroDetail', 'recruit', 'campaign']);

/** True if another module provides this screen id (e.g. 'rewards', 'speedup', 'formation'). */
export function hasScreen(id: string): boolean {
  return CONTRACT_SCREENS.has(id);
}

/** Shows the meta "You received" popup when available, else a toast. Caller grants first. */
export function showRewards(title: string, reward: Reward): void {
  sfx.reward();
  if (hasScreen('rewards')) openScreen('rewards', { title, reward });
  else toast(`${title}: ${rewardSummary(reward)}`, 'good');
}

/** Reward tiles (meta UI kit), optionally multiplied. */
export function RewardList(props: { reward: Reward; mult?: number; size?: number }) {
  const r = props.mult && props.mult !== 1 ? scaleReward(props.reward, props.mult) : props.reward;
  if (isEmptyReward(r)) return <div class="wm-dim">No loot</div>;
  return <KitRewardList reward={r} size={props.size ?? 46} center={false} class="wm-kit-rewards" />;
}
/** "Your squad vs enemy" power comparison. */
export function PowerCompare(props: { mine: number; enemy: number; enemyLabel?: string }) {
  const { mine, enemy } = props;
  const ratio = enemy > 0 ? mine / enemy : 1;
  const cls = mine <= 0 ? 'unknown' : ratio >= 1.1 ? 'good' : ratio >= 0.85 ? 'even' : 'bad';
  const verdict = mine <= 0 ? '' : ratio >= 1.1 ? 'Favourable' : ratio >= 0.85 ? 'Close fight' : 'Risky';
  return (
    <div class={'wm-vs wm-vs-' + cls}>
      <div class="wm-vs-side">
        <div class="wm-vs-label">Your squad</div>
        <div class="wm-vs-num">
          <Icon name="power" size={16} />
          {mine > 0 ? fmt(mine) : '—'}
        </div>
      </div>
      <div class="wm-vs-mid">
        <div class="wm-vs-badge">VS</div>
        {verdict && <div class="wm-vs-verdict">{verdict}</div>}
      </div>
      <div class="wm-vs-side right">
        <div class="wm-vs-label">{props.enemyLabel ?? 'Enemy'}</div>
        <div class="wm-vs-num">
          <Icon name="power" size={16} />
          {fmt(enemy)}
        </div>
      </div>
    </div>
  );
}

/** Row of squad chips; shows power and whether the squad is out marching. */
export function SquadPicker(props: { s: GameState; squads: number[]; value: number; onChange: (id: number) => void }) {
  const { s } = props;
  if (props.squads.length <= 1) return null;
  return (
    <div class="wm-squads">
      {props.squads.map((id) => {
        const m = squadMarch(s, id);
        const ready = squadReady(s, id);
        const p = safeSquadPower(s, id);
        return (
          <button
            key={id}
            class={'wm-squad ' + (id === props.value ? 'sel ' : '') + (m ? 'busy ' : '') + (!ready ? 'empty' : '')}
            onClick={() => {
              sfx.click();
              props.onChange(id);
            }}
          >
            <div class="wm-squad-name">Squad {id}</div>
            <div class="wm-squad-sub">{m ? marchStatusLabel(m) : !ready ? 'No heroes' : p > 0 ? fmt(p) : 'Idle'}</div>
          </button>
        );
      })}
    </div>
  );
}

/** First squad that can act right now (idle and has heroes), else the first squad. */
export function defaultSquad(s: GameState, squads: number[]): number {
  for (const id of squads) if (!squadMarch(s, id) && squadReady(s, id)) return id;
  for (const id of squads) if (!squadMarch(s, id)) return id;
  return squads[0] ?? 1;
}

/** Bottom sheet used for map entity / march panels. The map stays visible (and tappable) above it. */
export function Sheet(props: {
  screenKey: number;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  icon?: ComponentChildren;
  accent?: string;
  children: ComponentChildren;
}) {
  const close = () => closeScreen(props.screenKey);
  return (
    <div class="wm-sheet-root" onPointerDown={close}>
      <div class="wm-sheet" style={props.accent ? { borderTopColor: props.accent } : undefined} onPointerDown={(e) => e.stopPropagation()}>
        <div class="wm-sheet-grip" />
        <div class="wm-sheet-head">
          {props.icon && <div class="wm-sheet-icon">{props.icon}</div>}
          <div class="wm-sheet-titles">
            <div class="wm-sheet-title">{props.title}</div>
            {props.subtitle && <div class="wm-sheet-sub">{props.subtitle}</div>}
          </div>
          <button
            class="wm-sheet-close"
            aria-label="Close"
            onClick={() => {
              sfx.click();
              close();
            }}
          >
            ×
          </button>
        </div>
        <div class="wm-sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ world-specific icons

const W: Record<string, (s: number) => preact.JSX.Element> = {
  radar: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#1d4a2e" stroke="#7af09a" stroke-width="1.6" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#7af09a" stroke-width="1" opacity="0.7" />
      <path d="M12 12L20 7" stroke="#b8ffc8" stroke-width="2" stroke-linecap="round" />
      <circle cx="16" cy="15" r="1.6" fill="#ff5a4a" />
      <circle cx="8" cy="8" r="1.3" fill="#ffd23c" />
    </svg>
  ),
  search: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6.5" fill="#cfe8ff" stroke="#1a4a78" stroke-width="2.2" />
      <path d="M15 15l6 6" stroke="#1a4a78" stroke-width="3" stroke-linecap="round" />
    </svg>
  ),
  reports: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#f4ecd8" stroke="#6a5a3a" stroke-width="1.6" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#6a5a3a" stroke-width="1.6" stroke-linecap="round" />
      <path d="M15 14l4 4M19 14l-4 4" stroke="#d83a2a" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  ),
  home: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" fill="#ffd23c" stroke="#8a5a00" stroke-width="1.6" />
    </svg>
  ),
  base: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M3 20V9l4-3 4 3v2l3-2 3 2V7l4 3v10z" fill="#9ad0ff" stroke="#123a66" stroke-width="1.6" />
      <rect x="6" y="14" width="3" height="6" fill="#123a66" />
      <rect x="15" y="14" width="3" height="3" fill="#123a66" />
    </svg>
  ),
  swords: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M4 4l10 10M20 4L10 14" stroke="#eee" stroke-width="2.6" stroke-linecap="round" />
      <path d="M6 16l2 2M18 16l-2 2M3 21l4-4M21 21l-4-4" stroke="#c8a060" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  ),
  gather: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M4 20l7-7" stroke="#8a5a2a" stroke-width="2.6" stroke-linecap="round" />
      <path d="M10 6c3-3 8-2 10 0-2 1-4 3-5 6-1-3-3-5-5-6z" fill="#b8c8d8" stroke="#3a4a5a" stroke-width="1.4" />
    </svg>
  ),
  truck: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="2" y="8" width="12" height="8" rx="1" fill="#6b8e4e" stroke="#2a3a1a" stroke-width="1.4" />
      <path d="M14 10h4l3 3v3h-7z" fill="#8fb070" stroke="#2a3a1a" stroke-width="1.4" />
      <circle cx="6" cy="17" r="2" fill="#222" />
      <circle cx="17" cy="17" r="2" fill="#222" />
    </svg>
  ),
  back: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M10 5l-6 7 6 7M4 12h16" stroke="#9ad0ff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  ),
  dig: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M5 19l9-9" stroke="#8a5a2a" stroke-width="2.4" stroke-linecap="round" />
      <path d="M13 5l6 6-3 3-6-6z" fill="#b8b8b8" stroke="#444" stroke-width="1.2" />
      <path d="M3 21h8" stroke="#6a4a2a" stroke-width="2" />
    </svg>
  ),
  survivor: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="3" fill="#f0c8a0" />
      <path d="M4 20c0-4 2-7 5-7s5 3 5 7z" fill="#3a6ea5" />
      <path d="M17 3v10" stroke="#555" stroke-width="1.5" />
      <path d="M17 3h5l-1.5 2 1.5 2h-5" fill="#e84a3a" />
    </svg>
  ),
  crate: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="14" rx="1.5" fill="#b07a40" stroke="#5a3a1a" stroke-width="1.5" />
      <path d="M3 11h18M12 6v14" stroke="#5a3a1a" stroke-width="1.5" />
    </svg>
  ),
  lock: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="11" rx="2" fill="#c8ccd4" stroke="#444" stroke-width="1.5" />
      <path d="M8 10V7a4 4 0 018 0v3" stroke="#444" stroke-width="2" fill="none" />
    </svg>
  ),
  shield: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#8ad8ff" stroke="#1a6a98" stroke-width="1.5" />
    </svg>
  ),
  zombie: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="10" r="7" fill="#9ab870" stroke="#3a5a22" stroke-width="1.5" />
      <circle cx="9.5" cy="9.5" r="1.6" fill="#2a1a1a" />
      <circle cx="14.5" cy="9.5" r="1.6" fill="#2a1a1a" />
      <path d="M9 14l1.5-1 1.5 1 1.5-1 1.5 1" stroke="#2a1a1a" stroke-width="1.2" fill="none" />
      <path d="M8 17h8v4H8z" fill="#6a5a8a" />
    </svg>
  ),
  outpost: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M3 21V10l3-2v-3h2v2l4-3 4 3V5h2v3l3 2v11z" fill="#c8b8a0" stroke="#5a4a3a" stroke-width="1.4" />
      <rect x="10" y="14" width="4" height="7" fill="#5a4a3a" />
    </svg>
  ),
  star: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z" fill="#ffd23c" stroke="#a07810" stroke-width="1.2" />
    </svg>
  ),
};

export function WIcon(props: { name: string; size?: number }) {
  const f = W[props.name];
  const s = props.size ?? 22;
  if (!f) return <Icon name={props.name} size={s} />;
  return <span class="icon">{f(s)}</span>;
}
