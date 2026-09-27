// OWNER: base agent. Zombie-infested district blocks around the compound: ground lots, ruins, animated
// fog, instanced zombies, and the "district cleared" reveal (fog lifts, zombies drop, land is reclaimed).
import * as THREE from 'three';
import { ruinedBlockModel, vcMaterial, zombieGeometry } from '../../three/models';
import { mulberry32 } from '../../core/rng';
import { DISTRICTS, DISTRICT_SIZE, PLOTS, type DistrictDef } from '../../data/buildings';
import { PartList, buildParts, mergeAll, normalizeGeometry } from './geo';

const LOT = DISTRICT_SIZE - 3.2; // usable lot inside the streets
const FOG_LAYERS = [0.35, 1.25, 2.3, 3.6];
const REVEAL_S = 2.8;

const COL_INFESTED = new THREE.Color(0x565a4c);
const COL_CLEARED = new THREE.Color(0x9ccd66);
const COL_NEXT = new THREE.Color(0x6a5f4c);


// ---------------------------------------------------------------------------------------------
// Procedural ruins / cleared decor
// ---------------------------------------------------------------------------------------------

const RUIN_WALLS = [0x6a655d, 0x5e5a55, 0x6f6257, 0x585d61, 0x74695c];
const RUBBLE = [0x6e6a62, 0x5c5852, 0x7a7266, 0x4f4c47];

function ruinFallback(d: DistrictDef): THREE.BufferGeometry {
  const rng = mulberry32(1000 + d.id * 97);
  const p = new PartList();
  const r = (a: number, b: number) => a + rng() * (b - a);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const half = LOT / 2 - 1;
  // Wrecked buildings in 2-3 of the 4 quadrants.
  const quads = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].sort(() => rng() - 0.5);
  const nb = 2 + (rng() < 0.55 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    const [qx, qz] = quads[i];
    const w = r(2.8, 4.6);
    const dd = r(2.8, 4.6);
    const h = r(2.2, 6.2);
    const x = d.x + qx * r(2.2, half - w / 2);
    const z = d.z + qz * r(2.2, half - dd / 2);
    const col = pick(RUIN_WALLS);
    const ry = r(-0.08, 0.08);
    p.slab(col, x, 0, z, w, h * 0.72, dd, ry);
    // Jagged broken top.
    p.slab(col, x - w * 0.22, h * 0.72, z - dd * 0.2, w * 0.5, h * 0.28, dd * 0.55, ry);
    p.slab(col, x + w * 0.3, h * 0.72, z + dd * 0.25, w * 0.32, h * r(0.08, 0.2), dd * 0.4, ry);
    // Dark window bands.
    for (let f = 0.8; f < h * 0.7; f += 1.3) p.box(0x2d2f31, x, f + 0.4, z + dd / 2 + 0.02, w * 0.8, 0.35, 0.05, ry);
    // Collapsed slab leaning against the wall.
    p.box(0x7c776d, x + w * 0.55, 0.9, z, 0.25, 2.2, dd * 0.7, ry, 0, 0.5);
    // Scorch mark roof.
    p.box(0x3a3632, x - w * 0.22, h + 0.01, z - dd * 0.2, w * 0.4, 0.04, dd * 0.4, ry);
  }
  // Rubble.
  const nr = 6 + Math.floor(rng() * 5);
  for (let i = 0; i < nr; i++) {
    const s = r(0.5, 1.5);
    p.blob(pick(RUBBLE), d.x + r(-half, half), s * 0.2, d.z + r(-half, half), s * 1.3, s * 0.55, s, r(0, 3));
  }
  // Burnt-out car.
  {
    const x = d.x + r(-half + 2, half - 2);
    const z = d.z + r(-half + 2, half - 2);
    const ry = r(0, Math.PI);
    const rust = pick([0x7a4a36, 0x5d4a3e, 0x6b5a48]);
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    p.box(rust, x, 0.55, z, 1.5, 0.5, 2.8, ry);
    p.box(0x3b3531, x - sn * 0.2, 0.98, z - cs * 0.2, 1.3, 0.4, 1.3, ry);
    for (const [ox, oz] of [
      [-0.72, 0.9],
      [0.72, 0.9],
      [-0.72, -0.9],
      [0.72, -0.9],
    ]) {
      p.cyl(0x1f1f1f, x + ox * cs + oz * sn, 0.3, z - ox * sn + oz * cs, 0.3, 0.22, 0, Math.PI / 2);
    }
  }
  // Barrels, crates, a burning barrel.
  for (let i = 0; i < 3; i++) p.cyl(pick([0x6a3a2a, 0x4e5a3a, 0x5a4a3a]), d.x + r(-half, half), 0.45, d.z + r(-half, half), 0.34, 0.9);
  for (let i = 0; i < 2; i++) p.slab(0x6d5a44, d.x + r(-half, half), 0, d.z + r(-half, half), 0.8, 0.7, 0.8, r(0, 1));
  {
    const x = d.x + r(-half, half);
    const z = d.z + r(-half, half);
    p.cyl(0x3d3a38, x, 0.45, z, 0.36, 0.9);
    p.cone(0xff8a2a, x, 1.25, z, 0.3, 0.8);
    p.cone(0xffd24a, x, 1.15, z, 0.18, 0.5);
  }
  // Dead trees.
  for (let i = 0; i < 2; i++) {
    const x = d.x + r(-half, half);
    const z = d.z + r(-half, half);
    p.cyl(0x4a3a2c, x, 1.1, z, 0.14, 2.2);
    p.box(0x4a3a2c, x + 0.35, 1.8, z, 0.08, 0.9, 0.08, 0, 0, -0.8);
    p.box(0x4a3a2c, x - 0.3, 1.5, z, 0.08, 0.7, 0.08, 0, 0, 0.9);
  }
  // Broken barricade.
  {
    const x = d.x + r(-half, half);
    const z = d.z + r(-half, half);
    const ry = r(0, Math.PI);
    p.box(0x5d4b38, x, 0.5, z, 2.4, 0.18, 0.1, ry, 0, 0.3);
    p.box(0x5d4b38, x, 0.8, z, 2.2, 0.18, 0.1, ry, 0, -0.15);
  }
  return buildParts(p);
}

