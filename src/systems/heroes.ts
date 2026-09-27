// OWNER: heroes agent. Hero progression, squads, combat stat derivation.
// The exported functions below are a CONTRACT used by other modules (world map, HUD) — keep signatures.
import type { GameState } from '../core/store';
import type { Combatant } from '../core/types';

/**
 * Builds battle-ready combatants for a squad (side 'A'), including troop/research/building bonuses.
 * Empty slots are skipped. Returns [] if the squad has no heroes.
 */
export function squadCombatants(s: GameState, squadId: number): Combatant[] {
  return [];
}

/** Combat power of a squad (for UI and for comparing against enemy recommended power). */
export function squadPower(s: GameState, squadId: number): number {
  return 0;
}

/** True if the squad has at least one hero assigned. */
export function squadReady(s: GameState, squadId: number): boolean {
  const sq = s.heroes.squads.find((q) => q.id === squadId);
  return !!sq && sq.heroes.some((h) => h);
}
