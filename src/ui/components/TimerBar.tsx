// Progress bar for a running timer (training, research, healing, upgrades) with a Speed Up button. OWNER: meta agent.
import { clock } from '../../core/tick';
import { fmtDuration } from '../../core/format';
import { Btn } from './common';
import { Icon } from './Icon';

export function TimerBar(props: {
  startedAt: number;
  endsAt: number;
  label?: string;
  icon?: string;
  onSpeedup?: () => void;
  speedupLabel?: string;
}) {
  const t = clock.value;
  const total = Math.max(1, props.endsAt - props.startedAt);
  const p = Math.max(0, Math.min(1, (t - props.startedAt) / total));
  return (
    <div class="timer-bar">
      {props.icon && (
        <span class="timer-bar-icon">
          <Icon name={props.icon} size={30} />
        </span>
      )}
      <div class="timer-bar-main">
        {props.label && <div class="timer-bar-label">{props.label}</div>}
        <div class="timer-bar-track">
          <div class="timer-bar-fill" style={{ width: p * 100 + '%' }} />
          <div class="timer-bar-text">
            <Icon name="clock" size={13} /> {fmtDuration(props.endsAt - t)}
          </div>
        </div>
      </div>
      {props.onSpeedup && (
        <Btn small color="green" onClick={props.onSpeedup} icon="speedup">
          {props.speedupLabel ?? 'Speed Up'}
        </Btn>
      )}
    </div>
  );
}
