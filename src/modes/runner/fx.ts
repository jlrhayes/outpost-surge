// OWNER: runner agent. Juice: pooled particles (additive sparks/flashes + lit puffs/debris), shockwave
// rings, DOM floating text, screen flash and camera shake. No per-frame allocations.
import * as THREE from 'three';
import { glowParticleMat, puffMat, ringMat } from './mats';

let geos: { ico: THREE.BufferGeometry; ring: THREE.BufferGeometry } | null = null;
function fxGeos() {
  return (geos ??= { ico: new THREE.IcosahedronGeometry(0.5, 0), ring: new THREE.RingGeometry(0.82, 1, 40) });
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const SPIN_AXIS = new THREE.Vector3(0.3, 1, 0.2).normalize();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** A fixed-size pool of instanced particles. World z is passed directly (callers convert d -> -d). */
class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private grav: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private rot: Float32Array;

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    readonly cap: number,
    private additive: boolean,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, tmpC.setRGB(1, 1, 1));
    const f = () => new Float32Array(cap);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.life = f();
    this.max = f();
    this.size = f();
    this.grav = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.rot = f();
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav = 0): void {
    let i = this.n;
    if (i >= this.cap) {
      // Recycle the oldest-ish slot (cheap: overwrite a random one).
      i = (Math.random() * this.cap) | 0;
    } else this.n++;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.cr[i] = ((color >> 16) & 255) / 255;
    this.cg[i] = ((color >> 8) & 255) / 255;
    this.cb[i] = (color & 255) / 255;
    this.rot[i] = Math.random() * 6.28;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.n;
        if (i !== last) {
          this.px[i] = this.px[last];
          this.py[i] = this.py[last];
          this.pz[i] = this.pz[last];
          this.vx[i] = this.vx[last];
          this.vy[i] = this.vy[last];
          this.vz[i] = this.vz[last];
          this.life[i] = this.life[last];
          this.max[i] = this.max[last];
          this.size[i] = this.size[last];
          this.grav[i] = this.grav[last];
          this.cr[i] = this.cr[last];
          this.cg[i] = this.cg[last];
          this.cb[i] = this.cb[last];
          this.rot[i] = this.rot[last];
        }
        continue;
      }
      const drag = Math.max(0, 1 - dt * 2.2);
      this.vx[i] *= drag;
      this.vz[i] *= drag;
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05 && this.grav[i] > 0) {
        this.py[i] = 0.05;
        this.vy[i] *= -0.3;
      }
      i++;
    }
    for (let k = 0; k < this.n; k++) {
      const t = this.life[k] / this.max[k];
      const s = this.additive ? this.size[k] * (0.4 + 0.6 * t) : this.size[k] * Math.min(1, t * 2.2);
      tmpQ.setFromAxisAngle(SPIN_AXIS, this.rot[k] + (1 - t) * 3);
      tmpV.set(this.px[k], this.py[k], this.pz[k]);
      tmpS.set(s, s, s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(k, tmpM);
      const b = this.additive ? t : 1;
      tmpC.setRGB(this.cr[k] * b, this.cg[k] * b, this.cb[k] * b);
      this.mesh.setColorAt(k, tmpC);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.mesh.count = 0;
  }
}

/** Expanding ground rings for explosions / gate passes. */
const RING_CAP = 20;

