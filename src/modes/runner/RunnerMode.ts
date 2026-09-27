// OWNER: runner agent. 3D scene for the 'runner' mode ("Special Ops" gate runner). Implements GameMode.
//
// Road coordinates: `d` = distance along the road (forward), `x` = lateral (-4..4). World z = -d, so the
// squad runs toward -Z and the camera sits behind it at larger z. Params: { level: number, intro?: boolean }.
import * as THREE from 'three';
import { untracked } from '@preact/signals';
import { engine, type GameMode } from '../../three/engine';
import { game } from '../../core/store';
import { goTo } from '../../core/nav';
import { sfx } from '../../core/audio';
import { bonusMult, getBonus } from '../../core/bonuses';
import { vehicleModel } from '../../three/models';
import {
  CHAPTERS,
  levelDef,
  SIM,
  THEMES,
  WEAPON_LEVEL_MULT,
  WEAPONS,
  type BarrelDef,
  type BossDef,
  type GateDef,
  type HazardDef,
  type LevelDef,
  type WaveDef,
  type WeaponKind,
} from '../../data/runner';
import { RunnerEnv } from './env';
import { Fx, type FloatKind } from './fx';
import { Squad } from './squad';
import { GateView, gateText } from './gates';
import { BarrelView } from './barrels';
import { Horde, type Zombie } from './zombies';
import { BossView } from './boss';
import { Helpers, type HelperTarget } from './helpers';
import { BULLET_PELLET, BULLET_RIFLE, BULLET_SHELL, Bullets } from './bullets';
import { Acid } from './acid';
import { HazardView } from './hazards';
import { hazardGlowMat } from './mats';
import { skyTexture } from './textures';
import { nextKey, runActions, runHud } from './runState';
import { recordRun, skipIntro } from './progress';
import './runner.css';

type Phase = 'run' | 'boss' | 'won' | 'lost';

const LANE_LIMIT = SIM.roadHalf - 0.55;
const GATE_SPAWN = 100;
const BARREL_SPAWN = 90;
const HAZARD_SPAWN = 110;
/** The opening run never drops the squad below this many soldiers (it can't be lost). */
const INTRO_FLOOR = 10;
/** Seconds without input before the opening run starts steering for the player. */
const ASSIST_IDLE = 2.5;
const clampX = (x: number) => Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, x));
/** Rounded v clamped to [lo, max(lo, hi)]. */
const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), Math.round(v)));

export class RunnerMode implements GameMode {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(56, 1, 0.1, 400);
  private hemi = new THREE.HemisphereLight(0xe8f4ff, 0x7a8a5c, 1.5);
  private sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  private camScale = 1.3;
  private camBoss = 0;

  private active = false;
  private params: { level: number; intro: boolean } = { level: 1, intro: false };
  private def!: LevelDef;
  private quality: 'low' | 'high' = 'high';
  private overlay: HTMLDivElement | null = null;
  private countEl: HTMLDivElement | null = null;
  private countNum: HTMLElement | null = null;
  private countAnim: Animation | null = null;
  private skyTex: THREE.Texture | null = null;

  private env: RunnerEnv | null = null;
  private fx!: Fx;
  private squad!: Squad;
  private horde!: Horde;
  private helpers!: Helpers;
  private bullets!: Bullets;
  private boss: BossView | null = null;
  private acid!: Acid;
  /** Gate views (canvas textures + materials) are kept across runs so their shaders never recompile. */
  private gatePool: GateView[] | null = null;
  private gates: GateView[] = [];
  private barrels: BarrelView[] = [];
  private hazards: HazardView[] = [];
  /** Never-rendered copies of the late-arriving models, kept so their shaders stay compiled. */
  private warmScene: THREE.Scene | null = null;

  // Run state.
  private phase: Phase = 'run';
  private speedNow = 0;
  private targetX = 0;
  private peak = 0;
  private kills = 0;
  private rateMult = 1;
  private dmgMult = 1;
  private multi = 0;
  /** Weapon upgrades collected this run (shown as heavy gunners in the squad). */
  private upgrades = 0;
  private dmgBonus = 1;
  /** Current gun (weapon gates swap it) and its level 1..3. */
  private weapon: WeaponKind = 'rifle';
  private weaponLv = 1;
  /** Soldiers lost so far this level (reinforcement crates bring some back). */
  private lostPool = 0;
  /** Losses by cause this run (tuning / dev bot reports). */
  lossBy: Record<string, number> = {};
  private fireAcc = 0;
  private flashAcc = 0;
  private simT = 0;
  private timeScale = 1;
  private slowmo = 0;
  private endTimer = -1;
  private recorded = false;
  private nextGate = 0;
  private nextBarrel = 0;
  private nextWave = 0;
  private nextHazard = 0;
  private nextCaption = 0;
  private captionT = 0;
  private pendingLoss = 0;
  private lossT = 0;
  private lossX = 0;
  private lossD = 0;
  private bossDmgAcc = 0;
  private bossDmgT = 0;
  private minionT = 0;
  private hudT = 0;
  private shownCount = -1;
  private dragHintT = 0;
  private startT = 0;
  private bossExplosions = 0;
  private bossExplodeT = 0;

  // Input.
  private dragId = -1;
  private dragStartX = 0;
  private dragStartTarget = 0;
  private hasDragged = false;
  /** Sim time of the last steering input (drives the opening run's auto-assist). */
  private lastInputT = 0;
  private assisting = false;
  private keyL = false;
  private keyR = false;

  private tmpV = new THREE.Vector3();
  private tmpP = { x: 0, d: 0 };
  private lookAt = new THREE.Vector3();

  constructor() {
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.camera.position.set(0, 14, 14);
  }

  // ------------------------------------------------------------------------------------------
  // enter()/exit() run inside the engine's route effect: keep them untracked so signal reads/writes
  // (HUD signals, mutate()'s version bump) never subscribe that effect and re-trigger a mode switch.
  enter(params: any): void {
    untracked(() => this.doEnter(params));
  }

  exit(): void {
    untracked(() => this.doExit());
  }

