// OWNER: runner agent. Materials the runner keeps for the app's lifetime. Creating and disposing them on
// every run start/Retry made three.js release and recompile their shader programs (a ~90 ms hitch on the
// first frame); cached here they compile once. Per-level textures are swapped in via `.map`.
import * as THREE from 'three';

const store = new Map<string, THREE.Material>();
function keep<T extends THREE.Material>(key: string, make: () => T): T {
  let m = store.get(key) as T | undefined;
  if (!m) store.set(key, (m = make()));
  return m;
}

/** Additive unlit particles (sparks, muzzle flashes, explosion glow). */
export const glowParticleMat = () =>
  keep('glow', () => new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));

/** Lit flat-shaded chunks (dust puffs, debris). */
export const puffMat = () => keep('puff', () => new THREE.MeshLambertMaterial({ flatShading: true }));

/** Additive double-sided ground rings / discs (shockwaves, acid landing circles, hazard glow). */
export const ringMat = () =>
  keep('ring', () => new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));

/** Helper-vehicle shells. */
export const shellMat = () => keep('shell', () => new THREE.MeshBasicMaterial({ color: 0xffc050, toneMapped: false }));

/** Road and ground (the chapter's canvas texture is assigned to `.map` on each run). */
export const roadMat = () => keep('road', () => new THREE.MeshLambertMaterial());
export const groundMat = () => keep('ground', () => new THREE.MeshLambertMaterial());

/** Pulsing red glow over hazard zones (shared, so it pulses in sync). */
export const hazardGlowMat = () =>
  keep('hazardGlow', () => new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
