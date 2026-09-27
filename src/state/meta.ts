// OWNER: meta agent. Troops, research, quests, daily tasks, items. Extend freely.

export interface TrainingJob {
  /** Barracks building uid doing the training. */
  barracksUid: string;
  tier: number;
  count: number;
  startedAt: number;
  endsAt: number;
}

export interface HealingJob {
  /** Hospital building uid the heal was started from (display only; hospitals share one queue). */
  hospitalUid: string;
  /** tier -> soldiers being healed */
  troops: Record<number, number>;
  startedAt: number;
  endsAt: number;
}

export interface ResearchJob {
  techId: string;
  startedAt: number;
  endsAt: number;
}

export interface MetaState {
  /** tier -> ready soldiers */
  troops: Record<number, number>;
  /** tier -> wounded soldiers waiting in hospital */
  wounded: Record<number, number>;
  training: TrainingJob[];
  healing: HealingJob | null;
  /** techId -> level */
  research: Record<string, number>;
  researchJob: ResearchJob | null;
  /**
   * Main (chapter) quest line. `index` = current chapter (0-based); `claimed` = quest ids claimed
   * in the current and past chapters.
   */
  quests: { index: number; claimed: string[] };
  /** Daily tasks: `date` = local day key; progress per task id; claimed task ids; claimed chest indices. */
  daily: { date: string; progress: Record<string, number>; claimed: string[]; chests: number[] };
}

export function defaultMetaState(): MetaState {
  return {
    troops: { 1: 200 },
    wounded: {},
    training: [],
    healing: null,
    research: {},
    researchJob: null,
    quests: { index: 0, claimed: [] },
    daily: { date: '', progress: {}, claimed: [], chests: [] },
  };
}
