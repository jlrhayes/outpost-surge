// OWNER: runner agent. Signals shared between the 3D RunnerMode (writer) and the RunnerHud (reader).
// The mode throttles high-frequency values (progress, boss HP) so the HUD re-renders ~10x/s at most.
import { signal } from '@preact/signals';
import type { RunOutcome } from './progress';
import type { WeaponKind } from '../../data/runner';

export interface BossHud {
  name: string;
  hp: number;
  max: number;
  big: boolean;
}

export interface WeaponHud {
  rate: number;
  dmg: number;
  multi: number;
  helpers: number;
  /** Current gun (weapon gates swap it) and its level. */
  gun: WeaponKind;
  gunLv: number;
}

export const runHud = {
  /** "Level 2-5" / "Prologue". */
  title: signal(''),
  subtitle: signal(''),
  intro: signal(false),
  /** 0..1 along the road to the boss arena. */
  progress: signal(0),
  paused: signal(false),
  boss: signal<BossHud | null>(null),
  /** Weapon upgrade levels (shown as chips). */
  weapon: signal<WeaponHud>({ rate: 1, dmg: 1, multi: 0, helpers: 0, gun: 'rifle', gunLv: 1 }),
  caption: signal<{ text: string; key: number } | null>(null),
  banner: signal<{ text: string; kind: 'info' | 'boss' | 'good' | 'bad'; key: number } | null>(null),
  dragHint: signal(false),
  /** Set once the run is over and rewards are recorded. */
  result: signal<RunOutcome | null>(null),
};

/** Actions the HUD can trigger; the active RunnerMode installs the handlers in enter(). */
export const runActions = {
  pause: (): void => {},
  resume: (): void => {},
  quit: (): void => {},
  retry: (): void => {},
};

let key = 0;
export function nextKey(): number {
  return ++key;
}
