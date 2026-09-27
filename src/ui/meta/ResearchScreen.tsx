// OWNER: meta agent. 'research' screen: 3-branch tech tree, node details, timed research + speed-up.
import { useState } from 'preact/hooks';
import { game, mutate, useGame } from '../../core/store';
import { canAfford, spendIn } from '../../core/economy';
import { emit } from '../../core/events';
import { fmtDuration } from '../../core/format';
import { focusBuilding, toast } from '../../core/nav';
import { getBonus } from '../../core/bonuses';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { sfx } from '../../core/audio';
import { buildingLevel } from '../../systems/buildings';
import { BRANCHES, TECH_BY_ID, bonusLines, scaleBonus, techsOf, type ResearchBranch, type TechDef } from '../../data/research';
import { checkTech, researchCost, researchDurationMs, startResearch, techCenterLevelFor, techLevel } from '../../systems/research';
import { instantFinishCost } from '../../systems/items';
import { Btn, CostView, Modal, Screen, Tabs } from '../components/common';
import { Icon } from '../components/Icon';
import { TimerBar } from '../components/TimerBar';
import { openResearchSpeedup } from './timers';

const ROW_H = 132;

export function ResearchScreen() {
  const s = useGame();
  const [branch, setBranch] = useState<ResearchBranch>('economy');
  const [sel, setSel] = useState<string | null>(null);
  const tc = buildingLevel(s, 'tech');

  if (!isUnlocked(s, 'research') || tc < 1) {
    return (
      <Screen title="Research" icon="flask">
        <div class="empty-state">
          <Icon name={isUnlocked(s, 'research') ? 'flask' : 'lock'} size={72} />
          <div>{isUnlocked(s, 'research') ? 'Build a Tech Center to start researching.' : unlockHint('research')}</div>
          {isUnlocked(s, 'research') && (
            <Btn color="blue" onClick={() => focusBuilding({ type: 'tech', openPanel: true })}>
              Go
            </Btn>
          )}
        </div>
      </Screen>
    );
  }

  const job = s.meta.researchJob;
  const techs = techsOf(branch);
  const rows = Math.max(...techs.map((t) => t.row)) + 1;
  const pos = (d: TechDef) => ({ x: (d.col * 2 + 1) / 6, y: d.row * ROW_H + 56 });

  return (
    <Screen title="Research" icon="flask" class="research-screen">
      <div class="research-top">
        <span>
          <Icon name="flask" size={18} /> Tech Center <b>Lv {tc}</b>
        </span>
        <span class="dim-text">Speed +{Math.round(getBonus(s, 'research_speed_pct'))}%</span>
      </div>
      {job ? (
        <TimerBar
          icon={TECH_BY_ID[job.techId]?.icon ?? 'flask'}
          label={`${TECH_BY_ID[job.techId]?.name ?? job.techId} → Lv ${techLevel(s, job.techId) + 1}`}
          startedAt={job.startedAt}
          endsAt={job.endsAt}
          onSpeedup={openResearchSpeedup}
        />
      ) : (
        <div class="research-idle">No research in progress — pick a technology below.</div>
      )}
      <Tabs
        tabs={BRANCHES.map((b) => ({
          id: b.id,
          label: b.label,
          icon: b.icon,
          badge: !job && techsOf(b.id).some((d) => checkTech(s, d).status === 'available' && canAfford(s, researchCost(s, d))),
        }))}
        value={branch}
        onChange={setBranch}
      />
      <div class="research-blurb dim-text">{BRANCHES.find((b) => b.id === branch)?.blurb}</div>
      <div class="tech-tree" style={{ height: rows * ROW_H + 'px' }}>
        <svg class="tech-links" viewBox={`0 0 100 ${rows * ROW_H}`} preserveAspectRatio="none">
          {techs.flatMap((d) =>
            d.requires.map((r) => {
              const from = TECH_BY_ID[r.id];
              if (!from || from.branch !== branch) return null;
              const a = pos(from);
              const b = pos(d);
              const met = techLevel(s, r.id) >= r.level;
              // from just under the source node's level bar to the top of the target icon
              const y1 = a.y + 62;
              const y2 = b.y - 38;
              return (
                <path
                  key={r.id + d.id}
                  d={`M${a.x * 100} ${y1} C${a.x * 100} ${(y1 + y2) / 2} ${b.x * 100} ${(y1 + y2) / 2} ${b.x * 100} ${y2}`}
                  class={'tech-link ' + (met ? 'met' : '')}
                  vector-effect="non-scaling-stroke"
                  fill="none"
                />
              );
            }),
          )}
        </svg>
        {Array.from({ length: rows }, (_, r) => (
          <div class="tech-row-label" key={'r' + r} style={{ top: r * ROW_H + 4 + 'px' }}>
            Tier {r + 1}
          </div>
        ))}
        {techs.map((d) => {
          const p = pos(d);
          const lv = techLevel(s, d.id);
          const chk = checkTech(s, d);
          const affordable = chk.status === 'available' && canAfford(s, researchCost(s, d));
          return (
            <button
              key={d.id}
              class={`tech-node ${chk.status} ${affordable && !job ? 'ready' : ''}`}
              style={{ left: p.x * 100 + '%', top: p.y + 'px' }}
              onClick={() => {
                sfx.click();
                setSel(d.id);
              }}
            >
              <span class="tech-node-icon">
                <Icon name={d.icon} size={34} />
                {chk.status === 'locked' && (
                  <span class="tech-node-lock">
                    <Icon name="lock" size={16} />
                  </span>
                )}
                {chk.status === 'researching' && (
                  <span class="tech-node-lock">
                    <Icon name="clock" size={16} />
                  </span>
                )}
              </span>
              <span class="tech-node-name">{d.name}</span>
              <span class="tech-node-lv">
                {lv}/{d.maxLevel}
              </span>
              <span class="tech-node-bar">
                <span style={{ width: (lv / d.maxLevel) * 100 + '%' }} />
              </span>
            </button>
          );
        })}
      </div>
      {sel && TECH_BY_ID[sel] && <TechDetail def={TECH_BY_ID[sel]} onClose={() => setSel(null)} />}
    </Screen>
  );
}

