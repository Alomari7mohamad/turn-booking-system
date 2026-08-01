import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { Badge, Button, EmptyState, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META } from "../components/ui.jsx";

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function todayInput() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function needsRefund(appointment) {
  return appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID";
}

function paymentLabel(appointment, c) {
  if (appointment.status === "CANCELLED") return c.noPayment;
  if (appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID") {
    return c.paidOnlineNoShow;
  }
  if (amountOf(appointment) === 0) return c.free;
  if (appointment.paymentStatus === "PAID") return c.paid;
  if (appointment.paymentStatus === "PENDING") return c.pending;
  return PAYMENT_STATUS_META[appointment.paymentStatus]?.label || appointment.paymentStatus;
}

export default function AccountsPage() {
  const { api, business } = useBusinessManage();
  const { user } = useAuth();
  const activeBusiness = business || user?.business || null;
  const { t } = useLanguage();
  const toast = useToast();
  const c = new Proxy({}, { get: (_, key) => t("acct." + key) });
  const [appointments, setAppointments] = useState(null);
  const [invoiceTarget, setInvoiceTarget] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("unpaid");
  const onlinePaymentEnabled = activeBusiness?.onlinePaymentEnabled === true;

  const load = useCallback(() => {
    const today = todayInput();
    api.listAppointments({ from: today, to: today })
      .then((res) => setAppointments(res.appointments || []))
      .catch((err) => {
        toast.error(err.message);
        setAppointments([]);
      });
  }, [api, toast]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!onlinePaymentEnabled && paymentFilter === "refund") setPaymentFilter("unpaid");
  }, [onlinePaymentEnabled, paymentFilter]);

  const rows = useMemo(() => (appointments || []).filter((item) => amountOf(item) >= 0), [appointments]);
  const filteredRows = rows.filter((item) => {
    if (item.status === "CANCELLED") return paymentFilter === "all";
    const paid = isPaid(item);
    const noShowOnlinePaid = needsRefund(item);
    if (item.status === "NO_SHOW" && !noShowOnlinePaid) return false;
    if (paymentFilter === "refund") return noShowOnlinePaid;
    if (paymentFilter === "paid") return paid;
    if (paymentFilter === "unpaid") return !paid && item.status !== "NO_SHOW";
    return true;
  });
  const paidTotal = rows
    .filter((item) => item.status !== "CANCELLED" && isPaid(item) && !needsRefund(item))
    .reduce((sum, item) => sum + amountOf(item), 0);
  const pendingTotal = rows
    .filter((item) => item.status !== "CANCELLED" && item.paymentStatus !== "PAID" && amountOf(item) > 0 && item.status !== "NO_SHOW")
    .reduce((sum, item) => sum + amountOf(item), 0);
  const refundTotal = rows
    .filter(needsRefund)
    .reduce((sum, item) => sum + amountOf(item), 0);

  const openInvoiceFormats = (appointment) => {
    if (!isPaid(appointment) || appointment.status === "CANCELLED") {
      toast.error(c.cantPrintUnpaid);
      return;
    }
    setInvoiceTarget(appointment);
  };

  const printInvoice = (format) => {
    if (!invoiceTarget) return;
    setInvoice({ appointment: invoiceTarget, format });
    setInvoiceTarget(null);
    const clearInvoice = () => {
      setInvoice(null);
      window.removeEventListener("afterprint", clearInvoice);
    };
    window.addEventListener("afterprint", clearInvoice);
    requestAnimationFrame(() => setTimeout(() => window.print(), 60));
  };

  if (!appointments) return <Spinner page />;

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{c.title}</div>
          <div className="page-sub">{c.sub}</div>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="card card-pad">
          <div className="soft">{c.totalPaid}</div>
          <strong style={{ fontSize: 28 }}>{fmtPrice(paidTotal)}</strong>
        </div>
        <div className="card card-pad">
          <div className="soft">{c.pendingAmount}</div>
          <strong style={{ fontSize: 28 }}>{fmtPrice(pendingTotal)}</strong>
        </div>
        <div className="card card-pad">
          <div className="soft">{c.invoices}</div>
          <strong style={{ fontSize: 28 }}>{filteredRows.length}</strong>
        </div>
        <div className="card card-pad">
          <div className="soft">{c.refunded}</div>
          <strong style={{ fontSize: 28 }}>{fmtPrice(refundTotal)}</strong>
        </div>
      </div>

      <section className="accounts-transactions-section mt-3">
        <div className="accounts-filter-grid">
          {[
            ["unpaid", c.filterUnpaid],
            ["paid", c.filterPaid],
            ...(onlinePaymentEnabled ? [["refund", c.filterRefund]] : []),
            ["all", c.filterAll],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${paymentFilter === key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPaymentFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {filteredRows.length ? (
          <div className="accounts-transaction-grid">
            {filteredRows.map((appointment) => {
              const amount = amountOf(appointment);
              const paid = isPaid(appointment);
              const rejected = appointment.status === "CANCELLED";
              return (
                <article className="accounts-transaction-card" key={appointment.id}>
                  <header className="accounts-transaction-head">
                    <div>
                      <strong>{appointment.customerName}</strong>
                      <a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a>
                    </div>
                    <Badge tone={rejected ? "muted" : paid ? "success" : "warning"}>{paymentLabel(appointment, c)}</Badge>
                  </header>

                  <div className="accounts-transaction-details">
                    <div>
                      <span>{c.service}</span>
                      <strong>{appointment.service?.name || "-"}</strong>
                    </div>
                    <div>
                      <span>{c.appointment}</span>
                      <strong>{fmtDate(appointment.startAt)}</strong>
                      <small>{fmtTime(appointment.startAt)}</small>
                    </div>
                    <div>
                      <span>{c.paidAmount}</span>
                      <strong>{amount === 0 ? c.free : fmtPrice(amount)}</strong>
                    </div>
                  </div>

                  <footer className="accounts-transaction-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rejected || !paid}
                      onClick={() => openInvoiceFormats(appointment)}
                    >
                      {c.printInvoice}
                    </Button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={c.noRows} hint={c.noRowsHint} />
        )}
      </section>

      {invoice && (
        <>
          <style>{`@media print { @page { size: ${invoice.format === "thermal" ? "80mm auto" : "A4"}; margin: ${invoice.format === "thermal" ? "4mm" : "14mm"}; } }`}</style>
          <div className={`invoice-print-page invoice-print-page--${invoice.format}`} dir="rtl">
            <div className="invoice-box">
              <div className="invoice-head">
                <div>
                  <h1>{c.invoice}</h1>
                  <p>{activeBusiness?.name || t("store")}</p>
                </div>
                <img src={activeBusiness?.logoUrl || "/oh-tech-logo.jpg"} alt={activeBusiness?.name || "O&H Tech"} />
              </div>
              <div className="invoice-meta">
                <span>{c.invoiceNo}: #{invoice.appointment.id}</span>
                <span>{c.date}: {fmtDate(new Date())}</span>
              </div>
              <div className="invoice-section-title">{t("invoiceCustomerDetails")}</div>
              <div className="invoice-lines">
                <div><span>{c.customer}</span><strong>{invoice.appointment.customerName}</strong></div>
                <div><span>{c.phone}</span><strong dir="ltr">{invoice.appointment.customerPhone}</strong></div>
              </div>
              <div className="invoice-section-title">{t("invoiceBookingDetails")}</div>
              <div className="invoice-lines">
                <div><span>{c.service}</span><strong>{invoice.appointment.service?.name || "-"}</strong></div>
                <div><span>{c.employee}</span><strong>{invoice.appointment.employee?.name || "-"}</strong></div>
                <div><span>{c.appointment}</span><strong>{fmtDate(invoice.appointment.startAt)} {fmtTime(invoice.appointment.startAt)} - {fmtTime(invoice.appointment.endAt)}</strong></div>
              </div>
              <div className="invoice-totals">
                <div><span>{t("invoiceBeforeTax")}</span><strong>{fmtPrice(amountOf(invoice.appointment) * 0.82)}</strong></div>
                <div><span>{t("invoiceTax18")}</span><strong>{fmtPrice(amountOf(invoice.appointment) * 0.18)}</strong></div>
                <div className="invoice-total"><span>{t("invoiceFinalPrice")}</span><strong>{fmtPrice(amountOf(invoice.appointment))}</strong></div>
              </div>
              <p className="invoice-tax-note">{t("invoiceTaxIncludedNote")}</p>
              <p className="invoice-thanks">{t("invoiceSeeYouAgain")}</p>
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title={t("invoiceChooseFormat")}
      >
        <div className="invoice-format-options">
          <button type="button" onClick={() => printInvoice("a4")}>
            <strong>{t("invoiceA4")}</strong>
            <span>{t("invoiceA4Hint")}</span>
          </button>
          <button type="button" onClick={() => printInvoice("thermal")}>
            <strong>{t("invoiceThermal80")}</strong>
            <span>{t("invoiceThermalHint")}</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
