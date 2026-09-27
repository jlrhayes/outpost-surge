// OWNER: art agent. Zombie-infested ruined city blocks surrounding the base (cleared over time).
import * as THREE from 'three';
import { P, beam, buildColored, bx, rod, vcMesh, type Part, type V3 } from './builder';
import { cached } from './cache';
import { propGeometry, rng, rockGeom, type PropKind } from './props';

const BLOCK = 12;
const VARIANTS = 8;
const WALLS = [0x77706a, 0x86635a, 0x62706e, 0x746b5c, 0x6b6f78];

/**
 * Ruined, zombie-infested city block (~12 x 12 m, origin at ground centre) with broken buildings, wrecks and
 * debris in dark desaturated colours. `seed` picks one of 8 layouts and a 90-degree rotation.
 * Children: 'body' (static mesh) and 'fog' (translucent green-grey haze with its OWN material: fade its
 * `material.opacity` or hide it when the block is cleared).
 */
export function ruinedBlockModel(seed: number): THREE.Group {
  const s = Math.abs(Math.floor(seed));
  const v = s % VARIANTS;
  const g = new THREE.Group();
  const body = vcMesh(cached('ruinBlock_' + v, () => blockGeometry(v)));
  body.name = 'body';
  body.rotation.y = (Math.floor(s / VARIANTS) % 4) * (Math.PI / 2);
  g.add(body);
  g.add(fogMesh(v));
  return g;
}

function blockGeometry(v: number): THREE.BufferGeometry {
  const r = rng(v * 101 + 7);
  const parts: Part[] = [];
  const H = BLOCK / 2;
  // ground: cracked asphalt with a raised kerb/sidewalk ring and faded road paint
  parts.push(bx(0x4d4a45, [0, 0.04, 0], [BLOCK, 0.08, BLOCK]));
  for (const sgn of [-1, 1]) {
    parts.push({ ...bx(0x6c6961, [sgn * (H - 0.35), 0.1, 0], [0.7, 0.12, BLOCK]), vary: 0.05 });
    parts.push({ ...bx(0x6c6961, [0, 0.1, sgn * (H - 0.35)], [BLOCK - 1.4, 0.12, 0.7]), vary: 0.05 });
  }
  for (let i = 0; i < 6; i++) parts.push(bx(0x8a8470, [-4.5 + i * 1.8, 0.085, 0], [0.8, 0.01, 0.12]));
  // cracks
  for (let i = 0; i < 8; i++) {
    const x = (r() - 0.5) * 10;
    const z = (r() - 0.5) * 10;
    parts.push(bx(0x34322e, [x, 0.085, z], [0.06, 0.01, 0.8 + r()], [0, r() * 3, 0]));
  }
  // 2x2 lots: buildings, rubble, wreck parking or dead park
  const lots: [number, number][] = [
    [-2.9, -2.9],
    [2.9, -2.9],
    [-2.9, 2.9],
    [2.9, 2.9],
  ];
  const kinds = ['building', 'building', ['building', 'rubble', 'park', 'wrecks'][v % 4], ['wrecks', 'building', 'rubble', 'building'][(v >> 1) % 4]];
  // shuffle by variant
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  lots.forEach(([cx, cz], i) => {
    const kind = kinds[i];
    if (kind === 'building') parts.push(...ruinedBuilding(cx, cz, r));
    else if (kind === 'rubble') parts.push(...rubble(cx, cz, 2.2, 10, r));
    else if (kind === 'park') {
      for (let k = 0; k < 4; k++) parts.push(...deadTree(cx + (r() - 0.5) * 3.5, cz + (r() - 0.5) * 3.5, r));
      parts.push({ geom: P.cyl12, color: 0x4a6a34, pos: [cx + 0.4, 0.1, cz - 0.3], scale: [2.2, 0.03, 1.6] });
    } else {
      parts.push(prop('car_wreck', [cx - 1.2, 0.08, cz + 0.2], r() * 0.3 - 0.15));
      parts.push(prop('car_wreck', [cx + 1.2, 0.08, cz - 0.9], 1.5 + r() * 0.15));
      parts.push(prop('tire', [cx + 0.9, 0.08, cz + 1.2], r()));
    }
  });
  // scattered debris along the streets
  const debris: PropKind[] = ['barrel', 'tire', 'crate', 'cone', 'hedgehog', 'barrier', 'rock'];
  for (let i = 0; i < 7; i++) {
    const kind = debris[Math.floor(r() * debris.length)];
    const edge = Math.floor(r() * 4);
    const t = (r() - 0.5) * 9;
    const d = H - 0.35 + (r() - 0.5) * 0.3;
    const pos: V3 = edge === 0 ? [t, 0.1, d] : edge === 1 ? [t, 0.1, -d] : edge === 2 ? [d, 0.1, t] : [-d, 0.1, t];
    parts.push(prop(kind, pos, r() * 6, kind === 'rock' ? 0.5 : 0.8));
  }
  // toxic puddles + rubble in the centre crossing
  for (let i = 0; i < 3; i++)
    parts.push({ geom: P.cyl12, color: 0x5d8a3a, pos: [(r() - 0.5) * 8, 0.09, (r() - 0.5) * 8], scale: [0.8 + r() * 1.2, 0.02, 0.6 + r()], rot: [0, r() * 3, 0] });
  parts.push(...rubble(0, 0, 0.8, 4, r));
  const g = buildColored(parts);
  desaturate(g, 0.45, 0.82);
  return g;
}

