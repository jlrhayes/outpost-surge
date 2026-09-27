# Game Mechanics Reference: "Last War: Survival" (FUNFLY, 2023)

Purpose: a mechanics-only reference for building an ORIGINAL single-player game that plays like
Last War: Survival. It covers systems, numbers and pacing. It contains no art, story text,
character names, event names or other branding. Everything is paraphrased.

Confidence tags used below:
- **[S]**: stated by one or more community guides or wikis (see Sources at the end).
- **[S~]**: sources disagree or are vague. A range or consensus value is given.
- **[E]**: estimate, or a design inference from observed gameplay and ads. Treat it as a tunable default.

---

## 0. The game at a glance

- Portrait-orientation mobile 4X / base-builder with hero gacha, set in a zombie apocalypse with a
  modern-military look (tanks, jets, missile trucks) **[S]**. Released Aug 2023. It passed US$2B lifetime
  revenue by early 2025 **[S]**.
- It is famous for ads showing a squad running through math gates (+N / xN). The real game is about 80-95%
  base management and squad power. The runner/shooter shows up as a tutorial, early campaign flavour, and
  several side modes (estimated 5-20% of playtime) **[S~]**.
- Core loop **[S/E]**:
  1. Collect resources from buildings.
  2. Upgrade buildings, with HQ gating everything.
  3. Train soldiers and level/star heroes.
  4. Build a 5-hero squad and raise its "power".
  5. Fight PvE (campaign districts, world-map zombies, runner levels).
  6. Earn resources, shards, EXP and speedups, then go back to step 1.
  7. Timers and daily tasks pace the whole loop.

---

## 1. Gate-runner / squad-shooter levels

### 1.1 Where the runner/shooter exists in the real game (4 flavours)
1. **Opening tutorial and early campaign stages** **[S~]**. These are vertical lane shooters. Your units
   auto-fire at zombies coming down from the top of the screen, and you slide left/right to dodge and pick
   power-ups. Heroes appear in these stages as units with their own weapons.
2. **Special-ops runner mode** **[S]**. You enter it from a vehicle icon on the base screen. It has 48 levels
   grouped into chapters of 8. Soldiers who survive to the end of a level become real troops at your
   highest trainable tier, capped at **60 per level**. This is a free troop source that ties the minigame to
   the 4X layer.
3. **Weekly skill runner event** **[S]**. It runs on one weekday. Everyone starts with the same event troops,
   so hero and base power don't matter. There are 5 escalating levels. You rank by levels cleared, with
   remaining troops as the tie-breaker. Quitting mid-level counts as a failure. Participating 3 times unlocks
   the objective rewards.
4. **Math-gate race event (the purest ad replica)** **[S]**. A single runner slides left/right to pick one of
   two math operations (+, -, x, ÷). Each round has **8 consecutive gate choices**. At the end an obstacle (a
   "zombie bus") subtracts a fixed amount, and you have to finish above it. Casual mode has 30 players and
   rewards the highest scores. Survival mode has 20 players and is won by the last one above 0. Operation
   order matters: when both sides offer + and x, take the + first and then multiply.

### 1.2 Controls and camera
- Portrait, camera behind and above the squad, looking up a straight road. The road auto-scrolls toward the
  player **[S/E]**.
- **Drag horizontally** anywhere on screen to move the whole squad left/right. You have no forward or
  backward control **[S]**.
- **Auto-fire** is always on. Bullets travel straight up the lane **[S]**. (One guide mentions tap-to-shoot
  in a variant. Auto-fire is the standard.)
- Keep the squad near the centre so you can reach both sides in time **[S]**.

### 1.3 Squad and count display
- The squad is a cluster of small soldier figures, packed tighter as it grows. A **big number label floats
  above the cluster** showing the soldier count **[E, standard for the genre, also seen in ads]**.
- Soldiers are both your **damage** (each one fires) and your **health bar** (each contact loses soldiers)
  **[S]**.
- A hero or helper unit gained from a barrel appears as a distinct larger unit with its own weapon. Example:
  an explosive-missile helper deals splash damage, and that splash can hit your own nearby soldiers **[S]**.

### 1.4 Gates (numbered barriers)
- These are translucent panels that span half the road, usually in pairs (left/right). Each shows a big
  signed number **[S]**.
- **Blue = positive** (adds soldiers). **Red = negative** (removes soldiers) **[S]**.
- **Key Last-War twist: shooting a gate changes its value.** Each bullet hit raises the number by a
  fixed step, whatever the damage. A red gate can turn blue if you pour enough hits into it **[S]**. So
  hit-count (fire rate x soldier count) matters here, not damage per bullet.
- In the ads and the math event, gates also come in **xN** and **÷N** (and ± on a single runner) **[S]**.
- Walking into a negative gate can **wipe out large groups at once**. Touching the wrong one is a common way
  to lose **[S]**.
