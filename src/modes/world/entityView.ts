// OWNER: world agent. Renders world entities: instanced zombie hordes / resource tiles / radar pickups,
// rival outposts, the player's own outpost, floating badges and the selection ring.
import * as THREE from 'three';
import type { GameState } from '../../core/store';
import { fmt } from '../../core/format';
import { hashSeed } from '../../core/rng';
import { animateModel, buildingModel, flagModel, propGeometry, resourceNodeGeometry, vcMaterial, zombieGeometry } from '../../three/models';
import { hqLevel } from '../../systems/buildings';
import { totalPower } from '../../core/bonuses';
import {
  marchTargeting,
  rivalPower,
  tileCenter,
  tileHeight,
  worldRev,
  type RivalEntity,
  type WorldEntity,
  type WorldTerrain,
} from '../../systems/world';
import type { HordeVariant, ResKind } from '../../data/world';
import { BadgeLayer, glyph, pillBadge, pinBadge } from './badges';
import { cacheGeometry, campGeometry, digGeometry, wallRingGeometry } from './geo';
import { Batch, sceneryMaterial } from './terrainView';
import type { PropKind } from '../../three/models';

export interface PickPoint {
  id: string;
  kind: 'entity' | 'base' | 'march';
  x: number;
  y: number;
  z: number;
  /** Pick radius in world units. */
  r: number;
  /** Height of the floating badge (tapping the label also selects). */
  by?: number;
}

const MAX_WALKERS = 1100;
const MAX_BRUTES = 220;
const MAX_DECALS = 260;
const MAX_RES = 90;
const MAX_PICKUPS = 30;

const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

function instanced(geom: THREE.BufferGeometry, mat: THREE.Material, cap: number, shadow = true): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geom, mat, cap);
  m.count = 0;
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.frustumCulled = false; // instances are spread across the whole map
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

/** Per zombie instance animation data: x, y, z, yaw, scale, phase, rank-in-horde. */
const ZA = 7;

