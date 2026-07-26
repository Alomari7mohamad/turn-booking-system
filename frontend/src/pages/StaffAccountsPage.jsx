import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { staffApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, EmptyState, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function needsRefund(appointment) {
  return appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID";
}

function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(appointment) {
  return localDateInput(new Date(appointment.startAt)) === localDateInput();
}

function paymentLabel(appointment) {
  if (appointment.status === "CANCELLED") return "-";
  if (appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID") return i18n.t("acct.paidOnlineNoShow");
  if (amountOf(appointment) === 0) return i18n.t("pb.free");
  return PAYMENT_STATUS_META[appointment.paymentStatus]?.label || appointment.paymentStatus;
}

export default function StaffAccountsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("unpaid");

  const accountsParams = () => ({});

  const refresh = useCallback((silent = false) => {
    if (!silent) setData((current) => current);
    return staffApi.appointments(accountsParams()).then(setData);
  }, []);

  useEffect(() => {
    refresh().catch((err) => {
      toast.error(err.message);
      setData({ appointments: [] });
    });
    const timer = setInterval(() => {
      refresh(true).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, toast]);

  if (user?.staffRole !== "SECRETARY") return <Navigate to="/staff" replace />;
  if (!data) return <Spinner page />;

  const rows = data.appointments || [];
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
  const todayRows = rows.filter(isToday);
  const paidToday = todayRows
    .filter((item) => item.status !== "CANCELLED" && isPaid(item) && !needsRefund(item))
    .reduce((sum, item) => sum + amountOf(item), 0);
  const pendingToday = todayRows
    .filter((item) => item.status !== "CANCELLED" && item.paymentStatus !== "PAID" && amountOf(item) > 0 && item.status !== "NO_SHOW")
    .reduce((sum, item) => sum + amountOf(item), 0);
  const allPaid = rows
    .filter((item) => item.status !== "CANCELLED" && isPaid(item) && !needsRefund(item))
    .reduce((sum, item) => sum + amountOf(item), 0);
  const refundTotal = todayRows
    .filter(needsRefund)
    .reduce((sum, item) => sum + amountOf(item), 0);

  const printInvoice = (appointment) => {
    if (!isPaid(appointment) || appointment.status === "CANCELLED") {
      toast.error(t("acct.cantPrintUnpaid"));
      return;
    }
    setInvoice(appointment);
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  };

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{t("acct.title")}</div>
          <div className="page-sub">{t("sa.sub")}</div>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="card card-pad"><div className="soft">{t("sec.paidToday")}</div><strong style={{ fontSize: 28 }}>{fmtPrice(paidToday)}</strong></div>
        <div className="card card-pad"><div className="soft">{t("sec.pendingToday")}</div><strong style={{ fontSize: 28 }}>{fmtPrice(pendingToday)}</strong></div>
        <div className="card card-pad"><div className="soft">{t("sa.totalPaidToday")}</div><strong style={{ fontSize: 28 }}>{fmtPrice(allPaid)}</strong></div>
        <div className="card card-pad"><div className="soft">{t("acct.refunded")}</div><strong style={{ fontSize: 28 }}>{fmtPrice(refundTotal)}</strong></div>
      </div>

      <div className="card mt-3">
        <div className="row wrap" style={{ gap: 8, padding: 16, borderBottom: "1px solid var(--border)" }}>
          {[
            ["unpaid", t("acct.filterUnpaid")],
            ["paid", t("acct.filterPaid")],
            ["refund", t("acct.filterRefund")],
            ["all", t("acct.filterAll")],
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  <th>{t("employee")}</th>
                  <th>{t("sd.appointment")}</th>
                  <th>{t("sd.amount")}</th>
                  <th>{t("ap.payment")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((a) => {
                  const amount = amountOf(a);
                  const free = amount === 0;
                  const paid = isPaid(a);
                  const rejected = a.status === "CANCELLED";
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700 }}>{a.customerName}<div className="soft">{a.customerPhone}</div></td>
                      <td>{a.service?.name}</td>
                      <td>{a.employee?.name || "-"}</td>
                      <td>{fmtDate(a.startAt)} <span className="soft">{fmtTime(a.startAt)}</span></td>
                      <td>{free ? t("pb.free") : fmtPrice(amount)}</td>
                      <td>{rejected ? <span className="soft">-</span> : <Badge tone={paid ? "success" : "warning"}>{paymentLabel(a)}</Badge>}</td>
                      <td>
                        <div className="row wrap" style={{ gap: 6 }}>
                          {!rejected && !paid && a.paymentMethod === "PAY_AT_STORE" && <span className="soft">{t("sec.paymentLocked")}</span>}
                          {!rejected && paid && <Button size="sm" variant="ghost" onClick={() => printInvoice(a)}>{t("acct.printInvoice")}</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("sa.noAccounts")} hint={t("sa.noAccountsHint")} />
        )}
      </div>

      {invoice && (
        <div className="invoice-print-page" dir="rtl">
          <div className="invoice-box">
            <div className="invoice-head">
              <div>
                <h1>{t("acct.invoice")}</h1>
                <p>{user?.business?.name}</p>
              </div>
              <img src={user?.business?.logoUrl || "/oh-tech-logo.jpg"} alt={user?.business?.name || "O&H Tech"} />
            </div>
            <div className="invoice-meta">
              <span>{t("acct.invoiceNo")}: #{invoice.id}</span>
              <span>{t("acct.date")}: {fmtDate(new Date())}</span>
            </div>
            <div className="invoice-lines">
              <div><span>{t("customer")}</span><strong>{invoice.customerName}</strong></div>
              <div><span>{t("phone")}</span><strong>{invoice.customerPhone}</strong></div>
              <div><span>{t("service")}</span><strong>{invoice.service?.name}</strong></div>
              <div><span>{t("employee")}</span><strong>{invoice.employee?.name}</strong></div>
              <div><span>{t("sd.appointment")}</span><strong>{fmtDate(invoice.startAt)} {fmtTime(invoice.startAt)}</strong></div>
            </div>
            <div className="invoice-total">
              <span>{t("acct.total")}</span>
              <strong>{amountOf(invoice) === 0 ? t("pb.free") : fmtPrice(amountOf(invoice))}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
