// OWNER: heroes agent. 'formation' screen: 2 front + 3 back slots, squad tabs, same-type bonus, squad power.
import { useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt } from '../../core/format';
import { UNLOCKS, unlockHint } from '../../core/unlocks';
import type { HeroType } from '../../core/types';
import { Btn, Screen, Tabs } from '../components/common';
import { Icon } from '../components/Icon';
import { heroDef, TYPE_LABEL } from '../../data/heroes';
import {
  MAX_SQUADS,
  assignHero,
  autoFillSquad,
  getSquad,
  heroPower,
  heroSquadOf,
  squadPower,
  squadTroops,
  squadTypes,
  typeBonusPct,
  unlockedSquadIds,
} from '../../systems/heroes';
import { HeroPortrait } from './HeroPortrait';
import { HeroCard, PowerTag } from './parts';
import { ItemIcon, Stars, TypeIcon } from './icons';

type Filter = 'all' | HeroType;

function Slot(props: { squadId: number; slot: number; heroId: string | null; selected: boolean; onTap: () => void }) {
  const s = useGame();
  const h = props.heroId ? s.heroes.owned[props.heroId] : undefined;
  const d = props.heroId ? heroDef(props.heroId) : undefined;
  return (
    <button class={`f-slot ${props.selected ? 'selected' : ''} ${h ? 'filled' : 'empty'}`} onClick={props.onTap}>
      {h && d ? (
        <>
          <HeroPortrait heroId={d.id} size={74} frame />
          <span class="fs-type">
            <TypeIcon type={d.type} size={16} />
          </span>
          <span class="fs-lv">Lv{h.level}</span>
          <span class="fs-stars">
            <Stars n={h.stars} size={8} />
          </span>
        </>
      ) : (
        <span class="fs-plus">+</span>
      )}
      <span class="fs-label">{props.slot <= 1 ? 'FRONT' : 'BACK'}</span>
    </button>
  );
}

export function FormationScreen(props: { squadId?: number }) {
  const s = useGame();
  const unlocked = unlockedSquadIds(s);
  const [squadId, setSquadId] = useState(props.squadId && unlocked.includes(props.squadId) ? props.squadId : 1);
  const [sel, setSel] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const sq = getSquad(s, squadId);
  const slots = sq?.heroes ?? [null, null, null, null, null];
  const types = sq ? squadTypes(s, sq) : [];
  const bonus = typeBonusPct(types);
  const counts: Record<HeroType, number> = { tank: 0, aircraft: 0, missile: 0 };
  for (const t of types) counts[t]++;
  const power = squadPower(s, squadId);
  const troops = squadTroops(s, squadId);

  const tapSlot = (i: number) => {
    sfx.click();
    setSel(sel === i ? null : i);
  };

  const tapHero = (id: string) => {
    const inThis = slots.indexOf(id);
    if (inThis >= 0 && sel === null) {
      // Tapping a deployed hero removes it.
      assignHero(squadId, inThis, null);
      sfx.click();
      return;
    }
    let target = sel;
    if (target === null) {
      target = slots.findIndex((x) => !x);
      if (target < 0) {
        toast('Squad is full: tap a slot to replace', 'info');
        return;
      }
    }
    const other = heroSquadOf(s, id);
    assignHero(squadId, target, id);
    if (other && other !== squadId) toast(`${heroDef(id)?.callsign} moved from Squad ${other}`, 'info');
    sfx.click();
    setSel(null);
  };

  const heroes = Object.values(s.heroes.owned)
    .filter((h) => {
      const d = heroDef(h.id);
      return d && (filter === 'all' || d.type === filter);
    })
    .sort((a, b) => heroPower(b) - heroPower(a));

  const squadTabs = Array.from({ length: MAX_SQUADS }, (_, i) => i + 1);

  return (
    <Screen
      title="Formation"
      class="formation-screen"
      footer={
        <>
          <Btn
            color="gray"
            onClick={() => {
              for (let i = 0; i < 5; i++) if (slots[i]) assignHero(squadId, i, null);
              setSel(null);
            }}
          >
            Clear
          </Btn>
          <Btn
            color="blue"
            onClick={() => {
              autoFillSquad(squadId);
              setSel(null);
              sfx.upgrade();
            }}
          >
            Quick Deploy
          </Btn>
        </>
      }
    >
      <div class="squad-tabs">
        {squadTabs.map((id) => {
          const open = unlocked.includes(id);
          return (
            <button
              key={id}
              class={`squad-tab ${id === squadId ? 'active' : ''} ${open ? '' : 'locked'}`}
              onClick={() => {
                sfx.click();
                if (!open) {
                  toast(unlockHint(`squad${id}` as keyof typeof UNLOCKS), 'bad');
                  return;
                }
                setSquadId(id);
                setSel(null);
              }}
            >
              {!open && <ItemIcon id="lock" size={13} />}
              Squad {id}
            </button>
          );
        })}
      </div>

      <div class="field">
        <div class="field-enemy">▲ ENEMY ▲</div>
        <div class="field-row front">
          {[0, 1].map((i) => (
            <Slot key={i} squadId={squadId} slot={i} heroId={slots[i] ?? null} selected={sel === i} onTap={() => tapSlot(i)} />
          ))}
        </div>
        <div class="field-row back">
          {[2, 3, 4].map((i) => (
            <Slot key={i} squadId={squadId} slot={i} heroId={slots[i] ?? null} selected={sel === i} onTap={() => tapSlot(i)} />
          ))}
        </div>
        {sel !== null && slots[sel] && (
          <div class="field-actions">
            <Btn
              small
              color="red"
              onClick={() => {
                assignHero(squadId, sel, null);
                setSel(null);
              }}
            >
              Remove
            </Btn>
          </div>
        )}
      </div>

      <div class="squad-info card">
        <div class="si-left">
          <div class="dim-label">Squad power</div>
          <PowerTag value={power} big />
          <div class="dim-label">
            <Icon name="troops" size={13} /> Soldiers led: <b>{fmt(troops)}</b>
          </div>
        </div>
        <div class="si-right">
          <div class={`bonus-pill ${bonus > 0 ? 'on' : ''}`}>Type bonus +{bonus}%</div>
          <div class="type-counts">
            {(['tank', 'aircraft', 'missile'] as HeroType[]).map((t) => (
              <span key={t} class={counts[t] ? '' : 'faded'}>
                <TypeIcon type={t} size={16} />×{counts[t]}
              </span>
            ))}
          </div>
          <div class="bonus-legend">3 same +5% · 3+2 +10% · 4 +15% · 5 +20%</div>
        </div>
      </div>

      <div class="dim-label center">{sel !== null ? `Choose a hero for the ${sel <= 1 ? 'front' : 'back'} slot` : 'Tap a hero to deploy · tap a deployed hero to remove'}</div>

      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'tank', label: TYPE_LABEL.tank },
          { id: 'aircraft', label: 'Air' },
          { id: 'missile', label: TYPE_LABEL.missile },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div class="hero-grid small">
        {heroes.map((h) => {
          const where = heroSquadOf(s, h.id);
          return (
            <HeroCard
              key={h.id}
              heroId={h.id}
              hero={h}
              size={70}
              compact
              selected={where === squadId}
              badge={where ? (where === squadId ? '✓' : `S${where}`) : undefined}
              onClick={() => tapHero(h.id)}
            />
          );
        })}
      </div>
    </Screen>
  );
}
