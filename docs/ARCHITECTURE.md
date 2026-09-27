# Outpost Surge — Architecture & Team Contract

Outpost Surge is an **original** mobile game that recreates the gameplay loop of the
"squad runner + zombie-survival base builder" genre popularised by *Last War: Survival*:
gate-runner squad levels, base building, hero squads with type counters, auto-battle
campaign stages, and a zombie-infested world map.

## IP rules (non-negotiable)
- Recreate **mechanics** only. Never copy names, hero names, story text, UI text, logos, art or audio
  from Last War or any other game. All hero names, building names, flavour text and models are ours.
- All art is procedural low-poly geometry built in code (`src/three/models`), all icons are inline SVG,
  all sound is synthesized (`src/core/audio.ts`). **No external asset files, no network requests, no CDNs.**

## Stack
- TypeScript (strict) + Vite + Three.js + Preact (+ @preact/signals). Portrait-first mobile UI.
- Commands: `npm run dev`, `npm run typecheck`, `npm run build`.
- Shipped as a PWA (GitHub Pages) and an Android APK (Capacitor, built in GitHub Actions).

## Directory map & ownership
Each agent owns specific files. **Only edit files you own.** If you truly need a change in a shared
file, keep it minimal and additive (e.g. append an event to `GameEvents`) and list it in your final report.

| Area | Owner | Files |
|---|---|---|
| Core contracts | lead | `src/core/*`, `src/three/engine.ts`, `src/ui/App.tsx`, `src/ui/screens.ts`, `src/modes/index.ts`, `src/modes/huds.ts`, `src/main.tsx`, `index.html` |
| 3D art | art | `src/three/models/**` |
| Base building | base | `src/modes/base/**`, `src/state/base.ts`, `src/systems/buildings.ts`, `src/data/buildings.ts`, `src/init/base.ts` |
| Heroes, battle, campaign | heroes | `src/modes/battle/**`, `src/ui/heroes/**`, `src/state/heroes.ts`, `src/systems/{heroes,battle,campaign}.ts`, `src/data/heroes.ts`, `src/init/heroes.ts` |
| World map | world | `src/modes/world/**`, `src/state/world.ts`, `src/systems/world.ts`, `src/data/world.ts`, `src/init/world.ts` |
| Gate runner | runner | `src/modes/runner/**`, `src/state/runner.ts`, `src/data/runner.ts`, `src/init/runner.ts` |
| HUD & meta systems | meta | `src/ui/hud/**`, `src/ui/meta/**`, `src/ui/components/**`, `src/ui/styles.css`, `src/state/meta.ts`, `src/systems/{troops,research,quests,items,daily}.ts`, `src/data/{items,research,quests,troops}.ts`, `src/init/meta.ts` |
| Packaging & CI | deploy | `capacitor.config.ts`, `android/**`, `.github/**`, `public/**`, `README.md` |

You may create new files inside your own folders freely (e.g. `src/modes/runner/gates.ts`,
`src/modes/runner/runner.css`). Put module-specific CSS in your own `.css` file and import it from your code.

## Core contracts

### State (`src/core/store.ts`)
- `game` is the single mutable `GameState`. Read it anywhere. **Write only inside `mutate(s => ...)`.**
- Components call `useGame()` to subscribe (re-render on any change).
- State is split into slices owned by modules: `game.base`, `game.heroes`, `game.world`, `game.runner`,
  `game.meta` (see `src/state/*.ts`). Shared: `currencies`, `items`, `stats`, `settings`, `player`.
- Extend your own slice freely; always give new fields defaults in your `default*State()` — old saves are
  deep-merged with defaults on load.
- Saved to localStorage automatically (every 5 s when dirty, and on app hide).

### Time (`src/core/tick.ts`)
- Always use `now()` (not `Date.now()`) for game timers — dev tools can skip time.
- All timers are **absolute timestamps** (`endsAt`), so offline progress is automatic.
- `registerTicker(name, (s, now) => changed)` runs at 1 Hz; mutate `s` directly inside the ticker and
  return `true` if anything changed. `clock` is a signal for countdown UIs.

