// OWNER: meta agent. Guided onboarding (GAME_REFERENCE §8 "guided building"): for the first chapter quests an
// animated pointing hand + pulse ring sits on the control to press next — the tracker's Go / Claim button, then the
// target inside the panel it opens (Build / Upgrade, requirement "Go", FREE finish, BATTLE, Quick Deploy, Train...).
// It follows the game state, so it "dismisses" itself as soon as the control is used. Lightweight DOM overlay:
// pointer-events: none (never blocks input), positioned by a rAF loop only while a guided quest is active.
import './guide.css';
import { effect } from '@preact/signals';
import { game, version } from '../../core/store';
import { route, screens } from '../../core/nav';
import type { BuildingType } from '../../core/types';
import { buildingName, PLOT_TYPES } from '../../data/buildings';
import { currentChapter, trackedQuest, type QuestView } from '../../systems/quests';

/** Chapter 1 fully, then the first quests of chapter 2 (about the first 9 quests of the game). */
const GUIDED_IN_CHAPTER = [Infinity, 3];

type Guided = { kind: 'quest'; q: QuestView } | { kind: 'chest' } | null;

function guidedNow(): Guided {
  const s = game;
  if (!s.runner.introDone) return null;
  const limit = GUIDED_IN_CHAPTER[s.meta.quests.index];
  if (limit === undefined) return null;
  const cv = currentChapter(s);
  if (cv.complete) return s.meta.quests.index === 0 ? { kind: 'chest' } : null;
  const q = trackedQuest(s);
  if (!q) return null;
  const pos = cv.chapter.quests.findIndex((d) => d.id === q.def.id);
  return pos >= 0 && pos < limit ? { kind: 'quest', q } : null;
}

// ------------------------------------------------------------------------------------------ targets

const q1 = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement | null;

function visible(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  const anchor = el.closest('.bo-anchor') as HTMLElement | null;
  if (anchor && anchor.style.visibility === 'hidden') return false;
  if (el.closest('.bo-root.busy')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
}

/** Row button in the build menu for a building type (highlighted row first). */
function buildMenuButton(root: ParentNode, type: BuildingType | undefined): HTMLElement | null {
  const hl = q1(root, '.bm-row.highlight .bm-build');
  if (hl) return hl;
  if (!type) return null;
  const name = buildingName(type);
  for (const row of root.querySelectorAll('.bm-row:not(.locked)')) {
    if ((row.querySelector('.bm-name')?.textContent ?? '').includes(name)) return row.querySelector('.bm-build');
  }
  return null;
}

/** The control to press inside the top-most screen, for the guided quest (null = nothing to point at). */
function screenTarget(root: HTMLElement, g: Guided): HTMLElement | null {
  if (!g) return null;
  // Opened from the tracker: the quest list shows the same quest first (claimable first, then chapter order).
  if (root.querySelector('.quests-screen')) {
    return g.kind === 'chest' ? q1(root, '.chapter-chest.ready') : q1(root, '.quest-card:not(.claimed) .quest-card-action .btn');
  }
  if (g.kind === 'chest') return q1(root, '.rewards-btn');
  const { q } = g;
  const go = q.def.go;
  // Collect / reward popups: close them with their main button.
  const reward = q1(root, '.rewards-btn');
  if (reward) return reward;
  if (q.done) return q1(root, '.screen-close');
  const free = q1(root, '.speedup-instant .btn-green');
  if (free) return free;
  if (!go) return null;
  switch (go.kind) {
    case 'building': {
      if (root.querySelector('.bp-screen')) {
        return (
          q1(root, '.bp-screen .screen-footer .btn-green') || // Finish FREE
          q1(root, '.bp-screen .bp-upgrade:not(.soft)') ||
          q1(root, '.bp-screen .bp-req:not(.met) .btn')
        );
      }
      if (root.querySelector('.bm-screen')) return buildMenuButton(root, go.type);
      return null;
    }
    case 'screen':
      if (go.id === 'campaign' || go.id === 'formation') {
        const quick = root.querySelector('.formation-screen .f-slot.empty') ? q1(root, '.formation-screen .screen-footer .btn-blue') : null;
        return quick || q1(root, '.campaign-screen .battle-btn');
      }
      if (go.id === 'runnerLevels') return q1(root, '.rn-levels .rn-play');
      if (go.id === 'recruit') return q1(root, '.recruit-screen .free-row .btn');
      return null;
    case 'barracks':
      return q1(root, '.barracks-screen .train-actions .btn');
    default:
      return null;
  }
}

/** When the tracker's Go was last pressed, and for which quest. */
let lastGoAt = -1e9;
let lastGoQuest = '';

/** What to point at in the base when no screen is open. */
function baseTarget(g: Guided): HTMLElement | null {
  const hud = q1(document, '#ui .hud-layer');
  if (!hud || !g) return null;
  if (g.kind === 'chest') return q1(hud, '.qt .qt-btn.claim');
  const { q } = g;
  if (q.done) return q1(hud, '.qt .qt-btn.claim');
  const go = q.def.go;
  const sinceGo = lastGoQuest === q.def.id ? performance.now() - lastGoAt : Infinity;
  if (go?.kind === 'building') {
    // A construction / upgrade of this type is running: point at its FREE finish (world marker or builder chip).
    const type = go.type;
    if (game.base.buildings.some((b) => b.type === type && b.upgradeEndsAt !== null)) {
      const f = q1(hud, `[data-guide="free:${type}"]`);
      if (visible(f)) return f;
      const chip = q1(hud, '.bo-bq.busy.free');
      return visible(chip) ? chip : null;
    }
    // "Own N" quests pan to a free plot after Go: point at the nearest matching "+" pad.
    if (!go.openPanel && sinceGo < 12_000) {
      const kind = PLOT_TYPES.res.includes(type) ? 'res' : 'core';
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const el of hud.querySelectorAll<HTMLElement>(`[data-guide="plot:${kind}"]`)) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
      if (best) return best;
    }
  }
  // Right after Go the camera pans and a panel opens: don't bounce back to the Go button meanwhile.
  if (sinceGo < 1500) return null;
  return q1(hud, '.qt .qt-btn.go');
}

