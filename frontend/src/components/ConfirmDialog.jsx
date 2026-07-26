import { Modal } from "./Modal.jsx";
import { Button } from "./ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// حوار تأكيد عام للحذف/الإجراءات الحساسة.
export function ConfirmDialog({ open, title, message, confirmText, onConfirm, onClose, danger }) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || t("confirm")}
      footer={
        <>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText || t("confirm")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}
