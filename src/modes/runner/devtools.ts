// OWNER: runner agent. DEV-ONLY helpers for tuning the runner (never imported in production builds).
//   __runnerDev.step(sec)            advance the active run by `sec` seconds at 60 fps and render
//   await __runnerDev.play(level, skill)   auto-play a whole level with a simple bot, returns a summary
//   await __runnerDev.sweep([1,2,3])       play several levels
import { engine } from '../../three/engine';
import { goTo } from '../../core/nav';
import type { RunnerMode } from './RunnerMode';

let t = 0;

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
  };
}

/** skill 1 = picks the best gate early and keeps it in its fire lane; 0 = drifts late, ignores crates. */
function drive(r: any, skill: number) {
  const sq = r.squad;
  const val = (g: any) =>
    g.kind === 'add' ? sq.count + g.value : g.kind === 'mul' ? (g.value > 0 ? sq.count * g.value : sq.count / -g.value) : sq.count * (1 + (g.value / 100) * 0.4);
  const gates = r.gates.filter((g: any) => g.active && g.fading === 0 && g.d > sq.d - 0.5).sort((a: any, b: any) => a.d - b.d);
  let tx: number | null = null;
  if (gates.length && gates[0].d - sq.d < 40) {
    const d0 = gates[0].d;
    const pair = gates.filter((g: any) => Math.abs(g.d - d0) < 0.1).sort((a: any, b: any) => val(b) - val(a));
    tx = pair[0].side * 2;
    if (skill < 1 && gates[0].d - sq.d > 10) tx = r.targetX;
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
  r.targetX = Math.max(-3.45, Math.min(3.45, tx as number));
}

async function play(level: number, skill = 1) {
  goTo('runner', { level });
  await new Promise((res) => setTimeout(res, 20));
  const r = mode();
  let time = 0;
  let bossAt = -1;
  let minCount = 1e9;
  while (time < 240 && r.phase !== 'won' && r.phase !== 'lost') {
    time += 1 / 60;
    t += 1 / 60;
    drive(r, skill);
    r.update(1 / 60, t);
    if (r.phase === 'boss' && bossAt < 0) bossAt = time;
    if (r.squad.count < minCount) minCount = r.squad.count;
  }
  return `L${level} s${skill} ${r.phase} t=${Math.round(time)} boss@${Math.round(bossAt)} end ${r.squad.count}/${r.peak} exp ${r.def.expected} bossHp ${r.def.boss.hp} kills ${r.kills}`;
}

async function sweep(levels: number[], skill = 1) {
  const out: string[] = [];
  for (const l of levels) out.push(await play(l, skill));
  return out.join('\n');
}

(window as any).__runnerDev = { step, play, sweep, snapshot: () => snapshot(mode()) };
