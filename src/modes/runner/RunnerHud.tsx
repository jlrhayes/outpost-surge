// OWNER: runner agent. HUD shown during a gate-runner level: title, road progress, pause, boss HP bar,
// weapon chips, captions/banners, drag hint, pause menu and the Victory/Defeat result overlay.
import { useEffect, useState } from 'preact/hooks';
import { goTo } from '../../core/nav';
import { fmt } from '../../core/format';
import { sfx } from '../../core/audio';
import { Icon } from '../../ui/components/Icon';
import { Btn } from '../../ui/components/common';
import { levelLabel } from '../../data/runner';
import { runActions, runHud } from './runState';
import type { RunOutcome } from './progress';
import { registerRunnerIcons } from './icons';
import { RewardList } from '../../ui/components/RewardList';
import './runner.css';

registerRunnerIcons();

export function RunnerHud(props: { params?: any }) {
  const result = runHud.result.value;
  const paused = runHud.paused.value;
  return (
    <div class="rn-hud">
      <TopBar />
      <BossBar />
      <WeaponChips />
      <Caption />
      <Banner />
      {runHud.dragHint.value && !result && !paused && <DragHint />}
      {paused && !result && <PauseMenu />}
      {result && <ResultOverlay r={result} />}
    </div>
  );
}

function TopBar() {
  const p = runHud.progress.value;
  return (
    <div class="rn-top">
      <div class="rn-title">
        <div class="rn-title-main">{runHud.title.value}</div>
        {runHud.subtitle.value && <div class="rn-title-sub">{runHud.subtitle.value}</div>}
      </div>
      <div class="rn-progress">
        <div class="rn-progress-track">
          <div class="rn-progress-fill" style={{ width: `${p * 100}%` }} />
        </div>
        <div class="rn-progress-runner" style={{ left: `${p * 100}%` }} />
        <div class="rn-progress-skull">
          <Icon name="rn_skull" size={22} />
        </div>
      </div>
      <button class="rn-pause interactive" aria-label="Pause" onClick={() => (sfx.click(), runActions.pause())}>
        <Icon name="rn_pause" size={22} />
      </button>
    </div>
  );
}

function BossBar() {
  const b = runHud.boss.value;
  if (!b) return null;
  const p = b.max > 0 ? Math.max(0, b.hp / b.max) : 0;
  return (
    <div class={'rn-boss ' + (b.big ? 'big' : '')}>
      <div class="rn-boss-name">
        <Icon name="rn_skull" size={18} /> {b.name}
      </div>
      <div class="rn-boss-bar">
        <div class="rn-boss-lag" style={{ width: `${p * 100}%` }} />
        <div class="rn-boss-fill" style={{ width: `${p * 100}%` }} />
        <div class="rn-boss-hp">{fmt(b.hp)}</div>
      </div>
    </div>
  );
}

function WeaponChips() {
  const w = runHud.weapon.value;
  const chips: { icon: string; text: string }[] = [];
  if (w.rate > 1.01) chips.push({ icon: 'rn_rate', text: `×${w.rate.toFixed(1)}` });
  if (w.dmg > 1.01) chips.push({ icon: 'rn_dmg', text: `×${w.dmg.toFixed(1)}` });
  if (w.multi > 0) chips.push({ icon: 'rn_multi', text: `+${w.multi}` });
  if (w.helpers > 0) chips.push({ icon: 'rn_tank', text: `${w.helpers}` });
  if (!chips.length) return null;
  return (
    <div class="rn-chips">
      {chips.map((c) => (
        <div class="rn-chip" key={c.icon}>
          <Icon name={c.icon} size={18} />
          <span>{c.text}</span>
        </div>
      ))}
    </div>
  );
}

function Caption() {
  const c = runHud.caption.value;
  if (!c) return null;
  return (
    <div class="rn-caption" key={c.key}>
      {c.text}
    </div>
  );
}

function Banner() {
  const b = runHud.banner.value;
  if (!b) return null;
  return (
    <div class={'rn-banner ' + b.kind} key={b.key}>
      <span>{b.text}</span>
    </div>
  );
}

function DragHint() {
  return (
    <div class="rn-drag">
      <div class="rn-drag-track">
        <span class="rn-drag-arrow l">{'◀'}</span>
        <div class="rn-drag-hand">
          <Icon name="rn_hand" size={40} />
        </div>
        <span class="rn-drag-arrow r">{'▶'}</span>
      </div>
      <div class="rn-drag-text">Drag to move</div>
    </div>
  );
}