export class EntityView {
  readonly group = new THREE.Group();
  readonly badges = new BadgeLayer();
  readonly picks: PickPoint[] = [];
  private walkers: THREE.InstancedMesh;
  private brutes: THREE.InstancedMesh;
  private decals: THREE.InstancedMesh;
  private res: Record<ResKind, THREE.InstancedMesh>;
  private camps: THREE.InstancedMesh;
  private caches: THREE.InstancedMesh;
  private digs: THREE.InstancedMesh;
  private walkerAnim = new Float32Array(MAX_WALKERS * ZA);
  private bruteAnim = new Float32Array(MAX_BRUTES * ZA);
  private nWalkers = 0;
  private nBrutes = 0;
  private rivals = new Map<string, { group: THREE.Group; shield: THREE.Mesh; level: number }>();
  private shieldMat = new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.22, depthWrite: false });
  private shieldGeo = new THREE.SphereGeometry(5.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  /** Waving flags (animated with the art library's animateModel). */
  private flags: THREE.Object3D[] = [];
  private baseGroup = new THREE.Group();
  private baseKey = '';
  private baseSig = 0;
  private lastPower = -1;
  private baseDressingGeo: THREE.BufferGeometry | null = null;
  private ring: THREE.Mesh;
  private ringBase = 1;
  private rev = -1;
  private lastMax = -1;
  private quality: 'low' | 'high' = 'high';
  private lastShieldCheck = 0;
  selectedId: string | null = null;
  /** Visible ground rectangle (+margin): zombie instances outside it are not submitted. */
  private view = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };
  /** Zombies drawn per horde (fewer when zoomed far out). */
  private maxRank = 99;

  constructor(private terrain: WorldTerrain) {
    const mat = vcMaterial();
    this.walkers = instanced(zombieGeometry('walker'), mat, MAX_WALKERS);
    this.brutes = instanced(zombieGeometry('brute'), mat, MAX_BRUTES);
    const decalGeo = new THREE.CircleGeometry(1, 14);
    decalGeo.rotateX(-Math.PI / 2);
    const decalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
    this.decals = instanced(decalGeo, decalMat, MAX_DECALS, false);
    this.decals.receiveShadow = false;
    this.decals.renderOrder = 3;
    this.res = {
      food: instanced(resourceNodeGeometry('food'), mat, MAX_RES),
      iron: instanced(resourceNodeGeometry('iron'), mat, MAX_RES),
      gold: instanced(resourceNodeGeometry('gold'), mat, MAX_RES),
    };
    this.camps = instanced(campGeometry(), mat, MAX_PICKUPS);
    this.caches = instanced(cacheGeometry(), mat, MAX_PICKUPS);
    this.digs = instanced(digGeometry(), mat, MAX_PICKUPS);
    this.group.add(this.decals, this.walkers, this.brutes, this.res.food, this.res.iron, this.res.gold, this.camps, this.caches, this.digs);
    const ringGeo = new THREE.RingGeometry(1, 1.16, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.95, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 4;
    this.group.add(this.ring, this.baseGroup);
    this.group.add(this.badges.mesh);
  }

  setQuality(q: 'low' | 'high'): void {
    if (q !== this.quality) {
      this.quality = q;
      this.rev = -1;
    }
  }

  /** Rebuilds instance buffers / labels when the entity set changed. Cheap no-op otherwise. */
  sync(s: GameState, t: number, force = false): void {
    this.syncBase(s);
    if (!force && !this.badges.stale && this.rev === worldRev.entities && this.lastMax === s.world.maxHordeLevel) return;
    this.badges.stale = false;
    this.rev = worldRev.entities;
    this.lastMax = s.world.maxHordeLevel;
    this.nWalkers = 0;
    this.nBrutes = 0;
    let nDecals = 0;
    const nRes: Record<ResKind, number> = { food: 0, iron: 0, gold: 0 };
    let nCamps = 0;
    let nCaches = 0;
    let nDigs = 0;
    this.picks.length = 0;
    this.badges.begin();
    this.addBaseBadge(s);
    const seen = new Set<string>();
    const c = { x: 0, z: 0 };
    const low = this.quality === 'low';
    for (const e of s.world.entities) {
      tileCenter(e.tx, e.ty, c);
      const y = tileHeight(this.terrain, e.tx, e.ty);
      const h = hashSeed(e.id);
      const yaw = ((h & 1023) / 1023) * Math.PI * 2;
      switch (e.kind) {
        case 'horde': {
          const variant = e.variant;
          const walkers = variant === 'normal' ? 4 + Math.min(4, Math.floor(e.level / 6)) : variant === 'elite' ? 4 : 5;
          const nw = low ? Math.min(4, walkers) : walkers;
          const brute = variant !== 'normal';
          const R = brute ? 1.45 : 1.15;
          for (let i = 0; i < nw && this.nWalkers < MAX_WALKERS; i++) {
            const a = yaw + (i / nw) * Math.PI * 2 + (((h >> (i + 3)) & 7) - 3.5) * 0.08;
            const rr = R * (0.7 + (((h >> (i * 2)) & 3) / 3) * 0.4);
            this.pushZombie(this.walkerAnim, this.nWalkers++, c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr, a + Math.PI + ((h >> i) & 3) * 0.3, 1.65, (h >> (i * 3)) & 255, i);
          }
          if (brute && this.nBrutes < MAX_BRUTES) {
            this.pushZombie(this.bruteAnim, this.nBrutes++, c.x, y, c.z, yaw, variant === 'boss' ? 2.4 : 1.5, h & 255, 0);
          }
          if (nDecals < MAX_DECALS) {
            const ds = variant === 'boss' ? 2.8 : variant === 'elite' ? 2.4 : 2.1;
            tmpM.makeScale(ds, 1, ds).setPosition(c.x, y + 0.07, c.z);
            this.decals.setMatrixAt(nDecals, tmpM);
            this.decals.setColorAt(nDecals, tmpC.set(variant === 'boss' ? 0x4a1838 : variant === 'elite' ? 0x5a2a18 : 0x3a3a22));
            nDecals++;
          }
          const locked = e.level > s.world.maxHordeLevel + 1;
          const key = `h:${e.level}:${variant}:${locked ? 1 : 0}`;
          const top = variant === 'boss' ? 6.4 : variant === 'elite' ? 4.2 : 3.2;
          this.badges.add(key, hordeBadge(e.level, variant, locked), c.x, y + top, c.z, 5.4, 1.35);
          if (e.radarId) this.badges.add('pin:radar', pinBadge('#e8453c'), c.x, y + top + 1.3, c.z, 5.4, 1.35, 0.18);
          this.picks.push({ id: e.id, kind: 'entity', x: c.x, y: y + 1, z: c.z, r: variant === 'boss' ? 3.4 : 2.8, by: y + top });
          break;
        }
        case 'resource': {
          const n = nRes[e.res];
          if (n < MAX_RES) {
            const sc = 1.2 + e.level * 0.07;
            tmpM.makeRotationY(yaw);
            tmpS.set(sc, sc, sc);
            tmpM.scale(tmpS).setPosition(c.x, y, c.z);
            this.res[e.res].setMatrixAt(n, tmpM);
            nRes[e.res] = n + 1;
          }
          if (nDecals < MAX_DECALS) {
            tmpM.makeScale(2.1, 1, 2.1).setPosition(c.x, y + 0.06, c.z);
            this.decals.setMatrixAt(nDecals, tmpM);
            this.decals.setColorAt(nDecals, tmpC.set(e.res === 'food' ? 0x6a5020 : e.res === 'iron' ? 0x3c4046 : 0x6a5418));
            nDecals++;
          }
          const occupied = !!marchTargeting(s, e.id);
          this.badges.add(`r:${e.res}:${e.level}:${occupied ? 1 : 0}`, resourceBadge(e.res, e.level, occupied), c.x, y + 2.7, c.z, 5.4, 1.35);
          this.picks.push({ id: e.id, kind: 'entity', x: c.x, y: y + 0.8, z: c.z, r: 2.8, by: y + 2.7 });
          break;
        }
        case 'rival': {
          seen.add(e.id);
          this.syncRival(e, c.x, y, c.z, t);
          const p = rivalPower(e, t);
          this.badges.add(
            `o:${e.id}:${fmt(p)}`,
            pillBadge({
              text: `[${e.tag}] ${e.name}`,
              sub: `Power ${fmt(p)}`,
              bg: 'rgba(28,30,40,0.92)',
              border: '#' + e.color.toString(16).padStart(6, '0'),
              maxW: 250,
            }),
            c.x,
            y + 5.4,
            c.z,
            6.8,
            1.7,
          );
          this.picks.push({ id: e.id, kind: 'entity', x: c.x, y: y + 1.5, z: c.z, r: 4.2, by: y + 5.4 });
          break;
        }
        case 'pickup': {
          const mesh = e.pickup === 'survivor' ? this.camps : this.caches;
          const n = e.pickup === 'survivor' ? nCamps++ : nCaches++;
          if (n < MAX_PICKUPS) {
            tmpM.makeRotationY(yaw).setPosition(c.x, y, c.z);
            mesh.setMatrixAt(n, tmpM);
          }
          const label = e.pickup === 'survivor' ? 'Survivors' : 'Supply Drop';
          this.badges.add(
            'p:' + e.pickup,
            pillBadge({ text: label, bg: 'rgba(20,40,60,0.92)', border: '#5ab8ff', icon: glyph.star, iconBg: '#2a7ad0' }),
            c.x,
            y + 2.8,
            c.z,
            5.4,
            1.35,
          );
          this.badges.add('pin:radar', pinBadge('#e8453c'), c.x, y + 4.1, c.z, 5.4, 1.35, 0.18);
          this.picks.push({ id: e.id, kind: 'entity', x: c.x, y: y + 0.8, z: c.z, r: 2.8, by: y + 2.8 });
          break;
        }
        case 'dig': {
          if (nDigs < MAX_PICKUPS) {
            tmpM.makeRotationY(yaw).setPosition(c.x, y, c.z);
            this.digs.setMatrixAt(nDigs++, tmpM);
          }
          this.badges.add(
            'p:dig',
            pillBadge({ text: 'Dig Site', bg: 'rgba(60,40,10,0.92)', border: '#ffc93a', icon: glyph.coin, iconBg: '#b07a10' }),
            c.x,
            y + 2.6,
            c.z,
            5.4,
            1.35,
          );
          this.badges.add('pin:radar', pinBadge('#e8453c'), c.x, y + 3.9, c.z, 5.4, 1.35, 0.18);
          this.picks.push({ id: e.id, kind: 'entity', x: c.x, y: y + 0.6, z: c.z, r: 2.8, by: y + 2.6 });
          break;
        }
      }
    }
    // remove rivals that no longer exist
    for (const [id, r] of this.rivals) {
      if (!seen.has(id)) {
        this.group.remove(r.group);
        this.flags = this.flags.filter((f) => f.parent !== r.group);
        this.rivals.delete(id);
      }
    }
    this.badges.end();
    this.decals.count = nDecals;
    for (const k of ['food', 'iron', 'gold'] as ResKind[]) {
      this.res[k].count = Math.min(MAX_RES, nRes[k]);
      this.res[k].instanceMatrix.needsUpdate = true;
    }
    this.camps.count = Math.min(MAX_PICKUPS, nCamps);
    this.caches.count = Math.min(MAX_PICKUPS, nCaches);
    this.digs.count = Math.min(MAX_PICKUPS, nDigs);
    for (const m of [this.camps, this.caches, this.digs, this.decals]) m.instanceMatrix.needsUpdate = true;
    if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
    this.writeZombies(0, true);
    this.updateRing(s);
  }

  private pushZombie(arr: Float32Array, i: number, x: number, y: number, z: number, yaw: number, scale: number, phase: number, rank: number): void {
    const o = i * ZA;
    arr[o] = x;
    arr[o + 1] = y;
    arr[o + 2] = z;
    arr[o + 3] = yaw;
    arr[o + 4] = scale;
    arr[o + 5] = (phase / 255) * Math.PI * 2;
    arr[o + 6] = rank;
  }

  /** Writes zombie instance matrices; animated shuffle when `still` is false. */
  private writeZombies(time: number, still: boolean): void {
    this.writeSet(this.walkers, this.walkerAnim, this.nWalkers, time, still, 1);
    this.writeSet(this.brutes, this.bruteAnim, this.nBrutes, time, still, 0.6);
  }

  private writeSet(mesh: THREE.InstancedMesh, arr: Float32Array, n: number, time: number, still: boolean, speed: number): void {
    const v = this.view;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const o = i * ZA;
      if (arr[o + 6] >= this.maxRank) continue;
      if (arr[o] < v.minX || arr[o] > v.maxX || arr[o + 2] < v.minZ || arr[o + 2] > v.maxZ) continue;
      const ph = arr[o + 5];
      let yaw = arr[o + 3];
      let x = arr[o];
      let z = arr[o + 2];
      let y = arr[o + 1];
      if (!still) {
        yaw += Math.sin(time * 0.9 * speed + ph) * 0.35;
        const step = Math.sin(time * 1.3 * speed + ph * 1.7) * 0.12;
        x += Math.sin(yaw) * step;
        z += Math.cos(yaw) * step;
        y += Math.abs(Math.sin(time * 4 * speed + ph)) * 0.05;
      }
      const s = arr[o + 4];
      tmpM.makeRotationY(yaw);
      tmpS.set(s, s, s);
      tmpM.scale(tmpS).setPosition(x, y, z);
      mesh.setMatrixAt(k++, tmpM);
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
  }

  private syncRival(e: RivalEntity, x: number, y: number, z: number, t: number): void {
    let r = this.rivals.get(e.id);
    const lv = Math.max(1, Math.min(30, e.level));
    if (r && r.level !== lv) {
      const old = r.group;
      this.group.remove(old);
      this.flags = this.flags.filter((f) => f.parent !== old);
      r = undefined;
    }
    if (!r) {
      const g = new THREE.Group();
      const hq = buildingModel('hq', lv);
      hq.scale.setScalar(0.72);
      g.add(hq);
      const wall = new THREE.Mesh(wallRingGeometry('rival', 4.7, [Math.PI / 2], 0.34, 0.95), vcMaterial());
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
      const flag = flagModel(e.color);
      flag.position.set(3.0, 0, -3.0);
      g.add(flag);
      this.flags.push(flag);
      const shield = new THREE.Mesh(this.shieldGeo, this.shieldMat);
      shield.renderOrder = 5;
      g.add(shield);
      g.rotation.y = (hashSeed(e.id) % 4) * (Math.PI / 2);
      this.group.add(g);
      r = { group: g, shield, level: lv };
      this.rivals.set(e.id, r);
    }
    r.group.position.set(x, y, z);
    r.shield.visible = e.shieldUntil > t;
  }


  private syncBase(s: GameState): void {
    // cheap allocation-free signature first; the full rebuild only runs when buildings changed
    let sig = this.quality === 'high' ? 1 : 2;
    for (const b of s.base.buildings) sig = (sig * 31 + b.level * 17 + b.type.length + b.plot * 7) | 0;
    if (sig === this.baseSig) return;
    this.baseSig = sig;
    const hq = Math.max(1, hqLevel(s));
    const blds = s.base.buildings
      .filter((b) => b.type !== 'hq' && b.type !== 'wall' && b.level > 0)
      .sort((a, b) => b.level - a.level)
      .slice(0, 6);
    const key = hq + '|' + blds.map((b) => b.type + b.level).join(',') + '|' + this.quality;
    if (key === this.baseKey) return;
    this.baseKey = key;
    this.flags = this.flags.filter((f) => !this.baseGroup.children.includes(f));
    this.baseGroup.clear();
    const hqm = buildingModel('hq', hq);
    hqm.scale.setScalar(1.35);
    this.baseGroup.add(hqm);
    const gaps = this.terrain.roads.slice(0, 4).map((l) => Math.atan2(l[1], l[0]));
    // static dressing (wall ring, checkpoints, camp props) merged into a single mesh
    const dressing = new Batch();
    dressing.add(wallRingGeometry('base', 9.2, gaps, 0.2, 1.4), 0, 0, 0, 0, 1);
    const sand = propGeometry('sandbag');
    const barrier = propGeometry('barrier');
    for (const g of gaps) {
      const px = Math.cos(g);
      const pz = Math.sin(g);
      for (const side of [-1, 1]) dressing.add(sand, px * 10.6 - pz * side * 2.6, 0, pz * 10.6 + px * side * 2.6, -g + Math.PI / 2, 1);
      dressing.add(barrier, px * 7.4, 0, pz * 7.4, -g, 1);
    }
    // the player's actual top buildings, shrunk, around the HQ; camp props fill the gaps
    const clearOfGates = (a: number, d: number) => gaps.every((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) > d);
    let slot = 0;
    for (const b of blds) {
      let a = 0;
      for (; slot < 16; slot++) {
        a = (slot / 8) * Math.PI * 2 + Math.PI / 8;
        if (clearOfGates(a, 0.45)) break;
      }
      slot++;
      const m = buildingModel(b.type, b.level);
      m.scale.setScalar(0.42);
      m.position.set(Math.cos(a) * 6.3, 0, Math.sin(a) * 6.3);
      m.rotation.y = -a + Math.PI / 2;
      this.baseGroup.add(m);
    }
    if (this.quality === 'high') {
      const dress: [PropKind, number, number][] = [
        ['tent', 0.6, 1],
        ['container', 2.2, 1.1],
        ['tent', 3.5, 1],
        ['ammo_crate', 4.4, 1.2],
        ['container', 5.5, 1.1],
      ];
      for (let i = 0; i < dress.length && i + blds.length < 8; i++) {
        const [kind, ang, sc] = dress[i];
        const a = ang + 0.3;
        if (!clearOfGates(a, 0.5)) continue;
        dressing.add(propGeometry(kind), Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8, -a, sc);
      }
    }
    const dg = dressing.build();
    if (dg) {
      this.baseDressingGeo?.dispose();
      this.baseDressingGeo = dg;
      this.baseGroup.add(new THREE.Mesh(dg, sceneryMaterial()));
    }
    for (const [fx, fz] of [[-4.2, -4.2], [4.2, -4.2]]) {
      const f = flagModel(0x2f8fff);
      f.position.set(fx, 0, fz);
      f.scale.setScalar(1.3);
      this.baseGroup.add(f);
      this.flags.push(f);
    }    this.baseGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.rev = -1; // refresh the base badge
  }

  private addBaseBadge(s: GameState): void {
    const hq = Math.max(1, hqLevel(s));
    const pw = totalPower(s);
    this.badges.add(
      `base:${s.player.name}:${hq}:${fmt(pw)}`,
      pillBadge({ text: s.player.name || 'Commander', sub: `HQ ${hq} · Power ${fmt(pw)}`, bg: 'rgba(16,48,92,0.94)', border: '#5ab8ff', maxW: 250 }),
      0,
      8.2,
      0,
      6.8,
      1.7,
    );
    this.picks.push({ id: 'base', kind: 'base', x: 0, y: 2, z: 0, r: 7, by: 8.2 });
  }

  private updateRing(s: GameState): void {
    const id = this.selectedId;
    if (!id) {
      this.ring.visible = false;
      return;
    }
    if (id === 'base') {
      this.ring.visible = true;
      this.ring.position.set(0, 0.12, 0);
      this.ringBase = 10.5;
      return;
    }
    const e = s.world.entities.find((x) => x.id === id);
    if (!e) {
      this.ring.visible = false;
      return;
    }
    const c = tileCenter(e.tx, e.ty);
    this.ring.visible = true;
    this.ring.position.set(c.x, tileHeight(this.terrain, e.tx, e.ty) + 0.12, c.z);
    this.ringBase = e.kind === 'rival' ? 5.8 : e.kind === 'horde' && e.variant === 'boss' ? 2.9 : 2.3;
  }

  setSelected(s: GameState, id: string | null): void {
    this.selectedId = id;
    this.updateRing(s);
  }

  /** Sets the visible ground rectangle and zoom used to cull / thin zombie instances. */
  setView(minX: number, maxX: number, minZ: number, maxZ: number, dist: number): void {
    const v = this.view;
    v.minX = minX;
    v.maxX = maxX;
    v.minZ = minZ;
    v.maxZ = maxZ;
    this.maxRank = dist > 110 ? 2 : dist > 85 ? 4 : 99;
  }

  update(s: GameState, t: number, dt: number, time: number, dist: number, uiScale: number): void {
    const animate = this.quality === 'high' && dist < 95;
    this.writeZombies(time, !animate);
    if (animate) for (const f of this.flags) animateModel(f, dt, time);
    if (this.ring.visible) {
      const p = 1 + Math.sin(time * 5) * 0.06;
      this.ring.scale.setScalar(this.ringBase * p);
    }
    if (time - this.lastShieldCheck > 1) {
      this.lastShieldCheck = time;
      // the outpost badge shows headline power: refresh it when that changes
      const pw = totalPower(s);
      if (pw !== this.lastPower) {
        this.lastPower = pw;
        this.rev = -1;
      }
      for (const e of s.world.entities) {
        if (e.kind !== 'rival') continue;
        const r = this.rivals.get(e.id);
        if (r) r.shield.visible = e.shieldUntil > t;
      }
    }
    this.badges.setFrame(uiScale, time);
  }

  dispose(): void {
    this.badges.dispose();
    this.shieldGeo.dispose();
    this.baseDressingGeo?.dispose();
    this.shieldMat.dispose();
    this.decals.geometry.dispose();
    (this.decals.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    for (const m of [this.walkers, this.brutes, this.decals, this.res.food, this.res.iron, this.res.gold, this.camps, this.caches, this.digs]) m.dispose();
  }
}

// ------------------------------------------------------------------ badge styles

function hordeBadge(level: number, variant: HordeVariant, locked: boolean) {
  if (locked) {
    // still attackable later: keep the variant colour, dimmed, with a lock
    const border = variant === 'boss' ? '#a8506a' : variant === 'elite' ? '#b07a4a' : '#8a8a8a';
    return pillBadge({ text: `Lv ${level}`, bg: 'rgba(30,30,30,0.9)', border, fg: '#c8c8c8', icon: glyph.lock, iconBg: '#555' });
  }
  if (variant === 'boss')
    return pillBadge({ text: `Lv ${level}`, bg: 'rgba(60,10,30,0.94)', border: '#ff4a6a', icon: glyph.crown, iconBg: '#a01838' });
  if (variant === 'elite')
    return pillBadge({ text: `Lv ${level}`, bg: 'rgba(60,30,8,0.94)', border: '#ff9a3c', icon: glyph.skull, iconBg: '#b0501a' });
  return pillBadge({ text: `Lv ${level}`, bg: 'rgba(24,34,20,0.92)', border: '#8fd14f', icon: glyph.skull, iconBg: '#3d6a22' });
}

function resourceBadge(res: ResKind, level: number, occupied: boolean) {
  const style =
    res === 'food'
      ? { bg: 'rgba(70,52,10,0.92)', border: '#f0c040', icon: glyph.wheat, iconBg: '#b08a18' }
      : res === 'iron'
        ? { bg: 'rgba(30,40,52,0.92)', border: '#a8c0d8', icon: glyph.ore, iconBg: '#5a6a7a' }
        : { bg: 'rgba(66,48,6,0.92)', border: '#ffd23c', icon: glyph.coin, iconBg: '#c08a10' };
  return pillBadge({ text: `Lv ${level}`, sub: occupied ? 'Occupied' : undefined, ...style });
}
