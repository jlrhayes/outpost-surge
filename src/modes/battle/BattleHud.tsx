// OWNER: heroes agent. HUD shown during battle playback (HP bars, speed toggle, skip, result).
import { useEffect, useState } from 'preact/hooks';
import { fmt } from '../../core/format';
import { sfx } from '../../core/audio';
import { Btn } from '../../ui/components/common';
import { BATTLE_MAX_TIME } from '../../systems/battle';
import { HeroPortrait, ZombiePortrait } from '../../ui/heroes/HeroPortrait';
import { ItemIcon } from '../../ui/heroes/icons';
import { RewardList } from '../../ui/heroes/parts';
import '../../ui/heroes/heroes.css';
import { banner, battleControls, battleView, callouts, setOverlayHost, type UnitSnapshot } from './view';

function TeamBar(props: { units: UnitSnapshot[]; side: 'A' | 'B'; label: string }) {
  let hp = 0;
  let max = 0;
  for (const u of props.units) {
    if (u.side !== props.side) continue;
    hp += u.hp;
    max += u.maxHp;
  }
  const p = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div class={`team-bar side-${props.side}`}>
      <div class="tb-label">{props.label}</div>
      <div class="tb-track">
        <div class="tb-fill" style={{ width: p * 100 + '%' }} />
        <div class="tb-text">{fmt(hp)}</div>
      </div>
    </div>
  );
}

