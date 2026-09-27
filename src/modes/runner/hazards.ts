// OWNER: runner agent. Lane hazards: a fixed spike strip or a barbed-wire barricade sweeping along a rail.
// Both are telegraphed from far away: roadside warning signs, a pulsing red glow over the danger zone and
// (for the wire) a rail across the road. Soldiers standing in the zone when the squad crosses are lost.
import * as THREE from 'three';
import { vcMaterial } from '../../three/models';
import { SIM, type HazardDef, type HazardKind } from '../../data/runner';
import { railGeometry, spikeStripGeometry, warnSignGeometry, wireGeometry } from './models';
import { hazardGlowMat } from './mats';

let glowGeo: THREE.PlaneGeometry | null = null;

export class HazardView {
  readonly group = new THREE.Group();
  private spikes: THREE.Mesh;
  private wire: THREE.Mesh;
  private rail: THREE.Mesh;
  private signL: THREE.Mesh;
  private signR: THREE.Mesh;
  private glow: THREE.Mesh;
  active = false;
  kind: HazardKind = 'spikes';
  d = 0;
  /** Current centre and half-width of the danger zone. */
  x = 0;
  half = 1;
  bite = 0.4;
  /** Set once the squad has crossed it. */
  passed = false;
  private amp = 0;
  private period = 1;
  private phase = 0;
  private cx = 0;

  constructor(castShadow: boolean) {
    glowGeo ??= new THREE.PlaneGeometry(1, 1);
    const mat = vcMaterial();
    this.spikes = new THREE.Mesh(spikeStripGeometry(1.85), mat);
    this.wire = new THREE.Mesh(wireGeometry(1.7), mat);
    this.rail = new THREE.Mesh(railGeometry(), mat);
    this.signL = new THREE.Mesh(warnSignGeometry(), mat);
    this.signR = new THREE.Mesh(warnSignGeometry(), mat);
    this.glow = new THREE.Mesh(glowGeo, hazardGlowMat());
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.renderOrder = 3;
    this.spikes.castShadow = this.wire.castShadow = this.signL.castShadow = this.signR.castShadow = castShadow;
    this.spikes.receiveShadow = this.rail.receiveShadow = true;
    this.group.add(this.glow, this.spikes, this.wire, this.rail, this.signL, this.signR);
    this.group.visible = false;
  }

  setup(h: HazardDef): void {
    this.active = true;
    this.passed = false;
    this.kind = h.kind;
    this.d = h.d;
    this.cx = h.x;
    this.x = h.x;
    this.half = h.half;
    this.bite = h.bite;
    this.amp = h.amp;
    this.period = h.period;
    this.phase = h.phase;
    const wire = h.kind === 'wire';
    this.spikes.visible = !wire;
    this.wire.visible = wire;
    this.rail.visible = wire;
    if (!wire) {
      this.spikes.geometry = spikeStripGeometry(h.half);
      this.spikes.position.set(h.x, 0, 0);
    }
    // Warning signs at the road edge ahead of the hazard (both sides for the wire, the dangerous side
    // for a spike strip).
    const edge = SIM.roadHalf + 1.1;
    this.signL.visible = wire || h.x < 0;
    this.signR.visible = wire || h.x > 0;
    this.signL.position.set(-edge, 0, 12);
    this.signR.position.set(edge, 0, 12);
    this.glow.scale.set(h.half * 2 + 0.3, 2.1, 1);
    this.glow.position.set(h.x, 0.03, 0);
    this.group.position.set(0, 0, -h.d);
    this.group.visible = true;
  }

  update(t: number): void {
    if (!this.active) return;
    if (this.kind === 'wire') {
      this.x = this.cx + this.amp * Math.sin((t / this.period) * Math.PI * 2 + this.phase);
      this.wire.position.set(this.x, 0, 0);
      this.wire.rotation.z = Math.sin(t * 9) * 0.015;
      this.glow.position.x = this.x;
    }
  }

  /** Danger zone x-range right now (road coords). */
  get x0(): number {
    return this.x - this.half;
  }
  get x1(): number {
    return this.x + this.half;
  }

  hide(): void {
    this.active = false;
    this.group.visible = false;
  }
}
