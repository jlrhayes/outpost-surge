// OWNER: runner agent. Scrolling environment: road, wasteland, ruined city edges and roadside props.
// Everything is instanced and recycled in a window around the squad, so a level of any length costs the
// same handful of draw calls. World z = -d (the squad runs toward -Z).
import * as THREE from 'three';
import { mulberry32 } from '../../core/rng';
import { buildColored, P, propGeometry, vcMaterial, type PropKind } from '../../three/models';
import type { ThemePalette } from '../../data/runner';
import { groundTexture, roadTexture, ROAD_TILE, ROAD_WIDTH } from './textures';

const BEHIND = 24;
const AHEAD = 136;
const WIN = BEHIND + AHEAD;

type EnvKind = PropKind | 'ruinA' | 'ruinB' | 'ruinC' | 'rubble';

let ruinCache: Record<string, THREE.BufferGeometry> | null = null;
/** Neutral-grey ruin geometries (tinted per instance with the chapter palette). Cached forever. */
function ruinGeometry(kind: 'ruinA' | 'ruinB' | 'ruinC' | 'rubble'): THREE.BufferGeometry {
  if (!ruinCache) {
    const wall = 0xe6e2dc;
    const wall2 = 0xc9c4bc;
    const dark = 0x3a3e46;
    const rebar = 0x6b5a4a;
    const winRows = (w: number, h: number, d: number, rows: number, cols: number, y0: number) => {
      const parts = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = -w / 2 + (w / cols) * (c + 0.5);
          const y = y0 + r * 1.5;
          if (y > h - 0.6) continue;
          parts.push({ geom: P.box, color: dark, pos: [x, y, d / 2 + 0.02] as [number, number, number], scale: [w / cols - 0.45, 0.8, 0.08] as [number, number, number] });
          parts.push({ geom: P.box, color: dark, pos: [x * 0.999, y, -d / 2 - 0.02] as [number, number, number], scale: [w / cols - 0.45, 0.8, 0.08] as [number, number, number] });
        }
      return parts;
    };
    const winSides = (w: number, h: number, d: number, rows: number, cols: number, y0: number) => {
      const parts = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const z = -d / 2 + (d / cols) * (c + 0.5);
          const y = y0 + r * 1.5;
          if (y > h - 0.6) continue;
          parts.push({ geom: P.box, color: dark, pos: [w / 2 + 0.02, y, z] as [number, number, number], scale: [0.08, 0.8, d / cols - 0.45] as [number, number, number] });
          parts.push({ geom: P.box, color: dark, pos: [-w / 2 - 0.02, y, z] as [number, number, number], scale: [0.08, 0.8, d / cols - 0.45] as [number, number, number] });
        }
      return parts;
    };
    ruinCache = {
      // Tall apartment block with a broken, stepped top.
      ruinA: buildColored([
        { geom: P.box, color: wall, pos: [0, 4, 0], scale: [5, 8, 5] },
        { geom: P.box, color: wall2, pos: [-1.2, 8.8, 0.6], scale: [2.6, 1.6, 3.8] },
        { geom: P.box, color: wall2, pos: [1.4, 8.3, -1], scale: [2.2, 0.6, 3] },
        { geom: P.box, color: wall2, pos: [0, 0.25, 0], scale: [5.4, 0.5, 5.4] },
        ...winRows(5, 8, 5, 5, 3, 1.6),
        ...winSides(5, 8, 5, 5, 3, 1.6),
        { geom: P.box, color: rebar, pos: [1.9, 9.2, 1.9], scale: [0.08, 1.6, 0.08] },
        { geom: P.box, color: rebar, pos: [0.6, 9.4, 1.9], scale: [0.08, 2, 0.08] },
      ]),
      // Low collapsed shop with a slanted roof slab.
      ruinB: buildColored([
        { geom: P.box, color: wall, pos: [0, 1.6, 0], scale: [6, 3.2, 4.5] },
        { geom: P.box, color: wall2, pos: [0.8, 3.5, 0.3], rot: [0, 0, -0.22], scale: [5, 0.35, 4.8] },
        { geom: P.box, color: dark, pos: [-1.5, 1.2, 2.27], scale: [2.2, 1.9, 0.08] },
        { geom: P.box, color: dark, pos: [1.5, 1.6, 2.27], scale: [1.4, 1, 0.08] },
        { geom: P.box, color: dark, pos: [3.02, 1.6, 0], scale: [0.08, 1, 2] },
        { geom: P.box, color: dark, pos: [-3.02, 1.6, 0], scale: [0.08, 1, 2] },
        { geom: P.box, color: wall2, pos: [-3.2, 0.4, 1.6], rot: [0.3, 0.5, 0.2], scale: [1.4, 0.8, 1.1] },
        { geom: P.box, color: wall2, pos: [2.8, 0.3, 2.4], rot: [0.1, 0.9, 0.3], scale: [1, 0.6, 0.9] },
      ]),
      // Skeletal tower: concrete floors on pillars.
      ruinC: buildColored([
        { geom: P.box, color: wall, pos: [0, 2.2, 0], scale: [4, 4.4, 4] },
        ...winRows(4, 4.4, 4, 2, 2, 1.3),
        ...winSides(4, 4.4, 4, 2, 2, 1.3),
        { geom: P.box, color: wall2, pos: [0, 4.6, 0], scale: [4.4, 0.35, 4.4] },
        { geom: P.box, color: wall2, pos: [-1.8, 5.9, -1.8], scale: [0.4, 2.6, 0.4] },
        { geom: P.box, color: wall2, pos: [1.8, 5.9, -1.8], scale: [0.4, 2.6, 0.4] },
        { geom: P.box, color: wall2, pos: [-1.8, 5.5, 1.8], scale: [0.4, 1.8, 0.4] },
        { geom: P.box, color: wall2, pos: [-0.3, 7.2, -0.8], rot: [0, 0, 0.12], scale: [4, 0.3, 2.8] },
        { geom: P.box, color: rebar, pos: [1.8, 7.4, -1.8], scale: [0.07, 1.6, 0.07] },
      ]),
      rubble: buildColored([
        { geom: P.sphereLow, color: wall2, pos: [0, 0.3, 0], scale: [1.8, 0.8, 1.4] },
        { geom: P.box, color: wall, pos: [0.7, 0.35, 0.4], rot: [0.4, 0.3, 0.5], scale: [0.9, 0.5, 0.7] },
        { geom: P.box, color: wall2, pos: [-0.8, 0.25, -0.3], rot: [0.2, 1.1, 0.1], scale: [1, 0.4, 0.6] },
        { geom: P.box, color: rebar, pos: [0.2, 0.7, -0.2], rot: [0.5, 0, 0.8], scale: [0.06, 1.2, 0.06] },
      ]),
    };
  }
  return ruinCache[kind];
}

