import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}>{confirmLabel}</button>
        </div>
      }>
      <p className="text-sm text-surface-200/70">{message}</p>
    </Modal>
  )
}
