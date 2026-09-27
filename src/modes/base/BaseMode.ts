// OWNER: base agent. 3D scene for the 'base' mode. Implements GameMode (see src/three/engine.ts).
// Sunny low-poly outpost: walled compound with HQ, plots and ambient life, surrounded by zombie districts.
import * as THREE from 'three';
import { engine, type GameMode } from '../../three/engine';
import { game, mutate, version } from '../../core/store';
import { now } from '../../core/tick';
import { baseFocus, openScreen, route, screens, toast, type BaseFocusRequest } from '../../core/nav';
import { on } from '../../core/events';
import { sfx } from '../../core/audio';
import { districtsCleared, isUnlocked, unlockHint } from '../../core/unlocks';
import { BUILDINGS, DISTRICTS, buildingName, plotDef } from '../../data/buildings';
import {
  bubbleThreshold,
  buildingLevel,
  buildingsOf,
  freePlotsFor,
  getBuilding,
  maxCount,
  nextInstanceRule,
  ruleText,
  uncollected,
} from '../../systems/buildings';
import { CameraRig } from './camera';
import { Environment } from './env';
import { DistrictLayer } from './districts';
import { Life } from './life';
import { BuildingViews } from './buildingsView';
import { Effects } from './effects';
import { layoutVersion, projectAnchors, sceneBusy, selection, setAnchor, shownCleared, zoomedOut } from './anchors';
import { doCollect, sceneHooks } from './actions';
import { contextEpoch } from '../world/gpuMemory';

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
/** The sun (and its shadow frustum) follows the camera in steps of this many units. */
const SHADOW_SNAP = 8;
/** Half-size of the shadow frustum around the snapped camera target. */
const SHADOW_EXT = 56;

export class BaseMode implements GameMode {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(44, 1, 0.5, 700);
  private rig = new CameraRig(this.camera);
  private env: Environment;
  private districts: DistrictLayer;
  private life: Life;
  private views = new BuildingViews();
  private fx = new Effects();
  private sun: THREE.DirectionalLight;
  private quality: 'low' | 'high';
  private lastVersion = -1;
  private active = false;
  private width = 1;
  private height = 1;
  private pendingFocus: BaseFocusRequest | null = null;
  private handledFocusT = 0;
  private pendingReveal = 0;
  private revealDelay = 0;
  private lastSel: string | null = null;
  private pickables: THREE.Object3D[] = [];
  private vehicleHits: THREE.Mesh[] = [];
  private tmp = new THREE.Vector3();
  // Static shadows: the map is re-rendered only when the layout, the snapped frustum or an animation needs it.
  private shX = NaN;
  private shZ = NaN;
  private shadowTick = 0;
  private builtEpoch = contextEpoch();
  private districtRev = -1;

