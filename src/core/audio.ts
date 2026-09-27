// Procedural sound effects via WebAudio (no audio assets). Call sfx.x() from anywhere.
import { game } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!game.settings.sfx) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  // iOS reports 'interrupted' after calls/backgrounding; resume from any non-running state.
  if (ctx.state !== 'running' && !suspendedByApp) void ctx.resume().catch(() => {});
  return ctx;
}

let suspendedByApp = false;

/** Call from a user gesture (tap/click) so mobile browsers allow audio. Returns true once audio is running. */
export function unlockAudio(): boolean {
  const c = ac();
  return !!c && c.state === 'running';
}

/** Pause all sound while the app is in the background. */
export function suspendAudio(): void {
  suspendedByApp = true;
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
}

export function resumeAudio(): void {
  suspendedByApp = false;
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.5, slideTo?: number, delay = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.5, filterFreq = 1200, delay = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

let lastShot = 0;
export const sfx = {
  click: () => tone(660, 0.06, 'square', 0.15),
  shoot: () => {
    // rate-limit so a big squad doesn't clip
    const t = performance.now();
    if (t - lastShot < 70) return;
    lastShot = t;
    noise(0.05, 0.12, 3000);
  },
  hit: () => noise(0.06, 0.15, 800),
  explode: () => {
    noise(0.45, 0.5, 500);
    tone(90, 0.4, 'sine', 0.4, 40);
  },
  gateGood: () => {
    tone(520, 0.08, 'triangle', 0.3);
    tone(780, 0.12, 'triangle', 0.3, undefined, 0.07);
  },
  gateBad: () => tone(300, 0.25, 'sawtooth', 0.2, 120),
  upgrade: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.25, undefined, i * 0.07));
  },
  reward: () => {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.1, 'sine', 0.25, undefined, i * 0.06));
  },
  error: () => tone(180, 0.18, 'square', 0.15),
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.3, undefined, i * 0.1));
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.15, undefined, i * 0.15));
  },
  recruit: () => {
    tone(200, 0.6, 'sawtooth', 0.15, 1200);
    tone(1200, 0.3, 'triangle', 0.25, undefined, 0.55);
  },
};
