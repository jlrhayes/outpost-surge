// OWNER: meta agent. 'quests' screen: current chapter's quest list + chapter chest.
import { useGame } from '../../core/store';
import { fmt } from '../../core/format';
import type { QuestGo } from '../../data/quests';
import { claimChapter, claimQuest, currentChapter, questGo, type QuestView } from '../../systems/quests';
import { Bar, Btn, Screen } from '../components/common';
import { Icon } from '../components/Icon';
import { RewardInline, RewardList } from '../components/RewardList';

export function questIcon(go: QuestGo | undefined): string {
  if (!go) return 'tasks';
  switch (go.kind) {
    case 'building':
      return go.type === 'hq' ? 'home' : 'hammer';
    case 'barracks':
      return 'troops';
    case 'hospital':
      return 'hospital';
    case 'research':
      return 'flask';
    case 'mode':
      return go.mode === 'world' ? 'globe' : 'swords';
    case 'screen':
      return (
        { campaign: 'skull', runnerLevels: 'truck', recruit: 'ticket', formation: 'formation', heroes: 'helmet', bag: 'speedup' } as Record<string, string>
      )[go.id] ?? 'tasks';
  }
}

function QuestCard(props: { q: QuestView }) {
  const { q } = props;
  return (
    <div class={'quest-card ' + (q.claimed ? 'claimed' : q.done ? 'done' : '')}>
      <div class="quest-card-icon">
        <Icon name={questIcon(q.def.go)} size={34} />
      </div>
      <div class="quest-card-main">
        <div class="quest-card-text">{q.def.text}</div>
        <Bar value={q.progress} max={q.def.target} height={14} label={`${fmt(q.progress)} / ${fmt(q.def.target)}`} color={q.done ? undefined : 'linear-gradient(#7cc4ff, #3a8ee8)'} />
        <RewardInline reward={q.def.reward} max={3} />
      </div>
      <div class="quest-card-action">
        {q.claimed ? (
          <Icon name="check" size={34} />
        ) : q.done ? (
          <Btn color="yellow" onClick={() => claimQuest(q.def.id)}>
            Claim
          </Btn>
        ) : (
          <Btn color="blue" onClick={() => questGo(q.def.go)}>
            Go
          </Btn>
        )}
      </div>
    </div>
  );
}

export function QuestsScreen() {
  const s = useGame();
  const cv = currentChapter(s);
  const ordered = [...cv.quests].sort((a, b) => rank(a) - rank(b));
  return (
    <Screen title="Chapter Quests" icon="tasks" class="quests-screen">
      <div class="chapter-banner">
        <div class="chapter-banner-left">
          <div class="chapter-num">Chapter {cv.chapter.index + 1}</div>
          <div class="chapter-title">{cv.chapter.title}</div>
          <Bar value={cv.claimedCount} max={cv.quests.length} height={16} label={`${cv.claimedCount} / ${cv.quests.length}`} color="linear-gradient(#ffe070, #f0a800)" />
        </div>
        <button class={'chapter-chest ' + (cv.complete ? 'ready' : '')} onClick={() => cv.complete && claimChapter()}>
          <Icon name="chest" size={58} />
          {cv.complete ? <span class="chapter-chest-label">OPEN!</span> : <span class="chapter-chest-label dim">Chest</span>}
        </button>
      </div>
      <div class="chapter-reward-preview">
        <span class="dim-text">Chapter reward</span>
        <RewardList reward={cv.chapter.reward} size={40} center={false} />
      </div>
      <div class="quest-list">
        {ordered.map((q) => (
          <QuestCard key={q.def.id} q={q} />
        ))}
      </div>
    </Screen>
  );
}

function rank(q: QuestView): number {
  if (q.done && !q.claimed) return 0;
  if (!q.claimed) return 1;
  return 2;
}