  constructor() {
    this.quality = game.settings.quality;
    this.scene.background = new THREE.Color(0xa6d8ee);
    this.scene.fog = new THREE.Fog(0xb9def0, 150, 300);
    this.scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x7a8a5c, 1.5));
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = this.quality === 'high';
    this.sun.shadow.mapSize.set(1024, 1024);
    // Nothing that moves every frame casts (walkers use blob shadows, the flag doesn't cast), so the shadow
    // map is static: see requestShadows().
    this.sun.shadow.autoUpdate = false;
    const sc = this.sun.shadow.camera;
    sc.left = -SHADOW_EXT;
    sc.right = SHADOW_EXT;
    sc.top = SHADOW_EXT;
    sc.bottom = -SHADOW_EXT;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.env = new Environment(this.quality);
    this.scene.add(this.env.group);
    const cleared = districtsCleared(game);
    this.districts = new DistrictLayer(this.quality, Math.min(cleared, game.base.districtsSeen ?? 0));
    this.scene.add(this.districts.group);
    this.life = new Life(this.quality);
    this.scene.add(this.life.group);
    this.scene.add(this.views.group, this.fx.group);
    this.makeVehicleHits();

    // Static anchors.
    for (const d of DISTRICTS) setAnchor('d:' + d.id, d.x, 3.5, d.z);

    this.rig.onTap = (x, y) => this.onTap(x, y);
    this.rig.jumpTo(0, 8, 78);

    baseFocus.subscribe((req) => {
      if (req && req.t !== this.handledFocusT) this.pendingFocus = req;
    });
    on('building:upgraded', ({ uid }) => this.celebrate(uid));
    sceneHooks.bounce = (uid) => this.views.bounce(uid);
    sceneHooks.celebrate = (uid) => this.celebrate(uid);
    if (import.meta.env.DEV) Object.assign(window as any, { __base: this, __engine: engine }); // dev-only inspection hooks
    sceneHooks.focusUid = (uid) => {
      this.syncState();
      const v = this.views.view(uid);
      if (v) {
        this.rig.focusOn(v.plot.x, v.plot.z + 2, Math.min(this.rig.dist, 60));
        this.select(uid);
      }
    };
  }

  private makeVehicleHits(): void {
    for (const [obj, id, sx, sy, sz] of [
      [this.life.specOps, 'specops', 2.6, 2.4, 3.8],
      [this.life.lootTruck, 'loot', 2.8, 2.6, 4.8],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), HIT_MAT);
      m.position.copy(obj.position);
      m.position.y += sy / 2;
      m.rotation.y = obj.rotation.y;
      m.userData.vehicle = id;
      this.scene.add(m);
      this.vehicleHits.push(m);
    }
    setAnchor('v:specops', this.life.specOps.position.x, 3.0, this.life.specOps.position.z);
    setAnchor('v:loot', this.life.lootTruck.position.x, 3.4, this.life.lootTruck.position.z);
  }

  enter(_params: any): void {
    this.active = true;
    this.rig.attach(engine.canvas);
    this.applyQuality();
    this.syncState(true);
    this.requestShadows();
  }

  /** Re-render the (otherwise static) shadow map on the next frame. */
  private requestShadows(): void {
    this.sun.shadow.needsUpdate = true;
  }

  exit(): void {
    this.active = false;
    this.rig.detach(engine.canvas);
    selection.value = null;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.rig.resize(w, h);
  }

  private applyQuality(): void {
    const q = game.settings.quality;
    if (q === this.quality) return;
    this.quality = q;
    this.sun.castShadow = q === 'high';
    // Crowd sizes depend on quality: rebuild the ambient layers.
    this.scene.remove(this.life.group, this.districts.group);
    this.life.dispose();
    this.districts.dispose();
    this.life = new Life(q);
    this.districts = new DistrictLayer(q, this.districts.cleared);
    this.scene.add(this.life.group, this.districts.group);
    this.requestShadows();
  }

  /** Pushes game state into the scene (called when the store version changes). */
  private syncState(force = false): void {
    const v = version.peek();
    if (!force && v === this.lastVersion) return;
    this.lastVersion = v;
    const settled = this.districts.revealing ? this.districts.cleared - 1 : this.districts.cleared;
    if (this.views.sync(game, now(), settled)) {
      layoutVersion.value++;
      this.requestShadows();
    }
    const wall = buildingLevel(game, 'wall');
    if (this.env.setWallTier(wall >= 10 ? 2 : wall >= 5 ? 1 : 0)) this.requestShadows();
    this.pickables = [...this.views.hits, ...this.vehicleHits];
  }

  private select(uid: string | null): void {
    const key = uid ? 'b:' + uid : null;
    selection.value = key;
    this.applySelection();
  }

  private applySelection(): void {
    const key = selection.value;
    if (key === this.lastSel) return;
    this.lastSel = key;
    const uid = key && key.startsWith('b:') ? key.slice(2) : null;
    this.views.select(uid);
    const v = uid ? this.views.view(uid) : undefined;
    if (v) setAnchor('sel', v.plot.x, 0.2, v.plot.z + v.footprint * 0.55 + 0.6);
  }

  private celebrate(uid: string): void {
    const v = this.views.view(uid);
    if (!v) return;
    this.views.bounce(uid);
    if (!this.active) return;
    this.fx.pillar(v.plot.x, v.plot.z, v.footprint * 0.6, v.height + 6);
    this.fx.burst(v.plot.x, v.height * 0.6, v.plot.z, 0xffd84a, 46, v.footprint, 7);
    this.fx.ring(v.plot.x, v.plot.z, v.footprint * 0.9, 0xffe07a, 1.2);
  }

  // ---- input ----
  private onTap(x: number, y: number): void {
    if (this.districts.revealing || this.pendingReveal) return;
    const ray = this.rig.raycaster(x, y);
    const hits = ray.intersectObjects(this.pickables, false);
    for (const h of hits) {
      const uid = h.object.userData.uid as string | undefined;
      if (uid) return this.tapBuilding(uid);
      const veh = h.object.userData.vehicle as string | undefined;
      if (veh) return this.tapVehicle(veh);
    }
    if (!this.rig.groundAt(x, y, this.tmp)) return;
    // Empty plot pad?
    for (const id of this.views.emptyPlots) {
      const p = plotDef(id)!;
      if (Math.abs(p.x - this.tmp.x) < 2.3 && Math.abs(p.z - this.tmp.z) < 2.3) {
        sfx.click();
        this.fx.ring(p.x, p.z, 2.6, 0x8fe3ff, 0.6);
        openScreen('buildMenu', { plot: id });
        return;
      }
    }
    const d = this.districts.districtAt(this.tmp.x, this.tmp.z);
    if (d && d > this.districts.cleared) {
      if (d === this.districts.cleared + 1) {
        sfx.click();
        openScreen('campaign');
      } else {
        sfx.error();
        toast(`Clear District ${this.districts.cleared + 1} first`, 'bad');
      }
      return;
    }
    this.select(null);
  }

  private tapBuilding(uid: string): void {
    const b = getBuilding(game, uid);
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (def.produces && uncollected(game, b) >= bubbleThreshold(game, b)) {
      doCollect(uid);
      this.select(uid);
      return;
    }
    sfx.click();
    if ((b.level === 0 && b.upgradeEndsAt === null) || selection.value === 'b:' + uid) {
      openScreen('buildingPanel', { uid });
      return;
    }
    this.select(uid);
  }

  private tapVehicle(id: string): void {
    if (id === 'specops') {
      if (isUnlocked(game, 'runner')) {
        sfx.click();
        openScreen('runnerLevels');
      } else {
        sfx.error();
        toast(`Special Ops: ${unlockHint('runner')}`, 'bad');
      }
    } else {
      sfx.click();
      openScreen('campaign');
    }
  }

  // ---- focus requests (quest "Go" buttons, requirement links) ----
  private applyFocus(req: BaseFocusRequest): void {
    this.handledFocusT = req.t;
    this.syncState(true);
    let uid = req.uid;
    if (!uid && req.type) {
      const list = buildingsOf(game, req.type);
      // A plain "go to type" (no panel) while another copy could be built points at a free plot instead
      // (e.g. "Own 2 Farms"); otherwise pick the most advanced existing building.
      const canAdd =
        !req.openPanel &&
        list.length < maxCount(game, req.type) &&
        freePlotsFor(game, req.type).some((id) => this.views.emptyPlots.has(id));
      if (!canAdd) {
        let best: (typeof list)[number] | undefined;
        for (const b of list) if (!best || b.level > best.level) best = b;
        uid = best?.uid;
      }
    }
    if (uid) {
      const v = this.views.view(uid);
      if (!v) return;
      this.rig.focusOn(v.plot.x, v.plot.z + 2, Math.min(this.rig.dist, 56));
      this.select(uid);
      this.fx.ring(v.plot.x, v.plot.z, v.footprint * 0.9, 0xffe07a, 1.4);
      setTimeout(() => this.fx.ring(v.plot.x, v.plot.z, v.footprint * 0.9, 0xffe07a, 1.4), 450);
      this.views.bounce(uid);
      if (req.openPanel) this.afterFocus(req, () => openScreen('buildingPanel', { uid }));
      return;
    }
    if (req.type) {
      const type = req.type;
      const plots = freePlotsFor(game, type).filter((id) => this.views.emptyPlots.has(id));
      if (buildingsOf(game, type).length >= maxCount(game, type)) {
        const r = nextInstanceRule(game, type);
        toast(r ? `${buildingName(type)}: ${ruleText(r)}` : `${buildingName(type)} unavailable`, 'bad');
        return;
      }
      if (!plots.length) {
        toast('No free plot: clear more districts to reclaim land', 'bad');
        return;
      }
      const p = plotDef(plots[0])!;
      this.rig.focusOn(p.x, p.z + 2, Math.min(this.rig.dist, 56));
      this.fx.ring(p.x, p.z, 3, 0x8fe3ff, 1.4);
      setTimeout(() => this.fx.ring(p.x, p.z, 3, 0x8fe3ff, 1.4), 450);
      if (req.openPanel) this.afterFocus(req, () => openScreen('buildMenu', { plot: p.id, highlight: type }));
    }
  }

  /**
   * Runs a focus request's follow-up (opening a panel) once the camera pan has played, but only if the player is
   * still in the base, no newer focus request replaced this one and nothing else was opened meanwhile.
   */
  private afterFocus(req: BaseFocusRequest, fn: () => void): void {
    setTimeout(() => {
      if (!this.active || route.peek().mode !== 'base') return;
      if (baseFocus.peek()?.t !== req.t) return;
      if (screens.peek().length > 0) return;
      fn();
    }, 650);
  }

  // ---- district reveal ----
  private checkDistricts(dt: number): void {
    const cleared = districtsCleared(game);
    const shown = this.districts.cleared;
    if (cleared < shown && !this.districts.revealing) {
      this.districts.setCleared(cleared);
      this.syncState(true);
      return;
    }
    if (this.pendingReveal) {
      this.revealDelay -= dt;
      if (this.revealDelay <= 0) {
        const id = this.pendingReveal;
        this.pendingReveal = 0;
        const d = DISTRICTS[id - 1];
        sfx.explode();
        setTimeout(() => sfx.win(), 500);
        this.fx.burst(d.x, 2, d.z, 0xffffff, 60, 8, 6);
        this.districts.startReveal(id, () => this.onRevealed(id));
      }
      return;
    }
    if (this.districts.revealing || cleared <= shown || screens.value.length > 0) return;
    if (cleared - shown > 1) this.districts.setCleared(cleared - 1);
    const id = Math.min(cleared, DISTRICTS.length);
    if (id <= this.districts.cleared) {
      this.districts.setCleared(cleared);
      this.markSeen(cleared);
      return;
    }
    const d = DISTRICTS[id - 1];
    this.pendingReveal = id;
    this.revealDelay = 0.8;
    this.select(null);
    this.rig.focusOn(d.x, d.z + 3, 58, 0.8);
  }

  private onRevealed(id: number): void {
    const d = DISTRICTS[id - 1];
    this.fx.burst(d.x, 1, d.z, 0xffe07a, 70, 9, 8);
    this.fx.ring(d.x, d.z, 9, 0x9cff7a, 1.6);
    this.markSeen(id);
    this.syncState(true);
    toast(`District ${id} reclaimed! New land for buildings.`, 'good');
  }

  private markSeen(n: number): void {
    if ((game.base.districtsSeen ?? 0) >= n) return;
    mutate((s) => {
      s.base.districtsSeen = Math.max(s.base.districtsSeen ?? 0, n);
    });
  }

  update(dt: number, t: number): void {
    this.rig.update(dt);
    const tg = this.rig.target;
    const epoch = contextEpoch();
    if (epoch !== this.builtEpoch) {
      // WebGL context restored: rebuild the scenery whose CPU copy was released after upload
      this.builtEpoch = epoch;
      this.districts.rebuildGeometry();
      this.requestShadows();
    }
    const sx = Math.round(tg.x / SHADOW_SNAP) * SHADOW_SNAP;
    const sz = Math.round(tg.z / SHADOW_SNAP) * SHADOW_SNAP;
    if (sx !== this.shX || sz !== this.shZ) {
      this.shX = sx;
      this.shZ = sz;
      this.sun.position.set(sx - 26, 58, sz + 30);
      this.sun.target.position.set(sx, 0, sz);
      this.sun.target.updateMatrixWorld();
      this.requestShadows();
    }

    if (this.active) {
      this.syncState();
      if (this.pendingFocus) {
        const req = this.pendingFocus;
        this.pendingFocus = null;
        this.applyFocus(req);
      }
      this.checkDistricts(dt);
      this.applySelection();
    }
    const busy = this.districts.revealing || this.pendingReveal > 0;
    if (busy !== sceneBusy.peek()) sceneBusy.value = busy;
    if (shownCleared.peek() !== this.districts.cleared) shownCleared.value = this.districts.cleared;

    this.districts.update(dt, t);
    this.life.update(t);
    this.env.update(t);
    const anim = this.views.update(dt, now(), game);
    this.fx.update(dt);
    // casters that animate: bounce / district reveal every frame, slow construction rise ~3x a second
    this.shadowTick += dt;
    if (anim === 'fast' || this.districts.revealing || this.districts.geomRev !== this.districtRev) {
      this.districtRev = this.districts.geomRev;
      this.requestShadows();
    }
    else if (anim === 'slow' && this.shadowTick > 0.33) this.requestShadows();
    if (this.sun.shadow.needsUpdate) this.shadowTick = 0;

    const far = this.rig.dist > 95;
    if (far !== zoomedOut.peek()) zoomedOut.value = far;
    projectAnchors(this.camera, this.width, this.height, this.rig.moved);
  }
}
