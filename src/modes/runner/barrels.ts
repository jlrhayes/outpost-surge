// OWNER: runner agent. Barrels & crates: take real damage, show an HP number + reward icon (DOM label
// projected above the 3D model), and pay out when broken.
import * as THREE from 'three';
import { buildColored, P, vcMaterial } from '../../three/models';
import type { BarrelDef, BarrelReward } from '../../data/runner';
import { svg } from './icons';
import { reinforceCrateGeometry } from './models';

type BarrelLook = 'crate' | 'drum' | 'hazard' | 'supply' | 'reinforce';

const geoCache = new Map<BarrelLook, THREE.BufferGeometry>();
function barrelGeometry(look: BarrelLook): THREE.BufferGeometry {
  let g = geoCache.get(look);
  if (g) return g;
  switch (look) {
    case 'reinforce': // white field crate with a plus: brings back fallen soldiers
      g = reinforceCrateGeometry();
      break;
    case 'crate': // olive soldier crate
      g = buildColored([
        { geom: P.box, color: 0x6b7f3a, pos: [0, 0.6, 0], scale: [1.3, 1.2, 1.3] },
        { geom: P.box, color: 0x4f5f2a, pos: [0, 0.6, 0.66], scale: [1.36, 0.16, 0.04] },
        { geom: P.box, color: 0x4f5f2a, pos: [0, 0.2, 0.66], scale: [1.36, 0.12, 0.04] },
        { geom: P.box, color: 0x4f5f2a, pos: [0, 1.0, 0.66], scale: [1.36, 0.12, 0.04] },
        { geom: P.box, color: 0xf2efe0, pos: [0, 0.6, 0.68], scale: [0.5, 0.14, 0.02] },
        { geom: P.box, color: 0xf2efe0, pos: [0, 0.6, 0.68], scale: [0.14, 0.5, 0.02] },
        { geom: P.box, color: 0x3a3f48, pos: [0.62, 0.6, 0.62], scale: [0.12, 1.22, 0.12] },
        { geom: P.box, color: 0x3a3f48, pos: [-0.62, 0.6, 0.62], scale: [0.12, 1.22, 0.12] },
        { geom: P.box, color: 0x3a3f48, pos: [0.62, 0.6, -0.62], scale: [0.12, 1.22, 0.12] },
        { geom: P.box, color: 0x3a3f48, pos: [-0.62, 0.6, -0.62], scale: [0.12, 1.22, 0.12] },
      ]);
      break;
    case 'supply': // gold-trimmed helper crate
      g = buildColored([
        { geom: P.box, color: 0x3d5a78, pos: [0, 0.7, 0], scale: [1.7, 1.4, 1.5] },
        { geom: P.box, color: 0xffc23a, pos: [0, 0.7, 0.76], scale: [1.74, 0.18, 0.04] },
        { geom: P.box, color: 0xffc23a, pos: [0, 0.7, -0.76], scale: [1.74, 0.18, 0.04] },
        { geom: P.box, color: 0xffc23a, pos: [0, 1.42, 0], scale: [1.74, 0.06, 0.2] },
        { geom: P.box, color: 0xffc23a, pos: [0.86, 0.7, 0], scale: [0.04, 1.44, 0.2] },
        { geom: P.box, color: 0xffc23a, pos: [-0.86, 0.7, 0], scale: [0.04, 1.44, 0.2] },
        { geom: P.box, color: 0xf4f4f4, pos: [0, 1.05, 0.78], scale: [0.7, 0.3, 0.02] },
      ]);
      break;
    case 'hazard': // red explosive drum
      g = buildColored([
        { geom: P.cyl16, color: 0xd8321e, pos: [0, 0.65, 0], scale: [1.05, 1.3, 1.05] },
        { geom: P.cyl16, color: 0xffd23a, pos: [0, 0.65, 0], scale: [1.08, 0.32, 1.08] },
        { geom: P.cyl16, color: 0x8a1a10, pos: [0, 0.2, 0], scale: [1.09, 0.08, 1.09] },
        { geom: P.cyl16, color: 0x8a1a10, pos: [0, 1.1, 0], scale: [1.09, 0.08, 1.09] },
        { geom: P.cyl16, color: 0x6a1a10, pos: [0, 1.31, 0], scale: [0.95, 0.03, 0.95] },
        { geom: P.box, color: 0x222222, pos: [0, 0.65, 0.54], rot: [0, 0, 0.6], scale: [0.14, 0.34, 0.04] },
        { geom: P.box, color: 0x222222, pos: [0.2, 0.65, 0.52], rot: [0, 0, 0.6], scale: [0.14, 0.34, 0.04] },
        { geom: P.box, color: 0x222222, pos: [-0.2, 0.65, 0.52], rot: [0, 0, 0.6], scale: [0.14, 0.34, 0.04] },
      ]);
      break;
    default: // blue weapon drum
      g = buildColored([
        { geom: P.cyl16, color: 0x2f6fc0, pos: [0, 0.65, 0], scale: [1.0, 1.3, 1.0] },
        { geom: P.cyl16, color: 0xe8e8e8, pos: [0, 0.65, 0], scale: [1.03, 0.26, 1.03] },
        { geom: P.cyl16, color: 0x1a3a70, pos: [0, 0.2, 0], scale: [1.04, 0.08, 1.04] },
        { geom: P.cyl16, color: 0x1a3a70, pos: [0, 1.1, 0], scale: [1.04, 0.08, 1.04] },
        { geom: P.cyl16, color: 0x1a3a70, pos: [0, 1.31, 0], scale: [0.9, 0.03, 0.9] },
      ]);
  }
  geoCache.set(look, g);
  return g;
}

