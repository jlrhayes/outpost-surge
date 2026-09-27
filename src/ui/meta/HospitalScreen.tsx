// OWNER: meta agent. 'hospital' screen {uid}: wounded list, heal cost/time, capacity, active heal + speed-up.
import { useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { canAfford } from '../../core/economy';
import { fmt, fmtDuration } from '../../core/format';
import { toast } from '../../core/nav';
import { getBonus } from '../../core/bonuses';
import { sfx } from '../../core/audio';
import { buildingsOf, getBuilding, hospitalCapacity } from '../../systems/buildings';
import { TROOP_TIERS } from '../../data/troops';
import { healCost, healDurationMs, pickWounded, startHealing, totalWounded, troopsInHealing } from '../../systems/troops';
import { Bar, Btn, CostView, Screen, SectionTitle } from '../components/common';
import { Icon } from '../components/Icon';
import { QuantityPicker } from '../components/QuantityPicker';
import { TimerBar } from '../components/TimerBar';
import { SoldierBadge } from './BarracksScreen';
import { openHealingSpeedup } from './timers';

export function HospitalScreen(props: { uid?: string; screenKey: number }) {
  const s = useGame();
  // Fall back to the first hospital if opened without a uid (e.g. dev ?screen=hospital).
  const uid = props.uid ?? buildingsOf(s, 'hospital').find((x) => x.level >= 1)?.uid ?? 'hospital_1';
  const b = getBuilding(s, uid);
  const cap = hospitalCapacity(s);
  const wounded = totalWounded(s);
  const healing = troopsInHealing(s);
  const [qty, setQty] = useState(-1);
  const count = qty < 0 ? wounded : Math.min(qty, wounded);
  const pick = pickWounded(s, count);
  const cost = healCost(pick);
  const time = healDurationMs(s, pick);
  const job = s.meta.healing;

  return (
    <Screen title={`Hospital${b ? ` · Lv ${b.level}` : ''}`} icon="hospital" class="hospital-screen">
      <div class="cap-card card">
        <div class="cap-row">
          <span>
            <Icon name="hospital" size={20} /> Beds in use
          </span>
          <b>
            {fmt(wounded + healing)} / {fmt(cap)}
          </b>
        </div>
        <Bar value={wounded + healing} max={Math.max(1, cap)} height={12} color={wounded + healing >= cap ? 'linear-gradient(#ff8a7a,#d03a2a)' : 'linear-gradient(#ff9a9a,#e05a5a)'} />
        <div class="cap-row dim-text small">
          <span>Wounded beyond capacity are lost!</span>
          <span>Heal speed +{Math.round(getBonus(s, 'heal_speed_pct'))}%</span>
        </div>
      </div>

      {job && (
        <TimerBar icon="hospital" label={`Healing ${fmt(healing)} soldiers`} startedAt={job.startedAt} endsAt={job.endsAt} onSpeedup={openHealingSpeedup} />
      )}

      <SectionTitle>Wounded soldiers</SectionTitle>
      {wounded === 0 ? (
        <div class="empty-state small">
          <Icon name="heart" size={48} />
          <div>No wounded soldiers. Your troops are fighting fit!</div>
        </div>
      ) : (
        <>
          <div class="army-list">
            {TROOP_TIERS.filter((t) => (s.meta.wounded[t.tier] ?? 0) > 0)
              .reverse()
              .map((t) => (
                <div class="army-row" key={t.tier}>
                  <SoldierBadge tier={t.tier} size={36} />
                  <span class="army-name">{t.name}</span>
                  <span class="army-count wounded">{fmt(s.meta.wounded[t.tier] ?? 0)}</span>
                  {pick[t.tier] ? <span class="army-heal">+{fmt(pick[t.tier])}</span> : null}
                </div>
              ))}
          </div>
          <div class="soldier-detail card">
            <div class="dim-text small">Soldiers to heal (highest tiers first)</div>
            <QuantityPicker value={count} max={wounded} onChange={setQty} />
            <div class="train-cost-row">
              <CostView cost={cost} />
              <span class="tech-time">
                <Icon name="clock" size={16} /> {fmtDuration(time)}
              </span>
            </div>
            <div class="train-actions">
              <div />
              <Btn
                color="green"
                big
                disabled={!!job || count <= 0 || !canAfford(s, cost)}
                onClick={() => {
                  const err = startHealing(uid, count);
                  if (err) toast(err, 'bad');
                  else {
                    sfx.upgrade();
                    setQty(-1);
                  }
                }}
              >
                {job ? 'Healing…' : 'Heal'}
              </Btn>
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}