- Suggested gate set for a recreation **[E]**: `+N`, `-N`, `xN` (x2 to x5), `÷N` (÷2 to ÷3), plus
  shootable-value gates (start at, say, -20, +1 per hit). You can also add a **weapon gate** (fire-rate +X%,
  bullet count +1, weapon swap).

### 1.5 Barrels and crates
- Barrels roll down the lane or sit in it. Each one shows an **HP number and an icon** for its contents
  **[S]**.
- Barrels **take real damage**, unlike gates, which count hits. A high-damage unit can pop one in a
  single shot **[S]**.
- Contents seen **[S]**:
  - **extra soldiers** (the most important early on)
  - **weapon upgrades or new weapons** (faster barrel and obstacle breaking)
  - **helper hero units**
  - **debuffs applied to enemies**
  - **troop restores**
- Strategy notes from sources **[S]**:
  - Early in a level, prioritise soldier barrels.
  - Once you have about 10 soldiers, switch focus to shooting numbered gates.
  - Rushing past key barrels is the most common cause of failing later levels.

### 1.6 Enemies
- Waves of walking zombies come down the lane. Each touch removes soldiers **[S]**.
- **Fast dog-type zombies** do heavy damage if they reach the squad. Kill them first **[S]**.
- **Elites** are tougher enemies that punish poor focus **[S]**.
- **Obstacles and traps** are hazards you have to dodge **[S]**.
- Suggested enemy list for a recreation **[E]**: walker (low HP, slow), runner/dog (low HP, fast), brute
  (high HP, removes several soldiers on contact), spitter (ranged projectile you can dodge), boss.

### 1.7 Boss / end of level
- Many levels end with a boss, a big zombie with a large HP bar, that you have to kill before it reaches the
  squad **[S]**. Some levels are variants, such as knocking enemies off a fortress with limited cannon shots
  **[S, variant]**.
- The math event ends with a fixed-value subtraction obstacle instead of a boss **[S]**.

### 1.8 Win, fail and scoring
- **Fail** when the soldier count reaches 0, or when you exit mid-level **[S]**.
- **Win** when you reach the end, or kill the boss, with at least 1 soldier **[S]**.
- **Score** is levels cleared, then soldiers remaining **[S]**. Recommended for a recreation **[E]**:
  1-3 stars based on % of peak soldiers kept.

### 1.9 Rewards and frequency
- The runner mode turns surviving soldiers into real troops, max 60 per level, at your top trainable tier
  **[S]**. Early campaign stages give hero EXP and gold/coins, and guides suggest clearing about 10-15
  early stages on day 1-2 **[S]**. Events give chests and ranking rewards **[S]**.
- Frequency in the real game **[S~]**: the tutorial, then about 48 levels on demand, one weekly event, and
  a periodic math race.
- **Recommendation for the recreation [E]**: treat the runner as the **campaign's action layer**. Examples:
  - every 3rd district stage is a runner level, or
  - runner levels unlock as a "chapter" per HQ level,
  - surviving soldiers pay out as troops or resources.

### 1.10 Suggested tuning defaults [E]
- Level length 45-90 s. Gate pairs every ~6-8 s. 6-10 gate encounters, 3-5 barrels, 4-8 enemy waves, and
  an optional boss.
- Starting squad 1-10 soldiers. Typical peak 50-300. Cap the rendered figures at about 150 and show the true
  number in the label.
- Fire rate is about 3-5 shots/s per soldier, capped globally for performance. Each soldier's bullet adds
  +1 to a gate's value and does 1 damage to barrels and enemies.
- Contact rule is "crowd vs crowd": each enemy HP point removes 1 soldier, or a brute removes N.

---

## 2. Base building

### 2.1 Resources [S]
| Resource | Source | Main use |
|---|---|---|
| **Food** | Farmland, world-map tiles, PvE loot | building upgrades, training |
| **Iron** | Iron Mine, tiles, loot | building upgrades, training |
| **Coins (gold)** | Gold Mine, loot. Needed from about HQ 9-10 onward | upgrades, research, gear |
| **Diamonds** | premium, from tasks, events and achievements | speedups, packs, VIP, 2nd builder |
| **Hero EXP** | Training Base (hourly), PvE | hero levels |
| **Hero shards** (specific and universal) | recruitment, events, PvE | star-ups |
| **Skill medals** | PvE and events | skill levels |
| **Gear materials** (ore etc.) | Smelter, workshops | gear crafting and upgrades |
| **Speedups** (general, construction, training, research, healing) | tasks, events | cut timers |
| **Stamina** | regenerates over time | world-map attacks |
| **Oil** | late game, beyond HQ 30 only | not needed for a recreation |
- Resources in your storage above warehouse-protected amounts can be stolen in PvP **[S]**. In single
  player, the equivalent is AI raids, or you can drop this rule.

