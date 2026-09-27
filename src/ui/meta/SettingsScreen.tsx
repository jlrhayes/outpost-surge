// OWNER: meta agent. 'settings' screen: commander profile, audio, graphics quality, reset, credits, dev tools.
import { useState } from 'preact/hooks';
import { game, mutate, resetGame, useGame } from '../../core/store';
import { debugSkip, now, runTickers } from '../../core/tick';
import { grantIn } from '../../core/economy';
import { toast } from '../../core/nav';
import { engine } from '../../three/engine';
import { Btn, Screen, SectionTitle, Toggle } from '../components/common';
import { Icon } from '../components/Icon';
import { Avatar, AVATAR_LOOKS } from '../components/Avatar';
import { confirmDialog } from '../components/ConfirmModal';
import { sfx } from '../../core/audio';
import { buildingName } from '../../data/buildings';

/** Quality the renderer was created with: anti-aliasing can only change when the WebGL context is recreated. */
const bootQuality = game.settings.quality;

function Row(props: { icon: string; label: string; children: preact.ComponentChildren; sub?: string }) {
  return (
    <div class="set-row">
      <Icon name={props.icon} size={26} />
      <div class="set-row-label">
        <div>{props.label}</div>
        {props.sub && <div class="dim-text small">{props.sub}</div>}
      </div>
      <div class="set-row-ctrl">{props.children}</div>
    </div>
  );
}

function skip(ms: number, label: string) {
  debugSkip(ms);
  runTickers();
  toast(`Skipped ${label}`, 'info');
}

