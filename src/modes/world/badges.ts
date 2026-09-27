// OWNER: world agent. Floating map labels (level badges, names, pins) drawn as camera-facing
// instanced quads sampling one canvas atlas: every label on the map is a single draw call.
import * as THREE from 'three';

const ATLAS_W = 1024;
const ATLAS_H = 2048;
const CELL_W = 256;
const CELL_H = 64;
const COLS = ATLAS_W / CELL_W;
const ROWS = ATLAS_H / CELL_H;
const MAX_BADGES = 640;

export type BadgeDraw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iUv;
attribute vec3 iSize; // w, h, bob amplitude
uniform float uScale;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec3 p = iPos;
  p.y += sin(uTime * 3.0 + iPos.x * 0.7 + iPos.z * 0.3) * iSize.z;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * iSize.xy * uScale;
  gl_Position = projectionMatrix * mv;
  vUv = vec2(mix(iUv.x, iUv.z, uv.x), mix(iUv.y, iUv.w, uv.y));
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.03) discard;
  gl_FragColor = vec4(c.rgb, c.a * uOpacity);
}`;

export class BadgeLayer {
  readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private cells = new Map<string, number>();
  private draws = new Map<string, BadgeDraw>();
  private nextCell = 0;
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aUv: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private mat: THREE.ShaderMaterial;
  private count = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_W;
    this.canvas.height = ATLAS_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BADGES * 3), 3);
    this.aUv = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BADGES * 4), 4);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BADGES * 3), 3);
    this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.aPos);
    this.geo.setAttribute('iUv', this.aUv);
    this.geo.setAttribute('iSize', this.aSize);
    this.geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: this.texture },
        uScale: { value: 1 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  /** Ensures a label is in the atlas; `draw` renders it centred in a 256x64 cell. */
  private cellFor(key: string, draw: BadgeDraw): number {
    let c = this.cells.get(key);
    if (c !== undefined) return c;
    if (this.nextCell >= COLS * ROWS) this.repack();
    c = this.nextCell++;
    this.cells.set(key, c);
    this.draws.set(key, draw);
    this.paint(c, draw);
    this.texture.needsUpdate = true;
    return c;
  }

  private paint(cell: number, draw: BadgeDraw): void {
    const x = (cell % COLS) * CELL_W;
    const y = Math.floor(cell / COLS) * CELL_H;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(x, y, CELL_W, CELL_H);
    ctx.beginPath();
    ctx.rect(x, y, CELL_W, CELL_H);
    ctx.clip();
    ctx.translate(x, y);
    draw(ctx, CELL_W, CELL_H);
    ctx.restore();
  }

  /** Atlas full: drop everything not used by the current frame's labels (they get re-added lazily). */
  private repack(): void {
    this.ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
    this.cells.clear();
    this.draws.clear();
    this.nextCell = 0;
    // labels added earlier this frame now point at cleared cells: the owner must rebuild once more
    this.stale = true;
  }

  /** Set when the atlas was repacked mid-build; the owner should rebuild all labels. */
  stale = false;

  begin(): void {
    this.count = 0;
  }

  /**
   * Adds a label at a world position. `w`/`h` are world units at scale 1 (the quad covers the whole
   * 4:1 cell, so keep w = 4h). `bob` makes it float up and down.
   */
  add(key: string, draw: BadgeDraw, x: number, y: number, z: number, w: number, h: number, bob = 0): void {
    if (this.count >= MAX_BADGES) return;
    const cell = this.cellFor(key, draw);
    const i = this.count++;
    const cx = (cell % COLS) * CELL_W;
    const cy = Math.floor(cell / COLS) * CELL_H;
    const u0 = (cx + 0.5) / ATLAS_W;
    const u1 = (cx + CELL_W - 0.5) / ATLAS_W;
    const vTop = 1 - (cy + 0.5) / ATLAS_H;
    const vBot = 1 - (cy + CELL_H - 0.5) / ATLAS_H;
    this.aPos.setXYZ(i, x, y, z);
    this.aUv.setXYZW(i, u0, vBot, u1, vTop);
    this.aSize.setXYZ(i, w, h, bob);
  }

  /** Moves an existing label (e.g. marching squads). */
  move(i: number, x: number, y: number, z: number): void {
    this.aPos.setXYZ(i, x, y, z);
    this.aPos.needsUpdate = true;
  }

  get size(): number {
    return this.count;
  }

  end(): void {
    this.geo.instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aUv.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  setFrame(scale: number, time: number): void {
    this.mat.uniforms.uScale.value = scale;
    this.mat.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.texture.dispose();
  }
}

// ------------------------------------------------------------------ drawing helpers

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** Pill badge: [icon circle] text. Returns a draw fn. */
export function pillBadge(opts: {
  text: string;
  sub?: string;
  bg: string;
  border: string;
  fg?: string;
  icon?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
  iconBg?: string;
  maxW?: number;
}): BadgeDraw {
  return (ctx, W, H) => {
    const fontMain = `900 ${opts.sub ? 24 : 30}px ${FONT}`;
    const fontSub = `800 18px ${FONT}`;
    ctx.font = fontMain;
    let tw = ctx.measureText(opts.text).width;
    if (opts.sub) {
      ctx.font = fontSub;
      tw = Math.max(tw, ctx.measureText(opts.sub).width);
    }
    const iconW = opts.icon ? 44 : 0;
    const pad = 12;
    const h = H - 10;
    let w = Math.min(opts.maxW ?? W - 6, tw + pad * 2 + iconW);
    w = Math.max(w, h + 4);
    const x = (W - w) / 2;
    const y = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = opts.bg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = opts.border;
    ctx.stroke();
    if (opts.icon) {
      const r = h / 2 - 4;
      const icx = x + 4 + r;
      const icy = y + h / 2;
      ctx.beginPath();
      ctx.arc(icx, icy, r, 0, Math.PI * 2);
      ctx.fillStyle = opts.iconBg ?? opts.border;
      ctx.fill();
      opts.icon(ctx, icx, icy, r);
    }
    const tx = x + iconW + (w - iconW) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.fg ?? '#fff';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    const maxText = w - iconW - pad * 1.5;
    if (opts.sub) {
      ctx.font = fontMain;
      ctx.lineWidth = 4;
      ctx.strokeText(opts.text, tx, y + h * 0.34, maxText);
      ctx.fillText(opts.text, tx, y + h * 0.34, maxText);
      ctx.font = fontSub;
      ctx.fillStyle = '#ffd96a';
      ctx.strokeText(opts.sub, tx, y + h * 0.74, maxText);
      ctx.fillText(opts.sub, tx, y + h * 0.74, maxText);
    } else {
      ctx.font = fontMain;
      ctx.lineWidth = 5;
      ctx.strokeText(opts.text, tx, y + h / 2 + 1, maxText);
      ctx.fillText(opts.text, tx, y + h / 2 + 1, maxText);
    }
  };
}

// small vector glyphs for badge icons
export const glyph = {
  skull(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#e9f0d8';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.12, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - r * 0.34, cy + r * 0.2, r * 0.68, r * 0.42);
    ctx.fillStyle = '#233';
    ctx.beginPath();
    ctx.arc(cx - r * 0.24, cy - r * 0.12, r * 0.16, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.24, cy - r * 0.12, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  },
  crown(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy + r * 0.4);
    ctx.lineTo(cx - r * 0.6, cy - r * 0.35);
    ctx.lineTo(cx - r * 0.25, cy);
    ctx.lineTo(cx, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.25, cy);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.4);
    ctx.closePath();
    ctx.fill();
  },
  lock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.15, r * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#ddd';
    ctx.fillRect(cx - r * 0.42, cy - r * 0.12, r * 0.84, r * 0.6);
  },
  dot(color: string) {
    return (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    };
  },
  wheat(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#fff3c0';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * r * 0.28, cy - r * 0.1, r * 0.14, r * 0.42, i * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(cx - r * 0.05, cy + r * 0.1, r * 0.1, r * 0.5);
  },
  ore(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#e8eef4';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy + r * 0.35);
    ctx.lineTo(cx - r * 0.3, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.55, cy + r * 0.35);
    ctx.closePath();
    ctx.fill();
  },
  coin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b08010';
    ctx.font = `900 ${Math.round(r * 0.8)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 1);
  },
  shield(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.6);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.25);
    ctx.lineTo(cx, cy + r * 0.62);
    ctx.lineTo(cx - r * 0.4, cy + r * 0.25);
    ctx.lineTo(cx - r * 0.5, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
  },
  star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.28 : r * 0.62;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  },
};

/** Map pin (radar marker): teardrop with an exclamation mark. */
export function pinBadge(color: string, mark = '!'): BadgeDraw {
  return (ctx, W, H) => {
    const cx = W / 2;
    const r = 20;
    const cy = 24;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(cx, H - 3);
    ctx.bezierCurveTo(cx - 8, cy + r * 0.9, cx - r, cy + r * 0.5, cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.bezierCurveTo(cx + r, cy + r * 0.5, cx + 8, cy + r * 0.9, cx, H - 3);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `900 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mark, cx, cy + 1);
  };
}
