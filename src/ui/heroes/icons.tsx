// OWNER: heroes agent. Small inline SVG icons used by hero/battle screens.
import type { HeroRole, HeroType } from '../../core/types';
import { Icon, hasIcon } from '../components/Icon';

export const TYPE_COLOR: Record<HeroType, string> = { tank: '#7cc04a', aircraft: '#4ab0ff', missile: '#ff8a3a' };

export function TypeIcon(props: { type: HeroType; size?: number }) {
  const s = props.size ?? 18;
  const c = TYPE_COLOR[props.type];
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" class="type-icon">
      <circle cx="12" cy="12" r="11" fill="#0d1620" stroke={c} stroke-width="1.8" />
      {props.type === 'tank' && (
        <g fill={c}>
          <rect x="5" y="12" width="14" height="4.5" rx="2" />
          <rect x="8" y="8.5" width="7" height="4" rx="1" />
          <rect x="14" y="9.6" width="6" height="1.6" />
        </g>
      )}
      {props.type === 'aircraft' && <path d="M12 4 L13.2 10 L20 13 L20 14.5 L13 13 L12.6 17 L15 18.6 L15 19.6 L12 18.8 L9 19.6 L9 18.6 L11.4 17 L11 13 L4 14.5 L4 13 L10.8 10 Z" fill={c} />}
      {props.type === 'missile' && (
        <g fill={c}>
          <path d="M16.5 4.5 Q19.5 4.5 19.5 7.5 L11 16 L8 13 Z" />
          <path d="M8 13 L5 13.5 L7 11 Z M11 16 L10.5 19 L13 17 Z" />
          <path d="M7.2 16.8 L4.5 19.5" stroke={c} stroke-width="1.8" stroke-linecap="round" />
        </g>
      )}
    </svg>
  );
}

export function RoleIcon(props: { role: HeroRole; size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      {props.role === 'attack' && (
        <g stroke="#ff7a5a" stroke-width="2.2" fill="none" stroke-linecap="round">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </g>
      )}
      {props.role === 'defense' && <path d="M12 2 L20 5 L20 11 Q20 18 12 22 Q4 18 4 11 L4 5 Z" fill="#5ab0ff" stroke="#1a5a9a" stroke-width="1.4" />}
      {props.role === 'support' && <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#6ae07a" stroke="#1a7a2a" stroke-width="1.4" />}
    </svg>
  );
}

export function Stars(props: { n: number; max?: number; size?: number }) {
  const s = props.size ?? 12;
  const max = props.max ?? 5;
  return (
    <span class="stars">
      {Array.from({ length: max }, (_, i) => (
        <svg width={s} height={s} viewBox="0 0 24 24" key={i}>
          <path
            d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"
            fill={i < props.n ? '#ffd23c' : '#2a3a4a'}
            stroke={i < props.n ? '#a07810' : '#4a5a6a'}
            stroke-width="1.5"
          />
        </svg>
      ))}
    </span>
  );
}

const ITEM_ICONS: Record<string, (s: number) => preact.JSX.Element> = {
  recruit_ticket: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M2 7 Q2 5 4 5 L20 5 Q22 5 22 7 L22 9 Q20 9 20 12 Q20 15 22 15 L22 17 Q22 19 20 19 L4 19 Q2 19 2 17 L2 15 Q4 15 4 12 Q4 9 2 9 Z" fill="#ffcf3a" stroke="#a07810" stroke-width="1.2" />
      <path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2 9.5 15.6l.6-2.8L8 10.9l2.8-.3z" fill="#c05a10" />
    </svg>
  ),
  skill_medal: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M7 2h4l1 6-3 1zM17 2h-4l-1 6 3 1z" fill="#d04040" />
      <circle cx="12" cy="15" r="7" fill="#ffc83a" stroke="#a07810" stroke-width="1.4" />
      <path d="M12 11l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 17l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="#a0600a" />
    </svg>
  ),
  shard: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2 L19 9 L12 22 L5 9 Z" fill="#b25cff" stroke="#5a1aa0" stroke-width="1.2" />
      <path d="M12 2 L12 22 M5 9 L19 9" stroke="#e0c0ff" stroke-width="0.8" />
    </svg>
  ),
  shard_universal_ssr: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2 L19 9 L12 22 L5 9 Z" fill="#b25cff" stroke="#5a1aa0" stroke-width="1.2" />
      <circle cx="12" cy="10.5" r="3" fill="#ffffff" opacity="0.8" />
    </svg>
  ),
  shard_universal_ur: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2 L19 9 L12 22 L5 9 Z" fill="#ffae1a" stroke="#8a5a00" stroke-width="1.2" />
      <circle cx="12" cy="10.5" r="3" fill="#ffffff" opacity="0.8" />
    </svg>
  ),
  lock: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M7 10 V7 a5 5 0 0 1 10 0 V10" stroke="#c8d4e0" stroke-width="2.2" fill="none" />
      <rect x="5" y="10" width="14" height="11" rx="2" fill="#c8d4e0" />
      <circle cx="12" cy="15.5" r="1.8" fill="#3a4a5a" />
    </svg>
  ),
  truck: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="2" y="7" width="12" height="9" rx="1" fill="#c8a040" stroke="#6a5010" stroke-width="1.2" />
      <path d="M14 10h4l3 3v3h-7z" fill="#6a8a3a" stroke="#2f4a1a" stroke-width="1.2" />
      <circle cx="6.5" cy="17.5" r="2.2" fill="#222" />
      <circle cx="17.5" cy="17.5" r="2.2" fill="#222" />
      <path d="M4 10h8" stroke="#6a5010" stroke-width="1" />
    </svg>
  ),
  crown: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M3 8 L7.5 12 L12 5 L16.5 12 L21 8 L19 18 L5 18 Z" fill="#ffd23c" stroke="#a07810" stroke-width="1.3" />
    </svg>
  ),
  skull: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 3 Q20 3 20 11 Q20 14 17 15 L17 19 L7 19 L7 15 Q4 14 4 11 Q4 3 12 3 Z" fill="#dcd8cc" />
      <circle cx="9" cy="11" r="2" fill="#2a2a2a" />
      <circle cx="15" cy="11" r="2" fill="#2a2a2a" />
      <path d="M10 17v2M12 17v2M14 17v2" stroke="#2a2a2a" stroke-width="1" />
    </svg>
  ),
  swords: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M4 4 L14 14 M20 4 L10 14" stroke="#e8eef4" stroke-width="2.4" stroke-linecap="round" />
      <path d="M12 16 L8 20 M12 16 L16 20 M6 16 L9 19 M18 16 L15 19" stroke="#c8a040" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  ),
};

/** Ids drawn with the shared (meta) icon set so hero screens match the rest of the UI. */
const SHARED: Record<string, string> = {
  recruit_ticket: 'ticket',
  skill_medal: 'medal',
  shard: 'shard_ssr',
  shard_universal_ssr: 'shard_ssr',
  shard_universal_ur: 'shard_ur',
  lock: 'lock',
  truck: 'truck',
  skull: 'skull',
  swords: 'swords',
};

/** Icon for items/currencies used by hero screens (shared icon set first, local fallbacks). */
export function ItemIcon(props: { id: string; size?: number }) {
  const s = props.size ?? 18;
  const shared = SHARED[props.id];
  if (shared && hasIcon(shared)) return <Icon name={shared} size={s} />;
  const f = ITEM_ICONS[props.id];
  if (f) return <span class="icon">{f(s)}</span>;
  return <Icon name={props.id} size={s} />;
}