### 2.2 Building list
The count and unlock columns are **[S]** where known and **[E]** otherwise.
| Building | What it does | Unlock / count |
|---|---|---|
| **Headquarters (HQ)** | Caps every other building's level. Each level raises the hero level cap by +5 and hero HP/ATK/DEF, and unlocks features | 1. Max 30 (35 later) |
| **Farmland** | Produces food per hour | 2 in the tutorial, more later [E: up to about 5] |
| **Iron Mine** | Produces iron per hour | from HQ 2 |
| **Gold Mine** | Produces coins per hour | from about HQ 9 [S~] |
| **Warehouses** (food / iron / coin vault) | Protect a set amount of each resource from plunder | early-mid |
| **Barracks** | Train soldiers. Level sets the tier you can train and the batch size | 1 early, up to 4 via research |
| **Drill Ground** | Houses trained soldiers (troop capacity) | 1 in the tutorial, 2nd at HQ 16, 3rd at HQ 21, 4th via research |
| **Hospital** | Holds and heals wounded soldiers. Overflow dies | early, up to 4 |
| **Emergency center** | Recovers a share of otherwise-dead soldiers | later (about HQ 20+) |
| **Wall** | Base defense. Durability and burn resistance per level. Up to 5 squads can garrison it | early (HQ 3 needs Wall 2) |
| **Squad buildings (1st, 2nd, ...)** | One per squad. Level raises that squad's march speed | 1st at the start (HQ 2 needs it) |
| **Tank / Aircraft / Missile Center** | Raise stats and march size for heroes of that type (L1: +10 march size ... L30: +100) | Tank Center at HQ 6. The others follow later |
| **Tech Center** | Research trees. Required at every HQ level from 8 onward | HQ 7. 2nd and 3rd much later |
| **Training Base** | Produces hero EXP per hour (L1 1,440/h, L10 20,880/h, L20 108,000/h, L30 259,200/h) | up to 5 |
| **Tavern** | Hero and survivor recruitment. Free recruit cooldown drops from 3 days (L1) to 2 days (L30) | unlocks at about campaign district 7 |
| **Builder's Hut** | Adds free-finish time to construction (0 at L1, up to 30 min at L30) | early |
| **Alliance Center / Support Hub** | Alliance help (timer cuts) and alliance tech | about HQ 4-5 |
| **Recon plane / Radar** | Scouting, the radar mission board, rescuing survivors | early (HQ 3 needs Recon 1) |
| **Gear Factory** | Craft, upgrade and dismantle hero gear | about HQ 9 [S~] |
| **Smelter / Material Workshop** | Produce gear materials | mid |
| **Drone systems** (center, parts, chips) | A global stat-buffing drone that you level | about district 38 |
| **Talent hall** | Overview of survivor assignments | mid |
- Survivors are a secondary collection **[S]**. Grey/green/blue/purple/gold rarities are assigned to
  buildings, with about 4 slots per building. Each role buffs something specific: production, build speed,
  research, training, healing or cost. For example, a purple production survivor gives about +32%.

### 2.3 HQ gating: prerequisite chain [S]
Each HQ level needs **two other buildings at (target-1)**. From HQ 8 onward, one of them is always the
Tech Center.
| HQ | Requires | Food & Iron (each) | Coins | Base time |
|---|---|---|---|---|
| 2 | Drill Ground 1, 1st Squad 1 | ~34-68 | - | 2-4 s |
| 3 | Wall 2, Recon 1 | ~1K | - | 47 s |
| 4 | Barracks 3, Drill Ground 3 | ~2.5K | - | ~1 m |
| 5 | Wall 4, Barracks 4 | ~20K | - | ~11 m |
| 6 | Wall 5, Drill Ground 5 | ~91K | - | ~35 m |
| 7 | Wall 6, Tank Center 6 | ~240K | - | ~1.5 h |
| 8 | Tech Center 7, Alliance Center 7 | ~390K | - | ~3 h |
| 9 | Tech Center 8, Tank Center 8 | ~620K | ~200K | ~4.4 h |
| 10 | Tech Center 9, Hospital 9 | ~750K | ~240K | ~5.7 h |
| 12 | Tech Center 11, Barracks 11 | ~3.2M | ~1M | ~9.6 h |
| 15 | Tech Center 14, Wall 14 | ~6.8M | ~2.2M | ~23 h |
| 20 | Tech Center 19, Barracks 19 | ~60M | ~19M | ~5 days |
| 25 | Tech Center 24, Tank Center 24 | ~290M | ~93M | ~22 days |
| 30 | Tech Center 29, Drill Ground 29 | ~1.4B | ~460M | ~57-101 days (sources differ) |
- Pattern: the second prerequisite rotates through Wall, Barracks, Drill Ground, Tank Center, Hospital and
  Alliance Center. That rotation makes you upgrade a broad set of buildings.