interface Slot {
  kind: EnvKind;
  mesh: THREE.InstancedMesh;
  index: number;
  band: 'lamp' | 'near' | 'mid' | 'far';
  side: -1 | 1;
  d: number;
}

export class RunnerEnv {
  readonly group = new THREE.Group();
  private road: THREE.Mesh;
  private ground: THREE.Mesh;
  private roadTex: THREE.CanvasTexture;
  private groundTex: THREE.CanvasTexture;
  private meshes = new Map<EnvKind, THREE.InstancedMesh>();
  private slots: Slot[] = [];
  private rng = mulberry32(12345);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private owned: THREE.Material[] = [];
  private ownedGeo: THREE.BufferGeometry[] = [];

  constructor(
    private palette: ThemePalette,
    quality: 'low' | 'high',
    anisotropy: number,
  ) {
    const hi = quality === 'high';
    this.roadTex = roadTexture(palette);
    this.roadTex.anisotropy = anisotropy;
    const roadLen = WIN + 40;
    this.roadTex.repeat.set(1, roadLen / ROAD_TILE);
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, roadLen);
    const roadMat = new THREE.MeshLambertMaterial({ map: this.roadTex });
    this.road = new THREE.Mesh(roadGeo, roadMat);
    this.road.rotation.x = -Math.PI / 2;
    this.road.receiveShadow = hi;
    this.group.add(this.road);

    this.groundTex = groundTexture(palette);
    this.groundTex.anisotropy = Math.min(4, anisotropy);
    const gw = 260;
    const gl = WIN + 80;
    this.groundTex.repeat.set(gw / 14, gl / 14);
    const groundGeo = new THREE.PlaneGeometry(gw, gl);
    const groundMat = new THREE.MeshLambertMaterial({ map: this.groundTex });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.03;
    this.ground.receiveShadow = hi;
    this.group.add(this.ground);
    this.owned.push(roadMat, groundMat);
    this.ownedGeo.push(roadGeo, groundGeo);

