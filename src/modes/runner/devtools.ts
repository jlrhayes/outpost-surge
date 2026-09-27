// OWNER: runner agent. DEV-ONLY helpers for tuning the runner (never imported in production builds).
//   __runnerDev.step(sec)                    advance the active run by `sec` seconds at 60 fps and render
//   await __runnerDev.play(level, skill)     auto-play a whole level with a bot, returns a summary line
//   await __runnerDev.sweep([1,2,3], skill)  play several levels
//   await __runnerDev.table(levels, skills)  win/stars/retention table for several bot policies
// Bot policies: 1 = skilled (best gate early, shoots crates, dodges acid and hazards),
//               0 = lazy (only reacts to gates at the last moment, ignores everything else),
//              -1 = passive (never steers).
import { engine } from '../../three/engine';
import { goTo } from '../../core/nav';
import { SIM } from '../../data/runner';
import type { RunnerMode } from './RunnerMode';
import { starsFor } from './progress';

let t = 0;
/** Actual/expected squad count and DPS at each gate of the last bot run. */
let lastCalib: { ratios: number[]; dpsRatios: number[] } = { ratios: [], dpsRatios: [] };

function mode(): any {
  return (window as any).__runner as RunnerMode;
}

function step(sec: number, bot?: number) {
  const r = mode();
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    t += 1 / 60;
    if (bot !== undefined) drive(r, bot);
    r.update(1 / 60, t);
  }
  engine.renderer.render(r.scene, r.camera);
  return snapshot(r);
}

/** One 60 fps sim frame with an optional bot, no rendering (for fast custom probes). */
function tick(bot?: number) {
  const r = mode();
  t += 1 / 60;
  if (bot !== undefined) drive(r, bot);
  r.update(1 / 60, t);
}

function snapshot(r: any) {
  return {
    d: +r.squad.d.toFixed(1),
    x: +r.squad.x.toFixed(2),
    count: r.squad.count,
    peak: r.peak,
    kills: r.kills,
    phase: r.phase,
    zombies: r.horde.list.length,
    bullets: r.bullets.n,
    calls: engine.renderer.info.render.calls,
    tris: engine.renderer.info.render.triangles,
    programs: engine.renderer.info.programs?.length ?? -1,
  };
}

const LIM = 3.45;
const clampX = (x: number) => Math.max(-LIM, Math.min(LIM, x));

/** Lane that keeps the squad blob clear of [x0, x1] (closest one, or the roomier side). */
function clearOf(x0: number, x1: number, radius: number, cur: number): number {
  const left = clampX(x0 - radius - 0.3);
  const right = clampX(x1 + radius + 0.3);
  const leftOk = left + radius <= x0 + 0.05;
  const rightOk = right - radius >= x1 - 0.05;
  if (leftOk && rightOk) return Math.abs(left - cur) < Math.abs(right - cur) ? left : right;
  if (leftOk) return left;
  if (rightOk) return right;
  return x0 + LIM > LIM - x1 ? left : right;
}

function drive(r: any, skill: number) {
  if (skill < 0) return; // passive: never steers
  const sq = r.squad;
  const val = (g: any) =>
    g.kind === 'add'
      ? sq.count + g.value
      : g.kind === 'mul'
        ? g.value > 0
          ? sq.count * g.value
          : sq.count / -g.value
        : g.kind === 'gun'
          ? sq.count * 1.25
          : sq.count * (1 + (g.value / 100) * 0.4);
  let tx: number | null = null;
  let nextGate = Infinity;
  for (const g of r.gates) if (g.active && g.fading === 0 && g.d > sq.d - 0.5 && g.d < nextGate) nextGate = g.d;
  // A gate that's about to be crossed always wins (never dodge acid into a trap gate).
  if (skill >= 1 && nextGate - sq.d > 12) {
    // 1) Hazards coming up (before the next gate): be clear of the danger zone when we cross it.
    for (const h of r.hazards) {
      if (!h.active || h.passed || h.d > nextGate) continue;
      const ahead = h.d - sq.d;
      if (ahead < 0 || ahead > 18) continue;
      let x0 = h.x0;
      let x1 = h.x1;
      if (h.kind === 'wire') {
        const tc = ahead / Math.max(1, r.speedNow);
        const xc = h.cx + h.amp * Math.sin(((r.simT + tc) / h.period) * Math.PI * 2 + h.phase);
        x0 = xc - h.half;
        x1 = xc + h.half;
      }
      tx = clearOf(x0, x1, sq.radius, sq.x);
    }
    // 2) Acid in the air aimed at us: sidestep out of the landing circle.
    if (tx === null) {
      const a = r.acid;
      for (let i = 0; i < a.n; i++) {
        if (Math.abs(a.x1[i] - sq.x) < SIM.spitSplash + sq.radius * 0.7) tx = clearOf(a.x1[i] - SIM.spitSplash, a.x1[i] + SIM.spitSplash, sq.radius * 0.6, sq.x);
      }
    }
    // 3) Don't walk into an explosive drum.
    if (tx === null) {
      for (const b of r.barrels) {
        if (!b.active || b.reward !== 'explosive') continue;
        const ahead = b.d - sq.d;
        if (ahead > 0 && ahead < 12 && Math.abs(b.x - sq.x) < sq.radius + b.radius) tx = clearOf(b.x - b.radius, b.x + b.radius, sq.radius, sq.x);
      }
    }
  }
  if (tx === null) {
    const gates = r.gates.filter((g: any) => g.active && g.fading === 0 && g.d > sq.d - 0.5).sort((a: any, b: any) => a.d - b.d);
    if (gates.length && gates[0].d - sq.d < 40) {
      const d0 = gates[0].d;
      const pair = gates.filter((g: any) => Math.abs(g.d - d0) < 0.1).sort((a: any, b: any) => val(b) - val(a));
      tx = pair[0].side * 2;
      if (skill < 1 && gates[0].d - sq.d > 10) tx = r.targetX;
    }
  }
  if (tx === null) {
    const bs = r.barrels
      .filter((b: any) => b.active && b.d > sq.d + 3 && b.d - sq.d < 30 && b.reward !== 'explosive')
      .sort((a: any, b: any) => a.d - b.d);
    if (bs.length && skill >= 1) tx = bs[0].x;
    else {
      const zs = r.horde.list.filter((z: any) => z.d - sq.d < 30);
      tx = zs.length ? zs.reduce((s: number, z: any) => s + z.x, 0) / zs.length : r.boss ? r.boss.x : 0;
      if (skill < 1) tx = r.targetX;
    }
  }
  r.targetX = clampX(tx as number);
}

