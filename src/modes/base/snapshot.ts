// OWNER: base agent. Renders a building model to a small transparent PNG (data URL) with the shared
// renderer, for building panels / build menus. Cached per type+level; falls back to null on failure.
import * as THREE from 'three';
import { engine } from '../../three/engine';
import { buildingModel } from '../../three/models';
import type { BuildingType } from '../../core/types';

const SIZE = 256;
const cache = new Map<string, string | null>();
let rt: THREE.WebGLRenderTarget | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.PerspectiveCamera | null = null;
const prevClear = new THREE.Color();
const box = new THREE.Box3();
const sphere = new THREE.Sphere();

function setup(): void {
  if (rt) return;
  rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x6f7a55, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
}

/** Visual tier used for caching: the art changes looks at levels 5 and 10 (height may grow slightly per level). */
function key(type: BuildingType, level: number): string {
  return `${type}_${Math.max(1, Math.min(30, level))}`;
}

export function buildingArt(type: BuildingType, level: number): string | null {
  const k = key(type, level);
  if (cache.has(k)) return cache.get(k)!;
  let url: string | null = null;
  try {
    const renderer = engine.renderer;
    if (!renderer) return null;
    setup();
    const model = buildingModel(type, Math.max(1, level));
    scene!.add(model);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    box.getBoundingSphere(sphere);
    const r = Math.max(0.5, sphere.radius);
    const dist = r / Math.sin(THREE.MathUtils.degToRad(cam!.fov / 2)) * 1.02;
    const dir = new THREE.Vector3(0.62, 0.62, 0.9).normalize();
    cam!.position.copy(sphere.center).addScaledVector(dir, dist);
    cam!.lookAt(sphere.center);
    cam!.updateMatrixWorld();

    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(prevClear);
    const prevAlpha = renderer.getClearAlpha();
    const prevShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene!, cam!);
    const px = new Uint8Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(rt!, 0, 0, SIZE, SIZE, px);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.shadowMap.enabled = prevShadow;
    scene!.remove(model);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(SIZE, SIZE);
    // Flip vertically (GL origin is bottom-left) and un-premultiply edges.
    const d = img.data;
    for (let y = 0; y < SIZE; y++) {
      const src = (SIZE - 1 - y) * SIZE * 4;
      const dst = y * SIZE * 4;
      for (let i = 0; i < SIZE * 4; i += 4) {
        const a = px[src + i + 3];
        const f = a > 0 && a < 255 ? 255 / a : 1;
        d[dst + i] = Math.min(255, px[src + i] * f);
        d[dst + i + 1] = Math.min(255, px[src + i + 1] * f);
        d[dst + i + 2] = Math.min(255, px[src + i + 2] * f);
        d[dst + i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    url = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('building art snapshot failed', e);
    url = null;
  }
  cache.set(k, url);
  return url;
}
