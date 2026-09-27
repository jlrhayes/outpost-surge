// OWNER: runner agent. Procedural canvas textures for the runner (sky, road, ground). No image assets.
import * as THREE from 'three';
import { mulberry32 } from '../../core/rng';
import type { ThemePalette } from '../../data/runner';

export function css(c: number, mul = 1, alpha = 1): string {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * mul));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * mul));
  const b = Math.min(255, Math.round((c & 255) * mul));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
}

export function skyTexture(p: ThemePalette): THREE.CanvasTexture {
  const [c, g] = makeCanvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, css(p.skyTop, 0.9));
  grad.addColorStop(0.45, css(p.skyTop, 1.15));
  grad.addColorStop(0.8, css(p.skyHorizon));
  grad.addColorStop(1, css(p.fog));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return finish(c, false);
}

/**
 * Road tile: 12 units wide (2 sidewalk + 8 asphalt + 2 sidewalk) x 16 units long.
 * Texture V repeats along the road; lane dashes are in the middle.
 */
export const ROAD_TILE = 16;
export const ROAD_WIDTH = 12;
export function roadTexture(p: ThemePalette): THREE.CanvasTexture {
  const W = 384;
  const H = 512;
  const [c, g] = makeCanvas(W, H);
  const u = W / ROAD_WIDTH; // px per unit
  const v = H / ROAD_TILE;
  const rng = mulberry32(99);
  // Sidewalks.
  g.fillStyle = css(p.sidewalk);
  g.fillRect(0, 0, W, H);
  g.strokeStyle = css(p.sidewalk, 0.8);
  g.lineWidth = 2;
  for (let y = 0; y < H; y += v * 2) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(2 * u, y);
    g.moveTo(W - 2 * u, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(u, 0);
  g.lineTo(u, H);
  g.moveTo(W - u, 0);
  g.lineTo(W - u, H);
  g.stroke();
  // Asphalt with speckle noise and a few patches.
  g.fillStyle = css(p.asphalt);
  g.fillRect(2 * u, 0, 8 * u, H);
  for (let i = 0; i < 2600; i++) {
    const x = 2 * u + rng() * 8 * u;
    const y = rng() * H;
    g.fillStyle = css(p.asphalt, 0.75 + rng() * 0.5, 0.6);
    g.fillRect(x, y, 2, 2);
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = css(p.asphalt, 0.85 + rng() * 0.25, 0.8);
    g.fillRect(2 * u + rng() * 6 * u, rng() * H, u * (0.8 + rng() * 1.6), v * (0.6 + rng() * 1.5));
  }
  g.strokeStyle = css(p.asphalt, 0.6, 0.9);
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    let x = 2 * u + rng() * 8 * u;
    let y = rng() * H;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rng() - 0.5) * 18;
      y += rng() * 16;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Curbs.
  g.fillStyle = css(p.sidewalk, 1.18);
  g.fillRect(2 * u - 5, 0, 5, H);
  g.fillRect(W - 2 * u, 0, 5, H);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(2 * u, 0, 3, H);
  g.fillRect(W - 2 * u - 3, 0, 3, H);
  // Edge lines.
  g.fillStyle = 'rgba(245,245,235,0.9)';
  g.fillRect(2.35 * u, 0, 0.16 * u, H);
  g.fillRect(W - 2.35 * u - 0.16 * u, 0, 0.16 * u, H);
  // Centre dashes (2 per tile).
  g.fillStyle = 'rgba(255,214,90,0.95)';
  for (let k = 0; k < 2; k++) g.fillRect(W / 2 - 0.1 * u, k * (H / 2) + v * 1, 0.2 * u, v * 4);
  const t = finish(c, true);
  return t;
}

export function groundTexture(p: ThemePalette): THREE.CanvasTexture {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  const rng = mulberry32(7);
  g.fillStyle = css(p.ground);
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const r = 10 + rng() * 34;
    const x = rng() * S;
    const y = rng() * S;
    g.fillStyle = css(rng() < 0.5 ? p.groundAlt : p.ground, 0.9 + rng() * 0.2, 0.55);
    const ry = r * (0.5 + rng() * 0.5);
    const rot = rng() * 3;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, ry, rot, 0, Math.PI * 2);
        g.fill();
      }
  }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = css(p.ground, 0.7 + rng() * 0.6, 0.5);
    g.fillRect(rng() * S, rng() * S, 2, 2);
  }
  return finish(c, true);
}
