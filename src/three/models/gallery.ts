// OWNER: art agent. DEV-ONLY model gallery (served at /gallery.html by `vite`; not part of the game build).
// Lays out every model on a grid with slow rotation, labels + triangle counts, and game-like sunny lighting.
// URL hash selects a section: #chars #vehicles #bA #bB #bC #bD #props #misc #crowd #base (append ,top for top view).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Rarity } from '../../core/types';
import {
  BUILDING_MODEL_TYPES,
  PROP_KINDS,
  animateModel,
  bossModel,
  buildingModel,
  bulletGeometry,
  coinGeometry,
  constructionModel,
  emptyPlotGeometry,
  flagModel,
  gatePostGeometry,
  gemGeometry,
  muzzleFlashGeometry,
  propGeometry,
  resourceNodeGeometry,
  ruinedBlockModel,
  soldierGeometry,
  soldierHeavyGeometry,
  survivorGeometry,
  triCount,
  vcGlowMaterial,
  vcMaterial,
  vcMesh,
  vehicleModel,
  zombieGeometry,
  type BuildingModelType,
} from './index';

// ---------------------------------------------------------------------------------------------
// Scene setup (similar to a sunny game scene)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fcdf0);
const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x7a8a5c, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x86bd5a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const content = new THREE.Group();
scene.add(content);

interface Item {
  obj: THREE.Object3D;
  label: string;
  tris: number;
  el: HTMLDivElement;
  top: number;
  spin: boolean;
}
let items: Item[] = [];
let rotate = true;
let topView = false;
const labelsEl = document.getElementById('labels')!;
const infoEl = document.getElementById('info')!;

function countTris(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.name !== 'blobShadow') {
      const inst = (c as THREE.InstancedMesh).isInstancedMesh ? 1 : 1;
      n += triCount(m.geometry) * inst;
    }
  });
  return n;
}

function add(obj: THREE.Object3D, x: number, z: number, label: string, spin = true): Item {
  obj.position.set(x, 0, z);
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && c.name !== 'blobShadow' && c.name !== 'fog') {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  content.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const el = document.createElement('div');
  el.className = 'lbl';
  const tris = countTris(obj);
  el.innerHTML = `${label} <small>${tris}t</small>`;
  labelsEl.appendChild(el);
  const it: Item = { obj, label, tris, el, top: box.max.y + 0.25, spin };
  items.push(it);
  return it;
}

const mesh = (g: THREE.BufferGeometry, glow = false) => {
  const m = glow ? new THREE.Mesh(g, vcGlowMaterial()) : vcMesh(g);
  const grp = new THREE.Group();
  grp.add(m);
  return grp;
};

function clear(): void {
  content.clear();
  labelsEl.innerHTML = '';
  items = [];
}

// ---------------------------------------------------------------------------------------------
// Sections

const RAR: Rarity[] = ['SR', 'SSR', 'UR'];
const TIERS = [1, 5, 10];
const B_GROUPS: Record<string, BuildingModelType[]> = {
  bA: ['hq', 'wall', 'barracks', 'drill'],
  bB: ['hospital', 'tech', 'farm', 'ironmine'],
  bC: ['goldmine', 'warehouse', 'tavern', 'tankcenter'],
  bD: ['aircenter', 'missilecenter', 'radar', 'trainingbase'],
};

