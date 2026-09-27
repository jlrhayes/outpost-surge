// OWNER: world agent. Idle-time warm-up so the first visit to the world map doesn't stall: once the map is
// unlocked and the player is idling in the base, the terrain, the cached scenery/entity geometry and the
// static terrain view are built in small requestIdleCallback slices. WorldMode picks the prebuilt terrain
// view up via takePrebuiltTerrain() (the decor chunk meshes still stream in on first entry).
import { game } from '../../core/store';
import { route } from '../../core/nav';
import { isUnlocked } from '../../core/unlocks';
import { getTerrain } from '../../systems/world';
import { buildingModel, flagModel, propGeometry, resourceNodeGeometry, zombieGeometry, type PropKind } from '../../three/models';
import {
  cacheGeometry,
  campGeometry,
  deadTreeGeometry,
  digGeometry,
  mapPineGeometry,
  mapShrubGeometry,
  mapTreeGeometry,
  rockVariant,
  ROCK_VARIANTS,
  ruinedBlockBody,
  ruinGeometry,
  RUIN_VARIANTS,
} from './geo';
import { buildTerrainView, type TerrainView } from './terrainView';

let prebuilt: { seed: number; quality: 'low' | 'high'; view: TerrainView } | null = null;
/** Set once the world mode built its own scene: no more warm-up needed. */
let worldBuilt = false;
let running = false;

/** The idle-built terrain view for this seed/quality, if any (ownership passes to the caller). */
export function takePrebuiltTerrain(seed: number, quality: 'low' | 'high'): TerrainView | null {
  worldBuilt = true;
  const p = prebuilt;
  prebuilt = null;
  if (p && p.seed === seed && p.quality === quality) return p.view;
  p?.view.dispose();
  return null;
}

type Idle = (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number;
const idle: Idle =
  typeof (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback === 'function'
    ? (cb, o) => (window as unknown as { requestIdleCallback: Idle }).requestIdleCallback(cb, o)
    : (cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 50);

function jobs(): (() => void)[] {
  const seed = game.world.seed;
  const quality = game.settings.quality;
  const list: (() => void)[] = [
    () => void getTerrain(seed),
    () => {
      mapTreeGeometry(0);
      mapTreeGeometry(1);
    },
    () => {
      mapPineGeometry(0);
      mapPineGeometry(1);
      mapShrubGeometry();
      deadTreeGeometry();
    },
    () => {
      for (let i = 0; i < ROCK_VARIANTS; i++) rockVariant(i);
    },
  ];
  for (let i = 0; i < RUIN_VARIANTS; i++) list.push(() => void ruinGeometry(i));
  const props: PropKind[] = ['grass', 'car_wreck', 'barrel', 'tire', 'crate', 'roadblock', 'ruin', 'sandbag', 'barrier', 'tent', 'container', 'ammo_crate'];
  for (const k of props) list.push(() => void propGeometry(k));
  list.push(
    () => {
      resourceNodeGeometry('food');
      resourceNodeGeometry('iron');
      resourceNodeGeometry('gold');
    },
    () => {
      campGeometry();
      cacheGeometry();
      digGeometry();
      zombieGeometry('walker');
      zombieGeometry('brute');
      flagModel(0xffffff);
    },
    () => {
      for (const bl of getTerrain(seed).blocks) ruinedBlockBody(bl.seed);
    },
    () => {
      for (const e of game.world.entities) if (e.kind === 'rival') buildingModel('hq', Math.max(1, Math.min(30, e.level)));
    },
    () => {
      if (worldBuilt || game.world.seed !== seed || game.settings.quality !== quality) return;
      prebuilt?.view.dispose();
      prebuilt = { seed, quality, view: buildTerrainView(getTerrain(seed), quality) };
    },
  );
  return list;
}

/** Starts the warm-up when the world is unlocked and the player sits in the base (checked every few seconds). */
export function schedulePrewarm(): void {
  const check = () => {
    if (worldBuilt) return;
    if (!running && route.value.mode === 'base' && isUnlocked(game, 'world') && game.world.seed) {
      running = true;
      run(jobs());
      return;
    }
    window.setTimeout(check, 4000);
  };
  window.setTimeout(check, 6000);
}

function run(list: (() => void)[]): void {
  const step = (d: { timeRemaining(): number }) => {
    if (worldBuilt) return;
    // only while idling in the base; otherwise try again later
    if (route.value.mode !== 'base') {
      window.setTimeout(() => idle(step, { timeout: 3000 }), 2000);
      return;
    }
    let n = 0;
    while (list.length && (n === 0 || d.timeRemaining() > 6)) {
      const job = list.shift()!;
      try {
        job();
      } catch (e) {
        console.warn('world prewarm step failed', e);
      }
      n++;
    }
    if (list.length) idle(step, { timeout: 3000 });
  };
  idle(step, { timeout: 3000 });
}
