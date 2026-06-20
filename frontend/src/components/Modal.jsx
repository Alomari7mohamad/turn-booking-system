import { useEffect } from "react";

export function Modal({ open, onClose, title, children, footer, large, closeOnOverlay = true }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => closeOnOverlay && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${large ? "modal-lg" : ""}`}>
        <div className="modal-header">
          <h3 className="card-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
