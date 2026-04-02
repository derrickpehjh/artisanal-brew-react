interface ConfirmModalProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-md p-8">
        {title && <h3 className="font-headline text-lg text-primary font-bold mb-3">{title}</h3>}
        <p className="text-sm text-on-surface leading-relaxed">{message}</p>
        <div className={`flex gap-3 mt-8 ${onCancel ? 'justify-end' : 'justify-center'}`}>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container-high rounded-xl hover:bg-surface-container-highest transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors ${danger ? 'bg-error hover:opacity-90' : 'brew-gradient hover:opacity-90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
