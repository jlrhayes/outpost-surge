// Root UI: per-mode HUD + stack of overlay screens + toasts. Rarely needs editing:
// add screens via the per-module registries (see ./screens.ts) and HUDs via ../modes/huds.ts.
import { route, screens, toasts } from '../core/nav';
import { SCREENS } from './screens';
import { HUDS } from '../modes/huds';

export function App() {
  const r = route.value;
  const stack = screens.value;
  const Hud = HUDS[r.mode];
  return (
    <>
      <div class="hud-layer">{Hud && <Hud params={r.params} />}</div>
      {stack.map((e) => {
        const C = SCREENS[e.id];
        if (!C) {
          console.warn('Unknown screen', e.id);
          return null;
        }
        return (
          <div class="screen-layer" key={e.key}>
            <C {...(e.props ?? {})} screenKey={e.key} />
          </div>
        );
      })}
      <div class="toasts">
        {toasts.value.map((t) => (
          <div class={'toast toast-' + t.kind} key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