### Economy (`src/core/economy.ts`)
- `canAfford`, `spendIn(s, cost)` (inside mutate), `grantIn(s, reward)` (inside mutate), `grant(reward)`.
- `Reward` = currencies + items + heroShards + heroes + troops. Hero parts are applied by the heroes module
  via `registerHeroGrantHandler`.
- Currencies: `food`, `iron`, `gold`, `diamonds` (premium, earned in-game only — no real money), `heroExp`.
- No global storage cap on resources (producers have their own uncollected storage cap).

### Events (`src/core/events.ts`)
- `emit('building:upgraded', {...})`, `on('zombies:killed', fn)`. Emit the relevant events from your module:
  quests, daily tasks and stats depend on them. Emit **after** your `mutate()` call, not inside it.

### Bonuses & power (`src/core/bonuses.ts`)
- Register providers at import time in your `src/init/<module>.ts`:
  `registerBonusProvider('research', s => ({ atk_pct: 5 }))`, `registerPowerProvider('buildings', s => ...)`.
- Consumers use `getBonus(s, key)` / `bonusMult(s, key)`; the HUD shows `totalPower(s)`.
- Power providers: heroes module → `'heroes'` (hero power incl. gear/skills), meta → `'troops'` and
  `'research'`, base → `'buildings'`.

### Navigation (`src/core/nav.ts`)
- 3D modes: `goTo('base' | 'world' | 'runner' | 'battle', params)`. One mode at a time; `goTo` closes overlays.
- Overlay screens: `openScreen(id, props)` / `closeScreen()`. Each module registers screens in its own
  registry file (`src/modes/base/screens.ts`, `src/ui/heroes/screens.ts`, `src/modes/world/screens.ts`,
  `src/modes/runner/screens.ts`, `src/ui/meta/screens.ts`). Screens receive `screenKey` in props.
- `toast(text, 'good' | 'bad' | 'info')` for transient messages.
- Use the shared components in `src/ui/components/common.tsx` (`Screen`, `Modal`, `Btn`, `Bar`,
  `Countdown`, `CostView`, `Tabs`, `RedDot`) and `Icon` for a consistent look.

### Screen ids other modules rely on (implement these!)
| id | owner | props | purpose |
|---|---|---|---|
| `rewards` | meta | `{ title?: string; reward: Reward }` | "You received" popup. Display only — caller grants first. |
| `speedup` | meta | `{ title: string; getEndsAt: () => number \| null; apply: (ms: number) => void; onFinishNow?: () => void }` | Use speed-up items / diamonds on any timer. `apply(ms)` reduces the timer by ms; if it reaches 0 the owner's ticker completes it. |
| `bag` | meta | — | Inventory; use items. |
| `quests` | meta | — | Chapter quests. |
| `daily` | meta | — | Daily tasks + activity chests. |
| `research` | meta | — | Tech tree (opened from the Tech Center). |
| `barracks` | meta | `{ uid: string }` | Train soldiers (opened from a Barracks). |
| `hospital` | meta | `{ uid: string }` | Heal wounded (opened from a Hospital). |
| `settings` | meta | — | Sound, quality, reset, dev tools (time skip, resources). |
| `buildingPanel` | base | `{ uid: string }` | Building info/upgrade + building-specific actions. |
| `buildMenu` | base | `{ plot: number }` | Choose a new building for an empty plot. |
| `heroes` | heroes | — | Hero roster. |
| `heroDetail` | heroes | `{ heroId: string }` | Level up / star up / skills / gear. |
| `recruit` | heroes | — | Recruitment (tickets, diamonds, pity). Opened from HUD and the Tavern. |
| `formation` | heroes | `{ squadId?: number }` | Assign 5 heroes (2 front / 3 back) to squads. Opened from HUD and the Drill Ground. |
| `campaign` | heroes | — | Auto-battle stage list + idle (AFK) rewards. |
| `runnerLevels` | runner | — | Survival Run level select. |

### 3D engine (`src/three/engine.ts`)
- One shared `WebGLRenderer`. Each mode implements `GameMode { scene, camera, enter(params), exit(), update(dt, t), resize(w,h) }`.
- Input: add pointer listeners to `engine.canvas` in `enter()`, remove them in `exit()`.
  UI overlays are `pointer-events: none` except buttons/`.interactive`, so touches reach the canvas.
