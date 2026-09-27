// OWNER: base agent. Static environment of the base: terrain, compound ground, roads, perimeter wall,
// props (instanced), flag, streets between district blocks. Built once; the wall is rebuilt per tier.
import * as THREE from 'three';
import { propGeometry, vcMaterial, type PropKind } from '../../three/models';
import { mulberry32 } from '../../core/rng';
import { COMPOUND, DISTRICTS, DISTRICT_SIZE, GATE, WALL_INSET } from '../../data/buildings';
import { PartList, buildParts } from './geo';

const C = {
  grass: 0x93c862,
  grassDark: 0x7fb553,
  dry: 0xb7b27a,
  khaki: 0xd9c99b,
  asphalt: 0x62676e,
  sidewalk: 0xc4c0b4,
  mark: 0xf2cf45,
  white: 0xf4f1e8,
  plaza: 0xe4ddcc,
  plazaEdge: 0xb9b1a0,
  concrete: 0xcfc8b6,
  yard: 0x8fc45c,
};

/** Where (inner edge) the perimeter wall runs. */
export const WALL = {
  minX: COMPOUND.minX + WALL_INSET,
  maxX: COMPOUND.maxX - WALL_INSET,
  minZ: COMPOUND.minZ + WALL_INSET,
  maxZ: COMPOUND.maxZ - WALL_INSET,
  gateHalf: 3.3,
};

export class Environment {
  readonly group = new THREE.Group();
  private wallMesh: THREE.Mesh | null = null;
  private wallTier = -1;
  private flagGeom: THREE.PlaneGeometry;
  private flagBase: Float32Array;
  readonly flagPos = new THREE.Vector3(4.8, 0, -4.2);

