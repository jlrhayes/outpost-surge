// Single shared WebGL renderer + render loop. Exactly one GameMode is active at a time.
//
// A mode owns its scene/camera/input. Input: listen for pointer events on `engine.canvas`
// (UI overlays use pointer-events:none on empty areas so touches fall through to the canvas).
import * as THREE from 'three';
import { effect, untracked } from '@preact/signals';
import { route } from '../core/nav';
import type { ModeId } from '../core/types';
import { game } from '../core/store';

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

class Engine {
  canvas!: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  width = 1;
  height = 1;
  private modes = new Map<ModeId, GameMode>();
  private factories = new Map<ModeId, ModeFactory>();
  private current: GameMode | null = null;
  private clock = new THREE.Clock();
  private elapsed = 0;

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
    this.applyPixelRatio();
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
    const cap = game.settings.quality === 'high' ? 2 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.shadowMap.enabled = game.settings.quality === 'high';
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
    const m = this.getMode(id);
    this.current = m;
    m.resize(this.width, this.height);
    m.enter(params);
  }

  private onResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    for (const m of this.modes.values()) m.resize(this.width, this.height);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;
    const m = this.current;
    if (!m) return;
    m.update(dt, this.elapsed);
    this.renderer.render(m.scene, m.camera);
  }
}

export const engine = new Engine();

/** Helper for modes: convert a pointer event to normalized device coords. */
export function toNDC(e: { clientX: number; clientY: number }, out = new THREE.Vector2()): THREE.Vector2 {
  out.set((e.clientX / engine.width) * 2 - 1, -(e.clientY / engine.height) * 2 + 1);
  return out;
}
