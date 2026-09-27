// OWNER: heroes agent. 3D scene for the 'battle' mode. Implements GameMode (see src/three/engine.ts).
// Replays a precomputed BattleResult event log: attackers (vehicles, 2 front + 3 back) vs zombie groups,
// a boss or enemy vehicles, with projectiles, explosions, damage numbers and skill callouts.
import * as THREE from 'three';
import type { GameMode } from '../../three/engine';
import { game } from '../../core/store';
import { goTo } from '../../core/nav';
import { sfx } from '../../core/audio';
import { fmt } from '../../core/format';
import type { Combatant, HeroType } from '../../core/types';
import { bossModel, soldierGeometry, vcMaterial, vehicleModel, zombieGeometry } from '../../three/models';
import { simulateBattle, type BattleEvent, type BattleRequest, type BattleResult } from '../../systems/battle';
import { squadCombatants, type BattleUnit } from '../../systems/heroes';
import { districtInfo } from '../../systems/campaign';
import { heroDef } from '../../data/heroes';
import { ARENA_LOOK, arenaGroup, type ArenaKind } from './arena';
import { FxSystem } from './fx';
import { BattleOverlay } from './overlay';
import { banner, battleControls, battleView, callouts, overlayHost, preferredSpeed, setPreferredSpeed, type BattlePhase, type UnitSnapshot } from './view';
import './battle.css';

const INTRO = 1.7;
const OUTRO = 1.8;
const LANE_X = [1.95, -1.95, 3.4, 0, -3.4];
const A_FRONT_Z = -3.0;
const A_BACK_Z = -6.8;

type VisKind = 'tank' | 'aircraft' | 'missile' | 'zombies' | 'boss';
type ZKind = 'walker' | 'runner' | 'brute' | 'spitter';

interface Member {
  ox: number;
  oz: number;
  phase: number;
  alive: boolean;
  dieT: number;
}

