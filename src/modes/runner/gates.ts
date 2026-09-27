// OWNER: runner agent. Gate panels: translucent half-road barriers with huge numbers drawn on a canvas
// texture. Every bullet hit raises the value (add: +1 per hit; mul/weapon: one step per `step` hits),
// so a red gate can be shot through zero to blue; the panel recolours live.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildColored, gatePostGeometry, P } from '../../three/models';
import { gateIsGood, mulStepUp, SIM, WEAPON_MAX_LEVEL, WEAPONS, type GateDef, type GateKind, type WeaponKind } from '../../data/runner';

const CW = 256;
const CH = 160;
const PANEL_W = 3.72;
const PANEL_H = 2.32;

let frameGeo: THREE.BufferGeometry | null = null;
/** Two of the art kit's gate posts (one each side of the panel) + a slim top rail, merged: 1 draw call. */
function gateFrameGeometry(): THREE.BufferGeometry {
  if (!frameGeo) {
    const post = gatePostGeometry();
    const l = post.clone().translate(-1.95, 0, 0);
    const r = post.clone().translate(1.95, 0, 0);
    const rail = buildColored([{ geom: P.box, color: 0xe9eef3, pos: [0, 2.72, 0], scale: [3.6, 0.12, 0.14] }]);
    const parts = [l, r, rail].map((g) => (g.index ? g.toNonIndexed() : g));
    // Keep only the attributes every part shares so the merge can't fail.
    const names = Object.keys(parts[0].attributes).filter((n) => parts.every((p) => p.getAttribute(n)));
    for (const p of parts) for (const n of Object.keys(p.attributes)) if (!names.includes(n)) p.deleteAttribute(n);
    frameGeo = mergeGeometries(parts, false) ?? l;
  }
  return frameGeo;
}

let panelGeo: THREE.PlaneGeometry | null = null;
let glowGeo: THREE.PlaneGeometry | null = null;

export function gateText(kind: GateKind, v: number): string {
  if (kind === 'gun') return `LV ${v}`;
  if (kind === 'add') return v >= 0 ? `+${v}` : `−${-v}`;
  if (kind === 'mul') return v > 0 ? `×${v}` : `÷${-v}`;
  return (v >= 0 ? '+' : '−') + Math.abs(v) + '%';
}

export class GateView {
  readonly group = new THREE.Group();
  private panel: THREE.Mesh;
  private frame: THREE.Mesh;
  private glow: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private panelMat: THREE.MeshBasicMaterial;
  private frameMat: THREE.MeshLambertMaterial;
  private glowMat: THREE.MeshBasicMaterial;

  active = false;
  d = 0;
  side: -1 | 1 = 1;
  kind: GateKind = 'add';
  value = 0;
  step = 1;
  weapon: WeaponKind = 'rifle';
  hits = 0;
  /** 0 = standing, >0 = fading out after the pair was passed. */
  fading = 0;
  chosen = false;
  pair: GateView | null = null;
  private pulse = 0;
  private dirty = true;
  private drawCd = 0;
  private good = true;

  constructor() {
    panelGeo ??= new THREE.PlaneGeometry(PANEL_W, PANEL_H);
    glowGeo ??= new THREE.PlaneGeometry(3.9, 1.6);
    [this.canvas, this.ctx] = (() => {
      const c = document.createElement('canvas');
      c.width = CW;
      c.height = CH;
      return [c, c.getContext('2d')!] as const;
    })();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.panelMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.panel = new THREE.Mesh(panelGeo, this.panelMat);
    this.panel.position.y = 0.3 + PANEL_H / 2;
    this.panel.renderOrder = 2;
    this.frameMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.frame = new THREE.Mesh(gateFrameGeometry(), this.frameMat);
    this.frame.castShadow = true;
    this.glowMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(0, 0.03, 0.2);
    this.group.add(this.glow, this.frame, this.panel);
    this.group.visible = false;
  }

  setup(g: GateDef): void {
    this.active = true;
    this.d = g.d;
    this.side = g.side;
    this.kind = g.kind;
    this.value = g.value;
    this.step = Math.max(1, g.step);
    this.weapon = g.weapon ?? 'rifle';
    this.hits = 0;
    this.fading = 0;
    this.chosen = false;
    this.pulse = 0;
    this.dirty = true;
    this.drawCd = 0;
    this.group.visible = true;
    this.group.position.set(g.side * SIM.laneX, 0, -g.d);
    this.group.scale.set(1, 1, 1);
    this.panelMat.opacity = 1;
    this.recolor();
    this.draw();
  }

  get isGood(): boolean {
    return gateIsGood(this.kind, this.value);
  }

  /** x-range of the panel (road coords). */
  get x0(): number {
    return this.side * SIM.laneX - PANEL_W / 2 - 0.1;
  }
  get x1(): number {
    return this.side * SIM.laneX + PANEL_W / 2 + 0.1;
  }

  /** A bullet hit. Returns true if the gate just flipped from bad to good. */
  hit(): boolean {
    const wasGood = this.isGood;
    if (this.kind === 'add') this.value += 1;
    else {
      this.hits++;
      if (this.hits >= this.step) {
        this.hits = 0;
        if (this.kind === 'mul') this.value = mulStepUp(this.value);
        else if (this.kind === 'gun') this.value = Math.min(WEAPON_MAX_LEVEL, this.value + 1);
        else this.value = Math.min(100, this.value + 1);
      }
    }
    this.pulse = 1;
    this.dirty = true;
    const flipped = !wasGood && this.isGood;
    if (flipped || wasGood !== this.isGood) this.recolor();
    return flipped;
  }

