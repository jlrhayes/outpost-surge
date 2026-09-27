// OWNER: base agent. 3/4 top-down camera for the base: one-finger grab-pan with inertia, pinch & wheel
// zoom toward the fingers/cursor, clamped bounds, eased focus animation, tap detection.
import * as THREE from 'three';
import { engine, toNDC } from '../../three/engine';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const TAP_MOVE_PX = 9;
const TAP_MS = 450;

export class CameraRig {
  readonly target = new THREE.Vector3(0, 0, 4);
  dist = 70;
  minDist = 30;
  maxDist = 118;
  readonly pitch = THREE.MathUtils.degToRad(54);
  readonly yaw = 0;
  bounds: Bounds = { minX: -40, maxX: 40, minZ: -46, maxZ: 52 };
  /** Called for a short, still tap with the pointer's client coords. */
  onTap: ((x: number, y: number) => void) | null = null;
  /** True for the frame(s) in which the camera moved (for overlay reprojection). */
  moved = true;

  private vel = new THREE.Vector2();
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt = 0;
  private downPos = { x: 0, y: 0 };
  private dragging = false;
  private grab = new THREE.Vector3();
  private grabValid = false;
  private pinchStart = 0;
  private pinchStartDist = 0;
  private lastMoveT = 0;
  private anim: { fx: number; fz: number; tx: number; tz: number; fd: number; td: number; t: number; dur: number } | null = null;
  private lastPos = new THREE.Vector3(Infinity, 0, 0);

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ndc = new THREE.Vector2();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  // ---- input ----
  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  detach(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    canvas.removeEventListener('wheel', this.onWheel);
    this.pointers.clear();
    this.dragging = false;
  }