function HeroStrip(props: { units: UnitSnapshot[] }) {
  const heroes = props.units.filter((u) => u.side === 'A').sort((a, b) => a.slot - b.slot);
  return (
    <div class="hero-strip">
      {heroes.map((u) => {
        const hp = u.maxHp > 0 ? u.hp / u.maxHp : 0;
        const full = u.energy >= 100 && u.alive;
        return (
          <div key={u.uid} class={`hs-card ${u.alive ? '' : 'dead'} ${full ? 'charged' : ''}`}>
            <div class="hs-portrait">{u.heroId ? <HeroPortrait heroId={u.heroId} size={50} frame /> : <ZombiePortrait model={u.model} size={48} />}</div>
            {!u.alive && (
              <div class="hs-dead">
                <ItemIcon id="skull" size={26} />
              </div>
            )}
            <div class="hs-hp">
              <div class={`hs-hp-fill ${hp < 0.3 ? 'low' : ''}`} style={{ width: hp * 100 + '%' }} />
            </div>
            {u.hasActive && (
              <div class="hs-en">
                <div class="hs-en-fill" style={{ width: Math.min(100, u.energy) + '%' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Callouts() {
  return (
    <div class="callouts">
      {callouts.value.map((c) => (
        <div key={c.id} class={`callout side-${c.side}`}>
          <div class="co-portrait">{c.heroId ? <HeroPortrait heroId={c.heroId} size={52} frame /> : <ZombiePortrait model={c.model ?? 'zombie'} size={50} />}</div>
          <div class="co-text">
            <div class="co-who">{c.who}</div>
            <div class="co-skill">{c.skill}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Banner() {
  const b = banner.value;
  const phase = battleView.value.phase;
  if (!b || phase === 'result') return null;
  return (
    <div key={b.id} class={`battle-banner kind-${b.kind}`}>
      {b.text}
    </div>
  );
}

function ResultOverlay() {
  const v = battleView.value;
  const res = v.result;
  const req = v.req;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);
  if (!res || !req) return null;
  const won = res.winner === 'A';
  const heroes = v.units.filter((u) => u.side === 'A');
  const dealt = heroes.map((u) => ({ u, d: res.dealt?.[u.uid] ?? 0, h: res.healed?.[u.uid] ?? 0 })).sort((a, b) => b.d - a.d);
  const top = Math.max(1, ...dealt.map((x) => x.d));
  const enemiesDown = v.units.filter((u) => u.side === 'B' && !u.alive).length;
  const enemies = v.units.filter((u) => u.side === 'B').length;
  return (
    <div class={`battle-result ${won ? 'win' : 'lose'}`}>
      <div class="br-rays" />
      <div class="br-panel">
        <div class="br-title">{won ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="br-sub">
          {req.title}
          {req.subtitle ? ` · ${req.subtitle}` : ''}
        </div>
        <div class="br-meta">
          <span>
            Time <b>{Math.ceil(res.duration)}s</b>
          </span>
          <span>
            Enemies defeated{' '}
            <b>
              {enemiesDown}/{enemies}
            </b>
          </span>
        </div>
        {won && req.rewards && (
          <div class="br-section">
            <div class="br-h">Rewards</div>
            <RewardList reward={req.rewards} size={24} class="br-rewards" />
          </div>
        )}
        {dealt.length > 0 && (
          <div class="br-section">
            <div class="br-h">Battle report</div>
            {dealt.map((x, i) => (
              <div class="br-row" key={x.u.uid}>
                <div class="br-portrait">
                  {x.u.heroId ? <HeroPortrait heroId={x.u.heroId} size={36} frame /> : <ZombiePortrait model={x.u.model} size={34} />}
                  {i === 0 && x.d > 0 && (
                    <span class="br-mvp">
                      <ItemIcon id="crown" size={18} />
                    </span>
                  )}
                </div>
                <div class="br-bars">
                  <div class="br-name">
                    {x.u.name}
                    {!x.u.alive && <span class="br-down"> (down)</span>}
                  </div>
                  <div class="br-dmg">
                    <div class="br-dmg-fill" style={{ width: (x.d / top) * 100 + '%' }} />
                  </div>
                </div>
                <div class="br-num">
                  {fmt(x.d)}
                  {x.h > 0 && <div class="br-heal">+{fmt(x.h)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {(req.notes ?? []).map((n, i) => (
          <div class="br-note" key={i}>
            {n}
          </div>
        ))}
        {!won && <div class="br-tips">Tips: level up heroes, raise stars & skills, train higher-tier soldiers, and use type counters (Tank &gt; Missile &gt; Aircraft &gt; Tank).</div>}
        <Btn color={won ? 'yellow' : 'blue'} class="br-continue" disabled={!ready} onClick={() => battleControls.finish()}>
          Continue
        </Btn>
      </div>
    </div>
  );
}

export function BattleHud(props: { params?: any }) {
  const v = battleView.value;
  const req = v.req;
  const units = v.units;
  const timeLeft = Math.max(0, Math.ceil(BATTLE_MAX_TIME - v.time));
  const boss = units.find((u) => u.side === 'B' && u.model === 'zombieBoss');
  const enemyLabel = boss ? boss.name : units.some((u) => u.side === 'B' && u.heroId) ? 'Enemy squad' : 'Zombie horde';
  return (
    <div class="battle-hud">
      <div class="battle-fx" ref={(el) => setOverlayHost(el)} />
      <div class="bh-top">
        <div class="bh-title">
          <div class="bh-t1">{req?.title ?? 'Battle'}</div>
          {req?.subtitle && <div class="bh-t2">{req.subtitle}</div>}
        </div>
        <div class={`bh-timer ${timeLeft <= 10 && v.phase === 'fight' ? 'urgent' : ''}`}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <div class="bh-controls">
          <button
            class="bh-btn interactive"
            onClick={() => {
              sfx.click();
              battleControls.setSpeed(v.speed >= 2 ? 1 : 2);
            }}
          >
            x{v.speed}
          </button>
          <button
            class="bh-btn skip interactive"
            disabled={v.phase === 'outro' || v.phase === 'result'}
            onClick={() => {
              sfx.click();
              battleControls.skip();
            }}
          >
            Skip ››
          </button>
        </div>
      </div>
      <div class="bh-teams">
        <TeamBar units={units} side="B" label={enemyLabel} />
      </div>
      <Callouts />
      <Banner />
      <div class="bh-bottom">
        <TeamBar units={units} side="A" label="Your squad" />
        <HeroStrip units={units} />
      </div>
      {v.phase === 'result' && <ResultOverlay />}
    </div>
  );
}