const WHITE = new THREE.Color(0xffffff);

/** Ruined block for a district: the art kit's block body (its own haze child is replaced by our fog layer). */
function ruinGeometry(d: DistrictDef): THREE.BufferGeometry {
  try {
    const grp = ruinedBlockModel(d.id * 7 + 3);
    const body = grp.getObjectByName('body') as THREE.Mesh | undefined;
    if (body?.geometry) {
      body.updateMatrix();
      const g = normalizeGeometry(body.geometry, body.matrix, WHITE);
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const size = Math.max(0.1, bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      const s = Math.min(1.05, LOT / size);
      g.translate(-(bb.max.x + bb.min.x) / 2, 0, -(bb.max.z + bb.min.z) / 2);
      g.scale(s, 1, s);
      g.translate(d.x, 0, d.z);
      return g;
    }
  } catch (e) {
    console.warn('ruinedBlockModel failed, using fallback ruins', e);
  }
  return ruinFallback(d);
}

function decorGeometry(d: DistrictDef): THREE.BufferGeometry {
  const rng = mulberry32(5000 + d.id * 31);
  const p = new PartList();
  const r = (a: number, b: number) => a + rng() * (b - a);
  const half = LOT / 2 - 0.9;
  const plots = PLOTS.filter((pl) => pl.district === d.id);
  const clearOfPlots = (x: number, z: number) => plots.every((pl) => Math.abs(pl.x - x) > 2.4 || Math.abs(pl.z - z) > 2.4);
  const scatter = (n: number, place: (x: number, z: number) => void) => {
    let guard = 0;
    let k = 0;
    while (k < n && guard++ < 80) {
      const x = d.x + r(-half, half);
      const z = d.z + r(-half, half);
      if (!clearOfPlots(x, z)) continue;
      k++;
      place(x, z);
    }
  };
  // Freshly planted trees, bushes and grass on the reclaimed lot.
  scatter(3, (x, z) => p.prop(rng() < 0.7 ? 'tree' : 'pine', x, 0.05, z, r(0, 6), r(0.75, 1.05)));
  scatter(5, (x, z) => p.prop('bush', x, 0.05, z, r(0, 6), r(0.8, 1.2)));
  scatter(7, (x, z) => p.prop('grass', x, 0.05, z, r(0, 6), r(0.8, 1.3)));
  // A salvage corner: survivors' tent or a container, crates and a barrel.
  const sx = rng() < 0.5 ? -1 : 1;
  const sz = rng() < 0.5 ? -1 : 1;
  const ex = d.x + sx * (half - 0.9);
  const ez = d.z + sz * (half - 0.9);
  if (clearOfPlots(ex, ez)) {
    if (rng() < 0.5) p.prop('tent', ex, 0.05, ez, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0.9);
    else p.prop('container', ex, 0.05, ez, Math.PI / 2, 0.8);
    p.prop('crate', ex - sx * 1.6, 0.05, ez, r(0, 1), 0.75);
    p.prop('ammo_crate', ex - sx * 1.5, 0.05, ez - sz * 1.1, r(0, 1), 0.9);
    p.prop('barrel', ex, 0.05, ez - sz * 1.6, 0, 0.8);
  }
  // Flower strip along one sidewalk.
  for (let i = 0; i < 5; i++) p.blob(i % 2 ? 0xffd35a : 0xff7a8a, d.x - half + 0.5 + i * 0.55, 0.22, d.z - sz * (half + 0.2), 0.32, 0.28, 0.32);
  return buildParts(p);
}

function chunkKey(d: DistrictDef): string {
  if (d.ring === 1) return d.z < 0 ? 'r1n' : 'r1s';
  if (d.z <= -48) return 'r2n';
  if (d.z >= 48) return 'r2s';
  return d.x < 0 ? 'r2w' : 'r2e';
}

// ---------------------------------------------------------------------------------------------
// Fog shader (instanced, per-instance fade)
// ---------------------------------------------------------------------------------------------

function fogMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x5e6e58) } },
    vertexShader: /* glsl */ `
      attribute float aFade;
      varying float vFade;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vFade = aFade;
        vUv = uv;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying float vFade;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.16, min(e.x, e.y));
        float n = sin(vWorld.x * 0.42 + uTime * 0.5) * sin(vWorld.z * 0.37 - uTime * 0.38)
                + 0.5 * sin((vWorld.x + vWorld.z) * 0.9 + uTime * 0.9);
        float a = (0.27 + 0.09 * n) * edge * vFade;
        gl_FragColor = vec4(uColor + 0.05 * n, a);
      }`,
  });
}

