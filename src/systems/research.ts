// OWNER: meta agent. Tech Center research: one timed research job at a time; levels grant bonuses & power.
import { game, mutate, type GameState } from '../core/store';
import type { BonusKey, Cost } from '../core/types';
import { bonusMult } from '../core/bonuses';
import { canAfford, spendIn } from '../core/economy';
import { emit } from '../core/events';
import { now } from '../core/tick';
import { isUnlocked } from '../core/unlocks';
import { buildingLevel } from './buildings';
import { ROW_TECH_LEVEL, TECHS, TECH_BY_ID, techCost, techTimeMs, type TechDef } from '../data/research';

export function techLevel(s: GameState, id: string): number {
  return s.meta.research[id] ?? 0;
}

export type TechStatus = 'maxed' | 'researching' | 'available' | 'locked';

export interface TechCheck {
  status: TechStatus;
  /** Unmet requirements ("Tech Center Lv 4", "Crop Rotation Lv 2"). */
  missing: string[];
}

export function techCenterLevelFor(def: TechDef): number {
  return ROW_TECH_LEVEL[Math.min(def.row, ROW_TECH_LEVEL.length - 1)];
}

export function checkTech(s: GameState, def: TechDef): TechCheck {
  const lv = techLevel(s, def.id);
  if (s.meta.researchJob?.techId === def.id) return { status: 'researching', missing: [] };
  if (lv >= def.maxLevel) return { status: 'maxed', missing: [] };
  const missing: string[] = [];
  const need = techCenterLevelFor(def);
  if (buildingLevel(s, 'tech') < need) missing.push(`Tech Center Lv ${need}`);
  for (const r of def.requires) {
    if (techLevel(s, r.id) < r.level) missing.push(`${TECH_BY_ID[r.id]?.name ?? r.id} Lv ${r.level}`);
  }
  return { status: missing.length ? 'locked' : 'available', missing };
}

export function researchCost(s: GameState, def: TechDef): Cost {
  return techCost(def, techLevel(s, def.id) + 1);
}

export function researchDurationMs(s: GameState, def: TechDef): number {
  return Math.max(1000, Math.round(techTimeMs(def, techLevel(s, def.id) + 1) / bonusMult(s, 'research_speed_pct')));
}

/** Starts researching the next level of a tech. Returns an error message or null. */
export function startResearch(id: string): string | null {
  const s = game;
  const def = TECH_BY_ID[id];
  if (!def) return 'Unknown research';
  if (!isUnlocked(s, 'research')) return 'Research is locked';
  if (buildingLevel(s, 'tech') < 1) return 'Build a Tech Center first';
  if (s.meta.researchJob) return 'Another research is in progress';
  const chk = checkTech(s, def);
  if (chk.status === 'maxed') return 'Already at max level';
  if (chk.status !== 'available') return `Requires ${chk.missing.join(', ')}`;
  const cost = researchCost(s, def);
  if (!canAfford(s, cost)) return 'Not enough resources';
  mutate((st) => {
    spendIn(st, cost);
    const t = now();
    st.meta.researchJob = { techId: id, startedAt: t, endsAt: t + researchDurationMs(st, def) };
  });
  return null;
}

/** 1 Hz: completes the research job. */
export function researchTicker(s: GameState, t: number): boolean {
  const job = s.meta.researchJob;
  if (!job || job.endsAt > t) return false;
  const lv = (s.meta.research[job.techId] ?? 0) + 1;
  s.meta.research[job.techId] = lv;
  s.meta.researchJob = null;
  const techId = job.techId;
  queueMicrotask(() => emit('research:done', { techId, level: lv }));
  return true;
}

/** Summed bonuses from all researched levels (bonus provider 'research'). */
export function researchBonuses(s: GameState): Partial<Record<BonusKey, number>> {
  const out: Partial<Record<BonusKey, number>> = {};
  for (const def of TECHS) {
    const lv = s.meta.research[def.id] ?? 0;
    if (!lv) continue;
    for (const [k, v] of Object.entries(def.bonus)) out[k] = (out[k] ?? 0) + (v ?? 0) * lv;
  }
  return out;
}

export function researchPower(s: GameState): number {
  let p = 0;
  for (const def of TECHS) p += (s.meta.research[def.id] ?? 0) * def.power;
  return p;
}

/** True when research is unlocked, a Tech Center exists, nothing is running and something is affordable. */
export function researchIdle(s: GameState): boolean {
  if (!isUnlocked(s, 'research') || buildingLevel(s, 'tech') < 1 || s.meta.researchJob) return false;
  return TECHS.some((d) => checkTech(s, d).status === 'available' && canAfford(s, researchCost(s, d)));
}