  private recolor(): void {
    this.good = this.isGood;
    const gun = this.kind === 'gun';
    const c = gun ? 0xffa820 : this.good ? 0x3aa0ff : 0xff4a3a;
    this.frameMat.color.setHex(gun ? 0xfff0c8 : this.good ? 0xd6ebff : 0xffd6cc);
    this.glowMat.color.setHex(c);
    this.dirty = true;
  }

  private draw(): void {
    const g = this.ctx;
    const good = this.good;
    g.clearRect(0, 0, CW, CH);
    // Translucent tinted fill with a brighter rim.
    const grad = g.createLinearGradient(0, 0, 0, CH);
    const gun = this.kind === 'gun';
    if (gun) {
      grad.addColorStop(0, 'rgba(255,196,70,0.66)');
      grad.addColorStop(1, 'rgba(225,110,20,0.48)');
    } else if (good) {
      grad.addColorStop(0, 'rgba(90,180,255,0.62)');
      grad.addColorStop(1, 'rgba(20,110,240,0.42)');
    } else {
      grad.addColorStop(0, 'rgba(255,110,90,0.62)');
      grad.addColorStop(1, 'rgba(220,30,30,0.42)');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, CH);
    g.strokeStyle = gun ? 'rgba(255,240,200,0.95)' : good ? 'rgba(200,235,255,0.95)' : 'rgba(255,215,205,0.95)';
    g.lineWidth = 8;
    g.strokeRect(4, 4, CW - 8, CH - 8);
    // Diagonal sheen.
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath();
    g.moveTo(CW * 0.1, 0);
    g.lineTo(CW * 0.35, 0);
    g.lineTo(CW * 0.1, CH);
    g.lineTo(-CW * 0.15, CH);
    g.fill();

    let sub = '';
    if (this.kind === 'rate') sub = 'FIRE RATE';
    else if (this.kind === 'dmg') sub = 'DAMAGE';
    else if (gun) sub = 'NEW GUN  ' + '★'.repeat(this.value) + '☆'.repeat(WEAPON_MAX_LEVEL - this.value);
    const text = gun ? WEAPONS[this.weapon].name.replace(' GUN', '') : gateText(this.kind, this.value);
    const hasSub = sub !== '';
    let size = hasSub ? 84 : 118;
    g.font = `900 ${size}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    const maxW = CW - 26;
    const w = g.measureText(text).width;
    if (w > maxW) {
      size = Math.floor((size * maxW) / w);
      g.font = `900 ${size}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cy = hasSub ? CH * 0.6 : CH * 0.52;
    g.lineJoin = 'round';
    g.lineWidth = Math.max(6, size * 0.12);
    g.strokeStyle = gun ? 'rgba(110,50,0,0.9)' : good ? 'rgba(0,40,110,0.85)' : 'rgba(110,0,0,0.85)';
    g.strokeText(text, CW / 2, cy);
    g.fillStyle = '#ffffff';
    g.fillText(text, CW / 2, cy);
    if (hasSub) {
      g.font = '900 30px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
      g.lineWidth = 6;
      g.strokeText(sub, CW / 2, CH * 0.22);
      g.fillStyle = gun ? '#fff6d0' : good ? '#ffe680' : '#ffe0d8';
      g.fillText(sub, CW / 2, CH * 0.22);
    }
    // Progress toward the next step for multi-hit gates.
    if (this.kind !== 'add' && this.step > 1) {
      const canStep = this.kind === 'mul' ? this.value < 5 : this.kind === 'gun' ? this.value < WEAPON_MAX_LEVEL : true;
      if (canStep) {
        const p = this.hits / this.step;
        const bx = 34;
        const bw = CW - 68;
        const by = CH - 26;
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(bx, by, bw, 12);
        g.fillStyle = good ? '#bfe8ff' : '#ffd0c8';
        g.fillRect(bx + 2, by + 2, (bw - 4) * p, 8);
      }
    }
    this.tex.needsUpdate = true;
    this.dirty = false;
  }

  /** Mark passed. `chosen` = the squad went through this one. */
  pass(chosen: boolean): void {
    this.chosen = chosen;
    this.fading = 0.0001;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.drawCd -= dt;
    if (this.dirty && this.drawCd <= 0) {
      this.draw();
      this.drawCd = 0.05;
    }
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 8);
    const p = 1 + this.pulse * 0.05;
    if (this.fading > 0) {
      this.fading += dt;
      const f = Math.min(1, this.fading / 0.35);
      if (this.chosen) {
        this.group.scale.set(1 + f * 0.4, 1 + f * 0.25, 1);
        this.panelMat.opacity = 1 - f;
      } else {
        this.group.scale.set(1, Math.max(0.01, 1 - f), 1);
        this.panelMat.opacity = 1 - f;
      }
      if (f >= 1) this.hide();
    } else {
      this.panel.scale.set(p, p, 1);
    }
  }

  hide(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.tex.dispose();
    this.panelMat.dispose();
    this.frameMat.dispose();
    this.glowMat.dispose();
  }
}
