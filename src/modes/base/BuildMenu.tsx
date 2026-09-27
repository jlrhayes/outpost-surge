// OWNER: base agent. `buildMenu {plot, highlight?}` — choose a new building for an empty plot.
import './base.css';
import { useGame } from '../../core/store';
import { closeScreen } from '../../core/nav';
import { fmtDuration } from '../../core/format';
import type { BuildingType } from '../../core/types';
import { Btn, CostView, Screen } from '../../ui/components/common';
import { BUILDINGS, PLOT_TYPES, effectsAt, plotDef, upgradeCost } from '../../data/buildings';
import { buildingOnPlot, buildingsOf, hasFreeBuilder, maxCount, nextInstanceRule, plotUnlocked, ruleText, upgradeTimeMs } from '../../systems/buildings';
import { doConstruct } from './actions';
import { BuildingArt, fmtEffect } from './BuildingPanel';
import { Lock } from './icons';

export function BuildMenu(props: { plot: number; highlight?: BuildingType; screenKey?: number }) {
  const s = useGame();
  const plot = plotDef(props.plot);
  if (!plot || (plot.kind !== 'core' && plot.kind !== 'res')) {
    return (
      <Screen title="Build">
        <div class="bp-empty">Nothing can be built here.</div>
      </Screen>
    );
  }
  if (!plotUnlocked(s, plot.id) || buildingOnPlot(s, plot.id)) {
    return (
      <Screen title="Build">
        <div class="bp-empty">{buildingOnPlot(s, plot.id) ? 'This plot is already in use.' : `Clear District ${plot.district} to use this plot.`}</div>
      </Screen>
    );
  }
  const rows = PLOT_TYPES[plot.kind].map((type) => {
    const owned = buildingsOf(s, type).length;
    const cap = maxCount(s, type);
    const total = BUILDINGS[type].unlocks.length;
    const rule = nextInstanceRule(s, type);
    const available = owned < cap;
    return { type, owned, cap, total, rule, available, done: owned >= total };
  });
  // Buildable first, then locked (by the HQ level they need), then fully built.
  rows.sort((a, b) => {
    const rank = (r: (typeof rows)[number]) => (r.available ? 0 : r.done ? 2 : 1);
    const d = rank(a) - rank(b);
    if (d) return d;
    return (a.rule?.hq ?? 0) + (a.rule?.districts ?? 0) * 0.5 - ((b.rule?.hq ?? 0) + (b.rule?.districts ?? 0) * 0.5);
  });
  const builderFree = hasFreeBuilder(s);
  return (
    <Screen title={plot.kind === 'res' ? 'Build: Resource Plot' : 'Build: Outpost Plot'} class="bm-screen">
      <div class="bm-hint">{plot.kind === 'res' ? 'Resource plots hold producers.' : 'Outpost plots hold military & support buildings.'}</div>
      {rows.map((r) => {
        const def = BUILDINGS[r.type];
        const cost = upgradeCost(r.type, 1);
        const eff = effectsAt(r.type, 1)[0];
        return (
          <div
            key={r.type}
            class={'bm-row card' + (r.available ? '' : ' locked') + (props.highlight === r.type ? ' highlight' : '')}
            ref={(el) => {
              if (el && props.highlight === r.type && !el.dataset.scrolled) {
                el.dataset.scrolled = '1';
                el.scrollIntoView({ block: 'center' });
              }
            }}
          >
            <BuildingArt type={r.type} level={1} size={78} />
            <div class="bm-info">
              <div class="bm-name">
                {def.name}
                {r.cap > 0 && (
                  <span class="bm-count">
                    {r.owned}/{Math.max(r.cap, r.owned)}
                  </span>
                )}
              </div>
              <div class="bm-desc">{def.desc}</div>
              {eff && (
                <div class="bm-eff">
                  {eff.label}: <b>{fmtEffect(eff)}</b>
                </div>
              )}
              {r.available ? (
                <div class="bm-cost">
                  <CostView cost={cost} />
                  <span class="bm-time">{fmtDuration(upgradeTimeMs(s, r.type, 1))}</span>
                </div>
              ) : (
                <div class="bm-lock">
                  <Lock size={14} /> {r.done ? 'All built' : r.rule ? ruleText(r.rule) : 'Locked'}
                </div>
              )}
            </div>
            {r.available && (
              <Btn
                color={builderFree ? 'green' : 'gray'}
                class="bm-build"
                onClick={() => {
                  doConstruct(r.type, plot.id);
                }}
              >
                Build
              </Btn>
            )}
          </div>
        );
      })}
      <div class="bm-foot">
        <Btn color="gray" onClick={() => closeScreen(props.screenKey)}>
          Close
        </Btn>
      </div>
    </Screen>
  );
}
