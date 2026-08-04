import modal from '../styles/modal.module.css';
import styles from './ConfirmModal.module.css';

/** Generic yes/no confirmation dialog for actions that reset or refresh sheet state in bulk
 *  (Make Camp, Refresh all, Import JSON) — those used to fire on a single tap with no way back. */
export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={modal.backdrop} onClick={onCancel}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 className={modal.title}>{title}</h2>
          <p className={modal.subtitle}>{body}</p>
        </div>
        <div className={modal.body}>
          <button className={`tap-inline ${styles.confirmAction}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
