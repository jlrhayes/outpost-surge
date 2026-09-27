// OWNER: heroes agent. 'campaign' screen: next district card, enemy preview, recommended vs squad power,
// Battle button, upcoming districts and the idle loot truck.
import { useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { openScreen, toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { clock } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { Bar, Btn, Screen, SectionTitle } from '../components/common';
import { Icon } from '../components/Icon';
import { ZOMBIE_KINDS, IDLE_CAP_HOURS } from '../../data/campaign';
import { TYPE_LABEL } from '../../data/heroes';
import { getSquad, squadBusy, squadPower, squadReady, squadTypes, unlockedSquadIds } from '../../systems/heroes';
import { COUNTERS, weakTo } from '../../systems/battle';
import {
  claimIdleLoot,
  counterHint,
  districtBattleBlocker,
  districtInfo,
  districtsClearedCount,
  idleLoot,
  idleRates,
  startDistrictBattle,
} from '../../systems/campaign';
import type { BattleUnit } from '../../systems/heroes';
import type { HeroType, Reward } from '../../core/types';
import { ZombiePortrait } from './HeroPortrait';
import { ItemIcon, TYPE_COLOR, TypeIcon } from './icons';
import { PowerTag, RewardList } from './parts';
import { RewardList as RewardTiles } from '../components/RewardList';

/** Opens meta's shared 'rewards' popup (display only: the reward was already granted). */
function showRewards(title: string, reward: Reward): void {
  openScreen('rewards', { title, reward });
}

function difficulty(ratio: number): { label: string; cls: string } {
  if (ratio >= 1.3) return { label: 'Easy', cls: 'easy' };
  if (ratio >= 1.0) return { label: 'Even', cls: 'even' };
  if (ratio >= 0.8) return { label: 'Hard', cls: 'hard' };
  return { label: 'Deadly', cls: 'deadly' };
}

function EnemyChip(props: { e: BattleUnit }) {
  const e = props.e;
  const kind = Object.values(ZOMBIE_KINDS).find((k) => k.model === e.model);
  const t = e.ctype;
  return (
    <div
      class={`enemy-chip ${e.model === 'zombieBoss' ? 'boss' : ''} ${t ? 'typed type-' + t : ''}`}
      title={t ? `${TYPE_LABEL[t]} type · ${counterHint(t)}${kind ? ' · ' + kind.blurb : ''}` : kind?.blurb}
    >
      <ZombiePortrait model={e.model} size={e.model === 'zombieBoss' ? 64 : 48} />
      {t && (
        <span class="ec-type">
          <TypeIcon type={t} size={e.model === 'zombieBoss' ? 22 : 18} />
        </span>
      )}
      <div class="ec-name">{e.name}</div>
      {t && (
        <div class="ec-weak" style={{ color: TYPE_COLOR[weakTo(t)] }}>
          {counterHint(t)}
        </div>
      )}
      {kind && kind.count > 1 && <div class="ec-count">×{kind.count}</div>}
    </div>
  );
}

/** One line per enemy type: how many of the squad's heroes counter it (and are countered by it). */
function CounterHint(props: { types: HeroType[]; squad: HeroType[] }) {
  if (!props.types.length) return null;
  return (
    <div class="dc-counter">
      {props.types.map((t) => {
        const good = props.squad.filter((x) => x === weakTo(t)).length;
        const bad = props.squad.filter((x) => COUNTERS[t] === x).length;
        return (
          <span key={t}>
            <TypeIcon type={t} size={16} /> {TYPE_LABEL[t]} enemies: weak to <b style={{ color: TYPE_COLOR[weakTo(t)] }}>{TYPE_LABEL[weakTo(t)]}</b>
            {' · '}
            {good > 0 ? <span class="ok">{good} of your heroes counter them</span> : <span class="bad">none of your heroes counter them</span>}
            {bad > 0 && <span class="bad"> · {bad} of yours are weak to them</span>}
          </span>
        );
      })}
    </div>
  );
}

function LootTruck() {
  const s = useGame();
  const t = clock.value;
  const cleared = districtsClearedCount(s);
  const loot = idleLoot(s, t);
  const rates = idleRates(s);
  const has = Object.keys(loot.reward.currencies ?? {}).length > 0;
  return (
    <div class="truck card">
      <div class="truck-head">
        <ItemIcon id="truck" size={34} />
        <div style={{ flex: 1 }}>
          <div class="truck-title">Loot Truck</div>
          <div class="dim-label">
            {cleared > 0 ? (
              <>
                Hauls loot from cleared districts · <Icon name="food" size={12} />
                {fmt(rates.food)} <Icon name="iron" size={12} />
                {fmt(rates.iron)} <Icon name="heroExp" size={12} />
                {fmt(rates.heroExp)}
                {rates.gold > 0 && (
                  <>
                    {' '}
                    <Icon name="gold" size={12} />
                    {fmt(rates.gold)}
                  </>
                )}{' '}
                /h
              </>
            ) : (
              'Clear District 1 to start the loot truck.'
            )}
          </div>
        </div>
      </div>
      {cleared > 0 && (
        <>
          <Bar
            value={loot.hours}
            max={IDLE_CAP_HOURS}
            color={loot.capped ? 'linear-gradient(#ffb070,#ff6a1a)' : 'linear-gradient(#ffe070,#f0a800)'}
            label={loot.capped ? 'FULL' : `${fmtDuration(loot.hours * 3600e3)} / ${IDLE_CAP_HOURS}h · full in ${fmtDuration(loot.fullAt - t)}`}
            height={16}
          />
          <div class="truck-foot">
            <RewardList reward={loot.reward} size={18} />
            <Btn
              color="yellow"
              small
              disabled={!has}
              onClick={() => {
                const r = claimIdleLoot();
                if (r) {
                  sfx.reward();
                  showRewards('Loot Truck', r);
                } else toast('The truck is empty', 'info');
              }}
            >
              Claim
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

export function CampaignScreen() {
  const s = useGame();
  const squads = unlockedSquadIds(s).filter((id) => squadReady(s, id));
  // Prefer a squad that is at home (not out on a world march).
  const [picked, setSquadId] = useState<number | null>(null);
  const squadId = picked ?? squads.find((id) => !squadBusy(s, id)) ?? squads[0] ?? 1;
  const busy = squadBusy(s, squadId);
  const blocker = districtBattleBlocker(s, squadId);
  const sq = getSquad(s, squadId);
  const myTypes = sq ? squadTypes(s, sq) : [];
  const stage = s.heroes.campaign.stage;
  const info = districtInfo(stage);
  const power = squadPower(s, squadId);
  const ratio = info.recommended > 0 ? power / info.recommended : 1;
  const diff = difficulty(ratio);
  const front = info.enemies.filter((e) => e.slot <= 1);
  const back = info.enemies.filter((e) => e.slot > 1);
  const upcoming = [1, 2, 3, 4].map((i) => districtInfo(stage + i));

  return (
    <Screen title="Districts" class="campaign-screen">
      <div class="camp-progress">
        <div>
          <div class="dim-label">Districts cleared</div>
          <div class="camp-cleared">{stage - 1}</div>
        </div>
        <div class="camp-next-boss">
          <div class="dim-label">Next boss</div>
          <div>District {Math.ceil(stage / 5) * 5}</div>
        </div>
      </div>

      <div class={`district-card arena-${info.arena} ${info.boss ? 'boss' : ''}`}>
        <div class="dc-head">
          <div class="dc-num">
            DISTRICT <b>{stage}</b>
          </div>
          {info.boss && <div class="dc-boss">BOSS</div>}
        </div>
        <div class="dc-name">{info.name}</div>
        {info.boss && <div class="dc-bossname">{info.bossName} has taken over this block!</div>}
        <div class="dc-enemies">
          <div class="dc-row back">
            {back.map((e) => (
              <EnemyChip key={e.uid} e={e} />
            ))}
          </div>
          <div class="dc-row front">
            {front.map((e) => (
              <EnemyChip key={e.uid} e={e} />
            ))}
          </div>
        </div>
        <CounterHint types={info.enemyTypes} squad={myTypes} />
        <div class="dc-power">
          <div>
            <div class="dim-label">Recommended</div>
            <PowerTag value={info.recommended} big />
          </div>
          <div class={`dc-diff ${diff.cls}`}>{diff.label}</div>
          <div style={{ textAlign: 'right' }}>
            <div class="dim-label">Squad {squadId}</div>
            <PowerTag value={power} big class={diff.cls} />
          </div>
        </div>
        {squads.length > 1 && (
          <div class="dc-squads">
            {squads.map((id) => (
              <button key={id} class={`squad-tab ${id === squadId ? 'active' : ''}`} onClick={() => setSquadId(id)}>
                Squad {id}
                {squadBusy(s, id) && <span class="busy-dot" title="On a world march" />}
              </button>
            ))}
          </div>
        )}
        {busy && <div class="dc-busy">Squad {squadId} is out on the world map — it can fight here once it returns.</div>}
        <div class="dc-rewards">
          <div class="dim-label">Clear rewards</div>
          <RewardTiles reward={info.rewards} size={44} center={false} />
        </div>
        <div class="dc-actions">
          <Btn color="blue" onClick={() => openScreen('formation', { squadId })}>
            Formation
          </Btn>
          <Btn
            color="yellow"
            class="battle-btn"
            disabled={busy}
            onClick={() => {
              if (!squadReady(s, squadId)) {
                toast('Assign heroes in Formation first', 'bad');
                openScreen('formation', { squadId });
                return;
              }
              if (blocker) {
                toast(blocker, 'bad');
                return;
              }
              startDistrictBattle(squadId);
            }}
          >
            <ItemIcon id="swords" size={22} /> BATTLE
          </Btn>
        </div>
        {ratio < 0.8 && <div class="dc-tip">Tip: level up heroes, train soldiers and use a same-type squad to raise power.</div>}
      </div>

      <SectionTitle>Upcoming</SectionTitle>
      <div class="upcoming">
        {upcoming.map((u) => (
          <div class={`up-item ${u.boss ? 'boss' : ''}`} key={u.stage}>
            <div class="up-num">{u.stage}</div>
            <div class="up-mid">
              <div class="up-name">
                {u.name}
                {u.boss && <span class="dc-boss small">BOSS</span>}
              </div>
              <PowerTag value={u.recommended} />
            </div>
            <div class="up-rw">
              {u.rewards.items?.recruit_ticket ? <ItemIcon id="recruit_ticket" size={18} /> : null}
              {u.rewards.heroShards ? <ItemIcon id="shard" size={16} /> : null}
              {u.rewards.items?.skill_medal ? <ItemIcon id="skill_medal" size={16} /> : null}
              <Icon name="diamonds" size={14} />
            </div>
          </div>
        ))}
      </div>

      <LootTruck />
    </Screen>
  );
}