- HQ power per level: L1 900, L10 9,900, L20 67,900, L30 388,300 **[S]**.

### 2.4 Cost and time scaling (reference: Farmland) [S]
| Lvl | Iron | Food | Coin | Time |
|---|---|---|---|---|
| 1 | 15 | 5 | - | 1 s |
| 2 | 230 | 75 | - | 12 s |
| 5 | 5,100 | 1,700 | - | 2 m 56 s |
| 10 | 93K | 31K | 20K | 42 m 36 s |
| 15 | 860K | 290K | 180K | 2 h 50 m |
| 20 | 7.5M | 2.5M | 1.6M | 15 h 16 m |
| 25 | 36M | 12M | 7.7M | 2 d 18 h |
| 30 | 180M | 60M | 39M | 13 d 6 h |
- Growth per level, derived: cost is about x1.75 per level at L1-10, about x1.55 at L10-20, and about
  x1.37 at L20-30. Time is about x1.7 at L5-10, then a steady **~x1.35 per level**.
- Different buildings favour different resources. Farmland and mines are iron-heavy. Drill Ground and
  Hospital are food-heavy at about 3:1. Training Base is 1:1.
- Barracks L20: 30M iron, 30M food, 12M coin, about 3.5 days. Drill Ground L30: about 28 days **[S]**.
- **Recreation advice [E]**: keep the curve shape but compress time 30-100x. Target: HQ 10 in about 1-2
  hours of play, HQ 15 by about day 2, and a soft cap after that.

### 2.5 Builders, speedups, help
- **Builder queues** **[S]**: 1 by default. A 2nd queue costs premium currency (about 500 diamonds, or
  rented for a limited time) or comes with VIP 6 / monthly pass. Guides call it the best early spend. Some
  sources mention up to 4 queues through special unlocks.
- **Free finish** **[S/E]**: constructions below a small remaining-time threshold finish free, and the
  Builder's Hut extends that threshold up to +30 min.
- **Speedup items** come in 1m / 5m / 1h etc. and apply to construction, research, training or healing
  **[S]**.
- **Alliance help** **[S]**: allies tap "help" to cut a timer by a small amount per help.
  Recreation **[E]**: a daily pool of "AI ally helps" that each cut 1% or 1 min.

### 2.6 Production and collection
- Food and iron production is roughly **linear in level**: about 1,150 × level per hour (L1 1,440/h,
  L10 11,520/h, L20 23,040/h, L30 33,840/h). Coins are about 720 × level per hour **[S]**.
- Each building **stores up to about 8-12 h** of output and then stops **[S]**. When there's something to
  collect, a **bubble/icon floats above the building**, and tapping it collects **[E, standard]**.
  One-tap collect-all is a VIP perk **[S]**.
- A separate **idle "loot truck"** parked by the gate gathers loot from zombies your guards kill, up to
  **8.5 h** (14.5 h with boosts) **[S]**.

### 2.7 Base expansion by clearing districts
- The base is surrounded by **zombie-occupied blocks (districts)**. You clear them one at a time by winning
  a stage battle, which **unlocks building space and specific features** **[S]**:
  - district about 7: tavern / recruitment
  - district about 38: drone system
  - districts 10 / 20 / 30 / 60 / 100: milestone rewards in the new-player challenge
  - district 102: 2nd research center
- Clearing blocks is the **#1 first-day priority** in guides **[S]**. It's the backbone of the first hour.

---

## 3. Heroes

### 3.1 Types and counter triangle [S]
- Three types: **Tank**, **Aircraft**, **Missile** (vehicle).
- Counters: **Tank > Missile > Aircraft > Tank**. Aircraft beats Tank.
- A counter gives **+20% damage dealt AND -20% damage taken** against the countered type. Guides call this
  about a 40-44% effective swing.

### 3.2 Roles [S]
- **Defense** heroes are front-row tanks with shields, taunts or damage reduction.
- **Attack** heroes are back-row DPS.
- **Support** heroes are back-row buffers, healers, debuffers, or farming specialists (bonus loot from
  zombies).

### 3.3 Rarity [S]
- **SR** (blue): common, early filler.
- **SSR** (purple): the mid backbone. Some can be promoted to UR later.
- **UR** (gold/orange): best.
- Rarity sets a hero's ceiling: max skill level is 30 for SR and SSR, and 40 for UR with an exclusive weapon.

### 3.4 Stats [S]
- **Attack**, **HP**, **Defense**, and **Command / March size**. March size is how many soldiers the hero
  brings, and it rises with hero level.
- Other stats: crit rate, crit damage, physical vs energy defense (from gear).

