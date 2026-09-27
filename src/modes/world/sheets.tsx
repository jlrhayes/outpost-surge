// OWNER: world agent. Bottom-sheet info panels for map entities ('worldEntity' / 'hordeInfo') and
// marches ('worldMarch'): enemy power vs squad power, rewards, squad choice, Attack / Gather / Dig / Rescue.
import { useEffect, useState } from 'preact/hooks';
import { game, mutate, useGame, type GameState } from '../../core/store';
import { closeScreen, goTo, openScreen, toast } from '../../core/nav';
import { clock, now } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { totalPower } from '../../core/bonuses';
import { Bar, Btn, Countdown } from '../../ui/components/common';
import { Icon } from '../../ui/components/Icon';
import { hqLevel } from '../../systems/buildings';
import * as D from '../../data/world';
import {
  collectPickup,
  coordLabel,
  entityById,
  entityLabel,
  marchBlocker,
  marchStatusLabel,
  marchTargeting,
  hordeType,
  marchTimerEnd,
  outpostDefencePower,
  recallMarch,
  rivalPower,
  rivalTheme,
  safeSquadPower,
  speedUpMarch,
  squadLoad,
  squadMarch,
  staminaCostFor,
  startMarch,
  tileCenter,
  travelMsTo,
  worldSquads,
  type March,
  type WorldEntity,
} from '../../systems/world';
import { requestCam, selectedEntity, selectedMarch } from './bus';
import { defaultSquad, hasScreen, PowerCompare, RewardList, Sheet, showRewards, SquadPicker, WIcon } from './parts';
import { LineupTypes } from './defense';
import { counterHint } from '../../systems/campaign';

// ------------------------------------------------------------------ entity sheet

export function EntitySheet(props: { id: string; screenKey: number }) {
  const s = useGame();
  void clock.value; // live countdowns / stamina
  useEffect(() => {
    selectedEntity.value = props.id;
    return () => {
      if (selectedEntity.value === props.id) selectedEntity.value = null;
    };
  }, [props.id]);
  if (props.id === 'base') return <BaseSheet s={s} screenKey={props.screenKey} />;
  const e = entityById(s, props.id);
  if (!e) return <GoneSheet screenKey={props.screenKey} />;
  switch (e.kind) {
    case 'horde':
    case 'rival':
      return <CombatSheet s={s} e={e} screenKey={props.screenKey} />;
    case 'resource':
      return <GatherSheet s={s} e={e} screenKey={props.screenKey} />;
    case 'dig':
      return <DigSheet s={s} e={e} screenKey={props.screenKey} />;
    case 'pickup':
      return <PickupSheet s={s} e={e} screenKey={props.screenKey} />;
  }
}

