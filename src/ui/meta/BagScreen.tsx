// OWNER: meta agent. 'bag' screen: inventory by category; open/use items with a quantity picker.
import { useState } from 'preact/hooks';
import { useGame, type GameState } from '../../core/store';
import { closeAllScreens, focusBuilding, openScreen, route, goTo } from '../../core/nav';
import { now } from '../../core/tick';
import type { ItemId } from '../../core/types';
import { itemDef, type ItemCategory } from '../../data/items';
import { troopTier } from '../../data/troops';
import { TECH_BY_ID } from '../../data/research';
import { BUILDING_LABEL } from '../../data/quests';
import { useItem } from '../../systems/items';
import { Btn, Screen, Tabs } from '../components/common';
import { Icon } from '../components/Icon';
import { ItemTile } from '../components/ItemIcon';
import { QuantityPicker } from '../components/QuantityPicker';
import { TimerBar } from '../components/TimerBar';
import { openTrainingSpeedup, openHealingSpeedup, openResearchSpeedup } from './timers';

const TABS: { id: ItemCategory; label: string; icon: string }[] = [
  { id: 'resources', label: 'Resources', icon: 'crate_food' },
  { id: 'speedups', label: 'Speed-Ups', icon: 'speedup' },
  { id: 'hero', label: 'Hero', icon: 'helmet' },
  { id: 'other', label: 'Other', icon: 'gift' },
];

function owned(s: GameState, cat: ItemCategory): ItemId[] {
  return Object.entries(s.items)
    .filter(([id, n]) => (n ?? 0) > 0 && itemDef(id).category === cat)
    .map(([id]) => id)
    .sort((a, b) => itemDef(a).sort - itemDef(b).sort);
}

/** True if the bag has something that can be opened right now (bag red dot). */
export function bagHasOpenable(s: GameState): boolean {
  return Object.entries(s.items).some(([id, n]) => (n ?? 0) > 0 && !!itemDef(id).use);
}

export function BagScreen(props: { screenKey: number }) {
  const s = useGame();
  const [tab, setTab] = useState<ItemCategory>('resources');
  const [sel, setSel] = useState<ItemId | null>(null);
  const [qty, setQty] = useState(1);
  const list = owned(s, tab);
  const selected = sel && list.includes(sel) ? sel : list[0] ?? null;
  const def = selected ? itemDef(selected) : null;
  const have = selected ? s.items[selected] ?? 0 : 0;
  const q = Math.max(1, Math.min(qty, have));

  return (
    <Screen title="Bag" icon="bag" class="bag-screen">
      <Tabs
        tabs={TABS.map((t) => ({ ...t, badge: t.id !== 'speedups' && owned(s, t.id).some((id) => !!itemDef(id).use) }))}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSel(null);
          setQty(1);
        }}
      />
      {list.length === 0 ? (
        <div class="empty-state">
          <Icon name="bag" size={64} />
          <div>Nothing here yet.</div>
          <div class="dim-text">Win battles, clear quests and finish daily tasks to earn items.</div>
        </div>
      ) : (
        <div class="bag-grid">
          {list.map((id) => (
            <ItemTile
              key={id}
              id={id}
              count={s.items[id] ?? 0}
              size={68}
              selected={id === selected}
              onClick={() => {
                setSel(id);
                setQty(1);
              }}
            />
          ))}
        </div>
      )}

      {def && selected && (
        <div class="bag-detail" key={selected}>
          <div class="bag-detail-head">
            <ItemTile id={selected} size={60} />
            <div class="bag-detail-info">
              <div class={'bag-detail-name rarity-text-' + def.rarity}>{def.name}</div>
              <div class="bag-detail-owned">Owned: {have.toLocaleString('en-US')}</div>
              <div class="bag-detail-desc">{def.desc}</div>
            </div>
          </div>
          {def.use && (
            <div class="bag-detail-use">
              {have > 1 && <QuantityPicker value={q} max={have} onChange={setQty} />}
              <Btn
                color="green"
                big
                onClick={() => {
                  if (useItem(selected, q)) setQty(1);
                }}
              >
                {def.use.label ?? 'Use'} {q > 1 ? `×${q}` : ''}
              </Btn>
            </div>
          )}
          {def.goto && (
            <div class="bag-detail-use">
              <Btn
                color="blue"
                big
                icon="arrow_right"
                onClick={() => {
                  if (route.value.mode !== 'base') goTo('base');
                  else closeAllScreens();
                  openScreen(def.goto!.screen);
                }}
              >
                {def.goto.label}
              </Btn>
            </div>
          )}
          {def.category === 'speedups' && <ActiveTimers />}
        </div>
      )}
    </Screen>
  );
}

/** Running timers the player can apply speed-ups to. */
function ActiveTimers() {
  const s = useGame();
  const t = now();
  const rows: preact.JSX.Element[] = [];
  for (const j of s.meta.training) {
    rows.push(
      <TimerBar
        key={'tr' + j.barracksUid}
        icon="troops"
        label={`Training ${j.count} ${troopTier(j.tier).name}s (T${j.tier})`}
        startedAt={j.startedAt}
        endsAt={j.endsAt}
        onSpeedup={() => openTrainingSpeedup(j.barracksUid)}
      />,
    );
  }
  if (s.meta.researchJob) {
    const j = s.meta.researchJob;
    rows.push(
      <TimerBar
        key="rs"
        icon="flask"
        label={`Research: ${TECH_BY_ID[j.techId]?.name ?? j.techId}`}
        startedAt={j.startedAt}
        endsAt={j.endsAt}
        onSpeedup={openResearchSpeedup}
      />,
    );
  }
  if (s.meta.healing) {
    const j = s.meta.healing;
    rows.push(<TimerBar key="hl" icon="hospital" label="Healing soldiers" startedAt={j.startedAt} endsAt={j.endsAt} onSpeedup={openHealingSpeedup} />);
  }
  for (const b of s.base.buildings) {
    if (b.upgradeEndsAt && b.upgradeEndsAt > t) {
      rows.push(
        <TimerBar
          key={'b' + b.uid}
          icon="hammer"
          label={`${b.level === 0 ? 'Building' : 'Upgrading'} ${BUILDING_LABEL[b.type] ?? b.type}${b.level ? ` to Lv ${b.level + 1}` : ''}`}
          startedAt={b.upgradeStartedAt ?? t}
          endsAt={b.upgradeEndsAt}
          speedupLabel="Go"
          onSpeedup={() => focusBuilding({ uid: b.uid, openPanel: true })}
        />,
      );
    }
  }
  return (
    <div class="bag-timers">
      <div class="section-title">
        <span>Active timers</span>
      </div>
      {rows.length ? rows : <div class="dim-text center">No timers running right now.</div>}
    </div>
  );
}
