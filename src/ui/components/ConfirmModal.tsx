// Yes/No confirmation dialog (never use window.confirm). OWNER: meta agent.
//   confirmDialog({ title: 'Reset?', text: 'All progress is lost.', confirmLabel: 'Reset', color: 'red', onConfirm: () => ... })
// Also registered as screen id 'confirm' so any module can openScreen('confirm', props).
import type { ComponentChildren } from 'preact';
import { closeScreen, openScreen } from '../../core/nav';
import { Btn, Modal, type BtnColor } from './common';
import { Icon } from './Icon';

export interface ConfirmProps {
  title: string;
  text?: ComponentChildren;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: BtnColor;
  onConfirm: () => void;
  onCancel?: () => void;
  screenKey?: number;
}

export function ConfirmModal(props: ConfirmProps) {
  const close = () => closeScreen(props.screenKey);
  return (
    <Modal
      title={props.title}
      class="confirm-modal"
      onClose={() => {
        close();
        props.onCancel?.();
      }}
    >
      {props.icon && (
        <div class="confirm-icon">
          <Icon name={props.icon} size={56} />
        </div>
      )}
      {props.text && <div class="confirm-text">{props.text}</div>}
      <div class="modal-actions">
        <Btn
          color="gray"
          onClick={() => {
            close();
            props.onCancel?.();
          }}
        >
          {props.cancelLabel ?? 'Cancel'}
        </Btn>
        <Btn
          color={props.color ?? 'green'}
          onClick={() => {
            close();
            props.onConfirm();
          }}
        >
          {props.confirmLabel ?? 'Confirm'}
        </Btn>
      </div>
    </Modal>
  );
}

export function confirmDialog(props: Omit<ConfirmProps, 'screenKey'>): void {
  openScreen('confirm', props);
}
