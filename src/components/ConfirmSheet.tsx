export function ConfirmSheet({ title, body, onClose, onConfirm }: {
  title: string; body: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-muted font-semibold text-muted-foreground">Cancelar</button>
          <button onClick={onConfirm} className="h-12 flex-1 rounded-xl bg-destructive font-semibold text-destructive-foreground">Apagar</button>
        </div>
      </div>
    </div>
  );
}
