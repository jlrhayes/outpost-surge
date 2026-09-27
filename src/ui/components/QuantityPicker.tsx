// Quantity selector: [-] slider [+] with a live number and a Max shortcut. OWNER: meta agent.
import { sfx } from '../../core/audio';
import { fmt } from '../../core/format';
import { Icon } from './Icon';

export function QuantityPicker(props: { value: number; min?: number; max: number; step?: number; onChange: (v: number) => void; showMax?: boolean }) {
  const min = props.min ?? (props.max > 0 ? 1 : 0);
  const max = Math.max(min, props.max);
  const step = props.step ?? 1;
  const set = (v: number) => props.onChange(Math.max(min, Math.min(max, Math.round(v))));
  const disabled = max <= min && props.max <= 0;
  const pct = max > min ? ((props.value - min) / (max - min)) * 100 : 100;
  return (
    <div class={'qty ' + (disabled ? 'disabled' : '')}>
      <button
        class="qty-btn"
        aria-label="Less"
        onClick={() => {
          sfx.click();
          set(props.value - step);
        }}
      >
        <Icon name="minus" size={16} />
      </button>
      <input
        class="qty-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={props.value}
        disabled={disabled}
        style={{ '--p': pct + '%' } as any}
        onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
      />
      <button
        class="qty-btn"
        aria-label="More"
        onClick={() => {
          sfx.click();
          set(props.value + step);
        }}
      >
        <Icon name="plus" size={16} />
      </button>
      <span class="qty-value">{fmt(props.value)}</span>
      {props.showMax !== false && (
        <button
          class="qty-max"
          onClick={() => {
            sfx.click();
            set(max);
          }}
        >
          MAX
        </button>
      )}
    </div>
  );
}
