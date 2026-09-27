// OWNER: heroes agent. Imperative DOM layer over the battle canvas: per-unit HP/energy bars (projected from 3D)
// and pooled floating damage numbers. Lives inside the container rendered by BattleHud.

export interface BarSpec {
  uid: string;
  side: 'A' | 'B';
  label: string;
  hasEnergy: boolean;
  big: boolean;
}

interface Bar {
  el: HTMLDivElement;
  fill: HTMLDivElement;
  lag: HTMLDivElement;
  shield: HTMLDivElement;
  energy: HTMLDivElement | null;
  lastX: number;
  lastY: number;
  lastHp: number;
  lastSh: number;
  lastEn: number;
  lagHp: number;
  visible: boolean;
}

const NUM_POOL = 48;

export class BattleOverlay {
  private host: HTMLElement | null = null;
  private root: HTMLDivElement | null = null;
  private bars = new Map<string, Bar>();
  private specs: BarSpec[] = [];
  private nums: HTMLDivElement[] = [];
  private numIdx = 0;

  /** (Re)attaches to the HUD container; rebuilds elements if the container changed. */
  attach(host: HTMLElement | null): void {
    if (host === this.host && (!host || this.root?.parentElement === host)) return;
    this.host = host;
    this.root?.remove();
    this.root = null;
    this.bars.clear();
    this.nums = [];
    if (!host) return;
    const root = document.createElement('div');
    root.className = 'bov';
    host.appendChild(root);
    this.root = root;
    for (let i = 0; i < NUM_POOL; i++) {
      const n = document.createElement('div');
      n.className = 'bnum';
      root.appendChild(n);
      this.nums.push(n);
    }
    this.buildBars();
  }

  setUnits(specs: BarSpec[]): void {
    this.specs = specs;
    this.buildBars();
  }

  private buildBars(): void {
    if (!this.root) return;
    for (const b of this.bars.values()) b.el.remove();
    this.bars.clear();
    for (const s of this.specs) {
      const el = document.createElement('div');
      el.className = `bbar side-${s.side}${s.big ? ' big' : ''}`;
      const name = document.createElement('div');
      name.className = 'bbar-name';
      name.textContent = s.label;
      const hp = document.createElement('div');
      hp.className = 'bbar-hp';
      const lag = document.createElement('div');
      lag.className = 'bbar-lag';
      const fill = document.createElement('div');
      fill.className = 'bbar-fill';
      const shield = document.createElement('div');
      shield.className = 'bbar-shield';
      hp.append(lag, fill, shield);
      el.append(name, hp);
      let energy: HTMLDivElement | null = null;
      if (s.hasEnergy) {
        const en = document.createElement('div');
        en.className = 'bbar-en';
        energy = document.createElement('div');
        energy.className = 'bbar-en-fill';
        en.appendChild(energy);
        el.appendChild(en);
      }
      this.root.appendChild(el);
      this.bars.set(s.uid, { el, fill, lag, shield, energy, lastX: -1, lastY: -1, lastHp: -1, lastSh: -1, lastEn: -1, lagHp: 1, visible: true });
    }
  }

  /** Per-frame bar update. Fractions in 0..1. */
  updateBar(uid: string, x: number, y: number, visible: boolean, hp: number, shield: number, energy: number, dt: number): void {
    const b = this.bars.get(uid);
    if (!b) return;
    if (visible !== b.visible) {
      b.visible = visible;
      b.el.style.opacity = visible ? '1' : '0';
    }
    if (!visible) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx !== b.lastX || ry !== b.lastY) {
      b.el.style.transform = `translate(${rx}px, ${ry}px)`;
      b.lastX = rx;
      b.lastY = ry;
    }
    if (Math.abs(hp - b.lastHp) > 0.001) {
      b.fill.style.width = (hp * 100).toFixed(1) + '%';
      b.el.classList.toggle('low', hp < 0.3);
      b.lastHp = hp;
    }
    // Trailing "damage taken" bar.
    if (b.lagHp > hp) b.lagHp = Math.max(hp, b.lagHp - dt * 0.6);
    else b.lagHp = hp;
    b.lag.style.width = (b.lagHp * 100).toFixed(1) + '%';
    if (Math.abs(shield - b.lastSh) > 0.001) {
      b.shield.style.width = (Math.min(1, shield) * 100).toFixed(1) + '%';
      b.lastSh = shield;
    }
    if (b.energy && Math.abs(energy - b.lastEn) > 0.001) {
      b.energy.style.width = (energy * 100).toFixed(1) + '%';
      b.energy.classList.toggle('full', energy >= 0.999);
      b.lastEn = energy;
    }
  }

  /** Floating number / label at screen position. cls: 'dmg-b' | 'dmg-a' | 'crit' | 'skill' | 'heal' | 'buff' | 'debuff' | 'shield'. */
  pop(x: number, y: number, text: string, cls: string): void {
    if (!this.nums.length) return;
    const n = this.nums[this.numIdx];
    this.numIdx = (this.numIdx + 1) % this.nums.length;
    n.className = 'bnum';
    n.textContent = text;
    n.style.left = Math.round(x + (Math.random() - 0.5) * 26) + 'px';
    n.style.top = Math.round(y) + 'px';
    void n.offsetWidth; // restart the CSS animation
    n.className = 'bnum show ' + cls;
  }

  detach(): void {
    this.root?.remove();
    this.root = null;
    this.host = null;
    this.bars.clear();
    this.nums = [];
    this.specs = [];
  }
}
