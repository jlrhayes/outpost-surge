// OWNER: runner agent. Zombie crowds: one InstancedMesh per variant, pooled records, hit flashes via
// instance colours, rise-from-the-ground spawn, shuffle/lope animations, steering toward the squad.
// Hordes are big (up to SIM.maxZombies alive) so everything here is allocation-free and O(n).
import * as THREE from 'three';
import { vcMaterial, zombieGeometry } from '../../three/models';
import { SIM, ZOMBIE_KINDS, type ZombieKind } from '../../data/runner';
import { spitterGeometry } from './models';

export interface Zombie {
  kind: ZombieKind;
  x: number;
  d: number;
  hp: number;
  maxHp: number;
  speed: number;
  contact: number;
  radius: number;
  steer: number;
  flash: number;
  phase: number;
  rise: number;
  /** Spitters: seconds until the next glob; `windup` animates the throw. */
  spitCd: number;
  windup: number;
  /** Index in the active list (for swap removal). */
  i: number;
}

const KINDS = ZOMBIE_KINDS;
const CAPS: Record<ZombieKind, number> = { walker: 300, runner: 100, elite: 40, brute: 24, spitter: 24 };
const RADIUS: Record<ZombieKind, number> = { walker: 0.4, runner: 0.4, elite: 0.55, brute: 0.85, spitter: 0.5 };
const SCALE: Record<ZombieKind, number> = { walker: 1, runner: 1, elite: 1.3, brute: 1, spitter: 1.12 };
const STEER: Record<ZombieKind, number> = { walker: 0.9, runner: 2.6, elite: 1.1, brute: 0.6, spitter: 0.5 };

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

export class Horde {
  readonly group = new THREE.Group();
  readonly list: Zombie[] = [];
  private pool: Zombie[] = [];
  private meshes: Record<ZombieKind, THREE.InstancedMesh>;
  private counts: Record<ZombieKind, number> = { walker: 0, runner: 0, elite: 0, brute: 0, spitter: 0 };
  /** Live zombies per kind. */
  readonly alive: Record<ZombieKind, number> = { walker: 0, runner: 0, elite: 0, brute: 0, spitter: 0 };

  constructor(castShadow: boolean) {
    const mk = (kind: ZombieKind) => {
      const geo = kind === 'spitter' ? spitterGeometry() : zombieGeometry(kind === 'elite' ? 'walker' : kind);
      const m = new THREE.InstancedMesh(geo, vcMaterial(), CAPS[kind]);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = castShadow;
      m.setColorAt(0, tmpC.setRGB(1, 1, 1));
      this.group.add(m);
      return m;
    };
    this.meshes = { walker: mk('walker'), runner: mk('runner'), elite: mk('elite'), brute: mk('brute'), spitter: mk('spitter') };
    for (let i = 0; i < SIM.maxZombies; i++) this.pool.push(blank());
  }

  get count(): number {
    return this.list.length;
  }

  spawn(kind: ZombieKind, x: number, d: number, hp: number, speed: number, contact: number): Zombie | null {
    if (this.alive[kind] >= CAPS[kind] || this.list.length >= SIM.maxZombies) return null;
    const z = this.pool.pop() ?? blank();
    z.kind = kind;
    z.x = x;
    z.d = d;
    z.hp = hp;
    z.maxHp = hp;
    z.speed = speed * (0.93 + Math.random() * 0.14);
    z.contact = contact;
    z.radius = RADIUS[kind];
    z.steer = STEER[kind];
    z.flash = 0;
    z.phase = Math.random() * 6.28;
    z.rise = -Math.random() * 0.25;
    z.spitCd = 0.35 + Math.random() * 0.9;
    z.windup = 0;
    z.i = this.list.length;
    this.list.push(z);
    this.alive[kind]++;
    return z;
  }

  remove(z: Zombie): void {
    const i = z.i;
    const last = this.list.pop()!;
    if (last !== z) {
      this.list[i] = last;
      last.i = i;
    }
    this.alive[z.kind]--;
    this.pool.push(z);
  }

  clear(): void {
    while (this.list.length) this.pool.push(this.list.pop()!);
    for (const k of KINDS) {
      this.meshes[k].count = 0;
      this.alive[k] = 0;
    }
  }

