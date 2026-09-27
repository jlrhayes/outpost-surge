// OWNER: runner agent. Allied helper units won from supply crates: a light tank (single heavy shell)
// and a rocket truck (twin rockets). They drive beside the squad and lob splash shots at the nearest
// threat up the road.
import * as THREE from 'three';
import { vehicleModel } from '../../three/models';

export type HelperKind = 'tank' | 'rocket';

export interface HelperTarget {
  x: number;
  d: number;
}

interface Unit {
  kind: HelperKind;
  obj: THREE.Group;
  x: number;
  d: number;
  side: -1 | 1;
  cd: number;
  recoil: number;
  enter: number;
}

interface Shell {
  x0: number;
  d0: number;
  x1: number;
  d1: number;
  t: number;
  dur: number;
  arc: number;
  dmg: number;
  radius: number;
}

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();

export class Helpers {
  readonly group = new THREE.Group();
  readonly units: Unit[] = [];
  private shells: Shell[] = [];
  private shellMesh: THREE.InstancedMesh;
  private shellGeo: THREE.BufferGeometry;
  private shellMat: THREE.MeshBasicMaterial;

  constructor(private castShadow: boolean) {
    this.shellGeo = new THREE.IcosahedronGeometry(0.22, 0);
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0xffc050, toneMapped: false });
    this.shellMesh = new THREE.InstancedMesh(this.shellGeo, this.shellMat, 24);
    this.shellMesh.count = 0;
    this.shellMesh.frustumCulled = false;
    this.group.add(this.shellMesh);
  }

  get count(): number {
    return this.units.length;
  }

  add(kind: HelperKind, fromX: number, fromD: number): boolean {
    if (this.units.length >= 2) return false;
    const side: -1 | 1 = this.units.length === 0 ? (fromX < 0 ? -1 : 1) : ((-this.units[0].side) as -1 | 1);
    const obj = vehicleModel(kind === 'tank' ? 'tank' : 'missile', kind === 'tank' ? 'SSR' : 'SR');
    obj.scale.setScalar(kind === 'tank' ? 0.62 : 0.58);
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = this.castShadow;
    });
    this.group.add(obj);
    this.units.push({ kind, obj, x: fromX, d: fromD, side, cd: 0.6, recoil: 0, enter: 0 });
    return true;
  }

  clear(): void {
    for (const u of this.units) u.obj.removeFromParent();
    this.units.length = 0;
    this.shells.length = 0;
    this.shellMesh.count = 0;
  }

  /**
   * @param findTarget returns the nearest threat ahead of (x, d) within range, or null.
   * @param onImpact called when a shell lands (splash damage is the caller's job).
   */
  update(
    dt: number,
    t: number,
    squadX: number,
    squadD: number,
    squadR: number,
    firing: boolean,
    baseDmg: number,
    findTarget: (x: number, d: number, out: HelperTarget) => boolean,
    onImpact: (x: number, d: number, radius: number, dmg: number) => void,
    onFire: (x: number, d: number) => void,
  ): void {
    const tgt = TMP_T;
    for (const u of this.units) {
      u.enter = Math.min(1, u.enter + dt * 1.5);
      const lim = 4.6;
      let tx = squadX + u.side * (squadR + 1.3);
      if (tx > lim) tx = lim;
      if (tx < -lim) tx = -lim;
      const td = squadD - 0.8;
      const k = Math.min(1, dt * (u.enter < 1 ? 3 : 6));
      u.x += (tx - u.x) * k;
      u.d += (td - u.d) * k;
      u.recoil = Math.max(0, u.recoil - dt * 4);
      u.obj.position.set(u.x, Math.abs(Math.sin(t * 11 + u.side)) * 0.04, -(u.d - u.recoil * 0.35));
      // Face forward (-Z).
      u.obj.rotation.set(0, Math.PI + (tx - u.x) * 0.15, 0);
      u.cd -= dt;
      if (firing && u.cd <= 0 && findTarget(u.x, u.d, tgt)) {
        const n = u.kind === 'tank' ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const dist = Math.max(4, tgt.d - u.d);
          this.shells.push({
            x0: u.x,
            d0: u.d + 1,
            x1: tgt.x + (n > 1 ? (i - 0.5) * 1.4 : 0),
            d1: tgt.d - 1.5,
            t: -i * 0.12,
            dur: 0.35 + dist * 0.018,
            arc: u.kind === 'tank' ? 0.6 + dist * 0.04 : 1.5 + dist * 0.08,
            dmg: baseDmg * (u.kind === 'tank' ? 1.2 : 0.7),
            radius: u.kind === 'tank' ? 2.2 : 1.8,
          });
        }
        u.cd = u.kind === 'tank' ? 1.25 : 1.6;
        u.recoil = 1;
        onFire(u.x, u.d + 1.2);
      }
    }
    let n = 0;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt;
      if (s.t < 0) continue;
      const p = s.t / s.dur;
      if (p >= 1) {
        onImpact(s.x1, s.d1, s.radius, s.dmg);
        this.shells[i] = this.shells[this.shells.length - 1];
        this.shells.pop();
        continue;
      }
      if (n < 24) {
        const x = s.x0 + (s.x1 - s.x0) * p;
        const d = s.d0 + (s.d1 - s.d0) * p;
        const y = 0.9 + Math.sin(p * Math.PI) * s.arc;
        tmpV.set(x, y, -d);
        tmpS.set(1, 1, 1);
        tmpM.compose(tmpV, tmpQ, tmpS);
        this.shellMesh.setMatrixAt(n++, tmpM);
      }
    }
    this.shellMesh.count = n;
    this.shellMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.shellMesh.dispose();
    this.shellGeo.dispose();
    this.shellMat.dispose();
  }
}

const TMP_T: HelperTarget = { x: 0, d: 0 };
