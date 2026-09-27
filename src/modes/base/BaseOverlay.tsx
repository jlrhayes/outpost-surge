// OWNER: base agent. DOM elements projected over the 3D base (collect bubbles, timers, level badges,
// upgrade arrows, plot "+" pads, district banner, vehicle labels, selection actions, builder queue).
// Elements are positioned every frame by BaseMode via anchors (see ./anchors.ts) — no per-frame re-render.
import './base.css';
import { useGame, type GameState } from '../../core/store';
import { clock } from '../../core/tick';
import { focusBuilding, openScreen, toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt, fmtDuration } from '../../core/format';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import type { BuildingState } from '../../state/base';
import { Icon } from '../../ui/components/Icon';
import { BUILDINGS, DISTRICTS, PLOTS, buildingName } from '../../data/buildings';
import {
  bubbleThreshold,
  canFinishFree,
  plotHasBuildable,
  producerCap,
  remainingMs,
  uncollected,
  upgradeBlock,
} from '../../systems/buildings';
import { anchorRef, sceneBusy, selection, shownCleared, zoomedOut, layoutVersion } from './anchors';
import { doCollect, doFreeFinish, openSpeedup } from './actions';
import { buildingActions } from './buildingActions';
import { ArrowUp, Crate, Hammer, Jeep, Lock, Plus, Skull, Swords } from './icons';

const IDLE_CAP_MS = 8 * 3600 * 1000;

function Anchor(props: { k: string; class?: string; children: preact.ComponentChildren }) {
  return (
    <div class={'bo-anchor ' + (props.class ?? '')} ref={anchorRef(props.k)}>
      {props.children}
    </div>
  );
}

function TopMarker({ s, b, t }: { s: GameState; b: BuildingState; t: number }) {
  const def = BUILDINGS[b.type];
  if (b.upgradeEndsAt !== null) {
    const total = Math.max(1, b.upgradeEndsAt - (b.upgradeStartedAt ?? b.upgradeEndsAt - 1));
    const rem = remainingMs(b, t);
    const pct = Math.max(0, Math.min(100, (1 - rem / total) * 100));
    const free = canFinishFree(s, b, t);
    return (
      <div class="bo-timer-wrap">
        <button
          class="bo-timer interactive"
          onClick={() => {
            sfx.click();
            if (free) doFreeFinish(b.uid);
            else openSpeedup(b.uid);
          }}
        >
          <Hammer size={16} />
          <span class="bo-timer-text">{fmtDuration(rem)}</span>
          <span class="bo-timer-bar">
            <span style={{ width: pct + '%' }} />
          </span>
        </button>
        {free && (
          <button
            class="bo-free interactive"
            onClick={() => {
              sfx.click();
              doFreeFinish(b.uid);
            }}
          >
            FREE
          </button>
        )}
      </div>
    );
  }
  if (def.produces) {
    const amt = uncollected(s, b, t);
    if (amt >= bubbleThreshold(s, b)) {
      const full = amt >= producerCap(s, b) - 0.5;
      return (
        <button
          class={'bo-bubble interactive' + (full ? ' full' : '')}
          onClick={() => doCollect(b.uid)}
          aria-label={`Collect ${fmt(amt)}`}
        >
          <Icon name={def.produces} size={26} />
          {full && <span class="bo-full">FULL</span>}
        </button>
      );
    }
  }
  if (b.level === 0) {
    return (
      <button class="bo-build interactive" onClick={() => openScreen('buildingPanel', { uid: b.uid })}>
        <Hammer size={20} />
        <span>Build</span>
      </button>
    );
  }
  if (!upgradeBlock(s, b)) {
    return (
      <button class="bo-arrow interactive" onClick={() => openScreen('buildingPanel', { uid: b.uid })} aria-label="Upgrade available">
        <ArrowUp size={30} />
      </button>
    );
  }
  return null;
}