  /** Nearest zombie hit by a bullet travelling from d0 to d1 at lane x (or null). */
  bulletHit(x: number, d0: number, d1: number): Zombie | null {
    let best: Zombie | null = null;
    let bestD = Infinity;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const z = list[i];
      if (z.rise < 0.35) continue;
      const r = z.radius;
      if (z.d < d0 - r || z.d > d1 + r || z.d >= bestD) continue;
      const dx = z.x - x;
      if (dx > r + 0.1 || dx < -r - 0.1) continue;
      bestD = z.d;
      best = z;
    }
    return best;
  }

  /** Move zombies. Calls onContact for each zombie touching the squad (caller removes it). */
  update(dt: number, squadX: number, squadD: number, squadR: number, squadDepth: number, onContact: (z: Zombie) => void, onPassed: (z: Zombie) => void): void {
    const lim = SIM.roadHalf - 0.3;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const z = this.list[i];
      if (z.rise < 1) z.rise = Math.min(1, z.rise + dt * 2.2);
      if (z.flash > 0) z.flash = Math.max(0, z.flash - dt);
      if (z.windup > 0) z.windup = Math.max(0, z.windup - dt * 2.5);
      const ahead = z.d - squadD;
      // Spitters plant themselves while lobbing acid.
      const walk = z.kind === 'spitter' && ahead < SIM.spitRange && ahead > 7 ? 0.25 : 1;
      if (z.rise > 0.5) z.d -= z.speed * walk * dt;
      if (ahead < 30) {
        const dx = squadX - z.x;
        const m = z.steer * dt * (ahead < 10 ? 1.6 : 1);
        z.x += dx > m ? m : dx < -m ? -m : dx;
        if (z.x > lim) z.x = lim;
        else if (z.x < -lim) z.x = -lim;
      }
      if (ahead < squadDepth + z.radius * 0.6 && ahead > -squadDepth - 1 && Math.abs(z.x - squadX) < squadR + z.radius * 0.5) {
        onContact(z);
        continue;
      }
      if (ahead < -6) onPassed(z);
    }
  }

  /** Write instance matrices/colours. */
  render(t: number): void {
    for (const k of KINDS) this.counts[k] = 0;
    for (let i = 0; i < this.list.length; i++) {
      const z = this.list[i];
      const mesh = this.meshes[z.kind];
      const idx = this.counts[z.kind]++;
      const sc = SCALE[z.kind];
      const run = z.kind === 'runner';
      const brute = z.kind === 'brute';
      const f = run ? 16 : brute ? 5 : 7.5;
      const s = Math.sin(t * f + z.phase);
      const bob = Math.abs(s) * (run ? 0.12 : brute ? 0.1 : 0.06);
      const roll = s * (run ? 0.06 : brute ? 0.1 : 0.14);
      // The models are already posed (hunched walker, leaning sprinter): only a little extra sway.
      let pitch = run ? 0.08 : brute ? 0.04 : 0.05 + Math.sin(t * 2 + z.phase) * 0.05;
      if (z.windup > 0) pitch -= Math.sin(z.windup * Math.PI) * 0.55;
      const riseY = (1 - Math.max(0, z.rise)) * -1.4;
      tmpE.set(pitch, Math.sin(t * 0.7 + z.phase) * 0.15, roll);
      tmpQ.setFromEuler(tmpE);
      tmpV.set(z.x, bob + riseY, -z.d);
      tmpS.set(sc, sc, sc);
      tmpM.compose(tmpV, tmpQ, tmpS);
      mesh.setMatrixAt(idx, tmpM);
      const fl = z.flash > 0 ? 1 + z.flash * 14 : 1;
      if (z.kind === 'elite') tmpC.setRGB(1.25 * fl, 0.62 * fl, 0.62 * fl);
      else tmpC.setRGB(fl, fl, fl);
      mesh.setColorAt(idx, tmpC);
    }
    for (const k of KINDS) {
      const m = this.meshes[k];
      m.count = this.counts[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const k of KINDS) this.meshes[k].dispose();
  }
}

function blank(): Zombie {
  return { kind: 'walker', x: 0, d: 0, hp: 1, maxHp: 1, speed: 1, contact: 1, radius: 0.4, steer: 1, flash: 0, phase: 0, rise: 1, spitCd: 1, windup: 0, i: 0 };
}
