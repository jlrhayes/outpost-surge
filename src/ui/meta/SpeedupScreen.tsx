// OWNER: meta agent. 'speedup' screen: use speed-up items or diamonds on any timer.
// Props contract: { title, getEndsAt: () => number | null, apply: (ms) => void, onFinishNow?: () => void }.
import { useEffect } from 'preact/hooks';
import { game, mutate, useGame } from '../../core/store';
import { clock, now, runTickers } from '../../core/tick';
import { closeScreen, toast } from '../../core/nav';
import { emit } from '../../core/events';
import { spendIn } from '../../core/economy';
import { fmtDuration } from '../../core/format';
import { sfx } from '../../core/audio';
import type { ItemId } from '../../core/types';
import { itemDef } from '../../data/items';
import { consumeSpeedupsIn, instantFinishCost, planSpeedups, speedupIds, speedupMs } from '../../systems/items';
import { Btn, Modal } from '../components/common';
import { Icon } from '../components/Icon';
import { ItemTile } from '../components/ItemIcon';
import { confirmDialog } from '../components/ConfirmModal';

export interface SpeedupProps {
  title: string;
  getEndsAt: () => number | null;
  apply: (ms: number) => void;
  onFinishNow?: () => void;
  screenKey: number;
}

export function SpeedupScreen(props: SpeedupProps) {
  const s = useGame();
  const t = clock.value;
  let endsAt: number | null = null;
  try {
    endsAt = props.getEndsAt();
  } catch {
    endsAt = null;
  }
  const remaining = endsAt ? Math.max(0, endsAt - t) : 0;
  const done = !endsAt || remaining <= 0;

  useEffect(() => {
    if (done) closeScreen(props.screenKey);
  }, [done]);

  const finishIfDone = () => {
    const e = props.getEndsAt();
    if (!e || e <= now()) {
      if (props.onFinishNow) props.onFinishNow();
      runTickers();
      sfx.upgrade();
    }
  };

  const useItems = (plan: Partial<Record<ItemId, number>>) => {
    let ms = 0;
    mutate((st) => {
      ms = consumeSpeedupsIn(st, plan);
    });
    if (ms <= 0) return;
    props.apply(ms);
    const minutes = Math.round(ms / 60_000);
    emit('speedup:used', { minutes });
    for (const [id, n] of Object.entries(plan)) if (n) emit('item:used', { itemId: id, count: n });
    sfx.click();
    toast(`-${fmtDuration(ms)}`, 'good');
    finishIfDone();
  };

  const useOne = (id: ItemId, n: number) => {
    if ((game.items[id] ?? 0) < n) return;
    useItems({ [id]: n });
  };

  const best = planSpeedups(s, remaining);
  const bestEntries = Object.entries(best.plan).filter(([, n]) => n) as [ItemId, number][];
  const diamonds = instantFinishCost(remaining);

  const finishNow = () => {
    const cost = instantFinishCost(Math.max(0, (props.getEndsAt() ?? 0) - now()));
    let ok = false;
    mutate((st) => {
      ok = spendIn(st, { diamonds: cost });
    });
    if (!ok) {
      toast('Not enough Diamonds', 'bad');
      return;
    }
    const left = Math.max(0, (props.getEndsAt() ?? 0) - now());
    props.apply(left + 1000);
    emit('speedup:used', { minutes: Math.round(left / 60_000) });
    finishIfDone();
  };

  return (
    <Modal title={props.title || 'Speed Up'} class="speedup-modal" onClose={() => closeScreen(props.screenKey)}>
      <div class="speedup-remaining">
        <Icon name="clock" size={26} />
        <span class="speedup-time">{fmtDuration(remaining)}</span>
        <span class="speedup-left">remaining</span>
      </div>

      <div class="speedup-best card">
        <div class="speedup-best-info">
          <div class="speedup-best-title">Smart Use</div>
          {bestEntries.length ? (
            <div class="speedup-plan">
              {bestEntries.map(([id, n]) => (
                <span class="speedup-plan-item" key={id}>
                  <Icon name={itemDef(id).icon} size={22} />×{n}
                </span>
              ))}
              <span class="speedup-plan-total">
                −{fmtDuration(Math.min(best.totalMs, remaining))}
                {best.totalMs >= remaining ? ' (finishes)' : ''}
              </span>
            </div>
          ) : (
            <div class="dim-text">No speed-up items</div>
          )}
        </div>
        <Btn color="green" disabled={!bestEntries.length} onClick={() => useItems(best.plan)}>
          Use Best
        </Btn>
      </div>

      <div class="speedup-list">
        {speedupIds().map((id) => {
          const have = s.items[id] ?? 0;
          const size = speedupMs(id);
          const need = Math.max(1, Math.min(have, Math.ceil(remaining / size)));
          const def = itemDef(id);
          return (
            <div class={'speedup-row ' + (have ? '' : 'empty')} key={id}>
              <ItemTile id={id} count={have} size={50} />
              <div class="speedup-row-info">
                <div class="speedup-row-name">{def.name}</div>
                <div class="dim-text">Owned: {have}</div>
              </div>
              {have > 1 && need > 1 && (
                <Btn small color="blue" onClick={() => useOne(id, need)}>
                  ×{need}
                </Btn>
              )}
              <Btn small color="green" disabled={!have} onClick={() => useOne(id, 1)}>
                Use
              </Btn>
            </div>
          );
        })}
      </div>

      <div class="speedup-instant">
        <div>
          <div class="speedup-best-title">Finish Instantly</div>
          <div class="dim-text">Spend diamonds to complete right now</div>
        </div>
        <Btn
          color="purple"
          disabled={s.currencies.diamonds < diamonds}
          onClick={() =>
            diamonds >= 100
              ? confirmDialog({
                  title: 'Finish Now?',
                  text: `Spend ${diamonds} Diamonds to finish instantly?`,
                  icon: 'diamonds',
                  confirmLabel: 'Finish',
                  color: 'purple',
                  onConfirm: finishNow,
                })
              : finishNow()
          }
        >
          <Icon name="diamonds" size={18} /> {diamonds}
        </Btn>
      </div>
    </Modal>
  );
}