function TechDetail(props: { def: TechDef; onClose: () => void }) {
  const s = useGame();
  const d = props.def;
  const lv = techLevel(s, d.id);
  const chk = checkTech(s, d);
  const maxed = chk.status === 'maxed';
  const cost = researchCost(s, d);
  const time = researchDurationMs(s, d);
  const busy = !!s.meta.researchJob;
  const instant = instantFinishCost(time);
  const cur = bonusLines(scaleBonus(d.bonus, lv));
  const next = bonusLines(scaleBonus(d.bonus, lv + 1));

  const doInstant = () => {
    const g = game;
    if (checkTech(g, d).status !== 'available') return;
    const total = { ...researchCost(g, d), diamonds: (researchCost(g, d).diamonds ?? 0) + instant };
    if (!canAfford(g, total)) {
      toast('Not enough resources', 'bad');
      return;
    }
    const newLv = techLevel(g, d.id) + 1;
    mutate((st) => {
      spendIn(st, total);
      st.meta.research[d.id] = newLv;
    });
    emit('research:done', { techId: d.id, level: newLv });
    sfx.upgrade();
    toast(`${d.name} reached Lv ${newLv}!`, 'good');
  };

  return (
    <Modal title={d.name} onClose={props.onClose} class="tech-detail">
      <div class="tech-detail-head">
        <div class={'tech-detail-icon ' + chk.status}>
          <Icon name={d.icon} size={52} />
        </div>
        <div>
          <div class="tech-detail-lv">
            Level <b>{lv}</b> / {d.maxLevel}
          </div>
          <div class="dim-text">{d.desc}</div>
        </div>
      </div>
      <div class="tech-bonus card">
        <div>
          <div class="dim-text">Current</div>
          {cur.length ? cur.map((l) => <div key={l}>{l}</div>) : <div class="dim-text">—</div>}
        </div>
        {!maxed && (
          <>
            <Icon name="arrow_right" size={20} />
            <div>
              <div class="dim-text">Next level</div>
              {next.map((l) => (
                <div key={l} class="good-text">
                  {l}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {!maxed && (
        <>
          <div class="req-list">
            <div class={'req ' + (buildingLevel(s, 'tech') >= techCenterLevelFor(d) ? 'ok' : 'bad')}>
              <Icon name={buildingLevel(s, 'tech') >= techCenterLevelFor(d) ? 'check' : 'cross'} size={18} />
              Tech Center Lv {techCenterLevelFor(d)}
            </div>
            {d.requires.map((r) => {
              const ok = techLevel(s, r.id) >= r.level;
              return (
                <div class={'req ' + (ok ? 'ok' : 'bad')} key={r.id}>
                  <Icon name={ok ? 'check' : 'cross'} size={18} />
                  {TECH_BY_ID[r.id]?.name ?? r.id} Lv {r.level}
                </div>
              );
            })}
          </div>
          <div class="tech-cost-row">
            <CostView cost={cost} />
            <span class="tech-time">
              <Icon name="clock" size={16} /> {fmtDuration(time)}
            </span>
          </div>
          <div class="modal-actions">
            <Btn color="purple" disabled={chk.status !== 'available'} onClick={doInstant}>
              <Icon name="diamonds" size={18} /> {instant}
            </Btn>
            <Btn
              color="green"
              disabled={chk.status !== 'available' || busy}
              onClick={() => {
                const err = startResearch(d.id);
                if (err) toast(err, 'bad');
                else {
                  sfx.upgrade();
                  props.onClose();
                }
              }}
            >
              {chk.status === 'researching' ? 'Researching…' : busy ? 'Lab Busy' : 'Research'}
            </Btn>
          </div>
        </>
      )}
      {maxed && <div class="maxed-banner">MAX LEVEL</div>}
    </Modal>
  );
}
