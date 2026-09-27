// OWNER: heroes agent. 'heroDetail' screen: big portrait, stats, and Level / Stars / Skills / Gear tabs.
import { useState } from 'preact/hooks';
import { buildingName } from '../../data/buildings';
import { useGame } from '../../core/store';
import { openScreen, toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt } from '../../core/format';
import { Bar, Btn, CostView, Screen, Tabs } from '../components/common';
import { Icon } from '../components/Icon';
import { hqLevel, marchSizePerHero } from '../../systems/buildings';
import {
  ATTACK_INTERVAL,
  ROLE_LABEL,
  TYPE_LABEL,
  describeSkill,
  heroDef,
  skillKindLabel,
  type HeroDef,
} from '../../data/heroes';
import {
  GEAR_SLOTS,
  MAX_STARS,
  SKILL_CAP_BY_STARS,
  STAR_STAT_BONUS,
  UNLOCK_SHARDS,
  canGearUp,
  canLevelUp,
  canSkillUp,
  canStarUp,
  expForLevels,
  expToNext,
  gearCap,
  gearTier,
  gearUpgradeCost,
  heroLevelCap,
  heroPower,
  heroStats,
  levelUpHero,
  skillCap,
  skillMedalCost,
  starCost,
  starUpHero,
  universalShardItem,
  upgradeGear,
  upgradeSkill,
  useUniversalShards,
} from '../../systems/heroes';
import type { HeroState } from '../../state/heroes';
import { HeroPortrait } from './HeroPortrait';
import { ItemIcon, RoleIcon, Stars, TypeIcon } from './icons';
import { PowerTag } from './parts';

type Tab = 'level' | 'stars' | 'skills' | 'gear';

function GearGlyph(props: { slot: number; color: string }) {
  const c = props.color;
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#0f1a24" stroke={c} stroke-width="1.6" />
      {props.slot === 0 && <path d="M4 10h12l2-2h2v3h-3l-1 1v2h-3l-1 3H9l1-3H6l-2-1z" fill={c} />}
      {props.slot === 1 && <path d="M12 4 L19 7 L19 12 Q19 17 12 20 Q5 17 5 12 L5 7 Z" fill={c} />}
      {props.slot === 2 && (
        <g fill={c}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3" stroke={c} stroke-width="1.3" />
        </g>
      )}
      {props.slot === 3 && (
        <g fill="none" stroke={c} stroke-width="1.8">
          <path d="M5 16 A8 8 0 0 1 16 5" />
          <path d="M8 16 A5 5 0 0 1 16 8" />
          <circle cx="16" cy="16" r="2" fill={c} />
        </g>
      )}
    </svg>
  );
}