- Use `toNDC(e)` + `THREE.Raycaster` for picking. Respect `game.settings.quality` ('low' disables shadows).
- Modes are created lazily once and reused — don't rebuild the world every `enter()` unless needed.

### Models (`src/three/models/index.ts`)
Stable API: `soldierGeometry()`, `zombieGeometry(variant)`, `bossModel()`, `vehicleModel(type, rarity)`,
`buildingModel(type, level)`, `constructionModel()`, `propGeometry(kind)`, `survivorGeometry()`,
plus `buildColored`, `vcMaterial`, `vcMesh`, `P` for building your own. Characters face **+Z**.
Use `InstancedMesh` with `soldierGeometry()`/`zombieGeometry()` for crowds. The art agent will make these
look great behind the same API; code against the API, not the current placeholder look.

### Cross-module query APIs (keep signatures)
- base → `src/systems/buildings.ts`: `hqLevel(s)`, `buildingLevel(s, type)`, `buildingsOf(s, type)`,
  `getBuilding(s, uid)`, `productionPerHour(s, res)`, `troopCapacity(s)`, `hospitalCapacity(s)`,
  `maxTrainTier(s)`, `trainBatchSize(s, barracksUid?)`, `marchSizePerHero(s, heroType)`, `freeFinishMs(s)`.
- lead → `src/core/nav.ts`: `focusBuilding({ uid? | type?, openPanel? })` pans the base camera to a building
  (quest "Go" buttons, requirement links). Base mode implements it by watching the `baseFocus` signal.
- lead → `src/core/unlocks.ts`: `isUnlocked(s, feature)`, `unlockHint(feature)`, `districtsCleared(s)`.
- heroes → `src/systems/heroes.ts`: `squadCombatants(s, squadId)`, `squadPower(s, squadId)`, `squadReady(s, squadId)`.
- heroes → `src/systems/battle.ts`: `simulateBattle(a, b, seed)`, `startBattle(req)`, `BattleResult`.
- meta → `src/systems/troops.ts`: `totalTroops(s)`, `bestTroopTier(s)`, `applyTroopLosses(s, n)`.

## Game design baseline (shared numbers — tune within your module, keep the feel)

Read `docs/GAME_REFERENCE.md` (researched mechanics of the genre-defining game, sections 1-9) for detail.
Match its mechanics and feel; compress timers ~30-100x so HQ 10 takes ~1-2 h of play.

**Core loop**: Special Ops runner levels + district battles → resources/EXP/troops → upgrade buildings
(HQ gates everything) → recruit & level heroes → set formation → clear more districts, fight world-map
zombies → repeat. One headline **Power** number everywhere. Early game must be fast and rewarding (first
upgrades take seconds; the chapter quest tracker always tells the player what to do next).

- **Opening**: a brand-new player starts in runner level 1 (`goTo('runner', {level: 1, intro: true})`):
  short, easy, flashy, ends with a boss. On finishing set `game.runner.introDone = true`, grant rewards,
  `goTo('base')`. Runner levels are then replayable/progressive from the base ("Special Ops", 8-level chapters).
- **Runner** (GAME_REFERENCE §1): drag left/right, auto-fire, floating soldier-count label; blue `+N`/`xN`
  and red `-N`/`÷N` gates, **each bullet hit raises a gate's value by 1** (red can be shot to blue); barrels
  with HP + reward icon (soldiers, weapon upgrade, helper unit); walkers, fast dogs, brutes, boss with a top HP
  bar. Win = boss dead/end reached with ≥1 soldier; stars by % of peak kept. **Surviving soldiers become real
  troops** (`reward.troops` at `bestTroopTier`, max 60/level) plus resources/heroExp.
- **Districts** (§2.7): the base is surrounded by zombie-infested district blocks. Campaign stage N = district
  N (`game.heroes.campaign.stage` = next district, `districtsCleared(s)` in `src/core/unlocks.ts`). Heroes module
  owns stage enemies/battles/rewards (`campaign` screen); base module renders districts (infested → cleared) and
  unlocks building plots as districts are cleared. Clearing districts is the first-hour backbone.
