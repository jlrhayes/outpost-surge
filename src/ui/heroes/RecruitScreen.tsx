// OWNER: heroes agent. 'recruit' screen: tickets/diamonds, x1/x10, free pull timer, pity, card-flip reveal.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useGame } from '../../core/store';
import { toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { clock } from '../../core/tick';
import { fmt, fmtDuration } from '../../core/format';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { getBonus } from '../../core/bonuses';
import { Bar, Btn, Screen } from '../components/common';
import { Icon } from '../components/Icon';
import { heroDef, TYPE_LABEL } from '../../data/heroes';
import {
  RECRUIT_DIAMONDS_1,
  RECRUIT_DIAMONDS_10,
  RECRUIT_RATES,
  UR_PITY,
  freeRecruitCooldownMs,
  freeRecruitReady,
  newRecruitLevel,
  recruit,
  recruitAffordable,
  type PullResult,
  type RecruitMethod,
} from '../../systems/heroes';
import { HeroPortrait } from './HeroPortrait';
import { ItemIcon, TypeIcon } from './icons';

const FLIP_GAP = 260;

function RevealCard(props: { r: PullResult; i: number; flipped: boolean; big: boolean }) {
  const d = heroDef(props.r.heroId)!;
  return (
    <div class={`rv-card rar-${d.rarity} ${props.flipped ? 'flipped' : ''} ${props.big ? 'big' : ''}`} style={{ animationDelay: props.i * 40 + 'ms' }}>
      <div class="rv-inner">
        <div class="rv-back">
          <div class="rv-back-emblem">OS</div>
        </div>
        <div class="rv-front">
          <div class="rv-glow" />
          <HeroPortrait heroId={d.id} size={props.big ? 150 : 62} />
          <div class={`rv-rarity rarity-${d.rarity}`}>{d.rarity}</div>
          <div class="rv-name">{props.big ? d.name : d.callsign}</div>
          {props.big && (
            <div class="rv-type">
              <TypeIcon type={d.type} size={16} /> {TYPE_LABEL[d.type]}
            </div>
          )}
          {props.r.isNew ? (
            <div class="rv-new">NEW!</div>
          ) : (
            <div class="rv-dup">
              <ItemIcon id="shard" size={10} />+{props.r.shards}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reveal(props: { results: PullResult[]; onClose: () => void; onAgain?: () => void; againLabel?: string }) {
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);
  const n = props.results.length;
  const best = props.results.some((r) => r.rarity === 'UR') ? 'UR' : props.results.some((r) => r.rarity === 'SSR') ? 'SSR' : 'SR';
  useEffect(() => {
    sfx.recruit();
    const t: number[] = [];
    props.results.forEach((r, i) => {
      t.push(
        window.setTimeout(() => {
          setShown(i + 1);
          if (r.rarity === 'UR') sfx.win();
          else if (r.rarity === 'SSR') sfx.reward();
          else sfx.click();
        }, 650 + i * FLIP_GAP),
      );
    });
    timers.current = t;
    return () => t.forEach(clearTimeout);
  }, [props.results]);
  const done = shown >= n;
  const skip = () => {
    if (!done) {
      timers.current.forEach(clearTimeout);
      setShown(n);
    }
  };
  return (
    <div class={`reveal best-${best}`} onClick={skip}>
      <div class="reveal-rays" />
      <div class="reveal-title">{done ? (best === 'UR' ? 'LEGENDARY!' : best === 'SSR' ? 'EPIC PULL!' : 'RECRUITED') : 'Recruiting...'}</div>
      <div class={`reveal-cards n${n}`}>
        {props.results.map((r, i) => (
          <RevealCard key={i} r={r} i={i} flipped={i < shown} big={n === 1} />
        ))}
      </div>
      <div class="reveal-actions" style={{ visibility: done ? 'visible' : 'hidden' }}>
        {props.onAgain && (
          <Btn color="purple" onClick={props.onAgain}>
            {props.againLabel ?? 'Again'}
          </Btn>
        )}
        <Btn color="yellow" onClick={props.onClose}>
          OK
        </Btn>
      </div>
      {!done && <div class="reveal-skip">Tap to reveal all</div>}
    </div>
  );
}

export function RecruitScreen() {
  const s = useGame();
  const t = clock.value;
  const [results, setResults] = useState<PullResult[] | null>(null);
  const [lastCount, setLastCount] = useState<1 | 10>(1);
  const [pullId, setPullId] = useState(0);
  const unlocked = isUnlocked(s, 'recruit');
  const tickets = s.items.recruit_ticket ?? 0;
  const freeReady = freeRecruitReady(s, t);
  const pityLeft = UR_PITY - s.heroes.recruit.pity;
  const newLv = newRecruitLevel(s);

  const methodFor = (count: 1 | 10): RecruitMethod | null => {
    if (recruitAffordable(s, count, 'ticket')) return 'ticket';
    if (recruitAffordable(s, count, 'diamonds')) return 'diamonds';
    return null;
  };
  const doPull = (count: 1 | 10, method?: RecruitMethod | null) => {
    if (!unlocked) {
      toast(unlockHint('recruit'), 'bad');
      return;
    }
    const m = method ?? methodFor(count);
    if (!m) {
      toast(`Not enough tickets or diamonds`, 'bad');
      return;
    }
    const r = recruit(count, m);
    if (!r) {
      toast('Recruitment failed', 'bad');
      return;
    }
    setLastCount(count);
    setPullId((x) => x + 1);
    setResults(r);
  };
  const costLabel = (count: 1 | 10) => {
    const useTickets = tickets >= count;
    return (
      <span class="pull-cost">
        {useTickets ? <ItemIcon id="recruit_ticket" size={18} /> : <Icon name="diamonds" size={16} />}
        {useTickets ? count : fmt(count === 10 ? RECRUIT_DIAMONDS_10 : RECRUIT_DIAMONDS_1)}
      </span>
    );
  };

  return (
    <Screen title="Recruit" class="recruit-screen">
      <div class="recruit-banner">
        <div class="rb-rays" />
        <div class="rb-heroes">
          <div class="rb-hero l">
            <HeroPortrait heroId="vesna" size={96} frame />
          </div>
          <div class="rb-hero c">
            <HeroPortrait heroId="sable" size={124} frame />
          </div>
          <div class="rb-hero r">
            <HeroPortrait heroId="brakka" size={96} frame />
          </div>
        </div>
        <div class="rb-title">FRONTLINE CALL-UP</div>
        <div class="rb-sub">Recruit heroes to lead your squads</div>
      </div>

      <div class="card rates-card">
        <div class="rates">
          <span class="rarity-UR">UR {Math.round(RECRUIT_RATES.UR * 100)}%</span>
          <span class="rarity-SSR">SSR {Math.round(RECRUIT_RATES.SSR * 100)}%</span>
          <span class="rarity-SR">SR {Math.round(RECRUIT_RATES.SR * 100)}%</span>
        </div>
        <div class="pity-row">
          <span>
            UR guaranteed within <b class="rarity-UR">{pityLeft}</b> pulls
          </span>
        </div>
        <Bar value={s.heroes.recruit.pity} max={UR_PITY} color="linear-gradient(#ffe070,#ff9a1a)" height={10} />
        <div class="dim-label">Every x10 contains at least one SSR or better. Duplicates become shards.</div>
        {newLv > 1 && <div class="dim-label">New heroes join at Lv {newLv} (near your squad's level) — no EXP needed.</div>}
      </div>

      {!unlocked && (
        <div class="card locked-card">
          <ItemIcon id="lock" size={18} /> {unlockHint('recruit')}: clear districts to open the recruitment office.
        </div>
      )}

      <div class="free-row card">
        <div>
          <div class="free-title">Free Recruit</div>
          <div class="dim-label">{freeReady ? 'Available now!' : <>Next in {fmtDuration(s.heroes.recruit.freeAt - t)}</>}</div>
          <div class="dim-label">
            Every {fmtDuration(freeRecruitCooldownMs(s))}
            {getBonus(s, 'recruit_cd_pct') > 0 && <> · Tavern −{Math.round(Math.min(75, getBonus(s, 'recruit_cd_pct')))}%</>}
          </div>
        </div>
        <Btn color="green" disabled={!freeReady || !unlocked} onClick={() => doPull(1, 'free')}>
          FREE
        </Btn>
      </div>

      <div class="pull-row">
        <div class="ticket-count">
          <ItemIcon id="recruit_ticket" size={22} /> Tickets: <b>{tickets}</b>
          <span class="dim-label">
            {' '}
            · <Icon name="diamonds" size={14} /> {fmt(s.currencies.diamonds)}
          </span>
        </div>
        <div class="pull-btns">
          <Btn color="blue" disabled={!unlocked} onClick={() => doPull(1)}>
            <div class="pull-label">
              Recruit ×1
              {costLabel(1)}
            </div>
          </Btn>
          <Btn color="purple" disabled={!unlocked} onClick={() => doPull(10)}>
            <div class="pull-label">
              Recruit ×10
              {costLabel(10)}
            </div>
          </Btn>
        </div>
      </div>

      {results && (
        <Reveal
          key={pullId}
          results={results}
          onClose={() => setResults(null)}
          againLabel={`Again ×${lastCount}`}
          onAgain={methodFor(lastCount) ? () => doPull(lastCount) : undefined}
        />
      )}
    </Screen>
  );
}
