// OWNER: meta agent. 'daily' screen: daily tasks -> activity points -> 5 chests (resets at local midnight).
import { game, useGame, type GameState } from '../../core/store';
import { clock } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { closeAllScreens, goTo, openScreen, route, toast } from '../../core/nav';
import { isUnlocked } from '../../core/unlocks';
import { lockHint } from '../components/lockHint';
import { buildingsOf } from '../../systems/buildings';
import {
  activityPoints,
  claimAllDailyTasks,
  claimDailyChest,
  claimDailyTask,
  DAILY_CHESTS,
  DAILY_MAX_POINTS,
  nextMidnight,
  taskProgress,
  visibleTasks,
  type DailyTaskDef,
} from '../../systems/daily';
import { Bar, Btn, Screen } from '../components/common';
import { Icon } from '../components/Icon';
import { RewardList } from '../components/RewardList';
import { useState } from 'preact/hooks';

function go(d: DailyTaskDef) {
  if (d.go?.mode) {
    goTo(d.go.mode);
    return;
  }
  const inBase = () => {
    if (route.value.mode !== 'base') goTo('base');
    else closeAllScreens();
  };
  if (d.id === 'train') {
    const b = buildingsOf(game, 'barracks').find((x) => x.level >= 1);
    inBase();
    if (b) openScreen('barracks', { uid: b.uid });
    else toast('Build a Barracks first', 'bad');
    return;
  }
  if (d.id === 'heal') {
    const b = buildingsOf(game, 'hospital').find((x) => x.level >= 1);
    inBase();
    if (b) openScreen('hospital', { uid: b.uid });
    else toast('Build a Hospital first', 'bad');
    return;
  }
  if (d.go?.screen) {
    inBase();
    openScreen(d.go.screen);
  }
}

export function DailyScreen() {
  const s = useGame();
  const t = clock.value;
  const [preview, setPreview] = useState<number | null>(null);
  if (!isUnlocked(s, 'daily')) {
    return (
      <Screen title="Daily Tasks" icon="calendar">
        <div class="empty-state">
          <Icon name="lock" size={64} />
          <div>{lockHint('daily')}</div>
        </div>
      </Screen>
    );
  }
  const pts = activityPoints(s);
  const tasks = visibleTasks(s);
  const ordered = [...tasks].sort((a, b) => rank(s, a) - rank(s, b));
  const anyClaim = tasks.some((d) => taskProgress(s, d.id) >= d.target && !s.meta.daily.claimed.includes(d.id));

  return (
    <Screen title="Daily Tasks" icon="calendar" class="daily-screen">
      <div class="daily-header card">
        <div class="daily-points">
          <div class="daily-points-num">
            <Icon name="star" size={28} />
            <span>{pts}</span>
          </div>
          <div class="dim-text">Activity</div>
        </div>
        <div class="daily-track">
          <Bar value={pts} max={DAILY_MAX_POINTS} height={16} color="linear-gradient(#ffe070, #f0a800)" />
          <div class="daily-chests">
            {DAILY_CHESTS.map((c, i) => {
              const claimed = s.meta.daily.chests.includes(i);
              const ready = pts >= c.points && !claimed;
              return (
                <button
                  key={i}
                  class={'daily-chest ' + (ready ? 'ready' : '') + (claimed ? ' claimed' : '')}
                  style={{ left: (c.points / DAILY_MAX_POINTS) * 100 + '%' }}
                  onClick={() => {
                    if (ready) claimDailyChest(i);
                    else setPreview(preview === i ? null : i);
                  }}
                >
                  <Icon name={claimed ? 'chest_open' : 'chest'} size={i === 4 ? 40 : 32} />
                  <span class="daily-chest-pts">{c.points}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {preview !== null && (
        <div class="daily-preview card" onClick={() => setPreview(null)}>
          <div class="dim-text">Chest at {DAILY_CHESTS[preview].points} activity</div>
          <RewardList reward={DAILY_CHESTS[preview].reward} size={44} />
        </div>
      )}
      <div class="daily-sub">
        <span class="dim-text">
          <Icon name="clock" size={14} /> Resets in {fmtDuration(nextMidnight(t) - t)}
        </span>
        {anyClaim && (
          <Btn small color="yellow" onClick={() => claimAllDailyTasks()}>
            Claim All
          </Btn>
        )}
      </div>
      <div class="quest-list">
        {ordered.map((d) => {
          const p = Math.min(d.target, taskProgress(s, d.id));
          const done = p >= d.target;
          const claimed = s.meta.daily.claimed.includes(d.id);
          return (
            <div key={d.id} class={'quest-card ' + (claimed ? 'claimed' : done ? 'done' : '')}>
              <div class="quest-card-icon">
                <Icon name={d.icon} size={32} />
              </div>
              <div class="quest-card-main">
                <div class="quest-card-text">{d.text}</div>
                <Bar value={p} max={d.target} height={14} label={`${fmt(p)} / ${fmt(d.target)}`} color={done ? undefined : 'linear-gradient(#7cc4ff, #3a8ee8)'} />
              </div>
              <div class="daily-pts-badge">+{d.points}</div>
              <div class="quest-card-action">
                {claimed ? (
                  <Icon name="check" size={32} />
                ) : done ? (
                  <Btn color="yellow" small onClick={() => claimDailyTask(d.id)}>
                    Claim
                  </Btn>
                ) : d.id !== 'login' && (d.go || d.id === 'train' || d.id === 'heal') ? (
                  <Btn color="blue" small onClick={() => go(d)}>
                    Go
                  </Btn>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

function rank(s: GameState, d: DailyTaskDef): number {
  const done = taskProgress(s, d.id) >= d.target;
  const claimed = s.meta.daily.claimed.includes(d.id);
  if (done && !claimed) return 0;
  if (!claimed) return 1;
  return 2;
}