function LevelTab(props: { h: HeroState; d: HeroDef }) {
  const s = useGame();
  const { h, d } = props;
  const cap = heroLevelCap(s);
  const next = expToNext(h.level);
  const atCap = h.level >= cap;
  const cur = heroStats(h);
  const nextStats = heroStats({ ...h, level: h.level + 1 });
  // How many levels are affordable right now (max 5 per tap on the big button)?
  let affordable = 0;
  while (affordable < 5 && h.level + affordable < cap && expForLevels(h.level, affordable + 1) <= s.currencies.heroExp) affordable++;
  return (
    <div class="tab-body">
      <div class="lv-head">
        <div class="lv-big">
          Lv <b>{h.level}</b>
          <span class="dim-label"> / {cap}</span>
        </div>
        <div class="dim-label">Level cap = 5 × HQ level (HQ {hqLevel(s)})</div>
      </div>
      <Bar value={h.level} max={cap} color="linear-gradient(#8ef07a,#3cb030)" label={`${h.level} / ${cap}`} height={16} />
      <div class="exp-row">
        <span>
          <Icon name="heroExp" size={18} /> Hero EXP: <b>{fmt(s.currencies.heroExp)}</b>
        </span>
        {!atCap && (
          <span class={s.currencies.heroExp >= next ? 'ok' : 'short'}>
            Next: <b>{fmt(next)}</b>
          </span>
        )}
      </div>
      {!atCap && (
        <div class="gain-row">
          <span>HP {fmt(cur.hp)} → <b class="up">{fmt(nextStats.hp)}</b></span>
          <span>ATK {fmt(cur.atk)} → <b class="up">{fmt(nextStats.atk)}</b></span>
          <span>DEF {fmt(cur.def)} → <b class="up">{fmt(nextStats.def)}</b></span>
        </div>
      )}
      {atCap ? (
        <div class="cap-note">Level cap reached. Upgrade your HQ to raise it.</div>
      ) : (
        <div class="btn-row">
          <Btn
            color="green"
            disabled={!canLevelUp(s, h)}
            onClick={() => {
              if (levelUpHero(h.id, 1)) sfx.upgrade();
            }}
          >
            Level Up
          </Btn>
          <Btn
            color="yellow"
            disabled={affordable < 2}
            onClick={() => {
              const n = levelUpHero(h.id, affordable);
              if (n) {
                sfx.upgrade();
                toast(`${d.callsign} +${n} levels!`, 'good');
              }
            }}
          >
            +{Math.max(2, affordable)} Levels
          </Btn>
        </div>
      )}
      {!atCap && s.currencies.heroExp < next && <div class="dim-label center">Get Hero EXP from districts, the loot truck and the {buildingName('trainingbase')}.</div>}
    </div>
  );
}

function StarsTab(props: { h: HeroState; d: HeroDef }) {
  const s = useGame();
  const { h, d } = props;
  const cost = starCost(h);
  const uniItem = universalShardItem(d.rarity);
  const uniHave = s.items[uniItem] ?? 0;
  const need = cost === null ? 0 : Math.max(0, cost - h.shards);
  return (
    <div class="tab-body">
      <div class="stars-big">
        <Stars n={h.stars} size={30} />
      </div>
      <div class="dim-label center">
        Each star: +{Math.round(STAR_STAT_BONUS * 100)}% all stats and a higher skill level cap.
      </div>
      {cost === null ? (
        <div class="cap-note">Maximum stars reached!</div>
      ) : (
        <>
          <div class="shard-row">
            <ItemIcon id="shard" size={20} />
            <div style={{ flex: 1 }}>
              <Bar value={h.shards} max={cost} color="linear-gradient(#e0a0ff,#9a3ae0)" label={`${h.shards} / ${cost}`} height={18} />
            </div>
          </div>
          <div class="dim-label center">
            Next star: skill cap Lv {SKILL_CAP_BY_STARS[h.stars]} → <b>Lv {SKILL_CAP_BY_STARS[h.stars + 1]}</b>
          </div>
          <div class="btn-row">
            <Btn
              color="purple"
              disabled={!canStarUp(h)}
              onClick={() => {
                if (starUpHero(h.id)) {
                  sfx.win();
                  toast(`${d.callsign} reached ${h.stars + 1}★!`, 'good');
                }
              }}
            >
              Star Up
            </Btn>
          </div>
          <div class="uni-row card">
            <ItemIcon id={uniItem} size={26} />
            <div style={{ flex: 1 }}>
              <div>Universal {d.rarity === 'UR' ? 'UR' : 'SSR'} shards: <b>{uniHave}</b></div>
              <div class="dim-label">Convert into {d.callsign}'s shards 1:1</div>
            </div>
            <Btn
              small
              color="blue"
              disabled={uniHave <= 0 || need <= 0}
              onClick={() => {
                const n = Math.min(uniHave, need);
                if (useUniversalShards(h.id, n)) toast(`+${n} shards`, 'good');
              }}
            >
              Use {Math.min(uniHave, need) || ''}
            </Btn>
          </div>
        </>
      )}
      <div class="dim-label center">Duplicates from recruitment become shards. Max {MAX_STARS}★.</div>
    </div>
  );
}

