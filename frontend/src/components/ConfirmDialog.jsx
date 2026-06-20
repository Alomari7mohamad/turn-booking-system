import { Modal } from "./Modal.jsx";
import { Button } from "./ui.jsx";

// حوار تأكيد عام للحذف/الإجراءات الحساسة.
export function ConfirmDialog({ open, title = "تأكيد", message, confirmText = "تأكيد", onConfirm, onClose, danger }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}