interface PlayResult {
  level: number;
  skill: number;
  won: boolean;
  time: number;
  end: number;
  peak: number;
  retention: number;
  stars: number;
  expected: number;
  atBoss: number;
  bossHp: number;
  kills: number;
  maxZombies: number;
  loss: Record<string, number>;
}

async function run(level: number, skill = 1, intro = false): Promise<PlayResult> {
  goTo('runner', { level, intro });
  // goTo switches modes synchronously (route effect); a microtask is enough, and unlike setTimeout it
  // isn't throttled while the browser pane is hidden.
  await Promise.resolve();
  const r = mode();
  let time = 0;
  let atBoss = -1;
  let maxZ = 0;
  const tr = r.def.trace as { d: number; count: number; dps: number }[];
  let k = 0;
  const ratios: number[] = [];
  const dpsRatios: number[] = [];
  while (time < 240 && r.phase !== 'won' && r.phase !== 'lost') {
    time += 1 / 60;
    t += 1 / 60;
    drive(r, skill);
    r.update(1 / 60, t);
    if (r.phase === 'boss' && atBoss < 0) atBoss = r.squad.count;
    if (r.horde.list.length > maxZ) maxZ = r.horde.list.length;
    if (k < tr.length && r.squad.d > tr[k].d + 0.5) {
      ratios.push(+(r.squad.count / tr[k].count).toFixed(2));
      dpsRatios.push(+(r.dps() / tr[k].dps).toFixed(2));
      k++;
    }
  }
  lastCalib = { ratios, dpsRatios };
  const won = r.phase === 'won';
  const end = won ? r.squad.count : 0;
  return {
    level,
    skill,
    won,
    time: Math.round(time),
    end,
    peak: r.peak,
    retention: r.peak ? +(end / r.peak).toFixed(2) : 0,
    stars: won ? starsFor(end, r.peak) : 0,
    expected: r.def.expected,
    atBoss,
    bossHp: r.def.boss.hp,
    kills: r.kills,
    maxZombies: maxZ,
    loss: { ...r.lossBy },
  };
}

async function play(level: number, skill = 1) {
  const p = await run(level, skill);
  return `L${level} s${skill} ${p.won ? 'won' : 'lost'} t=${p.time} end ${p.end}/${p.peak} (${Math.round(p.retention * 100)}%) ${p.stars}* atBoss ${p.atBoss} exp ${p.expected} bossHp ${p.bossHp} kills ${p.kills} maxZ ${p.maxZombies} loss ${JSON.stringify(p.loss)}`;
}

async function sweep(levels: number[], skill = 1) {
  const out: string[] = [];
  for (const l of levels) out.push(await play(l, skill));
  return out.join('\n');
}

/** Compact sweep: "level:W|L retention%/stars" per level. */
async function compact(skill: number, levels: number[]) {
  const out: string[] = [];
  for (const l of levels) {
    const p = await run(l, skill);
    out.push(`${l}:${p.won ? 'W' : 'L'}${Math.round(p.retention * 100)}/${p.stars}`);
  }
  return out.join(' ');
}

/** Several runs per level: "level:wins/reps avgRetention% avgStars". */
async function stats(skill: number, levels: number[], reps = 3) {
  const out: string[] = [];
  for (const l of levels) {
    let w = 0;
    let ret = 0;
    let st = 0;
    for (let i = 0; i < reps; i++) {
      const p = await run(l, skill);
      if (p.won) w++;
      ret += p.retention;
      st += p.stars;
    }
    out.push(`${l}:${w}/${reps} ${Math.round((ret / reps) * 100)}% ${(st / reps).toFixed(1)}*`);
  }
  return out.join(' | ');
}

/** Plays every level `reps` times per policy; returns raw rows (for tables). */
async function table(levels: number[], skills = [1, 0, -1], reps = 1) {
  const rows: PlayResult[] = [];
  for (const l of levels) for (const s of skills) for (let i = 0; i < reps; i++) rows.push(await run(l, s));
  return rows;
}

(window as any).__runnerDev = { step, tick, play, sweep, compact, stats, table, run, calib: () => lastCalib, snapshot: () => snapshot(mode()) };
