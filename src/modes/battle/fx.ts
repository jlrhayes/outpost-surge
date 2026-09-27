// OWNER: heroes agent. Pooled battle effects: projectiles, explosions, smoke, sparks, rings, heal/buff particles.
// Everything is instanced (a handful of draw calls) and allocation-free per frame.
import * as THREE from 'three';
import { buildColored, P } from '../../three/models';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  s0: number;
  s1: number;
  g: number;
  drag: number;
  c0: THREE.Color;
  c1: THREE.Color;
  spin: number;
}

/** Instanced particles that grow/shrink, drift and change colour over their life. */
class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private items: Particle[] = [];
  private next = 0;

  constructor(geom: THREE.BufferGeometry, mat: THREE.Material, readonly cap: number) {
    this.mesh = new THREE.InstancedMesh(geom, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) {
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 0, g: 0, drag: 0, c0: new THREE.Color(), c1: new THREE.Color(), spin: 0 });
      this.mesh.setMatrixAt(i, ZERO_M);
      this.mesh.setColorAt(i, tmpC.set(1, 1, 1));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: number, c1 = c0, g = 0, drag = 0): void {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.cap;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.age = 0;
    p.life = life;
    p.s0 = s0;
    p.s1 = s1;
    p.g = g;
    p.drag = drag;
    p.c0.setHex(c0);
    p.c1.setHex(c1);
    p.spin = Math.random() * 6;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      any = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        this.mesh.setMatrixAt(i, ZERO_M);
        continue;
      }
      const k = p.age / p.life;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vz *= damp;
      p.vy = p.vy * damp - p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05 && p.g > 0) {
        p.y = 0.05;
        p.vy *= -0.3;
      }
      // Ease-out growth then shrink.
      const s = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k));
      tmpS.setScalar(Math.max(0.0001, s));
      tmpQ.setFromAxisAngle(UP, p.spin + k * 2);
      tmpP.set(p.x, p.y, p.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
      tmpC.copy(p.c0).lerp(p.c1, k);
      this.mesh.setColorAt(i, tmpC);
    }
    if (any) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear(): void {
    for (let i = 0; i < this.cap; i++) {
      this.items[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO_M);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Projectile {
  alive: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  scale: number;
  trail: number; // seconds between smoke puffs (0 = none)
  trailT: number;
  onHit: (() => void) | null;
}

/** Instanced projectiles flying from A to B on an optional arc, oriented along their path. */
class ProjectilePool {
  readonly mesh: THREE.InstancedMesh;
  private items: Projectile[] = [];
  private next = 0;

  constructor(
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    readonly cap: number,
    private stretch = false,
  ) {
    this.mesh = new THREE.InstancedMesh(geom, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) {
      this.items.push({ alive: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 1, arc: 0, scale: 1, trail: 0, trailT: 0, onHit: null });
      this.mesh.setMatrixAt(i, ZERO_M);
    }
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, scale: number, onHit: (() => void) | null, trail = 0): void {
    const p = this.items[this.next];
    // If we're recycling a live projectile, resolve its hit first so no damage is lost.
    if (p.alive && p.onHit) p.onHit();
    this.next = (this.next + 1) % this.cap;
    p.alive = true;
    p.from.copy(from);
    p.to.copy(to);
    p.t = 0;
    p.dur = Math.max(0.03, dur);
    p.arc = arc;
    p.scale = scale;
    p.trail = trail;
    p.trailT = 0;
    p.onHit = onHit;
  }

  private posAt(p: Projectile, k: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(p.from, p.to, k);
    out.y += p.arc * 4 * k * (1 - k);
    return out;
  }

  update(dt: number, smoke?: (x: number, y: number, z: number) => void): void {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      any = true;
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      this.posAt(p, k, tmpP);
      const k2 = Math.min(1, k + 0.02);
      this.posAt(p, k2, tmpV);
      tmpV.sub(tmpP);
      if (tmpV.lengthSq() < 1e-8) tmpV.copy(p.to).sub(p.from);
      tmpV.normalize();
      tmpQ.setFromUnitVectors(FWD, tmpV);
      if (this.stretch) tmpS.set(p.scale, p.scale, p.scale * 3);
      else tmpS.setScalar(p.scale);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
      if (p.trail > 0 && smoke) {
        p.trailT -= dt;
        if (p.trailT <= 0) {
          p.trailT = p.trail;
          smoke(tmpP.x, tmpP.y, tmpP.z);
        }
      }
      if (k >= 1) {
        p.alive = false;
        this.mesh.setMatrixAt(i, ZERO_M);
        const cb = p.onHit;
        p.onHit = null;
        cb?.();
      }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Resolves every in-flight projectile immediately (used by Skip). */
  flush(): void {
    for (let i = 0; i < this.cap; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.alive = false;
      this.mesh.setMatrixAt(i, ZERO_M);
      const cb = p.onHit;
      p.onHit = null;
      cb?.();
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get active(): number {
    let n = 0;
    for (const p of this.items) if (p.alive) n++;
    return n;
  }
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  alive: boolean;
}

export class FxSystem {
  readonly group = new THREE.Group();
  private fire: ParticlePool;
  private smoke: ParticlePool;
  private sparks: ParticlePool;
  private heal: ParticlePool;
  private arrowsUp: ParticlePool;
  private arrowsDown: ParticlePool;
  private shells: ProjectilePool;
  private missiles: ProjectilePool;
  private tracers: ProjectilePool;
  private globs: ProjectilePool;
  private rings: Ring[] = [];
  /** Camera shake request (read & decayed by the mode). */
  shake = 0;

  constructor() {
    const ico = new THREE.IcosahedronGeometry(0.5, 0);
    const basic = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lambert = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.fire = new ParticlePool(ico, basic, 90);
    this.smoke = new ParticlePool(ico, lambert, 160);
    this.sparks = new ParticlePool(new THREE.BoxGeometry(0.12, 0.12, 0.12), basic, 120);
    const plus = new THREE.BufferGeometry().copy(
      buildColored([
        { geom: P.box, color: 0xffffff, scale: [0.12, 0.4, 0.12] },
        { geom: P.box, color: 0xffffff, scale: [0.4, 0.12, 0.12] },
      ]),
    );
    plus.deleteAttribute('color');
    this.heal = new ParticlePool(plus, basic, 60);
    const cone = new THREE.ConeGeometry(0.18, 0.4, 4);
    this.arrowsUp = new ParticlePool(cone, basic, 60);
    this.arrowsDown = new ParticlePool(cone.clone().rotateX(Math.PI), basic, 40);

    this.shells = new ProjectilePool(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }), 40);
    const missileGeom = buildColored([
      { geom: P.cyl, color: 0xe8e8e8, rot: [Math.PI / 2, 0, 0], scale: [0.16, 0.7, 0.16] },
      { geom: P.cone, color: 0xd03020, pos: [0, 0, 0.45], rot: [Math.PI / 2, 0, 0], scale: [0.16, 0.25, 0.16] },
      { geom: P.box, color: 0x505050, pos: [0, 0, -0.3], scale: [0.4, 0.04, 0.12] },
      { geom: P.box, color: 0xffb030, pos: [0, 0, -0.42], scale: [0.1, 0.1, 0.1] },
    ]);
    this.missiles = new ProjectilePool(missileGeom, new THREE.MeshBasicMaterial({ vertexColors: true }), 30);
    this.tracers = new ProjectilePool(new THREE.BoxGeometry(0.06, 0.06, 0.45), new THREE.MeshBasicMaterial({ color: 0xfff27a }), 60, true);
    this.globs = new ProjectilePool(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x9aff4a }), 20);

    for (const m of [this.smoke.mesh, this.fire.mesh, this.sparks.mesh, this.heal.mesh, this.arrowsUp.mesh, this.arrowsDown.mesh, this.shells.mesh, this.missiles.mesh, this.tracers.mesh, this.globs.mesh])
      this.group.add(m);

    const ringGeom = new THREE.RingGeometry(0.82, 1, 40);
    ringGeom.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeom, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, t: 0, dur: 1, r0: 0.2, r1: 3, alive: false });
    }
  }

  update(dt: number): void {
    const puff = (x: number, y: number, z: number) =>
      this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3, 0.7, 0.25, 0.7, 0xdedede, 0x6a6a6a);
    this.shells.update(dt);
    this.missiles.update(dt, puff);
    this.tracers.update(dt);
    this.globs.update(dt, (x, y, z) => this.sparks.spawn(x, y, z, 0, -0.5, 0, 0.3, 0.14, 0, 0x9aff4a, 0x3a8a1a, 2));
    this.fire.update(dt);
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.heal.update(dt);
    this.arrowsUp.update(dt);
    this.arrowsDown.update(dt);
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.alive = false;
        r.mesh.visible = false;
        continue;
      }
      const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      r.mesh.scale.setScalar(s);
      r.mat.opacity = 0.85 * (1 - k);
    }
  }

  /** True while projectiles are still flying. */
  busy(): boolean {
    return this.shells.active + this.missiles.active + this.tracers.active + this.globs.active > 0;
  }

  flush(): void {
    this.shells.flush();
    this.missiles.flush();
    this.tracers.flush();
    this.globs.flush();
  }

  clear(): void {
    this.flush();
    for (const p of [this.fire, this.smoke, this.sparks, this.heal, this.arrowsUp, this.arrowsDown]) p.clear();
    for (const r of this.rings) {
      r.alive = false;
      r.mesh.visible = false;
    }
    this.shake = 0;
  }

  // ---------------------------------------------------------------- emitters
  shell(from: THREE.Vector3, to: THREE.Vector3, dur: number, big: boolean, onHit: () => void): void {
    this.shells.fire(from, to, dur, big ? 1.2 : 0.5, big ? 1.8 : 1, onHit);
  }
  missile(from: THREE.Vector3, to: THREE.Vector3, dur: number, big: boolean, onHit: () => void): void {
    const d = from.distanceTo(to);
    this.missiles.fire(from, to, dur, 3 + d * 0.35, big ? 1.5 : 1.1, onHit, 0.035);
  }
  tracer(from: THREE.Vector3, to: THREE.Vector3, dur: number, onHit: (() => void) | null): void {
    this.tracers.fire(from, to, dur, 0, 1, onHit);
  }
  glob(from: THREE.Vector3, to: THREE.Vector3, dur: number, onHit: () => void): void {
    this.globs.fire(from, to, dur, 2.2, 1, onHit, 0.05);
  }

  muzzle(p: THREE.Vector3, big = false): void {
    const n = big ? 5 : 3;
    for (let i = 0; i < n; i++) this.fire.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5, 0.16, big ? 0.7 : 0.45, 0.05, 0xfff6c0, 0xff8a20);
    this.smoke.spawn(p.x, p.y, p.z, 0, 0.6, 0, 0.6, 0.3, 0.8, 0xcfcfcf, 0x8a8a8a);
  }

  explosion(p: THREE.Vector3, size = 1): void {
    const n = Math.round(4 + size * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.8 + Math.random() * 2.2) * size;
      this.fire.spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * sp, 0.6 + Math.random() * 2.5 * size, Math.sin(a) * sp, 0.25 + Math.random() * 0.25, 0.5 * size, 1.3 * size * (0.6 + Math.random() * 0.5), 0xfff4b0, 0xd83a10, 0, 3);
    }
    for (let i = 0; i < Math.round(3 + size * 3); i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn(p.x, p.y + 0.3, p.z, Math.cos(a) * 0.9 * size, 0.8 + Math.random() * 1.2, Math.sin(a) * 0.9 * size, 0.9 + Math.random() * 0.8, 0.5 * size, 1.5 * size, 0x5a5048, 0x9a9894, 0, 1.5);
    }
    this.burst(p, 0xffd060, Math.round(5 + size * 5), 5 * size);
    if (size >= 1.5) this.ring(p, 0.5, 3.5 * size * 0.8, 0xffc060, 0.5);
    this.shake = Math.max(this.shake, 0.12 * size);
  }

  /** Small flying sparks. */
  burst(p: THREE.Vector3, color: number, n: number, speed = 4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.sparks.spawn(p.x, p.y + 0.3, p.z, Math.cos(a) * sp, 1.5 + Math.random() * speed, Math.sin(a) * sp, 0.35 + Math.random() * 0.25, 1, 0.2, color, color, 12);
    }
  }

  /** Dark smoke puff (e.g. rising from a wreck). */
  smokePuff(p: THREE.Vector3, size = 1): void {
    this.smoke.spawn(p.x + (Math.random() - 0.5) * 0.6, p.y, p.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3, 1.6, 0.4 * size, 1.4 * size, 0x2a2622, 0x5a5854);
  }

  ring(p: THREE.Vector3, r0: number, r1: number, color: number, dur: number): void {
    const r = this.rings.find((x) => !x.alive) ?? this.rings[0];
    r.alive = true;
    r.t = 0;
    r.dur = dur;
    r.r0 = r0;
    r.r1 = r1;
    r.mat.color.setHex(color);
    r.mesh.position.set(p.x, 0.08, p.z);
    r.mesh.scale.setScalar(r0);
    r.mesh.visible = true;
  }

  healBurst(p: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      this.heal.spawn(p.x + (Math.random() - 0.5) * 1.6, p.y + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 1.6, 0, 1.6 + Math.random(), 0, 0.9, 1.1, 0.3, 0x7aff7a, 0x2ac04a);
    }
  }

  arrows(p: THREE.Vector3, color: number, up: boolean): void {
    const pool = up ? this.arrowsUp : this.arrowsDown;
    for (let i = 0; i < 5; i++) {
      const x = p.x + (Math.random() - 0.5) * 1.8;
      const z = p.z + (Math.random() - 0.5) * 1.8;
      pool.spawn(x, p.y + (up ? 0.2 : 2.4) + Math.random() * 0.4, z, 0, up ? 2 : -1.6, 0, 0.8, 1.2, 0.6, color, color);
    }
  }
}