function SelectionStrip({ s, uid }: { s: GameState; uid: string }) {
  const b = s.base.buildings.find((x) => x.uid === uid);
  if (!b) return null;
  const acts = buildingActions(s, b);
  return (
    <Anchor k="sel" class="bo-sel-anchor">
      <div class="bo-sel">
        <div class="bo-sel-name">
          {buildingName(b.type)} <b>Lv {b.level}</b>
        </div>
        <div class="bo-sel-actions">
          <button class="bo-act interactive" onClick={() => openScreen('buildingPanel', { uid })}>
            <span class="bo-act-ic up">
              <ArrowUp size={24} />
            </span>
            <span>{b.upgradeEndsAt !== null ? 'Details' : b.level === 0 ? 'Build' : 'Upgrade'}</span>
          </button>
          {b.upgradeEndsAt !== null && (
            <button class="bo-act interactive" onClick={() => openSpeedup(uid)}>
              <span class="bo-act-ic speed">
                <Icon name="clock" size={22} />
              </span>
              <span>Speed Up</span>
            </button>
          )}
          {acts.map((a) => (
            <button
              key={a.id}
              class={'bo-act interactive' + (a.locked ? ' locked' : '')}
              onClick={() => {
                sfx.click();
                a.run();
              }}
            >
              <span class={'bo-act-ic c-' + a.color}>
                <Icon name={a.icon} size={22} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Anchor>
  );
}

function BuilderQueue({ s, t }: { s: GameState; t: number }) {
  const jobs = s.base.buildings.filter((b) => b.upgradeEndsAt !== null).sort((a, b) => a.upgradeEndsAt! - b.upgradeEndsAt!);
  const slots: preact.JSX.Element[] = [];
  for (let i = 0; i < Math.max(2, s.base.builders); i++) {
    if (i >= s.base.builders) {
      slots.push(
        <button key={'lock' + i} class="bo-bq locked interactive" onClick={() => openScreen('baseBuilders')}>
          <Lock size={14} />
          <span>Hire</span>
        </button>,
      );
      continue;
    }
    const job = jobs[i];
    if (job) {
      const free = canFinishFree(s, job, t);
      slots.push(
        <button
          key={'job' + i}
          class={'bo-bq busy interactive' + (free ? ' free' : '')}
          onClick={() => {
            sfx.click();
            if (free) doFreeFinish(job.uid);
            else focusBuilding({ uid: job.uid });
          }}
        >
          <Hammer size={14} />
          <span>{free ? 'FREE' : fmtDuration(remainingMs(job, t))}</span>
        </button>,
      );
    } else {
      slots.push(
        <button
          key={'idle' + i}
          class="bo-bq idle interactive"
          onClick={() => {
            sfx.click();
            const hq = s.base.buildings.find((b) => b.type === 'hq');
            const cand = hq && !upgradeBlock(s, hq) ? hq : s.base.buildings.find((b) => !upgradeBlock(s, b));
            if (cand) focusBuilding({ uid: cand.uid });
            else toast('Builder is idle: pick a building to upgrade', 'info');
          }}
        >
          <Hammer size={14} />
          <span>Idle</span>
        </button>,
      );
    }
  }
  return <div class="bo-builders">{slots}</div>;
}

export function BaseOverlay() {
  const s = useGame();
  const t = clock.value;
  const sel = selection.value;
  const far = zoomedOut.value;
  const busy = sceneBusy.value;
  const shown = shownCleared.value;
  void layoutVersion.value;
  const selUid = sel && sel.startsWith('b:') ? sel.slice(2) : null;
  const occupied = new Set(s.base.buildings.map((b) => b.plot));
  const next = DISTRICTS[shown];
  const idleMs = Math.min(IDLE_CAP_MS, Math.max(0, t - (s.heroes.campaign.idleClaimedAt ?? t)));
  const runnerOk = isUnlocked(s, 'runner');

  return (
    <div class={'bo-root' + (busy ? ' busy' : '')}>
      {s.base.buildings.map((b) => (
        <Anchor key={'b' + b.uid} k={'b:' + b.uid} class="bo-top">
          <TopMarker s={s} b={b} t={t} />
        </Anchor>
      ))}
      {!far &&
        s.base.buildings.map((b) =>
          b.level > 0 && b.type !== 'hq' ? (
            <Anchor key={'l' + b.uid} k={'bl:' + b.uid} class="bo-lv">
              <div class="bo-badge">{b.level}</div>
            </Anchor>
          ) : null,
        )}
      {s.base.buildings
        .filter((b) => b.type === 'hq')
        .map((b) => (
          <Anchor key="hqlv" k={'bl:' + b.uid} class="bo-lv">
            <div class="bo-badge hq">{b.level}</div>
          </Anchor>
        ))}
      {PLOTS.map((p) =>
        (p.kind === 'core' || p.kind === 'res') && !occupied.has(p.id) && p.district <= shown && plotHasBuildable(s, p.id) ? (
          <Anchor key={'p' + p.id} k={'p:' + p.id} class="bo-top">
            <button class={'bo-plot interactive ' + p.kind} onClick={() => openScreen('buildMenu', { plot: p.id })} aria-label="Build here">
              <Plus size={22} />
            </button>
          </Anchor>
        ) : null,
      )}
      {next && (
        <Anchor key={'d' + next.id} k={'d:' + next.id} class="bo-top">
          <button class="bo-district interactive" onClick={() => openScreen('campaign')}>
            <div class="bo-district-title">
              <Skull size={18} /> District {next.id}
            </div>
            <div class="bo-district-go">
              <Swords size={16} /> Attack
            </div>
          </button>
        </Anchor>
      )}
      <Anchor k="v:specops" class="bo-top">
        <button
          class={'bo-veh interactive' + (runnerOk ? '' : ' locked')}
          onClick={() => {
            if (runnerOk) openScreen('runnerLevels');
            else toast(`Special Ops: ${unlockHint('runner')}`, 'bad');
          }}
        >
          {runnerOk ? <Jeep size={20} /> : <Lock size={16} />}
          <span>Special Ops</span>
          {runnerOk && <span class="bo-veh-sub">Lv {s.runner.level}</span>}
        </button>
      </Anchor>
      <Anchor k="v:loot" class="bo-top">
        <button class={'bo-veh loot interactive' + (idleMs >= 10 * 60 * 1000 ? ' ready' : '')} onClick={() => openScreen('campaign')}>
          <Crate size={20} />
          <span>Loot Truck</span>
          <span class="bo-veh-sub">{idleMs >= IDLE_CAP_MS ? 'FULL' : fmtDuration(idleMs)}</span>
        </button>
      </Anchor>
      {selUid && !busy && <SelectionStrip s={s} uid={selUid} />}
      <BuilderQueue s={s} t={t} />
    </div>
  );
}