function pickTarget(): HTMLElement | null {
  const g = guidedNow();
  if (!g) return null;
  const layers = document.querySelectorAll<HTMLElement>('#ui .screen-layer');
  const top = layers[layers.length - 1];
  const el = top ? screenTarget(top, g) : route.peek().mode === 'base' ? baseTarget(g) : null;
  return visible(el) ? el : null;
}

// ------------------------------------------------------------------------------------------ overlay

const HAND_SVG =
  '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
  '<path d="M20 30V9a5 5 0 0 1 10 0v17l3-1a5 5 0 0 1 6 3l1 1a5 5 0 0 1 7 3l1 1a5 5 0 0 1 7 4v10c0 9-7 16-16 16h-5c-6 0-10-3-13-8l-9-14a5 5 0 0 1 8-6z" ' +
  'fill="#fff4dc" stroke="#0b1520" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M33 26v10M40 29v8M47 33v6" stroke="#c9a77a" stroke-width="2.5" stroke-linecap="round"/>' +
  '</svg>';
/** Fingertip position inside the 64 px hand box (from the SVG path). */
const TIP_X = 25;
const TIP_Y = 4;

let layer: HTMLDivElement | null = null;
let ring: HTMLDivElement | null = null;
let hand: HTMLDivElement | null = null;

function ensureDom(): void {
  if (layer && layer.isConnected) return;
  layer = document.createElement('div');
  layer.className = 'guide-layer';
  ring = document.createElement('div');
  ring.className = 'guide-ring';
  hand = document.createElement('div');
  hand.className = 'guide-hand';
  const inner = document.createElement('div');
  inner.className = 'guide-hand-inner';
  inner.innerHTML = HAND_SVG;
  hand.appendChild(inner);
  layer.append(ring, hand);
  document.body.appendChild(layer);
}

let shownFor: HTMLElement | null = null;
/** Last written geometry: skip DOM writes while the target doesn't move. */
let lastKey = '';

function place(el: HTMLElement | null): void {
  if (!el) {
    if (shownFor) {
      layer?.classList.remove('show');
      shownFor = null;
      lastKey = '';
    }
    return;
  }
  ensureDom();
  const r = el.getBoundingClientRect();
  const key = `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0}`;
  if (shownFor === el && key === lastKey) return;
  lastKey = key;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const pad = 5;
  const round = Math.abs(r.width - r.height) < 6;
  ring!.style.transform = `translate(${(r.left - pad).toFixed(1)}px, ${(r.top - pad).toFixed(1)}px)`;
  ring!.style.width = r.width + pad * 2 + 'px';
  ring!.style.height = r.height + pad * 2 + 'px';
  ring!.style.borderRadius = round ? '50%' : '14px';
  // Hand below the control pointing up; above it pointing down when there is no room below; mirrored at the right edge.
  const down = cy > innerHeight - 96;
  const flip = cx > innerWidth - 60;
  const tipY = down ? r.top + Math.min(10, r.height * 0.3) : r.bottom - Math.min(10, r.height * 0.3);
  hand!.style.transform = `translate(${(cx - TIP_X).toFixed(1)}px, ${(tipY - TIP_Y).toFixed(1)}px)`;
  const cls = 'guide-hand' + (down ? ' down' : '') + (flip ? ' flip' : '');
  if (hand!.className !== cls) hand!.className = cls;
  if (shownFor !== el) {
    shownFor = el;
    // restart the pop-in animation for a new target
    layer!.classList.remove('show');
    void layer!.offsetWidth;
    layer!.classList.add('show');
  }
}

let raf = 0;
let target: HTMLElement | null = null;
let lastPick = 0;

function frame(t: number): void {
  raf = requestAnimationFrame(frame);
  if (t - lastPick > 180 || (target && !target.isConnected)) {
    lastPick = t;
    target = pickTarget();
  }
  place(target && target.isConnected ? target : null);
}

function setActive(on: boolean): void {
  if (on && !raf) {
    lastPick = 0;
    raf = requestAnimationFrame(frame);
  } else if (!on && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
    target = null;
    place(null);
  }
}

/** Starts the onboarding guide (call once). Runs its rAF loop only while a guided quest is active. */
export function startGuide(): void {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      if (t && t.closest?.('.qt-btn.go, .quests-screen .quest-card-action .btn-blue')) {
        lastGoAt = performance.now();
        lastGoQuest = trackedQuest(game)?.def.id ?? '';
      }
      // re-evaluate right after any tap so the hand moves on immediately
      lastPick = 0;
    },
    true,
  );
  if (import.meta.env.DEV) (window as any).__guide = { pickTarget, guidedNow };
  effect(() => {
    void version.value;
    const inBase = route.value.mode === 'base';
    const anyScreen = screens.value.length > 0;
    // No loop at all during runs / battles without panels, or once the guided quests are done.
    setActive((inBase || anyScreen) && guidedNow() !== null);
  });
}
