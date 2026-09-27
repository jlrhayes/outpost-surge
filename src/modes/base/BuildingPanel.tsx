// OWNER: base agent. `buildingPanel {uid}` — building info & upgrade screen, plus `baseBuilders` modal.
import './base.css';
import { useGame, type GameState } from '../../core/store';
import { clock } from '../../core/tick';
import { closeScreen, focusBuilding, openScreen } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt, fmtDuration } from '../../core/format';
import type { Cost } from '../../core/types';
import { Bar, Btn, CostView, Modal, Screen } from '../../ui/components/common';
import { Icon } from '../../ui/components/Icon';
import { totalTroops } from '../../systems/troops';
import type { BuildingState } from '../../state/base';
import {
  BUILDINGS,
  MAX_BUILDERS,
  MAX_BUILDING_LEVEL,
  SECOND_BUILDER_DIAMONDS,
  buildingName,
  buildingPower,
  effectsAt,
  levelForTier,
  upgradeCost,
  type EffectLine,
} from '../../data/buildings';
import {
  busyBuilders,
  canBuyBuilder,
  canFinishFree,
  finishNowDiamonds,
  hasFreeBuilder,
  hospitalCapacity,
  instantUpgradeDiamonds,
  levelRequirements,
  maxTrainTier,
  producerCap,
  producerRate,
  remainingMs,
  troopCapacity,
  uncollected,
  upgradeBlock,
  upgradeTimeMs,
  getBuilding,
} from '../../systems/buildings';
import { doBuyBuilder, doFinishNow, doFreeFinish, doInstantUpgrade, doUpgrade, openSpeedup } from './actions';
import { buildingActions } from './buildingActions';
import { buildingArt } from './snapshot';
import { Bolt, Check, Cross, Hammer } from './icons';

export function fmtEffect(e: EffectLine): string {
  switch (e.fmt) {
    case 'pct':
      return (e.value > 0 ? '+' : '') + (Math.round(e.value * 10) / 10) + '%';
    case 'perHour':
      return fmt(e.value) + '/h';
    case 'tier':
      return 'T' + e.value;
    case 'plus':
      return '+' + fmt(e.value);
    default:
      return fmt(e.value);
  }
}

export function BuildingArt(props: { type: BuildingState['type']; level: number; size?: number }) {
  const url = buildingArt(props.type, props.level);
  const size = props.size ?? 120;
  const def = BUILDINGS[props.type];
  return (
    <div class="bp-art" style={{ width: size + 'px', height: size + 'px', '--accent': def.accent } as any}>
      {url ? <img src={url} alt="" draggable={false} /> : <div class="bp-art-fallback">{def.name.charAt(0)}</div>}
    </div>
  );
}

function statusLines(s: GameState, b: BuildingState): { label: string; value: string }[] {
  switch (b.type) {
    case 'drill':
      return [{ label: 'Troops housed', value: `${fmt(totalTroops(s))} / ${fmt(troopCapacity(s))}` }];
    case 'hospital': {
      const w = Object.values(s.meta.wounded ?? {}).reduce((a, v) => a + v, 0);
      return [{ label: 'Wounded', value: `${fmt(w)} / ${fmt(hospitalCapacity(s))}` }];
    }
    case 'barracks': {
      const tier = maxTrainTier(s);
      return tier < 10 ? [{ label: 'Next tier', value: `T${tier + 1} at Lv ${levelForTier(tier + 1)}` }] : [];
    }
    default:
      return [];
  }
}

