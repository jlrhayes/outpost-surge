// OWNER: world agent. 3D scene for the 'world' mode. Implements GameMode (see src/three/engine.ts).
//
// Route params (all optional): goTo('world', { focus: entityId }) pans to an entity and opens its panel;
// goTo('world', { tx, ty }) pans to a tile.
import * as THREE from 'three';
import { effect } from '@preact/signals';
import type { GameMode } from '../../three/engine';
import { engine } from '../../three/engine';
import { game, mutate } from '../../core/store';
import { now } from '../../core/tick';
import { closeScreen, openScreen, screens } from '../../core/nav';
import { sfx } from '../../core/audio';
import { ensureWorld, entityById, getTerrain, tileCenter } from '../../systems/world';
import { isUnlocked } from '../../core/unlocks';
import { HALF, MAP_TILES, TILE } from '../../data/world';
import { CameraRig } from './camera';
import { buildTerrainView, type TerrainView } from './terrainView';
import { EntityView, type PickPoint } from './entityView';
import { MarchView } from './marchView';
import { camRequest, camTile, requestCam, selectedEntity, selectedMarch, WORLD_SHEETS } from './bus';
import './world.css';

const SKY = 0xb9c6b4;
const DEFAULT_DIST = 66;

export class WorldMode implements GameMode {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 1, 1200);
  private rig = new CameraRig(this.camera);
  private sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  private hemi = new THREE.HemisphereLight(0xe8f4ff, 0x7a8a5c, 1.35);
  private terrainView: TerrainView | null = null;
  private entities: EntityView | null = null;
  private marches: MarchView | null = null;
  private builtSeed = -1;
  private builtQuality: 'low' | 'high' | null = null;
  private disposers: (() => void)[] = [];
  private lastReq = 0;
  private followId: string | null = null;
  private sheetOffset = false;
  private entered = false;
  private tmpV = new THREE.Vector3();
  private tmpP = { x: 0, z: 0 };
  private viewRect = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
  private lastTileX = -1;
  private lastTileY = -1;
  private time = 0;

  constructor() {
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 120, 320);
    this.scene.add(this.hemi);
    this.sun.position.set(-40, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.rig.onTap = (x, y) => this.onTap(x, y);
    this.rig.onUserMove = () => {
      this.followId = null;
    };
  }

  private build(): void {
    const seed = game.world.seed;
    const q = game.settings.quality;
    if (this.builtSeed === seed && this.builtQuality === q) return;
    const terrain = getTerrain(seed);
    if (this.terrainView) {
      this.scene.remove(this.terrainView.group);
      this.terrainView.dispose();
    }
    this.terrainView = buildTerrainView(terrain, q);
    this.scene.add(this.terrainView.group);
    if (this.builtSeed !== seed || !this.entities || !this.marches) {
      if (this.entities) {
        this.scene.remove(this.entities.group);
        this.entities.dispose();
      }
      if (this.marches) {
        this.scene.remove(this.marches.group);
        this.marches.dispose();
      }
      this.entities = new EntityView(terrain);
      this.marches = new MarchView(terrain);
      this.scene.add(this.entities.group, this.marches.group);
    }
    this.entities.setQuality(q);
    this.builtSeed = seed;
    this.builtQuality = q;
  }

  enter(params: any): void {
    if (game.world.entities.length === 0 || game.world.genVersion === 0) mutate((s) => void ensureWorld(s, now()));
    this.build();
    this.applyQuality();
    this.rig.attach();
    if (!this.entered) {
      this.entered = true;
      this.rig.flyTo(0, 5, DEFAULT_DIST, true);
    }
    this.disposers.push(
      effect(() => {
        const r = camRequest.value;
        if (r && r.t > this.lastReq) {
          this.lastReq = r.t;
          this.followId = r.marchId ?? null;
          this.sheetOffset = !!r.sheet;
          const d = r.dist ?? this.rig.dist;
          this.rig.flyTo(r.x, r.z + (r.sheet ? this.sheetShift(d) : 0), d, !!r.instant);
        }
      }),
      effect(() => {
        const id = selectedEntity.value;
        this.entities?.setSelected(game, id);
      }),
    );
    if (params?.focus) {
      const e = entityById(game, params.focus);
      if (e) {
        const c = tileCenter(e.tx, e.ty);
        requestCam({ x: c.x, z: c.z, sheet: true });
        openScreen('worldEntity', { id: e.id });
      }
    } else if (typeof params?.tx === 'number' && typeof params?.ty === 'number') {
      const c = tileCenter(params.tx, params.ty);
      requestCam({ x: c.x, z: c.z });
    }
    this.entities?.sync(game, now(), true);
  }

  exit(): void {
    this.rig.detach();
    for (const d of this.disposers) d();
    this.disposers = [];
    this.followId = null;
    selectedEntity.value = null;
    selectedMarch.value = null;
  }

  /** How far south of a target to aim so it sits above the bottom info sheet. */
  private sheetShift(dist: number): number {
    return dist * 0.24;
  }

  private applyQuality(): void {
    const hi = game.settings.quality === 'high';
    this.sun.castShadow = hi;
    if (this.terrainView) this.terrainView.grid.visible = hi;
  }

  private onTap(cx: number, cy: number): void {
    const stack = screens.value;
    const top = stack[stack.length - 1];
    // a full-screen panel/modal is open: the map is not interactive
    if (top && !WORLD_SHEETS.has(top.id)) return;
    if (!isUnlocked(game, 'world')) return;
    const best = this.pick(cx, cy);
    // tapping the map while a sheet is open replaces (or just closes) it
    if (top) closeScreen(top.key);
    if (!best) {
      selectedEntity.value = null;
      return;
    }
    sfx.click();
    if (best.kind === 'march') {
      selectedMarch.value = best.id;
      openScreen('worldMarch', { id: best.id });
      requestCam({ x: best.x, z: best.z, marchId: best.id, sheet: true });
      return;
    }
    selectedEntity.value = best.id;
    requestCam({ x: best.x, z: best.z, sheet: true });
    openScreen('worldEntity', { id: best.id });
  }

  /** Nearest pickable (entity, march, base) to a screen point, in screen space. */
  private pick(cx: number, cy: number): PickPoint | null {
    let best: PickPoint | null = null;
    let bestD = Infinity;
    const upp = this.rig.unitsPerPixel();
    const test = (list: readonly PickPoint[], bias: number) => {
      for (const p of list) {
        let d = this.screenDist(p.x, p.y, p.z, cx, cy);
        if (p.by !== undefined) d = Math.min(d, this.screenDist(p.x, p.by, p.z, cx, cy) * 1.15);
        const lim = Math.max(34, p.r / upp);
        if (d < lim && d * bias < bestD) {
          bestD = d * bias;
          best = p;
        }
      }
    };
    if (this.marches) test(this.marches.picks, 0.8);
    if (this.entities) test(this.entities.picks, 1);
    return best;
  }

  /** Ground rectangle under the screen (+ margin) for instance culling. */
  private computeView(): void {
    const v = this.viewRect;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const w = engine.width;
    const h = engine.height;
    for (let i = 0; i < 4; i++) {
      const ok = this.rig.groundAt(i & 1 ? w : 0, i & 2 ? h : 0, this.tmpV);
      if (!ok) {
        minX = minZ = -1e9;
        maxX = maxZ = 1e9;
        break;
      }
      if (this.tmpV.x < minX) minX = this.tmpV.x;
      if (this.tmpV.x > maxX) maxX = this.tmpV.x;
      if (this.tmpV.z < minZ) minZ = this.tmpV.z;
      if (this.tmpV.z > maxZ) maxZ = this.tmpV.z;
    }
    const m = 5;
    v.minX = minX - m;
    v.maxX = maxX + m;
    v.minZ = minZ - m;
    v.maxZ = maxZ + m + 3;
    this.entities!.setView(v.minX, v.maxX, v.minZ, v.maxZ, this.rig.dist);
  }

  /** Fits the sun's shadow frustum to the visible ground; decor stops casting when zoomed far out. */
  private updateShadows(): void {
    if (!this.sun.castShadow) return;
    const v = this.viewRect;
    const cx = Math.max(-500, Math.min(500, (v.minX + v.maxX) / 2));
    const cz = Math.max(-500, Math.min(500, (v.minZ + v.maxZ) / 2));
    const ext = THREE.MathUtils.clamp(Math.max(v.maxX - v.minX, v.maxZ - v.minZ) * 0.55, 24, 120);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - ext) > 0.5) {
      sc.left = -ext;
      sc.right = ext;
      sc.top = ext;
      sc.bottom = -ext;
      sc.updateProjectionMatrix();
    }
    this.sun.position.set(cx - 40, 80, cz + 30);
    this.sun.target.position.set(cx, 0, cz);
    const cast = this.rig.dist < 100;
    if (this.terrainView && this.terrainView.decor[0] && this.terrainView.decor[0].castShadow !== cast) {
      for (const d of this.terrainView.decor) d.castShadow = cast;
    }
  }

  private screenDist(x: number, y: number, z: number, cx: number, cy: number): number {
    this.tmpV.set(x, y, z).project(this.camera);
    if (this.tmpV.z > 1) return Infinity;
    const sx = (this.tmpV.x * 0.5 + 0.5) * engine.width;
    const sy = (-this.tmpV.y * 0.5 + 0.5) * engine.height;
    return Math.hypot(sx - cx, sy - cy);
  }

  update(dt: number, elapsed: number): void {
    const s = game;
    const t = now();
    this.time = elapsed;
    if (this.builtQuality !== s.settings.quality) {
      this.build();
      this.applyQuality();
    }
    // follow a march vehicle
    if (this.followId && this.marches) {
      if (this.marches.positionOf(this.followId, t, this.tmpP)) {
        this.rig.track(this.tmpP.x, this.tmpP.z + (this.sheetOffset ? this.sheetShift(this.rig.dist) : 0), dt);
      } else this.followId = null;
    }
    this.rig.update(dt);
    const tg = this.rig.target;

    const fogNear = this.rig.dist * 1.6 + 40;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = fogNear;
    fog.far = fogNear + 220;
    if (this.entities && this.marches) {
      this.entities.sync(s, t);
      this.marches.sync(s);
      this.computeView();
      this.updateShadows();
      const uiScale = Math.pow(this.rig.dist / DEFAULT_DIST, 0.72);
      this.entities.update(s, t, dt, elapsed, this.rig.dist, uiScale);
      this.marches.update(t, dt, elapsed, uiScale);
    }
    if (this.terrainView) {
      const g = this.terrainView.grid.material as THREE.LineBasicMaterial;
      g.opacity = 0.11 * (1 - THREE.MathUtils.smoothstep(this.rig.dist, 45, 90));
      this.terrainView.grid.visible = g.opacity > 0.005 && s.settings.quality === 'high';
    }
    // coordinates readout (only publish when the tile changes)
    const cz = tg.z - (this.sheetOffset && screens.value.length ? this.sheetShift(this.rig.dist) : 0);
    const tx = Math.max(0, Math.min(MAP_TILES - 1, Math.floor((tg.x + HALF) / TILE)));
    const ty = Math.max(0, Math.min(MAP_TILES - 1, Math.floor((cz + HALF) / TILE)));
    if (tx !== this.lastTileX || ty !== this.lastTileY) {
      this.lastTileX = tx;
      this.lastTileY = ty;
      camTile.value = { tx, ty };
    }
    if (!screens.value.length && this.sheetOffset && !this.followId) this.sheetOffset = false;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // portrait phones: widen the vertical FOV a bit so the map isn't a narrow slit
    this.camera.fov = w < h ? 48 : 40;
    this.camera.updateProjectionMatrix();
  }
}