  private doEnter(params: any): void {
    const level = Math.max(1, Math.floor(Number(params?.level) || 1));
    const intro = !!params?.intro;
    this.params = { level, intro };
    this.def = levelDef(level, intro);
    this.quality = game.settings.quality === 'low' ? 'low' : 'high';
    const hi = this.quality === 'high';
    const pal = THEMES[this.def.theme];

    // Sky, fog, lights.
    this.skyTex = skyTexture(pal);
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.Fog(pal.fog, 42, 122);
    this.sun.castShadow = hi;

    // DOM overlay for world-anchored labels (under the HUD layer).
    const stage = document.getElementById('stage') ?? document.body;
    this.overlay = document.createElement('div');
    this.overlay.className = 'rn-overlay';
    stage.appendChild(this.overlay);
    this.countEl = document.createElement('div');
    this.countEl.className = 'rn-count';
    this.countAnim = null;
    this.countNum = document.createElement('span');
    this.countEl.appendChild(this.countNum);
    this.overlay.appendChild(this.countEl);

    const aniso = hi ? Math.min(8, engine.renderer.capabilities.getMaxAnisotropy()) : 1;
    this.env = new RunnerEnv(pal, this.quality, aniso);
    this.scene.add(this.env.group);
    this.fx = new Fx(this.overlay, this.camera, this.quality);
    this.scene.add(this.fx.group);
    this.squad = new Squad(this.quality);
    this.scene.add(this.squad.group);
    this.horde = new Horde(hi);
    this.scene.add(this.horde.group);
    this.helpers = new Helpers(hi);
    this.scene.add(this.helpers.group);
    this.bullets = new Bullets();
    this.scene.add(this.bullets.mesh);
    this.acid = new Acid();
    this.scene.add(this.acid.group);
    if (!this.gatePool) {
      this.gatePool = [];
      for (let i = 0; i < 6; i++) this.gatePool.push(new GateView());
    }
    this.gates = this.gatePool;
    for (const g of this.gates) {
      g.hide();
      g.pair = null;
      this.scene.add(g.group);
    }
    this.hazards = [];
    for (let i = 0; i < 3; i++) {
      const h = new HazardView(hi);
      this.hazards.push(h);
      this.scene.add(h.group);
    }
    this.barrels = [];
    for (let i = 0; i < 6; i++) {
      const b = new BarrelView(this.overlay, hi);
      this.barrels.push(b);
      this.scene.add(b.group);
    }

    // Reset run state.
    this.phase = 'run';
    this.speedNow = this.def.speed;
    this.targetX = 0;
    this.kills = 0;
    this.rateMult = 1;
    this.dmgMult = 1;
    this.multi = 0;
    this.upgrades = 0;
    this.weapon = 'rifle';
    this.weaponLv = 1;
    this.lostPool = 0;
    this.lossBy = {};
    this.dmgBonus = intro ? 1 : bonusMult(game, 'runner_damage_pct');
    this.fireAcc = 0;
    this.simT = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.endTimer = -1;
    this.recorded = false;
    this.nextGate = this.nextBarrel = this.nextWave = this.nextHazard = this.nextCaption = 0;
    this.captionT = 0;
    this.pendingLoss = 0;
    this.lossT = 0;
    this.bossDmgAcc = 0;
    this.bossDmgT = 0;
    this.minionT = 0;
    this.hudT = 0;
    this.shownCount = -1;
    this.startT = 0;
    this.camBoss = 0;
    this.bossExplosions = 0;
    this.boss = null;
    this.hasDragged = false;
    this.lastInputT = 0;
    this.assisting = false;
    this.dragId = -1;
    this.keyL = this.keyR = false;
    const start = this.def.startSoldiers + (intro ? 0 : Math.floor(getBonus(game, 'runner_start_soldiers')));
    this.squad.reset(start, 0, 0);
    this.peak = start;

    // HUD.
    runHud.title.value = intro ? 'Prologue' : `Level ${this.def.label}`;
    runHud.subtitle.value = intro ? 'Break Out' : CHAPTERS[this.def.chapter - 1].name;
    runHud.intro.value = intro;
    runHud.progress.value = 0;
    runHud.paused.value = false;
    runHud.boss.value = null;
    runHud.result.value = null;
    runHud.caption.value = null;
    runHud.banner.value = intro ? null : { text: `LEVEL ${this.def.label}`, kind: 'info', key: nextKey() };
    runHud.dragHint.value = true;
    this.dragHintT = intro ? 12 : 4.5;
    this.pushWeapon();

    runActions.pause = () => {
      if (this.phase === 'won' || this.phase === 'lost') return;
      runHud.paused.value = true;
    };
    runActions.resume = () => {
      runHud.paused.value = false;
    };
    runActions.quit = () => this.quit();
    runActions.retry = () => goTo('runner', { level: this.params.level, intro: this.params.intro });

    const c = engine.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    document.addEventListener('visibilitychange', this.onVis);

    this.active = true;
    this.updateCamera(0);
    this.env.update(0);
    // Warm up this scene's shaders (plus the boss and helper vehicles that only show up later) off the
    // main thread where the browser supports it.
    engine.renderer.compileAsync(this.scene, this.camera).catch(() => {});
    if (!this.warmScene) {
      this.warmScene = new THREE.Scene();
      const bv = new BossView(this.def.boss, 0, hi);
      this.warmScene.add(bv.group, vehicleModel('tank', 'SSR'), vehicleModel('missile', 'SR'));
      this.warmScene.traverse((o) => (o.visible = true));
    }
    engine.renderer.compileAsync(this.warmScene, this.camera, this.scene).catch(() => {});
    if (import.meta.env.DEV) {
      (window as any).__runner = this;
      void import('./devtools');
    }
  }

  private doExit(): void {
    if (!this.active) return;
    // Leaving mid-run counts as a failure (like the genre).
    if (!this.recorded && !this.params.intro && (this.phase === 'run' || this.phase === 'boss')) this.record(false);
    this.active = false;
    const c = engine.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    document.removeEventListener('visibilitychange', this.onVis);
    runActions.pause = runActions.resume = runActions.quit = runActions.retry = () => {};
    runHud.boss.value = null;
    runHud.result.value = null;
    runHud.caption.value = null;
    runHud.banner.value = null;
    runHud.paused.value = false;

    // Tear down everything this run created (cached model geometries are shared and kept).
    this.env?.dispose();
    this.env = null;
    this.fx.dispose();
    this.squad.dispose();
    this.horde.dispose();
    this.helpers.dispose();
    this.bullets.dispose();
    this.acid.dispose();
    this.boss?.dispose();
    this.boss = null;
    // Gate views are pooled across runs (never disposed); hazards share cached geometry/materials.
    for (const g of this.gates) g.hide();
    for (const h of this.hazards) h.hide();
    for (const b of this.barrels) b.dispose();
    this.gates = [];
    this.barrels = [];
    this.hazards = [];
    for (const ch of [...this.scene.children]) {
      if (ch !== this.hemi && ch !== this.sun && ch !== this.sun.target) this.scene.remove(ch);
    }
    this.skyTex?.dispose();
    this.skyTex = null;
    this.scene.background = null;
    this.overlay?.remove();
    this.overlay = null;
    this.countEl = null;
    this.countNum = null;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Fit the road (plus a little sidewalk) across narrow portrait screens.
    const halfAtSquad = 15.7 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    this.camScale = Math.min(1.75, Math.max(1, 5.4 / halfAtSquad));
  }

  // ------------------------------------------------------------------------------------------
  // Input
  private onDown = (e: PointerEvent) => {
    if (runHud.paused.value || this.dragId !== -1) return;
    this.dragId = e.pointerId;
    this.dragStartX = e.clientX;
    this.dragStartTarget = this.targetX;
    this.lastInputT = this.simT;
    try {
      engine.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    const ref = Math.min(engine.width, 560);
    const span = SIM.roadHalf * 2 * 1.3;
    const dx = ((e.clientX - this.dragStartX) / ref) * span;
    this.targetX = clampX(this.dragStartTarget + dx);
    this.lastInputT = this.simT;
    if (!this.hasDragged && Math.abs(dx) > 0.4) {
      this.hasDragged = true;
      runHud.dragHint.value = false;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    this.dragId = -1;
  };

  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keyL = down;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keyR = down;
    else if (down && (e.key === 'Escape' || e.key === 'p')) {
      if (runHud.paused.value) runActions.resume();
      else runActions.pause();
    }
  };

  private onVis = () => {
    if (document.visibilityState === 'hidden') runActions.pause();
  };

  // ------------------------------------------------------------------------------------------
  update(dt: number, t: number): void {
    if (!this.active) return;
    if (!runHud.paused.value) {
      // Slow-motion easing (boss kill).
      if (this.slowmo > 0) {
        this.slowmo -= dt;
        this.timeScale += (0.2 - this.timeScale) * Math.min(1, dt * 12);
      } else this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 3);
      const sdt = dt * this.timeScale;
      this.simT += sdt;
      this.step(sdt, dt);
    }
    this.updateCamera(dt);
    this.updateLabels();
  }

