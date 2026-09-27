// OWNER: base agent. UI-facing building actions with feedback (sfx, toasts, fly-to-HUD effects, screens).
import { h, render } from 'preact';
import { game } from '../../core/store';
import { closeScreen, openScreen, toast } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt } from '../../core/format';
import type { BuildingType, CurrencyId } from '../../core/types';
import { Icon } from '../../ui/components/Icon';
import { buildingName } from '../../data/buildings';
import {
  applySpeedup,
  buySecondBuilder,
  collectBuilding,
  constructBuilding,
  finishFree,
  finishNow,
  getBuilding,
  instantUpgrade,
  startUpgrade,
  type ActionResult,
} from '../../systems/buildings';
import { anchorScreenPos } from './anchors';

/** Hooks the 3D scene installs so UI actions can trigger scene feedback. */
export const sceneHooks = {
  bounce: (_uid: string) => {},
  celebrate: (_uid: string) => {},
  focusUid: (_uid: string) => {},
};

function fail(r: ActionResult, uid?: string): void {
  sfx.error();
  if (r.block === 'builders') {
    openScreen('baseBuilders', { forUid: uid });
    return;
  }
  toast(r.reason ?? 'Not possible right now', 'bad');
}

export function doUpgrade(uid: string): boolean {
  const r = startUpgrade(uid);
  if (!r.ok) {
    fail(r, uid);
    return false;
  }
  sfx.click();
  sceneHooks.bounce(uid);
  return true;
}

export function doConstruct(type: BuildingType, plot: number): boolean {
  const r = constructBuilding(type, plot);
  if (!r.ok) {
    if (r.reason === 'All builders are busy') fail({ ok: false, block: 'builders' });
    else fail(r);
    return false;
  }
  sfx.click();
  toast(`Constructing ${buildingName(type)}...`, 'info');
  closeScreen();
  if (r.uid) {
    const uid = r.uid;
    setTimeout(() => sceneHooks.focusUid(uid), 50);
  }
  return true;
}

export function doFreeFinish(uid: string): void {
  const r = finishFree(uid);
  if (!r.ok) fail(r);
}

export function doFinishNow(uid: string): void {
  const r = finishNow(uid);
  if (!r.ok) fail(r);
}

export function doInstantUpgrade(uid: string): void {
  const r = instantUpgrade(uid);
  if (!r.ok) fail(r, uid);
}

export function doBuyBuilder(): boolean {
  const r = buySecondBuilder();
  if (!r.ok) {
    fail(r);
    return false;
  }
  sfx.reward();
  toast('2nd builder hired for good!', 'good');
  return true;
}

export function openSpeedup(uid: string): void {
  const b = getBuilding(game, uid);
  if (!b || b.upgradeEndsAt === null) return;
  openScreen('speedup', {
    title: `${buildingName(b.type)} Lv ${b.level + 1}`,
    getEndsAt: () => getBuilding(game, uid)?.upgradeEndsAt ?? null,
    apply: (ms: number) => applySpeedup(uid, ms),
    onFinishNow: () => doFinishNow(uid),
  });
}

/** Collects a producer with a flying-icon effect from its bubble. */
export function doCollect(uid: string): boolean {
  const r = collectBuilding(uid);
  if (!r) return false;
  sfx.reward();
  sceneHooks.bounce(uid);
  const p = anchorScreenPos('b:' + uid);
  if (p) flyResource(r.resource, r.amount, p.x, p.y);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Fly-to-HUD effect (imperative DOM, Web Animations API)
// ---------------------------------------------------------------------------------------------

let fxLayer: HTMLDivElement | null = null;
function layer(): HTMLDivElement {
  if (!fxLayer || !fxLayer.isConnected) {
    fxLayer = document.createElement('div');
    fxLayer.className = 'bo-fx-layer';
    document.body.appendChild(fxLayer);
  }
  return fxLayer;
}

const FALLBACK_X: Partial<Record<CurrencyId, number>> = { food: 0.34, iron: 0.52, gold: 0.7, diamonds: 0.86, heroExp: 0.14 };

const BAR_INDEX: Partial<Record<CurrencyId, number>> = { food: 0, iron: 1, gold: 2, diamonds: 3 };

function targetFor(res: CurrencyId): { x: number; y: number } {
  let el = document.querySelector(`[data-res="${res}"]`) as HTMLElement | null;
  // The HUD resource bar lists food, iron, gold, diamonds in order.
  const idx = BAR_INDEX[res];
  if (!el && idx !== undefined) el = document.querySelectorAll('.hud-layer .res-bar .res-pill-icon')[idx] as HTMLElement | null;
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0) return { x: r.left + Math.min(16, r.width / 2), y: r.top + r.height / 2 };
  }
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  return { x: window.innerWidth * (FALLBACK_X[res] ?? 0.5), y: top + 22 };
}

export function flyResource(res: CurrencyId, amount: number, x: number, y: number): void {
  const root = layer();
  const tgt = targetFor(res);
  const n = Math.min(8, 3 + Math.floor(Math.log10(Math.max(10, amount))));
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'bo-fly';
    render(h(Icon, { name: res, size: 26 }), el);
    root.appendChild(el);
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const r = 30 + Math.random() * 26;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r * 0.7;
    const anim = el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy}px) scale(1.15)`, opacity: 1, offset: 0.28 },
        { transform: `translate(${sx}px, ${sy - 6}px) scale(1)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${tgt.x}px, ${tgt.y}px) scale(0.55)`, opacity: 0.9 },
      ],
      { duration: 850 + i * 55, easing: 'cubic-bezier(.45,0,.75,.35)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      render(null, el);
      el.remove();
    };
  }
  const plus = document.createElement('div');
  plus.className = 'bo-plus bo-plus-' + res;
  plus.textContent = '+' + fmt(amount);
  root.appendChild(plus);
  const pa = plus.animate(
    [
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - 26}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${x}px, ${y - 60}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
    ],
    { duration: 1100, easing: 'ease-out', fill: 'forwards' },
  );
  pa.onfinish = () => plus.remove();
}
