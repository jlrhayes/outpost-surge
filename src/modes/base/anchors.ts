// OWNER: base agent. Bridge between the 3D base scene and the DOM overlay:
//  - the scene publishes world positions for keyed anchors (buildings, plots, districts, vehicles)
//  - the overlay registers DOM elements for those keys (via anchorRef)
//  - every frame the scene projects anchors to screen space and moves the elements (no re-render).
import * as THREE from 'three';
import { signal } from '@preact/signals';

/** Currently selected thing in the base: 'b:<uid>' for buildings (null = nothing). */
export const selection = signal<string | null>(null);
/** Camera zoom level bucket for the overlay (hide small badges when zoomed far out). */
export const zoomedOut = signal(false);
/** Bumped whenever the scene layout changes (buildings added/moved) so the overlay can re-query. */
export const layoutVersion = signal(0);
/** True while the scene plays a cinematic (district reveal): the overlay hides interactive bits. */
export const sceneBusy = signal(false);
/** Number of districts currently shown as cleared in the scene (lags the game during a reveal). */
export const shownCleared = signal(0);

interface AnchorEl {
  el: HTMLElement;
  x: number;
  y: number;
  shown: boolean;
}

const world = new Map<string, THREE.Vector3>();
const els = new Map<string, AnchorEl>();
const refs = new Map<string, (el: HTMLElement | null) => void>();
let dirty = true;

export function setAnchor(key: string, x: number, y: number, z: number): void {
  let v = world.get(key);
  if (!v) world.set(key, (v = new THREE.Vector3()));
  if (v.x !== x || v.y !== y || v.z !== z) {
    v.set(x, y, z);
    dirty = true;
  }
}

export function removeAnchor(key: string): void {
  if (world.delete(key)) dirty = true;
}

export function getAnchor(key: string): THREE.Vector3 | undefined {
  return world.get(key);
}

/** Stable ref callback for an overlay element bound to an anchor key. */
export function anchorRef(key: string): (el: HTMLElement | null) => void {
  let r = refs.get(key);
  if (!r) {
    r = (el: HTMLElement | null) => {
      if (el) {
        const cur = els.get(key);
        if (cur && cur.el === el) return;
        els.set(key, { el, x: NaN, y: NaN, shown: false });
        el.style.visibility = 'hidden';
        dirty = true;
      } else {
        // Unmount order vs. a replacement mount is not guaranteed: drop only detached elements.
        queueMicrotask(() => {
          const cur = els.get(key);
          if (cur && !cur.el.isConnected) els.delete(key);
        });
      }
    };
    refs.set(key, r);
  }
  return r;
}

export function markAnchorsDirty(): void {
  dirty = true;
}

const tmp = new THREE.Vector3();

/**
 * Optional screen-space adjustment for anchors whose element has a `data-clamp` attribute: BaseOverlay installs it
 * to keep call-to-action labels clear of HUD panels (see ./hudSafeArea.ts). Moves `pt` in place.
 */
export const anchorAdjust: {
  fn: ((el: HTMLElement, pt: { x: number; y: number }, width: number, height: number) => void) | null;
  /** Called once before each projection pass that may call `fn`. */
  begin: (() => void) | null;
} = { fn: null, begin: null };
const adj = { x: 0, y: 0 };

/** Projects all registered anchors. Cheap when neither the camera nor the anchors changed. */
export function projectAnchors(camera: THREE.Camera, width: number, height: number, cameraMoved: boolean): void {
  if (!cameraMoved && !dirty) return;
  dirty = false;
  anchorAdjust.begin?.();
  const margin = 80;
  for (const [key, a] of els) {
    const p = world.get(key);
    let show = false;
    let x = 0;
    let y = 0;
    if (p) {
      tmp.copy(p).project(camera);
      if (tmp.z < 1) {
        x = (tmp.x + 1) * 0.5 * width;
        y = (1 - tmp.y) * 0.5 * height;
        show = x > -margin && x < width + margin && y > -margin && y < height + margin;
      }
    }
    if (show && anchorAdjust.fn && a.el.hasAttribute('data-clamp')) {
      adj.x = x;
      adj.y = y;
      anchorAdjust.fn(a.el, adj, width, height);
      x = adj.x;
      y = adj.y;
    }
    if (show !== a.shown) {
      a.shown = show;
      a.el.style.visibility = show ? '' : 'hidden';
    }
    if (show && !(Math.abs(x - a.x) <= 0.3 && Math.abs(y - a.y) <= 0.3)) {
      a.x = x;
      a.y = y;
      a.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
  }
}

/** Screen position of an anchor's element (for effects), or null if not on screen. */
export function anchorScreenPos(key: string): { x: number; y: number } | null {
  const a = els.get(key);
  if (!a || !a.shown || Number.isNaN(a.x)) return null;
  return { x: a.x, y: a.y };
}
