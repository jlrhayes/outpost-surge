// OWNER: runner agent. Pooled tracer bullets (one InstancedMesh). Each visual bullet carries the pooled
// damage of many soldiers' shots, so a 400-soldier squad costs the same as a 20-soldier one.
// Three looks share the mesh via instance scale/colour: rifle tracers, spread-gun pellets (short, amber,
// fanned out) and cannon shells (big, orange-hot slugs).
import * as THREE from 'three';
import { bulletGeometry, vcGlowMaterial } from '../../three/models';
import { SIM } from '../../data/runner';

export const BULLET_RIFLE = 0;
export const BULLET_PELLET = 1;
export const BULLET_SHELL = 2;

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
// The model points along +Z; our bullets fly up the road toward -Z.
const tmpQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const tmpQ2 = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const TINT: [number, number, number][] = [
  [1, 1, 1],
  [1, 0.72, 0.36],
  [1.3, 0.5, 0.16],
];

export class Bullets {
  readonly mesh: THREE.InstancedMesh;
  readonly cap = 200;
  n = 0;
  readonly x = new Float32Array(this.cap);
  readonly y = new Float32Array(this.cap);
  readonly d = new Float32Array(this.cap);
  readonly vx = new Float32Array(this.cap);
  readonly start = new Float32Array(this.cap);
  readonly range = new Float32Array(this.cap);
  readonly dmg = new Float32Array(this.cap);
  readonly kind = new Uint8Array(this.cap);

  constructor() {
    // Cached model geometry + shared unlit material: never disposed here.
    this.mesh = new THREE.InstancedMesh(bulletGeometry(), vcGlowMaterial(), this.cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    // Instance colours from the start so the shader variant never changes mid-run.
    for (let i = 0; i < this.cap; i++) this.mesh.setColorAt(i, tmpC.setRGB(1, 1, 1));
  }

  spawn(x: number, y: number, d: number, dmg: number, kind = BULLET_RIFLE, vx = 0, range = SIM.bulletRange): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.d[i] = d;
    this.vx[i] = vx;
    this.start[i] = d;
    this.range[i] = range;
    this.dmg[i] = dmg;
    this.kind[i] = kind;
  }

  kill(i: number): void {
    const l = --this.n;
    if (i !== l) {
      this.x[i] = this.x[l];
      this.y[i] = this.y[l];
      this.d[i] = this.d[l];
      this.vx[i] = this.vx[l];
      this.start[i] = this.start[l];
      this.range[i] = this.range[l];
      this.dmg[i] = this.dmg[l];
      this.kind[i] = this.kind[l];
    }
  }

  render(): void {
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      tmpV.set(this.x[i], this.y[i], -this.d[i]);
      // Stretch into a streak once it has left the muzzle.
      const travelled = this.d[i] - this.start[i];
      if (k === BULLET_SHELL) tmpS.set(3.4, 3.4, Math.min(2.2, travelled * 0.9 + 1.2));
      else if (k === BULLET_PELLET) tmpS.set(1.9, 1.9, Math.min(1.3, travelled * 1.2 + 0.5));
      else tmpS.set(1.5, 1.5, Math.min(2.4, travelled * 1.4 + 0.6));
      if (this.vx[i] !== 0) {
        // Fanned pellets point along their travel direction.
        tmpQ2.setFromAxisAngle(UP, Math.atan2(-this.vx[i], SIM.bulletSpeed)).multiply(tmpQ);
        tmpM.compose(tmpV, tmpQ2, tmpS);
      } else tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
      const c = TINT[k];
      this.mesh.setColorAt(i, tmpC.setRGB(c[0], c[1], c[2]));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
