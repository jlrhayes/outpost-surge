// OWNER: world agent. 3D scene for the 'world' mode. Implements GameMode (see src/three/engine.ts).
import * as THREE from 'three';
import type { GameMode } from '../../three/engine';

export class WorldMode implements GameMode {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  constructor() {
    this.scene.background = new THREE.Color(0x6a8a5a);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.2));
    this.camera.position.set(0, 20, 20);
    this.camera.lookAt(0, 0, 0);
  }

  enter(params: any): void {}
  exit(): void {}
  update(dt: number, elapsed: number): void {}
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