function lookFor(r: BarrelReward): BarrelLook {
  if (r === 'soldiers') return 'crate';
  if (r === 'tank' || r === 'rocket') return 'supply';
  if (r === 'explosive') return 'hazard';
  if (r === 'heal') return 'reinforce';
  return 'drum';
}

export function rewardLabel(r: BarrelReward, amount: number): string {
  switch (r) {
    case 'soldiers':
      return `+${amount}`;
    case 'rate':
      return 'RAPID FIRE';
    case 'dmg':
      return 'POWER SHOT';
    case 'multi':
      return 'MULTI-SHOT';
    case 'tank':
      return 'TANK';
    case 'rocket':
      return 'ROCKETS';
    case 'explosive':
      return 'BOOM';
    case 'heal':
      return 'REINFORCEMENTS';
  }
}

export class BarrelView {
  readonly group = new THREE.Group();
  private meshes = new Map<BarrelLook, THREE.Mesh>();
  private mesh: THREE.Mesh | null = null;
  readonly label: HTMLDivElement;
  private hpEl: HTMLElement;
  private iconEl: HTMLElement;
  active = false;
  x = 0;
  d = 0;
  hp = 0;
  maxHp = 0;
  reward: BarrelReward = 'soldiers';
  amount = 0;
  roll = false;
  private pulse = 0;
  private shownHp = -1;
  private previewN = -1;
  private previewEl: HTMLElement | null = null;
  radius = 0.8;

  constructor(overlay: HTMLElement, castShadow: boolean) {
    for (const look of ['crate', 'drum', 'hazard', 'supply', 'reinforce'] as BarrelLook[]) {
      const m = new THREE.Mesh(barrelGeometry(look), vcMaterial());
      m.castShadow = castShadow;
      m.visible = false;
      this.meshes.set(look, m);
      this.group.add(m);
    }
    this.group.visible = false;
    this.label = document.createElement('div');
    this.label.className = 'rn-barrel';
    this.label.style.display = 'none';
    this.iconEl = document.createElement('span');
    this.iconEl.className = 'rn-barrel-ic';
    this.hpEl = document.createElement('b');
    this.label.append(this.iconEl, this.hpEl);
    overlay.appendChild(this.label);
  }

  setup(b: BarrelDef): void {
    this.active = true;
    this.x = b.x;
    this.d = b.d;
    this.hp = b.hp;
    this.maxHp = b.hp;
    this.reward = b.reward;
    this.amount = b.amount;
    this.roll = b.roll;
    this.pulse = 0;
    this.shownHp = -1;
    const look = lookFor(b.reward);
    for (const [k, m] of this.meshes) m.visible = k === look;
    this.mesh = this.meshes.get(look)!;
    this.radius = look === 'supply' ? 1.0 : 0.8;
    this.group.visible = true;
    this.group.rotation.set(0, 0, 0);
    this.label.className = 'rn-barrel rn-barrel-' + b.reward;
    this.previewN = -1;
    this.iconEl.innerHTML = svg(b.reward, 22) + (b.reward === 'soldiers' ? `<i>+${b.amount}</i>` : b.reward === 'heal' ? '<i></i>' : '');
    this.previewEl = b.reward === 'heal' ? this.iconEl.querySelector('i') : null;
    this.label.style.display = 'flex';
    this.syncHp();
  }

  /** Reinforcement crates show how many fallen soldiers they would bring back right now. */
  setPreview(n: number): void {
    if (n === this.previewN || !this.previewEl) return;
    this.previewN = n;
    this.previewEl.textContent = `+${n}`;
  }

  damage(n: number): boolean {
    this.hp -= n;
    this.pulse = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      return true;
    }
    return false;
  }

  private syncHp(): void {
    const v = Math.ceil(this.hp);
    if (v !== this.shownHp) {
      this.shownHp = v;
      this.hpEl.textContent = String(v);
    }
  }

  update(dt: number, t: number): void {
    if (!this.active) return;
    // "Rolling" containers slide toward the squad with a tumbling wobble.
    if (this.roll) this.d -= dt * 2.6;
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 9);
    const s = 1.25 * (1 + this.pulse * 0.12);
    this.group.scale.set(s, s * (1 - this.pulse * 0.06), s);
    this.group.position.set(this.x, this.roll ? Math.abs(Math.sin(t * 7)) * 0.12 : 0, -this.d);
    this.group.rotation.y = Math.sin(t * 1.3 + this.x) * 0.08;
    this.group.rotation.z = this.roll ? Math.sin(t * 7) * 0.14 : 0;
    this.syncHp();
  }

  /** Position the DOM label (screen px) or hide it. */
  placeLabel(sx: number, sy: number, visible: boolean, alpha: number): void {
    if (!visible) {
      this.label.style.opacity = '0';
      return;
    }
    this.label.style.opacity = String(alpha);
    this.label.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  hide(): void {
    this.active = false;
    this.group.visible = false;
    this.label.style.display = 'none';
  }

  dispose(): void {
    this.label.remove();
  }
}
