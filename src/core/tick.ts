// 1 Hz simulation tick for timers (upgrades, training, research, marches, stamina regen).
// Tickers run inside mutate() only when at least one reports a change, so UI re-renders stay cheap.
import { game, mutate, type GameState } from './store';

/** Return true if the ticker changed state. Tickers must be idempotent and use absolute timestamps. */
type Ticker = (s: GameState, now: number) => boolean;
const tickers = new Map<string, Ticker>();

export function registerTicker(name: string, fn: Ticker): void {
  tickers.set(name, fn);
}

/** Current time in ms. Use this everywhere (not Date.now) so a debug time-offset works. */
let timeOffset = 0;
export function now(): number {
  return Date.now() + timeOffset;
}
/** Debug helper: skip ahead in time. */
export function debugSkip(ms: number): void {
  timeOffset += ms;
}

/** Seconds-resolution clock signal for countdown UIs. */
import { signal } from '@preact/signals';
export const clock = signal(now());

export function runTickers(): void {
  const t = now();
  clock.value = t;
  let changed = false;
  // Run against the live state first; only notify if something changed.
  for (const [name, fn] of tickers) {
    try {
      if (fn(game, t)) changed = true;
    } catch (e) {
      console.error(`ticker ${name} failed`, e);
    }
  }
  if (changed) mutate(() => {});
}

export function startTicking(): void {
  runTickers();
  setInterval(runTickers, 1000);
}