const PATTERNS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.65, 0],
    [0.65, 0.2],
  ],
  3: [
    [0, 0.5],
    [-0.7, -0.3],
    [0.7, -0.3],
  ],
  4: [
    [-0.6, 0.5],
    [0.6, 0.5],
    [-0.65, -0.55],
    [0.65, -0.55],
  ],
  5: [
    [0, 0.65],
    [-0.9, 0.2],
    [0.9, 0.2],
    [-0.5, -0.65],
    [0.5, -0.65],
  ],
  6: [
    [-0.5, 0.65],
    [0.5, 0.65],
    [-1.0, 0],
    [1.0, 0],
    [-0.5, -0.65],
    [0.5, -0.65],
  ],
};
function pattern(n: number): [number, number][] {
  if (PATTERNS[n]) return PATTERNS[n];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? 1.0 : 0.55;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

const SOLDIER_SLOTS: [number, number][] = [
  [1.15, 0.55],
  [-1.15, 0.55],
  [1.2, -0.1],
  [-1.2, -0.1],
  [1.15, -0.75],
  [-1.15, -0.75],
];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _proj = new THREE.Vector3();

type FlashMat = THREE.Material & { emissive?: THREE.Color; color?: THREE.Color };

class UnitVis {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  kind: VisKind;
  zkind: ZKind = 'walker';
  mats: FlashMat[] = [];
  baseColors: THREE.Color[] = [];
  inst: THREE.InstancedMesh | null = null;
  members: Member[] = [];
  tint = new THREE.Color(1, 1, 1);
  memberScale = 1;
  soldiers: THREE.InstancedMesh | null = null;
  soldierMembers: Member[] = [];
  readonly home = new THREE.Vector3();
  readonly start = new THREE.Vector3();
  readonly base = new THREE.Vector3();
  face: number;
  hp: number;
  maxHp: number;
  energy = 0;
  hasActive: boolean;
  alive = true;
  deadT = 0;
  flashT = 0;
  recoil = 0;
  lungeT = -1;
  lungeDur = 0.36;
  readonly lungeVec = new THREE.Vector3();
  lungeArc = 0;
  swoopT = -1;
  shield = 0;
  shieldUntil = 0;
  shieldMesh: THREE.Mesh | null = null;
  stunUntil = 0;
  stunGroup: THREE.Group | null = null;
  height = 2.6;
  hitY = 0.8;
  radius = 1.3;
  bob = Math.random() * 6;
  smokeT = 0;
  crashed = false;
  heroId?: string;
  label: string;

  constructor(
    readonly c: Combatant,
    readonly side: 'A' | 'B',
  ) {
    this.face = side === 'A' ? 1 : -1;
    this.hp = c.hp;
    this.maxHp = c.maxHp;
    this.heroId = c.heroId;
    const def = c.heroId ? heroDef(c.heroId) : undefined;
    this.hasActive = !!def && c.type !== 'zombie';
    this.label = def ? def.callsign : c.name;
    if (c.type === 'zombie') this.kind = c.model.toLowerCase().includes('boss') ? 'boss' : 'zombies';
    else {
      const m = c.model as HeroType;
      this.kind = m === 'tank' || m === 'aircraft' || m === 'missile' ? m : (c.type as HeroType);
    }
    this.root.add(this.body);
  }

  get uid(): string {
    return this.c.uid;
  }
  get slot(): number {
    return this.c.slot;
  }
  get isVehicle(): boolean {
    return this.kind === 'tank' || this.kind === 'aircraft' || this.kind === 'missile';
  }
}

export class BattleMode implements GameMode {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 220);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.3);
  private sun = new THREE.DirectionalLight(0xffffff, 1.8);
  private arena: THREE.Group | null = null;
  private fx = new FxSystem();
  private overlay = new BattleOverlay();
  private units = new Map<string, UnitVis>();
  private list: UnitVis[] = [];
  private req: BattleRequest | null = null;
  private result: BattleResult | null = null;
  private events: BattleEvent[] = [];
  private evIdx = 0;
  private playT = 0;
  private phase: BattlePhase = 'intro';
  private phaseT = 0;
  private speed = 1;
  private scheduled: { at: number; fn: () => void }[] = [];
  private lastImpact = new Map<string, number>();
  private snapT = 0;
  private finished = false;
  private camDist = 26;
  private camLook = new THREE.Vector3(0, 0, 0.6);
  private camDir = new THREE.Vector3(0, 0.8, -0.6).normalize();
  private width = 1;
  private height = 1;
  private sfxHitT = 0;
  private sfxBoomT = 0;
  private calloutId = 0;
  private sunAnchor = new THREE.Object3D();
  private shieldGeom = new THREE.SphereGeometry(1, 18, 12);
  private starGeom = new THREE.OctahedronGeometry(0.16, 0);
  private starMat = new THREE.MeshBasicMaterial({ color: 0xffe040 });

  constructor() {
    this.scene.background = new THREE.Color(0x9ccbee);
    this.scene.fog = new THREE.Fog(0x9ccbee, 38, 85);
    this.scene.add(this.hemi);
    this.sun.position.set(9, 22, -8);
    this.sun.target = this.sunAnchor;
    this.sunAnchor.position.set(0, 0, 1);
    this.scene.add(this.sunAnchor);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 18;
    sc.bottom = -18;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun);
    this.scene.add(this.fx.group);
  }

  // --------------------------------------------------------------------------------- lifecycle
  enter(params?: BattleRequest): void {
    const req = params && Array.isArray(params.attackers) ? params : this.demoRequest();
    this.req = req;
    this.finished = false;
    this.result = req.result ?? simulateBattle(req.attackers, req.defenders, req.seed ?? 1);
    const kind: ArenaKind = req.arena ?? 'road';
    if (this.arena) this.scene.remove(this.arena);
    this.arena = arenaGroup(kind);
    this.scene.add(this.arena);
    const look = ARENA_LOOK[kind];
    (this.scene.background as THREE.Color).setHex(look.sky);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(look.sky);
    fog.near = look.fogNear;
    fog.far = look.fogFar;
    this.hemi.color.setHex(look.hemiSky);
    this.hemi.groundColor.setHex(look.hemiGround);
    this.sun.color.setHex(look.sun);
    this.sun.intensity = look.sunIntensity;
    this.sun.castShadow = game.settings.quality === 'high';

    this.clearUnits();
    this.buildUnits(req.attackers, 'A');
    this.buildUnits(req.defenders, 'B');
    this.overlay.setUnits(
      this.list.map((u) => ({ uid: u.uid, side: u.side, label: u.kind === 'zombies' ? '' : u.label, hasEnergy: u.hasActive, big: u.kind === 'boss' })),
    );

    this.events = this.result.events;
    this.evIdx = 0;
    this.playT = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.speed = preferredSpeed;
    this.scheduled = [];
    this.lastImpact.clear();
    this.fx.clear();
    callouts.value = [];
    banner.value = { id: Date.now(), text: 'BATTLE START', kind: 'start' };
    battleControls.setSpeed = (s) => {
      this.speed = s;
      setPreferredSpeed(s);
      this.pushView();
    };
    battleControls.skip = () => this.skip();
    battleControls.finish = () => this.finish();
    this.pushView();
    sfx.gateGood();
  }

  exit(): void {
    this.clearUnits();
    this.fx.clear();
    this.overlay.detach();
    callouts.value = [];
    banner.value = null;
    battleControls.setSpeed = () => {};
    battleControls.skip = () => {};
    battleControls.finish = () => {};
    this.req = null;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hTan = Math.tan(vfov / 2) * this.camera.aspect;
    // Fit the formation width (±4.8 at the near back row) on narrow portrait screens.
    this.camDist = Math.max(23, 4.8 / hTan + 6);
    this.camera.updateProjectionMatrix();
  }

  private demoRequest(): BattleRequest {
    const info = districtInfo(game.heroes.campaign.stage);
    return {
      title: `District ${info.stage}`,
      subtitle: `${info.name} (preview)`,
      attackers: squadCombatants(game, 1),
      defenders: info.enemies,
      seed: 7,
      arena: info.arena,
      onFinish: () => {},
      returnTo: 'base',
    };
  }

  // --------------------------------------------------------------------------------- units
  private buildUnits(list: Combatant[], side: 'A' | 'B'): void {
    const frontCount = list.filter((c) => c.slot <= 1).length;
    for (const c of list) {
      const u = new UnitVis(c, side);
      if (u.isVehicle) this.makeVehicle(u);
      else if (u.kind === 'boss') this.makeBoss(u);
      else this.makeZombies(u);
      // Home position.
      let x = LANE_X[c.slot] ?? 0;
      let z: number;
      if (side === 'A') z = c.slot <= 1 ? A_FRONT_Z : A_BACK_Z;
      else if (u.kind === 'boss') {
        z = 1.3;
        if (frontCount === 1 && c.slot <= 1) x = 0;
      } else if (u.kind === 'zombies') z = c.slot <= 1 ? 0.3 : u.zkind === 'spitter' ? 4.9 : 2.7;
      else z = c.slot <= 1 ? 3.4 : 7.2;
      u.home.set(x, 0, z);
      u.start.set(x, 0, z - 9 * u.face);
      u.base.copy(u.start);
      u.root.position.copy(u.start);
      if ((u.isVehicle || u.kind === 'boss') && side === 'B') u.root.rotation.y = Math.PI;
      this.scene.add(u.root);
      this.units.set(u.uid, u);
      this.list.push(u);
    }
  }

  private collectMats(u: UnitVis, obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const clone = (m: THREE.Material) => {
        const c = m.clone() as FlashMat;
        u.mats.push(c);
        u.baseColors.push(c.color ? c.color.clone() : new THREE.Color(1, 1, 1));
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
  }

  private makeVehicle(u: UnitVis): void {
    const type = u.kind as HeroType;
    const g = vehicleModel(type, u.c.rarity ?? 'SR');
    this.collectMats(u, g);
    u.body.add(g);
    u.height = type === 'aircraft' ? 3.3 : 2.6;
    u.hitY = type === 'aircraft' ? 1.5 : 0.8;
    const troops = (u.c as BattleUnit).troops ?? 0;
    const n = troops > 0 ? Math.min(6, Math.ceil(troops / 12)) : 0;
    if (n > 0) {
      const inst = new THREE.InstancedMesh(soldierGeometry(), vcMaterial(), n);
      inst.castShadow = true;
      inst.frustumCulled = false;
      u.soldiers = inst;
      for (let i = 0; i < n; i++) u.soldierMembers.push({ ox: SOLDIER_SLOTS[i][0], oz: SOLDIER_SLOTS[i][1], phase: Math.random() * 6, alive: true, dieT: 0 });
      u.root.add(inst);
    }
  }

  private makeBoss(u: UnitVis): void {
    const g = bossModel();
    this.collectMats(u, g);
    u.body.add(g);
    u.height = 4.7;
    u.hitY = 1.9;
    u.radius = 2.1;
  }

  private makeZombies(u: UnitVis): void {
    const m = u.c.model.toLowerCase();
    u.zkind = m.includes('brute') ? 'brute' : m.includes('runner') ? 'runner' : m.includes('spit') ? 'spitter' : 'walker';
    const defaults: Record<ZKind, number> = { walker: 5, runner: 4, brute: 2, spitter: 3 };
    const n = Math.max(1, Math.min(8, (u.c as BattleUnit).count ?? defaults[u.zkind]));
    const geom = zombieGeometry(u.zkind === 'spitter' ? 'runner' : u.zkind);
    const inst = new THREE.InstancedMesh(geom, vcMaterial(), n);
    inst.castShadow = true;
    inst.frustumCulled = false;
    const spread = u.zkind === 'brute' ? 1.05 : u.zkind === 'runner' ? 0.8 : 0.85;
    u.memberScale = u.zkind === 'brute' ? 1.0 : 1.18;
    if (u.zkind === 'spitter') u.tint.setRGB(0.75, 1.25, 0.65);
    else if (u.zkind === 'runner') u.tint.setRGB(1.1, 0.95, 0.9);
    for (const [ox, oz] of pattern(n)) u.members.push({ ox: ox * spread, oz: oz * spread, phase: Math.random() * 6, alive: true, dieT: 0 });
    for (let i = 0; i < n; i++) inst.setColorAt(i, u.tint);
    u.inst = inst;
    u.root.add(inst);
    u.height = u.zkind === 'brute' ? 3.2 : 2.3;
    u.hitY = u.zkind === 'brute' ? 1.4 : 0.8;
    u.radius = 1.4;
  }

  private clearUnits(): void {
    for (const u of this.list) {
      this.scene.remove(u.root);
      for (const m of u.mats) m.dispose();
      u.inst?.dispose();
      u.soldiers?.dispose();
      (u.shieldMesh?.material as THREE.Material | undefined)?.dispose();
    }
    this.units.clear();
    this.list = [];
  }

  // --------------------------------------------------------------------------------- helpers
  private U(uid: string): UnitVis | undefined {
    return this.units.get(uid);
  }

  private schedule(delay: number, fn: () => void): void {
    this.scheduled.push({ at: this.playT + delay, fn });
  }

  private muzzle(u: UnitVis, out: THREE.Vector3): THREE.Vector3 {
    const p = u.root.position;
    switch (u.kind) {
      case 'tank':
        return out.set(p.x, 0.95, p.z + 1.6 * u.face);
      case 'aircraft':
        return out.set(p.x, 1.45 + u.body.position.y, p.z + 1.4 * u.face + u.body.position.z * u.face);
      case 'missile':
        return out.set(p.x, 1.7, p.z - 0.2 * u.face);
      case 'boss':
        return out.set(p.x, 2.4, p.z + 1.0 * u.face);
      default:
        return out.set(p.x, 1.0, p.z + 0.5 * u.face);
    }
  }

  private hitPoint(u: UnitVis, out: THREE.Vector3): THREE.Vector3 {
    const p = u.root.position;
    out.set(p.x + (Math.random() - 0.5) * 0.6, u.hitY + (u.kind === 'aircraft' ? u.body.position.y : 0), p.z + (Math.random() - 0.5) * 0.5);
    return out;
  }

  /** Projects a world point to screen pixels; returns false if behind the camera. */
  private toScreen(p: THREE.Vector3, out: { x: number; y: number }): boolean {
    _proj.copy(p).project(this.camera);
    out.x = (_proj.x * 0.5 + 0.5) * this.width;
    out.y = (-_proj.y * 0.5 + 0.5) * this.height;
    return _proj.z < 1;
  }

  private popAt(u: UnitVis, text: string, cls: string, yOff = 0): void {
    const sp = { x: 0, y: 0 };
    _v1.set(u.root.position.x, u.height * 0.72 + yOff, u.root.position.z);
    if (this.toScreen(_v1, sp)) this.overlay.pop(sp.x, sp.y, text, cls);
  }

  private sfxHit(): void {
    const t = performance.now();
    if (t - this.sfxHitT < 70) return;
    this.sfxHitT = t;
    sfx.hit();
  }
  private sfxBoom(): void {
    const t = performance.now();
    if (t - this.sfxBoomT < 180) return;
    this.sfxBoomT = t;
    sfx.explode();
  }

  // --------------------------------------------------------------------------------- playback
  private pushView(): void {
    battleView.value = {
      req: this.req,
      result: this.result,
      phase: this.phase,
      speed: this.speed,
      time: this.playT,
      units: this.list.map(
        (u): UnitSnapshot => ({
          uid: u.uid,
          side: u.side,
          slot: u.slot,
          name: u.label,
          heroId: u.heroId,
          model: u.c.model,
          hp: u.hp,
          maxHp: u.maxHp,
          energy: u.energy,
          hasActive: u.hasActive,
          alive: u.alive,
        }),
      ),
    };
  }

  private setPhase(p: BattlePhase): void {
    this.phase = p;
    this.phaseT = 0;
    this.pushView();
  }

  private processEvents(): void {
    while (this.evIdx < this.events.length && this.events[this.evIdx].t <= this.playT) this.dispatch(this.events[this.evIdx++], true);
  }

  private runScheduled(): void {
    if (!this.scheduled.length) return;
    const now = this.playT;
    for (let i = 0; i < this.scheduled.length; ) {
      if (this.scheduled[i].at <= now) {
        const f = this.scheduled[i].fn;
        this.scheduled.splice(i, 1);
        f();
      } else i++;
    }
  }

  private dispatch(ev: BattleEvent, visual: boolean): void {
    switch (ev.kind) {
      case 'attack': {
        const s = this.U(ev.from);
        const t = this.U(ev.to);
        if (!s || !t) return;
        const apply = () => this.applyHit(t, ev.dmg, !!ev.crit, ev.hp, ev.sh ?? 0, s, false, visual);
        if (visual) this.fireAt(s, t, apply, false, 0);
        else apply();
        break;
      }
      case 'skill': {
        const s = this.U(ev.from);
        if (!s) return;
        if (visual) this.castSkill(s, ev);
        ev.targets.forEach((uid, i) => {
          const t = this.U(uid);
          if (!t) return;
          const apply = () => this.applyHit(t, ev.dmg[i], !!ev.crit?.[i], ev.hp?.[i], ev.sh?.[i] ?? 0, s, true, visual);
          if (visual) this.fireAt(s, t, apply, !!ev.active || s.kind === 'boss', i, ev.skillId);
          else apply();
        });
        break;
      }
      case 'heal': {
        const t = this.U(ev.to);
        if (!t) return;
        const apply = () => {
          const before = t.hp;
          t.hp = ev.hp ?? Math.min(t.maxHp, t.hp + ev.amount);
          if (visual && t.alive) {
            _v1.set(t.root.position.x, 0.3, t.root.position.z);
            this.fx.healBurst(_v1);
            const gained = Math.max(0, Math.round(t.hp - before));
            if (gained > 0) this.popAt(t, '+' + fmt(gained), 'heal', 0.4);
          }
        };
        if (visual) this.schedule(0.22, apply);
        else apply();
        break;
      }
      case 'shield': {
        const t = this.U(ev.to);
        if (!t) return;
        const apply = () => {
          t.shield = ev.total;
          t.shieldUntil = ev.t + 8;
          if (visual) {
            this.fx.ring(t.root.position, 0.4, 2.4, 0x6ad0ff, 0.5);
            this.popAt(t, 'SHIELD', 'shield', 0.6);
          }
        };
        if (visual) this.schedule(0.18, apply);
        else apply();
        break;
      }
      case 'buff': {
        if (!visual) return;
        const src = this.U(ev.from);
        const enrage = ev.to.length === 1 && ev.to[0] === ev.from && ev.dur >= 99;
        if (enrage && src) {
          this.pushCallout(src, 'ENRAGED!');
          this.fx.ring(src.root.position, 0.5, 4.5, 0xff3a2a, 0.7);
          this.popAt(src, 'ENRAGED', 'debuff', 0.8);
          return;
        }
        const label: Record<string, string> = { atk: 'ATK', def: 'DEF', haste: 'SPD', crit: 'CRIT', guard: 'DMG RED', vuln: 'EXPOSED' };
        const color: Record<string, number> = { atk: 0xff8a3a, def: 0x4ab0ff, haste: 0x7aff6a, crit: 0xffe040, guard: 0x6ad0ff, vuln: 0xd070ff };
        this.schedule(0.2, () => {
          ev.to.forEach((uid, i) => {
            const t = this.U(uid);
            if (!t || !t.alive) return;
            _v1.set(t.root.position.x, 0.2, t.root.position.z);
            this.fx.arrows(_v1, ev.debuff ? 0xb050ff : color[ev.stat] ?? 0xffffff, !ev.debuff);
            if (i < 3) this.popAt(t, `${label[ev.stat] ?? ev.stat}${ev.stat === 'vuln' ? '' : ev.debuff ? '↓' : '↑'}`, ev.debuff ? 'debuff' : 'buff', 0.9);
          });
        });
        break;
      }
      case 'stun': {
        for (const uid of ev.to) {
          const t = this.U(uid);
          if (!t) continue;
          t.stunUntil = Math.max(t.stunUntil, ev.t + (t.kind === 'boss' ? ev.dur / 2 : ev.dur));
          if (visual) this.schedule(0.2, () => t.alive && this.popAt(t, 'STUN', 'debuff', 1.1));
        }
        break;
      }
      case 'energy': {
        const u = this.U(ev.uid);
        if (u) u.energy = ev.value;
        break;
      }
      case 'reflect': {
        const t = this.U(ev.to);
        if (!t) return;
        const apply = () => {
          t.hp = ev.hp;
          if (visual && t.alive) this.popAt(t, fmt(ev.dmg), 'reflect', -0.3);
        };
        if (visual) this.schedule(0.3, apply);
        else apply();
        break;
      }
      case 'death': {
        const u = this.U(ev.uid);
        if (!u) return;
        if (!visual) {
          this.kill(u, false);
          return;
        }
        const at = Math.max(ev.t, (this.lastImpact.get(ev.uid) ?? 0) + 0.04);
        this.schedule(Math.max(0, at - this.playT), () => this.kill(u, true));
        break;
      }
    }
  }

  private travelFor(s: UnitVis, t: UnitVis, big: boolean): number {
    const d = s.root.position.distanceTo(t.root.position);
    switch (s.kind) {
      case 'tank':
        return 0.16 + d * 0.012;
      case 'aircraft':
        return big ? 0.5 : 0.22;
      case 'missile':
        return 0.55 + d * 0.015;
      case 'boss':
        return 0.3;
      default:
        return s.zkind === 'spitter' ? 0.45 : 0.18;
    }
  }

  /** Visual attack from s to t; `apply` runs on impact (HP change + number). */
  private fireAt(s: UnitVis, t: UnitVis, apply: () => void, big: boolean, i: number, skillId?: string): void {
    const delay = i * 0.08;
    const travel = this.travelFor(s, t, big);
    this.lastImpact.set(t.uid, Math.max(this.lastImpact.get(t.uid) ?? 0, this.playT + delay + travel + 0.05));
    const go = () => {
      const from = this.muzzle(s, new THREE.Vector3());
      const to = this.hitPoint(t, new THREE.Vector3());
      switch (s.kind) {
        case 'tank': {
          s.recoil = 1;
          this.fx.muzzle(from, big);
          sfx.shoot();
          this.fx.shell(from, to, travel, big, () => {
            this.fx.explosion(to, big ? 1.3 : 0.55);
            if (big) this.sfxBoom();
            apply();
          });
          break;
        }
        case 'aircraft': {
          s.recoil = 1;
          const n = big ? 5 : 3;
          for (let k = 0; k < n; k++) {
            this.schedule(k * 0.045, () => {
              const f = this.muzzle(s, new THREE.Vector3());
              f.x += (k % 2 ? 0.5 : -0.5);
              const tt = this.hitPoint(t, new THREE.Vector3());
              sfx.shoot();
              this.fx.tracer(f, tt, 0.11, () => this.fx.burst(tt, 0xffe890, 3, 2.5));
            });
          }
          if (big) {
            this.fx.missile(from, to, travel, false, () => {
              this.fx.explosion(to, 1.1);
              this.sfxBoom();
              apply();
            });
          } else this.schedule((n - 1) * 0.045 + 0.11, apply);
          break;
        }
        case 'missile': {
          s.recoil = 1;
          this.fx.muzzle(from, false);
          this.fx.missile(from, to, travel, big, () => {
            this.fx.explosion(to, big ? 1.6 : 0.95);
            this.sfxBoom();
            apply();
          });
          break;
        }
        case 'boss': {
          this.lunge(s, t, 0.5, 0);
          this.schedule(travel, () => {
            this.fx.explosion(to, 0.6);
            apply();
          });
          break;
        }
        default: {
          if (s.zkind === 'spitter') {
            this.fx.glob(from, to, travel, () => {
              this.fx.burst(to, 0x9aff4a, 7, 3);
              apply();
            });
          } else {
            const pounce = s.zkind === 'runner' && t.slot > 1 && skillId === 'z_pounce';
            this.lunge(s, t, pounce ? 0.45 : 0.36, pounce ? 1.6 : 0);
            this.schedule(travel + (pounce ? 0.05 : 0), () => {
              this.fx.burst(to, 0xd03a2a, s.zkind === 'brute' ? 9 : 5, 3);
              if (s.zkind === 'brute') this.fx.shake = Math.max(this.fx.shake, 0.08);
              apply();
            });
          }
        }
      }
    };
    if (delay > 0) this.schedule(delay, go);
    else go();
  }

  private lunge(s: UnitVis, t: UnitVis, dur: number, arc: number): void {
    _v1.subVectors(t.root.position, s.base);
    _v1.y = 0;
    const d = _v1.length();
    const reach = arc > 0 ? Math.max(0, d - 1.3) : Math.min(Math.max(0, d - (t.radius + 0.6)), 2.6);
    if (d > 0.001) _v1.multiplyScalar(reach / d);
    s.lungeVec.copy(_v1);
    s.lungeT = 0;
    s.lungeDur = dur;
    s.lungeArc = arc;
  }

  private castSkill(s: UnitVis, ev: Extract<BattleEvent, { kind: 'skill' }>): void {
    if (ev.active) {
      this.pushCallout(s, ev.name ?? 'Skill');
      this.fx.ring(s.root.position, 0.3, 3, 0xffd040, 0.55);
      if (s.kind === 'aircraft') s.swoopT = 0;
      sfx.upgrade();
      this.popAt(s, ev.name ?? '', 'skillname', 1.2);
      return;
    }
    if (s.kind === 'boss') {
      // Tremor Slam: jump, then a shockwave.
      this.pushCallout(s, ev.name ?? 'Slam');
      s.lungeVec.set(0, 0, 0);
      s.lungeT = 0;
      s.lungeDur = 0.5;
      s.lungeArc = 1.4;
      this.schedule(0.28, () => {
        this.fx.ring(s.root.position, 0.8, 9, 0xc8a060, 0.7);
        _v1.set(s.root.position.x, 0, s.root.position.z);
        this.fx.explosion(_v1, 1.2);
        this.fx.shake = Math.max(this.fx.shake, 0.55);
        this.sfxBoom();
      });
      return;
    }
    if (s.isVehicle) {
      this.fx.ring(s.root.position, 0.2, 2, 0x7ac8ff, 0.35);
      if (ev.name) this.popAt(s, ev.name, 'autoskill', 1.0);
    }
  }

  private pushCallout(s: UnitVis, skill: string): void {
    const c = { id: ++this.calloutId, side: s.side, heroId: s.heroId, model: s.c.model, who: s.label || s.c.name, skill };
    callouts.value = [...callouts.value.slice(-2), c];
    setTimeout(() => {
      callouts.value = callouts.value.filter((x) => x.id !== c.id);
    }, 1700);
  }

  private applyHit(t: UnitVis, dmg: number, crit: boolean, hpAfter: number | undefined, absorbed: number, s: UnitVis, isSkill: boolean, visual: boolean): void {
    t.hp = hpAfter ?? Math.max(0, t.hp - dmg);
    t.shield = Math.max(0, t.shield - absorbed);
    if (!visual || !t.alive) return;
    t.flashT = 0.13;
    const cls = t.side === 'A' ? (crit ? 'dmg-a crit-a' : 'dmg-a') : crit ? 'crit' : isSkill ? 'skill' : 'dmg-b';
    if (absorbed > 0 && absorbed >= dmg) this.popAt(t, 'BLOCK', 'shield');
    else this.popAt(t, (crit ? 'CRIT ' : '') + fmt(dmg - absorbed), cls);
    this.sfxHit();
  }

  private kill(u: UnitVis, visual: boolean): void {
    if (!u.alive) return;
    u.alive = false;
    u.deadT = 0;
    u.hp = 0;
    u.shield = 0;
    u.energy = 0;
    if (!visual) return;
    _v1.set(u.root.position.x, u.isVehicle ? 0.6 : 0.4, u.root.position.z);
    if (u.isVehicle) {
      if (u.kind !== 'aircraft') {
        this.fx.explosion(_v1, 1.8);
        this.sfxBoom();
      }
    } else if (u.kind === 'boss') {
      this.fx.explosion(_v1, 2.4);
      this.fx.shake = 0.7;
      this.sfxBoom();
    } else {
      this.fx.burst(_v1, 0x6a8a3a, 14, 4);
      this.fx.smokePuff(_v1, 0.8);
    }
  }

  private skip(): void {
    if (this.phase === 'outro' || this.phase === 'result' || !this.result) return;
    let guard = 0;
    do {
      this.fx.flush();
      const list = this.scheduled;
      this.scheduled = [];
      for (const s of list) s.fn();
    } while ((this.scheduled.length || this.fx.busy()) && ++guard < 20);
    this.scheduled = [];
    while (this.evIdx < this.events.length) this.dispatch(this.events[this.evIdx++], false);
    for (const u of this.list) {
      u.base.copy(u.home);
      const hp = this.result.finalHp[u.uid];
      if (hp !== undefined) u.hp = hp;
      if (u.hp <= 0 && u.alive) this.kill(u, false);
    }
    this.playT = this.result.duration;
    this.startOutro();
    this.phaseT = OUTRO - 0.4;
  }

  private startOutro(): void {
    const won = this.result?.winner === 'A';
    this.setPhase('outro');
    banner.value = { id: Date.now(), text: won ? 'VICTORY!' : this.result?.timeout ? 'TIME UP' : 'DEFEAT', kind: won ? 'win' : 'lose' };
    if (won) sfx.win();
    else sfx.lose();
  }

  private finish(): void {
    const req = this.req;
    const res = this.result;
    if (!req || !res || this.finished) return;
    this.finished = true;
    try {
      req.onFinish(res);
    } catch (e) {
      console.error('battle onFinish failed', e);
    }
    goTo(req.returnTo ?? 'base');
  }

  // --------------------------------------------------------------------------------- per frame
  update(dt: number, elapsed: number): void {
    this.overlay.attach(overlayHost);
    if (!this.result) return;
    const sdt = this.phase === 'result' ? dt : dt * this.speed;
    switch (this.phase) {
      case 'intro':
        this.phaseT += sdt;
        if (this.phaseT >= INTRO) {
          this.setPhase('fight');
          banner.value = { id: Date.now(), text: 'FIGHT!', kind: 'start' };
          sfx.gateGood();
        }
        break;
      case 'fight':
        this.playT += sdt;
        this.processEvents();
        this.runScheduled();
        if (this.evIdx >= this.events.length && this.playT >= this.result.duration + 0.3 && !this.scheduled.length && !this.fx.busy()) this.startOutro();
        break;
      case 'outro':
        this.phaseT += sdt;
        this.runScheduled();
        if (this.phaseT >= OUTRO) this.setPhase('result');
        break;
    }
    const aFrontAlive = this.list.some((u) => u.side === 'A' && u.alive && u.slot <= 1);
    const bFrontAlive = this.list.some((u) => u.side === 'B' && u.alive && u.slot <= 1);
    for (const u of this.list) this.animateUnit(u, sdt, elapsed, u.side === 'A' ? aFrontAlive : bFrontAlive);
    this.fx.update(sdt);
    this.updateCamera(dt, elapsed);
    this.updateBars(dt);
    this.snapT += dt;
    if (this.snapT >= 0.1) {
      this.snapT = 0;
      this.pushView();
    }
  }

  private animateUnit(u: UnitVis, dt: number, t: number, ownFrontAlive: boolean): void {
    // ---- base position
    if (this.phase === 'intro') {
      const k = Math.min(1, this.phaseT / INTRO);
      const e = 1 - Math.pow(1 - k, 3);
      u.base.lerpVectors(u.start, u.home, e);
    } else if (u.alive) {
      _v2.copy(u.home);
      // Melee zombies in the back row advance once their front row has fallen.
      if (u.side === 'B' && u.kind === 'zombies' && u.slot > 1 && u.zkind !== 'spitter' && !ownFrontAlive) _v2.z = 0.6;
      const d = _v2.distanceTo(u.base);
      if (d > 0.01) u.base.lerp(_v2, Math.min(1, (dt * 1.6) / d));
    }
    u.root.position.copy(u.base);
    // ---- lunge / pounce
    if (u.lungeT >= 0) {
      u.lungeT += dt;
      const k = Math.min(1, u.lungeT / u.lungeDur);
      const s = Math.sin(k * Math.PI);
      u.root.position.addScaledVector(u.lungeVec, s);
      u.root.position.y += u.lungeArc * s;
      if (k >= 1) u.lungeT = -1;
    }
    const celebrate = this.phase !== 'intro' && this.phase !== 'fight' && u.alive && this.result && this.result.winner === u.side;
    // ---- body animation
    u.recoil = Math.max(0, u.recoil - dt * 6);
    u.flashT = Math.max(0, u.flashT - dt);
    u.bob += dt * 2.2;
    if (u.isVehicle) {
      const b = u.body;
      if (u.kind === 'aircraft') {
        let y = Math.sin(u.bob) * 0.22 + 0.2;
        let z = -u.recoil * 0.2;
        if (u.swoopT >= 0) {
          u.swoopT += dt;
          const k = Math.min(1, u.swoopT / 0.9);
          const s = Math.sin(k * Math.PI);
          z += s * 3.2;
          y -= s * 0.6;
          if (k >= 1) u.swoopT = -1;
        }
        if (celebrate) y += Math.min(2.5, this.phaseT * 2);
        if (!u.alive) {
          // Spin down and crash.
          u.deadT += dt;
          y = Math.max(-1.25, 0.2 - u.deadT * u.deadT * 5);
          b.rotation.z += dt * 6;
          if (!u.crashed && y <= -1.2) {
            u.crashed = true;
            _v1.set(u.root.position.x, 0.3, u.root.position.z);
            this.fx.explosion(_v1, 1.6);
            this.sfxBoom();
          }
        } else {
          b.rotation.z = Math.sin(u.bob * 0.7) * 0.08;
          b.rotation.x = u.recoil * 0.18;
        }
        b.position.set(0, y, z);
      } else {
        const hop = celebrate ? Math.abs(Math.sin(t * 7 + u.slot)) * 0.35 : 0;
        b.position.set(0, hop + (u.alive ? 0 : -Math.min(0.35, u.deadT * 0.3)), -u.recoil * 0.3);
        b.rotation.x = -u.recoil * (u.kind === 'tank' ? 0.06 : 0.03);
        if (!u.alive) {
          u.deadT += dt;
          b.rotation.z = Math.min(0.28, u.deadT * 0.6);
        }
      }
      if (!u.alive) {
        u.smokeT -= dt;
        if (u.smokeT <= 0 && u.deadT < 5) {
          u.smokeT = 0.18;
          _v1.set(u.root.position.x, u.kind === 'aircraft' ? 0.3 : 1.0, u.root.position.z);
          this.fx.smokePuff(_v1, 0.9);
        }
      }
    } else if (u.kind === 'boss') {
      const b = u.body;
      b.rotation.z = Math.sin(u.bob * 0.8) * 0.05;
      if (!u.alive) {
        u.deadT += dt;
        b.rotation.x = -Math.min(Math.PI / 2, u.deadT * 2.5);
        b.position.y = -Math.max(0, u.deadT - 1.2) * 0.8;
      } else b.position.y = celebrate ? Math.abs(Math.sin(t * 5)) * 0.4 : 0;
    }
    // ---- flash / char tint
    if (u.mats.length) {
      const f = u.flashT > 0 ? u.flashT / 0.13 : 0;
      for (let i = 0; i < u.mats.length; i++) {
        const m = u.mats[i];
        if (m.emissive) m.emissive.setRGB(f, f * 0.35, f * 0.2);
        if (m.color) {
          if (!u.alive && u.kind !== 'boss') m.color.copy(u.baseColors[i]).multiplyScalar(Math.max(0.28, 1 - u.deadT * 1.5));
          else m.color.copy(u.baseColors[i]);
        }
      }
    }
    // ---- zombie crowd
    if (u.inst) this.animateMembers(u, u.inst, u.members, dt, true, celebrate);
    if (u.soldiers) this.animateMembers(u, u.soldiers, u.soldierMembers, dt, false, celebrate);
    // ---- shield bubble
    const shieldOn = u.alive && u.shield > 0 && this.playT < u.shieldUntil;
    if (shieldOn && !u.shieldMesh) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0.22, depthWrite: false });
      u.shieldMesh = new THREE.Mesh(this.shieldGeom, mat);
      u.shieldMesh.renderOrder = 3;
      u.root.add(u.shieldMesh);
    }
    if (u.shieldMesh) {
      u.shieldMesh.visible = shieldOn;
      if (shieldOn) {
        const r = u.kind === 'boss' ? 2.6 : u.kind === 'zombies' ? 1.8 : 1.75;
        u.shieldMesh.scale.set(r, r * 0.85, r);
        u.shieldMesh.position.set(0, (u.kind === 'aircraft' ? 1.4 : 0.7) + (u.kind === 'aircraft' ? u.body.position.y : 0), 0);
        (u.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 6) * 0.05;
      }
    }
    // ---- stun stars
    const stunned = u.alive && this.playT < u.stunUntil && this.phase === 'fight';
    if (stunned && !u.stunGroup) {
      u.stunGroup = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(this.starGeom, this.starMat);
        const a = (i / 3) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
        u.stunGroup.add(m);
      }
      u.root.add(u.stunGroup);
    }
    if (u.stunGroup) {
      u.stunGroup.visible = stunned;
      if (stunned) {
        u.stunGroup.position.y = u.height - 0.3;
        u.stunGroup.rotation.y = t * 5;
      }
    }
  }

  private animateMembers(u: UnitVis, inst: THREE.InstancedMesh, members: Member[], dt: number, zombie: boolean, celebrate: boolean | null): void {
    const n = members.length;
    const frac = u.maxHp > 0 ? u.hp / u.maxHp : 0;
    const want = u.alive ? Math.max(1, Math.ceil(n * frac - 1e-6)) : 0;
    let aliveCount = 0;
    for (const m of members) if (m.alive) aliveCount++;
    // Kill members from the back of the group as HP drops.
    for (let i = n - 1; i >= 0 && aliveCount > want; i--) {
      if (members[i].alive) {
        members[i].alive = false;
        members[i].dieT = 0;
        aliveCount--;
      }
    }
    const faceRot = zombie ? (u.face > 0 ? 0 : Math.PI) : 0;
    const flash = u.flashT > 0 ? 1 + (u.flashT / 0.13) * 1.6 : 1;
    const sc = zombie ? u.memberScale : 0.72;
    for (let i = 0; i < n; i++) {
      const m = members[i];
      m.phase += dt * (zombie ? (u.zkind === 'runner' ? 9 : 5) : 3);
      let y = 0;
      let rx = 0;
      let s = sc;
      if (m.alive) {
        y = zombie ? Math.abs(Math.sin(m.phase)) * 0.08 : 0;
        if (celebrate) y += Math.abs(Math.sin(m.phase * 1.5)) * 0.35;
      } else {
        m.dieT += dt;
        rx = -Math.min(1, m.dieT / 0.35) * (Math.PI / 2) * 0.95;
        y = -Math.max(0, m.dieT - 0.9) * 0.6;
        if (m.dieT > 2.2) s = 0;
      }
      const lx = zombie ? m.ox : m.ox;
      const lz = zombie ? m.oz * u.face : m.oz;
      _p.set(lx, y, lz);
      _e.set(rx, faceRot + (zombie ? Math.sin(m.phase * 0.5) * 0.18 : 0), zombie ? Math.sin(m.phase) * 0.06 : 0, 'YXZ');
      _q.setFromEuler(_e);
      _s.setScalar(s);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(i, _m);
      if (zombie) {
        _c.copy(u.tint).multiplyScalar(m.alive ? flash : 0.7);
        inst.setColorAt(i, _c);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }

  private updateCamera(dt: number, t: number): void {
    const introK = this.phase === 'intro' ? Math.min(1, this.phaseT / INTRO) : 1;
    const ease = 1 - Math.pow(1 - introK, 2);
    const dist = this.camDist * (1.18 - 0.18 * ease);
    const shake = this.fx.shake;
    this.fx.shake = Math.max(0, shake - dt * 1.6);
    this.camera.position.copy(this.camLook).addScaledVector(this.camDir, dist);
    this.camera.position.x += Math.sin(t * 0.25) * 0.35;
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(this.camLook);
  }

  private updateBars(dt: number): void {
    const sp = { x: 0, y: 0 };
    for (const u of this.list) {
      const show = (u.alive || u.deadT < 0.6) && this.phase !== 'result';
      let vis = false;
      if (show) {
        _v1.set(u.root.position.x, u.height + (u.kind === 'aircraft' ? u.body.position.y : 0), u.root.position.z);
        vis = this.toScreen(_v1, sp);
      }
      const shieldFrac = u.shield > 0 && this.playT < u.shieldUntil ? u.shield / Math.max(1, u.maxHp) : 0;
      this.overlay.updateBar(u.uid, sp.x, sp.y, vis && show, u.maxHp > 0 ? u.hp / u.maxHp : 0, shieldFrac, u.energy / 100, dt);
    }
  }
}
