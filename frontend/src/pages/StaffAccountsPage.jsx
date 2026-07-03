import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { staffApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, EmptyState, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META } from "../components/ui.jsx";

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isToday(appointment) {
  return new Date(appointment.startAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function needsRefund(appointment) {
  return appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID";
}

function paymentLabel(appointment) {
  if (appointment.status === "CANCELLED") return "-";
  if (appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID") return "تم الدفع إلكترونياً";
  if (amountOf(appointment) === 0) return "مجانية";
  return PAYMENT_STATUS_META[appointment.paymentStatus]?.label || appointment.paymentStatus;
}

export default function StaffAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("unpaid");

  const todayParams = () => {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today, to: today };
  };

  const refresh = () => staffApi.appointments(todayParams()).then(setData);

  useEffect(() => {
    refresh().catch((err) => {
      toast.error(err.message);
      setData({ appointments: [] });
    });
  }, [toast]);

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
      toast.error("لا يمكن طباعة فاتورة قبل استلام الدفع");
      return;
    }
    setInvoice(appointment);
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  };

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">الحسابات</div>
          <div className="page-sub">حسابات اليوم الحالي فقط، وحالة الدفع للعرض فقط</div>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="card card-pad"><div className="soft">مدفوع اليوم</div><strong style={{ fontSize: 28 }}>{fmtPrice(paidToday)}</strong></div>
        <div className="card card-pad"><div className="soft">غير مدفوع اليوم</div><strong style={{ fontSize: 28 }}>{fmtPrice(pendingToday)}</strong></div>
        <div className="card card-pad"><div className="soft">إجمالي المدفوع اليوم</div><strong style={{ fontSize: 28 }}>{fmtPrice(allPaid)}</strong></div>
        <div className="card card-pad"><div className="soft">مسترجعة</div><strong style={{ fontSize: 28 }}>{fmtPrice(refundTotal)}</strong></div>
      </div>

      <div className="card mt-3">
        <div className="row wrap" style={{ gap: 8, padding: 16, borderBottom: "1px solid var(--border)" }}>
          {[
            ["unpaid", "غير مدفوع"],
            ["paid", "مدفوع"],
            ["refund", "مدفوع لم يحضر"],
            ["all", "الكل"],
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
                  <th>الزبون</th>
                  <th>الخدمة</th>
                  <th>العامل</th>
                  <th>الموعد</th>
                  <th>المبلغ</th>
                  <th>الدفع</th>
                  <th>إجراءات</th>
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
                      <td>{free ? "مجانية" : fmtPrice(amount)}</td>
                      <td>{rejected ? <span className="soft">-</span> : <Badge tone={paid ? "success" : "warning"}>{paymentLabel(a)}</Badge>}</td>
                      <td>
                        <div className="row wrap" style={{ gap: 6 }}>
                          {!rejected && !paid && a.paymentMethod === "PAY_AT_STORE" && <span className="soft">يتم استلام الدفع من صفحة الدفع فقط</span>}
                          {!rejected && paid && <Button size="sm" variant="ghost" onClick={() => printInvoice(a)}>طباعة فاتورة</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="لا توجد حسابات" hint="لا توجد حجوزات مالية ضمن الفلتر المحدد" />
        )}
      </div>

      {invoice && (
        <div className="invoice-print-page" dir="rtl">
          <div className="invoice-box">
            <div className="invoice-head">
              <div>
                <h1>فاتورة</h1>
                <p>{user?.business?.name}</p>
              </div>
              <img src={user?.business?.logoUrl || "/oh-tech-logo.jpg"} alt={user?.business?.name || "O&H Tech"} />
            </div>
            <div className="invoice-meta">
              <span>رقم الفاتورة: #{invoice.id}</span>
              <span>التاريخ: {fmtDate(new Date())}</span>
            </div>
            <div className="invoice-lines">
              <div><span>الزبون</span><strong>{invoice.customerName}</strong></div>
              <div><span>الهاتف</span><strong>{invoice.customerPhone}</strong></div>
              <div><span>الخدمة</span><strong>{invoice.service?.name}</strong></div>
              <div><span>العامل</span><strong>{invoice.employee?.name}</strong></div>
              <div><span>الموعد</span><strong>{fmtDate(invoice.startAt)} {fmtTime(invoice.startAt)}</strong></div>
            </div>
            <div className="invoice-total">
              <span>الإجمالي</span>
              <strong>{amountOf(invoice) === 0 ? "مجانية" : fmtPrice(amountOf(invoice))}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
