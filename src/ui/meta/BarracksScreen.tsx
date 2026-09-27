// OWNER: meta agent. 'barracks' screen {uid}: pick a soldier tier, batch size, train; active job + speed-up.
import { useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { canAfford } from '../../core/economy';
import { fmt, fmtDuration } from '../../core/format';
import { toast } from '../../core/nav';
import { getBonus } from '../../core/bonuses';
import { sfx } from '../../core/audio';
import { buildingsOf, getBuilding, maxTrainTier, trainBatchSize, troopCapacity } from '../../systems/buildings';
import { MAX_TIER, TROOP_TIERS, troopTier } from '../../data/troops';
import { startTraining, totalTroops, trainCost, trainDurationMs, trainingJobFor, troopRoom, troopsInTraining } from '../../systems/troops';
import { Bar, Btn, CostView, Screen, SectionTitle } from '../components/common';
import { Icon } from '../components/Icon';
import { QuantityPicker } from '../components/QuantityPicker';
import { TimerBar } from '../components/TimerBar';
import { openTrainingSpeedup } from './timers';

export function SoldierBadge(props: { tier: number; size?: number; locked?: boolean }) {
  const size = props.size ?? 56;
  return (
    <span class={'soldier-badge tier-' + Math.min(props.tier, 10) + (props.locked ? ' locked' : '')} style={{ width: size + 'px', height: size + 'px' }}>
      <Icon name="troops" size={Math.round(size * 0.72)} />
      <span class="soldier-badge-tier">T{props.tier}</span>
      {props.locked && (
        <span class="soldier-badge-lock">
          <Icon name="lock" size={Math.round(size * 0.34)} />
        </span>
      )}
    </span>
  );
}

export function BarracksScreen(props: { uid?: string; screenKey: number }) {
  const s = useGame();
  // Fall back to the first barracks if opened without a uid (e.g. dev ?screen=barracks).
  const uid = props.uid ?? buildingsOf(s, 'barracks').find((x) => x.level >= 1)?.uid ?? 'barracks_1';
  const b = getBuilding(s, uid);
  const maxTier = maxTrainTier(s);
  const [tier, setTier] = useState(maxTier);
  const [qty, setQty] = useState(-1);
  const job = trainingJobFor(s, uid);
  const cap = troopCapacity(s);
  const ready = totalTroops(s);
  const inTraining = troopsInTraining(s);
  const batch = trainBatchSize(s, uid);
  const maxQty = Math.max(0, Math.min(batch, troopRoom(s)));
  const count = qty < 0 ? maxQty : Math.min(qty, maxQty);
  const def = troopTier(Math.min(tier, MAX_TIER));
  const locked = tier > maxTier;
  const cost = trainCost(tier, Math.max(1, count));
  const time = trainDurationMs(s, tier, Math.max(1, count));
  const speed = getBonus(s, 'train_speed_pct');

  return (
    <Screen title={`Barracks${b ? ` · Lv ${b.level}` : ''}`} icon="rifle" class="barracks-screen">
      <div class="cap-card card">
        <div class="cap-row">
          <span>
            <Icon name="troops" size={20} /> Drill Ground capacity
          </span>
          <b>
            {fmt(ready + inTraining)} / {fmt(cap)}
          </b>
        </div>
        <Bar value={ready + inTraining} max={cap} height={12} color={ready + inTraining >= cap ? 'linear-gradient(#ff8a7a,#d03a2a)' : undefined} />
        <div class="cap-row dim-text small">
          <span>Batch size: {fmt(batch)}</span>
          <span>Training speed +{Math.round(speed)}%</span>
        </div>
      </div>

      {job && (
        <TimerBar
          icon="troops"
          label={`Training ${fmt(job.count)} ${troopTier(job.tier).name}s (T${job.tier})`}
          startedAt={job.startedAt}
          endsAt={job.endsAt}
          onSpeedup={() => openTrainingSpeedup(uid)}
        />
      )}

      <SectionTitle right={<span class="dim-text">Max tier: T{maxTier}</span>}>Choose soldiers</SectionTitle>
      <div class="tier-strip">
        {TROOP_TIERS.map((t) => {
          const isLocked = t.tier > maxTier;
          return (
            <button
              key={t.tier}
              class={'tier-card ' + (t.tier === tier ? 'selected' : '') + (isLocked ? ' locked' : '')}
              onClick={() => {
                sfx.click();
                setTier(t.tier);
              }}
            >
              <SoldierBadge tier={t.tier} size={52} locked={isLocked} />
              <span class="tier-card-name">{t.name}</span>
              <span class="tier-card-owned">{fmt(s.meta.troops[t.tier] ?? 0)}</span>
            </button>
          );
        })}
      </div>

      <div class="soldier-detail card">
        <div class="soldier-detail-head">
          <SoldierBadge tier={def.tier} size={72} locked={locked} />
          <div class="soldier-detail-info">
            <div class="soldier-name">
              {def.name} <span class="dim-text">T{def.tier}</span>
            </div>
            <div class="soldier-stats">
              <span>
                <Icon name="power" size={16} /> {fmt(def.power)}
              </span>
              <span>
                <Icon name="heart" size={16} /> {fmt(def.hp)}
              </span>
              <span>
                <Icon name="swords" size={16} /> {fmt(def.atk)}
              </span>
              <span>
                <Icon name="shield" size={16} /> {fmt(def.def)}
              </span>
            </div>
            <div class="dim-text small">Owned: {fmt(s.meta.troops[def.tier] ?? 0)}</div>
          </div>
        </div>
        {locked ? (
          <div class="locked-note">
            <Icon name="lock" size={18} /> Upgrade the Barracks to train T{def.tier} soldiers.
          </div>
        ) : (
          <>
            <QuantityPicker value={count} min={maxQty > 0 ? 1 : 0} max={maxQty} onChange={setQty} />
            {maxQty === 0 && !job && <div class="locked-note">Drill Ground is full — upgrade it to house more soldiers.</div>}
            <div class="train-cost-row">
              <CostView cost={cost} />
              <span class="tech-time">
                <Icon name="clock" size={16} /> {fmtDuration(time)}
              </span>
            </div>
            <div class="train-actions">
              <div class="dim-text small">+{fmt(def.power * count)} Power</div>
              <Btn
                color="green"
                big
                disabled={!!job || count <= 0 || !canAfford(s, cost)}
                onClick={() => {
                  const err = startTraining(uid, tier, count);
                  if (err) toast(err, 'bad');
                  else {
                    sfx.upgrade();
                    toast(`Training ${count} ${def.name}s`, 'good');
                    setQty(-1);
                  }
                }}
              >
                {job ? 'Training…' : 'Train'}
              </Btn>
            </div>
          </>
        )}
      </div>

      <SectionTitle>Your army</SectionTitle>
      <div class="army-list">
        {TROOP_TIERS.filter((t) => (s.meta.troops[t.tier] ?? 0) > 0 || (s.meta.wounded[t.tier] ?? 0) > 0).map((t) => (
          <div class="army-row" key={t.tier}>
            <SoldierBadge tier={t.tier} size={36} />
            <span class="army-name">{t.name}</span>
            <span class="army-count">{fmt(s.meta.troops[t.tier] ?? 0)}</span>
            {(s.meta.wounded[t.tier] ?? 0) > 0 && (
              <span class="army-wounded">
                <Icon name="hospital" size={14} /> {fmt(s.meta.wounded[t.tier] ?? 0)}
              </span>
            )}
          </div>
        ))}
        {ready === 0 && <div class="dim-text center">No soldiers yet.</div>}
      </div>
    </Screen>
  );
}