  constructor(quality: 'low' | 'high') {
    this.group.add(this.makeTerrain());
    this.group.add(this.makeStreets());
    this.group.add(this.makeCompoundGround());
    this.makeProps(quality);
    // Flag on a pole beside the Command Post.
    const pole = new PartList()
      .cyl(0x8a8f96, this.flagPos.x, 3.9, this.flagPos.z, 0.09, 7.8)
      .blob(0xf2cf45, this.flagPos.x, 7.9, this.flagPos.z, 0.28, 0.28, 0.28)
      .cyl(0x6b6f75, this.flagPos.x, 0.2, this.flagPos.z, 0.5, 0.4);
    const poleMesh = new THREE.Mesh(buildParts(pole), vcMaterial());
    poleMesh.castShadow = true;
    this.group.add(poleMesh);
    this.flagGeom = new THREE.PlaneGeometry(2.6, 1.6, 12, 4);
    this.flagGeom.translate(1.3, 0, 0);
    const pos = this.flagGeom.getAttribute('position') as THREE.BufferAttribute;
    this.flagBase = new Float32Array(pos.array as Float32Array);
    const colors = new Float32Array(pos.count * 3);
    const teal = new THREE.Color(0x1d8fa6);
    const gold = new THREE.Color(0xffc93a);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const c = Math.abs(y) < 0.25 ? gold : x < 0.7 && Math.abs(y) < 0.55 ? white : teal;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    this.flagGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const flag = new THREE.Mesh(
      this.flagGeom,
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }),
    );
    flag.position.set(this.flagPos.x, 6.9, this.flagPos.z);
    flag.rotation.y = -0.5;
    flag.castShadow = true;
    this.group.add(flag);
  }

  private makeTerrain(): THREE.Mesh {
    const size = 480;
    const g = new THREE.PlaneGeometry(size, size, 48, 48);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const rng = mulberry32(7);
    const a = new THREE.Color(C.grass);
    const b = new THREE.Color(C.dry);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.max(Math.abs(x) / 60, Math.abs(z) / 68);
      const dry = THREE.MathUtils.clamp((r - 1) * 1.4 + (rng() - 0.5) * 0.5, 0, 0.85);
      c.copy(a).lerp(b, dry);
      c.offsetHSL(0, 0, (rng() - 0.5) * 0.05);
      colors.set([c.r, c.g, c.b], i * 3);
      // Gentle rolling hills far from the base only.
      if (r > 1.25) pos.setY(i, (rng() - 0.3) * Math.min(3, (r - 1.25) * 3));
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, vcMaterial());
    m.receiveShadow = true;
    m.position.y = -0.02;
    return m;
  }

  /** Asphalt streets + sidewalks framing every district block. */
  private makeStreets(): THREE.Mesh {
    const p = new PartList();
    const S = DISTRICT_SIZE;
    const w = 2.6;
    for (const d of DISTRICTS) {
      // Streets on the four sides (duplicates between neighbours are harmless, same colour & height).
      p.slab(C.asphalt, d.x, 0, d.z - S / 2, S + w, 0.1, w);
      p.slab(C.asphalt, d.x, 0, d.z + S / 2, S + w, 0.1, w);
      p.slab(C.asphalt, d.x - S / 2, 0, d.z, w, 0.1, S + w);
      p.slab(C.asphalt, d.x + S / 2, 0, d.z, w, 0.1, S + w);
      // Sidewalk frame.
      const inner = S - w;
      p.slab(C.sidewalk, d.x, 0, d.z - inner / 2 + 0.3, inner, 0.16, 0.6);
      p.slab(C.sidewalk, d.x, 0, d.z + inner / 2 - 0.3, inner, 0.16, 0.6);
      p.slab(C.sidewalk, d.x - inner / 2 + 0.3, 0, d.z, 0.6, 0.16, inner);
      p.slab(C.sidewalk, d.x + inner / 2 - 0.3, 0, d.z, 0.6, 0.16, inner);
    }
    // Centre-line dashes on the streets around the compound and along the gate avenue.
    for (let z = COMPOUND.maxZ + 4; z < 58; z += 3) p.slab(C.mark, 0, 0.1, z, 0.18, 0.02, 1.4);
    for (let x = -46; x <= 46; x += 3) {
      p.slab(C.mark, x, 0.1, COMPOUND.maxZ, 1.4, 0.02, 0.18);
      p.slab(C.mark, x, 0.1, COMPOUND.minZ, 1.4, 0.02, 0.18);
    }
    for (let z = -54; z <= 54; z += 3) {
      p.slab(C.mark, COMPOUND.minX, 0.1, z, 0.18, 0.02, 1.4);
      p.slab(C.mark, COMPOUND.maxX, 0.1, z, 0.18, 0.02, 1.4);
    }
    const m = new THREE.Mesh(buildParts(p), vcMaterial());
    m.receiveShadow = true;
    return m;
  }

  private makeCompoundGround(): THREE.Mesh {
    const p = new PartList();
    const W = WALL;
    const cx = (W.minX + W.maxX) / 2;
    const cz = (W.minZ + W.maxZ) / 2;
    p.slab(C.khaki, cx, 0, cz, W.maxX - W.minX + 0.6, 0.12, W.maxZ - W.minZ + 0.6);
    // Resource yard lawn (farms & quarries).
    p.slab(C.yard, 0, 0.12, 11.5, W.maxX - W.minX - 1, 0.02, 7.2);
    // Back lawn along the rear wall.
    p.slab(C.yard, 0, 0.12, W.minZ + 1.5, W.maxX - W.minX - 1, 0.02, 2.6);
    // Roads.
    p.slab(C.asphalt, 0, 0.12, (-4 + W.maxZ + 1) / 2, 3.4, 0.04, W.maxZ + 1 + 4);
    for (const z of [-13.5, 6.8, 16.6]) p.slab(C.asphalt, 0, 0.12, z, W.maxX - W.minX - 0.8, 0.04, 2.6);
    for (const z of [-13.5, 6.8, 16.6]) for (let x = W.minX + 1.5; x < W.maxX - 1; x += 2.6) if (Math.abs(x) > 2.2) p.slab(C.white, x, 0.16, z, 1.2, 0.01, 0.14);
    for (let z = 8; z < W.maxZ; z += 2.6) p.slab(C.mark, 0, 0.16, z, 0.16, 0.01, 1.2);
    // Plaza (parade ground) in front of the Command Post.
    p.slab(C.plazaEdge, 0, 0.12, 0.5, 13.6, 0.05, 10.2);
    p.slab(C.plaza, 0, 0.13, 0.5, 13, 0.05, 9.6);
    for (let x = -4.5; x <= 4.5; x += 3) p.slab(C.white, x, 0.18, 1.2, 0.12, 0.01, 6.5);
    p.slab(C.white, 0, 0.18, -2.3, 10, 0.01, 0.12);
    p.slab(C.white, 0, 0.18, 4.7, 10, 0.01, 0.12);
    // Gate courtyard / parking.
    p.slab(C.concrete, 0, 0.12, 20.3, W.maxX - W.minX - 0.8, 0.04, 4.6);
    for (const x of [-10.5, -8.5, -6.5, 6.5, 8.5, 10.5]) p.slab(C.white, x - Math.sign(x) * 1, 0.16, 20.5, 0.12, 0.01, 3.6);
    // Sidewalk frame inside the walls.
    const m = new THREE.Mesh(buildParts(p), vcMaterial());
    m.receiveShadow = true;
    return m;
  }

  /** Rebuilds the perimeter wall for a wall level tier (0: palisade, 1: concrete, 2: fortified). */
  setWallTier(tier: number): void {
    if (tier === this.wallTier) return;
    this.wallTier = tier;
    if (this.wallMesh) {
      this.group.remove(this.wallMesh);
      this.wallMesh.geometry.dispose();
    }
    const p = new PartList();
    const W = WALL;
    const h = tier === 0 ? 1.8 : tier === 1 ? 2.4 : 3.0;
    const body = tier === 0 ? 0x9a7650 : tier === 1 ? 0xcac3b2 : 0xb3b8bf;
    const top = tier === 0 ? 0x7a5a3a : tier === 1 ? 0xa39d8e : 0x5d6570;
    const seg = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.2) return;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const sx = alongX ? len : 0.8;
      const sz = alongX ? 0.8 : len;
      if (tier === 0) {
        // Sandbag base + wooden palisade posts.
        p.slab(0xbfae7a, mx, 0, mz, sx + 0.2, 0.7, sz + 0.2);
        const n = Math.floor(len / 0.55);
        for (let i = 0; i <= n; i++) {
          const f = i / n;
          const x = x0 + (x1 - x0) * f;
          const z = z0 + (z1 - z0) * f;
          p.cyl(i % 2 ? body : 0x8a6844, x, h / 2, z, 0.2, h + (i % 3) * 0.12);
        }
      } else {
        p.slab(body, mx, 0, mz, sx, h, sz);
        p.slab(top, mx, h, mz, sx + 0.25, 0.22, sz + 0.25);
        // Crenellations.
        const n = Math.floor(len / 1.4);
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          p.slab(top, x0 + (x1 - x0) * f, h + 0.22, z0 + (z1 - z0) * f, alongX ? 0.6 : 0.9, 0.45, alongX ? 0.9 : 0.6);
        }
        if (tier === 2) {
          // Steel buttresses.
          for (let i = 0; i <= n; i += 2) {
            const f = i / n;
            p.slab(0x6d747d, x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f, alongX ? 0.5 : 1.3, h * 0.8, alongX ? 1.3 : 0.5);
          }
        }
      }
    };
    seg(W.minX, W.minZ, W.maxX, W.minZ);
    seg(W.minX, W.minZ, W.minX, W.maxZ);
    seg(W.maxX, W.minZ, W.maxX, W.maxZ);
    seg(W.minX, W.maxZ, -W.gateHalf, W.maxZ);
    seg(W.gateHalf, W.maxZ, W.maxX, W.maxZ);
    // Corner & gate towers.
    const tower = (x: number, z: number, s: number) => {
      const th = h + 2.2;
      p.slab(tier === 0 ? 0x8a6844 : body, x, 0, z, s, th, s);
      p.slab(top, x, th, z, s + 0.4, 0.3, s + 0.4);
      p.slab(0x4a5058, x, th + 0.3, z, s * 0.5, 0.9, s * 0.5);
      p.cone(0xb04a3a, x, th + 1.3, z, s * 0.62, 0.9, Math.PI / 4);
    };
    tower(W.minX, W.minZ, 2.2);
    tower(W.maxX, W.minZ, 2.2);
    tower(W.minX, W.maxZ, 2.2);
    tower(W.maxX, W.maxZ, 2.2);
    tower(-W.gateHalf - 0.6, W.maxZ, 1.6);
    tower(W.gateHalf + 0.6, W.maxZ, 1.6);
    const m = new THREE.Mesh(buildParts(p), vcMaterial());
    m.castShadow = true;
    m.receiveShadow = true;
    this.wallMesh = m;
    this.group.add(m);
  }

  private makeProps(quality: 'low' | 'high'): void {
    const rng = mulberry32(42);
    const lists: Partial<Record<PropKind, { x: number; z: number; ry: number; s: number }[]>> = {};
    const add = (k: PropKind, x: number, z: number, ry = rng() * Math.PI * 2, s = 1) => (lists[k] ??= []).push({ x, z, ry, s });
    const W = WALL;
    // Trees along the side and back walls inside the compound.
    for (let z = W.minZ + 1.6; z < 4; z += 3.4) {
      add('tree', W.minX + 1.1, z, undefined, 0.8 + rng() * 0.25);
      add('tree', W.maxX - 1.1, z + 1.2, undefined, 0.8 + rng() * 0.25);
    }
    for (let x = W.minX + 4; x < W.maxX - 3; x += 3.3) if (Math.abs(x) > 2.5) add('tree', x, W.minZ + 1.2, undefined, 0.75 + rng() * 0.2);
    // Lamps along the avenue and plaza.
    for (const z of [9.6, 13.4, 19.6]) {
      add('lamp', -2.4, z, 0);
      add('lamp', 2.4, z, 0);
    }
    for (const [x, z] of [[-6.9, -4.3], [6.9, -4.3], [-6.9, 5.4], [6.9, 5.4]]) add('lamp', x, z, 0);
    // Sandbag nests at the gate (outside) and by the towers.
    for (const x of [-6.2, -8.4, 6.2, 8.4]) add('sandbag', x, W.maxZ + 2.4, 0, 1);
    add('sandbag', -W.gateHalf - 2.4, W.maxZ - 1.6, Math.PI / 2);
    add('sandbag', W.gateHalf + 2.4, W.maxZ - 1.6, Math.PI / 2);
    for (const [x, z] of [[-4.6, W.maxZ + 3.2], [4.6, W.maxZ + 3.2], [-2.2, W.maxZ + 3.6], [2.2, W.maxZ + 3.6]]) add('cone', x, z);
    // Supplies in the courtyard.
    for (const [x, z] of [[-13, 18.2], [-12, 18.3], [-12.6, 19.2], [12.8, 18.4], [13, 21.8]]) add('crate', x, z, rng() * 0.6, 0.8);
    for (const [x, z] of [[-13.2, 21.7], [-12.4, 22], [12.2, 21.9], [13.2, 19.3]]) add('barrel', x, z, 0, 0.8);
    for (const [x, z] of [[-4.2, -12.2], [4.3, -12.4], [-13.2, -3.5], [13.3, -2.8]]) add('crate', x, z, rng(), 0.7);
    // Outskirts beyond the outer ring: pines, trees and rocks.
    const nPines = quality === 'high' ? 110 : 50;
    let guard = 0;
    while ((lists.pine?.length ?? 0) < nPines && guard++ < 5000) {
      const x = (rng() * 2 - 1) * 84;
      const z = (rng() * 2 - 1) * 92;
      if (Math.abs(x) < 51 && Math.abs(z) < 59) continue;
      if (Math.abs(x) < 4 && z > 0) continue; // keep the avenue clear
      add('pine', x, z, undefined, 0.9 + rng() * 0.9);
      if (rng() < 0.25) add('rock', x + 2, z + 1, undefined, 0.7 + rng() * 0.8);
    }

    for (const [kind, list] of Object.entries(lists) as [PropKind, { x: number; z: number; ry: number; s: number }[]][]) {
      const mesh = new THREE.InstancedMesh(propGeometry(kind), vcMaterial(), list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      list.forEach((it, i) => {
        e.set(0, it.ry, 0);
        q.setFromEuler(e);
        v.set(it.x, kind === 'pine' || kind === 'tree' ? 0.05 : 0.1, it.z);
        sc.setScalar(it.s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = kind !== 'rock';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
  }

  update(t: number): void {
    const pos = this.flagGeom.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const base = this.flagBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const k = x / 2.6;
      arr[i * 3 + 2] = Math.sin(x * 2.4 - t * 5.2 + y * 0.8) * 0.28 * k;
      arr[i * 3 + 1] = y - k * k * 0.12;
    }
    pos.needsUpdate = true;
  }
}

export const GATE_POS = GATE;
