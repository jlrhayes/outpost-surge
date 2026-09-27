// Keeps world-projected call-to-action labels (district banner, building markers, vehicle labels) clear of the
// HUD panels on small phones: e.g. at 360x640 the quest tracker used to cover the "District N / Attack" banner and
// the "Build" pill sat on the builder-queue chips. Anchors opt in with a `data-clamp` attribute (see Anchor in
// BaseOverlay: "" = avoid the HUD, "cta" = also reserve its spot, "yield" = also avoid cta labels);
// projectAnchors() calls `adjustAnchor` for them. HUD rects are re-measured a few times per second,
// never per frame, so the per-frame cost is a handful of rectangle tests.
import { anchorAdjust, markAnchorsDirty } from './anchors';

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** HUD panels labels must not sit under (base HUD + base overlay chrome). */
const KEEP_OUT = ['.base-hud .hud-top', '.base-hud .side-stack', '.base-hud .qt-wrap', '.base-hud .bottom-bar', '.base-hud .world-btn', '.bo-builders'];
const GAP = 4;
const EDGE = 4;

let rects: Box[] = [];
let sig = '';
/** Cached content size per anchor element (content = the anchor's first child). */
const sizes = new WeakMap<Element, { child: Element | null; w: number; h: number }>();
const live = new Set<HTMLElement>();

function measureHud(): void {
  const next: Box[] = [];
  for (const sel of KEEP_OUT) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) next.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
  }
  const s = next.map((b) => `${b.l | 0},${b.t | 0},${b.r | 0},${b.b | 0}`).join(';');
  rects = next;
  // Re-measure label sizes too (their text changes: timers, "District 12", ...).
  let sizeChanged = false;
  for (const el of live) {
    if (!el.isConnected) {
      live.delete(el);
      continue;
    }
    const prev = sizes.get(el);
    const child = el.firstElementChild as HTMLElement | null;
    const w = child?.offsetWidth ?? 0;
    const h = child?.offsetHeight ?? 0;
    if (!prev || prev.child !== child || prev.w !== w || prev.h !== h) {
      sizes.set(el, { child, w, h });
      sizeChanged = true;
    }
  }
  if (s !== sig || sizeChanged) {
    sig = s;
    markAnchorsDirty();
  }
}

function sizeOf(el: HTMLElement): { w: number; h: number } {
  const child = el.firstElementChild as HTMLElement | null;
  let c = sizes.get(el);
  if (!c || c.child !== child) {
    c = { child, w: child?.offsetWidth ?? 0, h: child?.offsetHeight ?? 0 };
    sizes.set(el, c);
    live.add(el);
  }
  return c;
}

const overlaps = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/**
 * Boxes of `cta`/`yield` labels placed in the current and the previous projection pass: `yield` labels (vehicles)
 * make way for all of them; keeping the previous pass makes this independent of anchor registration order.
 */
interface Placed extends Box {
  el: Element;
  cta: boolean;
}
let placed: Placed[] = [];
let placedPrev: Placed[] = [];
function beginPass(): void {
  placedPrev = placed;
  placed = [];
}

/**
 * Moves a bottom-centre anchored label (the `.bo-top` layout: box = [x - w/2, y - h, x + w/2, y]) out of HUD rects
 * by the smallest push that keeps it on screen, then clamps it inside the viewport.
 * `data-clamp="cta"` labels (district banner) are remembered for the pass; `data-clamp="yield"` labels (vehicles,
 * registered after the district) also move out of their way.
 */
function adjustAnchor(el: HTMLElement, pt: { x: number; y: number }, width: number, height: number): void {
  const { w, h } = sizeOf(el);
  if (!w || !h) return;
  const kind = el.getAttribute('data-clamp');
  let obstacles: Box[] = rects;
  if (kind === 'yield' && (placed.length || placedPrev.length)) {
    // Labels already placed this pass + call-to-action labels from the last pass (never other yield labels from the
    // last pass: two of them could otherwise chase each other).
    obstacles = rects.concat(
      placed.filter((p) => p.el !== el),
      placedPrev.filter((p) => p.cta && p.el !== el),
    );
  }
  const box: Box = { l: pt.x - w / 2, t: pt.y - h, r: pt.x + w / 2, b: pt.y };
  const fits = (dx: number, dy: number) => box.l + dx >= EDGE && box.r + dx <= width - EDGE && box.t + dy >= EDGE && box.b + dy <= height - EDGE;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const r of obstacles) {
      if (!overlaps(box, r)) continue;
      const options: [number, number][] = [
        [0, r.t - GAP - box.b], // up
        [0, r.b + GAP - box.t], // down
        [r.l - GAP - box.r, 0], // left
        [r.r + GAP - box.l, 0], // right
      ];
      let best: [number, number] | null = null;
      let bestCost = Infinity;
      for (const o of options) {
        if (!fits(o[0], o[1])) continue;
        // Prefer pushes that don't land on another HUD panel.
        const next: Box = { l: box.l + o[0], t: box.t + o[1], r: box.r + o[0], b: box.b + o[1] };
        const clash = obstacles.some((q) => q !== r && overlaps(next, q));
        const cost = Math.abs(o[0]) + Math.abs(o[1]) + (clash ? 10000 : 0);
        if (cost < bestCost) {
          best = o;
          bestCost = cost;
        }
      }
      if (!best) continue;
      box.l += best[0];
      box.r += best[0];
      box.t += best[1];
      box.b += best[1];
      moved = true;
    }
    if (!moved) break;
  }
  // Keep the whole label on screen.
  const dx = box.l < EDGE ? EDGE - box.l : box.r > width - EDGE ? width - EDGE - box.r : 0;
  const dy = box.t < EDGE ? EDGE - box.t : box.b > height - EDGE ? height - EDGE - box.b : 0;
  pt.x = (box.l + box.r) / 2 + dx;
  pt.y = box.b + dy;
  if (kind === 'cta' || kind === 'yield') {
    placed.push({ el, cta: kind === 'cta', l: box.l + dx, t: box.t + dy, r: box.r + dx, b: box.b + dy });
    // First pass that knows this label: project once more so labels registered before it can make way.
    if (kind === 'cta' && !placedPrev.some((p) => p.el === el)) markAnchorsDirty();
  }
}

let timer = 0;
let users = 0;

/** Starts keeping `data-clamp` anchors clear of the HUD (ref-counted; returns the stop function). */
export function startHudSafeArea(): () => void {
  users++;
  if (users === 1) {
    anchorAdjust.fn = adjustAnchor;
    anchorAdjust.begin = beginPass;
    measureHud();
    // HUD panels change size with content (quest text, lookahead line): cheap re-measure a few times a second.
    timer = window.setInterval(measureHud, 400);
    window.addEventListener('resize', measureHud);
  }
  return () => {
    users--;
    if (users > 0) return;
    anchorAdjust.fn = null;
    anchorAdjust.begin = null;
    clearInterval(timer);
    window.removeEventListener('resize', measureHud);
    markAnchorsDirty();
  };
}