export function BuildingPanel(props: { uid: string; screenKey?: number }) {
  const s = useGame();
  const t = clock.value;
  const b = getBuilding(s, props.uid);
  if (!b) {
    return (
      <Screen title="Building">
        <div class="bp-empty">This building no longer exists.</div>
      </Screen>
    );
  }
  const def = BUILDINGS[b.type];
  const upgrading = b.upgradeEndsAt !== null;
  const max = b.level >= MAX_BUILDING_LEVEL;
  const next = b.level + 1;
  const cur = effectsAt(b.type, b.level);
  const nxt = max ? null : effectsAt(b.type, next);
  const reqs = max ? [] : levelRequirements(s, b.type, next);
  const cost: Cost = max ? {} : upgradeCost(b.type, next);
  const time = max ? 0 : upgradeTimeMs(s, b.type, next);
  const block = upgradeBlock(s, b);
  const acts = buildingActions(s, b);
  const powerGain = max ? 0 : buildingPower(b.type, next) - buildingPower(b.type, b.level);
  const building = b.level === 0;
  const title = building ? `Build ${def.name}` : def.name;
  const res = def.produces;

  let footer: preact.JSX.Element;
  if (max) {
    footer = <div class="bp-maxed">Maximum level reached</div>;
  } else if (upgrading) {
    const free = canFinishFree(s, b, t);
    const dia = finishNowDiamonds(s, b);
    footer = (
      <>
        <Btn color="blue" onClick={() => openSpeedup(b.uid)}>
          <Icon name="clock" size={18} /> Speed Up
        </Btn>
        {free ? (
          <Btn color="green" onClick={() => doFreeFinish(b.uid)}>
            Finish FREE
          </Btn>
        ) : (
          <Btn color="purple" onClick={() => doFinishNow(b.uid)}>
            Finish <Icon name="diamonds" size={16} /> {dia}
          </Btn>
        )}
      </>
    );
  } else {
    const dia = instantUpgradeDiamonds(s, b);
    const soft = block === 'resources' || block === 'requirements' || block === 'builders';
    footer = (
      <>
        <Btn color="purple" class="bp-instant" onClick={() => doInstantUpgrade(b.uid)}>
          <span class="bp-btn-col">
            <span>Instant</span>
            <span class="bp-btn-sub">
              <Icon name="diamonds" size={14} /> {dia}
            </span>
          </span>
        </Btn>
        <Btn
          color="yellow"
          class={'bp-upgrade' + (soft ? ' soft' : '')}
          onClick={() => {
            if (doUpgrade(b.uid)) closeScreen(props.screenKey);
          }}
        >
          <span class="bp-btn-col">
            <span>{building ? 'Build' : 'Upgrade'}</span>
            <span class="bp-btn-sub">
              <Icon name="clock" size={14} /> {fmtDuration(time)}
            </span>
          </span>
        </Btn>
      </>
    );
  }

  return (
    <Screen title={title} footer={footer} class="bp-screen">
      <div class="bp-hero" style={{ '--accent': def.accent } as any}>
        <BuildingArt type={b.type} level={Math.max(1, upgrading ? b.level : b.level)} size={132} />
        <div class="bp-hero-info">
          <div class="bp-level">
            {building ? (
              'Not built'
            ) : (
              <>
                Lv <b>{b.level}</b>
                {!max && (
                  <>
                    <span class="bp-arrow">▸</span>
                    <b class="bp-next">{next}</b>
                  </>
                )}
              </>
            )}
          </div>
          <div class="bp-desc">{def.desc}</div>
          {!max && powerGain > 0 && (
            <div class="bp-power">
              <Bolt size={15} /> Power +{fmt(powerGain)}
            </div>
          )}
        </div>
      </div>

      {upgrading && (
        <div class="card bp-progress">
          <div class="bp-progress-head">
            <Hammer size={16} /> {building ? 'Under construction' : `Upgrading to Lv ${next}`}
            <span class="bp-progress-time">{fmtDuration(remainingMs(b, t))}</span>
          </div>
          <Bar value={t - (b.upgradeStartedAt ?? t)} max={Math.max(1, (b.upgradeEndsAt ?? t) - (b.upgradeStartedAt ?? t))} height={16} />
          {canFinishFree(s, b, t) && <div class="bp-hint good">Inside the free-finish window: finish it now for free!</div>}
        </div>
      )}

      {res && b.level > 0 && (
        <div class="card bp-prod">
          <div class="bp-prod-row">
            <Icon name={res} size={22} />
            <div class="bp-prod-info">
              <div>
                Stored <b>{fmt(uncollected(s, b, t))}</b> / {fmt(producerCap(s, b))}
              </div>
              <Bar value={uncollected(s, b, t)} max={producerCap(s, b)} height={10} />
            </div>
            <div class="bp-prod-rate">{fmt(producerRate(s, b))}/h</div>
          </div>
        </div>
      )}

      {cur.length > 0 && (
        <div class="card bp-effects">
          <div class="bp-section">{max || upgrading ? 'Current effects' : building ? 'Effects' : 'Upgrade effects'}</div>
          {(nxt ?? cur).map((e, i) => {
            const c = cur[i];
            const changed = nxt && c && c.value !== e.value;
            return (
              <div class="bp-eff-row" key={e.label}>
                <span class="bp-eff-label">
                  {e.icon && <Icon name={e.icon} size={15} />} {e.label}
                </span>
                <span class="bp-eff-vals">
                  {!building && c && <span class="bp-eff-cur">{fmtEffect(c)}</span>}
                  {nxt && !upgrading && (!building ? changed : true) && (
                    <>
                      {!building && <span class="bp-arrow">▸</span>}
                      <span class="bp-eff-next">{fmtEffect(e)}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {statusLines(s, b).map((l) => (
            <div class="bp-eff-row status" key={l.label}>
              <span class="bp-eff-label">{l.label}</span>
              <span class="bp-eff-vals">{l.value}</span>
            </div>
          ))}
        </div>
      )}

      {!max && !upgrading && (
        <div class="card bp-reqs">
          <div class="bp-section">Requirements</div>
          {reqs.map((r) => (
            <div class={'bp-req' + (r.met ? ' met' : '')} key={r.label}>
              {r.met ? <Check /> : <Cross />}
              <span class="bp-req-label">{r.label}</span>
              {!r.met && r.focus && (
                <Btn small color="red" onClick={() => focusBuilding({ type: r.focus!.type, openPanel: true })}>
                  Go
                </Btn>
              )}
            </div>
          ))}
          <div class={'bp-req' + (hasFreeBuilder(s) ? ' met' : '')}>
            {hasFreeBuilder(s) ? <Check /> : <Cross />}
            <span class="bp-req-label">
              Builder available ({s.base.builders - busyBuilders(s)}/{s.base.builders})
            </span>
            {!hasFreeBuilder(s) && (
              <Btn small color="blue" onClick={() => openScreen('baseBuilders', { forUid: b.uid })}>
                Queue
              </Btn>
            )}
          </div>
          <div class="bp-section bp-cost-title">Cost</div>
          <div class="bp-cost">
            <CostView cost={cost} />
          </div>
        </div>
      )}

      {acts.length > 0 && (
        <div class="bp-actions">
          {acts.map((a) => (
            <Btn
              key={a.id}
              color={a.locked ? 'gray' : a.color}
              onClick={() => {
                a.run();
              }}
            >
              <Icon name={a.icon} size={18} /> {a.label}
            </Btn>
          ))}
        </div>
      )}
    </Screen>
  );
}

/** `baseBuilders {forUid?}` — builder queue status, speed-ups and hiring the permanent 2nd builder. */
export function BuildersModal(props: { forUid?: string; screenKey?: number }) {
  const s = useGame();
  const t = clock.value;
  const jobs = s.base.buildings.filter((b) => b.upgradeEndsAt !== null);
  const busy = !hasFreeBuilder(s);
  const want = props.forUid ? getBuilding(s, props.forUid) : undefined;
  return (
    <Modal title={busy && want ? 'All builders are busy' : 'Builder Queues'} onClose={() => closeScreen(props.screenKey)}>
      <div class="bq-list">
        {jobs.length === 0 && <div class="bq-empty">All builders are idle. Pick something to upgrade!</div>}
        {jobs.map((j) => {
          const free = canFinishFree(s, j, t);
          return (
            <div class="bq-row" key={j.uid}>
              <Hammer size={18} />
              <div class="bq-info">
                <div class="bq-name">
                  {buildingName(j.type)} → Lv {j.level + 1}
                </div>
                <Bar
                  value={t - (j.upgradeStartedAt ?? t)}
                  max={Math.max(1, (j.upgradeEndsAt ?? t) - (j.upgradeStartedAt ?? t))}
                  height={10}
                  label={fmtDuration(remainingMs(j, t))}
                />
              </div>
              {free ? (
                <Btn small color="green" onClick={() => doFreeFinish(j.uid)}>
                  Free
                </Btn>
              ) : (
                <Btn small color="blue" onClick={() => openSpeedup(j.uid)}>
                  Speed
                </Btn>
              )}
            </div>
          );
        })}
      </div>
      {canBuyBuilder(s) ? (
        <div class="bq-hire">
          <div class="bq-hire-text">
            <b>Hire a 2nd builder</b> — permanent extra construction queue ({s.base.builders}/{MAX_BUILDERS}).
          </div>
          <Btn
            color="purple"
            onClick={() => {
              if (doBuyBuilder()) closeScreen(props.screenKey);
            }}
          >
            <Icon name="diamonds" size={16} /> {SECOND_BUILDER_DIAMONDS}
          </Btn>
        </div>
      ) : (
        <div class="bq-note">Both builder queues are unlocked.</div>
      )}
      <div class="bq-close">
        <Btn color="gray" onClick={() => closeScreen(props.screenKey)}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}
