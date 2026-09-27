// OWNER: world agent. Static world-map scenery built once per map seed:
// vertex-coloured terrain chunks, water, road ribbons and merged decor (forests, ruins, rocks) per chunk.
// Everything is split into CHUNKS x CHUNKS meshes so off-screen parts are frustum-culled.
import * as THREE from 'three';
import { HALF, MAP_TILES, TILE } from '../../data/world';
import { TK, type WorldTerrain } from '../../systems/world';
import { mulberry32 } from '../../core/rng';
import { propGeometry } from '../../three/models';
import { deadTreeGeometry, ruinGeometry, RUIN_VARIANTS, shrubGeometry } from './geo';

export const CHUNKS = 4;
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
  const col = new Float32Array(vn * vn * 3);
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
      col[v] = c.r;
      col[v + 1] = c.g;
      col[v + 2] = c.b;
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
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
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
class Batch {
  items: BatchItem[] = [];
  verts = 0;
  add(geom: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, sx: number, sy = sx, sz = sx): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    this.items.push({ geom, m });
    this.verts += geom.attributes.position.count;
  }
  build(): THREE.BufferGeometry | null {
    if (!this.items.length) return null;
    const pos = new Float32Array(this.verts * 3);
    const nor = new Float32Array(this.verts * 3);
    const col = new Float32Array(this.verts * 3);
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    let o = 0;
    for (const it of this.items) {
      const p = it.geom.attributes.position as THREE.BufferAttribute;
      const n = it.geom.attributes.normal as THREE.BufferAttribute | undefined;
      const c = it.geom.attributes.color as THREE.BufferAttribute | undefined;
      nm.getNormalMatrix(it.m);
      for (let i = 0; i < p.count; i++, o += 3) {
        v.fromBufferAttribute(p, i).applyMatrix4(it.m);
        pos[o] = v.x;
        pos[o + 1] = v.y;
        pos[o + 2] = v.z;
        if (n) {
          v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
          nor[o] = v.x;
          nor[o + 1] = v.y;
          nor[o + 2] = v.z;
        } else nor[o + 1] = 1;
        if (c) {
          col[o] = c.getX(i);
          col[o + 1] = c.getY(i);
          col[o + 2] = c.getZ(i);
        } else col[o] = col[o + 1] = col[o + 2] = 1;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const UP = new THREE.Vector3(0, 1, 0);

function buildDecor(t: WorldTerrain, quality: 'low' | 'high'): Batch[] {
  const batches: Batch[] = [];
  for (let i = 0; i < CHUNKS * CHUNKS; i++) batches.push(new Batch());
  const rng = mulberry32((t.seed ^ 0x1234567) >>> 0);
  const n = MAP_TILES;
  const per = n / CHUNKS;
  const hi = quality === 'high';
  const tree = propGeometry('tree');
  const pine = propGeometry('pine');
  const rock = propGeometry('rock');
  const wreck = propGeometry('car_wreck');
  const barrel = propGeometry('barrel');
  const crate = propGeometry('crate');
  const shrub = shrubGeometry();
  const dead = deadTreeGeometry();
  const hAt = (x: number, z: number) => {
    const i = Math.max(0, Math.min(t.gn - 1, Math.round((x + HALF) / t.step)));
    const j = Math.max(0, Math.min(t.gn - 1, Math.round((z + HALF) / t.step)));
    return t.height[j * t.gn + i];
  };
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const kind = t.kind[ty * n + tx];
      const b = batches[Math.floor(ty / per) * CHUNKS + Math.floor(tx / per)];
      const cx = -HALF + (tx + 0.5) * TILE;
      const cz = -HALF + (ty + 0.5) * TILE;
      const k = (ty * 2 + 1) * t.gn + tx * 2 + 1;
      switch (kind) {
        case TK.FOREST: {
          const count = (hi ? 3 : 2) + (rng() < 0.5 ? 1 : 0);
          const lush = t.moist[k] > 0.62;
          for (let q = 0; q < count; q++) {
            const x = cx + (rng() - 0.5) * TILE * 0.9;
            const z = cz + (rng() - 0.5) * TILE * 0.9;
            const s = 0.85 + rng() * 0.6;
            const g = rng() < (lush ? 0.35 : 0.65) ? pine : tree;
            b.add(g, x, hAt(x, z), z, rng() * 6.28, s, s * (0.9 + rng() * 0.3), s);
          }
          if (hi && rng() < 0.4) {
            const x = cx + (rng() - 0.5) * TILE;
            const z = cz + (rng() - 0.5) * TILE;
            b.add(shrub, x, hAt(x, z), z, rng() * 6.28, 0.8 + rng() * 0.6);
          }
          break;
        }
        case TK.RUIN: {
          const v = Math.floor(rng() * RUIN_VARIANTS);
          const yaw = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() - 0.5) * 0.2;
          const s = 0.85 + rng() * 0.3;
          b.add(ruinGeometry(v), cx + (rng() - 0.5) * 0.6, hAt(cx, cz), cz + (rng() - 0.5) * 0.6, yaw, s, s * (0.8 + rng() * 0.5), s);
          break;
        }
        case TK.RUBBLE: {
          if (rng() < 0.45) {
            const g = rng() < 0.5 ? wreck : rng() < 0.5 ? barrel : crate;
            const ox = (rng() < 0.5 ? -1 : 1) * TILE * 0.36;
            const oz = (rng() < 0.5 ? -1 : 1) * TILE * 0.36;
            b.add(g, cx + ox, hAt(cx + ox, cz + oz), cz + oz, rng() * 6.28, g === wreck ? 0.55 : 0.6);
          }
          break;
        }
        case TK.ROCK: {
          const count = 2 + Math.floor(rng() * 3);
          for (let q = 0; q < count; q++) {
            const x = cx + (rng() - 0.5) * TILE * 0.8;
            const z = cz + (rng() - 0.5) * TILE * 0.8;
            const s = 0.8 + rng() * 1.6;
            b.add(rock, x, hAt(x, z) - 0.1, z, rng() * 6.28, s, s * (0.7 + rng() * 0.6), s * (0.8 + rng() * 0.4));
          }
          if (rng() < 0.3) {
            const x = cx + (rng() - 0.5) * TILE * 0.6;
            const z = cz + (rng() - 0.5) * TILE * 0.6;
            b.add(dead, x, hAt(x, z), z, rng() * 6.28, 0.9 + rng() * 0.4);
          }
          break;
        }
        case TK.SHORE: {
          if (rng() < 0.25) {
            const x = cx + (rng() - 0.5) * TILE * 0.8;
            const z = cz + (rng() - 0.5) * TILE * 0.8;
            b.add(rng() < 0.5 ? shrub : rock, x, hAt(x, z), z, rng() * 6.28, 0.6 + rng() * 0.5);
          }
          break;
        }
        case TK.GRASS: {
          // keep the tile centre clear for entities: dress the corners only
          const p = hi ? 0.28 : 0.12;
          if (rng() < p) {
            const ox = (rng() < 0.5 ? -1 : 1) * TILE * (0.38 + rng() * 0.08);
            const oz = (rng() < 0.5 ? -1 : 1) * TILE * (0.38 + rng() * 0.08);
            const r = rng();
            const g = r < 0.55 ? shrub : r < 0.75 ? dead : r < 0.9 ? rock : tree;
            const s = g === rock ? 0.4 + rng() * 0.3 : g === tree ? 0.6 + rng() * 0.3 : 0.7 + rng() * 0.5;
            b.add(g, cx + ox, hAt(cx + ox, cz + oz), cz + oz, rng() * 6.28, s);
          }
          break;
        }
      }
    }
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
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ public

export interface TerrainView {
  group: THREE.Group;
  grid: THREE.LineSegments;
  water: THREE.Mesh;
  decorVerts: number;
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
  const skirtMat = new THREE.MeshLambertMaterial({ color: EDGE_HEX });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.receiveShadow = true;
  skirt.position.y = EDGE_Y;
  group.add(skirt);
  disposables.push(skirtGeo, skirtMat);
  // roads
  const roadGeo = buildRoads(t);
  const roads = new THREE.Mesh(roadGeo, sceneryMaterial());
  roads.receiveShadow = true;
  group.add(roads);
  disposables.push(roadGeo);
  // decor
  let decorVerts = 0;
  const batches = buildDecor(t, quality);
  batches.forEach((b, i) => {
    const g = b.build();
    if (!g) return;
    decorVerts += b.verts;
    const m = new THREE.Mesh(g, sceneryMaterial());
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'decor_' + i;
    group.add(m);
    disposables.push(g);
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
  return {
    group,
    grid,
    water,
    decorVerts,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