function PauseMenu() {
  const intro = runHud.intro.value;
  const [confirm, setConfirm] = useState(false);
  return (
    <div class="rn-modal-back interactive">
      <div class="rn-modal">
        <div class="rn-modal-title">Paused</div>
        {confirm ? (
          <>
            <p class="rn-modal-text">{intro ? 'Skip the opening mission? You will still get the starter supplies.' : 'Leaving now counts as a defeat. Your squad will not bring any troops home.'}</p>
            <div class="rn-modal-btns">
              <Btn color="gray" onClick={() => setConfirm(false)}>
                Back
              </Btn>
              <Btn color="red" onClick={() => runActions.quit()}>
                {intro ? 'Skip' : 'Quit'}
              </Btn>
            </div>
          </>
        ) : (
          <div class="rn-modal-btns col">
            <Btn color="green" onClick={() => runActions.resume()}>
              Resume
            </Btn>
            <Btn color="red" onClick={() => setConfirm(true)}>
              {intro ? 'Skip Mission' : 'Quit Level'}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultOverlay(props: { r: RunOutcome }) {
  const r = props.r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!r.won) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setShown(n);
      if (n <= r.stars) sfx.upgrade();
      if (n >= 3) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [r]);
  const title = r.won ? 'Victory!' : 'Defeat';
  return (
    <div class="rn-result interactive">
      <div class={'rn-result-panel ' + (r.won ? 'win' : 'lose')}>
        <div class={'rn-result-banner ' + (r.won ? 'win' : 'lose')}>{title}</div>
        {r.won && (
          <div class="rn-stars">
            {[1, 2, 3].map((i) => (
              <span key={i} class={'rn-star ' + (i <= r.stars && i <= shown ? 'on' : '') + (i === 2 ? ' mid' : '')}>
                <Icon name={i <= r.stars && i <= shown ? 'rn_star' : 'rn_starEmpty'} size={i === 2 ? 58 : 46} />
              </span>
            ))}
          </div>
        )}
        <div class="rn-result-stats">
          <div>
            <b>{r.survivors}</b>
            <span>Survivors</span>
          </div>
          <div>
            <b>{r.peak}</b>
            <span>Peak squad</span>
          </div>
          <div>
            <b>{r.kills}</b>
            <span>Zombies</span>
          </div>
        </div>
        {r.won && r.reward ? (
          <>
            <div class="rn-result-sub">
              {r.intro ? 'Starter supplies' : r.firstClear ? 'First clear rewards' : 'Replay rewards'}
            </div>
            <RewardList reward={r.reward} size={48} animate />
            {!r.intro && r.reward.troops && <div class="rn-result-note">Surviving soldiers joined your army as troops.</div>}
          </>
        ) : r.won ? null : (
          <div class="rn-result-note">{r.intro ? 'Stay away from red gates and keep shooting!' : 'Tip: shoot red gates blue, grab soldier crates early and focus fast dogs.'}</div>
        )}
        <div class="rn-result-btns">{resultButtons(r)}</div>
      </div>
    </div>
  );
}

function resultButtons(r: RunOutcome) {
  if (r.intro) {
    return r.won ? (
      <Btn color="green" class="rn-wide" onClick={() => goTo('base')}>
        Continue to Base
      </Btn>
    ) : (
      <Btn color="yellow" class="rn-wide" onClick={() => runActions.retry()}>
        Try Again
      </Btn>
    );
  }
  const base = (
    <Btn color="gray" onClick={() => goTo('base')}>
      Base
    </Btn>
  );
  const retry = (
    <Btn color="blue" onClick={() => runActions.retry()}>
      Retry
    </Btn>
  );
  if (!r.won)
    return (
      <>
        {base}
        <Btn color="yellow" onClick={() => runActions.retry()}>
          Retry
        </Btn>
      </>
    );
  return (
    <>
      {base}
      {retry}
      {r.next !== null && (
        <div class="rn-next-wrap">
          <Btn color="green" disabled={!!r.nextLock} onClick={() => goTo('runner', { level: r.next })}>
            Next {levelLabel(r.next)}
          </Btn>
          {r.nextLock && <div class="rn-next-lock">{r.nextLock}</div>}
        </div>
      )}
    </>
  );
}
