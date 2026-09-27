// OWNER: base agent. Ambient life in the compound: survivors strolling along the roads, a squad drilling
// on the parade ground, parked vehicles (incl. the interactive Special Ops jeep and the loot truck).
import * as THREE from 'three';
import { soldierGeometry, survivorGeometry, vcMaterial, vcMesh, vehicleModel } from '../../three/models';
import { mulberry32 } from '../../core/rng';
import { PartList, buildParts } from './geo';

interface Walker {
  path: number;
  d: number;
  speed: number;
  bob: number;
}

// Closed loops (x, z) along compound roads.
const PATHS: [number, number][][] = [
  [[-6.2, -3.6], [6.2, -3.6], [6.2, 5.6], [-6.2, 5.6]],
  [[-1.1, 22], [-1.1, 6.8], [1.1, 6.8], [1.1, 22]],
  [[-13, 6.8], [13, 6.8], [13, 16.6], [-13, 16.6]],
  [[-13, -13.5], [13, -13.5], [13, -2.6], [7.2, -2.6], [7.2, 6.8], [-7.2, 6.8], [-7.2, -2.6], [-13, -2.6]],
  [[-12.5, 16.6], [12.5, 16.6], [12.5, 21.8], [-12.5, 21.8]],
];

class Loop {
  lens: number[] = [];
  total = 0;
  constructor(readonly pts: [number, number][]) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      this.lens.push(l);
      this.total += l;
    }
  }
  /** Writes position + heading at distance d into out = [x, z, yaw]. */
  at(d: number, out: number[]): void {
    d = ((d % this.total) + this.total) % this.total;
    for (let i = 0; i < this.pts.length; i++) {
      const l = this.lens[i];
      if (d <= l || i === this.pts.length - 1) {
        const a = this.pts[i];
        const b = this.pts[(i + 1) % this.pts.length];
        const f = l > 0 ? Math.min(1, d / l) : 0;
        out[0] = a[0] + (b[0] - a[0]) * f;
        out[1] = a[1] + (b[1] - a[1]) * f;
        out[2] = Math.atan2(b[0] - a[0], b[1] - a[1]);
        return;
      }
      d -= l;
    }
  }
}

/** Custom jeep for the Special Ops entry point (faces +Z). */
function jeepGeometry(): THREE.BufferGeometry {
  const p = new PartList();
  p.slab(0x5d7040, 0, 0.45, 0, 1.7, 0.55, 3); // body
  p.slab(0x4d5e35, 0, 1.0, 0.75, 1.6, 0.25, 1.3); // hood
  p.slab(0x3a3f44, 0, 1.0, -0.45, 1.5, 0.08, 0.9); // seats
  p.box(0x2b2f33, 0, 1.55, 0.05, 1.6, 0.08, 0.08); // roll bar
  p.box(0x2b2f33, -0.78, 1.28, 0.05, 0.08, 0.6, 0.08);
  p.box(0x2b2f33, 0.78, 1.28, 0.05, 0.08, 0.6, 0.08);
  p.box(0x9fd4ff, 0, 1.35, 0.25, 1.5, 0.45, 0.06, 0, -0.3); // windshield
  p.cyl(0x333333, 0, 1.75, -0.7, 0.12, 0.4); // gun mount
  p.box(0x222222, 0, 1.95, -0.35, 0.1, 0.1, 0.9);
  p.slab(0xff8a1a, 0, 1.02, -0.2, 1.72, 0.06, 0.25); // orange spec-ops stripe
  p.cyl(0x1f1f1f, 0, 1.0, -1.62, 0.36, 0.22, Math.PI / 2); // spare tyre
  for (const [x, z] of [[-0.85, 1.05], [0.85, 1.05], [-0.85, -1.0], [0.85, -1.0]]) p.cyl(0x1f1f1f, x, 0.42, z, 0.42, 0.3, 0, Math.PI / 2);
  return buildParts(p);
}

/** Flatbed loot truck loaded with crates (faces +Z). */
function truckGeometry(): THREE.BufferGeometry {
  const p = new PartList();
  p.slab(0x2f3a44, 0, 0.35, 0, 1.9, 0.35, 4.2); // chassis
  p.slab(0xd8a030, 0, 0.7, 1.35, 1.9, 1.35, 1.4); // cab
  p.slab(0x9fd4ff, 0, 1.45, 2.06, 1.7, 0.5, 0.05); // windshield
  p.slab(0x6a5236, 0, 0.7, -0.7, 2.0, 0.2, 2.7); // bed
  p.slab(0x8a6a44, -0.5, 0.9, -0.2, 0.8, 0.75, 0.8, 0.15);
  p.slab(0xa07a4a, 0.45, 0.9, -1.1, 0.8, 0.7, 0.8, -0.1);
  p.slab(0x3f7a4a, -0.35, 0.9, -1.4, 0.7, 0.55, 0.7);
  p.slab(0xf5c542, 0.45, 1.6, -1.1, 0.5, 0.35, 0.5); // gold crate on top
  p.slab(0x1a78a8, -0.5, 1.65, -0.2, 0.45, 0.4, 0.45); // blue crate
  for (const z of [1.4, -0.6, -1.5]) for (const x of [-0.95, 0.95]) p.cyl(0x1f1f1f, x, 0.42, z, 0.42, 0.32, 0, Math.PI / 2);
  return buildParts(p);
}

