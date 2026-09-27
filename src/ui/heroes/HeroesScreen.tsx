// OWNER: heroes agent. 'heroes' screen: roster grid with type filters, power sort and red dots.
import { useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { openScreen } from '../../core/nav';
import type { HeroType } from '../../core/types';
import { Btn, Screen, Tabs } from '../components/common';
import { HEROES, heroDef, RARITY_ORDER } from '../../data/heroes';
import { allHeroesPower, heroHasUpgrade, heroPower, heroSquadOf } from '../../systems/heroes';
import { HeroCard, PowerTag } from './parts';
import { TypeIcon } from './icons';

type Filter = 'all' | HeroType;

export function HeroesScreen() {
  const s = useGame();
  const [filter, setFilter] = useState<Filter>('all');
  const match = (t: HeroType) => filter === 'all' || filter === t;
  const owned = Object.values(s.heroes.owned)
    .filter((h) => heroDef(h.id) && match(heroDef(h.id)!.type))
    .map((h) => ({ h, p: heroPower(h) }))
    .sort((a, b) => b.p - a.p);
  const unowned = HEROES.filter((d) => !s.heroes.owned[d.id] && match(d.type)).sort(
    (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || (s.heroes.pendingShards[b.id] ?? 0) - (s.heroes.pendingShards[a.id] ?? 0),
  );
  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tank', label: 'Tank' },
    { id: 'aircraft', label: 'Air' },
    { id: 'missile', label: 'Missile' },
  ];
  return (
    <Screen
      title="Heroes"
      class="heroes-screen"
      footer={
        <>
          <Btn color="blue" onClick={() => openScreen('formation')}>
            Formation
          </Btn>
          <Btn color="purple" onClick={() => openScreen('recruit')}>
            Recruit
          </Btn>
        </>
      }
    >
      <div class="roster-head">
        <div>
          <div class="dim-label">Heroes owned</div>
          <div class="roster-count">
            {Object.keys(s.heroes.owned).length}
            <span class="dim-label"> / {HEROES.length}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div class="dim-label">Total hero power</div>
          <PowerTag value={allHeroesPower(s)} big />
        </div>
      </div>
      <Tabs tabs={tabs} value={filter} onChange={setFilter} />
      <div class="hero-grid">
        {owned.map(({ h }) => {
          const sq = heroSquadOf(s, h.id);
          return (
            <HeroCard
              key={h.id}
              heroId={h.id}
              hero={h}
              dot={heroHasUpgrade(s, h)}
              badge={sq ? `Squad ${sq}` : undefined}
              onClick={() => openScreen('heroDetail', { heroId: h.id })}
            />
          );
        })}
      </div>
      {owned.length === 0 && <div class="empty-note">No {filter === 'all' ? '' : filter} heroes yet. Recruit some!</div>}
      {unowned.length > 0 && (
        <>
          <div class="section-title">Not recruited</div>
          <div class="hero-grid">
            {unowned.map((d) => (
              <HeroCard key={d.id} heroId={d.id} pendingShards={s.heroes.pendingShards[d.id]} onClick={() => openScreen('heroDetail', { heroId: d.id })} />
            ))}
          </div>
        </>
      )}
      <div class="counter-hint">
        <TypeIcon type="tank" size={16} /> Tank beats <TypeIcon type="missile" size={16} /> Missile beats <TypeIcon type="aircraft" size={16} /> Aircraft beats{' '}
        <TypeIcon type="tank" size={16} /> Tank
        <div class="dim-label">Counter: +20% damage dealt, −20% damage taken</div>
      </div>
    </Screen>
  );
}