- **Feature unlocks**: use `isUnlocked(s, feature)` / `unlockHint(feature)` from `src/core/unlocks.ts`.
- **HQ gating** (§2.3): no building may exceed HQ level. Each HQ level requires two specific buildings at
  (target-1), rotating through wall/barracks/drill/tankcenter/hospital, with Tech Center required from HQ 8.
  Building types/plots unlock at HQ levels and cleared districts. Hero level cap = 5 × HQ level.
- **Builders**: 1 queue by default; a 2nd permanent queue can be bought for 500 diamonds. Upgrades with
  ≤ 5 min remaining can be finished free. Speed-up items 1m/5m/1h/8h. Instant-finish with diamonds.
- **Timers/costs**: L1→2 a few seconds, ~1 min by L4, ~10 min by L8, ~1 h by L12, hours beyond. Costs grow
  ~1.75× per level early, ~1.5× mid, ~1.35× late. Coins (gold) needed from ~HQ 8+.
- **Production** (§2.6): farm/iron mine produce ~ (level × 1150)/h scaled down for early pacing is fine, gold mine
  ~720 × level/h, Training Base produces heroExp. Each producer stores up to 10 h then stops; a bubble floats
  above it; tap to collect. Campaign idle rewards ("loot truck") cap at 8 h.
- **Hero types & counters** (§3): tank > missile > aircraft > tank; counter = +20% dmg dealt AND -20% dmg taken.
  Same-type squad bonus to atk/hp/def: 3 same +5%, 3+2 +10%, 4 +15%, 5 +20%.
- **Heroes**: rarity SR (blue) / SSR (purple) / UR (gold); stars cost 25/50/100/300/500 shards; 3 skills
  (auto attack, charged active, passive) upgraded with `skill_medal`; 4 gear slots; EXP from `heroExp`.
  Starter squad: a few Tank heroes are granted at game start so district 1 is winnable.
- **Recruitment**: tickets / diamonds; free pull timer; x1 and x10; duplicates → shards; UR pity.
  Rates UR 2% / SSR 18% / SR 80%, UR pity at 50 (tunable).
- **Formation**: 5 slots, front row (0-1) targeted first. Squad 1 at start; squads 2-4 via `squad2..4` unlocks.
- **Troops** (§4): no types, tiers T1..T10 trained in Barracks (tier by barracks level); Drill Ground sets troop
  capacity; each hero leads up to its march size of troops (highest tier first); troops add HP/ATK.
  Losses become wounded (hospital capacity), overflow dies.
- **World map** (§6): zombie hordes lv 1..N (can attack up to `maxHordeLevel + 1`), 10 stamina per attack,
  stamina cap 120, +1 per 5 min; resource tiles to gather; marches take real travel time; radar board of
  ~10 missions refreshing every 6 h.
- **Quests/daily** (§8): chapter quest chains with a left-side tracker + "Go" button; daily tasks → activity
  points → 5 chests (200 points).
- **HUD layout** (§7): top-left avatar + Power; top resource bar (food, iron, gold, diamonds); left quest tracker;
  right edge event/feature icons with red dots; bottom bar (Tasks, Heroes, Bag, Recruit, ...); big World/Base
  toggle bottom-right; runner entry as a vehicle icon near the base gate.

## Mobile & performance rules
- Portrait. Touch-first (large hit areas ≥ 40 px). Respect safe areas (`--safe-top` etc.).
- Target 60 fps on mid-range phones: instanced crowds, merged geometry, one shared material where possible,
  ≤ ~150 draw calls, avoid per-frame allocations, pool bullets/effects, cap particle counts.
- Dispose geometries/materials you create dynamically (never dispose cached model geometries).
- No `alert()`/`confirm()`; use `Modal`.

## Definition of done for each module
- `npm run typecheck` passes with zero errors and `npm run build` succeeds.
- No console errors at runtime in your mode/screens.
- Your module's screens/modes are reachable via the ids/APIs above and work end-to-end with the stubbed
  or real APIs of other modules.
