// OWNER: base agent. Pooled 3D feedback effects: sparkle bursts, light pillars, ground pulse rings.
import * as THREE from 'three';

const MAX_PARTICLES = 320;

interface Pillar {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
}

interface Ring {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  r: number;
}

export class Effects {
  readonly group = new THREE.Group();
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private next = 0;
  private active = 0;
  private pillars: Pillar[] = [];
  private rings: Ring[] = [];
  private tmpC = new THREE.Color();

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3).fill(-999);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.group.add(this.points);

    const pillarGeom = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    pillarGeom.translate(0, 0.5, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        pillarGeom,
        new THREE.MeshBasicMaterial({
          color: 0xffe07a,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      m.visible = false;
      m.renderOrder = 9;
      this.group.add(m);
      this.pillars.push({ mesh: m, t: 0, dur: 0 });
    }
    const ringGeom = new THREE.RingGeometry(0.86, 1, 48);
    ringGeom.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        ringGeom,
        new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.visible = false;
      m.renderOrder = 8;
      this.group.add(m);
      this.rings.push({ mesh: m, t: 0, dur: 0, r: 1 });
    }
  }

  /** Burst of rising sparkles. */
  burst(x: number, y: number, z: number, color: number, count = 40, spread = 2, up = 5): void {
    this.tmpC.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.pos[i * 3] = x + Math.cos(a) * r * 0.4;
      this.pos[i * 3 + 1] = y + Math.random() * 0.5;
      this.pos[i * 3 + 2] = z + Math.sin(a) * r * 0.4;
      this.vel[i * 3] = Math.cos(a) * r * 0.9;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * r * 0.9;
      this.life[i] = 0.9 + Math.random() * 0.7;
      const k = 0.75 + Math.random() * 0.25;
      this.col[i * 3] = this.tmpC.r * k;
      this.col[i * 3 + 1] = this.tmpC.g * k;
      this.col[i * 3 + 2] = this.tmpC.b * k;
    }
    this.active = MAX_PARTICLES;
  }

  /** Vertical glowing column (level up). */
  pillar(x: number, z: number, radius: number, height: number, color = 0xffe07a, dur = 1.3): void {
    const p = this.pillars.find((q) => !q.mesh.visible) ?? this.pillars[0];
    p.t = 0;
    p.dur = dur;
    p.mesh.visible = true;
    p.mesh.position.set(x, 0.1, z);
    p.mesh.scale.set(radius, height, radius);
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** Expanding ground ring (focus highlight, taps). */
  ring(x: number, z: number, radius: number, color = 0xffe07a, dur = 1.1): void {
    const r = this.rings.find((q) => !q.mesh.visible) ?? this.rings[0];
    r.t = 0;
    r.dur = dur;
    r.r = radius;
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.25, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  update(dt: number): void {
    if (this.active > 0) {
      let alive = 0;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (this.life[i] <= 0) continue;
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          this.pos[i * 3 + 1] = -999;
          continue;
        }
        alive++;
        this.vel[i * 3 + 1] -= 6 * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.life[i] < 0.3) {
          this.col[i * 3] *= 0.9;
          this.col[i * 3 + 1] *= 0.9;
          this.col[i * 3 + 2] *= 0.9;
        }
      }
      (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      if (alive === 0) this.active = 0;
    }
    for (const p of this.pillars) {
      if (!p.mesh.visible) continue;
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) {
        p.mesh.visible = false;
        continue;
      }
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.38;
      p.mesh.scale.x = p.mesh.scale.z = p.mesh.scale.x * (1 - dt * 0.3);
    }
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.mesh.visible = false;
        continue;
      }
      const s = r.r * (0.6 + k * 0.8);
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
  }
}