### 3.5 Leveling [S]
- Heroes level with Hero EXP. **Level cap = 5 × HQ level** (HQ 10 → 50, HQ 20 → 100, HQ 30 → 150).
- EXP per level (samples): L10 = 900, L25 = 3.2K, L50 = 310K, L100 = 33M, L150 = 185M. It's
  steep, which pushes you to focus on one squad.
- EXP sources: Training Base (hourly), PvE stages, world-map zombies, events.

### 3.6 Star-up (promotion) [S]
- Uses hero-specific shards. Universal and selection shards also exist.
- Cost per star: **1★ = 25, 2★ = 50, 3★ = 100, 4★ = 300, 5★ = 500** (total 975).
- Stars raise stats and unlock skill-level caps: 2★ → skill Lv5, 3★ → Lv10, 4★ → Lv20, 5★ → Lv30, plus an
  exclusive-weapon slot.
- Skills can only be upgraded from 2★ onward.
- SSR→UR promotion resets the hero to 3★, and the remaining stars then cost double.
- A **"10 shards unlocks the hero"** rule applies to selection chests. Recreation **[E]**: 10 shards to
  unlock a hero, then the star table above.

### 3.7 Skills [S]
- Three standard skills per hero:
  - **Auto-attack skill**: fires automatically at regular intervals.
  - **Tactic skill**: the strong active. It triggers automatically when charged, from energy or a cooldown.
  - **Passive**: always on.
- Skills are upgraded with **skill medals** in **5-level steps**. UR skills cost more per level.
- Some skills ignore front-row targeting and hit the back row, the lowest-HP target, or everyone.

### 3.8 Gear [S]
- **4 slots per hero**:
  - **Gun**: attack.
  - **Armor**: physical defense.
  - **Chip**: attack/HP and crit.
  - **Radar**: energy defense and crit resistance.
- Rarity green → blue → purple → gold, with higher tiers later. Crafted, upgraded and dismantled in the Gear
  Factory using ore and other materials.
- Priority: DPS heroes go Gun → Chip first. Tank heroes go Armor → Radar first.

### 3.9 Recruitment / gacha [S~]
- Tavern pools:
  - **standard hero pool** (premium tickets)
  - **survivor pool** (separate tickets)
  - **seasonal/returning pools**, plus **rate-up events** for one featured UR
- Free recruit on a cooldown of 2-3 days. Tickets come from daily tasks, events, and shops (for example,
  2,000 honor points per ticket).
- Pulls return **whole heroes or shards**. Base UR rates are low: a 10-pull "rarely" gives a UR. Some events
  have **milestone guarantees**. There's also a **200 tickets → 10 chosen-hero shards** exchange.
- Exact published rates and pity counts couldn't be verified. **Recreation [E]**: UR 2%, SSR 13%, SR 85%;
  UR pity at pull 50; SSR-or-better in every 10-pull; duplicates become shards (SR 10, SSR 30, UR 60).

### 3.10 Formation: 5 slots, 2 front / 3 back [S]
- **Front row (2)** takes hits first. Auto-attacks target the front row until it falls, and then the back
  row is exposed.
- **Back row (3)**: attackers and supports.
- The horizontal position (left/center/right) matters a little for some skills **[S~]**.
- **Same-type formation bonus** to HP, ATK and DEF:
  - 3 of a type: **+5%**
  - 3 of one type + 2 of another: **+10%**
  - 4 of a type: **+15%**
  - 5 of a type (mono squad): **+20%**
- In the live game this bonus unlocks mid-game. A recreation should have it from the start **[E]**.
- Guides push mono-type squads, starting with Tank early on. Tank heroes are the most available early.

### 3.11 Number of squads [S~]
- A player runs **up to 4 squads** (marches) at the same time. Each has its own squad building and hero
  set, and a hero can't be in two squads.
- Lineup presets start with 3 saved squads.
- Exact unlock HQ levels aren't confirmed. **Recreation [E]**: 1st at the start, 2nd at HQ 6, 3rd at
  HQ 12, 4th at HQ 18.

### 3.12 Power [S]
- "Power" is a single headline number shown everywhere: the top bar, squad screens, and enemy labels. It
  sums:
  - buildings (each level adds power, e.g. HQ L10 = 9,900)
  - research
  - heroes (level, stars, skills, gear)
  - soldiers (count × per-soldier power)
- Squad power = the power of its heroes plus the troops they carry. Guides treat power as the main
  progress signal, and enemies show a recommended power.
- Combat stat model from guides: `Total HP = hero HP + troops × HP per troop`. ATK and DEF work the same
  way.

---

## 4. Soldiers / troops

- Soldiers **have no type**. They're graded only by **tier (T1-T10, T11 late)**. The hero's type
  (tank/air/missile) sets the squad's counter class **[S]**.
- **Unlock by Barracks level** **[S]**: T1 at 1, T2 at 4, T3 at 6, T4 at 10, T5 at 14, T6 at 17, T7 at 20,
  T8 at 24, T9 at 27, T10 at 30 (plus research).
