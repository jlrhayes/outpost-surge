// OWNER: heroes agent. Deterministic auto-battle simulation between two formations.
// CONTRACT: simulateBattle(), BattleResult, BattleEvent and startBattle() are used by the world map and campaign.
import type { Combatant } from '../core/types';
import { goTo } from '../core/nav';

export type BattleEvent =
  | { t: number; kind: 'attack'; from: string; to: string; dmg: number; crit?: boolean }
  | { t: number; kind: 'skill'; from: string; skillId: string; targets: string[]; dmg: number[] }
  | { t: number; kind: 'heal'; from: string; to: string; amount: number }
  | { t: number; kind: 'death'; uid: string };

export interface BattleResult {
  winner: 'A' | 'B';
  /** Time-ordered events (t in seconds) for playback in the battle scene. */
  events: BattleEvent[];
  /** Final HP of every combatant by uid. */
  finalHp: Record<string, number>;
  duration: number;
  /** Fraction (0-1) of side A's total HP lost; used for troop losses (wounded). */
  lossRatioA: number;
}

export function simulateBattle(a: Combatant[], b: Combatant[], seed = 1): BattleResult {
  return { winner: 'A', events: [], finalHp: {}, duration: 0, lossRatioA: 0 };
}

export interface BattleRequest {
  title: string;
  attackers: Combatant[];
  defenders: Combatant[];
  seed?: number;
  /** Background/arena flavour for the scene. */
  arena?: 'road' | 'wasteland' | 'city';
  /** Called when the player leaves the result screen. Use it to grant rewards and navigate onward. */
  onFinish: (result: BattleResult) => void;
  /** Mode to return to after the battle (default 'base'). */
  returnTo?: 'base' | 'world';
}

/** Opens the 3D battle playback mode. The result is computed up-front with simulateBattle. */
export function startBattle(req: BattleRequest): void {
  goTo('battle', req);
}
