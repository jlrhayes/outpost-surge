// OWNER: meta agent. 'welcomeBack' screen: what completed while the player was away.
import { closeScreen } from '../../core/nav';
import { fmtDuration } from '../../core/format';
import { useGame } from '../../core/store';
import { Avatar } from '../components/Avatar';
import { Btn, CostView, Modal } from '../components/common';
import { Icon } from '../components/Icon';
import type { WelcomeSummary } from './welcome';

export function WelcomeBackScreen(props: { summary: WelcomeSummary; screenKey: number }) {
  const s = useGame();
  const sum = props.summary;
  const close = () => closeScreen(props.screenKey);
  const hasStored = Object.keys(sum.stored).length > 0;
  return (
    <Modal onClose={close} class="welcome-modal">
      <div class="welcome-head">
        <Avatar index={s.player.avatar} size={64} />
        <div>
          <div class="welcome-title">Welcome back, {s.player.name}!</div>
          <div class="dim-text">
            You were away for <b>{fmtDuration(sum.awayMs)}</b>
          </div>
        </div>
      </div>
      {sum.lines.length > 0 ? (
        <div class="welcome-lines">
          {sum.lines.slice(0, 8).map((l, i) => (
            <div class="welcome-line pop-in" style={{ animationDelay: 0.1 + i * 0.06 + 's' }} key={i}>
              <Icon name={l.icon} size={24} />
              <span>{l.text}</span>
              <Icon name="check" size={18} />
            </div>
          ))}
          {sum.lines.length > 8 && <div class="dim-text center">…and {sum.lines.length - 8} more</div>}
        </div>
      ) : (
        <div class="dim-text center welcome-quiet">All quiet at the outpost while you were gone.</div>
      )}
      {hasStored && (
        <div class="welcome-stored card">
          <div class="dim-text small">Waiting in your producers — tap the bubbles to collect:</div>
          <CostView cost={sum.stored} size={22} />
        </div>
      )}
      <div class="modal-actions">
        <Btn color="yellow" big onClick={close}>
          Let's go!
        </Btn>
      </div>
    </Modal>
  );
}
