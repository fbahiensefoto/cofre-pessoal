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
    <div
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-accent)',
          padding: '16px',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%',
        }}
      >
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
