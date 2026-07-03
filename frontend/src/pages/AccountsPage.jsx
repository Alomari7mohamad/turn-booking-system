import { useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, EmptyState, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META } from "../components/ui.jsx";

const copy = {
  ar: {
    title: "الحسابات",
    sub: "متابعة المدفوعات والفواتير المالية للحجوزات",
    totalPaid: "إجمالي المدفوع",
    pendingAmount: "غير مدفوع",
    invoices: "الفواتير",
    customer: "الزبون",
    phone: "الهاتف",
    service: "الخدمة",
    appointment: "الموعد",
    paidAmount: "المبلغ",
    paymentStatus: "حالة الدفع",
    printInvoice: "طباعة فاتورة",
    noRows: "لا توجد عمليات مالية",
    noRowsHint: "ستظهر هنا الحجوزات والمبالغ المرتبطة بها",
    invoice: "فاتورة",
    invoiceNo: "رقم الفاتورة",
    date: "التاريخ",
    employee: "العامل",
    amount: "المبلغ",
    total: "الإجمالي",
    paid: "مدفوع",
    pending: "بانتظار الدفع",
    free: "مجانية",
  },
  he: {
    title: "חשבונות",
    sub: "מעקב אחר תשלומים וחשבוניות של תורים",
    totalPaid: "סה״כ שולם",
    pendingAmount: "טרם שולם",
    invoices: "חשבוניות",
    customer: "לקוח",
    phone: "טלפון",
    service: "שירות",
    appointment: "תור",
    paidAmount: "סכום",
    paymentStatus: "סטטוס תשלום",
    printInvoice: "הדפסת חשבונית",
    noRows: "אין פעולות כספיות",
    noRowsHint: "כאן יופיעו התורים והסכומים שלהם",
    invoice: "חשבונית",
    invoiceNo: "מספר חשבונית",
    date: "תאריך",
    employee: "עובד",
    amount: "סכום",
    total: "סה״כ",
    paid: "שולם",
    pending: "ממתין לתשלום",
    free: "חינם",
  },
};

const cleanCopy = {
  ar: {
    title: "الحسابات",
    sub: "متابعة المدفوعات والفواتير المالية للحجوزات",
    totalPaid: "إجمالي المدفوع",
    pendingAmount: "غير مدفوع",
    invoices: "الفواتير",
    customer: "الزبون",
    phone: "الهاتف",
    service: "الخدمة",
    appointment: "الموعد",
    paidAmount: "المبلغ",
    paymentStatus: "حالة الدفع",
    printInvoice: "طباعة فاتورة",
    noRows: "لا توجد عمليات مالية",
    noRowsHint: "ستظهر هنا الحجوزات والمبالغ المرتبطة بها",
    invoice: "فاتورة",
    invoiceNo: "رقم الفاتورة",
    date: "التاريخ",
    employee: "العامل",
    amount: "المبلغ",
    total: "الإجمالي",
    paid: "مدفوع",
    pending: "بانتظار الدفع",
    free: "مجانية",
    paidOnlineNoShow: "تم الدفع إلكترونياً",
  },
  he: {
    title: "חשבונות",
    sub: "מעקב אחר תשלומים וחשבוניות של התורים",
    totalPaid: "סה״כ שולם",
    pendingAmount: "לא שולם",
    invoices: "חשבוניות",
    customer: "לקוח",
    phone: "טלפון",
    service: "שירות",
    appointment: "תור",
    paidAmount: "סכום",
    paymentStatus: "סטטוס תשלום",
    printInvoice: "הדפסת חשבונית",
    noRows: "אין פעולות כספיות",
    noRowsHint: "כאן יופיעו התורים והסכומים שלהם",
    invoice: "חשבונית",
    invoiceNo: "מספר חשבונית",
    date: "תאריך",
    employee: "עובד",
    amount: "סכום",
    total: "סה״כ",
    paid: "שולם",
    pending: "ממתין לתשלום",
    free: "חינם",
    paidOnlineNoShow: "שולם אונליין",
  },
};

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function needsRefund(appointment) {
  return appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID";
}