function prop(kind: PropKind, pos: V3, rotY: number, s = 1): Part {
  return { geom: propGeometry(kind), pos, rot: [0, rotY, 0], scale: [s, s, s] };
}

function ruinedBuilding(cx: number, cz: number, r: () => number): Part[] {
  const p: Part[] = [];
  const w = 3.0 + r() * 1.4;
  const d = 3.0 + r() * 1.4;
  const h = 2.4 + r() * 3.4;
  const wall = WALLS[Math.floor(r() * WALLS.length)];
  const dark = 0x23211f;
  p.push({ ...bx(wall, [cx, h / 2 + 0.08, cz], [w, h, d]), vary: 0.04 });
  // jagged broken top
  const n = 3;
  for (let i = 0; i < n; i++) {
    const bw = w / n;
    const bh = r() * 1.3;
    if (bh < 0.2) continue;
    p.push({ ...bx(wall, [cx - w / 2 + bw * (i + 0.5), h + 0.08 + bh / 2, cz - d / 4 + r() * (d / 2)], [bw * (0.6 + r() * 0.4), bh, d * (0.3 + r() * 0.4)]), vary: 0.05 });
  }
  // collapsed corner (dark hole + slab)
  p.push(bx(dark, [cx + w / 2 - 0.45, h - 0.4, cz + d / 2 - 0.2], [0.95, 0.8, 0.5]));
  p.push({ geom: P.chamfer, color: wall, pos: [cx + w / 2 + 0.2, 0.4, cz + d / 2 + 0.3], rot: [0.5, 0.3, 0.9], scale: [1.4, 0.2, 0.9], vary: 0.06 });
  // window holes on the two faces the camera usually sees (+Z, +X) and -X
  const floors = Math.max(1, Math.floor((h - 0.5) / 1.1));
  for (let f = 0; f < floors; f++) {
    const y = 0.9 + f * 1.1;
    for (let x = -w / 2 + 0.55; x < w / 2 - 0.3; x += 0.85) if (r() > 0.2) p.push(bx(dark, [cx + x, y, cz + d / 2 + 0.01], [0.42, 0.52, 0.04]));
    for (let z = -d / 2 + 0.55; z < d / 2 - 0.3; z += 0.85) {
      if (r() > 0.25) p.push(bx(dark, [cx + w / 2 + 0.01, y, cz + z], [0.04, 0.52, 0.42]));
      if (r() > 0.4) p.push(bx(dark, [cx - w / 2 - 0.01, y, cz + z], [0.04, 0.52, 0.42]));
    }
  }
  // rebar + rubble at the base
  for (let i = 0; i < 3; i++) {
    const x = cx - w / 2 + r() * w;
    p.push(rod([x, h + 0.08, cz + (r() - 0.5) * d * 0.6], [x + (r() - 0.5) * 0.3, h + 0.6 + r() * 0.4, cz + (r() - 0.5) * d * 0.6], 0.025, 0x7a4a2e, P.cyl4));
  }
  p.push(...rubble(cx + w / 2 - 0.2, cz + d / 2 + 0.4, 0.9, 5, r));
  return p;
}

function rubble(cx: number, cz: number, spread: number, n: number, r: () => number): Part[] {
  const p: Part[] = [];
  for (let i = 0; i < n; i++) {
    const s = 0.3 + r() * 0.7;
    p.push({
      geom: rockGeom(Math.floor(r() * 50)),
      color: r() > 0.5 ? 0x8a857c : 0x76654f,
      pos: [cx + (r() - 0.5) * spread * 2, 0.06, cz + (r() - 0.5) * spread * 2],
      rot: [0, r() * 6, 0],
      scale: [s * 1.3, s * 0.8, s],
      vary: 0.08,
    });
  }
  return p;
}

function deadTree(x: number, z: number, r: () => number): Part[] {
  const h = 1.6 + r() * 1.0;
  return [
    beam([x, 0, z], [x + 0.1, h, z], 0.16, 0x4a3a2c),
    beam([x + 0.05, h * 0.6, z], [x + 0.6, h * 0.95, z + 0.2], 0.08, 0x4a3a2c),
    beam([x + 0.07, h * 0.75, z], [x - 0.4, h * 1.05, z - 0.3], 0.07, 0x4a3a2c),
  ];
}

function desaturate(g: THREE.BufferGeometry, amount: number, dark: number): void {
  const c = g.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i),
      gg = c.getY(i),
      b = c.getZ(i);
    const l = r * 0.3 + gg * 0.59 + b * 0.11;
    c.setXYZ(i, (r + (l - r) * amount) * dark, (gg + (l - gg) * amount) * dark, (b + (l - b) * amount) * dark);
  }
  c.needsUpdate = true;
}

const fogGeo = new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
function fogMesh(v: number): THREE.Mesh {
  const r = rng(v * 13 + 5);
  const puffs: Part[] = [];
  for (let i = 0; i < 7; i++) {
    const s = 3 + r() * 3;
    puffs.push({ geom: fogGeo, color: 0x9aa892, pos: [(r() - 0.5) * 8, 0, (r() - 0.5) * 8], scale: [s * 1.3, s * 0.45, s] });
  }
  const geom = cached('ruinFog_' + v, () => buildColored(puffs));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false });
  const m = new THREE.Mesh(geom, mat);
  m.name = 'fog';
  m.renderOrder = 2;
  return m;
}
