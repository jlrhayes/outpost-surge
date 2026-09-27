// OWNER: runner agent. "Special Ops" level select (screen id `runnerLevels`): 6 chapters x 8 levels,
// stars, lock state + hints, a level preview with threats and rewards, and a Play button.
import { useMemo, useState } from 'preact/hooks';
import { mutate, useGame } from '../../core/store';
import { closeScreen, goTo } from '../../core/nav';
import { sfx } from '../../core/audio';
import { Icon } from '../../ui/components/Icon';
import { Btn, Countdown, Screen } from '../../ui/components/common';
import { clock } from '../../core/tick';
import { CHAPTERS, LEVEL_COUNT, LEVELS_PER_CHAPTER, chapterOf, isBossLevel, levelDef, levelLabel, type ZombieKind } from '../../data/runner';
import { chapterLock, chapterStars, isCleared, levelLock, levelReward, passesNow, PASS_MAX, totalStars, TROOP_CAP_FIRST, TROOP_CAP_REPLAY } from './progress';
import { RewardList } from '../../ui/components/RewardList';
import { registerRunnerIcons } from './icons';
import './runner.css';

registerRunnerIcons();

const THREAT_NAMES: Record<ZombieKind, string> = { walker: 'Walkers', runner: 'Sprinters', elite: 'Elites', brute: 'Brutes', spitter: 'Spitters' };

