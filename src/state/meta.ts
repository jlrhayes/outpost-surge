// OWNER: meta agent. Troops, research, quests, daily tasks, items. Extend freely.

export interface TrainingJob {
  /** Barracks building uid doing the training. */
  barracksUid: string;
  tier: number;
  count: number;
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
  /** techId -> level */
  research: Record<string, number>;
  researchJob: ResearchJob | null;
  /** Main (chapter) quest line. */
  quests: { index: number; claimed: string[] };
  daily: { date: string; progress: Record<string, number>; claimed: string[]; chests: number[] };
}

export function defaultMetaState(): MetaState {
  return {
    troops: { 1: 200 },
    wounded: {},
    training: [],
    research: {},
    researchJob: null,
    quests: { index: 0, claimed: [] },
    daily: { date: '', progress: {}, claimed: [], chests: [] },
  };
}
