// OWNER: meta agent. Chapter quest progress, claiming, chapter chests and "Go" navigation.
import { game, mutate, type GameState } from '../core/store';
import { grantIn } from '../core/economy';
import { emit } from '../core/events';
import { closeAllScreens, focusBuilding, goTo, openScreen, route, toast } from '../core/nav';
import { isUnlocked } from '../core/unlocks';
import { lockHint } from '../ui/components/lockHint';
import { sfx } from '../core/audio';
import { buildingLevel, buildingsOf } from './buildings';
import { getChapter, type ChapterDef, type QuestDef, type QuestGo } from '../data/quests';
import { rewardSummary } from './items';

export interface QuestView {
  def: QuestDef;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export function questView(s: GameState, def: QuestDef): QuestView {
  let p = 0;
  try {
    p = def.progress(s);
  } catch {
    p = 0;
  }
  const progress = Math.max(0, Math.min(def.target, Math.floor(p)));
  return { def, progress, done: progress >= def.target, claimed: s.meta.quests.claimed.includes(def.id) };
}

export interface ChapterView {
  chapter: ChapterDef;
  quests: QuestView[];
  claimedCount: number;
  /** All quests claimed: the chapter chest can be opened. */
  complete: boolean;
}

export function currentChapter(s: GameState): ChapterView {
  const chapter = getChapter(s.meta.quests.index);
  const quests = chapter.quests.map((d) => questView(s, d));
  const claimedCount = quests.filter((q) => q.claimed).length;
  return { chapter, quests, claimedCount, complete: claimedCount === quests.length };
}

/** The quest the left-side tracker shows: a claimable one first, otherwise the first unfinished one. */
export function trackedQuest(s: GameState): QuestView | null {
  const { quests } = currentChapter(s);
  return quests.find((q) => q.done && !q.claimed) ?? quests.find((q) => !q.claimed) ?? null;
}

/** Number of things to claim in the quest screen (quests + chapter chest). */
export function questsClaimable(s: GameState): number {
  const cv = currentChapter(s);
  return cv.quests.filter((q) => q.done && !q.claimed).length + (cv.complete ? 1 : 0);
}

export function claimQuest(id: string): boolean {
  const cv = currentChapter(game);
  const qv = cv.quests.find((q) => q.def.id === id);
  if (!qv || qv.claimed || !qv.done) return false;
  mutate((s) => {
    grantIn(s, qv.def.reward);
    s.meta.quests.claimed.push(id);
  });
  emit('quest:claimed', { questId: id });
  sfx.reward();
  toast(`Quest complete! ${rewardSummary(qv.def.reward)}`, 'good');
  return true;
}

export function claimChapter(): boolean {
  const cv = currentChapter(game);
  if (!cv.complete) return false;
  const reward = cv.chapter.reward;
  const title = `Chapter ${cv.chapter.index + 1} Complete!`;
  const ids = new Set(cv.chapter.quests.map((q) => q.id));
  mutate((s) => {
    grantIn(s, reward);
    s.meta.quests.index++;
    // Keep the claimed list small: drop ids from the finished chapter.
    s.meta.quests.claimed = s.meta.quests.claimed.filter((c) => !ids.has(c));
  });
  sfx.win();
  openScreen('rewards', { title, reward });
  return true;
}

function ensureBase(): void {
  if (route.value.mode !== 'base') goTo('base');
  else closeAllScreens();
}

/** Executes a quest's "Go" target. */
export function questGo(go: QuestGo | undefined): void {
  const s = game;
  if (!go) return;
  switch (go.kind) {
    case 'building':
      focusBuilding({ type: go.type, openPanel: go.openPanel });
      return;
    case 'screen':
      if (go.feature && !isUnlocked(s, go.feature)) {
        toast(lockHint(go.feature), 'bad');
        return;
      }
      ensureBase();
      openScreen(go.id, go.props);
      return;
    case 'mode':
      if (go.feature && !isUnlocked(s, go.feature)) {
        toast(lockHint(go.feature), 'bad');
        return;
      }
      goTo(go.mode, go.params);
      return;
    case 'barracks': {
      const b = buildingsOf(s, 'barracks').find((x) => x.level >= 1);
      if (b) {
        ensureBase();
        openScreen('barracks', { uid: b.uid });
      } else focusBuilding({ type: 'barracks', openPanel: true });
      return;
    }
    case 'hospital': {
      const b = buildingsOf(s, 'hospital').find((x) => x.level >= 1);
      if (b) {
        ensureBase();
        openScreen('hospital', { uid: b.uid });
      } else focusBuilding({ type: 'hospital', openPanel: true });
      return;
    }
    case 'research':
      if (!isUnlocked(s, 'research')) {
        toast(lockHint('research'), 'bad');
        return;
      }
      if (buildingLevel(s, 'tech') >= 1) {
        ensureBase();
        openScreen('research');
      } else focusBuilding({ type: 'tech', openPanel: true });
      return;
  }
}
