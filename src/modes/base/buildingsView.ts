// OWNER: base agent. 3D views of placed buildings + empty plot pads: model per level (rebuilt when the
// level changes), construction overlays, foundations/ghosts for level 0, hit boxes, selection ring.
import * as THREE from 'three';
import { animateModel, buildingModel, constructionModel, emptyPlotGeometry, vcMaterial } from '../../three/models';
import type { GameState } from '../../core/store';
import type { BuildingType } from '../../core/types';
import type { BuildingState } from '../../state/base';
import { PLOTS, plotDef, type PlotDef } from '../../data/buildings';
import { plotUnlocked } from '../../systems/buildings';
import { PartList, buildParts } from './geo';
import { removeAnchor, setAnchor } from './anchors';

export interface BuildingView {
  uid: string;
  type: BuildingType;
  plot: PlotDef;
  root: THREE.Group;
  model: THREE.Group | null;
  modelLevel: number;
  construction: THREE.Group | null;
  foundation: THREE.Mesh | null;
  hit: THREE.Mesh;
  height: number;
  footprint: number;
  bounce: number;
  /** Level-0 construction progress target (for the rising animation). */
  rising: boolean;
  /** Model is the translucent blueprint (level 0, not started). */
  ghost: boolean;
}

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
const HIT_GEOM = new THREE.BoxGeometry(1, 1, 1);
HIT_GEOM.translate(0, 0.5, 0);

let ghostMat: THREE.MeshBasicMaterial | null = null;
function ghostMaterial(): THREE.MeshBasicMaterial {
  if (!ghostMat) ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.32, depthWrite: false });
  return ghostMat;
}

const foundationCache = new Map<number, THREE.BufferGeometry>();
function foundationGeometry(fp: number): THREE.BufferGeometry {
  const k = Math.round(fp * 10);
  let g = foundationCache.get(k);
  if (!g) {
    const p = new PartList();
    const s = fp + 0.6;
    p.slab(0xbdb6a6, 0, 0, 0, s, 0.22, s);
    // Survey stakes & warning tape.
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      p.slab(0xe0a030, (x * s) / 2, 0.2, (z * s) / 2, 0.14, 0.8, 0.14);
    }
    p.slab(0xffd23a, 0, 0.72, -s / 2, s, 0.06, 0.04);
    p.slab(0xffd23a, 0, 0.72, s / 2, s, 0.06, 0.04);
    p.slab(0xffd23a, -s / 2, 0.72, 0, 0.04, 0.06, s);
    p.slab(0xffd23a, s / 2, 0.72, 0, 0.04, 0.06, s);
    p.slab(0x8a8272, -s * 0.25, 0.22, s * 0.2, 0.9, 0.4, 0.6);
    foundationCache.set(k, (g = buildParts(p)));
  }
  return g;
}

/** Empty plot pads: the art kit's cleared lot for outpost plots, tilled soil rows for resource plots. */
function padGeometry(kind: 'core' | 'res'): THREE.BufferGeometry {
  if (kind === 'core') return emptyPlotGeometry();
  const p = new PartList();
  const s = 3.5;
  p.slab(0x9a7a52, 0, 0, 0, s, 0.1, s);
  for (let i = -1.25; i <= 1.26; i += 0.625) p.slab(0x7e623f, i, 0.1, 0, 0.26, 0.06, s - 0.45);
  for (const a of [-1, 1]) {
    p.slab(0xd8d2c0, a * (s / 2 - 0.06), 0, 0, 0.12, 0.16, s);
    p.slab(0xd8d2c0, 0, 0, a * (s / 2 - 0.06), s, 0.16, 0.12);
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) p.slab(0x6fb04a, a * 1.2, 0.1, b * 1.3, 0.35, 0.22, 0.35);
  return buildParts(p);
}