export class Life {
  readonly group = new THREE.Group();
  readonly specOps: THREE.Object3D;
  readonly lootTruck: THREE.Object3D;
  private survivors: THREE.InstancedMesh;
  private soldiers: THREE.InstancedMesh;
  private walkers: Walker[] = [];
  private loops = PATHS.map((p) => new Loop(p));
  private nSoldiers: number;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private out = [0, 0, 0];

  constructor(quality: 'low' | 'high') {
    const rng = mulberry32(3);
    const nWalk = quality === 'high' ? 18 : 9;
    for (let i = 0; i < nWalk; i++) {
      const path = i % this.loops.length;
      this.walkers.push({ path, d: rng() * this.loops[path].total, speed: (0.9 + rng() * 0.8) * (rng() < 0.5 ? 1 : -1), bob: rng() * 6 });
    }
    this.survivors = new THREE.InstancedMesh(survivorGeometry(), vcMaterial(), nWalk);
    this.survivors.castShadow = quality === 'high';
    this.survivors.frustumCulled = false;
    this.survivors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.survivors);

    this.nSoldiers = quality === 'high' ? 15 : 9;
    this.soldiers = new THREE.InstancedMesh(soldierGeometry(), vcMaterial(), this.nSoldiers);
    this.soldiers.castShadow = quality === 'high';
    this.soldiers.frustumCulled = false;
    this.soldiers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.soldiers);

    // Parked vehicles.
    const jeep = new THREE.Group();
    jeep.add(vcMesh(jeepGeometry()));
    jeep.position.set(-7.6, 0.14, 20.2);
    jeep.rotation.y = 0.35;
    this.specOps = jeep;
    const truck = new THREE.Group();
    truck.add(vcMesh(truckGeometry()));
    truck.position.set(7.8, 0.14, 20.1);
    truck.rotation.y = -0.3;
    this.lootTruck = truck;
    this.group.add(jeep, truck);
    const tank = vehicleModel('tank', 'SR');
    tank.position.set(-11.6, 0.14, 20.3);
    tank.rotation.y = 0.15;
    const launcher = vehicleModel('missile', 'SR');
    launcher.position.set(11.8, 0.14, 20.4);
    launcher.rotation.y = -0.15;
    const tank2 = vehicleModel('tank', 'SSR');
    tank2.position.set(-5.7, 0.14, -9.6);
    tank2.rotation.y = 0.08;
    for (const g of [tank, launcher, tank2]) {
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      this.group.add(g);
    }
  }

  /** Frees resources owned by this layer (shared model geometries are left alone). */
  dispose(): void {
    this.survivors.dispose();
    this.soldiers.dispose();
    for (const v of [this.specOps, this.lootTruck]) {
      v.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
  }

  update(t: number): void {
    // Survivors.
    const o = this.out;
    this.walkers.forEach((w, i) => {
      const loop = this.loops[w.path];
      loop.at(w.d + t * w.speed, o);
      const yaw = o[2] + (w.speed < 0 ? Math.PI : 0);
      this.e.set(0, yaw, Math.sin(t * 8 + w.bob) * 0.05);
      this.q.setFromEuler(this.e);
      // Offset to the right-hand side of the road for each direction.
      const side = 0.55;
      this.v.set(o[0] + Math.cos(yaw) * side, 0.14 + Math.abs(Math.sin(t * 8 + w.bob)) * 0.05, o[1] - Math.sin(yaw) * side);
      this.m4.compose(this.v, this.q, this.s);
      this.survivors.setMatrixAt(i, this.m4);
    });
    this.survivors.instanceMatrix.needsUpdate = true;

    // Drill squad: 3 ranks marching forward and back across the plaza, turning in unison.
    const cols = this.nSoldiers / 3;
    const cycle = 7;
    const phase = (t % (cycle * 2)) / cycle; // 0..2
    const dir = phase < 1 ? 1 : -1;
    const k = phase < 1 ? phase : phase - 1;
    const march = THREE.MathUtils.smoothstep(k, 0.08, 0.92);
    const offX = dir > 0 ? -3.2 + march * 6.4 : 3.2 - march * 6.4;
    const turning = k < 0.08 || k > 0.92;
    const step = turning ? 0 : Math.abs(Math.sin(t * 7));
    this.e.set(0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    this.q.setFromEuler(this.e);
    for (let i = 0; i < this.nSoldiers; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      this.v.set(offX + (c - (cols - 1) / 2) * 1.05, 0.18 + step * 0.06, -0.6 + r * 1.5);
      this.m4.compose(this.v, this.q, this.s);
      this.soldiers.setMatrixAt(i, this.m4);
    }
    this.soldiers.instanceMatrix.needsUpdate = true;
  }
}
