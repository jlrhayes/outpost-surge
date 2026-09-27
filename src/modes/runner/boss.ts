// OWNER: runner agent. End-of-level boss: lumbers toward the squad, smashes soldiers on contact,
// flashes when hit (cloned material with emissive), topples over on death.
import * as THREE from 'three';
import { animateModel, bossModel } from '../../three/models';
import type { BossDef } from '../../data/runner';

export class BossView {
  readonly group = new THREE.Group();
  private body: THREE.Group;
  private arm: THREE.Object3D | null;
  private armX = 0;
  private mats: THREE.MeshLambertMaterial[] = [];
  name: string;
  hp: number;
  max: number;
  x = 0;
  d: number;
  speed: number;
  smash: number;
  scale: number;
  big: boolean;
  state: 'enter' | 'walk' | 'attack' | 'dying' | 'dead' = 'enter';
  /** Seconds until the next smash while in contact. */
  smashCd = 0.6;
  /** >0 = flashing; counts down to -0.08 (cooldown) before the next flash can start. */
  private flash = -1;
  private stateT = 0;
  private windup = 0;
  /** Half-width for bullet hits. */
  readonly halfW: number;
  /** Distance in front of the boss at which it reaches the squad. */
  readonly reach: number;

  constructor(def: BossDef, d: number, castShadow: boolean) {
    this.name = def.name;
    this.hp = def.hp;
    this.max = def.hp;
    this.d = d;
    this.speed = def.speed;
    this.smash = def.smash;
    this.scale = def.scale;
    this.big = def.big;
    this.halfW = 2.1 * def.scale;
    this.reach = 1.3 * def.scale;
    this.body = bossModel();
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.Material;
      // Unlit glow parts (eyes, pustules) stay as they are.
      if (!(src as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
        m.castShadow = false;
        return;
      }
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x000000 });
      // Keep any plain colour the art agent used.
      const c = (src as THREE.MeshLambertMaterial).color;
      if (c && !(src as THREE.MeshLambertMaterial).vertexColors) {
        mat.vertexColors = false;
        mat.color.copy(c);
      }
      m.material = mat;
      m.castShadow = castShadow;
      this.mats.push(mat);
    });
    this.arm = this.body.getObjectByName('weaponArm') ?? null;
    this.body.scale.setScalar(def.scale);
    this.group.add(this.body);
    this.group.position.set(0, -4, -d);
  }

  hit(dmg: number): boolean {
    if (this.state === 'dying' || this.state === 'dead') return false;
    this.hp -= dmg;
    // Flicker (not a solid glow) under sustained fire.
    if (this.flash <= -0.08) this.flash = 0.05;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.stateT = 0;
      return true;
    }
    return false;
  }

  get alive(): boolean {
    return this.state !== 'dying' && this.state !== 'dead';
  }

  /** Returns true on the frame a smash lands. `squadD` is the front edge of the squad. */
  update(dt: number, t: number, squadX: number, squadD: number): boolean {
    this.stateT += dt;
    let smashed = false;
    if (this.flash > -0.08) this.flash -= dt;
    const fl = this.flash > 0 ? 0.45 : this.windup > 0 ? this.windup * 0.5 : 0;
    for (const m of this.mats) m.emissive.setRGB(fl, fl * (this.windup > 0 ? 0.25 : 1), fl * (this.windup > 0 ? 0.1 : 1));

    let y = 0;
    let roll = 0;
    let pitch = 0;
    if (this.state === 'enter') {
      // Rise out of the ground.
      const p = Math.min(1, this.stateT / 1.1);
      y = (1 - p) * -4 * this.scale;
      roll = Math.sin(t * 20) * 0.03 * (1 - p);
      if (p >= 1) {
        this.state = 'walk';
        this.stateT = 0;
      }
    } else if (this.state === 'walk') {
      this.d -= this.speed * dt;
      this.x += Math.max(-dt * 0.6, Math.min(dt * 0.6, squadX * 0.5 - this.x));
      const s = Math.sin(t * 3.2);
      y = Math.abs(s) * 0.18 * this.scale;
      roll = s * 0.1;
      pitch = 0.1;
      if (this.d - squadD <= this.reach) {
        this.state = 'attack';
        this.stateT = 0;
        this.smashCd = 0.5;
      }
    } else if (this.state === 'attack') {
      this.d = Math.max(this.d, squadD + this.reach * 0.9);
      this.smashCd -= dt;
      this.windup = this.smashCd < 0.35 ? 1 - this.smashCd / 0.35 : 0;
      pitch = -0.25 * this.windup;
      if (this.smashCd <= 0) {
        this.smashCd = 1.15;
        this.windup = 0;
        pitch = 0.45;
        smashed = true;
      }
      y = 0;
    } else if (this.state === 'dying') {
      const p = Math.min(1, this.stateT / 1.3);
      pitch = -p * 1.45;
      roll = Math.sin(this.stateT * 18) * 0.08 * (1 - p);
      y = -p * 0.6 * this.scale;
      if (p >= 1) {
        this.state = 'dead';
      }
    } else {
      pitch = -1.45;
      y = -0.6 * this.scale - Math.min(2, (this.stateT - 1.3) * 0.5);
    }
    this.group.position.set(this.x, y, -this.d);
    this.body.rotation.set(pitch, 0, roll);
    // Weapon arm: swings while walking, rears back on wind-up, slams down on a smash.
    let armT = 0;
    if (this.state === 'walk') armT = Math.sin(t * 3.2) * 0.35;
    else if (this.state === 'attack') armT = smashed ? 1.1 : this.windup > 0 ? -1.7 * this.windup : this.smashCd > 0.8 ? 0.9 : 0.2;
    else if (this.state === 'dying' || this.state === 'dead') armT = -1.2;
    this.armX += (armT - this.armX) * Math.min(1, dt * (smashed ? 40 : 9));
    if (this.arm) this.arm.rotation.x = this.armX;
    animateModel(this.body, dt, t);
    return smashed;
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    this.group.removeFromParent();
  }
}
