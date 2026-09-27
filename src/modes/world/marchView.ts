// OWNER: world agent. March visuals: vehicle models travelling along animated chevron paths,
// squad labels, and a short burst effect when a battle resolves.
import * as THREE from 'three';
import type { GameState } from '../../core/store';
import { vehicleModel } from '../../three/models';
import { marchPosition, tileCenter, tileHeight, worldRev, type March, type WorldTerrain } from '../../systems/world';
import { BadgeLayer, pillBadge } from './badges';
import type { PickPoint } from './entityView';

const PATH_COLORS = { attack: 0xff5a48, gather: 0x5ee06e, dig: 0xffc84a, back: 0x6ab8ff } as const;
const MAX_BURSTS = 4;

interface Item {
  march: March;
  pick: PickPoint;
  veh: THREE.Group;
  path: THREE.Mesh;
  phase: string;
  legStart: number;
}

function chevronTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 32);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 12, 64, 8);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(18, 3);
  g.lineTo(40, 16);
  g.lineTo(18, 29);
  g.lineTo(26, 16);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class MarchView {
  readonly group = new THREE.Group();
  readonly picks: PickPoint[] = [];
  private items = new Map<string, Item>();
  private tex = chevronTexture();
  private mats = new Map<string, THREE.MeshBasicMaterial>();
  private labels = new BadgeLayer();
  private rev = -1;
  private tmp = { x: 0, z: 0 };
  private tmpT = { x: 0, z: 0 };
  private labelDraws = new Map<number, ReturnType<typeof pillBadge>>();
  private bursts: { mesh: THREE.Mesh; t: number }[] = [];
  private burstIdx = 0;

  constructor(private terrain: WorldTerrain) {
    this.labels.mesh.renderOrder = 21;
    this.group.add(this.labels.mesh);
    const bg = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < MAX_BURSTS; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 7;
      this.group.add(m);
      this.bursts.push({ mesh: m, t: 99 });
    }
  }

  private mat(key: keyof typeof PATH_COLORS): THREE.MeshBasicMaterial {
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ map: this.tex, color: PATH_COLORS[key], transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      this.mats.set(key, m);
    }
    return m;
  }

  private pathMesh(m: March): THREE.Mesh {
    const ax = m.fromX;
    const az = m.fromZ;
    const bx = m.toX;
    const bz = m.toZ;
    const len = Math.max(0.01, Math.hypot(bx - ax, bz - az));
    const nx = (-(bz - az) / len) * 0.55;
    const nz = ((bx - ax) / len) * 0.55;
    const y = 0.3;
    const rep = len / 1.7;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([ax + nx, y, az + nz, bx + nx, y, bz + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz], 3),
    );
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, rep, 1, 0, 0, rep, 0], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const key = m.phase === 'back' ? 'back' : m.kind;
    const mesh = new THREE.Mesh(g, this.mat(key));
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    return mesh;
  }

  sync(s: GameState): void {
    if (this.rev === worldRev.marches && !this.labels.stale) return;
    this.rev = worldRev.marches;
    this.labels.stale = false;
    const alive = new Set<string>();
    for (const m of s.world.marches) {
      alive.add(m.id);
      let it = this.items.get(m.id);
      if (!it) {
        const veh = vehicleModel(m.vehicle.type, m.vehicle.rarity);
        veh.scale.setScalar(0.95);
        veh.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true;
        });
        const path = this.pathMesh(m);
        this.group.add(veh, path);
        it = { march: m, pick: { id: m.id, kind: 'march', x: 0, y: 1, z: 0, r: 1.8 }, veh, path, phase: m.phase, legStart: m.legStart };
        this.items.set(m.id, it);
      } else {
        it.march = m;
        if (it.phase !== m.phase || it.legStart !== m.legStart) {
          if (it.phase === 'out' && m.phase === 'back' && m.kind === 'attack' && m.result !== 'recalled' && m.result !== 'missing') this.burst(m, m.result === 'win');
          this.group.remove(it.path);
          it.path.geometry.dispose();
          it.path = this.pathMesh(m);
          this.group.add(it.path);
          it.phase = m.phase;
          it.legStart = m.legStart;
        }
      }
      it.path.visible = m.phase !== 'work';
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      this.group.remove(it.veh, it.path);
      it.path.geometry.dispose();
      this.items.delete(id);
    }
  }

  private burst(m: March, win: boolean): void {
    const b = this.bursts[this.burstIdx++ % MAX_BURSTS];
    const c = tileCenter(m.tx, m.ty);
    b.mesh.position.set(c.x, tileHeight(this.terrain, m.tx, m.ty) + 0.8, c.z);
    (b.mesh.material as THREE.MeshBasicMaterial).color.set(win ? 0xffb040 : 0xff4040);
    b.t = 0;
    b.mesh.visible = true;
  }

  update(t: number, dt: number, time: number, uiScale: number): void {
    this.tex.offset.x -= dt * 1.4;
    this.picks.length = 0;
    this.labels.begin();
    for (const it of this.items.values()) {
      const m = it.march;
      const p = marchPosition(m, t, this.tmp);
      const v = it.veh;
      // face the direction of travel (or the target while working)
      const tc = tileCenter(m.tx, m.ty, this.tmpT);
      const dx = m.phase === 'work' ? tc.x - m.toX : m.toX - m.fromX;
      const dz = m.phase === 'work' ? tc.z - m.toZ : m.toZ - m.fromZ;
      if (dx !== 0 || dz !== 0) v.rotation.y = Math.atan2(dx, dz);
      const bob = m.phase === 'work' ? 0 : Math.abs(Math.sin(time * 9 + m.squadId)) * 0.05;
      v.position.set(p.x, 0.05 + bob, p.z);
      it.pick.x = p.x;
      it.pick.z = p.z;
      this.picks.push(it.pick);
      let draw = this.labelDraws.get(m.squadId);
      if (!draw) {
        draw = pillBadge({ text: `Squad ${m.squadId}`, bg: 'rgba(14,60,120,0.95)', border: '#8fd0ff' });
        this.labelDraws.set(m.squadId, draw);
      }
      this.labels.add(
        'sq:' + m.squadId,
        draw,
        p.x,
        2.8,
        p.z,
        3.2,
        0.8,
      );
    }
    this.labels.end();
    this.labels.setFrame(uiScale, time);
    for (const b of this.bursts) {
      if (!b.mesh.visible) continue;
      b.t += dt;
      const k = b.t / 0.9;
      if (k >= 1) {
        b.mesh.visible = false;
        continue;
      }
      b.mesh.scale.setScalar(0.6 + k * 3.2);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
    }
  }

  /** Current world position of a march (for camera follow). */
  positionOf(id: string, t: number, out: { x: number; z: number }): boolean {
    const it = this.items.get(id);
    if (!it) return false;
    marchPosition(it.march, t, out);
    return true;
  }

  dispose(): void {
    for (const it of this.items.values()) it.path.geometry.dispose();
    this.items.clear();
    for (const m of this.mats.values()) m.dispose();
    this.tex.dispose();
    this.labels.dispose();
    for (const b of this.bursts) (b.mesh.material as THREE.Material).dispose();
    this.bursts[0]?.mesh.geometry.dispose();
  }
}
