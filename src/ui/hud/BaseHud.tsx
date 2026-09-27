// OWNER: meta agent. Main base-screen HUD: player/power, resources, quest tracker, side & bottom nav.
// Layout per GAME_REFERENCE §7. The layer is pointer-events:none; only buttons/.interactive catch touches
// so the 3D base underneath stays draggable.
import './hud.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useGame, type GameState } from '../../core/store';
import { clock } from '../../core/tick';
import { totalPower } from '../../core/bonuses';
import { fmt } from '../../core/format';
import { goTo, openScreen, screens, toast } from '../../core/nav';
import { isUnlocked, unlockHint, type Feature } from '../../core/unlocks';
import { sfx } from '../../core/audio';
import { hqLevel } from '../../systems/buildings';
import { claimChapter, claimQuest, currentChapter, questGo, questsClaimable, trackedQuest } from '../../systems/quests';
import { dailyClaimable } from '../../systems/daily';
import { researchIdle } from '../../systems/research';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { AnimatedNumber, fmtFull } from '../components/AnimatedNumber';
import { ResourceBar } from '../components/ResourceBar';
import { RedDot } from '../components/common';
import { rewardEntries } from '../components/RewardList';
import { RewardTile } from '../components/ItemIcon';
import { bagHasOpenable } from '../meta/BagScreen';
import { questIcon } from '../meta/QuestsScreen';
import { welcome } from './welcome';

// ---------------------------------------------------------------- top-left profile

function PowerDisplay(props: { value: number }) {
  const prev = useRef(props.value);
  const [delta, setDelta] = useState<{ k: number; n: number } | null>(null);
  useEffect(() => {
    const d = props.value - prev.current;
    if (d > 0 && prev.current > 0) setDelta({ k: performance.now(), n: d });
    prev.current = props.value;
  }, [props.value]);
  return (
    <div class="hud-power">
      <Icon name="power" size={20} />
      <AnimatedNumber value={props.value} format={fmtFull} duration={1000} class="hud-power-num" />
      {delta && (
        <span class="power-delta" key={delta.k}>
          +{fmt(delta.n)}
        </span>
      )}
    </div>
  );
}