  private step(dt: number, realDt: number): void {
    const def = this.def;
    const sq = this.squad;
    this.startT += dt;

    // Forward motion.
    if (this.phase === 'run') {
      this.speedNow = def.speed;
      if (sq.d >= def.length) this.startBoss();
    } else if (this.phase === 'boss') {
      this.speedNow = Math.max(0, this.speedNow - def.speed * dt * 0.9);
    } else {
      this.speedNow = Math.max(0, this.speedNow - def.speed * dt * 2);
    }
    sq.d += this.speedNow * dt;

    // Steering.
    if (this.keyL || this.keyR) {
      this.targetX += (this.keyR ? 1 : -1) * 9 * realDt;
      this.targetX = clampX(this.targetX);
      this.lastInputT = this.simT;
      if (!this.hasDragged) {
        this.hasDragged = true;
        runHud.dragHint.value = false;
      }
    }
    if (this.params.intro && this.phase === 'run') this.introAssist(dt);
    if (this.phase === 'run' || this.phase === 'boss') sq.x += (this.targetX - sq.x) * Math.min(1, dt * 13);

    this.spawnAhead();
    const fighting = (this.phase === 'run' || this.phase === 'boss') && sq.count > 0;
    if (fighting) this.fire(dt);
    this.updateBullets(dt);

    // Zombies (+ spitter acid).
    this.horde.update(dt, sq.x, sq.d, sq.radius, sq.depth, this.onZombieContact, this.onZombiePassed);
    if (this.horde.alive.spitter > 0 && fighting) this.updateSpitters(dt);
    this.acid.update(dt, this.onAcidLand);

    // Barrels.
    for (const b of this.barrels) {
      if (!b.active) continue;
      b.update(dt, this.simT);
      const ahead = b.d - sq.d;
      if (ahead < sq.depth + b.radius * 0.7 && ahead > -sq.depth - 1 && Math.abs(b.x - sq.x) < sq.radius + b.radius * 0.7 && this.phase === 'run') {
        this.barrelContact(b);
      } else if (ahead < -5) b.hide();
    }

    // Gates.
    for (const g of this.gates) {
      if (!g.active) continue;
      g.update(dt);
      if (g.fading === 0 && sq.d >= g.d && this.phase === 'run') this.passGate(g);
    }

    // Lane hazards.
    let hz = false;
    for (const h of this.hazards) {
      if (!h.active) continue;
      hz = true;
      h.update(this.simT);
      if (!h.passed && sq.d >= h.d && this.phase === 'run') {
        h.passed = true;
        this.crossHazard(h);
      } else if (h.d - sq.d < -8) h.hide();
    }
    if (hz) hazardGlowMat().opacity = 0.2 + 0.16 * (0.5 + 0.5 * Math.sin(this.simT * 7));

    // Helpers.
    const helperDmg = Math.max(4, this.dps() * 0.55);
    this.helpers.update(
      dt,
      this.simT,
      sq.x,
      sq.d,
      sq.radius,
      fighting,
      helperDmg,
      this.findTarget,
      this.onShellImpact,
      this.onHelperFire,
    );

    // Boss.
    if (this.boss) this.updateBoss(dt);

    // Captions & hints.
    this.updateCaptions(dt);
    if (this.dragHintT > 0) {
      this.dragHintT -= realDt;
      if (this.dragHintT <= 0) runHud.dragHint.value = false;
    }

    // Aggregated soldier-loss popups.
    if (this.pendingLoss > 0) {
      this.lossT -= realDt;
      if (this.lossT <= 0) {
        this.fx.float(this.lossX, 1.8, this.lossD, `−${this.pendingLoss}`, 'bad');
        this.pendingLoss = 0;
      }
    }
    if (this.bossDmgAcc > 0) {
      this.bossDmgT -= realDt;
      if (this.bossDmgT <= 0 && this.boss) {
        this.fx.float(this.boss.x + (Math.random() - 0.5) * 2, 3.2 * this.boss.scale, this.boss.d, fmtNum(this.bossDmgAcc), 'dmg');
        this.bossDmgAcc = 0;
        this.bossDmgT = 0.22;
      }
    }

    // End conditions.
    if (this.endTimer >= 0) {
      this.endTimer -= realDt;
      if (this.endTimer < 0) this.finish();
    }

    this.fx.update(dt);
    this.env!.update(sq.d);
    sq.update(dt, this.simT);
    this.horde.render(this.simT);
    this.bullets.render();
    this.acid.render(this.simT);

    // Throttled HUD sync.
    this.hudT -= realDt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      runHud.progress.value = Math.min(1, sq.d / def.length);
      if (this.boss && this.boss.alive) {
        const cur = runHud.boss.value;
        const hp = Math.ceil(this.boss.hp);
        if (!cur || cur.hp !== hp) runHud.boss.value = { name: this.boss.name, hp, max: this.boss.max, big: this.boss.big };
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  private spawnAhead(): void {
    const def = this.def;
    const sqd = this.squad.d;
    while (this.nextGate < def.gates.length && def.gates[this.nextGate].d - sqd < GATE_SPAWN) {
      const g0 = def.gates[this.nextGate++];
      const v0 = this.spawnGate(g0);
      // Pair gates at the same distance.
      if (this.nextGate < def.gates.length && Math.abs(def.gates[this.nextGate].d - g0.d) < 0.01) {
        const v1 = this.spawnGate(def.gates[this.nextGate++]);
        if (v0 && v1) {
          v0.pair = v1;
          v1.pair = v0;
        }
      }
    }
    while (this.nextBarrel < def.barrels.length && def.barrels[this.nextBarrel].d - sqd < BARREL_SPAWN) {
      this.spawnBarrel(def.barrels[this.nextBarrel++]);
    }
    while (this.nextWave < def.waves.length && def.waves[this.nextWave].d - sqd < SIM.waveWake) {
      this.spawnWave(def.waves[this.nextWave++]);
    }
    while (this.nextHazard < def.hazards.length && def.hazards[this.nextHazard].d - sqd < HAZARD_SPAWN) {
      this.spawnHazard(def.hazards[this.nextHazard++]);
    }
  }

  private spawnHazard(def: HazardDef): void {
    const h = this.hazards.find((x) => !x.active);
    if (h) h.setup(def);
  }

  private spawnGate(def: GateDef): GateView | null {
    const g = this.gates.find((x) => !x.active);
    if (!g) return null;
    g.pair = null;
    g.setup(def);
    return g;
  }

  private spawnBarrel(def: BarrelDef): void {
    const b = this.barrels.find((x) => !x.active);
    if (b) b.setup(def);
  }

  private spawnWave(w: WaveDef): void {
    const def = this.def;
    const k = this.hordeScale(w.d);
    for (const s of w.spawns) {
      this.horde.spawn(s.kind, s.x, w.d + s.dd, w.hp[s.kind] * k, def.zspeed[s.kind], def.contact[s.kind]);
    }
  }

  /** The generator's expected squad DPS at road distance d. */
  private expectedDps(d: number): number {
    const tr = this.def.trace;
    let v = tr.length ? tr[0].dps : 0;
    for (const e of tr) {
      if (e.d > d) break;
      v = e.dps;
    }
    return v;
  }

  /**
   * A squad far ahead of the level's expected curve (e.g. a lucky early multiplier) meets somewhat
   * tougher zombies so the level keeps some bite (square-root response, capped). Squads behind the
   * curve get no slack: stars measure how well the run went.
   */
  private hordeScale(d: number, lo = 1, hi = 1.5): number {
    if (this.params.intro) return 1;
    const e = this.expectedDps(d);
    if (e <= 0) return 1;
    return Math.max(lo, Math.min(hi, Math.sqrt(this.dps() / e)));
  }

  // ------------------------------------------------------------------------------------------
  private dps(): number {
    const gun = WEAPONS[this.weapon].dmg * WEAPON_LEVEL_MULT[this.weaponLv];
    return this.squad.count * SIM.fireRate * this.rateMult * this.dmgMult * this.dmgBonus * (1 + SIM.multiDamage * this.multi) * gun;
  }

  private fire(dt: number): void {
    const sq = this.squad;
    const W = WEAPONS[this.weapon];
    const shots = sq.count * SIM.fireRate * this.rateMult;
    // Visual volleys are capped; each carries the pooled damage of many shots. Heavier guns fire fewer,
    // harder volleys (which also means fewer gate hits).
    const volleys = Math.min(SIM.bulletCap * this.rateMult, shots) * W.rate;
    if (volleys <= 0) return;
    const perVolley = (shots * this.dmgMult * this.dmgBonus * W.dmg * WEAPON_LEVEL_MULT[this.weaponLv]) / volleys;
    const perPellet = perVolley / W.pellets;
    const kind = this.weapon === 'spread' ? BULLET_PELLET : this.weapon === 'cannon' ? BULLET_SHELL : BULLET_RIFLE;
    const range = SIM.bulletRange * W.range;
    this.fireAcc += volleys * dt;
    let guard = 0;
    while (this.fireAcc >= 1 && guard++ < 8) {
      this.fireAcc -= 1;
      sq.shooter(this.tmpP);
      const x = this.tmpP.x;
      const d = this.tmpP.d;
      for (let p = 0; p < W.pellets; p++) {
        const vx = W.pellets > 1 ? (p - (W.pellets - 1) / 2) * 6.5 : 0;
        this.bullets.spawn(x, 0.62, d, perPellet, kind, vx, range);
      }
      for (let k = 1; k <= this.multi; k++) {
        const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.32;
        this.bullets.spawn(x + off, 0.62, d - 0.1, perPellet * SIM.multiDamage, kind, 0, range);
      }
      this.fx.muzzle(x, 0.66, d);
      if (kind === BULLET_SHELL) this.fx.sparks(x, 0.8, d + 0.3, 0xffa040, 3, 3);
      sfx.shoot();
    }
    if (this.fireAcc > 1) this.fireAcc = 1;
    // Cosmetic muzzle flashes so a big squad looks like it's all firing (bullets are pooled).
    this.flashAcc += Math.min(this.quality === 'high' ? 36 : 18, sq.rendered * 0.9) * dt;
    guard = 0;
    while (this.flashAcc >= 1 && guard++ < 6) {
      this.flashAcc -= 1;
      sq.shooter(this.tmpP);
      this.fx.muzzle(this.tmpP.x, 0.66, this.tmpP.d);
    }
    if (this.flashAcc > 1) this.flashAcc = 1;
  }

  private updateBullets(dt: number): void {
    const b = this.bullets;
    const step = SIM.bulletSpeed * dt;
    const sqd = this.squad.d;
    const edge = SIM.roadHalf + 0.6;
    for (let i = b.n - 1; i >= 0; i--) {
      let d0 = b.d[i];
      const d1 = d0 + step;
      b.d[i] = d1;
      if (b.vx[i] !== 0) b.x[i] += b.vx[i] * dt;
      const x = b.x[i];
      if (d1 - sqd > b.range[i] || x > edge || x < -edge) {
        b.kill(i);
        continue;
      }
      const shell = b.kind[i] === BULLET_SHELL;
      const y = b.y[i];
      let dmg = b.dmg[i];
      let spent = false;
      // A bullet that overkills a zombie keeps going with the leftover damage, so a big squad mows
      // through a dense horde instead of wasting shots. Cannon shells burst on the first thing hit.
      for (let pass = 0; pass < 8 && !spent; pass++) {
        let bestD = Infinity;
        let kind = 0; // 1 zombie, 2 barrel, 3 gate, 4 boss
        let zHit: Zombie | null = null;
        let bHit: BarrelView | null = null;
        let gHit: GateView | null = null;
        const z = this.horde.bulletHit(x, d0, d1);
        if (z) {
          bestD = z.d;
          kind = 1;
          zHit = z;
        }
        for (const br of this.barrels) {
          if (!br.active) continue;
          const r = br.radius;
          if (br.d < d0 - r || br.d > d1 + r || Math.abs(br.x - x) > r) continue;
          if (br.d < bestD) {
            bestD = br.d;
            kind = 2;
            bHit = br;
          }
        }
        for (const g of this.gates) {
          if (!g.active || g.fading > 0) continue;
          if (g.d <= d0 || g.d > d1 + 0.001 || x < g.x0 || x > g.x1) continue;
          if (g.d < bestD) {
            bestD = g.d;
            kind = 3;
            gHit = g;
          }
        }
        const boss = this.boss;
        if (boss && boss.alive && boss.state !== 'enter') {
          const front = boss.d - 0.6 * boss.scale;
          if (front >= d0 - 1 && front <= d1 + 0.5 && Math.abs(boss.x - x) < boss.halfW && front < bestD) {
            bestD = front;
            kind = 4;
          }
        }
        if (kind === 0) break;
        spent = true;
        if (kind === 1 && zHit) {
          if (shell) this.shellBurst(x, zHit, dmg);
          else if (dmg > zHit.hp + 0.01) {
            // Pierce: kill it and carry on with what's left.
            dmg -= zHit.hp;
            b.dmg[i] = dmg;
            d0 = zHit.d;
            this.killZombie(zHit);
            spent = false;
          } else this.damageZombie(zHit, dmg, x, y);
        } else if (kind === 2 && bHit) {
          this.fx.sparks(x, 0.9, bHit.d, 0xffd080, 2, 4);
          if (bHit.damage(dmg)) this.breakBarrel(bHit);
        } else if (kind === 3 && gHit) {
          const lv = gHit.value;
          const flipped = gHit.hit();
          this.fx.sparks(x, 1.2, gHit.d, gHit.kind === 'gun' ? 0xffc050 : gHit.isGood ? 0x8fd0ff : 0xff9080, 2, 3);
          if (flipped) {
            this.fx.burst(gHit.side * SIM.laneX, 1.2, gHit.d, 0x6ac0ff, 22, 6);
            this.fx.ring(gHit.side * SIM.laneX, gHit.d, 2.6, 0x4aa8ff, 0.4);
            sfx.gateGood();
          } else if (gHit.kind === 'gun' && gHit.value > lv) {
            this.fx.burst(gHit.side * SIM.laneX, 1.4, gHit.d, 0xffc040, 24, 6);
            this.fx.ring(gHit.side * SIM.laneX, gHit.d, 2.6, 0xffa020, 0.4);
            sfx.upgrade();
          }
        } else if (kind === 4 && boss) {
          this.fx.sparks(x, 1.6 + Math.random() * 2 * boss.scale, boss.d - 0.8 * boss.scale, shell ? 0xffa040 : 0xffe0a0, shell ? 6 : 2, 5);
          this.bossDmgAcc += dmg;
          if (boss.hit(dmg)) this.bossKilled();
        }
      }
      if (spent) b.kill(i);
    }
  }

  /** Cannon shell: full damage to the zombie it hits plus a splash around it. */
  private shellBurst(x: number, z: Zombie, dmg: number): void {
    const d = z.d;
    this.damageZombie(z, dmg, x, 0.8);
    this.fx.burst(x, 0.7, d, 0xffa040, 9, 5);
    this.fx.ring(x, d, WEAPONS.cannon.splash * 1.2, 0xff8a30, 0.28);
    this.splash(x, d, WEAPONS.cannon.splash, dmg * 0.55);
  }

  private damageZombie(z: Zombie, dmg: number, x: number, y: number): void {
    z.hp -= dmg;
    z.flash = 0.07;
    if (z.hp <= 0) this.killZombie(z);
    else this.fx.sparks(x, Math.max(0.6, y), z.d, 0xd8ff9a, 2, 3.5);
  }

  private killZombie(z: Zombie): void {
    const big = z.kind === 'brute' || z.kind === 'elite';
    this.fx.zombiePuff(z.x, z.d, big);
    if (big) {
      this.fx.addShake(0.12);
      sfx.hit();
    }
    this.kills++;
    this.horde.remove(z);
  }

  /** Splash damage (helpers, explosive barrels). */
  private splash(x: number, d: number, radius: number, dmg: number): void {
    const list = this.horde.list;
    const r2 = radius * radius;
    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      const dx = z.x - x;
      const dd = z.d - d;
      if (dx * dx + dd * dd > r2 + z.radius) continue;
      z.hp -= dmg;
      z.flash = 0.1;
      if (z.hp <= 0) this.killZombie(z);
    }
    for (const b of this.barrels) {
      if (!b.active) continue;
      const dx = b.x - x;
      const dd = b.d - d;
      if (dx * dx + dd * dd <= r2 + 1 && b.damage(dmg)) this.breakBarrel(b);
    }
    const boss = this.boss;
    if (boss && boss.alive && boss.state !== 'enter' && Math.abs(boss.d - d) < radius + 1.2 && Math.abs(boss.x - x) < radius + boss.halfW) {
      this.bossDmgAcc += dmg;
      if (boss.hit(dmg)) this.bossKilled();
    }
  }

  private findTarget = (x: number, d: number, out: HelperTarget): boolean => {
    let best = Infinity;
    const maxD = d + SIM.bulletRange - 2;
    for (const z of this.horde.list) {
      if (z.rise < 0.6 || z.d < d + 3 || z.d > maxD) continue;
      // Prefer big threats a little.
      const score = z.d - d + Math.abs(z.x - x) * 0.5 - (z.kind === 'brute' ? 6 : z.kind === 'spitter' ? 5 : z.kind === 'runner' ? 3 : 0);
      if (score < best) {
        best = score;
        out.x = z.x;
        out.d = z.d - z.speed * 0.5;
      }
    }
    if (best < Infinity) return true;
    const boss = this.boss;
    if (boss && boss.alive && boss.state !== 'enter' && boss.d < maxD + 6) {
      out.x = boss.x;
      out.d = boss.d;
      return true;
    }
    for (const b of this.barrels) {
      if (!b.active || b.d < d + 3 || b.d > maxD) continue;
      out.x = b.x;
      out.d = b.d + 1.5;
      return true;
    }
    return false;
  };

  private onShellImpact = (x: number, d: number, radius: number, dmg: number) => {
    this.fx.explosion(x, d, radius * 0.8);
    this.fx.addShake(0.12);
    sfx.explode();
    this.splash(x, d, radius, dmg);
  };

  private onHelperFire = (x: number, d: number) => {
    this.fx.sparks(x, 1, d, 0xffc060, 6, 4);
    this.fx.muzzle(x, 1, d);
  };

  // ------------------------------------------------------------------------------------------
  private setCount(n: number, fromX?: number, fromD?: number): void {
    const sq = this.squad;
    const before = sq.count;
    // The opening run is a guaranteed spectacle: the squad never drops below INTRO_FLOOR soldiers.
    if (this.params.intro && n < before) n = Math.max(n, Math.min(before, INTRO_FLOOR));
    sq.setCount(n, this.fx, fromX, fromD);
    if (sq.count > this.peak) this.peak = sq.count;
    if (sq.count !== before) this.popCount(sq.count > before);
    if (sq.count < before) this.lostPool += before - sq.count;
    if (sq.count <= 0 && (this.phase === 'run' || this.phase === 'boss')) this.fail();
  }

  private loseSoldiers(n: number, x: number, d: number, cause = 'other'): void {
    const sq = this.squad;
    const before = sq.count;
    if (n <= 0 || before <= 0) return;
    this.setCount(before - Math.min(before, n));
    const lost = before - sq.count;
    if (lost <= 0) return;
    this.lossBy[cause] = (this.lossBy[cause] ?? 0) + lost;
    this.pendingLoss += lost;
    this.lossX = x;
    this.lossD = d;
    if (this.lossT <= 0) this.lossT = 0.18;
  }

  /** Soldiers a reinforcement crate would bring back right now. */
  private healAmount(pct: number): number {
    return this.lostPool > 0 ? Math.max(1, Math.ceil((this.lostPool * pct) / 100)) : 3;
  }

  private popCount(up: boolean): void {
    const el = this.countEl;
    if (!el) return;
    // One pop at a time: a horde clash changes the count many times a second.
    this.countAnim?.cancel();
    this.countAnim = el.animate(
      [
        { transform: 'translate(-50%, -100%) scale(1)' },
        { transform: `translate(-50%, -100%) scale(${up ? 1.45 : 0.82})`, color: up ? '#8dffa0' : '#ff7a6a', offset: 0.35 },
        { transform: 'translate(-50%, -100%) scale(1)' },
      ],
      { duration: 280, easing: 'ease-out', composite: 'replace' },
    );
  }

  // Bound once (no per-frame closures).
  private onZombieContact = (z: Zombie) => this.zombieContact(z);
  private onZombiePassed = (z: Zombie) => this.horde.remove(z);

  private zombieContact(z: Zombie): void {
    // Big zombies crush a share of the squad (capped by the level's value), so one brute is a real
    // threat to any squad size without snowballing a squad that's already behind.
    const c = this.squad.count;
    const n = z.kind === 'brute' ? clampI(c * 0.06, 4, z.contact) : z.kind === 'elite' ? clampI(c * 0.022, 2, z.contact) : z.contact;
    const big = z.kind === 'brute';
    this.fx.zombiePuff(z.x, z.d, big);
    this.kills++;
    this.horde.remove(z);
    this.loseSoldiers(n, z.x, z.d, z.kind);
    if (big) {
      this.fx.addShake(0.35);
      this.fx.ring(z.x, z.d, 2, 0xff6040, 0.35);
      sfx.explode();
    } else sfx.hit();
  }

  private barrelContact(b: BarrelView): void {
    if (b.reward === 'explosive') {
      this.fx.explosion(b.x, b.d, 3);
      this.fx.addShake(0.5);
      this.fx.screenFlash('red');
      sfx.explode();
      this.loseSoldiers(Math.max(2, Math.round(this.squad.count * 0.1)), b.x, b.d, 'drum');
      this.splash(b.x, b.d, 3.5, b.amount);
    } else {
      this.fx.debris(b.x, 0.8, b.d, 0x8a7a60, 10);
      this.fx.float(b.x, 2, b.d, 'MISSED', 'info');
      sfx.error();
    }
    b.hide();
  }

  private breakBarrel(b: BarrelView): void {
    if (!b.active) return;
    const x = b.x;
    const d = b.d;
    b.hide();
    const sq = this.squad;
    switch (b.reward) {
      case 'explosive':
        this.fx.explosion(x, d, 4);
        this.fx.addShake(0.5);
        sfx.explode();
        this.splash(x, d, 4.2, b.amount);
        // Blowing it up right on top of your own squad hurts.
        if (Math.abs(d - sq.d) < 3 + sq.depth && Math.abs(x - sq.x) < 3 + sq.radius) this.loseSoldiers(Math.max(1, Math.round(sq.count * 0.05)), x, d, 'drum');
        return;
      case 'soldiers':
        this.setCount(sq.count + b.amount, x, d);
        this.fx.float(x, 2.4, d, `+${b.amount}`, 'big-good');
        break;
      case 'rate':
        this.rateMult = Math.min(4, this.rateMult * (1 + b.amount / 100));
        this.fx.float(x, 2.4, d, 'RAPID FIRE!', 'good');
        this.upgrades++;
        this.pushWeapon();
        break;
      case 'dmg':
        this.dmgMult = Math.min(8, this.dmgMult * (1 + b.amount / 100));
        this.fx.float(x, 2.4, d, 'POWER SHOT!', 'good');
        this.upgrades++;
        this.pushWeapon();
        break;
      case 'multi':
        this.multi = Math.min(SIM.maxMulti, this.multi + b.amount);
        this.fx.float(x, 2.4, d, 'MULTI-SHOT!', 'good');
        this.upgrades++;
        this.pushWeapon();
        break;
      case 'tank':
      case 'rocket':
        if (this.helpers.add(b.reward, x, d)) {
          this.fx.float(x, 2.6, d, b.reward === 'tank' ? 'TANK JOINS!' : 'ROCKETS JOIN!', 'big-good');
          runHud.banner.value = { text: b.reward === 'tank' ? 'Backup: light tank!' : 'Backup: rocket truck!', kind: 'good', key: nextKey() };
          this.pushWeapon();
        } else {
          // Already at max helpers: pay out soldiers instead.
          const extra = Math.max(5, Math.round(sq.count * 0.3));
          this.setCount(sq.count + extra, x, d);
          this.fx.float(x, 2.4, d, `+${extra}`, 'big-good');
        }
        break;
      case 'heal': {
        // Reinforcements: part of the soldiers lost so far come running back.
        const n = this.healAmount(b.amount);
        const lostBefore = this.lostPool;
        this.setCount(sq.count + n, x, d);
        this.lostPool = Math.max(0, lostBefore - n);
        this.fx.float(x, 2.6, d, `+${n} REINFORCEMENTS`, 'big-good');
        runHud.banner.value = { text: 'Reinforcements arrived!', kind: 'good', key: nextKey() };
        this.fx.burst(x, 1.2, d, 0x6cffd9, 24, 7);
        break;
      }
    }
    this.fx.debris(x, 0.9, d, b.reward === 'soldiers' ? 0x6b7f3a : b.reward === 'heal' ? 0xe6ece8 : 0x3d5a78, 12);
    this.fx.burst(x, 1, d, 0xffe070, 16, 6);
    this.fx.ring(x, d, 2.2, 0xffd060, 0.35);
    sfx.reward();
  }

  /** The squad's centre decides which half of the road (and so which gate) it goes through. */
  private passGate(g: GateView): void {
    const sx = this.squad.x;
    const pair = g.pair && g.pair.fading === 0 ? g.pair : null;
    for (const v of pair ? [g, pair] : [g]) {
      const chosen = v.side < 0 ? sx < 0 : sx >= 0;
      v.pass(chosen);
      if (chosen) this.applyGate(v);
    }
  }

  private applyGate(g: GateView): void {
    const sq = this.squad;
    const cx = g.side * SIM.laneX;
    const good = g.isGood;
    const label = gateText(g.kind, g.value);
    const before = sq.count;
    let n = before;
    if (g.kind === 'add') n = before + g.value;
    // Dividing never wipes the squad out on its own (a minus gate can).
    else if (g.kind === 'mul') n = g.value > 0 ? before * g.value : Math.max(1, Math.floor(before / -g.value));
    else if (g.kind === 'rate') {
      if (g.value > 0) this.upgrades++;
      this.rateMult = Math.max(0.4, Math.min(4, this.rateMult * (1 + g.value / 100)));
      this.pushWeapon();
    } else if (g.kind === 'gun') {
      this.weapon = g.weapon;
      this.weaponLv = g.value;
      this.upgrades++;
      this.pushWeapon();
      runHud.banner.value = { text: `${WEAPONS[g.weapon].name} LV ${g.value}!`, kind: 'good', key: nextKey() };
    } else {
      if (g.value > 0) this.upgrades++;
      this.dmgMult = Math.max(0.4, Math.min(8, this.dmgMult * (1 + g.value / 100)));
      this.pushWeapon();
    }
    const sub = g.kind === 'rate' ? ' FIRE RATE' : g.kind === 'dmg' ? ' DAMAGE' : '';
    const text = g.kind === 'gun' ? WEAPONS[g.weapon].name : label + sub;
    this.fx.float(sq.x, 2.6, sq.d + 1, text, good ? 'big-good' : 'big-bad');
    this.fx.burst(cx, 1.4, g.d, g.kind === 'gun' ? 0xffb030 : good ? 0x5ab8ff : 0xff5a4a, 26, 7);
    this.fx.ring(sq.x, sq.d, 3.2, g.kind === 'gun' ? 0xffa020 : good ? 0x4aa8ff : 0xff4a3a, 0.45);
    if (good) {
      if (g.kind === 'gun') sfx.upgrade();
      else sfx.gateGood();
      this.fx.screenFlash('blue');
      if (n > before) this.setCount(n, cx, g.d);
    } else {
      sfx.gateBad();
      this.fx.addShake(0.3);
      this.fx.screenFlash('red');
      if (n < before) {
        this.setCount(n);
        this.lossBy.gate = (this.lossBy.gate ?? 0) + before - sq.count;
        this.pendingLoss += before - sq.count;
        this.lossX = sq.x;
        this.lossD = sq.d;
        this.lossT = 0.25;
      }
    }
  }

  private pushWeapon(): void {
    if (this.squad) this.squad.heavies = Math.min(8, this.upgrades * 2);
    runHud.weapon.value = {
      rate: this.rateMult,
      dmg: this.dmgMult,
      multi: this.multi,
      helpers: this.helpers?.count ?? 0,
      gun: this.weapon,
      gunLv: this.weaponLv,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Opening-run assist, spitters, hazards.

  /** How big the squad would be after taking this gate (for the opening's steering assist). */
  private gateOutcome(g: GateView): number {
    const c = this.squad.count;
    if (g.kind === 'add') return c + g.value;
    if (g.kind === 'mul') return g.value > 0 ? c * g.value : c / -g.value;
    if (g.kind === 'gun') return c * 1.25;
    return c * (1 + (g.value / 100) * 0.5);
  }

  /**
   * The opening can't be lost and shouldn't stall: after a few seconds without input it gently steers
   * toward the better gate (or a crate worth shooting). Any touch or key hands control straight back.
   */
  private introAssist(dt: number): void {
    if (this.dragId !== -1 || this.keyL || this.keyR) {
      this.lastInputT = this.simT;
      this.assisting = false;
      return;
    }
    if (this.simT - this.lastInputT < ASSIST_IDLE) return;
    const sq = this.squad;
    let goal: number | null = null;
    let gateD = Infinity;
    for (const g of this.gates) {
      if (g.active && g.fading === 0 && g.d > sq.d && g.d - sq.d < 48 && g.d < gateD) gateD = g.d;
    }
    if (gateD < Infinity) {
      let best = -Infinity;
      for (const g of this.gates) {
        if (!g.active || g.fading > 0 || Math.abs(g.d - gateD) > 0.1) continue;
        const v = this.gateOutcome(g);
        if (v > best) {
          best = v;
          goal = g.side * SIM.laneX;
        }
      }
    } else {
      let bd = Infinity;
      for (const b of this.barrels) {
        if (!b.active || b.d < sq.d + 4 || b.d - sq.d > 34 || b.d > bd) continue;
        if (b.reward === 'explosive') {
          // Step aside from a drum we're about to walk into.
          if (b.d - sq.d < 12 && Math.abs(b.x - sq.x) < sq.radius + 1) goal = b.x > sq.x ? b.x - sq.radius - 1.6 : b.x + sq.radius + 1.6;
          continue;
        }
        bd = b.d;
        goal = b.x;
      }
    }
    if (goal === null) return;
    if (!this.assisting && !this.hasDragged) {
      runHud.dragHint.value = true;
      this.dragHintT = Math.max(this.dragHintT, 3);
    }
    this.assisting = true;
    this.targetX += (clampX(goal) - this.targetX) * Math.min(1, dt * 2.4);
  }

  private updateSpitters(dt: number): void {
    const sq = this.squad;
    const every = this.def.spit.every;
    for (const z of this.horde.list) {
      if (z.kind !== 'spitter' || z.rise < 1) continue;
      const ahead = z.d - sq.d;
      if (ahead > SIM.spitRange || ahead < 6) continue;
      z.spitCd -= dt;
      if (z.spitCd > 0) continue;
      z.spitCd = every * (0.85 + Math.random() * 0.3);
      z.windup = 1;
      // Aimed at where the squad will be when it lands, at its current lane: sidestep to dodge.
      const flight = SIM.spitFlight;
      this.acid.launch(z.x, z.d, 1.3, clampX(sq.x + (Math.random() - 0.5) * 0.5), sq.d + this.speedNow * flight, flight);
      this.fx.sparks(z.x, 1.3, z.d, 0xb8f23a, 5, 3);
    }
  }

  private onAcidLand = (x: number, d: number): void => {
    const sq = this.squad;
    this.fx.burst(x, 0.4, d, 0xb8f23a, 16, 5);
    this.fx.ring(x, d, SIM.spitSplash * 1.15, 0x9be22a, 0.4);
    if (this.phase !== 'run' && this.phase !== 'boss') return;
    // Soldiers inside the splash melt: the share of the drawn blob inside the circle.
    const r2 = (SIM.spitSplash + 0.15) * (SIM.spitSplash + 0.15);
    let inside = 0;
    for (let i = 0; i < sq.rendered; i++) {
      sq.soldierAt(i, this.tmpP);
      const dx = this.tmpP.x - x;
      const dd = this.tmpP.d - d;
      if (dx * dx + dd * dd <= r2) inside++;
    }
    if (inside === 0) {
      if (Math.abs(sq.d - d) < 6) this.fx.float(x, 1.4, d, 'DODGED!', 'info');
      return;
    }
    const frac = inside / Math.max(1, sq.rendered);
    const n = Math.max(1, Math.min(Math.ceil(sq.count * this.def.spit.maxShare), Math.round(sq.count * frac * 0.45)));
    this.loseSoldiers(n, x, d, 'acid');
    this.fx.addShake(0.2);
    sfx.hit();
  };

  /** The squad crosses a hazard: soldiers standing in its danger zone right now are lost. */
  private crossHazard(h: HazardView): void {
    const sq = this.squad;
    let inside = 0;
    for (let i = 0; i < sq.rendered; i++) {
      sq.soldierAt(i, this.tmpP);
      if (this.tmpP.x >= h.x0 && this.tmpP.x <= h.x1) inside++;
    }
    if (inside === 0) {
      this.fx.float(sq.x, 2.2, sq.d + 1, 'CLEAR!', 'good');
      return;
    }
    const frac = inside / Math.max(1, sq.rendered);
    const n = Math.max(1, Math.round(sq.count * frac * h.bite));
    const hx = Math.max(h.x0, Math.min(h.x1, sq.x));
    this.loseSoldiers(n, hx, h.d, 'hazard');
    for (let k = 0; k < 4; k++) this.fx.sparks(hx + (Math.random() - 0.5) * 2, 0.6, h.d, 0xffe0a0, 5, 5);
    this.fx.addShake(0.35);
    this.fx.screenFlash('red');
    sfx.gateBad();
  }

  // ------------------------------------------------------------------------------------------
  private startBoss(): void {
    this.phase = 'boss';
    const def = this.def;
    let bossDef: BossDef = def.boss;
    if (this.params.intro) {
      // Sized to the squad the player actually brought: a ~6 s showdown, never a wall.
      const hp = Math.round(Math.max(900, Math.min(9000, this.dps() * 6.5 + this.helpers.count * 200)) / 100) * 100;
      bossDef = { ...def.boss, hp };
    } else {
      const k = this.hordeScale(this.squad.d, 1, 1.3);
      if (Math.abs(k - 1) > 0.02) bossDef = { ...def.boss, hp: Math.round((def.boss.hp * k) / 100) * 100 };
    }
    this.boss = new BossView(bossDef, this.squad.d + SIM.bossSpawn, this.quality === 'high');
    this.boss.x = 0;
    this.scene.add(this.boss.group);
    runHud.banner.value = { text: bossDef.big ? `WARNING: ${bossDef.name}` : `BOSS: ${bossDef.name}`, kind: 'boss', key: nextKey() };
    runHud.boss.value = { name: bossDef.name, hp: bossDef.hp, max: bossDef.hp, big: bossDef.big };
    this.fx.addShake(0.6);
    sfx.explode();
    this.minionT = def.boss.minionEvery;
    // Clear leftover gates/barrels so the arena is clean.
    for (const g of this.gates) if (g.active && g.fading === 0) g.pass(false);
  }

  private updateBoss(dt: number): void {
    const boss = this.boss!;
    const wasEnter = boss.state === 'enter';
    // The boss stops at the front edge of the blob, not its centre.
    const smashed = boss.update(dt, this.simT, this.squad.x, this.squad.d + this.squad.depth);
    if (wasEnter && boss.state !== 'enter') {
      this.fx.explosion(boss.x, boss.d, 2.5);
      this.fx.addShake(0.4);
    }
    if (smashed && (this.phase === 'boss' || this.phase === 'run')) {
      const fd = boss.d - boss.reach * 0.8;
      this.fx.explosion(boss.x, fd, 2.8);
      this.fx.ring(boss.x, fd, 4, 0xff7040, 0.5);
      this.fx.addShake(0.75);
      this.fx.screenFlash('red');
      sfx.explode();
      this.loseSoldiers(clampI(this.squad.count * 0.11, 2, boss.smash), this.squad.x, this.squad.d, 'boss');
    }
    if (boss.state === 'walk' && this.def.boss.minionEvery > 0 && this.phase === 'boss') {
      this.minionT -= dt;
      if (this.minionT <= 0) {
        this.minionT = this.def.boss.minionEvery;
        for (let i = 0; i < 3; i++) {
          this.horde.spawn('runner', Math.max(-3.5, Math.min(3.5, boss.x + (i - 1) * 1.3)), boss.d - 1.5, this.def.boss.minionHp, this.def.zspeed.runner, this.def.contact.runner);
        }
      }
    }
    // Death sequence explosions.
    if (this.bossExplosions > 0) {
      this.bossExplodeT -= dt;
      if (this.bossExplodeT <= 0) {
        this.bossExplodeT = 0.12;
        this.bossExplosions--;
        const s = boss.scale;
        this.fx.explosion(boss.x + (Math.random() - 0.5) * 2.5 * s, boss.d + (Math.random() - 0.5) * 2 * s, 2 + Math.random() * 1.5);
        this.fx.burst(boss.x, 2 * s, boss.d, 0x9fd070, 14, 8);
        sfx.explode();
        this.fx.addShake(0.4);
      }
    }
  }

  private bossKilled(): void {
    const boss = this.boss;
    if (!boss || this.phase !== 'boss') return;
    this.kills++;
    this.slowmo = 1.1;
    this.bossExplosions = 7;
    this.bossExplodeT = 0;
    this.fx.screenFlash('white');
    this.fx.addShake(1);
    this.fx.ring(boss.x, boss.d, 7, 0xffe080, 0.8);
    sfx.explode();
    runHud.boss.value = { name: boss.name, hp: 0, max: boss.max, big: boss.big };
    runHud.banner.value = { text: 'BOSS DOWN!', kind: 'good', key: nextKey() };
    // The horde breaks with its leader.
    for (let i = this.horde.list.length - 1; i >= 0; i--) this.killZombie(this.horde.list[i]);
    this.win();
  }

  private win(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'won';
    this.squad.mode = 'cheer';
    this.endTimer = 2.2;
    setTimeout(() => {
      if (this.active && this.phase === 'won') sfx.win();
    }, 900);
  }

  private fail(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'lost';
    this.squad.mode = 'stand';
    this.endTimer = 1.3;
    this.fx.screenFlash('red');
    sfx.lose();
  }

  private record(won: boolean) {
    this.recorded = true;
    return recordRun({
      level: this.params.level,
      intro: this.params.intro,
      won,
      survivors: won ? this.squad.count : 0,
      peak: this.peak,
      kills: this.kills,
    });
  }

  private finish(): void {
    if (this.recorded) return;
    const outcome = this.record(this.phase === 'won');
    runHud.boss.value = null;
    runHud.result.value = outcome;
  }

  private quit(): void {
    runHud.paused.value = false;
    if (this.params.intro) {
      this.recorded = true;
      skipIntro();
      goTo('base');
      return;
    }
    if (!this.recorded) this.record(false);
    goTo('base');
  }

  // ------------------------------------------------------------------------------------------
  private updateCaptions(dt: number): void {
    const caps = this.def.captions;
    if (this.captionT > 0) {
      this.captionT -= dt;
      if (this.captionT <= 0) runHud.caption.value = null;
    }
    if (this.nextCaption < caps.length && this.squad.d >= caps[this.nextCaption].d) {
      const c = caps[this.nextCaption++];
      runHud.caption.value = { text: c.text, key: nextKey() };
      this.captionT = c.dur;
    }
  }

  private updateCamera(dt: number): void {
    const sq = this.squad;
    if (!sq) return;
    const bossT = this.phase === 'boss' || (this.boss && this.phase === 'won') ? 1 : 0;
    this.camBoss += (bossT - this.camBoss) * Math.min(1, dt * 1.5);
    const k = this.camScale * (1 + this.camBoss * 0.12);
    const cx = sq.x * 0.4;
    const sh = this.fx ? this.fx.shake : 0;
    const sx = sh ? (Math.random() - 0.5) * sh * 0.9 : 0;
    const sy = sh ? (Math.random() - 0.5) * sh * 0.7 : 0;
    this.camera.position.set(cx + sx, 12.2 * k + sy, -(sq.d - 10.8 * k));
    this.lookAt.set(cx * 0.8 + sx * 0.3, 0, -(sq.d + 7.6 * k + this.camBoss * 3));
    this.camera.lookAt(this.lookAt);
    // Sun + shadow frustum follow the squad.
    this.sun.position.set(sq.x - 7, 18, -(sq.d - 4));
    this.sun.target.position.set(sq.x, 0, -(sq.d + 8));
  }

  private updateLabels(): void {
    if (!this.overlay || !this.countEl || !this.countNum) return;
    const w = engine.width;
    const h = engine.height;
    const sq = this.squad;
    const v = this.tmpV;
    // Count label above the blob.
    v.set(sq.x, 1.35, -(sq.d + sq.depth * 0.5)).project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * h - 6;
    this.countEl.style.left = sx.toFixed(1) + 'px';
    this.countEl.style.top = sy.toFixed(1) + 'px';
    if (sq.count !== this.shownCount) {
      this.shownCount = sq.count;
      this.countNum.textContent = String(sq.count);
      this.countEl.classList.toggle('dead', sq.count <= 0);
    }
    // Barrel labels.
    for (const b of this.barrels) {
      if (!b.active) continue;
      const ahead = b.d - sq.d;
      v.set(b.x, 2.1, -b.d).project(this.camera);
      const vis = v.z < 1 && ahead < 75;
      const alpha = ahead > 55 ? Math.max(0, 1 - (ahead - 55) / 20) : 1;
      if (b.reward === 'heal') b.setPreview(this.healAmount(b.amount));
      b.placeLabel((v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, vis, alpha);
    }
  }
}

function fmtNum(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}

export type { FloatKind };