    // Roadside prop bands.
    const green = palette.green;
    const bands: { band: Slot['band']; spacing: number; kinds: [EnvKind, number][]; fill: number }[] = [
      { band: 'lamp', spacing: 18, kinds: [['lamp', 1]], fill: 1 },
      {
        band: 'near',
        spacing: 7.5,
        kinds: [
          ['cone', 1.2],
          ['sandbag', 1],
          ['barrel', 0.6],
          ['fence', 0.8],
          ['rubble', 0.6],
        ],
        fill: hi ? 0.65 : 0.4,
      },
      {
        band: 'mid',
        spacing: 9,
        kinds: [
          ['car_wreck', 1.4],
          ['rock', 0.8],
          ['tree', 0.9 * green],
          ['pine', 0.7 * green],
          ['rubble', 0.8],
          ['sandbag', 0.4],
        ],
        fill: hi ? 0.85 : 0.55,
      },
      {
        band: 'far',
        spacing: 11,
        kinds: [
          ['ruinA', 1],
          ['ruinB', 1],
          ['ruinC', 1],
        ],
        fill: 1,
      },
    ];
    // First pass: decide kinds so we know instance counts per kind.
    const plan: { band: Slot['band']; side: -1 | 1; d: number; kind: EnvKind }[] = [];
    for (const b of bands) {
      const n = Math.ceil(WIN / b.spacing);
      for (const side of [-1, 1] as const) {
        for (let i = 0; i < n; i++) {
          if (this.rng() > b.fill) continue;
          const kind = pickW(this.rng, b.kinds);
          plan.push({ band: b.band, side, d: -BEHIND + i * b.spacing + (side > 0 ? b.spacing * 0.5 : 0), kind });
        }
      }
    }
    const counts = new Map<EnvKind, number>();
    for (const p of plan) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
    for (const [kind, n] of counts) {
      const geo = kind === 'ruinA' || kind === 'ruinB' || kind === 'ruinC' || kind === 'rubble' ? ruinGeometry(kind) : propGeometry(kind as PropKind);
      const mesh = new THREE.InstancedMesh(geo, vcMaterial(), n);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = hi && kind !== 'ruinA' && kind !== 'ruinB' && kind !== 'ruinC';
      mesh.receiveShadow = hi;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
    for (const p of plan) {
      const mesh = this.meshes.get(p.kind)!;
      const slot: Slot = { kind: p.kind, mesh, index: mesh.count++, band: p.band, side: p.side, d: p.d };
      this.slots.push(slot);
      this.place(slot);
    }
    for (const mesh of this.meshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private place(sl: Slot): void {
    const r = this.rng;
    let x = 0;
    let yaw = 0;
    let sc = 1;
    let sy = 1;
    switch (sl.band) {
      case 'lamp':
        x = 6.35;
        yaw = 0;
        break;
      case 'near':
        x = 4.9 + r() * 0.9;
        yaw = sl.kind === 'fence' || sl.kind === 'sandbag' ? Math.PI / 2 + (r() - 0.5) * 0.3 : r() * 6.28;
        sc = 0.9 + r() * 0.3;
        break;
      case 'mid':
        x = 7.2 + r() * 3.5;
        yaw = r() * 6.28;
        sc = sl.kind === 'tree' || sl.kind === 'pine' ? 1.1 + r() * 0.7 : 0.9 + r() * 0.5;
        break;
      case 'far':
        x = 13 + r() * 5;
        yaw = (Math.floor(r() * 4) * Math.PI) / 2 + (r() - 0.5) * 0.2;
        sc = 0.9 + r() * 0.4;
        sy = 0.7 + r() * 0.6;
        break;
    }
    this.v.set(x * sl.side, 0, -sl.d);
    this.e.set(0, yaw, 0);
    this.q.setFromEuler(this.e);
    this.s.set(sc, sc * sy, sc);
    this.m.compose(this.v, this.q, this.s);
    sl.mesh.setMatrixAt(sl.index, this.m);
    if (sl.band === 'far' || sl.kind === 'rubble') {
      const p = this.palette;
      this.c.setHex(r() < 0.5 ? p.ruin : p.ruinAlt);
      const f = 0.9 + r() * 0.25;
      this.c.r *= f;
      this.c.g *= f;
      this.c.b *= f;
      sl.mesh.setColorAt(sl.index, this.c);
    }
  }

  /** Recycle props that fell behind and scroll the road/ground textures. */
  update(squadD: number): void {
    const centre = squadD + (AHEAD - BEHIND) / 2;
    this.road.position.z = -centre;
    this.ground.position.z = -centre;
    const roadLen = WIN + 40;
    this.roadTex.offset.y = (((centre - roadLen / 2) / ROAD_TILE) % 1 + 1) % 1;
    const gl = WIN + 80;
    this.groundTex.offset.y = (((centre - gl / 2) / 14) % 1 + 1) % 1;
    let dirty = false;
    for (const sl of this.slots) {
      if (sl.d < squadD - BEHIND) {
        sl.d += WIN;
        this.place(sl);
        sl.mesh.instanceMatrix.needsUpdate = true;
        if (sl.mesh.instanceColor) sl.mesh.instanceColor.needsUpdate = true;
        dirty = true;
      }
    }
    void dirty;
  }

  dispose(): void {
    this.roadTex.dispose();
    this.groundTex.dispose();
    for (const m of this.owned) m.dispose();
    for (const g of this.ownedGeo) g.dispose();
    for (const mesh of this.meshes.values()) mesh.dispose();
    this.meshes.clear();
    this.slots.length = 0;
  }
}

function pickW<T>(rng: () => number, opts: [T, number][]): T {
  let total = 0;
  for (const o of opts) total += Math.max(0, o[1]);
  let x = rng() * total;
  for (const o of opts) {
    x -= Math.max(0, o[1]);
    if (x <= 0 && o[1] > 0) return o[0];
  }
  return opts[0][0];
}