function SkillsTab(props: { h?: HeroState; d: HeroDef }) {
  const s = useGame();
  const { h, d } = props;
  const medals = s.items.skill_medal ?? 0;
  return (
    <div class="tab-body">
      {h && (
        <div class="medal-row">
          <ItemIcon id="skill_medal" size={20} /> Skill medals: <b>{medals}</b>
          <span class="dim-label"> · Skill cap Lv {skillCap(h)} at {h.stars}★</span>
        </div>
      )}
      {d.skills.map((sk, i) => {
        const lv = h ? h.skillLevels[i] ?? 1 : 1;
        const cap = h ? skillCap(h) : SKILL_CAP_BY_STARS[0];
        const cost = skillMedalCost(d.rarity, lv);
        const lines = describeSkill(sk, lv);
        const nextLines = describeSkill(sk, lv + 1);
        return (
          <div class={`skill-card kind-${sk.kind}`} key={sk.id}>
            <div class="skill-head">
              <div class={`skill-badge kind-${sk.kind}`}>{sk.kind === 'auto' ? 'A' : sk.kind === 'active' ? 'T' : 'P'}</div>
              <div style={{ flex: 1 }}>
                <div class="skill-name">{sk.name}</div>
                <div class="dim-label">{skillKindLabel(sk)}</div>
              </div>
              <div class="skill-lv">
                Lv <b>{lv}</b>
                <span class="dim-label">/{cap}</span>
              </div>
            </div>
            <ul class="skill-desc">
              {lines.map((l, j) => (
                <li key={j}>
                  {l}
                  {h && lv < cap && nextLines[j] !== l && <span class="skill-next"> → next: {nextLines[j].match(/\d+%?/g)?.[0] ?? ''}</span>}
                </li>
              ))}
            </ul>
            {h && (
              <div class="skill-foot">
                {lv >= cap ? (
                  <span class="dim-label">{lv >= SKILL_CAP_BY_STARS[MAX_STARS] ? 'Max level' : 'Star up to raise the cap'}</span>
                ) : (
                  <Btn
                    small
                    color="green"
                    disabled={!canSkillUp(s, h, i)}
                    onClick={() => {
                      if (upgradeSkill(h.id, i)) sfx.upgrade();
                    }}
                  >
                    Upgrade <ItemIcon id="skill_medal" size={14} /> {cost}
                  </Btn>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GearTab(props: { h: HeroState }) {
  const s = useGame();
  const { h } = props;
  const cap = gearCap(h);
  return (
    <div class="tab-body">
      <div class="dim-label center">Gear levels are capped by hero level (Lv {cap}).</div>
      <div class="gear-grid">
        {GEAR_SLOTS.map((g, i) => {
          const L = h.gear[i] ?? 0;
          const tier = gearTier(L);
          const bonus = Object.entries(g.per)
            .map(([k, v]) => `${k.toUpperCase()} +${Math.round((v ?? 0) * L * 10) / 10}%`)
            .join(' · ');
          const cost = gearUpgradeCost(L);
          return (
            <div class="gear-card" key={g.id} style={{ borderColor: tier.color }}>
              <div class="gear-top">
                <GearGlyph slot={i} color={tier.color} />
                <div>
                  <div class="gear-name">{g.name}</div>
                  <div class="gear-tier" style={{ color: tier.color }}>
                    {tier.name} · Lv {L}
                  </div>
                </div>
              </div>
              <div class="gear-bonus">{L > 0 ? bonus : 'Not equipped'}</div>
              {L < cap ? (
                <>
                  <CostView cost={cost} />
                  <Btn
                    small
                    color="blue"
                    disabled={!canGearUp(s, h, i)}
                    onClick={() => {
                      if (upgradeGear(h.id, i)) sfx.upgrade();
                    }}
                  >
                    {L === 0 ? 'Equip' : 'Upgrade'}
                  </Btn>
                </>
              ) : (
                <div class="dim-label">Level up hero to upgrade</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HeroDetailScreen(props: { heroId: string; screenKey?: number }) {
  const s = useGame();
  const [id, setId] = useState(props.heroId);
  const [tab, setTab] = useState<Tab>('level');
  const d = heroDef(id);
  if (!d) return <Screen title="Hero">Unknown hero</Screen>;
  const h = s.heroes.owned[id];
  const ownedIds = Object.values(s.heroes.owned)
    .sort((a, b) => heroPower(b) - heroPower(a))
    .map((x) => x.id);
  const idx = ownedIds.indexOf(id);
  const go = (delta: number) => {
    if (idx < 0 || ownedIds.length < 2) return;
    setId(ownedIds[(idx + delta + ownedIds.length) % ownedIds.length]);
  };
  const st = h ? heroStats(h) : { hp: d.base.hp, atk: d.base.atk, def: d.base.def, crit: 5 };
  return (
    <Screen title={d.name} class="hero-detail">
      <div class={`hd-banner rar-${d.rarity} type-${d.type}`}>
        {idx >= 0 && ownedIds.length > 1 && (
          <>
            <button class="hd-nav left" onClick={() => go(-1)} aria-label="Previous hero">
              ‹
            </button>
            <button class="hd-nav right" onClick={() => go(1)} aria-label="Next hero">
              ›
            </button>
          </>
        )}
        <HeroPortrait heroId={id} size={150} frame dim={!h} class="hd-portrait" />
        <div class="hd-info">
          <div class={`hd-rarity rarity-${d.rarity}`}>{d.rarity}</div>
          <div class="hd-name">{d.name}</div>
          <div class="hd-callsign">“{d.callsign}”</div>
          <div class="hd-tags">
            <span class="tag">
              <TypeIcon type={d.type} size={16} /> {TYPE_LABEL[d.type]}
            </span>
            <span class="tag">
              <RoleIcon role={d.role} size={14} /> {ROLE_LABEL[d.role]}
            </span>
          </div>
          {h && <Stars n={h.stars} size={16} />}
          {h && <PowerTag value={heroPower(h)} big />}
        </div>
      </div>
      <div class="hd-bio">{d.bio}</div>
      <div class="hd-stats">
        <div>
          <span class="dim-label">HP</span>
          <b>{fmt(st.hp)}</b>
        </div>
        <div>
          <span class="dim-label">ATK</span>
          <b>{fmt(st.atk)}</b>
        </div>
        <div>
          <span class="dim-label">DEF</span>
          <b>{fmt(st.def)}</b>
        </div>
        <div>
          <span class="dim-label">Crit</span>
          <b>{Math.round(st.crit)}%</b>
        </div>
        <div>
          <span class="dim-label">Leads</span>
          <b>{marchSizePerHero(s, d.type) + (h ? (h.level - 1) * 2 : 0)}</b>
        </div>
        <div>
          <span class="dim-label">Atk speed</span>
          <b>{ATTACK_INTERVAL[d.type]}s</b>
        </div>
      </div>
      {h ? (
        <>
          <Tabs
            tabs={[
              { id: 'level', label: 'Level', badge: canLevelUp(s, h) },
              { id: 'stars', label: 'Stars', badge: canStarUp(h) },
              { id: 'skills', label: 'Skills', badge: [0, 1, 2].some((i) => canSkillUp(s, h, i)) },
              { id: 'gear', label: 'Gear' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'level' && <LevelTab h={h} d={d} />}
          {tab === 'stars' && <StarsTab h={h} d={d} />}
          {tab === 'skills' && <SkillsTab h={h} d={d} />}
          {tab === 'gear' && <GearTab h={h} />}
        </>
      ) : (
        <>
          <div class="card locked-card">
            <div>
              Not recruited yet · Shards {s.heroes.pendingShards[id] ?? 0}/{UNLOCK_SHARDS}
            </div>
            <Btn color="purple" small onClick={() => openScreen('recruit')}>
              Recruit
            </Btn>
          </div>
          <SkillsTab d={d} />
        </>
      )}
    </Screen>
  );
}
