// Single shared WebGL renderer + render loop. Exactly one GameMode is active at a time.
//
// A mode owns its scene/camera/input. Input: listen for pointer events on `engine.canvas`
// (UI overlays use pointer-events:none on empty areas so touches fall through to the canvas).
import * as THREE from 'three';
import { effect, untracked } from '@preact/signals';
import { route, toast } from '../core/nav';
import type { ModeId } from '../core/types';
import { game, mutate } from '../core/store';

export interface GameMode {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** Called when the mode becomes active. `params` = route params from goTo(). */
  enter(params: any): void;
  /** Called when leaving the mode: remove listeners, stop timers. Scene may be kept for reuse. */
  exit(): void;
  /** Per-frame update. dt in seconds (clamped to 0.1). */
  update(dt: number, elapsed: number): void;
  resize(width: number, height: number): void;
}

export type ModeFactory = () => GameMode;

/** Max framebuffer pixels per quality level (keeps tablets / high-DPR phones in budget). */
const MAX_PIXELS = { high: 2_400_000, low: 1_000_000 };
const MAX_DPR = { high: 2, low: 1.25 };

class Engine {
  canvas!: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  width = 1;
  height = 1;
  /** Test hook: when set, every frame advances by this many seconds instead of wall time. */
  dtOverride: number | null = null;
  private modes = new Map<ModeId, GameMode>();
  private factories = new Map<ModeId, ModeFactory>();
  private current: GameMode | null = null;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private frameNo = 0;
  /** True while an opaque full-screen overlay hides the 3D view (skip update + render). */
  private covered = false;
  private modeToken = 0;
  // Automatic quality check (once per install): sample real frame times on 'high'.
  private perfSamples = 0;
  private perfTime = 0;
  private perfSettle = 0;

  init(container: HTMLElement, factories: Record<ModeId, ModeFactory>): void {
    for (const [k, f] of Object.entries(factories)) this.factories.set(k as ModeId, f);
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: game.settings.quality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = game.settings.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.timer.connect(document);
    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    // Only `route` is tracked: modes may read/write state in enter()/exit() without re-triggering this effect.
    effect(() => {
      const r = route.value;
      untracked(() => this.setMode(r.mode, r.params));
    });

    this.renderer.setAnimationLoop(() => this.frame());
  }

  applyPixelRatio(): void {
    const q = game.settings.quality;
    const px = Math.max(1, this.width * this.height);
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR[q], Math.sqrt(MAX_PIXELS[q] / px));
    this.renderer.setPixelRatio(Math.max(0.75, ratio));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.shadowMap.enabled = q === 'high';
  }

  getMode<T extends GameMode>(id: ModeId): T {
    let m = this.modes.get(id);
    if (!m) {
      const f = this.factories.get(id);
      if (!f) throw new Error(`No mode registered: ${id}`);
      m = f();
      this.modes.set(id, m);
      m.resize(this.width, this.height);
    }
    return m as T;
  }

  private setMode(id: ModeId, params: any): void {
    if (this.current) this.current.exit();
    this.current = null;
    const token = ++this.modeToken;
    const activate = () => {
      if (token !== this.modeToken) return; // superseded by a newer goTo()
      const m = this.getMode(id);
      this.current = m;
      m.resize(this.width, this.height);
      m.enter(params);
      this.perfSettle = 2; // ignore frame times right after a mode switch
      setVeil(false);
    };
    if (this.modes.has(id) || !this.modes.size) {
      activate();
    } else {
      // First visit to a heavy mode builds its whole scene synchronously: show a veil first so the
      // tap gets immediate feedback instead of a frozen frame.
      setVeil(true);
      setTimeout(activate, 40);
    }
  }

  private onResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.applyPixelRatio();
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    for (const m of this.modes.values()) m.resize(this.width, this.height);
  }

  /** Is the top overlay an opaque full-screen panel? (Checked a few times a second.) */
  private checkCovered(): void {
    const layers = document.querySelectorAll('#ui > .screen-layer');
    const top = layers[layers.length - 1];
    this.covered = !!top && !!top.querySelector(':scope > .screen');
  }

  frame(): void {
    this.timer.update();
    const dt = this.dtOverride ?? Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += dt;
    if (++this.frameNo % 10 === 0) this.checkCovered();
    const m = this.current;
    if (!m || this.covered) return;
    m.update(dt, this.elapsed);
    this.renderer.render(m.scene, m.camera);
    if (this.dtOverride === null) this.samplePerf(dt);
  }

  /**
   * One-time automatic downgrade: if a device can't hold ~32 fps on 'high' during its first
   * seconds of real play, switch to 'low' (no shadows, lower resolution).
   */
  private samplePerf(dt: number): void {
    if (game.settings.perfChecked || game.settings.quality !== 'high' || document.visibilityState !== 'visible') return;
    if (this.perfSettle > 0) {
      this.perfSettle -= dt;
      return;
    }
    this.perfSamples++;
    this.perfTime += dt;
    if (this.perfTime < 6) return;
    const fps = this.perfSamples / this.perfTime;
    mutate((s) => {
      s.settings.perfChecked = true;
      if (fps < 32) s.settings.quality = 'low';
    });
    if (fps < 32) {
      this.applyPixelRatio();
      toast('Graphics set to Low for smoother play (change in Settings)', 'info');
    }
  }
}

function setVeil(on: boolean): void {
  const el = document.getElementById('veil');
  if (el) el.classList.toggle('show', on);
}

export const engine = new Engine();

/** Helper for modes: convert a pointer event to normalized device coords. */
export function toNDC(e: { clientX: number; clientY: number }, out = new THREE.Vector2()): THREE.Vector2 {
  out.set((e.clientX / engine.width) * 2 - 1, -(e.clientY / engine.height) * 2 + 1);
  return out;
}
