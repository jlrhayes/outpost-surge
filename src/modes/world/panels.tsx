// OWNER: world agent. World overlay screens: radar board ('radar'), battle reports ('worldReports'),
// search ('worldSearch') and stamina ('worldStamina').
import { useEffect, useState } from 'preact/hooks';
import { game, mutate, useGame } from '../../core/store';
import { closeScreen, openScreen, toast } from '../../core/nav';
import { clock, now } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { useItem } from '../../systems/items';
import { itemDef } from '../../data/items';
import { ItemIcon } from '../../ui/components/ItemIcon';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { Bar, Btn, Countdown, Modal, Screen, Tabs } from '../../ui/components/common';
import { Icon } from '../../ui/components/Icon';
import { startBattle } from '../../systems/battle';
import * as D from '../../data/world';
import {
  settleStamina,
  claimRadarMission,
  coordLabel,
  entityById,
  nextStaminaAt,
  radarMissionCount,
  scaleReward,
  searchNearest,
  staminaMax,
  staminaNow,
  tileCenter,
  type RadarMission,
  type SearchKind,
  type WorldReport,
} from '../../systems/world';
import { requestCam } from './bus';
import { hasScreen, RewardList, showRewards, WIcon } from './parts';

/** Close overlays, pan to an entity and open its panel. */
export function goToEntity(id: string): void {
  const e = entityById(game, id);
  if (!e) {
    toast('That target is gone', 'bad');
    return;
  }
  const c = tileCenter(e.tx, e.ty);
  closeScreen();
  requestCam({ x: c.x, z: c.z, sheet: true });
  openScreen('worldEntity', { id });
}

// ------------------------------------------------------------------ radar

const RADAR_ICONS: Record<D.RadarKind, string> = { rescue: 'survivor', cache: 'crate', horde: 'zombie', elite: 'zombie', dig: 'dig' };

export function RadarScreen(props: { screenKey: number }) {
  const s = useGame();
  void clock.value;
  const r = s.world.radar;
  if (!isUnlocked(s, 'radar')) {
    return (
      <Screen title="Radar">
        <div class="wm-locked-card">
          <WIcon name="lock" size={40} />
          <div class="wm-locked-title">Radar offline</div>
          <div class="wm-dim">{unlockHint('radar')}</div>
        </div>
      </Screen>
    );
  }
  const done = r.missions.filter((m) => m.status === 'done');
  const claimAll = () => {
    const total: Record<string, number> = {};
    const items: Record<string, number> = {};
    mutate((st) => {
      for (const m of [...st.world.radar.missions]) {
        const got = claimRadarMission(st, m.id);
        if (!got) continue;
        for (const [k, v] of Object.entries(got.currencies ?? {})) total[k] = (total[k] ?? 0) + (v ?? 0);
        for (const [k, v] of Object.entries(got.items ?? {})) items[k] = (items[k] ?? 0) + (v ?? 0);
      }
    });
    showRewards('Radar rewards', { currencies: total, items });
  };
  const toNext = r.completed % D.RADAR_MISSIONS_PER_LEVEL;
  const order: Record<RadarMission['status'], number> = { done: 0, open: 1, claimed: 2 };
  const list = [...r.missions].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <Screen
      title="Radar"
      footer={
        done.length > 1 ? (
          <Btn color="yellow" onClick={claimAll}>
            Claim all ({done.length})
          </Btn>
        ) : undefined
      }
    >
      <div class="wm-radar-head card">
        <WIcon name="radar" size={46} />
        <div class="wm-radar-head-info">
          <div class="wm-radar-level">Radar Lv {r.level}</div>
          <Bar value={toNext} max={D.RADAR_MISSIONS_PER_LEVEL} label={`${toNext}/${D.RADAR_MISSIONS_PER_LEVEL} to next level`} />
          <div class="wm-dim small">
            {radarMissionCount(s)} missions per scan · new scan in <Countdown endsAt={r.refreshAt} />
          </div>
        </div>
      </div>
      {list.length === 0 && <div class="wm-dim wm-center">Scanning the wasteland...</div>}
      {list.map((m) => (
        <MissionCard key={m.id} m={m} />
      ))}
    </Screen>
  );
}

