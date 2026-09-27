// Resource counters: pill with icon + animated value, pulses green/red when the value changes. OWNER: meta agent.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { fmt } from '../../core/format';
import type { CurrencyId } from '../../core/types';
import { sfx } from '../../core/audio';
import { Icon } from './Icon';
import { AnimatedNumber } from './AnimatedNumber';

export function ResourcePill(props: { id: CurrencyId | string; value: number; onClick?: () => void; plus?: boolean; class?: string }) {
  const prev = useRef(props.value);
  const [pulse, setPulse] = useState<{ k: number; dir: 'up' | 'down' } | null>(null);
  useEffect(() => {
    if (props.value !== prev.current) {
      setPulse({ k: performance.now(), dir: props.value > prev.current ? 'up' : 'down' });
      prev.current = props.value;
    }
  }, [props.value]);
  return (
    <button
      class={'res-pill ' + (props.class ?? '')}
      onClick={(e) => {
        e.stopPropagation();
        sfx.click();
        props.onClick?.();
      }}
    >
      {/* keyed children restart their CSS animation on every change */}
      {pulse && <span class={'res-pill-flash flash-' + pulse.dir} key={'f' + pulse.k} />}
      <span class={'res-pill-icon' + (pulse ? ' pop' : '')} key={'i' + (pulse?.k ?? 0)}>
        <Icon name={props.id} size={22} />
      </span>
      <AnimatedNumber value={props.value} format={fmt} duration={600} class={'res-pill-value' + (pulse ? ' val-' + pulse.dir : '')} />
      {props.plus && <span class="res-pill-plus">+</span>}
    </button>
  );
}

/** Row of resource pills bound to the live state. */
export function ResourceBar(props: { ids?: CurrencyId[]; onClick?: (id: CurrencyId) => void; plus?: boolean }) {
  const s = useGame();
  const ids = props.ids ?? (['food', 'iron', 'gold', 'diamonds'] as CurrencyId[]);
  return (
    <div class="res-bar">
      {ids.map((id) => (
        <ResourcePill key={id} id={id} value={s.currencies[id] ?? 0} plus={props.plus} onClick={() => props.onClick?.(id)} />
      ))}
    </div>
  );
}