export function SettingsScreen() {
  const s = useGame();
  const [name, setName] = useState(s.player.name);

  return (
    <Screen title="Settings" icon="gear" class="settings-screen">
      <SectionTitle>Commander</SectionTitle>
      <div class="card set-card">
        <div class="avatar-pick">
          {AVATAR_LOOKS.map((_, i) => (
            <button
              key={i}
              class={'avatar-opt ' + (s.player.avatar === i ? 'selected' : '')}
              onClick={() => {
                sfx.click();
                mutate((st) => (st.player.avatar = i));
              }}
            >
              <Avatar index={i} size={44} />
            </button>
          ))}
        </div>
        <div class="name-edit">
          <input
            class="text-input"
            value={name}
            maxLength={16}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="Commander name"
          />
          <Btn
            small
            color="blue"
            disabled={!name.trim() || name.trim() === s.player.name}
            onClick={() => {
              mutate((st) => (st.player.name = name.trim().slice(0, 16)));
              toast('Name updated', 'good');
            }}
          >
            Save
          </Btn>
        </div>
      </div>

      <SectionTitle>Audio</SectionTitle>
      <div class="card set-card">
        <Row icon="sound" label="Sound effects">
          <Toggle value={s.settings.sfx} onChange={(v) => mutate((st) => (st.settings.sfx = v))} />
        </Row>
      </div>

      <SectionTitle>Graphics</SectionTitle>
      <div class="card set-card">
        <Row
          icon="quality"
          label="Quality"
          sub={
            (s.settings.quality === 'high' ? 'Shadows & full resolution' : 'Faster, saves battery') +
            (s.settings.quality !== bootQuality ? ' · anti-aliasing changes after a restart' : '')
          }
        >
          <div class="seg">
            {(['low', 'high'] as const).map((q) => (
              <button
                key={q}
                class={'seg-btn ' + (s.settings.quality === q ? 'active' : '')}
                onClick={() => {
                  sfx.click();
                  mutate((st) => (st.settings.quality = q));
                  try {
                    engine.applyPixelRatio();
                  } catch {
                    /* engine not ready */
                  }
                }}
              >
                {q === 'low' ? 'Low' : 'High'}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <SectionTitle>Game</SectionTitle>
      <div class="card set-card">
        <Row icon="cross" label="Reset progress" sub="Deletes your save and starts over">
          <Btn
            small
            color="red"
            onClick={() =>
              confirmDialog({
                title: 'Reset Progress?',
                icon: 'cross',
                text: 'Your base, heroes, troops and items will be wiped. This cannot be undone.',
                confirmLabel: 'Reset',
                color: 'red',
                onConfirm: () => resetGame(),
              })
            }
          >
            Reset
          </Btn>
        </Row>
      </div>

      {/* Dev tools only exist in development builds (they bypass progression). */}
      {import.meta.env.DEV && (
        <>
        <SectionTitle>Dev Tools</SectionTitle>
        <div class="card set-card dev-tools">
          <div class="dev-label">
            <Icon name="clock" size={18} /> Skip time
          </div>
          <div class="dev-grid">
            <Btn small color="blue" onClick={() => skip(60_000, '1 minute')}>
              +1m
            </Btn>
            <Btn small color="blue" onClick={() => skip(600_000, '10 minutes')}>
              +10m
            </Btn>
            <Btn small color="blue" onClick={() => skip(3_600_000, '1 hour')}>
              +1h
            </Btn>
            <Btn
              small
              color="blue"
              onClick={() => {
                const t = now();
                mutate((st) => {
                  for (const j of st.meta.training) j.endsAt = Math.min(j.endsAt, t);
                  if (st.meta.researchJob) st.meta.researchJob.endsAt = Math.min(st.meta.researchJob.endsAt, t);
                  if (st.meta.healing) st.meta.healing.endsAt = Math.min(st.meta.healing.endsAt, t);
                  for (const b of st.base.buildings) if (b.upgradeEndsAt) b.upgradeEndsAt = Math.min(b.upgradeEndsAt, t);
                });
                runTickers();
                toast('All timers finished', 'info');
              }}
            >
              Finish all
            </Btn>
          </div>
          <div class="dev-label">
            <Icon name="gift" size={18} /> Grant
          </div>
          <div class="dev-grid">
            <Btn
              small
              color="green"
              onClick={() => {
                mutate((st) => grantIn(st, { currencies: { food: 100_000, iron: 100_000, gold: 50_000, heroExp: 50_000 } }));
                toast('Resources added', 'good');
              }}
            >
              Resources
            </Btn>
            <Btn
              small
              color="purple"
              onClick={() => {
                mutate((st) => grantIn(st, { currencies: { diamonds: 5000 } }));
                toast('+5,000 Diamonds', 'good');
              }}
            >
              Diamonds
            </Btn>
            <Btn
              small
              color="green"
              onClick={() => {
                mutate((st) =>
                  grantIn(st, {
                    items: { speedup_1m: 20, speedup_5m: 20, speedup_1h: 5, speedup_8h: 2, recruit_ticket: 10, food_box: 5, iron_box: 5, gold_box: 3, exp_box: 5, stamina_potion: 5, skill_medal: 20 },
                  }),
                );
                toast('Items added', 'good');
              }}
            >
              Items
            </Btn>
            <Btn
              small
              color="green"
              onClick={() => {
                mutate((st) => grantIn(st, { troops: { 1: 500 } }));
                toast('+500 soldiers', 'good');
              }}
            >
              Troops
            </Btn>
          </div>
          <div class="dev-label">
            <Icon name="lock" size={18} /> Progress
          </div>
          <div class="dev-grid">
            <Btn
              small
              color="yellow"
              onClick={() =>
                confirmDialog({
                  title: 'Unlock everything?',
                  text: `Raises ${buildingName('hq')} to Lv 20 and clears the first districts so every feature unlocks. Dev only.`,
                  confirmLabel: 'Unlock',
                  color: 'yellow',
                  onConfirm: () => {
                    mutate((st) => {
                      const hq = st.base.buildings.find((b) => b.type === 'hq');
                      if (hq && hq.level < 20) hq.level = 20;
                      if (st.heroes.campaign.stage < 4) st.heroes.campaign.stage = 4;
                      st.runner.introDone = true;
                    });
                    toast('All features unlocked', 'good');
                  },
                })
              }
            >
              Unlock all
            </Btn>
            <Btn
              small
              color="gray"
              onClick={() => {
                mutate((st) => (st.meta.daily.date = ''));
                runTickers();
                toast('Daily tasks reset', 'info');
              }}
            >
              Reset daily
            </Btn>
          </div>
        </div>
        </>
      )}

      <SectionTitle>Credits</SectionTitle>
      <div class="card set-card credits">
        <div class="credits-logo">OUTPOST SURGE</div>
        <div>An original squad-runner & base-building survival game.</div>
        <div class="dim-text small">
          Built with Three.js, Preact and Vite. All models are procedural, all icons hand-made inline SVG, all sounds synthesized in
          real time. No external assets.
        </div>
        <div class="dim-text small">v0.1 · Save: {Math.round(JSON.stringify(game).length / 1024)} KB</div>
      </div>
    </Screen>
  );
}