- **Per-soldier power** **[S~]**: T1 about 24, T5 about 409, T10 about 1,647 (about 69× T1).
- **Load (carry capacity)**: T1 about 400, T5 about 1,200, T10 about 2,200+ **[S]**.
- **Training** **[S]**:
  - The Barracks trains a batch at a time. Batch size is 30 at L1, 370 at L10, 470 at L20 and 570 at L30.
  - Training costs food and iron, and costs rise steeply with tier (T10 about 100× T1).
  - **Promotion**: existing soldiers can be upgraded to a higher tier for the difference in cost.
- **Drill Ground** capacity is the total soldiers you can house: 2,000 at L1, 4,000 at L10, 6,000 at L20,
  8,000 at L30 per Drill Ground (up to 4). Soldiers show as "in shelter" or "outside" (deployed) **[S]**.
- **How troops attach to heroes** **[S]**:
  - Each hero leads soldiers up to its **march size**, which grows with hero level, type-center level
    and VIP.
  - A squad's troops = the sum over its 5 heroes.
  - **Highest-tier soldiers are always sent first**, and lower tiers fill the rest.
  - Example: one march of 1,184 T5 soldiers.
- **Hospital / wounded** **[S]**:
  - After a fight, lost soldiers become **wounded** and go to hospitals, up to capacity (L1 650, L10 1,100,
    L20 1,600, L30 2,000).
  - **Anything beyond capacity dies**. A late building recovers part of that overflow.
  - Healing costs resources and time, and speedups apply.
  - Survivors return home.
- **Free troops**: the runner mode converts up to 60 surviving soldiers per level into real troops
  **[S]**.

---

## 5. Combat: campaign stages, auto-battle, idle rewards

### 5.1 Auto-battle rules (squad vs squad / squad vs zombies) [S unless marked]
- Combat is fully **automatic**. Everything is decided before you deploy (formation, heroes, troops).
- Both sides' heroes auto-attack at intervals. **Front row is targeted first.** Once both front-row
  heroes are down, the back row is exposed.
- Tactic skills fire when charged. Passives are always on.
- Damage pipeline: `ATK × skill% × type counter (±20%) × morale × gear/set bonuses × crit (base about
  150%) × (1 - enemy DEF reduction)`.
- **Morale**: +1% damage per point of morale advantage. Morale comes from troop tier.
- The side that eliminates all enemy heroes wins. A hero whose troops are gone is out.
- Visual presentation **[E]**:
  - The two formations face each other, as 2+3 vehicle/hero models or zombies coming down from the top.
  - Projectile effects, floating damage numbers and HP bars show the action.
  - A skill cast shows a brief hero-portrait banner.
  - x1/x2 speed and skip controls, then a result screen with stars/loot and a battle report.

### 5.2 Campaign / district stages
- **District clearing** (base expansion) is a linear stage list **[S]**. Waves of zombies, fast mutants and
  armed human raiders lead to a **boss wave** **[S]**. The early ones play as the lane shooter in 1.1
  **[S~]**.
- A separate **permanent PvE stage ladder** also exists **[S]**:
  - Sequential and non-replayable, with no stamina cost and no daily cap.
  - Each stage has several waves ending in a boss.
  - Result is win/lose with no star rating.
  - Drops: hero shards, food, iron, coins, hero EXP.
  - **A big milestone chest every 5 stages.**
  - Community players have cleared past 200 stages.
- **Idle rewards** **[S]**:
  - An AFK stage mode pays **hourly idle loot** based on your highest cleared stage.
  - The loot truck caps at about 8.5 h (14.5 h with boosts).
  - Resource buildings cap at 8-12 h.
- **Recreation [E]**: merge these into one campaign map. Idle loot (food/iron/EXP per hour) scales with the
  highest cleared stage and caps at 8-12 h. It's collected from a truck/crate icon on the base screen.

---

## 6. World map

- **Zombies by level** **[S]**:
  - Normal zombies (level 1 up to about 30+) sit on the map. A search button finds the nearest one of a
    chosen level.
  - Each attack costs **10 stamina**. Higher levels give more hero EXP and resources.
  - You generally have to beat level N before level N+1 unlocks **[E]**.
  - Resource-finder heroes add extra loot.
- **Elites and bosses** **[S]**:
  - Elite and boss zombies are rally targets and cost **20 stamina**.
  - Boss loot scales with level. Examples: a level-25 boss gives about 391K iron, 391K food, 502K coins
    and 1.1M EXP. A level-100 boss gives about 707K each of iron and food, 902K coins and 2.3M EXP.
  - Periodic invasion events spawn fixed-level zombies (level 10) that drop event medals.
