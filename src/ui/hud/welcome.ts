// OWNER: meta agent. "Welcome back" summary: captures what completed while the game was closed
// (offline timers complete on the first ticks after boot) and estimates stored production.
import { signal } from '@preact/signals';
import { game, isNewGame } from '../../core/store';
import { on } from '../../core/events';
import { productionPerHour } from '../../systems/buildings';
import { BUILDING_LABEL } from '../../data/quests';
import { TECH_BY_ID } from '../../data/research';
import { fmt } from '../../core/format';
import type { Cost } from '../../core/types';

export interface WelcomeLine {
  icon: string;
  text: string;
}
export interface WelcomeSummary {
  awayMs: number;
  lines: WelcomeLine[];
  /** Estimated resources waiting in producers. */
  stored: Cost;
}

export const welcome = signal<WelcomeSummary | null>(null);

/** Minimum absence before the welcome-back popup is shown. */
const MIN_AWAY_MS = 3 * 60_000;
/** Producers stop after this long (GAME_REFERENCE §2.6). */
const STORAGE_CAP_H = 10;

export function startWelcomeCapture(): void {
  if (isNewGame) return;
  const away = Date.now() - (game.lastSeen || Date.now());
  if (away < MIN_AWAY_MS) return;
  const lines: WelcomeLine[] = [];
  const trained: Record<number, number> = {};
  let healed = 0;
  const offs = [
    on('building:upgraded', (p) => lines.push({ icon: 'upgrade', text: `${BUILDING_LABEL[p.type] ?? p.type} reached Lv ${p.level}` })),
    on('troops:trained', (p) => (trained[p.tier] = (trained[p.tier] ?? 0) + p.count)),
    on('troops:healed', (p) => (healed += p.count)),
    on('research:done', (p) => lines.push({ icon: 'flask', text: `Research complete: ${TECH_BY_ID[p.techId]?.name ?? p.techId} Lv ${p.level}` })),
  ];
  setTimeout(() => {
    offs.forEach((f) => f());
    for (const [t, n] of Object.entries(trained)) lines.push({ icon: 'troops', text: `Trained ${fmt(n)} T${t} soldiers` });
    if (healed) lines.push({ icon: 'hospital', text: `Healed ${fmt(healed)} wounded soldiers` });
    const hours = Math.min(away / 3_600_000, STORAGE_CAP_H);
    const stored: Cost = {};
    for (const r of ['food', 'iron', 'gold'] as const) {
      let v = 0;
      try {
        v = productionPerHour(game, r) * hours;
      } catch {
        v = 0;
      }
      if (v >= 1) stored[r] = Math.floor(v);
    }
    // Only greet when there is news, or after a long break.
    if (lines.length || Object.keys(stored).length || away >= 30 * 60_000) welcome.value = { awayMs: away, lines, stored };
  }, 2500);
}
