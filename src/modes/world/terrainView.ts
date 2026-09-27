// OWNER: world agent. Static world-map scenery built once per map seed:
// vertex-coloured terrain chunks, water, road ribbons and merged decor (forests, ruins, rocks) per chunk.
// Everything is split into CHUNKS x CHUNKS meshes so off-screen parts are frustum-culled.
import * as THREE from 'three';
import { HALF, MAP_TILES, TILE } from '../../data/world';
import { TK, type WorldTerrain } from '../../systems/world';
import { mulberry32 } from '../../core/rng';
import { propGeometry } from '../../three/models';
import { deadTreeGeometry, mapPineGeometry, mapShrubGeometry, mapTreeGeometry, rockVariant, ROCK_VARIANTS, ruinedBlockBody, ruinGeometry, RUIN_VARIANTS } from './geo';
import { int8Normals, releaseAfterUpload } from './gpuMemory';

/** Terrain mesh chunks per side, and (finer) decor chunks per side, for frustum culling. */
export const CHUNKS = 4;
export const DECOR_CHUNKS = 8;
export const WATER_Y = -0.42;
/** Colour/height of the rocky ridge that rings the map (terrain edge blends into the outer skirt). */
const EDGE_HEX = 0x847b66;
const EDGE_Y = 2.6;

/** One shared flat-shaded vertex-colour material for all static scenery (independent of the art module's). */
let sceneryMat: THREE.MeshLambertMaterial | null = null;
export function sceneryMaterial(): THREE.MeshLambertMaterial {
  if (!sceneryMat) sceneryMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return sceneryMat;
}

const C = (hex: number) => new THREE.Color(hex);
const COL = {
  dry: C(0xa9a060),
  khaki: C(0xb9aa6e),
  green: C(0x7f9f48),
  lush: C(0x5f8a3c),
  dirt: C(0x967552),
  sand: C(0xcdbb8a),
  bed: C(0x46707a),
  rubble: C(0x85807a),
  rock: C(0x8a8174),
  verge: C(0x978a6a),
  baseGround: C(0xa3a095),
  edge: C(EDGE_HEX),
  asphalt: C(0x4b4a48),
  asphaltEdge: C(0x6b665c),
  stripe: C(0xe2c35a),
};