- **Stamina** **[S]**:
  - Regenerates **1 per 5 minutes** (12/h, 288/day) while you're **below 120**. At 120 or more, regen stops.
  - You can stockpile above 120 through items.
  - Two free claims of +50 each per day (4-hour cooldown).
- **Marches** **[S]**: a squad marches out, fights, and marches back. Travel time depends on distance and
  the slowest unit, and squad building level adds march speed. Parallel marches are limited to the number
  of squads. **[E]**: 10-60 s to nearby targets early.
- **Gathering** **[S]**:
  - Send a squad to a food/iron/coin tile.
  - Yield per trip = troop load × soldier count, up to what the tile holds.
  - Gathering speed buffs exist, and gathering is faster than attacking.
- **Radar board** **[S]**:
  - Generates **about 10 missions every 6 hours** (at a mid radar level). A backlog is stored.
  - Mission types:
    - rescue a survivor (free, the survivor joins)
    - pick up a resource cache (free)
    - kill an elite (10-20 stamina)
    - dig a treasure (send a squad)
    - fight a rebel camp
    - assist an ally
    - a scripted fight chain
    - a roaming mega-boss
  - Radar level rises with missions completed.
  - Mission quality/stars scale rewards. Treasure digs can roll multipliers.
- **Single-player simulation** **[E]**:
  - A procedurally seeded map around the player base, with zombie camps of levels 1-N, resource tiles
    (levels 1-6) and radar pins.
  - 3-6 **AI rival bases** with scripted power growth curves. They occasionally scout or raid the player
    (the Wall/hospital matter), and the player can raid them for plunder.
  - An **AI alliance** gives build "helps" and joint boss rallies.
  - Periodic "invasion" weekends and a roaming boss.

---

## 7. UI/UX and visual style

Most of this section is from screenshots and descriptions, so treat the layout as **[E]** unless marked.
- **Orientation**: portrait only **[S]**.
- **Top-left**: commander avatar, player level, and a **headline Power number** **[S]**, with a VIP badge
  nearby.
- **Top bar**: resource counters for **Food, Iron, Coins, Diamonds** (with "+" shop buttons), plus
  stamina **[S]**.
- **Right edge**: a vertical stack of event/offer icons (events hub, daily race, new-player challenge,
  shop/packs, pass). Each has a red notification dot and a countdown label.
- **Left edge, mid-screen**: the **chapter/main quest tracker**, a banner with the current objective (e.g.
  "Upgrade Barracks to Lv 5"), a progress count, a reward icon and a "Go" button that jumps the camera to
  the building. The bottom-left task icon **glows green when a task is claimable** **[S]**.
- **Above the bottom bar**: a one-line chat ticker.
- **Bottom bar**: the Tasks icon (left), then Heroes, Bag/Items, Alliance and Mail (a "crown" icon opens
  heroes, a "shield" icon opens alliance **[S]**). **Bottom-right: a large World/Base toggle button**
  (map icon **[S]**).
- The base screen also shows vehicle icons parked by the gate, used as entry points for the stage modes
  (runner mode, idle truck) **[S]**.
- **Buildings**:
  - Tapping a building shows a radial or row of action buttons (Upgrade, Details, Train, Speed up).
  - Timers and progress bars float over buildings that are working.
  - Collectable bubbles float over producers.
  - An upgrade arrow marks buildings you can upgrade.
- **Upgrade panel**: requirement list with green checks or red "Go to" links, a cost row, and two buttons,
  "Upgrade" (timed) and "Instant" (diamonds).
- **Visual style**:
  - Bright, clean, slightly stylized 3D in a mobile "semi-realistic low-poly" look.
  - Sunny daylight and green/khaki terrain with concrete, fences and sandbags.
  - Military vehicles, with heroes shown as character portraits riding or commanding vehicles.
  - Zombies in desaturated greens and greys. Districts that aren't cleared yet are shown as ruined,
    fogged or darker blocks with zombies milling about.
  - UI in chunky rounded panels: blue/teal primary buttons, yellow/orange for premium and claim, red for
    alerts. Bold numbers everywhere.
  - Rarity colors: blue (SR), purple (SSR), gold (UR).
- **Runner visuals**:
  - A straight road with a blue sky or ruins on both sides.
  - Soldiers in a tight blob with a white count label.
  - Blue/red translucent gate panels with huge numbers.
  - Oil-drum barrels with an HP number and a reward icon.
  - A boss with an HP bar at the top of the screen.

---

## 8. Pacing of the first ~hour (reconstructed)

Sources confirm the building blocks. The exact order below is a best reconstruction **[S~/E]**.
1. **0-3 min**: an action intro with a lane-shooter level. Auto-fire, drag to dodge, barrels that add
   units/weapons, and a boss. It ends by arriving at a ruined camp.
