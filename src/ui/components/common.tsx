// Shared UI building blocks. OWNER: meta agent (others may use freely; add new shared components in new files).
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
  disabled?: boolean;
  onClick?: () => void;
  children: ComponentChildren;
  class?: string;
  style?: any;
}) {
  const cls = ['btn', `btn-${props.color ?? 'yellow'}`, props.small ? 'btn-small' : '', props.class ?? ''].join(' ');
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
}) {
  return (
    <div class={'screen ' + (props.class ?? '')}>
      <div class="screen-header">
        <div class="screen-title">{props.title}</div>
        <button
          class="screen-close"
          onClick={() => {
            sfx.click();
            (props.onClose ?? (() => closeScreen()))();
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div class="screen-body">{props.children}</div>
      {props.footer && <div class="screen-footer">{props.footer}</div>}
    </div>
  );
}

/** Centred dialog box over a dimmed background. */
export function Modal(props: { title?: string; children: ComponentChildren; onClose?: () => void }) {
  return (
    <div class="modal-backdrop" onClick={() => (props.onClose ?? (() => closeScreen()))()}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        {props.title && <div class="modal-title">{props.title}</div>}
        {props.children}
      </div>
    </div>
  );
}

export function Bar(props: { value: number; max: number; color?: string; label?: string; height?: number }) {
  const p = props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0;
  return (
    <div class="bar" style={{ height: (props.height ?? 14) + 'px' }}>
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
export function CostView(props: { cost: Cost }) {
  const s = useGame();
  return (
    <div class="cost">
      {(Object.entries(props.cost) as [CurrencyId, number][]).map(([k, v]) => (
        <span class={'cost-item ' + ((s.currencies[k] ?? 0) < v ? 'short' : '')} key={k}>
          <Icon name={k} size={16} />
          {fmt(v)}
        </span>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: { tabs: { id: T; label: string; badge?: boolean }[]; value: T; onChange: (id: T) => void }) {
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
          {t.label}
          {t.badge && <span class="badge-dot" />}
        </button>
      ))}
    </div>
  );
}

/** Small red notification dot to place on buttons. */
export function RedDot() {
  return <span class="badge-dot" />;
}