// ---------------------------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------------------------

interface Zombie {
  d: number; // district index (0-based)
  hx: number;
  hz: number;
  r: number;
  w: number;
  ph: number;
  brute: boolean;
  idx: number; // instance index within its mesh
}

export class DistrictLayer {
  readonly group = new THREE.Group();
  private tiles: THREE.InstancedMesh;
  private fog: THREE.InstancedMesh;
  private fogFade: THREE.InstancedBufferAttribute;
  private fogMat: THREE.ShaderMaterial;
  private walkers: THREE.InstancedMesh;
  private brutes: THREE.InstancedMesh;
  private zombies: Zombie[] = [];
  private chunkMeshes: THREE.Mesh[] = [];
  private ruinCache = new Map<number, THREE.BufferGeometry>();
  private decorCache = new Map<number, THREE.BufferGeometry>();
  private marker: THREE.Mesh;
  /** Number of districts shown as cleared (may lag behind the game during a reveal). */
  cleared = 0;
  private reveal: { d: number; t: number; ruins: THREE.Mesh; decor: THREE.Mesh; onDone?: () => void } | null = null;

  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(
    private readonly quality: 'low' | 'high',
    cleared: number,
  ) {
    const n = DISTRICTS.length;
    // Ground lots.
    // Lot top sits at y=0.05, just under the ruined blocks' own asphalt (0.08) so the ruins show their
    // ground while infested; once the ruins sink during a reveal, the (brightening) lot shows through.
    const tileGeom = new THREE.BoxGeometry(LOT + 0.4, 0.1, LOT + 0.4);
    this.tiles = new THREE.InstancedMesh(tileGeom, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.tiles.receiveShadow = true;
    DISTRICTS.forEach((d, i) => {
      this.m4.makeTranslation(d.x, 0, d.z);
      this.tiles.setMatrixAt(i, this.m4);
      this.tiles.setColorAt(i, COL_INFESTED);
    });
    this.group.add(this.tiles);

    // Fog planes.
    const fogGeom = new THREE.PlaneGeometry(DISTRICT_SIZE + 1.5, DISTRICT_SIZE + 1.5);
    fogGeom.rotateX(-Math.PI / 2);
    this.fogMat = fogMaterial();
    this.fog = new THREE.InstancedMesh(fogGeom, this.fogMat, n * FOG_LAYERS.length);
    this.fogFade = new THREE.InstancedBufferAttribute(new Float32Array(n * FOG_LAYERS.length), 1);
    fogGeom.setAttribute('aFade', this.fogFade);
    DISTRICTS.forEach((d, i) => {
      FOG_LAYERS.forEach((h, l) => {
        this.m4.makeTranslation(d.x, h, d.z);
        this.fog.setMatrixAt(i * FOG_LAYERS.length + l, this.m4);
        this.fogFade.setX(i * FOG_LAYERS.length + l, 1);
      });
    });
    this.fog.renderOrder = 5;
    this.fog.frustumCulled = false;
    this.group.add(this.fog);

    // Zombies (denser in the inner ring the camera usually looks at).
    const rng = mulberry32(99);
    let wi = 0;
    let bi = 0;
    // Instances are laid out from the LAST district to the first: districts are cleared in order, so the
    // live zombies always occupy instances [0, count) and cleared ones are simply not drawn.
    [...DISTRICTS].reverse().forEach((d) => {
      const di = d.id - 1;
      const perD = quality === 'high' ? (d.ring === 1 ? 6 : 4) : d.ring === 1 ? 3 : 2;
      for (let k = 0; k < perD + 1; k++) {
        const brute = k === perD;
        this.zombies.push({
          d: di,
          hx: d.x + (rng() * 2 - 1) * (LOT / 2 - 2),
          hz: d.z + (rng() * 2 - 1) * (LOT / 2 - 2),
          r: 0.8 + rng() * 2,
          w: (brute ? 0.12 : 0.18) + rng() * 0.25,
          ph: rng() * Math.PI * 2,
          brute,
          idx: brute ? bi++ : wi++,
        });
      }
    });
    this.walkers = new THREE.InstancedMesh(zombieGeometry('walker'), vcMaterial(), wi);
    this.brutes = new THREE.InstancedMesh(zombieGeometry('brute'), vcMaterial(), bi);
    for (const m of [this.walkers, this.brutes]) {
      m.castShadow = false; // small and under fog: not worth a shadow pass
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }

    // Pulsing "next target" ring.
    const ringGeom = new THREE.RingGeometry(LOT / 2 - 0.2, LOT / 2 + 0.35, 4, 1);
    ringGeom.rotateX(-Math.PI / 2);
    ringGeom.rotateY(Math.PI / 4);
    this.marker = new THREE.Mesh(
      ringGeom,
      new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.marker.scale.set(Math.SQRT2, 1, Math.SQRT2);
    this.marker.renderOrder = 6;
    this.group.add(this.marker);

    this.setCleared(cleared);
  }

  private ruin(i: number): THREE.BufferGeometry {
    let g = this.ruinCache.get(i);
    if (!g) {
      const d = DISTRICTS[i];
      // Low quality: the far ring uses the lighter procedural ruins.
      g = this.quality === 'low' && d.ring > 1 ? ruinFallback(d) : ruinGeometry(d);
      this.ruinCache.set(i, g);
    }
    return g;
  }

  private decor(i: number): THREE.BufferGeometry {
    let g = this.decorCache.get(i);
    if (!g) this.decorCache.set(i, (g = decorGeometry(DISTRICTS[i])));
    return g;
  }

  /**
   * Rebuilds merged ruin/decor meshes for a cleared count (optionally leaving one district out).
   * Merged per chunk (ring 1 north/south, ring 2 four sides) so off-screen chunks are frustum-culled;
   * only the inner ring casts shadows.
   */
  private rebuild(cleared: number, skip = -1): void {
    for (const m of this.chunkMeshes) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.chunkMeshes.length = 0;
    const chunks = new Map<string, { ruins: THREE.BufferGeometry[]; decor: THREE.BufferGeometry[]; inner: boolean }>();
    DISTRICTS.forEach((d, i) => {
      if (i === skip) return;
      const key = chunkKey(d);
      let c = chunks.get(key);
      if (!c) chunks.set(key, (c = { ruins: [], decor: [], inner: d.ring === 1 }));
      if (i < cleared) c.decor.push(this.decor(i));
      else c.ruins.push(this.ruin(i));
    });
    for (const c of chunks.values()) {
      for (const list of [c.ruins, c.decor]) {
        const g = mergeAll(list);
        if (!g) continue;
        const m = new THREE.Mesh(g, vcMaterial());
        m.castShadow = c.inner;
        m.receiveShadow = true;
        this.group.add(m);
        this.chunkMeshes.push(m);
      }
    }
  }

  /** Instantly shows `n` cleared districts. */
  setCleared(n: number): void {
    this.finishReveal();
    this.cleared = Math.max(0, Math.min(DISTRICTS.length, n));
    DISTRICTS.forEach((_, i) => {
      const c = i < this.cleared;
      this.tiles.setColorAt(i, c ? COL_CLEARED : i === this.cleared ? COL_NEXT : COL_INFESTED);
      for (let l = 0; l < FOG_LAYERS.length; l++) this.fogFade.setX(i * FOG_LAYERS.length + l, c ? 0 : 1);
    });
    this.tiles.instanceColor!.needsUpdate = true;
    this.fogFade.needsUpdate = true;
    this.rebuild(this.cleared);
    this.updateMarker();
  }

  private updateMarker(): void {
    const next = DISTRICTS[this.cleared];
    this.marker.visible = !!next && !this.reveal;
    if (next) this.marker.position.set(next.x, 0.2, next.z);
  }

  /** Plays the reclaim animation for district `id` (1-based) — must be cleared+1. */
  startReveal(id: number, onDone?: () => void): void {
    this.finishReveal();
    const i = id - 1;
    if (i < 0 || i >= DISTRICTS.length) return;
    this.cleared = Math.max(this.cleared, i + 1);
    this.rebuild(this.cleared, i);
    const ruins = new THREE.Mesh(this.ruin(i), vcMaterial());
    const decor = new THREE.Mesh(this.decor(i), vcMaterial());
    // Both meshes use cached per-district geometry (never disposed here).
    ruins.castShadow = decor.castShadow = true;
    decor.visible = false;
    this.group.add(ruins, decor);
    this.reveal = { d: i, t: 0, ruins, decor, onDone };
    if (i + 1 < DISTRICTS.length) this.tiles.setColorAt(i + 1, COL_NEXT);
    this.tiles.instanceColor!.needsUpdate = true;
    this.marker.visible = false;
  }

  get revealing(): boolean {
    return this.reveal !== null;
  }

  private finishReveal(): void {
    const r = this.reveal;
    if (!r) return;
    this.reveal = null;
    this.group.remove(r.ruins, r.decor);
    const i = r.d;
    this.tiles.setColorAt(i, COL_CLEARED);
    this.tiles.instanceColor!.needsUpdate = true;
    for (let l = 0; l < FOG_LAYERS.length; l++) {
      this.fogFade.setX(i * FOG_LAYERS.length + l, 0);
      this.m4.makeTranslation(DISTRICTS[i].x, FOG_LAYERS[l], DISTRICTS[i].z);
      this.fog.setMatrixAt(i * FOG_LAYERS.length + l, this.m4);
    }
    this.fogFade.needsUpdate = true;
    this.fog.instanceMatrix.needsUpdate = true;
    this.rebuild(this.cleared);
    this.updateMarker();
    r.onDone?.();
  }

  /** Frees GPU resources owned by this layer (shared model geometries are left alone). */
  dispose(): void {
    this.finishReveal();
    for (const m of this.chunkMeshes) m.geometry.dispose();
    for (const g of this.ruinCache.values()) g.dispose();
    for (const g of this.decorCache.values()) g.dispose();
    this.tiles.geometry.dispose();
    (this.tiles.material as THREE.Material).dispose();
    this.tiles.dispose();
    this.fog.geometry.dispose();
    this.fogMat.dispose();
    this.fog.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.walkers.dispose();
    this.brutes.dispose();
  }

  /** District (1-based id) under a ground point, or 0. */
  districtAt(x: number, z: number): number {
    const h = DISTRICT_SIZE / 2;
    for (const d of DISTRICTS) if (Math.abs(x - d.x) <= h && Math.abs(z - d.z) <= h) return d.id;
    return 0;
  }

  update(dt: number, t: number): void {
    this.fogMat.uniforms.uTime.value = t;
    // Next-target ring pulse.
    if (this.marker.visible) {
      const k = 0.5 + 0.5 * Math.sin(t * 3.2);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.5 * k;
    }
    // Reveal animation.
    const r = this.reveal;
    let rp = 0;
    if (r) {
      r.t += dt;
      rp = Math.min(1, r.t / REVEAL_S);
      const i = r.d;
      const d = DISTRICTS[i];
      // Fog lifts and thins (0 -> 0.55).
      const fk = Math.min(1, rp / 0.55);
      for (let l = 0; l < FOG_LAYERS.length; l++) {
        this.fogFade.setX(i * FOG_LAYERS.length + l, 1 - fk);
        this.m4.makeTranslation(d.x, FOG_LAYERS[l] + fk * (2 + l * 1.5), d.z);
        this.fog.setMatrixAt(i * FOG_LAYERS.length + l, this.m4);
      }
      this.fogFade.needsUpdate = true;
      this.fog.instanceMatrix.needsUpdate = true;
      // Ground brightens (0.2 -> 0.8).
      const ck = THREE.MathUtils.smoothstep(rp, 0.2, 0.8);
      this.col.copy(COL_INFESTED).lerp(COL_CLEARED, ck);
      this.tiles.setColorAt(i, this.col);
      this.tiles.instanceColor!.needsUpdate = true;
      // Ruins crumble into the ground (0.25 -> 0.7).
      const sk = THREE.MathUtils.smoothstep(rp, 0.25, 0.7);
      r.ruins.visible = sk < 1;
      r.ruins.position.set(sk > 0 ? Math.sin(t * 40) * 0.1 * (1 - sk) : 0, -sk * 6.8, 0);
      // Decor pops in (0.6 -> 1) with overshoot around the district centre.
      if (rp > 0.6) {
        r.decor.visible = true;
        const k = Math.min(1, (rp - 0.6) / 0.4);
        const sc = 1 + Math.sin(k * Math.PI) * 0.12;
        const y = (1 - k) * -2;
        r.decor.scale.set(sc, k, sc);
        r.decor.position.set(d.x * (1 - sc), y, d.z * (1 - sc));
      }
      if (rp >= 1) this.finishReveal();
    }
    this.updateZombies(t, r ? r.d : -1, rp);
  }

  private updateZombies(t: number, dying: number, rp: number): void {
    const dieK = dying >= 0 ? Math.min(1, rp / 0.4) : 0;
    const from = dying >= 0 ? Math.min(dying, this.cleared) : this.cleared;
    let nw = 0;
    let nb = 0;
    for (const z of this.zombies) {
      if (z.d < from) continue;
      const mesh = z.brute ? this.brutes : this.walkers;
      if (z.brute) nb++;
      else nw++;
      const a = t * z.w + z.ph;
      const x = z.hx + Math.cos(a) * z.r;
      const zz = z.hz + Math.sin(a) * z.r * 0.7;
      const dx = -Math.sin(a) * z.r;
      const dz = Math.cos(a) * z.r * 0.7;
      const yaw = Math.atan2(dx, dz);
      const sway = Math.sin(t * (z.brute ? 2.2 : 3.4) + z.ph) * 0.12;
      let fall = 0;
      let sink = 0;
      let sc = z.brute ? 0.85 : 1;
      if (z.d === dying) {
        fall = dieK * 1.45;
        sink = THREE.MathUtils.smoothstep(dieK, 0.6, 1) * 0.8;
        if (dieK >= 1) sc = 0;
      }
      this.e.set(-fall, yaw, sway, 'YXZ');
      this.q.setFromEuler(this.e);
      this.v.set(x, Math.abs(Math.sin(t * 3 + z.ph)) * 0.05 - sink, zz);
      this.s.setScalar(sc);
      this.m4.compose(this.v, this.q, this.s);
      mesh.setMatrixAt(z.idx, this.m4);
    }
    this.walkers.count = nw;
    this.brutes.count = nb;
    this.walkers.instanceMatrix.needsUpdate = true;
    this.brutes.instanceMatrix.needsUpdate = true;
  }
}