2. **3-10 min**: guided building.
   - Build the drill ground, then the 1st squad building (both needed for HQ 2).
   - Build 2 farmlands, then an iron mine.
   - Upgrade HQ to 2 and 3. Early upgrades take seconds.
   - Collect production bubbles.
3. **10-20 min**:
   - Train the first soldiers in the barracks.
   - Assign starting heroes (all Tank-type early) to the 5-slot squad.
   - Clear the first zombie districts next to the base (stage battles). Each clear reveals land.
4. **20-35 min**:
   - About the 7th district unlocks the **tavern**, with a free/guaranteed early recruit.
   - The chapter quests cover wall → barracks → HQ 4-5 → hospital → recon plane / radar.
   - Radar missions start: rescue a survivor, a free resource pickup, the first world-map zombie fights
     (10 stamina).
5. **35-60 min**:
   - HQ 5-7 unlocks the alliance center and **Tank Center (HQ 6)**, then the **Tech Center (HQ 7)**.
   - Timers start reaching minutes to hours, so speedups and the "free finish" window matter.
   - Push further districts. About 30-38 districts unlocks the drone system and more heroes.
   - Hero leveling starts to hit the HQ×5 cap.
6. **Day 1-5 new-player challenge**: daily login, radar tasks, clearing districts 10/20/30/60/100, HQ
   level targets (up to 17), recruits, training N soldiers, hero levels, research, a power target. There
   are **daily tasks worth 200 points across 5 chests** **[S]**.
- **Chapter quests** **[S]**: short guided task chains grouped into chapters. Each task pays resources,
  speedups or units, and each chapter ends with a bigger chest. After the chapters, an open-ended
  **main task** list takes over.

---

## 9. Recommended scope for a single-player recreation (priority order)

1. **The runner/shooter level** (section 1): drag-to-move squad, auto-fire, floating count label,
   +/-/x/÷ gates, **shoot-to-raise gate values** (red → blue), barrels with HP that grant soldiers,
   weapons or helpers, zombie waves with fast "dogs", and an end boss. This is the hook players expect from
   the ads. Make it good on its own.
2. **HQ-gated base loop**: HQ caps all levels. Each HQ level needs 2 specific buildings at N-1, with the
   Tech Center from HQ 8. Upgrades are timed, and costs grow by about x1.35-1.75 per level. Add 1-2
   builder queues, speedups and a free-finish window. This is the "one more upgrade" engine.
3. **Resource production with offline accumulation**: food, iron and coins. Collect-bubbles on buildings,
   an 8-12 h storage cap, and an idle loot truck tied to campaign progress.
4. **District-clearing campaign**: a ring of zombie blocks around the base, each cleared by a stage
   (alternating runner levels and auto-battles). Clears unlock land, buildings and features.
5. **5-hero squad with Tank/Aircraft/Missile**: counter triangle (+20% dealt, -20% taken), 2-front/3-back
   rows with front row targeted first, same-type bonus (+5/10/15/20%), and one headline **Power** number.
6. **Hero progression**: level cap = 5×HQ, EXP from the Training Base, stars from shards
   (25/50/100/300/500), 3 skills (auto, tactic, passive) upgraded with medals, 4 gear slots, and SR/SSR/UR
   rarity colors.
7. **Soldiers**: tiers by barracks level (T1-T10), drill-ground capacity, march size per hero, and
   highest-tier-first deployment. The hospital turns losses into wounded, and overflow dies. The runner
   pays out real troops.
8. **Recruitment**: tavern with tickets, a free timed pull, a 10-pull, shards for duplicates, and
   pity. Early scripted pulls guarantee a usable Tank squad.
9. **Quest and retention layer**: a chapter quest tracker (left side, with a "Go" button), daily tasks
   (points → 5 chests), and a 5-day new-player challenge.
10. **World map (lite)**: zombies by level (10 stamina, 120 cap, +1 per 5 min), resource tiles, a radar
    board refreshing every 6 h (rescue, pickups, elites, treasure), and march travel timers.
11. **AI rivals and an AI alliance**: simulated power growth, occasional raids that test the Wall and
    hospital, ally "helps", and joint boss fights.
12. **Nice-to-have**: survivors assigned to buildings, research tree (economy/development/combat), drone,
    the math-gate race as a daily minigame, and a weekly fixed-loadout runner challenge.

Skip for now: oil and season content, PvP alliances, exclusive weapons, capitol and territory wars,
monetization.

---

## Sources (consulted for fact-checking; all content above is paraphrased)
- lastwar.wiki (building pages), lastwartutorial.com, lastwarvault.com, lastwarhandbook.com,
  cpt-hedge.com, theriagames.com, heaven-guardian.com, lastwar-tutorial.com, lastwargame.online,
  BlueStacks and Google Play editorial guides, fakeadgames.com, Wikipedia, ruthlessreviews.com,
  buffbuff.com, ldshop.gg, medievalfun.com, techwiser.com
