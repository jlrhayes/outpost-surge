// Shared UI building blocks. OWNER: meta agent (others may use freely; add new shared components in new files).
// More shared pieces live next to this file: ResourceBar, ItemIcon/ItemTile, RewardList, ConfirmModal,
// AnimatedNumber, QuantityPicker, Avatar, TimerBar.
import type { ComponentChildren } from 'preact';
import { closeScreen } from '../../core/nav';
import { sfx } from '../../core/audio';
import { clock } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import type { Cost, CurrencyId } from '../../core/types';
import { useGame } from '../../core/store';
import { Icon } from './Icon';

export type BtnColor = 'yellow' | 'green' | 'blue' | 'red' | 'gray' | 'purple';

export function Btn(props: {
  color?: BtnColor;
  small?: boolean;
  /** Extra-large call-to-action. */
  big?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ComponentChildren;
  class?: string;
  style?: any;
  /** Optional icon name shown before the label. */
  icon?: string;
}) {
  const cls = [
    'btn',
    `btn-${props.color ?? 'yellow'}`,
    props.small ? 'btn-small' : '',
    props.big ? 'btn-big' : '',
    props.class ?? '',
  ].join(' ');
  return (
    <button
      class={cls}
      disabled={props.disabled}
      style={props.style}
      onClick={(e) => {
        e.stopPropagation();
        if (props.disabled) {
          sfx.error();
          return;
        }
        sfx.click();
        props.onClick?.();
      }}
    >
      {props.icon && <Icon name={props.icon} size={props.small ? 16 : 20} />}
      {props.children}
    </button>
  );
}

/** Full-screen overlay panel with a title bar and close button. Use for every overlay screen. */
export function Screen(props: {
  title: string;
  children: ComponentChildren;
  onClose?: () => void;
  footer?: ComponentChildren;
  class?: string;
  /** Optional icon next to the title. */
  icon?: string;
  /** Optional element on the left of the header (e.g. a resource counter). */
  headerLeft?: ComponentChildren;
}) {
  return (
    <div class={'screen ' + (props.class ?? '')}>
      <div class="screen-header">
        {props.headerLeft && <div class="screen-header-left">{props.headerLeft}</div>}
        <div class="screen-title">
          {props.icon && <Icon name={props.icon} size={24} />}
          <span>{props.title}</span>
        </div>
        <button
          class="screen-close"
          onClick={() => {
            sfx.click();
            (props.onClose ?? (() => closeScreen()))();
          }}
          aria-label="Close"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div class="screen-body">{props.children}</div>
      {props.footer && <div class="screen-footer">{props.footer}</div>}
    </div>
  );
}

/** Centred dialog box over a dimmed background. */
export function Modal(props: { title?: string; children: ComponentChildren; onClose?: () => void; class?: string; noClose?: boolean }) {
  const close = props.onClose ?? (() => closeScreen());
  return (
    <div class="modal-backdrop" onClick={() => !props.noClose && close()}>
      <div class={'modal ' + (props.class ?? '')} onClick={(e) => e.stopPropagation()}>
        {props.title && <div class="modal-title">{props.title}</div>}
        {!props.noClose && (
          <button
            class="modal-close"
            aria-label="Close"
            onClick={() => {
              sfx.click();
              close();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
        {props.children}
      </div>
    </div>
  );
}

export function Bar(props: { value: number; max: number; color?: string; label?: string; height?: number; class?: string }) {
  const p = props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0;
  return (
    <div class={'bar ' + (props.class ?? '')} style={{ height: (props.height ?? 14) + 'px' }}>
      <div class="bar-fill" style={{ width: p * 100 + '%', background: props.color }} />
      {props.label && <div class="bar-label">{props.label}</div>}
    </div>
  );
}

/** Live countdown to `endsAt` (ms timestamp). */
export function Countdown(props: { endsAt: number }) {
  const t = clock.value;
  return <span class="countdown">{fmtDuration(props.endsAt - t)}</span>;
}

/** Renders a cost list; unaffordable entries turn red. */
export function CostView(props: { cost: Cost; size?: number }) {
  const s = useGame();
  return (
    <div class="cost">
      {(Object.entries(props.cost) as [CurrencyId, number][]).map(([k, v]) => (
        <span class={'cost-item ' + ((s.currencies[k] ?? 0) < v ? 'short' : '')} key={k}>
          <Icon name={k} size={props.size ?? 18} />
          {fmt(v)}
        </span>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: { tabs: { id: T; label: string; badge?: boolean; icon?: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div class="tabs">
      {props.tabs.map((t) => (
        <button
          key={t.id}
          class={'tab ' + (t.id === props.value ? 'active' : '')}
          onClick={() => {
            sfx.click();
            props.onChange(t.id);
          }}
        >
          {t.icon && <Icon name={t.icon} size={18} />}
          <span>{t.label}</span>
          {t.badge && <span class="badge-dot" />}
        </button>
      ))}
    </div>
  );
}

/** Small red notification dot to place on buttons (optionally with a count). */
export function RedDot(props: { count?: number } = {}) {
  if (props.count && props.count > 0) return <span class="badge-dot badge-count">{props.count > 99 ? '99+' : props.count}</span>;
  return <span class="badge-dot" />;
}

/** Section heading inside screens. */
export function SectionTitle(props: { children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="section-title">
      <span>{props.children}</span>
      {props.right && <span class="section-title-right">{props.right}</span>}
    </div>
  );
}

/** Simple on/off switch. */
export function Toggle(props: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      class={'toggle ' + (props.value ? 'on' : '')}
      role="switch"
      aria-checked={props.value}
      onClick={() => {
        sfx.click();
        props.onChange(!props.value);
      }}
    >
      <span class="toggle-knob" />
    </button>
  );
}