function paymentLabel(appointment, c) {
  if (appointment.status === "CANCELLED") return "-";
  if (appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID") {
    return c.paidOnlineNoShow || "تم الدفع إلكترونياً";
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
  const { language } = useLanguage();
  const toast = useToast();
  const c = cleanCopy[language] || cleanCopy.ar;
  const [appointments, setAppointments] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("unpaid");

  useEffect(() => {
    api.listAppointments()
      .then((res) => setAppointments(res.appointments || []))
      .catch((err) => {
        toast.error(err.message);
        setAppointments([]);
      });
  }, [api, toast]);

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

  const printInvoice = (appointment) => {
    if (!isPaid(appointment) || appointment.status === "CANCELLED") {
      toast.error("لا يمكن طباعة فاتورة قبل استلام الدفع");
      return;
    }
    setInvoice(appointment);
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
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
          <div className="soft">{language === "he" ? "להחזר" : "مسترجعة"}</div>
          <strong style={{ fontSize: 28 }}>{fmtPrice(refundTotal)}</strong>
        </div>
      </div>

      <div className="card mt-3">
        <div className="row wrap" style={{ gap: 8, padding: 16, borderBottom: "1px solid var(--border)" }}>
          {[
            ["unpaid", language === "he" ? "לא שולם" : "غير مدفوع"],
            ["paid", language === "he" ? "שולם" : "مدفوع"],
            ["refund", language === "he" ? "שולם ולא הגיע" : "مدفوع لم يحضر"],
            ["all", language === "he" ? "הכל" : "الكل"],
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
                  <th>{c.customer}</th>
                  <th>{c.phone}</th>
                  <th>{c.service}</th>
                  <th>{c.appointment}</th>
                  <th>{c.paidAmount}</th>
                  <th>{c.paymentStatus}</th>
                  <th>{c.printInvoice}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((appointment) => {
                  const amount = amountOf(appointment);
                  const paid = isPaid(appointment);
                  const rejected = appointment.status === "CANCELLED";
                  return (
                    <tr key={appointment.id}>
                      <td style={{ fontWeight: 800 }}>{appointment.customerName}</td>
                      <td>{appointment.customerPhone}</td>
                      <td>{appointment.service?.name}</td>
                      <td>{fmtDate(appointment.startAt)} <span className="soft">{fmtTime(appointment.startAt)}</span></td>
                      <td>{amount === 0 ? c.free : fmtPrice(amount)}</td>
                      <td>{rejected ? <span className="soft">-</span> : <Badge tone={paid ? "success" : "warning"}>{paymentLabel(appointment, c)}</Badge>}</td>
                      <td>
                        {rejected || !paid ? (
                          <span className="soft">-</span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => printInvoice(appointment)}>{c.printInvoice}</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={c.noRows} hint={c.noRowsHint} />
        )}
      </div>

      {invoice && (
        <div className="invoice-print-page" dir="rtl">
          <div className="invoice-box">
            <div className="invoice-head">
              <div>
                <h1>{c.invoice}</h1>
                <p>{activeBusiness?.name || invoice.business?.name}</p>
              </div>
              {activeBusiness?.logoUrl && <img src={activeBusiness.logoUrl} alt={activeBusiness.name} />}
            </div>
            <div className="invoice-meta">
              <span>{c.invoiceNo}: #{invoice.id}</span>
              <span>{c.date}: {fmtDate(new Date())}</span>
            </div>
            <div className="invoice-lines">
              <div><span>{c.customer}</span><strong>{invoice.customerName}</strong></div>
              <div><span>{c.phone}</span><strong>{invoice.customerPhone}</strong></div>
              <div><span>{c.service}</span><strong>{invoice.service?.name}</strong></div>
              <div><span>{c.employee}</span><strong>{invoice.employee?.name}</strong></div>
              <div><span>{c.appointment}</span><strong>{fmtDate(invoice.startAt)} {fmtTime(invoice.startAt)}</strong></div>
              <div><span>{c.paymentStatus}</span><strong>{paymentLabel(invoice, c)}</strong></div>
            </div>
            <div className="invoice-total">
              <span>{c.total}</span>
              <strong>{amountOf(invoice) === 0 ? c.free : fmtPrice(amountOf(invoice))}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