const sections: Record<string, () => void> = {
  chars() {
    const list: [string, () => THREE.Object3D][] = [
      ['soldier', () => mesh(soldierGeometry())],
      ['soldierHeavy', () => mesh(soldierHeavyGeometry())],
      ['survivor', () => mesh(survivorGeometry())],
      ['walker', () => mesh(zombieGeometry('walker'))],
      ['runner', () => mesh(zombieGeometry('runner'))],
      ['brute', () => mesh(zombieGeometry('brute'))],
    ];
    list.forEach(([n, f], i) => add(f(), (i - 2.5) * 1.6, 0, n));
    add(bossModel(), 0, -3.2, 'boss');
  },
  vehicles() {
    (['tank', 'aircraft', 'missile'] as const).forEach((t, r) =>
      RAR.forEach((rar, c) => add(vehicleModel(t, rar), (c - 1) * 4.5, (r - 1) * 5.5, `${t} ${rar}`)),
    );
  },
  props() {
    PROP_KINDS.forEach((k, i) => add(mesh(propGeometry(k)), ((i % 5) - 2) * 3.4, (Math.floor(i / 5) - 1.5) * 3.4, k));
  },
  misc() {
    const row = (z: number, list: [string, THREE.Object3D, boolean?][]) =>
      list.forEach(([n, o, s], i) => add(o, (i - (list.length - 1) / 2) * 3.6, z, n, s ?? true));
    const lift = (o: THREE.Object3D, y: number) => {
      o.children.forEach((c) => (c.position.y += y));
      return o;
    };
    row(-5, [
      ['gatePost', mesh(gatePostGeometry())],
      ['bullet', lift(mesh(bulletGeometry(), true), 1)],
      ['muzzleFlash', lift(mesh(muzzleFlashGeometry(), true), 1)],
      ['coin', lift(mesh(coinGeometry()), 0.6)],
      ['gem', lift(mesh(gemGeometry()), 0.6)],
      ['flag blue', flagModel(0x3a86ea), false],
      ['flag red', flagModel(0xe43d30), false],
    ]);
    row(0.5, [
      ['node food', mesh(resourceNodeGeometry('food'))],
      ['node iron', mesh(resourceNodeGeometry('iron'))],
      ['node gold', mesh(resourceNodeGeometry('gold'))],
      ['emptyPlot', mesh(emptyPlotGeometry()), false],
    ]);
    const c = constructionModel();
    const b = buildingModel('barracks', 3);
    const grp = new THREE.Group();
    grp.add(b, c);
    add(grp, -4, 7, 'construction', false);
    add(ruinedBlockModel(3), 6, 9, 'ruinedBlock 3', false);
    add(ruinedBlockModel(12), 19, 9, 'ruinedBlock 12', false);
  },
  crowd() {
    // runner-like scene: squad vs horde at game scale
    const road = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 60), new THREE.MeshLambertMaterial({ color: 0x8c8f94 }));
    road.receiveShadow = true;
    content.add(road);
    const inst = (g: THREE.BufferGeometry, n: number, place: (i: number, m: THREE.Object3D) => void) => {
      const im = new THREE.InstancedMesh(g, vcMaterial(), n);
      const d = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        place(i, d);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
      }
      im.castShadow = true;
      content.add(im);
    };
    inst(soldierGeometry(), 48, (i, d) => {
      const a = i * 2.4;
      const r = Math.sqrt(i) * 0.42;
      d.position.set(Math.cos(a) * r, 0, 8 + Math.sin(a) * r);
      d.rotation.set(0, Math.PI, 0);
    });
    inst(soldierHeavyGeometry(), 4, (i, d) => {
      d.position.set(-1.8 + i * 1.2, 0, 10.5);
      d.rotation.set(0, Math.PI, 0);
    });
    const rnd = (() => {
      let s = 7;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    })();
    inst(zombieGeometry('walker'), 50, (_i, d) => d.position.set((rnd() - 0.5) * 8, 0, -4 - rnd() * 8));
    inst(zombieGeometry('runner'), 20, (_i, d) => d.position.set((rnd() - 0.5) * 8, 0, -3 - rnd() * 6));
    inst(zombieGeometry('brute'), 5, (_i, d) => d.position.set((rnd() - 0.5) * 7, 0, -9 - rnd() * 4));
    const boss = bossModel();
    boss.position.set(0, 0, -17);
    content.add(boss);
    const gl = mesh(gatePostGeometry());
    gl.position.set(-4.6, 0, 2);
    const gr = mesh(gatePostGeometry());
    gr.position.set(4.6, 0, 2);
    content.add(gl, gr);
    for (let i = 0; i < 6; i++) {
      const p = mesh(propGeometry(i % 2 ? 'barrel' : 'crate'));
      p.position.set(i % 3 === 0 ? -3 : i % 3 === 1 ? 0.5 : 3, 0, -1 - i * 0.6);
      content.add(p);
    }
    for (let i = 0; i < 10; i++) {
      const p = mesh(propGeometry(i % 3 ? 'pine' : 'tree'));
      p.position.set(i % 2 ? -7 : 7, 0, -20 + i * 4);
      content.add(p);
    }
    const bl = mesh(bulletGeometry(), true);
    bl.position.set(0.3, 0.6, 5);
    content.add(bl);
  },
  base() {
    // mock base at game camera distance to judge roof colours / silhouettes
    const lvl = [3, 7, 12];
    const types = BUILDING_MODEL_TYPES.filter((t) => t !== 'hq' && t !== 'wall');
    add(buildingModel('hq', 12), 0, 0, 'hq');
    types.forEach((t, i) => {
      const ring = i < 8 ? 7.5 : 12.5;
      const n = i < 8 ? 8 : types.length - 8;
      const a = ((i % 8) / n) * Math.PI * 2 + (i < 8 ? 0 : 0.3);
      add(buildingModel(t, lvl[i % 3]), Math.cos(a) * ring, Math.sin(a) * ring, t, false);
    });
    for (let i = 0; i < 3; i++) add(buildingModel('wall', 3 + i * 4), (i - 1) * 8.2, 17, 'wall', false);
    for (let i = 0; i < 12; i++) {
      const p = mesh(propGeometry(i % 3 ? 'pine' : 'tree'));
      p.position.set(-18 + (i % 6) * 7, 0, i < 6 ? -17 : -21);
      content.add(p);
    }
    const s = mesh(survivorGeometry());
    s.position.set(3, 0, 3.5);
    content.add(s);
  },
};
for (const [id, list] of Object.entries(B_GROUPS)) {
  sections[id] = () => {
    const depth = (t: string) => (t === 'hq' ? 7.5 : t === 'wall' ? 4 : 5.5);
    const total = list.reduce((s, t) => s + depth(t), 0);
    let z = -total / 2;
    list.forEach((t) => {
      const big = t === 'hq' || t === 'wall';
      z += depth(t) / 2;
      TIERS.forEach((lv, c) => add(buildingModel(t, lv), (c - 1) * (t === 'wall' ? 9.5 : big ? 7.5 : 5.5), z, `${t} L${lv}`, !big));
      z += depth(t) / 2;
    });
  };
}