function setShadows(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

const tmpBox = new THREE.Box3();

export class BuildingViews {
  readonly group = new THREE.Group();
  readonly views = new Map<string, BuildingView>();
  readonly hits: THREE.Object3D[] = [];
  private pads: Record<'core' | 'res', THREE.InstancedMesh>;
  private selRing: THREE.Mesh;
  private selUid: string | null = null;
  private m4 = new THREE.Matrix4();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Plot ids currently shown as empty pads. */
  readonly emptyPlots = new Set<number>();

  constructor() {
    this.pads = {
      core: new THREE.InstancedMesh(padGeometry('core'), vcMaterial(), PLOTS.length),
      res: new THREE.InstancedMesh(padGeometry('res'), vcMaterial(), PLOTS.length),
    };
    for (const m of Object.values(this.pads)) {
      m.receiveShadow = true;
      m.count = 0;
      this.group.add(m);
    }
    const rg = new THREE.RingGeometry(0.82, 1, 48);
    rg.rotateX(-Math.PI / 2);
    this.selRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.selRing.visible = false;
    this.selRing.renderOrder = 7;
    this.group.add(this.selRing);
  }

  /** Reconciles views with the game state. Returns true if the layout changed. */
  sync(s: GameState, t: number, visibleCleared: number): boolean {
    let changed = false;
    const seen = new Set<string>();
    for (const b of s.base.buildings) {
      seen.add(b.uid);
      let v = this.views.get(b.uid);
      if (!v || v.plot.id !== b.plot) {
        if (v) this.removeView(v);
        v = this.createView(b);
        changed = true;
      }
      if (this.updateView(v, b, t)) changed = true;
    }
    for (const [uid, v] of this.views) {
      if (!seen.has(uid)) {
        this.removeView(v);
        changed = true;
      }
    }
    // Empty plot pads.
    const occupied = new Set(s.base.buildings.map((b) => b.plot));
    const nextEmpty = new Set<number>();
    for (const p of PLOTS) {
      if (p.kind !== 'core' && p.kind !== 'res') continue;
      if (!occupied.has(p.id) && plotUnlocked(s, p.id) && p.district <= visibleCleared) nextEmpty.add(p.id);
    }
    let padsChanged = nextEmpty.size !== this.emptyPlots.size;
    if (!padsChanged) for (const id of nextEmpty) if (!this.emptyPlots.has(id)) padsChanged = true;
    if (padsChanged) {
      for (const id of this.emptyPlots) if (!nextEmpty.has(id)) removeAnchor('p:' + id);
      this.emptyPlots.clear();
      // Compact visible pads into the first instances so hidden ones cost nothing.
      const n = { core: 0, res: 0 };
      for (const p of PLOTS) {
        if (!nextEmpty.has(p.id)) continue;
        this.emptyPlots.add(p.id);
        setAnchor('p:' + p.id, p.x, 0.2, p.z + 0.6);
        const kind = p.kind as 'core' | 'res';
        this.m4.makeTranslation(p.x, 0.12, p.z);
        this.pads[kind].setMatrixAt(n[kind]++, this.m4);
      }
      for (const kind of ['core', 'res'] as const) {
        const m = this.pads[kind];
        m.count = n[kind];
        m.visible = n[kind] > 0;
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
      }
      changed = true;
    }
    return changed;
  }

  private createView(b: BuildingState): BuildingView {
    const plot = plotDef(b.plot) ?? { id: b.plot, x: 0, z: 0, kind: 'core', district: 0 };
    const root = new THREE.Group();
    root.position.set(plot.x, 0.12, plot.z);
    const hit = new THREE.Mesh(HIT_GEOM, HIT_MAT);
    hit.userData.uid = b.uid;
    root.add(hit);
    this.group.add(root);
    this.hits.push(hit);
    const v: BuildingView = {
      uid: b.uid,
      type: b.type,
      plot,
      root,
      model: null,
      modelLevel: -1,
      construction: null,
      foundation: null,
      hit,
      height: 3,
      footprint: b.type === 'hq' ? 6 : 3.6,
      bounce: 0,
      rising: false,
      ghost: false,
    };
    this.views.set(b.uid, v);
    return v;
  }

  private removeView(v: BuildingView): void {
    this.group.remove(v.root);
    const i = this.hits.indexOf(v.hit);
    if (i >= 0) this.hits.splice(i, 1);
    this.views.delete(v.uid);
    removeAnchor('b:' + v.uid);
    removeAnchor('bl:' + v.uid);
  }

  private updateView(v: BuildingView, b: BuildingState, t: number): boolean {
    let changed = false;
    const upgrading = b.upgradeEndsAt !== null;
    if (v.modelLevel !== b.level) {
      changed = true;
      if (v.model) v.root.remove(v.model);
      v.model = null;
      if (v.foundation) {
        v.root.remove(v.foundation);
        v.foundation = null;
      }
      const lv = Math.max(1, b.level);
      const model = buildingModel(b.type, lv);
      setShadows(model);
      v.ghost = b.level === 0 && !upgrading;
      if (v.ghost) {
        // Blueprint ghost of the future building.
        model.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.material = ghostMaterial();
            m.castShadow = false;
          }
        });
      }
      v.model = model;
      v.modelLevel = b.level;
      v.root.add(model);
      // Measure (at full scale).
      v.root.updateMatrixWorld(true);
      tmpBox.setFromObject(model);
      const sx = tmpBox.max.x - tmpBox.min.x;
      const sz = tmpBox.max.z - tmpBox.min.z;
      v.height = Math.max(1.5, tmpBox.max.y - v.root.position.y);
      v.footprint = Math.max(2.5, Math.min(8, Math.max(sx, sz) || v.footprint));
      v.hit.scale.set(v.footprint, v.height, v.footprint);
      if (b.level === 0) {
        v.foundation = new THREE.Mesh(foundationGeometry(v.footprint), vcMaterial());
        v.foundation.receiveShadow = true;
        v.root.add(v.foundation);
      }
    }
    // Ghost vs real model for level 0 when construction starts/stops.
    if (b.level === 0 && v.model) {
      if (v.ghost !== !upgrading) {
        v.modelLevel = -1;
        return this.updateView(v, b, t) || true;
      }
    }
    v.rising = b.level === 0 && upgrading;
    // Construction overlay.
    if (upgrading && !v.construction) {
      const c = constructionModel();
      setShadows(c);
      const k = Math.max(0.9, Math.min(1.8, v.footprint / 3.6));
      c.scale.setScalar(k);
      v.construction = c;
      v.root.add(c);
      changed = true;
    } else if (!upgrading && v.construction) {
      v.root.remove(v.construction);
      v.construction = null;
      changed = true;
    }
    if (changed) {
      const x = v.plot.x;
      const z = v.plot.z;
      setAnchor('b:' + v.uid, x, v.height + 0.7, z);
      setAnchor('bl:' + v.uid, x + v.footprint * 0.3, 0.4, z + v.footprint * 0.52);
      if (this.selUid === v.uid) this.placeSelRing(v);
    }
    return changed;
  }

  /** Per-frame animation: construction rising, bounces, selection pulse. */
  update(dt: number, t: number, s: GameState): void {
    for (const v of this.views.values()) {
      if (!v.model) continue;
      let sy = 1;
      if (v.rising) {
        const b = s.base.buildings.find((x) => x.uid === v.uid);
        if (b && b.upgradeEndsAt !== null && b.upgradeStartedAt !== null) {
          const p = THREE.MathUtils.clamp((t - b.upgradeStartedAt) / Math.max(1, b.upgradeEndsAt - b.upgradeStartedAt), 0, 1);
          sy = 0.12 + 0.88 * p;
        }
      }
      let sxz = 1;
      if (v.bounce > 0) {
        v.bounce = Math.max(0, v.bounce - dt);
        const k = 1 - v.bounce / 0.45;
        const w = Math.sin(k * Math.PI * 2) * (1 - k) * 0.12;
        sy *= 1 + w;
        sxz = 1 - w * 0.5;
      }
      v.model.scale.set(sxz, sy, sxz);
      animateModel(v.model, dt, t / 1000);
      if (v.construction) animateModel(v.construction, dt, t / 1000);
    }
    if (this.selRing.visible) {
      const mat = this.selRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 5) * 0.3;
    }
  }

  bounce(uid: string): void {
    const v = this.views.get(uid);
    if (v) v.bounce = 0.45;
  }

  select(uid: string | null): void {
    this.selUid = uid;
    const v = uid ? this.views.get(uid) : undefined;
    this.selRing.visible = !!v;
    if (v) this.placeSelRing(v);
  }

  private placeSelRing(v: BuildingView): void {
    const r = v.footprint * 0.72;
    this.selRing.position.set(v.plot.x, 0.3, v.plot.z);
    this.selRing.scale.set(r, 1, r);
  }

  view(uid: string): BuildingView | undefined {
    return this.views.get(uid);
  }
}
