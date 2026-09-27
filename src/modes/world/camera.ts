// OWNER: world agent. Tilted top-down map camera: one-finger pan with inertia, pinch / wheel zoom
// around the gesture point, tap detection and smooth fly-to. Allocation-free per frame.
import * as THREE from 'three';
import { engine } from '../../three/engine';
import { HALF } from '../../data/world';

const MIN_DIST = 20;
const MAX_DIST = 150;
const TAP_MOVE_PX = 9;
const TAP_MS = 380;

export class CameraRig {
  readonly target = new THREE.Vector3(0, 0, 0);
  dist = 56;
  /** Called with client coords when the user taps (no drag). */
  onTap: ((x: number, y: number) => void) | null = null;
  /** Called when the user starts dragging (cancels follow etc.). */
  onUserMove: (() => void) | null = null;

  private readonly vel = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private moved = false;
  private multi = false;
  private lastMoveT = 0;
  private pinchStart = 0;
  private pinchDist = 0;
  private fly: { fx: number; fz: number; fd: number; tx: number; tz: number; td: number; t: number; dur: number } | null = null;
  private attached = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.apply();
  }

  // ------------------------------------------------------------------ public API
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const c = engine.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    const c = engine.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.pointers.clear();
    this.vel.set(0, 0);
  }

  /** Smoothly move the view centre to (x, z) (and optionally zoom). */
  flyTo(x: number, z: number, dist = this.dist, instant = false): void {
    this.vel.set(0, 0);
    const td = THREE.MathUtils.clamp(dist, MIN_DIST, MAX_DIST);
    if (instant) {
      this.fly = null;
      this.target.set(x, 0, z);
      this.dist = td;
      this.clamp();
      this.apply();
      return;
    }
    const d = Math.hypot(x - this.target.x, z - this.target.z);
    this.fly = { fx: this.target.x, fz: this.target.z, fd: this.dist, tx: x, tz: z, td, t: 0, dur: Math.min(0.9, 0.35 + d / 250) };
  }

  /** Continuously track a moving point (e.g. a march) — call every frame while following. */
  track(x: number, z: number, dt: number): void {
    if (this.fly) return;
    const k = 1 - Math.exp(-dt * 6);
    this.target.x += (x - this.target.x) * k;
    this.target.z += (z - this.target.z) * k;
    this.clamp();
  }

  get busy(): boolean {
    return this.pointers.size > 0;
  }

  /** World units per screen pixel at the view centre. */
  unitsPerPixel(): number {
    return (2 * this.dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / Math.max(1, engine.height);
  }

  /** Normalised zoom 0 (closest) .. 1 (farthest). */
  get zoom01(): number {
    return (this.dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
  }

  /** Intersects the ground plane (y=0) under a client point. */
  groundAt(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    this.ndc.set((clientX / engine.width) * 2 - 1, -(clientY / engine.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out) !== null;
  }

  update(dt: number): void {
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const p = Math.min(1, f.t / f.dur);
      const e = 1 - Math.pow(1 - p, 3);
      this.target.x = f.fx + (f.tx - f.fx) * e;
      this.target.z = f.fz + (f.tz - f.fz) * e;
      this.dist = f.fd + (f.td - f.fd) * e;
      if (p >= 1) this.fly = null;
    } else if (this.pointers.size === 0 && (this.vel.x !== 0 || this.vel.y !== 0)) {
      this.target.x += this.vel.x * dt;
      this.target.z += this.vel.y * dt;
      const decay = Math.exp(-dt * 4.5);
      this.vel.multiplyScalar(decay);
      if (this.vel.lengthSq() < 0.05) this.vel.set(0, 0);
    }
    this.clamp();
    this.apply();
  }

  // ------------------------------------------------------------------ internals
  private pitch(): number {
    // a little more perspective when zoomed in, flatter top-down when zoomed out
    return THREE.MathUtils.degToRad(50 + this.zoom01 * 14);
  }

  apply(): void {
    const p = this.pitch();
    this.camera.position.set(this.target.x, Math.sin(p) * this.dist, this.target.z + Math.cos(p) * this.dist);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private clamp(): void {
    // keep the view mostly over the playable map (more margin when zoomed out)
    const m = Math.min(42, this.dist * 0.34);
    const limX = HALF - 4 - m * 0.45;
    const limZ = HALF - m;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -limX, limX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -limZ + 6, limZ + 8);
  }

  /** Zoom to `nd` keeping the ground point under (cx, cy) fixed on screen. */
  private zoomAround(cx: number, cy: number, nd: number): void {
    nd = THREE.MathUtils.clamp(nd, MIN_DIST, MAX_DIST);
    const had = this.groundAt(cx, cy, this.tmpA);
    this.dist = nd;
    this.apply();
    if (had && this.groundAt(cx, cy, this.tmpB)) {
      this.target.x += this.tmpA.x - this.tmpB.x;
      this.target.z += this.tmpA.z - this.tmpB.z;
      this.clamp();
      this.apply();
    }
  }

  private midpoint(): { x: number; y: number; d: number } {
    let x = 0;
    let y = 0;
    const pts: { x: number; y: number }[] = [];
    for (const p of this.pointers.values()) {
      x += p.x;
      y += p.y;
      pts.push(p);
    }
    const n = Math.max(1, pts.length);
    const d = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { x: x / n, y: y / n, d };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.fly = null;
    this.vel.set(0, 0);
    if (this.pointers.size === 1) {
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downT = performance.now();
      this.moved = false;
      this.multi = false;
      this.groundAt(e.clientX, e.clientY, this.anchor);
    } else if (this.pointers.size === 2) {
      this.multi = true;
      const m = this.midpoint();
      this.pinchStart = Math.max(10, m.d);
      this.pinchDist = this.dist;
      this.groundAt(m.x, m.y, this.anchor);
      this.onUserMove?.();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const t = performance.now();
    if (this.pointers.size === 1) {
      if (!this.moved && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_MOVE_PX) {
        this.moved = true;
        this.onUserMove?.();
      }
      if (!this.moved) return;
      if (!this.groundAt(e.clientX, e.clientY, this.tmpA)) return;
      const dx = this.anchor.x - this.tmpA.x;
      const dz = this.anchor.z - this.tmpA.z;
      const px = this.target.x;
      const pz = this.target.z;
      this.target.x += dx;
      this.target.z += dz;
      this.clamp();
      this.apply();
      const dtm = Math.max(1, t - this.lastMoveT) / 1000;
      const vx = (this.target.x - px) / dtm;
      const vz = (this.target.z - pz) / dtm;
      const k = dtm > 0.1 ? 1 : 0.4;
      this.vel.x += (vx - this.vel.x) * k;
      this.vel.y += (vz - this.vel.y) * k;
      this.lastMoveT = t;
    } else if (this.pointers.size >= 2) {
      const m = this.midpoint();
      const nd = (this.pinchDist * this.pinchStart) / Math.max(10, m.d);
      this.dist = THREE.MathUtils.clamp(nd, MIN_DIST, MAX_DIST);
      this.apply();
      if (this.groundAt(m.x, m.y, this.tmpA)) {
        this.target.x += this.anchor.x - this.tmpA.x;
        this.target.z += this.anchor.z - this.tmpA.z;
        this.clamp();
        this.apply();
      }
      this.moved = true;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    const t = performance.now();
    if (wasSingle) {
      if (!this.moved && !this.multi && t - this.downT < TAP_MS && e.type === 'pointerup') {
        this.vel.set(0, 0);
        this.onTap?.(e.clientX, e.clientY);
      } else if (t - this.lastMoveT > 90) {
        this.vel.set(0, 0);
      } else {
        const max = 260;
        if (this.vel.length() > max) this.vel.setLength(max);
      }
    } else if (this.pointers.size === 1) {
      // pinch -> pan: re-anchor under the remaining finger so the map doesn't jump
      const rest = this.pointers.values().next().value!;
      this.groundAt(rest.x, rest.y, this.anchor);
      this.vel.set(0, 0);
      this.lastMoveT = t;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.fly = null;
    const f = Math.exp(THREE.MathUtils.clamp(e.deltaY, -200, 200) * 0.0015);
    this.zoomAround(e.clientX, e.clientY, this.dist * f);
  };
}