class RingPool {
  readonly mesh: THREE.InstancedMesh;
  private x = new Float32Array(RING_CAP);
  private z = new Float32Array(RING_CAP);
  private t = new Float32Array(RING_CAP);
  private dur = new Float32Array(RING_CAP);
  private rad = new Float32Array(RING_CAP);
  private col = new Uint32Array(RING_CAP);
  private n = 0;
  private next = 0;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(geo, mat, RING_CAP);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, tmpC.setRGB(1, 1, 1));
  }
  spawn(x: number, z: number, radius: number, color: number, dur = 0.45): void {
    const i = this.n < RING_CAP ? this.n++ : (this.next = (this.next + 1) % RING_CAP);
    this.x[i] = x;
    this.z[i] = z;
    this.t[i] = 0;
    this.dur[i] = dur;
    this.rad[i] = radius;
    this.col[i] = color;
  }
  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.t[i] += dt;
      if (this.t[i] >= this.dur[i]) {
        const l = --this.n;
        this.x[i] = this.x[l];
        this.z[i] = this.z[l];
        this.t[i] = this.t[l];
        this.dur[i] = this.dur[l];
        this.rad[i] = this.rad[l];
        this.col[i] = this.col[l];
        continue;
      }
      i++;
    }
    for (let k = 0; k < this.n; k++) {
      const p = this.t[k] / this.dur[k];
      const s = this.rad[k] * (0.2 + 0.8 * Math.sqrt(p));
      tmpQ.setFromAxisAngle(X_AXIS, -Math.PI / 2);
      tmpV.set(this.x[k], 0.08, this.z[k]);
      tmpS.set(s, s, s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(k, tmpM);
      const b = 1 - p;
      const c = this.col[k];
      tmpC.setRGB((((c >> 16) & 255) / 255) * b, (((c >> 8) & 255) / 255) * b, ((c & 255) / 255) * b);
      this.mesh.setColorAt(k, tmpC);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear(): void {
    this.n = 0;
    this.mesh.count = 0;
  }
}

export type FloatKind = 'good' | 'bad' | 'dmg' | 'info' | 'big-good' | 'big-bad' | 'crit';

export class Fx {
  readonly group = new THREE.Group();
  private glow: ParticlePool;
  private puffs: ParticlePool;
  private rings: RingPool;
  shake = 0;
  private texts: HTMLDivElement[] = [];
  private textIdx = 0;
  private flashEl: HTMLDivElement;
  private flashAnim: Animation | null = null;
  private proj = new THREE.Vector3();

  constructor(
    private overlay: HTMLElement,
    private camera: THREE.Camera,
    quality: 'low' | 'high',
  ) {
    const hi = quality === 'high';
    // Geometries and materials are cached for the app's lifetime (no shader recompiles on Retry).
    const g = fxGeos();
    this.glow = new ParticlePool(g.ico, glowParticleMat(), hi ? 420 : 200, true);
    this.puffs = new ParticlePool(g.ico, puffMat(), hi ? 360 : 180, false);
    this.rings = new RingPool(g.ring, ringMat());
    this.group.add(this.puffs.mesh, this.glow.mesh, this.rings.mesh);
    this.glow.mesh.renderOrder = 5;
    this.rings.mesh.renderOrder = 4;

    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'rn-float';
      el.style.display = 'none';
      overlay.appendChild(el);
      this.texts.push(el);
    }
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'rn-flash';
    overlay.appendChild(this.flashEl);
  }

  // ---- particle recipes (x, y, d are road coordinates; world z = -d) ----
  muzzle(x: number, y: number, d: number): void {
    this.glow.spawn(x, y, -d - 0.25, 0, 0.2, -2, 0.06, 0.32, 0xffd070);
  }

  sparks(x: number, y: number, d: number, color: number, n = 4, speed = 5): void {
    for (let i = 0; i < n; i++) {
      this.glow.spawn(x, y, -d, (Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.2) * speed, 0.18 + Math.random() * 0.15, 0.14 + Math.random() * 0.1, color, 9);
    }
  }

  /** Zombie death: green/grey chunks + a small dust cloud (non-gory). */
  zombiePuff(x: number, d: number, big = false): void {
    const n = big ? 12 : 5;
    for (let i = 0; i < n; i++) {
      const c = Math.random() < 0.5 ? 0x8fb070 : Math.random() < 0.5 ? 0x6f7f68 : 0xa9b0a0;
      this.puffs.spawn(x + (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.6, -d + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.45 + Math.random() * 0.3, (big ? 0.34 : 0.22) + Math.random() * 0.12, c, 12);
    }
    this.puffs.spawn(x, 0.4, -d, 0, 0.8, 0, 0.35, big ? 1.3 : 0.75, 0xc8ccbe, 0);
  }

  soldierPuff(x: number, d: number): void {
    for (let i = 0; i < 3; i++) {
      this.puffs.spawn(x, 0.5, -d, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.4, 0.18, i === 0 ? 0x3b6e3b : 0xd9d4c4, 10);
    }
    this.glow.spawn(x, 0.6, -d, 0, 0.5, 0, 0.12, 0.28, 0xff9a70);
  }

  explosion(x: number, d: number, radius: number): void {
    const n = Math.min(26, 10 + radius * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      const sp = 3 + Math.random() * radius * 2.5;
      this.glow.spawn(x, 0.4 + Math.random() * 0.8, -d, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 0.3 + Math.random() * 0.35, 0.35 + Math.random() * 0.45, Math.random() < 0.5 ? 0xffa030 : 0xffe070, 6);
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * 6.28;
      const sp = 1 + Math.random() * radius * 1.5;
      this.puffs.spawn(x, 0.6, -d, Math.cos(a) * sp, 1.5 + Math.random() * 2.5, Math.sin(a) * sp, 0.6 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, Math.random() < 0.5 ? 0x555555 : 0x777066, 1);
    }
    this.rings.spawn(x, -d, radius * 1.3, 0xffb040, 0.4);
  }

  burst(x: number, y: number, d: number, color: number, n = 18, speed = 6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.glow.spawn(x + (Math.random() - 0.5), y + Math.random(), -d, Math.cos(a) * sp, 1 + Math.random() * speed * 0.6, Math.sin(a) * sp * 0.6, 0.35 + Math.random() * 0.3, 0.18 + Math.random() * 0.14, color, 7);
    }
  }

  debris(x: number, y: number, d: number, color: number, n = 10): void {
    for (let i = 0; i < n; i++) {
      this.puffs.spawn(x, y, -d, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.6 + Math.random() * 0.4, 0.14 + Math.random() * 0.16, color, 14);
    }
  }

  ring(x: number, d: number, radius: number, color: number, dur = 0.45): void {
    this.rings.spawn(x, -d, radius, color, dur);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, Math.max(this.shake, amount));
  }

  screenFlash(kind: 'white' | 'red' | 'blue'): void {
    const el = this.flashEl;
    el.className = 'rn-flash ' + kind;
    this.flashAnim?.cancel();
    this.flashAnim = el.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
  }

  /** Floating text anchored where a world point is on screen right now. */
  float(x: number, y: number, d: number, text: string, kind: FloatKind): void {
    this.proj.set(x, y, -d).project(this.camera);
    if (this.proj.z > 1) return;
    const w = this.overlay.clientWidth;
    const h = this.overlay.clientHeight;
    const sx = (this.proj.x * 0.5 + 0.5) * w;
    const sy = (-this.proj.y * 0.5 + 0.5) * h;
    this.floatAt(sx, sy, text, kind);
  }

  floatAt(sx: number, sy: number, text: string, kind: FloatKind): void {
    const el = this.texts[this.textIdx];
    this.textIdx = (this.textIdx + 1) % this.texts.length;
    el.getAnimations().forEach((a) => a.cancel());
    el.textContent = text;
    el.className = 'rn-float ' + kind;
    el.style.display = 'block';
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    const big = kind === 'big-good' || kind === 'big-bad';
    const rise = big ? 70 : kind === 'dmg' ? 34 : 48;
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -60%) scale(1.25)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%, -70%) scale(1)', opacity: 1, offset: 0.55 },
        { transform: `translate(-50%, calc(-70% - ${rise}px)) scale(0.9)`, opacity: 0 },
      ],
      { duration: big ? 1100 : kind === 'dmg' ? 600 : 850, easing: 'ease-out' },
    );
    anim.onfinish = () => {
      el.style.display = 'none';
    };
  }

  update(dt: number): void {
    this.glow.update(dt);
    this.puffs.update(dt);
    this.rings.update(dt);
    this.shake *= Math.exp(-dt * 7);
    if (this.shake < 0.002) this.shake = 0;
  }

  clear(): void {
    this.glow.clear();
    this.puffs.clear();
    this.rings.clear();
    this.shake = 0;
  }

  dispose(): void {
    this.glow.mesh.dispose();
    this.puffs.mesh.dispose();
    this.rings.mesh.dispose();
    for (const el of this.texts) el.remove();
    this.flashEl.remove();
  }
}