// ---------------------------------------------------------------------------------------------
// UI

const bar = document.getElementById('bar')!;
const buttons: Record<string, HTMLButtonElement> = {};
let current = 'chars';
for (const id of Object.keys(sections)) {
  const b = document.createElement('button');
  b.textContent = id;
  b.onclick = () => show(id);
  bar.appendChild(b);
  buttons[id] = b;
}
const tRot = document.createElement('button');
tRot.textContent = 'rotate';
tRot.className = 'on';
tRot.onclick = () => {
  rotate = !rotate;
  tRot.className = rotate ? 'on' : '';
};
const tTop = document.createElement('button');
tTop.textContent = 'top view';
tTop.onclick = () => {
  topView = !topView;
  tTop.className = topView ? 'on' : '';
  frame();
};
bar.append(tRot, tTop);

function frame(): void {
  const box = new THREE.Box3().setFromObject(content);
  if (current === 'crowd') {
    controls.target.set(0, 0, -2);
    camera.position.set(0, topView ? 26 : 13, topView ? 8 : 20);
  } else {
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z * 0.9, size.y) * 0.62 + 1;
    const dist = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) + 1;
    const elev = topView ? 1.1 : 0.62;
    controls.target.set(c.x, Math.min(c.y, 1), c.z);
    camera.position.set(c.x, Math.sin(elev) * dist, c.z + Math.cos(elev) * dist);
  }
  const span = Math.max(40, box.getSize(new THREE.Vector3()).length());
  sun.position.set(controls.target.x + span * 0.35, span * 0.8, controls.target.z + span * 0.45);
  sun.target.position.copy(controls.target);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span * 0.7;
  sc.right = sc.top = span * 0.7;
  sc.near = 1;
  sc.far = span * 3;
  sc.updateProjectionMatrix();
  controls.update();
}

function show(id: string): void {
  current = id;
  for (const [k, b] of Object.entries(buttons)) b.className = k === id ? 'on' : '';
  clear();
  sections[id]();
  frame();
  const total = items.reduce((s, i) => s + i.tris, 0);
  infoEl.textContent = `${id}: ${items.length} items, ${total} tris. Drag to orbit, wheel to zoom.`;
  history.replaceState(null, '', '#' + id + (topView ? ',top' : ''));
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const [hashId, hashFlag] = location.hash.slice(1).split(',');
topView = hashFlag === 'top';
tTop.className = topView ? 'on' : '';
show(sections[hashId] ? hashId : 'chars');

// ---------------------------------------------------------------------------------------------
// Loop

const timer = new THREE.Timer();
const v = new THREE.Vector3();
renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  for (const it of items) {
    if (rotate && it.spin) it.obj.rotation.y += dt * 0.4;
    animateModel(it.obj, dt, t);
    v.set(it.obj.position.x, it.top, it.obj.position.z).project(camera);
    const vis = v.z < 1;
    it.el.style.display = vis ? '' : 'none';
    if (vis) it.el.style.left = `${((v.x + 1) / 2) * window.innerWidth}px`;
    if (vis) it.el.style.top = `${((1 - v.y) / 2) * window.innerHeight}px`;
  }
  content.children.forEach((c) => {
    if (!items.some((i) => i.obj === c)) animateModel(c, dt, t);
  });
  controls.update();
  renderer.render(scene, camera);
});

// expose for debugging in the console
/** Close-up: orbit camera around (x, ty, z) at distance/elevation/azimuth. */
function look(x: number, z: number, dist: number, elev = 0.5, az = 0, ty = 0.6): void {
  controls.target.set(x, ty, z);
  camera.position.set(x + Math.sin(az) * Math.cos(elev) * dist, ty + Math.sin(elev) * dist, z + Math.cos(az) * Math.cos(elev) * dist);
  controls.update();
}
/** Freeze auto-rotation and set every item's yaw. */
function pose(yaw: number): void {
  rotate = false;
  tRot.className = '';
  for (const it of items) if (it.spin) it.obj.rotation.y = yaw;
}
/** Close-up on an item by label (distance scaled to its size; k multiplies the distance). */
function focus(label: string, elev = 0.5, az = 0.6, k = 1): string {
  const it = items.find((i) => i.label === label);
  if (!it) return 'no item ' + label;
  const box = new THREE.Box3().setFromObject(it.obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.5;
  look(c.x, c.z, (r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.25 * k, elev, az, c.y);
  return 'ok';
}
(window as unknown as { gallery: unknown }).gallery = { scene, camera, controls, show, look, pose, frame, focus, items: () => items };
