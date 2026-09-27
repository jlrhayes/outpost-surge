// OWNER: world agent. HUD shown on the world map: resources + stamina, march chips, radar / search /
// reports buttons, home + coordinates, and the big Base toggle.
import { useGame, type GameState } from '../../core/store';
import { goTo, openScreen } from '../../core/nav';
import { clock } from '../../core/tick';
import { fmtDuration } from '../../core/format';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { sfx } from '../../core/audio';
import { Icon } from '../../ui/components/Icon';
import { ResourceBar } from '../../ui/components/ResourceBar';
import {
  marchPosition,
  marchStatusLabel,
  marchTimerEnd,
  nextStaminaAt,
  radarClaimable,
  radarOpen,
  staminaMax,
  staminaNow,
  unreadReports,
  type March,
} from '../../systems/world';
import { camTile, requestCam, selectedEntity } from './bus';
import { WIcon } from './parts';
import './world.css';

export function WorldHud() {
  const s = useGame();
  const t = clock.value;
  const unlocked = isUnlocked(s, 'world');
  return (
    <div class="wm-hud">
      <TopBar s={s} t={t} />
      {unlocked ? (
        <>
          <MarchChips s={s} t={t} />
          <SideButtons s={s} />
          <FirstTip s={s} />
          <div class="wm-bl">
            <button
              class="wm-round wm-home"
              aria-label="Recentre on base"
              onClick={() => {
                sfx.click();
                selectedEntity.value = null;
                requestCam({ x: 0, z: 5 });
              }}
            >
              <Icon name="target" size={28} />
            </button>
            <div class="wm-coords">
              X:{camTile.value.tx} Y:{camTile.value.ty}
            </div>
          </div>
        </>
      ) : (
        <div class="wm-locked interactive">
          <WIcon name="lock" size={44} />
          <div class="wm-locked-title">World Map locked</div>
          <div class="wm-dim">{unlockHint('world')}</div>
        </div>
      )}
      <button
        class="world-btn wm-base-btn"
        aria-label="Back to base"
        onClick={() => {
          sfx.click();
          goTo('base');
        }}
      >
        <Icon name="home" size={44} />
        <span class="world-btn-label">Base</span>
      </button>
    </div>
  );
}

function TopBar(props: { s: GameState; t: number }) {
  const { s, t } = props;
  const cur = staminaNow(s, t);
  const max = staminaMax(s);
  const next = nextStaminaAt(s, t);
  return (
    <div class="hud-top wm-top">
      <ResourceBar onClick={() => openScreen('bag')} />
      <div class="wm-top-row">
      <button
        class="wm-stam"
        onClick={() => {
          sfx.click();
          openScreen('worldStamina');
        }}
      >
        <Icon name="stamina" size={22} />
        <span class="wm-stam-val">
          {cur}
          <small>/{max}</small>
        </span>
        {next !== null && <span class="wm-stam-next">+1 {fmtDuration(next - t)}</span>}
      </button>
      </div>
    </div>
  );
}

const pos = { x: 0, z: 0 };

function MarchChips(props: { s: GameState; t: number }) {
  const { s, t } = props;
  if (!s.world.marches.length) return null;
  const list = [...s.world.marches].sort((a, b) => a.squadId - b.squadId);
  return (
    <div class="wm-marches">
      {list.map((m) => (
        <MarchChip key={m.id} m={m} t={t} />
      ))}
    </div>
  );
}

function MarchChip(props: { m: March; t: number }) {
  const { m, t } = props;
  const end = marchTimerEnd(m);
  const start = m.phase === 'work' ? m.workStart : m.legStart;
  const p = Math.max(0, Math.min(1, (t - start) / Math.max(1, end - start)));
  const icon = m.phase === 'back' ? 'back' : m.kind === 'attack' ? 'swords' : m.kind === 'dig' ? 'dig' : 'gather';
  return (
    <button
      class={'wm-chip ' + (m.phase === 'back' ? 'back' : m.kind)}
      onClick={() => {
        sfx.click();
        marchPosition(m, t, pos);
        requestCam({ x: pos.x, z: pos.z, marchId: m.id, sheet: true });
        openScreen('worldMarch', { id: m.id });
      }}
    >
      <span class="wm-chip-sq">{m.squadId}</span>
      <WIcon name={icon} size={18} />
      <span class="wm-chip-text">
        <span class="wm-chip-status">{marchStatusLabel(m)}</span>
        <span class="wm-chip-time">{fmtDuration(end - t)}</span>
      </span>
      <span class="wm-chip-bar" style={{ width: p * 100 + '%' }} />
    </button>
  );
}

function SideButtons(props: { s: GameState }) {
  const { s } = props;
  const radarOn = isUnlocked(s, 'radar');
  const claim = radarOn ? radarClaimable(s) : 0;
  const open = radarOn ? radarOpen(s) : 0;
  const unread = unreadReports(s);
  return (
    <div class="wm-side">
      <button
        class={'wm-side-btn ' + (radarOn ? '' : 'locked')}
        onClick={() => {
          sfx.click();
          openScreen('radar');
        }}
      >
        <WIcon name="radar" size={32} />
        <span class="wm-side-label">Radar</span>
        {claim > 0 ? <span class="wm-count">{claim}</span> : open > 0 ? <span class="wm-count blue">{open}</span> : null}
        {!radarOn && (
          <span class="wm-side-lock">
            <WIcon name="lock" size={14} />
          </span>
        )}
      </button>
      <button
        class="wm-side-btn"
        onClick={() => {
          sfx.click();
          openScreen('worldSearch');
        }}
      >
        <WIcon name="search" size={30} />
        <span class="wm-side-label">Search</span>
      </button>
      <button
        class="wm-side-btn"
        onClick={() => {
          sfx.click();
          openScreen('worldReports');
        }}
      >
        <WIcon name="reports" size={30} />
        <span class="wm-side-label">Reports</span>
        {unread > 0 && <span class="wm-count">{unread}</span>}
      </button>
    </div>
  );
}

function FirstTip(props: { s: GameState }) {
  const { s } = props;
  if (s.world.maxHordeLevel > 0 || s.world.marches.length || s.world.reports.length) return null;
  return (
    <button
      class="wm-tip"
      onClick={() => {
        sfx.click();
        openScreen('worldSearch');
      }}
    >
      <WIcon name="zombie" size={24} />
      <span>
        Tap a <b>Lv 1</b> horde and send a squad to clear it
      </span>
      <span class="wm-tip-go">Find</span>
    </button>
  );
}