export function RunnerLevels(props: { screenKey?: number }) {
  const s = useGame();
  const nextLevel = Math.min(LEVEL_COUNT, s.runner.level);
  // Reopen on the remembered level only while it is still uncleared; otherwise jump to the next new level
  // (so players aren't steered into spending replay passes).
  const remembered = s.runner.lastSelected;
  const initial = remembered > 0 && remembered <= nextLevel && !isCleared(s, remembered) ? remembered : nextLevel;
  const [sel, setSel] = useState(initial);
  const [chapter, setChapter] = useState(chapterOf(initial));
  const chLock = chapterLock(s, chapter);
  const ch = CHAPTERS[chapter - 1];
  const first = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
  const selInChapter = chapterOf(sel) === chapter;
  const lock = levelLock(s, sel);
  const cleared = isCleared(s, sel);
  const def = useMemo(() => levelDef(sel), [sel]);
  const bestStars = s.runner.stars[sel] ?? 0;
  const preview = levelReward(s, sel, cleared ? TROOP_CAP_REPLAY * 2 : TROOP_CAP_FIRST, 3, !cleared);
  const pass = passesNow(s, clock.value);
  const practice = cleared && pass.passes <= 0;

  const pickChapter = (c: number) => {
    sfx.click();
    setChapter(c);
    const firstOf = (c - 1) * LEVELS_PER_CHAPTER + 1;
    setSel(Math.max(firstOf, Math.min(firstOf + LEVELS_PER_CHAPTER - 1, nextLevel)));
  };

  const play = () => {
    mutate((st) => {
      st.runner.lastSelected = sel;
    });
    closeScreen(props.screenKey);
    goTo('runner', { level: sel });
  };

  return (
    <Screen title="Special Ops" class="rn-levels">
      <div class="rn-lv-head">
        <div class="rn-lv-stars">
          <Icon name="rn_star" size={20} /> {totalStars(s)} / {LEVEL_COUNT * 3}
        </div>
        <div class="rn-lv-hint">Surviving soldiers return as troops (up to {TROOP_CAP_FIRST} per level)</div>
      </div>
      <div class="rn-passes">
        <span class="rn-passes-label">Replay passes</span>
        <span class="rn-passes-pips">
          {Array.from({ length: PASS_MAX }, (_, i) => (
            <i key={i} class={i < pass.passes ? 'on' : ''} />
          ))}
        </span>
        <b>
          {pass.passes}/{PASS_MAX}
        </b>
        {pass.nextAt > 0 && (
          <span class="rn-passes-next">
            +1 in <Countdown endsAt={pass.nextAt} />
          </span>
        )}
      </div>
      <div class="rn-ch-tabs">
        {CHAPTERS.map((c) => {
          const locked = !!chapterLock(s, c.id);
          return (
            <button key={c.id} class={'rn-ch-tab ' + (c.id === chapter ? 'active ' : '') + (locked ? 'locked' : '')} onClick={() => pickChapter(c.id)}>
              {locked ? <Icon name="rn_lock" size={16} /> : <span>{c.id}</span>}
            </button>
          );
        })}
      </div>
      <div class={'rn-ch-card theme-' + ch.theme}>
        <div class="rn-ch-name">
          Chapter {ch.id}: {ch.name}
        </div>
        <div class="rn-ch-tag">{ch.tagline}</div>
        <div class="rn-ch-meta">
          <span>
            <Icon name="rn_star" size={16} /> {chapterStars(s, chapter)} / {LEVELS_PER_CHAPTER * 3}
          </span>
          {chLock ? <span class="rn-lock-hint">{chLock}</span> : <span class="rn-ok">Unlocked</span>}
        </div>
      </div>
      <div class="rn-path">
        {Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
          const lv = first + i;
          const st = s.runner.stars[lv] ?? 0;
          const lk = !!levelLock(s, lv);
          const done = isCleared(s, lv);
          const cur = lv === s.runner.level && !lk;
          const boss = isBossLevel(lv);
          return (
            <button
              key={lv}
              class={'rn-node ' + (lv === sel ? 'sel ' : '') + (lk ? 'locked ' : '') + (done ? 'done ' : '') + (cur ? 'cur ' : '') + (boss ? 'boss ' : '') + (i % 2 ? 'odd' : 'even')}
              onClick={() => {
                sfx.click();
                setSel(lv);
              }}
            >
              <div class="rn-node-disc">{lk ? <Icon name="rn_lock" size={20} /> : boss ? <Icon name="rn_skull" size={26} /> : <span>{i + 1}</span>}</div>
              <div class="rn-node-stars">
                {[1, 2, 3].map((k) => (
                  <Icon key={k} name={k <= st ? 'rn_star' : 'rn_starEmpty'} size={12} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      {selInChapter && (
        <div class="rn-detail card">
          <div class="rn-detail-head">
            <div class="rn-detail-title">
              Level {levelLabel(sel)} {isBossLevel(sel) && <span class="rn-boss-tag">BOSS</span>}
            </div>
            <div class="rn-detail-best">
              {[1, 2, 3].map((k) => (
                <Icon key={k} name={k <= bestStars ? 'rn_star' : 'rn_starEmpty'} size={18} />
              ))}
            </div>
          </div>
          <div class="rn-threats">
            {def.hazards.length > 0 && (
              <span class="rn-threat hazard">
                <Icon name="rn_hazard" size={20} />
                {def.hazards.some((h) => h.kind === 'wire') && def.hazards.some((h) => h.kind === 'spikes') ? 'Traps' : def.hazards[0].kind === 'wire' ? 'Barbed wire' : 'Spike strip'}
              </span>
            )}
            {def.threats.map((t) => (
              <span class="rn-threat" key={t}>
                <Icon name={'rn_' + t} size={20} />
                {THREAT_NAMES[t]}
              </span>
            ))}
            <span class="rn-threat boss">
              <Icon name="rn_skull" size={20} />
              {def.boss.name}
            </span>
          </div>
          <div class="rn-detail-sub">{cleared ? (practice ? 'Practice run: no rewards' : 'Replay rewards (up to): uses 1 pass on victory') : 'First clear rewards (up to)'}</div>
          {practice ? (
            <div class="rn-practice">
              No replay passes left. You can still play for stars; the next pass arrives in <Countdown endsAt={pass.nextAt} />.
            </div>
          ) : (
            <RewardList reward={preview} size={40} />
          )}
          <div class="rn-detail-foot">
            {lock ? <div class="rn-lock-hint big">{lock}</div> : null}
            <Btn color="green" class="rn-play" disabled={!!lock} onClick={play}>
              {lock ? 'Locked' : cleared ? (practice ? 'Practice' : 'Play Again') : 'Play'}
            </Btn>
          </div>
        </div>
      )}
    </Screen>
  );
}