  /** Ground point (y=0) under a client position, written into `out`. Returns false if none. */
  groundAt(x: number, y: number, out: THREE.Vector3): boolean {
    toNDC({ clientX: x, clientY: y }, this.ndc);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out) !== null;
  }

  raycaster(x: number, y: number): THREE.Raycaster {
    toNDC({ clientX: x, clientY: y }, this.ndc);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray;
  }

  private onDown = (e: PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.anim = null;
    this.vel.set(0, 0);
    if (this.pointers.size === 1) {
      this.downAt = performance.now();
      this.downPos.x = e.clientX;
      this.downPos.y = e.clientY;
      this.dragging = false;
      this.apply();
      this.grabValid = this.groundAt(e.clientX, e.clientY, this.grab);
    } else if (this.pointers.size === 2) {
      this.dragging = true; // a pinch is never a tap
      this.pinchStart = this.pinchDistance();
      this.pinchStartDist = this.dist;
    }
  };

  private pinchDistance(): number {
    const it = this.pointers.values();
    const a = it.next().value!;
    const b = it.next().value!;
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  private pinchMid(): { x: number; y: number } {
    const it = this.pointers.values();
    const a = it.next().value!;
    const b = it.next().value!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 1) {
      if (!this.dragging && Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > TAP_MOVE_PX) this.dragging = true;
      if (!this.dragging || !this.grabValid) return;
      this.apply();
      if (!this.groundAt(e.clientX, e.clientY, this.tmp)) return;
      const dx = this.grab.x - this.tmp.x;
      const dz = this.grab.z - this.tmp.z;
      this.target.x += dx;
      this.target.z += dz;
      this.clampTarget();
      const t = performance.now();
      const dt = Math.max(16, t - this.lastMoveT) / 1000;
      this.lastMoveT = t;
      // Smoothed, capped velocity for inertia.
      this.vel.x = this.vel.x * 0.6 + (dx / dt) * 0.4;
      this.vel.y = this.vel.y * 0.6 + (dz / dt) * 0.4;
      const maxV = 40 + this.dist;
      const len = this.vel.length();
      if (len > maxV) this.vel.multiplyScalar(maxV / len);
    } else if (this.pointers.size === 2) {
      const mid = this.pinchMid();
      const scale = this.pinchStart / this.pinchDistance();
      this.zoomAround(mid.x, mid.y, this.pinchStartDist * scale);
    }
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1) {
      // Pinch ended with one finger still down: re-grab under that finger.
      const p = this.pointers.values().next().value!;
      this.apply();
      this.grabValid = this.groundAt(p.x, p.y, this.grab);
      this.vel.set(0, 0);
      return;
    }
    if (this.pointers.size > 0) return;
    const quick = performance.now() - this.downAt < TAP_MS;
    if (!this.dragging && quick && e.type === 'pointerup') {
      this.vel.set(0, 0);
      this.onTap?.(e.clientX, e.clientY);
    } else if (performance.now() - this.lastMoveT > 90) {
      this.vel.set(0, 0); // finger rested before release: no fling
    }
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.anim = null;
    const f = Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.0015)));
    this.zoomAround(e.clientX, e.clientY, this.dist * f);
  };

  /** Zooms to `newDist` keeping the ground point under the given client position fixed. */
  private zoomAround(x: number, y: number, newDist: number): void {
    this.apply();
    const had = this.groundAt(x, y, this.tmp);
    this.dist = THREE.MathUtils.clamp(newDist, this.minDist, this.maxDist);
    this.apply();
    if (had && this.groundAt(x, y, this.tmp2)) {
      this.target.x += this.tmp.x - this.tmp2.x;
      this.target.z += this.tmp.z - this.tmp2.z;
      this.clampTarget();
    }
    this.apply();
  }

  // ---- control ----
  /** Smoothly pans (and optionally zooms) to a ground point. */
  focusOn(x: number, z: number, dist?: number, dur = 0.75): void {
    this.vel.set(0, 0);
    const tx = THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX);
    const tz = THREE.MathUtils.clamp(z, this.bounds.minZ, this.bounds.maxZ);
    this.anim = { fx: this.target.x, fz: this.target.z, tx, tz, fd: this.dist, td: dist ?? this.dist, t: 0, dur };
  }

  jumpTo(x: number, z: number, dist?: number): void {
    this.anim = null;
    this.vel.set(0, 0);
    this.target.set(x, 0, z);
    if (dist) this.dist = dist;
    this.clampTarget();
    this.apply();
  }

  get isInteracting(): boolean {
    return this.pointers.size > 0;
  }

  private clampTarget(): void {
    const b = this.bounds;
    this.target.x = THREE.MathUtils.clamp(this.target.x, b.minX, b.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, b.minZ, b.maxZ);
  }

  update(dt: number): void {
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.target.x = a.fx + (a.tx - a.fx) * e;
      this.target.z = a.fz + (a.tz - a.fz) * e;
      this.dist = a.fd + (a.td - a.fd) * e;
      if (k >= 1) this.anim = null;
    } else if (this.pointers.size === 0 && (Math.abs(this.vel.x) > 0.05 || Math.abs(this.vel.y) > 0.05)) {
      this.target.x += this.vel.x * dt;
      this.target.z += this.vel.y * dt;
      const damp = Math.exp(-dt * 5);
      this.vel.multiplyScalar(damp);
      const bx = this.target.x;
      const bz = this.target.z;
      this.clampTarget();
      if (bx !== this.target.x) this.vel.x = 0;
      if (bz !== this.target.z) this.vel.y = 0;
    }
    this.apply();
    const pos = this.camera.position;
    this.moved = pos.distanceToSquared(this.lastPos) > 1e-8;
    this.lastPos.copy(pos);
  }

  apply(): void {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // Keep a similar horizontal extent between portrait phones and wide screens.
    this.camera.fov = w / h < 1 ? 44 : 34;
    this.camera.updateProjectionMatrix();
    this.moved = true;
  }

  /** Canvas the rig listens to. */
  static get canvas(): HTMLCanvasElement {
    return engine.canvas;
  }
}