function GoneSheet(props: { screenKey: number }) {
  // the target vanished (defeated / depleted / radar refresh) — close shortly
  useEffect(() => {
    const t = setTimeout(() => closeScreen(props.screenKey), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <Sheet screenKey={props.screenKey} title="Nothing here anymore">
      <div class="wm-dim">This target is gone.</div>
    </Sheet>
  );
}

function subtitleFor(s: GameState, e: WorldEntity) {
  const travel = travelMsTo(s, e.tx, e.ty);
  return (
    <>
      <span class="wm-coord">{coordLabel(e.tx, e.ty)}</span>
      <span class="wm-sep">·</span>
      <WIcon name="truck" size={14} /> {fmtDuration(travel)}
    </>
  );
}

/** Launches a march and closes the sheet; returns false on error (toast shown). */
function launch(s: GameState, squadId: number, e: WorldEntity, screenKey: number, verb: string): boolean {
  let res: March | string = 'Unknown error';
  mutate((st) => {
    res = startMarch(st, squadId, e.id, now());
  });
  if (typeof res === 'string') {
    toast(res, 'bad');
    return false;
  }
  const m = res as March;
  closeScreen(screenKey);
  toast(`Squad ${squadId} ${verb} - arrives in ${fmtDuration(m.legEnd - now())}`, 'info');
  return true;
}

function MarchError(props: { err: string | null; squadId: number; staminaShort?: boolean }) {
  if (!props.err) return null;
  const heroes = props.err.startsWith('Assign heroes');
  return (
    <div class="wm-warn">
      <span>{props.err}</span>
      {heroes && hasScreen('formation') && (
        <Btn small color="blue" onClick={() => openScreen('formation', { squadId: props.squadId })}>
          Formation
        </Btn>
      )}
      {props.staminaShort && (
        <Btn small color="blue" onClick={() => openScreen('worldStamina')}>
          <Icon name="stamina" size={16} /> Refill
        </Btn>
      )}
    </div>
  );
}

function CombatSheet(props: { s: GameState; e: WorldEntity & { kind: 'horde' | 'rival' }; screenKey: number }) {
  const { s, e } = props;
  const squads = worldSquads(s);
  const [squadId, setSquad] = useState(() => defaultSquad(s, squads));
  const t = now();
  const enemy = e.kind === 'horde' ? D.hordePower(e.level, e.variant) : rivalPower(e, t);
  const mine = safeSquadPower(s, squadId);
  const err = marchBlocker(s, squadId, e, t);
  const cost = staminaCostFor(e);
  const incoming = marchTargeting(s, e.id);
  let body;
  if (e.kind === 'horde') {
    const preview = D.hordeLootPreview(e.level, e.variant);
    const first = e.level > s.world.maxHordeLevel;
    const locked = e.level > s.world.maxHordeLevel + 1;
    const htype = hordeType(e);
    body = (
      <>
        <div class="wm-tags">
          {e.variant !== 'normal' && <span class={'wm-tag wm-tag-' + e.variant}>{e.variant === 'boss' ? 'Boss' : 'Elite'}</span>}
          {htype && (
            <span class="wm-tag wm-tag-type">
              <Icon name={'type_' + htype} size={14} /> {counterHint(htype)}
            </span>
          )}
          {e.radarId && <span class="wm-tag wm-tag-radar">Radar target</span>}
          <span class="wm-tag">~{D.hordeZombieCount(e.level, e.variant)} zombies</span>
          {locked && <span class="wm-tag wm-tag-lock">Locked</span>}
        </div>
        <PowerCompare mine={mine} enemy={enemy} enemyLabel="Horde" />
        <div class="wm-section-title">Rewards</div>
        <RewardList reward={preview} />
        {first && !locked && (
          <div class="wm-first">
            <Icon name="diamonds" size={16} /> First Lv {e.level} clear: +{D.firstClearBonus(e.level)} diamonds
          </div>
        )}
      </>
    );
  } else {
    const shielded = e.shieldUntil > t;
    body = (
      <>
        <div class="wm-rival-row">
          <span>{e.commander}</span>
          <span class="wm-sep">·</span>
          <span>HQ {e.level}</span>
          {shielded && (
            <span class="wm-tag wm-tag-shield">
              <WIcon name="shield" size={14} /> <Countdown endsAt={e.shieldUntil} />
            </span>
          )}
        </div>
        <LineupTypes theme={rivalTheme(e)} />
        <PowerCompare mine={mine} enemy={enemy} enemyLabel="Garrison" />
        <div class="wm-section-title">Plunder</div>
        <RewardList reward={D.rivalPlunderPreview(e.level)} />
        <div class="wm-dim small">A raided outpost raises a shield for {fmtDuration(D.RIVAL_SHIELD_MS)}.</div>
      </>
    );
  }
  const accent = e.kind === 'rival' ? '#' + e.color.toString(16).padStart(6, '0') : e.variant === 'boss' ? '#ff4a6a' : e.variant === 'elite' ? '#ff9a3c' : '#8fd14f';
  return (
    <Sheet
      screenKey={props.screenKey}
      title={entityLabel(e)}
      subtitle={subtitleFor(s, e)}
      icon={<WIcon name={e.kind === 'rival' ? 'outpost' : 'zombie'} size={34} />}
      accent={accent}
    >
      {body}
      {incoming && (
        <div class="wm-info">
          Squad {incoming.squadId} is on the way - <Countdown endsAt={incoming.legEnd} />
        </div>
      )}
      <SquadPicker s={s} squads={squads} value={squadId} onChange={setSquad} />
      <MarchError err={err} squadId={squadId} staminaShort={err === 'Not enough stamina'} />
      <div class="wm-actions">
        <Btn color="red" disabled={!!err} onClick={() => launch(s, squadId, e, props.screenKey, 'is marching to attack')}>
          <WIcon name="swords" size={20} /> Attack
          <span class="wm-cost">
            <Icon name="stamina" size={16} />
            {cost}
          </span>
        </Btn>
      </div>
    </Sheet>
  );
}

function GatherSheet(props: { s: GameState; e: WorldEntity & { kind: 'resource' }; screenKey: number }) {
  const { s, e } = props;
  const squads = worldSquads(s);
  const [squadId, setSquad] = useState(() => defaultSquad(s, squads));
  const t = now();
  const err = marchBlocker(s, squadId, e, t);
  const busy = marchTargeting(s, e.id);
  const load = squadLoad(s, squadId);
  const carry = Math.floor(load / D.RES_WEIGHT[e.res]);
  const amount = Math.min(carry, e.amount);
  const rate = D.gatherRatePerSec(e.res, e.level);
  const icon = e.res === 'food' ? 'food' : e.res === 'iron' ? 'iron' : 'gold';
  return (
    <Sheet
      screenKey={props.screenKey}
      title={entityLabel(e)}
      subtitle={subtitleFor(s, e)}
      icon={<Icon name={icon} size={34} />}
      accent={e.res === 'food' ? '#f0c040' : e.res === 'iron' ? '#a8c0d8' : '#ffd23c'}
    >
      <div class="wm-stat-row">
        <span>Remaining</span>
        <b>
          {fmt(e.amount)} / {fmt(e.capacity)}
        </b>
      </div>
      <Bar value={e.amount} max={e.capacity} color={e.res === 'food' ? '#e8b030' : e.res === 'iron' ? '#9ab0c8' : '#ffd23c'} />
      <div class="wm-stat-row">
        <span>Gather speed</span>
        <b>{fmt(rate * 60)}/min</b>
      </div>
      {busy ? (
        <div class="wm-info">
          Squad {busy.squadId} {busy.phase === 'work' ? 'is gathering here' : 'is heading here'} -{' '}
          <Countdown endsAt={marchTimerEnd(busy)} />
        </div>
      ) : (
        <div class="wm-stat-row">
          <span>Squad {squadId} can carry</span>
          <b>
            <Icon name={icon} size={16} /> {fmt(amount)} {amount > 0 && <span class="wm-dim">({fmtDuration((amount / rate) * 1000)})</span>}
          </b>
        </div>
      )}
      <SquadPicker s={s} squads={squads} value={squadId} onChange={setSquad} />
      <MarchError err={err} squadId={squadId} />
      <div class="wm-actions">
        <Btn color="green" disabled={!!err} onClick={() => launch(s, squadId, e, props.screenKey, 'is heading out to gather')}>
          <WIcon name="gather" size={20} /> Gather
        </Btn>
      </div>
    </Sheet>
  );
}

function DigSheet(props: { s: GameState; e: WorldEntity & { kind: 'dig' }; screenKey: number }) {
  const { s, e } = props;
  const squads = worldSquads(s);
  const [squadId, setSquad] = useState(() => defaultSquad(s, squads));
  const err = marchBlocker(s, squadId, e, now());
  const mission = s.world.radar.missions.find((m) => m.id === e.radarId);
  const busy = marchTargeting(s, e.id);
  return (
    <Sheet screenKey={props.screenKey} title={D.RADAR_INFO.dig.title} subtitle={subtitleFor(s, e)} icon={<WIcon name="dig" size={34} />} accent="#ffc93a">
      <div class="wm-desc">{D.RADAR_INFO.dig.desc}</div>
      {mission && (
        <>
          <div class="wm-section-title">
            Reward <span class="wm-stars">{'★'.repeat(mission.stars)}</span>
          </div>
          <RewardList reward={mission.reward} />
          <div class="wm-dim small">Lucky digs pay x2 or even x5.</div>
        </>
      )}
      {busy && (
        <div class="wm-info">
          Squad {busy.squadId} {busy.phase === 'work' ? 'is digging' : 'is on the way'} - <Countdown endsAt={marchTimerEnd(busy)} />
        </div>
      )}
      <SquadPicker s={s} squads={squads} value={squadId} onChange={setSquad} />
      <MarchError err={err} squadId={squadId} />
      <div class="wm-actions">
        <Btn color="yellow" disabled={!!err} onClick={() => launch(s, squadId, e, props.screenKey, 'is heading to the dig site')}>
          <WIcon name="dig" size={20} /> Dig ({fmtDuration(D.DIG_MS)})
        </Btn>
      </div>
    </Sheet>
  );
}

function PickupSheet(props: { s: GameState; e: WorldEntity & { kind: 'pickup' }; screenKey: number }) {
  const { s, e } = props;
  const info = e.pickup === 'survivor' ? D.RADAR_INFO.rescue : D.RADAR_INFO.cache;
  const mission = s.world.radar.missions.find((m) => m.id === e.radarId);
  const collect = () => {
    let r: ReturnType<typeof collectPickup> = null;
    mutate((st) => {
      r = collectPickup(st, e.id);
    });
    closeScreen(props.screenKey);
    if (r) showRewards(e.pickup === 'survivor' ? 'Survivors rescued!' : 'Supply drop recovered!', r);
  };
  return (
    <Sheet
      screenKey={props.screenKey}
      title={info.title}
      subtitle={<span class="wm-coord">{coordLabel(e.tx, e.ty)}</span>}
      icon={<WIcon name={e.pickup === 'survivor' ? 'survivor' : 'crate'} size={34} />}
      accent="#5ab8ff"
    >
      <div class="wm-desc">{info.desc}</div>
      {mission && (
        <>
          <div class="wm-section-title">
            Reward <span class="wm-stars">{'★'.repeat(mission.stars)}</span>
          </div>
          <RewardList reward={mission.reward} />
        </>
      )}
      <div class="wm-actions">
        <Btn color="green" onClick={collect}>
          {e.pickup === 'survivor' ? 'Rescue' : 'Collect'}
        </Btn>
      </div>
    </Sheet>
  );
}

function BaseSheet(props: { s: GameState; screenKey: number }) {
  const { s } = props;
  useEffect(() => {
    selectedEntity.value = 'base';
  }, []);
  const squads = worldSquads(s);
  return (
    <Sheet screenKey={props.screenKey} title={s.player.name || 'Commander'} subtitle="Your outpost" icon={<WIcon name="base" size={34} />} accent="#5ab8ff">
      <div class="wm-stat-row">
        <span>Headquarters</span>
        <b>Lv {hqLevel(s)}</b>
      </div>
      <div class="wm-stat-row">
        <span>Power</span>
        <b>
          <Icon name="power" size={16} /> {fmt(totalPower(s))}
        </b>
      </div>
      <div class="wm-stat-row">
        <span>Highest horde defeated</span>
        <b>{s.world.maxHordeLevel ? `Lv ${s.world.maxHordeLevel}` : 'None yet'}</b>
      </div>
      <button class="wm-defense-row" onClick={() => openScreen('outpostDefense')}>
        <WIcon name="shield" size={20} />
        <span class="wm-defense-main">
          {s.world.raid.incoming ? (
            <b class="bad">
              Raid by {s.world.raid.incoming.label} in <Countdown endsAt={s.world.raid.incoming.arriveAt} />
            </b>
          ) : s.world.raid.shieldUntil > now() ? (
            <span>
              Shield up - <Countdown endsAt={s.world.raid.shieldUntil} />
            </span>
          ) : (
            <span>Defence &amp; shields</span>
          )}
        </span>
        <b>
          <Icon name="power" size={14} /> {fmt(outpostDefencePower(s))}
        </b>
      </button>
      <div class="wm-section-title">Squads</div>
      <div class="wm-squad-list">
        {squads.map((id) => {
          const m = squadMarch(s, id);
          return (
            <div class="wm-stat-row" key={id}>
              <span>Squad {id}</span>
              <b>
                {m ? (
                  <>
                    {marchStatusLabel(m)} <Countdown endsAt={marchTimerEnd(m)} />
                  </>
                ) : (
                  'At home'
                )}
              </b>
            </div>
          );
        })}
      </div>
      <div class="wm-actions">
        <Btn color="blue" onClick={() => goTo('base')}>
          <WIcon name="home" size={20} /> Enter Base
        </Btn>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ march sheet

export function MarchSheet(props: { id: string; screenKey: number }) {
  const s = useGame();
  const t = clock.value;
  useEffect(() => {
    selectedMarch.value = props.id;
    return () => {
      if (selectedMarch.value === props.id) selectedMarch.value = null;
    };
  }, [props.id]);
  const m = s.world.marches.find((x) => x.id === props.id);
  if (!m) return <GoneSheet screenKey={props.screenKey} />;
  const end = marchTimerEnd(m);
  const start = m.phase === 'work' ? m.workStart : m.legStart;
  const total = Math.max(1, end - start);
  const recall = () => {
    mutate((st) => void recallMarch(st, m.id, now()));
    toast(`Squad ${m.squadId} is returning`, 'info');
  };
  const speed = () =>
    openScreen('speedup', {
      title: `Squad ${m.squadId} march`,
      getEndsAt: () => {
        const x = game.world.marches.find((q) => q.id === m.id);
        return x ? marchTimerEnd(x) : null;
      },
      apply: (ms: number) => mutate((st) => speedUpMarch(st, m.id, ms, now())),
    });
  const locate = () => {
    const c = tileCenter(m.tx, m.ty);
    closeScreen(props.screenKey);
    requestCam({ x: c.x, z: c.z });
  };
  const gatheredSoFar = m.phase === 'work' && m.gather ? Math.floor(m.gather.amount * Math.min(1, (t - m.workStart) / Math.max(1, m.workEnd - m.workStart))) : 0;
  return (
    <Sheet
      screenKey={props.screenKey}
      title={`Squad ${m.squadId} · ${marchStatusLabel(m)}`}
      subtitle={
        <>
          {m.label} <span class="wm-sep">·</span> <span class="wm-coord">{coordLabel(m.tx, m.ty)}</span>
        </>
      }
      icon={<WIcon name={m.phase === 'back' ? 'back' : m.kind === 'attack' ? 'swords' : m.kind === 'dig' ? 'dig' : 'gather'} size={32} />}
      accent={m.phase === 'back' ? '#6ab8ff' : m.kind === 'attack' ? '#ff5a48' : m.kind === 'dig' ? '#ffc84a' : '#5ee06e'}
    >
      <Bar value={t - start} max={total} color="linear-gradient(#8fd0ff,#3a9cf0)" label={fmtDuration(end - t)} height={18} />
      <div class="wm-stat-row">
        <span>Soldiers</span>
        <b>
          <Icon name="troops" size={16} /> {fmt(m.troops)}
        </b>
      </div>
      {m.power > 0 && (
        <div class="wm-stat-row">
          <span>Squad power</span>
          <b>
            <Icon name="power" size={16} /> {fmt(m.power)}
          </b>
        </div>
      )}
      {m.phase === 'work' && m.gather && (
        <div class="wm-stat-row">
          <span>Gathered</span>
          <b>
            <Icon name={m.gather.res} size={16} /> {fmt(gatheredSoFar)} / {fmt(m.gather.amount)}
          </b>
        </div>
      )}
      {m.phase === 'back' && m.loot && (
        <>
          <div class="wm-section-title">Carrying home</div>
          <RewardList reward={m.loot} />
        </>
      )}
      {m.phase === 'back' && m.result === 'lose' && <div class="wm-warn">The attack failed. The squad is falling back.</div>}
      <div class="wm-actions">
        {m.phase !== 'back' && (
          <Btn color="gray" onClick={recall}>
            <WIcon name="back" size={18} /> Recall
          </Btn>
        )}
        {hasScreen('speedup') && (
          <Btn color="yellow" onClick={speed}>
            <Icon name="clock" size={18} /> Speed up
          </Btn>
        )}
        <Btn color="blue" onClick={locate}>
          Target
        </Btn>
      </div>
    </Sheet>
  );
}