function MissionCard(props: { m: RadarMission }) {
  const { m } = props;
  const info = D.RADAR_INFO[m.kind];
  const claim = () => {
    let got: ReturnType<typeof claimRadarMission> = null;
    mutate((st) => {
      got = claimRadarMission(st, m.id);
    });
    if (got) showRewards(info.title, got);
  };
  const levelTag = m.kind === 'horde' || m.kind === 'elite' ? `Lv ${m.level}` : null;
  return (
    <div class={'wm-mission card ' + m.status}>
      <div class="wm-mission-icon">
        <WIcon name={RADAR_ICONS[m.kind]} size={34} />
        {m.kind === 'elite' && <span class="wm-mission-elite">ELITE</span>}
      </div>
      <div class="wm-mission-main">
        <div class="wm-mission-title">
          {info.title} {levelTag && <span class="wm-tag">{levelTag}</span>}
        </div>
        <div class="wm-stars">{'★'.repeat(m.stars)}<span class="wm-stars-off">{'★'.repeat(5 - m.stars)}</span></div>
        <RewardList reward={m.status === 'done' ? scaleReward(m.reward, m.mult) : m.reward} />
        {m.mult > 1 && m.status !== 'open' && <div class="wm-lucky">Lucky dig x{m.mult}!</div>}
      </div>
      <div class="wm-mission-act">
        {m.status === 'done' && (
          <Btn color="yellow" small onClick={claim}>
            Claim
          </Btn>
        )}
        {m.status === 'open' && m.entityId && (
          <Btn color="blue" small onClick={() => goToEntity(m.entityId!)}>
            Go
          </Btn>
        )}
        {m.status === 'claimed' && <span class="wm-done">Done</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ reports

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ReportsScreen(props: { screenKey: number }) {
  const s = useGame();
  const [open, setOpen] = useState<string | null>(s.world.reports[0]?.id ?? null);
  useEffect(() => {
    if (s.world.reports.some((r) => !r.read))
      mutate((st) => {
        for (const r of st.world.reports) r.read = true;
      });
  }, [s.world.reports.length]);
  return (
    <Screen title="Reports">
      {s.world.reports.length === 0 && (
        <div class="wm-locked-card">
          <WIcon name="reports" size={40} />
          <div class="wm-dim">No reports yet. Attack a horde or gather resources to get one.</div>
        </div>
      )}
      {s.world.reports.map((r) => (
        <ReportCard key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
      ))}
    </Screen>
  );
}

function ReportCard(props: { r: WorldReport; open: boolean; onToggle: () => void }) {
  const { r } = props;
  const t = now();
  const fight = r.kind === 'horde' || r.kind === 'rival';
  const badge = fight ? (r.win ? 'Victory' : 'Defeat') : r.kind === 'gather' ? 'Gathered' : 'Treasure';
  const cls = fight ? (r.win ? 'win' : 'lose') : 'neutral';
  const replay = () =>
    startBattle({
      title: `Replay: ${r.title}`,
      attackers: JSON.parse(JSON.stringify(r.attackers)),
      defenders: JSON.parse(JSON.stringify(r.defenders)),
      seed: r.seed,
      arena: r.kind === 'rival' ? 'city' : 'wasteland',
      returnTo: 'world',
      onFinish: () => {},
    });
  return (
    <div class={'wm-report card ' + cls}>
      <button class="wm-report-head" onClick={props.onToggle}>
        <span class={'wm-report-badge ' + cls}>{badge}</span>
        <span class="wm-report-title">{r.title}</span>
        <span class="wm-dim small">{ago(t - r.at)}</span>
      </button>
      {props.open && (
        <div class="wm-report-body">
          {fight && (
            <div class="wm-report-grid">
              <div>
                <div class="wm-dim small">Squad {r.squadId}</div>
                <b>
                  <Icon name="power" size={14} /> {r.power > 0 ? fmt(r.power) : '—'}
                </b>
              </div>
              <div>
                <div class="wm-dim small">Enemy</div>
                <b>
                  <Icon name="power" size={14} /> {fmt(r.enemyPower)}
                </b>
              </div>
              <div>
                <div class="wm-dim small">Wounded</div>
                <b class={r.wounded ? 'bad' : ''}>
                  <Icon name="troops" size={14} /> {fmt(r.wounded)} / {fmt(r.troops)}
                </b>
              </div>
              {r.kills > 0 && (
                <div>
                  <div class="wm-dim small">Zombies killed</div>
                  <b>{fmt(r.kills)}</b>
                </div>
              )}
            </div>
          )}
          <div class="wm-section-title">{fight ? 'Loot' : 'Reward'}</div>
          <RewardList reward={r.loot} />
          {r.note && <div class="wm-info">{r.note}</div>}
          {fight && (
            !r.win && <div class="wm-dim small">Train more soldiers or strengthen your heroes, then try again.</div>
          )}
          {fight && r.attackers.length > 0 && r.defenders.length > 0 && (
            <div class="wm-actions">
              <Btn color="blue" small onClick={replay}>
                Watch replay
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ search

type SearchTab = SearchKind;

export function SearchModal(props: { screenKey: number }) {
  const s = useGame();
  const [tab, setTab] = useState<SearchTab>('horde');
  const hordeMax = Math.min(D.MAX_HORDE_LEVEL, s.world.maxHordeLevel + 1);
  const max = tab === 'horde' ? hordeMax : D.RES_MAX_LEVEL;
  const [lv, setLv] = useState<Record<SearchTab, number>>({ horde: hordeMax, food: 1, iron: 1, gold: 1 });
  const level = Math.max(1, Math.min(max, lv[tab]));
  const set = (n: number) => setLv({ ...lv, [tab]: Math.max(1, Math.min(max, n)) });
  const go = () => {
    let id: string | null = null;
    mutate((st) => {
      id = searchNearest(st, tab, level)?.id ?? null;
    });
    if (!id) {
      toast('Nothing found nearby', 'bad');
      return;
    }
    closeScreen(props.screenKey);
    goToEntityNoClose(id);
  };
  return (
    <Modal title="Search the map" onClose={() => closeScreen(props.screenKey)}>
      <Tabs<SearchTab>
        tabs={[
          { id: 'horde', label: 'Zombies' },
          { id: 'food', label: 'Food' },
          { id: 'iron', label: 'Iron' },
          { id: 'gold', label: 'Gold' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div class="wm-search">
        <div class="wm-search-icon">{tab === 'horde' ? <WIcon name="zombie" size={52} /> : <Icon name={tab} size={52} />}</div>
        <div class="wm-search-label">{tab === 'horde' ? D.HORDE_NAMES.normal : D.RES_NAMES[tab]}</div>
        <div class="wm-stepper">
          <Btn color="gray" small disabled={level <= 1} onClick={() => set(level - 1)}>
            −
          </Btn>
          <div class="wm-stepper-val">Lv {level}</div>
          <Btn color="gray" small disabled={level >= max} onClick={() => set(level + 1)}>
            +
          </Btn>
        </div>
        <input
          class="wm-slider interactive"
          type="range"
          min={1}
          max={max}
          value={level}
          onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
        />
        {tab === 'horde' && <div class="wm-dim small">You can attack up to Lv {hordeMax}.</div>}
      </div>
      <div class="wm-actions">
        <Btn color="gray" onClick={() => closeScreen(props.screenKey)}>
          Cancel
        </Btn>
        <Btn color="blue" onClick={go}>
          <WIcon name="search" size={18} /> Search
        </Btn>
      </div>
    </Modal>
  );
}

function goToEntityNoClose(id: string): void {
  const e = entityById(game, id);
  if (!e) return;
  const c = tileCenter(e.tx, e.ty);
  requestCam({ x: c.x, z: c.z, sheet: true });
  openScreen('worldEntity', { id });
  toast(`Found at ${coordLabel(e.tx, e.ty)}`, 'info');
}

// ------------------------------------------------------------------ stamina

export function StaminaModal(props: { screenKey: number }) {
  const s = useGame();
  const t = clock.value;
  const cur = staminaNow(s, t);
  const max = staminaMax(s);
  const next = nextStaminaAt(s, t);
  const potions = s.items.stamina_potion ?? 0;
  const fullIn = cur < max ? (max - cur - 1) * D.STAMINA_REGEN_MS + (next ? next - t : 0) : 0;
  const potion = itemDef('stamina_potion');
  const use = () => {
    // settle regen first so the potion never eats pending regeneration, then use it via the bag system
    mutate((st) => void settleStamina(st, now()));
    useItem('stamina_potion', 1);
  };
  return (
    <Modal title="Stamina" onClose={() => closeScreen(props.screenKey)}>
      <div class="wm-stamina-big">
        <Icon name="stamina" size={40} />
        <span>
          {cur}
          <small>/{max}</small>
        </span>
      </div>
      <Bar value={cur} max={max} color="linear-gradient(#ffb070,#ff7a3c)" height={16} />
      <div class="wm-dim small wm-center">
        {cur >= max ? 'Full - regeneration pauses at the cap.' : `+1 every ${fmtDuration(D.STAMINA_REGEN_MS)} · full in ${fmtDuration(fullIn)}`}
      </div>
      <div class="wm-dim small wm-center">
        Attacks cost {D.STAMINA_COST.normal} (elites &amp; bosses {D.STAMINA_COST.elite}).
      </div>
      <div class="wm-potion card">
        <ItemIcon id="stamina_potion" size={40} />
        <div class="wm-potion-main">
          <b>{potion.name}</b>
          <div class="wm-dim small">
            {potion.desc} Owned: {potions}
          </div>
        </div>
        <Btn color="green" small disabled={potions <= 0} onClick={use}>
          Use
        </Btn>
      </div>
      {hasScreen('bag') && (
        <div class="wm-actions">
          <Btn color="gray" small onClick={() => openScreen('bag')}>
            Open Bag
          </Btn>
        </div>
      )}
    </Modal>
  );
}