function Profile(props: { s: GameState }) {
  const { s } = props;
  return (
    <button class="hud-profile" onClick={() => openScreen('settings')} aria-label="Commander profile">
      <span class="hud-avatar">
        <Avatar index={s.player.avatar} size={58} />
        <span class="hud-hq-badge">{hqLevel(s)}</span>
      </span>
      <span class="hud-profile-info">
        <span class="hud-name">{s.player.name}</span>
        <PowerDisplay value={totalPower(s)} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- quest tracker

function QuestTracker(props: { s: GameState }) {
  const { s } = props;
  const cv = currentChapter(s);
  const q = trackedQuest(s);
  if (cv.complete) {
    return (
      <div class="qt done interactive">
        <div class="qt-head">
          <Icon name="tasks" size={16} /> Chapter {cv.chapter.index + 1} · {cv.chapter.title}
        </div>
        <div class="qt-row">
          <span class="qt-icon bounce">
            <Icon name="chest" size={34} />
          </span>
          <span class="qt-text">Chapter complete!</span>
          <button
            class="qt-btn claim"
            onClick={(e) => {
              e.stopPropagation();
              claimChapter();
            }}
          >
            Open
          </button>
        </div>
      </div>
    );
  }
  if (!q) return null;
  const first = rewardEntries(q.def.reward)[0];
  return (
    <div
      class={'qt interactive ' + (q.done ? 'done' : '')}
      onClick={() => {
        sfx.click();
        openScreen('quests');
      }}
    >
      <div class="qt-head">
        <Icon name="tasks" size={16} /> Chapter {cv.chapter.index + 1}
        <span class="qt-count">
          {cv.claimedCount}/{cv.quests.length}
        </span>
      </div>
      <div class="qt-row">
        <span class="qt-icon">
          <Icon name={q.done ? 'check' : questIcon(q.def.go)} size={30} />
        </span>
        <span class="qt-main">
          <span class="qt-text">{q.def.text}</span>
          <span class="qt-progress">
            <span class="qt-progress-fill" style={{ width: (q.progress / q.def.target) * 100 + '%' }} />
            <span class="qt-progress-label">
              {fmt(q.progress)}/{fmt(q.def.target)}
            </span>
          </span>
        </span>
        {first && (
          <span class="qt-reward">
            <RewardTile entry={first} size={34} />
          </span>
        )}
        {q.done ? (
          <button
            class="qt-btn claim"
            onClick={(e) => {
              e.stopPropagation();
              claimQuest(q.def.id);
            }}
          >
            Claim
          </button>
        ) : (
          <button
            class="qt-btn go"
            onClick={(e) => {
              e.stopPropagation();
              sfx.click();
              questGo(q.def.go);
            }}
          >
            Go
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- right-edge feature stack

interface SideDef {
  id: string;
  label: string;
  icon: string;
  feature?: Feature;
  open: () => void;
  dot?: (s: GameState, t: number) => boolean | number;
}

const SIDE: SideDef[] = [
  {
    id: 'runner',
    label: 'Special Ops',
    icon: 'truck',
    feature: 'runner',
    open: () => openScreen('runnerLevels'),
    // Nudge until today's Special Ops daily task is done.
    dot: (s) => (s.meta.daily.progress.runner ?? 0) < 2,
  },
  {
    id: 'campaign',
    label: 'Districts',
    icon: 'skull',
    feature: 'campaign',
    open: () => openScreen('campaign'),
    dot: (s, t) => t - s.heroes.campaign.idleClaimedAt > 60 * 60_000,
  },
  {
    id: 'recruit',
    label: 'Recruit',
    icon: 'ticket',
    feature: 'recruit',
    open: () => openScreen('recruit'),
    dot: (s, t) => s.heroes.recruit.freeAt <= t || (s.items.recruit_ticket ?? 0) > 0,
  },
  { id: 'daily', label: 'Daily', icon: 'calendar', feature: 'daily', open: () => openScreen('daily'), dot: (s) => dailyClaimable(s) },
  {
    id: 'formation',
    label: 'Formation',
    icon: 'formation',
    open: () => openScreen('formation'),
    dot: (s) => {
      const assigned = new Set(s.heroes.squads.flatMap((q) => q.heroes.filter(Boolean)));
      const free = Object.keys(s.heroes.owned).filter((h) => !assigned.has(h)).length;
      const empty = s.heroes.squads[0]?.heroes.filter((h) => !h).length ?? 0;
      return free > 0 && empty > 0;
    },
  },
];

function SideButton(props: { d: SideDef; s: GameState; t: number }) {
  const { d, s, t } = props;
  const locked = !!d.feature && !isUnlocked(s, d.feature);
  const dot = !locked && d.dot ? d.dot(s, t) : false;
  return (
    <button
      class={'side-btn ' + (locked ? 'locked' : '')}
      onClick={() => {
        if (locked) {
          sfx.error();
          toast(unlockHint(d.feature!), 'bad');
          return;
        }
        sfx.click();
        d.open();
      }}
    >
      <span class="side-btn-icon">
        <Icon name={d.icon} size={34} />
        {locked && (
          <span class="side-lock">
            <Icon name="lock" size={16} />
          </span>
        )}
        {!!dot && <RedDot count={typeof dot === 'number' ? dot : undefined} />}
      </span>
      <span class="side-label">{d.label}</span>
    </button>
  );
}

// ---------------------------------------------------------------- bottom bar

function NavButton(props: { icon: string; label: string; onClick: () => void; dot?: boolean | number; locked?: boolean; glow?: boolean }) {
  return (
    <button
      class={'nav-btn ' + (props.locked ? 'locked ' : '') + (props.glow ? 'glow' : '')}
      onClick={() => {
        if (props.locked) sfx.error();
        else sfx.click();
        props.onClick();
      }}
    >
      <span class="nav-btn-icon">
        <Icon name={props.icon} size={32} />
        {props.locked && (
          <span class="side-lock">
            <Icon name="lock" size={14} />
          </span>
        )}
        {!!props.dot && !props.locked && <RedDot count={typeof props.dot === 'number' ? props.dot : undefined} />}
      </span>
      <span class="nav-label">{props.label}</span>
    </button>
  );
}

// ---------------------------------------------------------------- root

export function BaseHud() {
  const s = useGame();
  const t = clock.value;
  const claimable = questsClaimable(s);
  const researchOpen = isUnlocked(s, 'research');
  const worldOpen = isUnlocked(s, 'world');
  const pendingWelcome = welcome.value;

  // Show the welcome-back summary once, when the player first lands in the base with nothing open.
  useEffect(() => {
    if (!pendingWelcome) return;
    const id = setTimeout(() => {
      if (screens.value.length === 0 && welcome.value) {
        openScreen('welcomeBack', { summary: welcome.value });
        welcome.value = null;
      }
    }, 600);
    return () => clearTimeout(id);
  }, [pendingWelcome]);

  return (
    <div class="base-hud">
      <div class="hud-top">
        <ResourceBar onClick={() => openScreen('bag')} />
        <div class="hud-top-row">
          <Profile s={s} />
        </div>
      </div>

      <div class="side-stack">
        {SIDE.map((d) => (
          <SideButton key={d.id} d={d} s={s} t={t} />
        ))}
      </div>

      <div class="qt-wrap">
        <QuestTracker s={s} />
      </div>

      <div class="bottom-bar">
        <NavButton icon="tasks" label="Tasks" onClick={() => openScreen('quests')} dot={claimable} glow={claimable > 0} />
        <NavButton icon="helmet" label="Heroes" onClick={() => openScreen('heroes')} />
        <NavButton icon="bag" label="Bag" onClick={() => openScreen('bag')} dot={bagHasOpenable(s)} />
        <NavButton
          icon="flask"
          label="Research"
          locked={!researchOpen}
          dot={researchIdle(s)}
          onClick={() => (researchOpen ? openScreen('research') : toast(unlockHint('research'), 'bad'))}
        />
        <NavButton icon="gear" label="Settings" onClick={() => openScreen('settings')} />
      </div>

      <button
        class={'world-btn ' + (worldOpen ? '' : 'locked')}
        onClick={() => {
          if (!worldOpen) {
            sfx.error();
            toast(unlockHint('world'), 'bad');
            return;
          }
          sfx.click();
          goTo('world');
        }}
        aria-label="World map"
      >
        <span class="world-btn-ring" />
        <Icon name="globe" size={46} />
        <span class="world-btn-label">World</span>
        {!worldOpen && (
          <span class="world-lock">
            <Icon name="lock" size={20} />
          </span>
        )}
      </button>
    </div>
  );
}
