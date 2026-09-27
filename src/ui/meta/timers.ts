// OWNER: meta agent. Opens the shared 'speedup' screen for this module's own timers.
import { game, mutate } from '../../core/store';
import { openScreen } from '../../core/nav';
import { troopTier } from '../../data/troops';
import { TECH_BY_ID } from '../../data/research';

export function openTrainingSpeedup(barracksUid: string): void {
  const j = game.meta.training.find((x) => x.barracksUid === barracksUid);
  if (!j) return;
  openScreen('speedup', {
    title: `Training ${troopTier(j.tier).name}s`,
    getEndsAt: () => game.meta.training.find((x) => x.barracksUid === barracksUid)?.endsAt ?? null,
    apply: (ms: number) =>
      mutate((s) => {
        const job = s.meta.training.find((x) => x.barracksUid === barracksUid);
        if (job) job.endsAt -= ms;
      }),
  });
}

export function openHealingSpeedup(): void {
  if (!game.meta.healing) return;
  openScreen('speedup', {
    title: 'Healing',
    getEndsAt: () => game.meta.healing?.endsAt ?? null,
    apply: (ms: number) =>
      mutate((s) => {
        if (s.meta.healing) s.meta.healing.endsAt -= ms;
      }),
  });
}

export function openResearchSpeedup(): void {
  const j = game.meta.researchJob;
  if (!j) return;
  openScreen('speedup', {
    title: `Research: ${TECH_BY_ID[j.techId]?.name ?? j.techId}`,
    getEndsAt: () => game.meta.researchJob?.endsAt ?? null,
    apply: (ms: number) =>
      mutate((s) => {
        if (s.meta.researchJob) s.meta.researchJob.endsAt -= ms;
      }),
  });
}
