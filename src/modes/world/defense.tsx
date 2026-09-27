// OWNER: world agent. Outpost defence panel ('outpostDefense'): the announced rival raid, who defends the
// outpost (Squad 1 behind the Wall, or just the wall guns), recalling Squad 1, and outpost shields.
import { useState } from 'preact/hooks';
import { mutate, useGame } from '../../core/store';
import { closeScreen, toast } from '../../core/nav';
import { clock, now } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { sfx } from '../../core/audio';
import { Btn, Countdown, Modal } from '../../ui/components/common';
import { Icon } from '../../ui/components/Icon';
import * as D from '../../data/world';
import { buildingLevel } from '../../systems/buildings';
import { counterHint } from '../../systems/campaign';
import {
  buyShieldIn,
  defenderHome,
  marchStatusLabel,
  marchTimerEnd,
  outpostDefencePower,
  raidLossPreview,
  raidsActive,
  recallMarch,
  rivalLineupTypes,
  squadMarch,
  wallDefenceMult,
  type IncomingRaid,
} from '../../systems/world';
import { PowerCompare, WIcon } from './parts';
import { buildingName } from '../../data/buildings';

/** Row of unit-type icons for a themed rival formation (+ the counter hint). */
export function LineupTypes(props: { theme: D.RivalTheme }) {
  return (
    <div class="wm-lineup">
      <span class="wm-lineup-name">{D.RIVAL_THEME_NAME[props.theme]}</span>
      <span class="wm-lineup-icons">
        {rivalLineupTypes(props.theme).map((t, i) => (
          <Icon key={i} name={'type_' + t} size={20} />
        ))}
      </span>
      <span class="wm-lineup-hint">{counterHint(props.theme)}</span>
    </div>
  );
}

function RaidCard(props: { inc: IncomingRaid; defence: number }) {
  const { inc } = props;
  return (
    <div class="wm-raid-card card">
      <div class="wm-raid-head">
        <WIcon name="swords" size={24} />
        <span>
          <b>{inc.label}</b> is marching on your outpost
        </span>
      </div>
      <div class="wm-raid-eta">
        Arrives in <Countdown endsAt={inc.arriveAt} />
      </div>
      <LineupTypes theme={inc.theme} />
      <PowerCompare mine={props.defence} enemy={inc.power} enemyLabel="Raiders" />
    </div>
  );
}

export function DefenseModal(props: { screenKey: number }) {
  const s = useGame();
  const t = clock.value;
  const [confirm, setConfirm] = useState<number | null>(null);
  const r = s.world.raid;
  const inc = r.incoming;
  const shielded = r.shieldUntil > t;
  const m1 = squadMarch(s, 1);
  const home = defenderHome(s);
  const defence = outpostDefencePower(s);
  const wallLv = buildingLevel(s, 'wall');
  const risk = raidLossPreview(s);
  const recall = () => {
    if (!m1) return;
    mutate((st) => void recallMarch(st, m1.id, now()));
    sfx.click();
    toast('Squad 1 is heading home', 'info');
  };
  const buy = (i: number) => {
    if (confirm !== i) {
      setConfirm(i);
      return;
    }
    setConfirm(null);
    let err: string | null = 'Unknown error';
    mutate((st) => {
      err = buyShieldIn(st, i, now());
    });
    if (err) toast(err, 'bad');
    else {
      sfx.reward();
      toast(`Outpost shield up for ${D.SHIELD_OPTIONS[i].hours}h`, 'good');
    }
  };
  const back = m1 && m1.phase === 'back' ? marchTimerEnd(m1) : 0;
  return (
    <Modal title="Outpost Defence" onClose={() => closeScreen(props.screenKey)}>
      {inc ? (
        <RaidCard inc={inc} defence={defence} />
      ) : (
        <div class="wm-dim small wm-center">
          {raidsActive(s, t)
            ? 'No raid in sight. Rival outposts send a raid party every few hours; you get a warning minutes before it lands.'
            : `Rival outposts start raiding at ${buildingName('hq')} Lv ${D.RAID_MIN_HQ}.`}
        </div>
      )}
      <div class="wm-section-title">Defenders</div>
      <div class="wm-stat-row">
        <span>Squad 1</span>
        <b class={home ? 'good' : 'bad'}>
          {home ? 'Home - defending' : m1 ? `${marchStatusLabel(m1)} · ${fmtDuration(marchTimerEnd(m1) - t)}` : 'No heroes assigned'}
        </b>
      </div>
      {m1 && m1.phase !== 'back' && (
        <div class="wm-actions">
          <Btn small color="gray" onClick={recall}>
            <WIcon name="back" size={16} /> Recall Squad 1
          </Btn>
        </div>
      )}
      {inc && back > 0 && back > inc.arriveAt && <div class="wm-warn">Squad 1 won't be back before the raiders arrive.</div>}
      <div class="wm-stat-row">
        <span>Wall Lv {wallLv}</span>
        <b>+{Math.round((wallDefenceMult(s) - 1) * 100)}% defender HP &amp; DEF</b>
      </div>
      <div class="wm-stat-row">
        <span>Defence power</span>
        <b>
          <Icon name="power" size={16} /> {fmt(defence)}
        </b>
      </div>
      <div class="wm-stat-row">
        <span>At risk if a raid wins</span>
        <b class="wm-risk">
          <Icon name="food" size={15} /> {fmt(risk.food)} <Icon name="iron" size={15} /> {fmt(risk.iron)} <Icon name="gold" size={15} /> {fmt(risk.gold)}
        </b>
      </div>
      <div class="wm-dim small">A higher HQ and Warehouse protect more of your stores.</div>
      <div class="wm-section-title">Outpost shield</div>
      {shielded ? (
        <div class="wm-info">
          <WIcon name="shield" size={16} /> Shield active - <Countdown endsAt={r.shieldUntil} />
        </div>
      ) : (
        <div class="wm-dim small">A shield turns every raid away while it lasts.</div>
      )}
      <div class="wm-actions">
        {D.SHIELD_OPTIONS.map((o, i) => (
          <Btn key={i} color={confirm === i ? 'yellow' : 'blue'} small disabled={(s.currencies.diamonds ?? 0) < o.diamonds} onClick={() => buy(i)}>
            <WIcon name="shield" size={16} /> {confirm === i ? 'Confirm' : `${shielded ? '+' : ''}${o.hours}h`}
            <span class="wm-cost">
              <Icon name="diamonds" size={15} />
              {o.diamonds}
            </span>
          </Btn>
        ))}
      </div>
      {r.defended + r.lost > 0 && (
        <div class="wm-dim small wm-center">
          Raids repelled: {r.defended} · lost: {r.lost}
        </div>
      )}
    </Modal>
  );
}
