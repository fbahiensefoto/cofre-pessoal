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
    <div role="dialog" aria-labelledby="confirm-dialog-title" className="dialog" style={{ position: 'fixed', inset: 0 }}>
      <div className="dialog__card">
        <h2 id="confirm-dialog-title">{props.title}</h2>
        <p>{props.message}</p>
        <div className="actions">
          <button type="button" className="btn btn--secondary" onClick={props.onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={props.onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
