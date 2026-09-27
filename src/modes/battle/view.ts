// OWNER: heroes agent. Shared state between the battle 3D mode (BattleMode) and its HUD (BattleHud).
import { signal } from '@preact/signals';
import type { BattleRequest, BattleResult } from '../../systems/battle';

export type BattlePhase = 'intro' | 'fight' | 'outro' | 'result';

export interface UnitSnapshot {
  uid: string;
  side: 'A' | 'B';
  slot: number;
  name: string;
  heroId?: string;
  model: string;
  hp: number;
  maxHp: number;
  energy: number;
  hasActive: boolean;
  alive: boolean;
}

export interface BattleViewState {
  req: BattleRequest | null;
  result: BattleResult | null;
  phase: BattlePhase;
  speed: number;
  /** Simulation time being shown (s). */
  time: number;
  units: UnitSnapshot[];
}

export const battleView = signal<BattleViewState>({ req: null, result: null, phase: 'intro', speed: 1, time: 0, units: [] });

export interface Callout {
  id: number;
  side: 'A' | 'B';
  heroId?: string;
  model?: string;
  who: string;
  skill: string;
}
export const callouts = signal<Callout[]>([]);

/** Big centre banner text (e.g. "FIGHT!"). */
export const banner = signal<{ id: number; text: string; kind: 'start' | 'win' | 'lose' } | null>(null);

/** Controls the HUD can call; implemented by BattleMode. */
export const battleControls = {
  setSpeed: (_s: number) => {},
  skip: () => {},
  finish: () => {},
};

/** DOM container (owned by BattleHud) where BattleMode draws HP bars and damage numbers. */
export let overlayHost: HTMLElement | null = null;
export function setOverlayHost(el: HTMLElement | null): void {
  overlayHost = el;
}

/** Remembered x1/x2 choice across battles (per session). */
export let preferredSpeed = 1;
export function setPreferredSpeed(s: number): void {
  preferredSpeed = s;
}
