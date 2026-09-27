// OWNER: runner agent. The player's squad: an instanced blob of soldiers packed in a sunflower
// (golden-angle spiral) formation that smoothly re-packs when the count changes. The true count can be
// far above the rendered cap; the floating label shows the real number.
import * as THREE from 'three';
import { soldierGeometry, vcMaterial } from '../../three/models';
import { SIM } from '../../data/runner';
import type { Fx } from './fx';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SCALE = 0.82;

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

export class Squad {
  readonly mesh: THREE.InstancedMesh;
  readonly cap: number;
  /** True soldier count. */
  count = 0;
  /** Formation centre (road coords). */
  x = 0;
  d = 0;
  /** Soldiers currently drawn (min(count, cap)). */
  rendered = 0;
  /** Half-width of the blob in x, and half-depth. */
  radius = 0.4;
  depth = 0.35;
  mode: 'run' | 'stand' | 'cheer' = 'run';
  private spacing = 0.34;
  private ox: Float32Array;
  private od: Float32Array;
  private sc: Float32Array;
  private ph: Float32Array;

  constructor(quality: 'low' | 'high') {
    this.cap = quality === 'high' ? 150 : 72;
    this.mesh = new THREE.InstancedMesh(soldierGeometry(), vcMaterial(), this.cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = quality === 'high';
    this.ox = new Float32Array(this.cap);
    this.od = new Float32Array(this.cap);
    this.sc = new Float32Array(this.cap);
    this.ph = new Float32Array(this.cap);
    for (let i = 0; i < this.cap; i++) this.ph[i] = Math.random() * 6.28;
  }

  reset(count: number, x: number, d: number): void {
    this.x = x;
    this.d = d;
    this.count = 0;
    this.rendered = 0;
    this.mode = 'run';
    this.setCount(count, null);
  }

  private relayout(): void {
    const n = Math.max(1, this.rendered);
    this.spacing = Math.min(0.36, 2.7 / Math.sqrt(n));
    this.radius = Math.max(0.35, this.spacing * Math.sqrt(n) + 0.15);
    this.depth = this.radius * 0.8;
  }

  /** Target offset of slot i for the current packing. */
  private target(i: number, out: { x: number; d: number }): void {
    const r = this.spacing * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    out.x = r * Math.cos(a);
    out.d = r * Math.sin(a) * 0.8;
  }

  /**
   * Sets the true count. New figures appear at (fromX, fromD) (or the centre) and run into formation;
   * removed figures (outer ring) burst into puffs.
   */
  setCount(n: number, fx: Fx | null, fromX?: number, fromD?: number): void {
    n = Math.max(0, Math.min(SIM.maxCount, Math.round(n)));
    const newR = Math.min(this.cap, n);
    if (newR < this.rendered && fx) {
      for (let i = newR; i < this.rendered; i++) fx.soldierPuff(this.x + this.ox[i], this.d + this.od[i]);
    }
    for (let i = this.rendered; i < newR; i++) {
      if (fromX !== undefined && fromD !== undefined) {
        this.ox[i] = fromX - this.x + (Math.random() - 0.5) * 1.2;
        this.od[i] = fromD - this.d + (Math.random() - 0.5) * 1.2;
      } else {
        this.target(i, this.tt);
        this.ox[i] = this.tt.x * 0.3;
        this.od[i] = this.tt.d * 0.3;
      }
      this.sc[i] = 0;
    }
    this.count = n;
    this.rendered = newR;
    this.mesh.count = newR;
    this.relayout();
  }

  /** World position of a random soldier (for muzzle origins). Prefers the front half. */
  shooter(out: { x: number; d: number }): void {
    if (this.rendered === 0) {
      out.x = this.x;
      out.d = this.d;
      return;
    }
    const i = (Math.random() * this.rendered) | 0;
    out.x = this.x + this.ox[i] - 0.12 * SCALE;
    out.d = this.d + this.od[i] + 0.45;
  }

  soldierAt(i: number, out: { x: number; d: number }): void {
    out.x = this.x + this.ox[i];
    out.d = this.d + this.od[i];
  }

  private tt = { x: 0, d: 0 };
  update(dt: number, t: number): void {
    const k = Math.min(1, dt * 7);
    const lim = SIM.roadHalf + 1.2;
    for (let i = 0; i < this.rendered; i++) {
      this.target(i, this.tt);
      this.ox[i] += (this.tt.x - this.ox[i]) * k;
      this.od[i] += (this.tt.d - this.od[i]) * k;
      if (this.sc[i] < 1) this.sc[i] = Math.min(1, this.sc[i] + dt * 4);
      let x = this.x + this.ox[i];
      if (x > lim) x = lim;
      else if (x < -lim) x = -lim;
      const ph = this.ph[i];
      let y = 0;
      let roll = 0;
      let pitch = 0;
      if (this.mode === 'run') {
        const s = Math.sin(t * 14 + ph);
        y = Math.abs(s) * 0.09;
        roll = s * 0.07;
        pitch = 0.1;
      } else if (this.mode === 'cheer') {
        y = Math.abs(Math.sin(t * 7 + ph)) * 0.45;
        roll = Math.sin(t * 5 + ph) * 0.15;
      } else {
        y = Math.abs(Math.sin(t * 3 + ph)) * 0.02;
      }
      // Soldiers face -Z (forward up the road): yaw PI.
      tmpE.set(pitch, Math.PI + roll * 0.6, roll);
      tmpQ.setFromEuler(tmpE);
      const pop = this.sc[i] < 1 ? this.sc[i] * (1 + 0.35 * Math.sin(this.sc[i] * Math.PI)) : 1;
      const s = SCALE * pop;
      tmpS.set(s, s, s);
      tmpV.set(x, y, -(this.d + this.od[i]));
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
