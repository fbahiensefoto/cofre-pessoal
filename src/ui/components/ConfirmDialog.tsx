export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) {
    return null;
  }

  return (
    <div role="dialog" aria-labelledby="confirm-dialog-title">
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px' }}>
        <h2 id="confirm-dialog-title">{props.title}</h2>
        <p>{props.message}</p>
        <button type="button" onClick={props.onCancel}>
          Cancelar
        </button>
        <button type="button" onClick={props.onConfirm} style={{ color: 'var(--color-danger)' }}>
          Confirmar
        </button>
      </div>
    </div>
  );
}