function hashf(i: number, j: number): number {
  let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 0..1 float -> normalized Uint8. */
function u8(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
}
function sm(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function vertexColor(t: WorldTerrain, i: number, j: number, out: THREE.Color): THREE.Color {
  const k = j * t.gn + i;
  const x = -HALF + i * t.step;
  const z = -HALF + j * t.step;
  const det = t.detail[k];
  out.copy(COL.dry).lerp(COL.khaki, det);
  out.lerp(COL.green, sm(0.47, 0.6, t.moist[k]));
  out.lerp(COL.lush, sm(0.57, 0.66, t.moist[k]) * 0.8);
  out.lerp(COL.dirt, sm(0.62, 0.78, 1 - det) * 0.55);
  const w = t.water[k];
  out.lerp(COL.sand, sm(0.02, 0.3, w));
  out.lerp(COL.bed, sm(0.4, 0.85, w));
  out.lerp(COL.rubble, t.city[k] * 0.85);
  out.lerp(COL.rock, Math.min(1, t.rock[k] * 1.4));
  out.lerp(COL.verge, (1 - sm(1.6, 4.2, t.road[k])) * (1 - w) * 0.7);
  const dB = Math.hypot(x, z);
  out.lerp(COL.baseGround, 1 - sm(15, 21, dB));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  out.lerp(COL.edge, sm(HALF - 8, HALF, edge));
  const jit = 0.93 + hashf(i, j) * 0.12 * (1 - sm(HALF - 4, HALF, edge));
  out.r *= jit;
  out.g *= jit;
  out.b *= jit;
  return out;
}

function buildTerrainChunk(t: WorldTerrain, ci: number, cj: number): THREE.Mesh {
  const cells = (t.gn - 1) / CHUNKS;
  const vn = cells + 1;
  const pos = new Float32Array(vn * vn * 3);
  const col = new Uint8Array(vn * vn * 3);
  const c = new THREE.Color();
  for (let y = 0; y < vn; y++) {
    for (let x = 0; x < vn; x++) {
      const i = ci * cells + x;
      const j = cj * cells + y;
      const v = (y * vn + x) * 3;
      pos[v] = -HALF + i * t.step;
      pos[v + 1] = t.height[j * t.gn + i];
      pos[v + 2] = -HALF + j * t.step;
      vertexColor(t, i, j, c);
      col[v] = u8(c.r);
      col[v + 1] = u8(c.g);
      col[v + 2] = u8(c.b);
    }
  }
  const idx: number[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const a = y * vn + x;
      const b = a + 1;
      const d = a + vn;
      const e = d + 1;
      // alternate the diagonal for a less regular low-poly look
      if ((x + y) % 2 === 0) idx.push(a, d, b, b, d, e);
      else idx.push(a, d, e, a, e, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(idx);
  g.computeVertexNormals();
  int8Normals(g);
  g.computeBoundingSphere();
  releaseAfterUpload(g);
  const m = new THREE.Mesh(g, sceneryMaterial());
  m.receiveShadow = true;
  m.castShadow = false;
  m.name = `terrain_${ci}_${cj}`;
  return m;
}

// ------------------------------------------------------------------ merged decor batches

interface BatchItem {
  geom: THREE.BufferGeometry;
  m: THREE.Matrix4;
}
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpNM = new THREE.Matrix3();
/**
 * Accumulates transformed copies of vertex-coloured geometries and merges them into one geometry.
 * Output is render-only: Float32 positions, normalized Int8 normals and normalized Uint8 colours
 * (18 bytes/vertex instead of 36) — don't merge it with other geometry.
 */
export class Batch {
  items: BatchItem[] = [];
  verts = 0;
  add(geom: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, sx: number, sy = sx, sz = sx): void {
    const m = new THREE.Matrix4();
    tmpQ.setFromAxisAngle(UP, yaw);
    m.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
    this.items.push({ geom, m });
    this.verts += geom.attributes.position.count;
  }
  build(): THREE.BufferGeometry | null {
    if (!this.items.length) return null;
    const pos = new Float32Array(this.verts * 3);
    const nor = new Int8Array(this.verts * 3);
    const col = new Uint8Array(this.verts * 3);
    let o = 0;
    for (const it of this.items) {
      const p = it.geom.attributes.position as THREE.BufferAttribute;
      const n = it.geom.attributes.normal as THREE.BufferAttribute | undefined;
      const c = it.geom.attributes.color as THREE.BufferAttribute | undefined;
      const e = it.m.elements;
      const ne = tmpNM.getNormalMatrix(it.m).elements;
      // fast paths for the common layouts (plain float positions/normals, Uint8 or float colours)
      const pa = p.array instanceof Float32Array && !p.normalized && p.itemSize === 3 ? p.array : null;
      const na = n && n.array instanceof Float32Array && !n.normalized && n.itemSize === 3 ? n.array : null;
      const cu8 = c && c.array instanceof Uint8Array && c.normalized && c.itemSize === 3 ? c.array : null;
      const cf = c && c.array instanceof Float32Array && !c.normalized && c.itemSize === 3 ? c.array : null;
      for (let i = 0; i < p.count; i++, o += 3) {
        const k = i * 3;
        const x = pa ? pa[k] : p.getX(i);
        const y = pa ? pa[k + 1] : p.getY(i);
        const z = pa ? pa[k + 2] : p.getZ(i);
        pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (n) {
          const a = na ? na[k] : n.getX(i);
          const b = na ? na[k + 1] : n.getY(i);
          const d = na ? na[k + 2] : n.getZ(i);
          const nx = ne[0] * a + ne[3] * b + ne[6] * d;
          const ny = ne[1] * a + ne[4] * b + ne[7] * d;
          const nz = ne[2] * a + ne[5] * b + ne[8] * d;
          const l = 127 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
          nor[o] = Math.round(nx * l);
          nor[o + 1] = Math.round(ny * l);
          nor[o + 2] = Math.round(nz * l);
        } else nor[o + 1] = 127;
        if (cu8) {
          col[o] = cu8[k];
          col[o + 1] = cu8[k + 1];
          col[o + 2] = cu8[k + 2];
        } else if (cf) {
          col[o] = u8(cf[k]);
          col[o + 1] = u8(cf[k + 1]);
          col[o + 2] = u8(cf[k + 2]);
        } else if (c) {
          col[o] = u8(c.getX(i));
          col[o + 1] = u8(c.getY(i));
          col[o + 2] = u8(c.getZ(i));
        } else col[o] = col[o + 1] = col[o + 2] = 255;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.computeBoundingSphere();
    return g;
  }
}
const UP = new THREE.Vector3(0, 1, 0);

function buildDecor(t: WorldTerrain, quality: 'low' | 'high'): Batch[] {
  const batches: Batch[] = [];
  for (let i = 0; i < DECOR_CHUNKS * DECOR_CHUNKS; i++) batches.push(new Batch());
  const rng = mulberry32((t.seed ^ 0x1234567) >>> 0);
  const n = MAP_TILES;
  const per = n / DECOR_CHUNKS;
  const hi = quality === 'high';
  const trees = [mapTreeGeometry(0), mapTreeGeometry(1)];
  const pines = [mapPineGeometry(0), mapPineGeometry(1)];
  const tree = trees[0];
  const bush = mapShrubGeometry();
  const grass = propGeometry('grass');
  const debris = [propGeometry('car_wreck'), propGeometry('barrel'), propGeometry('tire'), propGeometry('crate'), propGeometry('roadblock')];
  const artRuin = propGeometry('ruin');
  const dead = deadTreeGeometry();
  const rock = (r: number) => rockVariant(Math.floor(r * ROCK_VARIANTS));
  const chunkOf = (tx: number, ty: number) => batches[Math.floor(ty / per) * DECOR_CHUNKS + Math.floor(tx / per)];
  const hAt = (x: number, z: number) => {
    const i = Math.max(0, Math.min(t.gn - 1, Math.round((x + HALF) / t.step)));
    const j = Math.max(0, Math.min(t.gn - 1, Math.round((z + HALF) / t.step)));
    return t.height[j * t.gn + i];
  };
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const kind = t.kind[ty * n + tx];
      const b = chunkOf(tx, ty);
      const cx = -HALF + (tx + 0.5) * TILE;
      const cz = -HALF + (ty + 0.5) * TILE;
      const k = (ty * 2 + 1) * t.gn + tx * 2 + 1;
      switch (kind) {
        case TK.FOREST: {
          const count = (hi ? 2 : 1) + (rng() < 0.55 ? 1 : 0);
          const lush = t.moist[k] > 0.62;
          for (let q = 0; q < count; q++) {
            const x = cx + (rng() - 0.5) * TILE * 0.9;
            const z = cz + (rng() - 0.5) * TILE * 0.9;
            const s = 1.05 + rng() * 0.6;
            const g = rng() < (lush ? 0.35 : 0.65) ? pines[q & 1] : trees[q & 1];
            b.add(g, x, hAt(x, z), z, rng() * 6.28, s, s * (0.9 + rng() * 0.3), s);
          }
          if (hi && rng() < 0.5) {
            const x = cx + (rng() - 0.5) * TILE;
            const z = cz + (rng() - 0.5) * TILE;
            b.add(bush, x, hAt(x, z), z, rng() * 6.28, 0.9 + rng() * 0.6);
          }
          break;
        }
        case TK.RUIN: {
          const yaw = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() - 0.5) * 0.2;
          const s = 0.85 + rng() * 0.3;
          if (rng() < 0.35) b.add(artRuin, cx, hAt(cx, cz), cz, yaw, 1.1 + rng() * 0.3);
          else b.add(ruinGeometry(Math.floor(rng() * RUIN_VARIANTS)), cx + (rng() - 0.5) * 0.6, hAt(cx, cz), cz + (rng() - 0.5) * 0.6, yaw, s, s * (0.8 + rng() * 0.5), s);
          break;
        }
        case TK.RUBBLE: {
          if (rng() < 0.5) {
            const g = debris[Math.floor(rng() * debris.length)];
            const ox = (rng() < 0.5 ? -1 : 1) * TILE * 0.36;
            const oz = (rng() < 0.5 ? -1 : 1) * TILE * 0.36;
            b.add(g, cx + ox, hAt(cx + ox, cz + oz), cz + oz, rng() * 6.28, g === debris[0] ? 0.6 : 0.75);
          }
          break;
        }
        case TK.ROCK: {
          const count = (hi ? 2 : 1) + (rng() < 0.4 ? 1 : 0);
          for (let q = 0; q < count; q++) {
            const x = cx + (rng() - 0.5) * TILE * 0.8;
            const z = cz + (rng() - 0.5) * TILE * 0.8;
            const s = 1.3 + rng() * 2.2;
            b.add(rock(rng()), x, hAt(x, z) - 0.15, z, rng() * 6.28, s, s * (0.6 + rng() * 0.6), s * (0.8 + rng() * 0.4));
          }
          if (rng() < 0.25) {
            const x = cx + (rng() - 0.5) * TILE * 0.6;
            const z = cz + (rng() - 0.5) * TILE * 0.6;
            b.add(dead, x, hAt(x, z), z, rng() * 6.28, 0.9 + rng() * 0.4);
          }
          break;
        }
        case TK.SHORE: {
          if (rng() < 0.35) {
            const x = cx + (rng() - 0.5) * TILE * 0.8;
            const z = cz + (rng() - 0.5) * TILE * 0.8;
            const r = rng();
            b.add(r < 0.45 ? bush : r < 0.75 ? grass : rock(rng()), x, hAt(x, z), z, rng() * 6.28, 0.7 + rng() * 0.5);
          }
          break;
        }
        case TK.GRASS: {
          // keep the tile centre clear for entities: dress the corners only
          const p = hi ? 0.34 : 0.14;
          if (rng() < p) {
            const ox = (rng() < 0.5 ? -1 : 1) * TILE * (0.38 + rng() * 0.08);
            const oz = (rng() < 0.5 ? -1 : 1) * TILE * (0.38 + rng() * 0.08);
            const r = rng();
            const x = cx + ox;
            const z = cz + oz;
            if (r < 0.35) b.add(grass, x, hAt(x, z), z, rng() * 6.28, 0.9 + rng() * 0.5);
            else if (r < 0.65) b.add(bush, x, hAt(x, z), z, rng() * 6.28, 0.7 + rng() * 0.5);
            else if (r < 0.8) b.add(dead, x, hAt(x, z), z, rng() * 6.28, 0.8 + rng() * 0.3);
            else if (r < 0.92) b.add(rock(rng()), x, hAt(x, z) - 0.05, z, rng() * 6.28, 0.5 + rng() * 0.4);
            else b.add(tree, x, hAt(x, z), z, rng() * 6.28, 0.7 + rng() * 0.3);
          }
          break;
        }
      }
    }
  }
  // ruined 12x12 city blocks from the art library
  for (const bl of t.blocks) {
    const body = ruinedBlockBody(bl.seed);
    if (!body) continue;
    const x = -HALF + (bl.tx + 0.5) * TILE;
    const z = -HALF + (bl.ty + 0.5) * TILE;
    chunkOf(bl.tx, bl.ty).add(body.geom, x, hAt(x, z), z, body.rotY, 1);
  }
  return batches;
}
// ------------------------------------------------------------------ roads

function buildRoads(t: WorldTerrain): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const pushQuad = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number, y: number, c: THREE.Color) => {
    // a-b along the left edge (+normal side), c-d along the right edge; wound to face +Y
    pos.push(ax, y, az, bx, y, bz, cx, y, cz, bx, y, bz, dx, y, dz, cx, y, cz);
    const r = u8(c.r);
    const gg = u8(c.g);
    const b = u8(c.b);
    for (let i = 0; i < 6; i++) col.push(r, gg, b);
  };
  const W = 1.35;
  const E = 1.65;
  for (const line of t.roads) {
    const pts: { x: number; z: number; nx: number; nz: number }[] = [];
    const count = line.length / 2;
    for (let i = 0; i < count; i++) {
      const x = line[i * 2];
      const z = line[i * 2 + 1];
      const p0 = Math.max(0, i - 1);
      const p1 = Math.min(count - 1, i + 1);
      let dx = line[p1 * 2] - line[p0 * 2];
      let dz = line[p1 * 2 + 1] - line[p0 * 2 + 1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      pts.push({ x, z, nx: -dz, nz: dx });
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      // verges (lighter) then asphalt
      pushQuad(a.x + a.nx * E, a.z + a.nz * E, b.x + b.nx * E, b.z + b.nz * E, a.x + a.nx * W, a.z + a.nz * W, b.x + b.nx * W, b.z + b.nz * W, 0.045, COL.asphaltEdge);
      pushQuad(a.x - a.nx * W, a.z - a.nz * W, b.x - b.nx * W, b.z - b.nz * W, a.x - a.nx * E, a.z - a.nz * E, b.x - b.nx * E, b.z - b.nz * E, 0.045, COL.asphaltEdge);
      pushQuad(a.x + a.nx * W, a.z + a.nz * W, b.x + b.nx * W, b.z + b.nz * W, a.x - a.nx * W, a.z - a.nz * W, b.x - b.nx * W, b.z - b.nz * W, 0.05, COL.asphalt);
      // dashed centre line
      const segLen = Math.hypot(b.x - a.x, b.z - a.z);
      const dx = (b.x - a.x) / (segLen || 1);
      const dz = (b.z - a.z) / (segLen || 1);
      const nx = -dz * 0.09;
      const nz = dx * 0.09;
      for (let s = 0.6; s + 1.2 < segLen; s += 3.2) {
        const sx = a.x + dx * s;
        const sz = a.z + dz * s;
        const ex = sx + dx * 1.3;
        const ez = sz + dz * 1.3;
        pushQuad(sx + nx, sz + nz, ex + nx, ez + nz, sx - nx, sz - nz, ex - nx, ez - nz, 0.06, COL.stripe);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(col), 3, true));
  g.computeVertexNormals();
  int8Normals(g);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ public

export interface TerrainView {
  group: THREE.Group;
  grid: THREE.LineSegments;
  water: THREE.Mesh;
  /** Vertices of decor built so far. */
  decorVerts: number;
  /** Merged decor chunk meshes built so far (shadow casting is toggled by zoom). */
  decor: THREE.Mesh[];
  /** Decor chunks not merged yet. */
  readonly pendingDecor: number;
  /**
   * Merges pending decor chunks nearest to (x, z) until `budgetMs` is spent (always at least one).
   * Returns how many chunk meshes were added.
   */
  buildDecorStep(budgetMs: number, x: number, z: number, cast: boolean): number;
  dispose(): void;
}

export function buildTerrainView(t: WorldTerrain, quality: 'low' | 'high'): TerrainView {
  const group = new THREE.Group();
  group.name = 'worldTerrain';
  const disposables: { dispose(): void }[] = [];
  for (let cj = 0; cj < CHUNKS; cj++) {
    for (let ci = 0; ci < CHUNKS; ci++) {
      const m = buildTerrainChunk(t, ci, cj);
      disposables.push(m.geometry);
      group.add(m);
    }
  }
  // water sheet across the map; the ground dips below it where there are lakes/rivers
  const waterGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x3e93b8, specular: 0x9ad8ff, shininess: 60, transparent: true, opacity: 0.88 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  water.renderOrder = 1;
  group.add(water);
  disposables.push(waterGeo, waterMat);
  // wasteland skirt outside the playable map: a ring level with the rocky border ridge
  const O = HALF * 6;
  const strips: [number, number, number, number][] = [
    [-O, O, -O, -HALF],
    [-O, O, HALF, O],
    [-O, -HALF, -HALF, HALF],
    [HALF, O, -HALF, HALF],
  ];
  const sp: number[] = [];
  for (const [x0, x1, z0, z1] of strips) sp.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  skirtGeo.computeVertexNormals();
  releaseAfterUpload(skirtGeo);
  const skirtMat = new THREE.MeshLambertMaterial({ color: EDGE_HEX });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.receiveShadow = true;
  skirt.position.y = EDGE_Y;
  group.add(skirt);
  disposables.push(skirtGeo, skirtMat);
  // roads
  const roadGeo = releaseAfterUpload(buildRoads(t));
  const roads = new THREE.Mesh(roadGeo, sceneryMaterial());
  roads.receiveShadow = true;
  group.add(roads);
  disposables.push(roadGeo);
  // decor: placement is cheap and done now; merging the (~0.5M vertex) chunk meshes is streamed in over the
  // first frames, nearest to the camera first (see buildDecorStep), so entering the map doesn't stall.
  const decor: THREE.Mesh[] = [];
  const pending: { batch: Batch; i: number; x: number; z: number }[] = [];
  const span = (HALF * 2) / DECOR_CHUNKS;
  buildDecor(t, quality).forEach((batch, i) => {
    if (!batch.items.length) return;
    pending.push({ batch, i, x: -HALF + ((i % DECOR_CHUNKS) + 0.5) * span, z: -HALF + (Math.floor(i / DECOR_CHUNKS) + 0.5) * span });
  });
  // faint tile grid (tactical-map feel), faded in when zoomed in
  const gp: number[] = [];
  for (let i = 0; i <= MAP_TILES; i++) {
    const v = -HALF + i * TILE;
    gp.push(-HALF, 0, v, HALF, 0, v, v, 0, -HALF, v, 0, HALF);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: 0x1a1a10, transparent: true, opacity: 0.1, depthWrite: false });
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  grid.position.y = 0.08;
  grid.renderOrder = 2;
  group.add(grid);
  disposables.push(gridGeo, gridMat);
  const view: TerrainView = {
    group,
    grid,
    water,
    decorVerts: 0,
    decor,
    get pendingDecor() {
      return pending.length;
    },
    buildDecorStep(budgetMs, x, z, cast) {
      const start = performance.now();
      let built = 0;
      while (pending.length && (built === 0 || performance.now() - start < budgetMs)) {
        let k = 0;
        let best = Infinity;
        for (let j = 0; j < pending.length; j++) {
          const d = (pending[j].x - x) ** 2 + (pending[j].z - z) ** 2;
          if (d < best) {
            best = d;
            k = j;
          }
        }
        const { batch, i } = pending[k];
        pending.splice(k, 1);
        const g = batch.build();
        if (!g) continue;
        built++;
        // static, never picked (the map uses screen-space picking): the GPU copy is enough
        releaseAfterUpload(g);
        view.decorVerts += batch.verts;
        const m = new THREE.Mesh(g, sceneryMaterial());
        m.castShadow = cast;
        m.receiveShadow = true;
        m.name = 'decor_' + i;
        group.add(m);
        decor.push(m);
        disposables.push(g);
      }
      return built;
    },
    dispose() {
      pending.length = 0;
      for (const d of disposables) d.dispose();
    },
  };
  return view;
}
