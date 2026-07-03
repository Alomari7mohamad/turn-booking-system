import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META, STATUS_META } from "../components/ui.jsx";

const cleanCopy = {
  ar: {
    title: "صفحة السكرتيرة",
    sub: "إدارة أدوار اليوم، الدفع، القبول والرفض، وطباعة أوراق الدخول",
    loginTitle: "دخول السكرتيرة",
    loginSub: "أدخل الرقم السري للسكرتير/ة أو كلمة مرور المدير لفتح الصفحة",
    pin: "الرقم السري",
    open: "دخول",
    insideNow: "داخل الصفحة الآن",
    printSchedule: "طباعة جدول اليوم",
    noTurnsToPrint: "لا توجد أدوار اليوم لطباعتها",
    allToday: "كل أدوار اليوم",
    pending: "بانتظار التأكيد",
    confirmed: "مؤكدة",
    paidFree: "مدفوعة/مجانية",
    todayAccounts: "حسابات اليوم",
    paidToday: "مدفوع اليوم",
    pendingToday: "غير مدفوع اليوم",
    allEmployees: "كل العاملين",
    refresh: "تحديث",
    time: "الوقت",
    customer: "الزبون",
    employee: "العامل",
    service: "الخدمة",
    status: "الحالة",
    payment: "الدفع",
    actions: "إجراءات السكرتيرة",
    accept: "قبول",
    reject: "رفض",
    collectPayment: "استلام الدفع",
    paymentLocked: "يتم استلام الدفع من صفحة الدفع فقط",
    lateTicket: "فحص وطباعة متأخر",
    free: "مجانية",
    noTurns: "لا توجد أدوار اليوم",
    noTurnsHint: "ستظهر هنا أدوار اليوم لكل العاملين أو حسب العامل المختار",
    scheduleTitle: "جدول أدوار اليوم",
    appointment: "الموعد",
    amount: "المبلغ",
    freeService: "الخدمة مجانية",
    lateEntry: "دخول متأخر",
    bookingNumber: "رقم الحجز اليومي",
    queueNumber: "رقم الدور",
    priority: "الأولوية حسب وقت الموعد في جدول اليوم، وليس وقت سحب الورقة",
    nextBySchedule: "أنت التالي حسب جدول اليوم",
    ahead: "قبلك",
    inTodaySchedule: "في جدول اليوم",
    accepted: "تم قبول الدور",
    rejected: "تم رفض الدور",
    paymentReceived: "تم استلام الدفع وتغيير الحالة إلى مدفوع",
    lateIssued: "تم فحص توفر العامل وإصدار ورقة الدخول المتأخر",
    wrongPin: "تعذر فتح صفحة السكرتيرة",
    paid: "مدفوع",
    unpaid: "غير مدفوع",
    failed: "فشل الدفع",
    refunded: "مسترجع",
    cancelled: "مرفوض",
    completed: "مكتمل",
    noShow: "لم يحضر",
  },
  he: {
    title: "עמדת מזכירות",
    sub: "ניהול תורי היום, תשלום, אישור ודחייה, והדפסת פתקים",
    loginTitle: "כניסת מזכירות",
    loginSub: "הכניסו קוד מזכירות או סיסמת מנהל כדי לפתוח את העמוד",
    pin: "קוד כניסה",
    open: "כניסה",
    insideNow: "מחובר עכשיו",
    printSchedule: "הדפסת תורי היום",
    noTurnsToPrint: "אין תורים להדפסה היום",
    allToday: "כל תורי היום",
    pending: "ממתינים לאישור",
    confirmed: "מאושרים",
    paidFree: "שולם/חינם",
    todayAccounts: "חשבונות היום",
    paidToday: "שולם היום",
    pendingToday: "לא שולם היום",
    allEmployees: "כל העובדים",
    refresh: "רענון",
    time: "שעה",
    customer: "לקוח",
    employee: "עובד",
    service: "שירות",
    status: "סטטוס",
    payment: "תשלום",
    actions: "פעולות מזכירות",
    accept: "אישור",
    reject: "דחייה",
    collectPayment: "קבלת תשלום",
    paymentLocked: "קבלת תשלום מתבצעת רק בעמוד התשלום",
    lateTicket: "בדיקה והדפסת מאחר",
    free: "חינם",
    noTurns: "אין תורים היום",
    noTurnsHint: "כאן יופיעו תורי היום לכל העובדים או לעובד שנבחר",
    scheduleTitle: "לוח תורי היום",
    appointment: "תור",
    amount: "סכום",
    freeService: "השירות בחינם",
    lateEntry: "כניסת מאחר",
    bookingNumber: "מספר הזמנה יומי",
    queueNumber: "מספר תור",
    priority: "הקדימות לפי שעת התור בלוח היום, לא לפי זמן הדפסת הפתק",
    nextBySchedule: "אתם הבאים לפי לוח היום",
    ahead: "לפניך",
    inTodaySchedule: "בלוח היום",
    accepted: "התור אושר",
    rejected: "התור נדחה",
    paymentReceived: "התשלום התקבל והסטטוס עודכן לשולם",
    lateIssued: "נבדקה זמינות העובד והודפס פתק מאחר",
    wrongPin: "לא ניתן לפתוח את עמדת המזכירות",
    paid: "שולם",
    unpaid: "לא שולם",
    failed: "תשלום נכשל",
    refunded: "הוחזר",
    cancelled: "נדחה",
    completed: "הושלם",
    noShow: "לא הגיע",
  },
};

function statusLabel(status, c) {
  return {
    PENDING: c.pending,
    CONFIRMED: c.confirmed,
    COMPLETED: c.completed,
    CANCELLED: c.cancelled,
    NO_SHOW: c.noShow,
  }[status] || status;
}

function paymentLabel(paymentStatus, free, c) {
  if (free) return c.free;
  return {
    PAID: c.paid,
    PENDING: c.unpaid,
    FAILED: c.failed,
    REFUNDED: c.refunded,
  }[paymentStatus] || paymentStatus;
}

function isLate(appointment) {
  return appointment.status === "CONFIRMED" && new Date() > new Date(appointment.endAt);
}

function moneyOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function sessionKey(basePath) {
  return `secretary_session:${basePath}`;
}

export default function SecretaryPage() {
  const toast = useToast();
  const { language } = useLanguage();
  const c = cleanCopy[language] || cleanCopy.ar;
  const { api, basePath } = useBusinessManage();
  const [data, setData] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(null);
  const [pin, setPin] = useState("");
  const [actor, setActor] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey(basePath))) || null;
    } catch {
      return null;
    }
  });
  const [opening, setOpening] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    setData(null);
    api.secretaryToday(employeeId ? { employeeId } : {}).then(setData).catch((err) => {
      toast.error(err.message);
      setData({ employees: [], appointments: [], business: null });
    });
  }, [actor, api, employeeId, toast]);

  useEffect(() => { load(); }, [load]);

  const openSession = async (event) => {
    event.preventDefault();
    setOpening(true);
    try {
      const res = await api.openSecretarySession(pin);
      setActor(res.actor);
      sessionStorage.setItem(sessionKey(basePath), JSON.stringify(res.actor));
      setPin("");
    } catch (err) {
      toast.error(err.message || c.wrongPin);
    } finally {
      setOpening(false);
    }
  };

  const appointments = data?.appointments || [];
  const employees = data?.employees || [];
  const confirmed = appointments.filter((item) => item.status === "CONFIRMED");
  const pending = appointments.filter((item) => item.status === "PENDING");

  const stats = useMemo(() => ({
    all: appointments.length,
    pending: pending.length,
    confirmed: confirmed.length,
    paid: appointments.filter((item) => item.paymentStatus === "PAID" || moneyOf(item) === 0).length,
  }), [appointments, pending.length, confirmed.length]);
  const paidToday = appointments
    .filter((item) => item.paymentStatus === "PAID" || moneyOf(item) === 0)
    .reduce((sum, item) => sum + moneyOf(item), 0);
  const pendingToday = appointments
    .filter((item) => item.paymentStatus !== "PAID" && moneyOf(item) > 0)
    .reduce((sum, item) => sum + moneyOf(item), 0);

  const updateStatus = async (appointment, status) => {
    try {
      await api.updateAppointment(appointment.id, { status });
      toast.success(status === "CONFIRMED" ? c.accepted : c.rejected);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const printLateTicket = async (appointment) => {
    setLoadingTicket(appointment.id);
    try {
      const res = await api.secretaryLateTicket(appointment.id);
      setTicket(res.ticket);
      toast.success(c.lateIssued);
      setTimeout(() => window.print(), 250);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingTicket(null);
    }
  };

  if (!actor) {
    return (
      <div className="secretary-login-shell" data-no-auto-translate="true">
        <div className="card card-pad secretary-login-card">
          <div>
            <div>
              <div className="page-title">{c.loginTitle}</div>
              <div className="page-sub">{c.loginSub}</div>
            </div>
          </div>
          <form onSubmit={openSession} className="col" style={{ gap: 14, marginTop: 18 }}>
            <Field label={c.pin}>
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus required inputMode="numeric" />
            </Field>
            <Button type="submit" loading={opening}>{c.open}</Button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return <Spinner page />;

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{c.title}</div>
          <div className="page-sub">{c.sub}</div>
          <div className="soft" style={{ marginTop: 8 }}>{c.insideNow}: <strong>{actor.name}</strong></div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <LanguageSwitcher />
          <Button
            variant="ghost"
            onClick={() => {
              if (!appointments.length) {
                toast.error(c.noTurnsToPrint);
                return;
              }
              setTicket(null);
              requestAnimationFrame(() => window.print());
            }}
          >
            {c.printSchedule}
          </Button>
        </div>
      </div>

      <div className="grid grid-stats secretary-stats">
        <div className="card card-pad"><div className="soft">{c.allToday}</div><strong>{stats.all}</strong></div>
        <div className="card card-pad"><div className="soft">{c.pending}</div><strong>{stats.pending}</strong></div>
        <div className="card card-pad"><div className="soft">{c.confirmed}</div><strong>{stats.confirmed}</strong></div>
        <div className="card card-pad"><div className="soft">{c.paidFree}</div><strong>{stats.paid}</strong></div>
      </div>

      <div className="card card-pad mt-3">
        <div className="row wrap" style={{ gap: 10 }}>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">{c.allEmployees}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </Select>
          <Button variant="ghost" onClick={load}>{c.refresh}</Button>
        </div>
      </div>

      <div className="card mt-3">
        {appointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{c.time}</th>
                  <th>{c.customer}</th>
                  <th>{c.employee}</th>
                  <th>{c.service}</th>
                  <th>{c.status}</th>
                  <th>{c.payment}</th>
                  <th>{c.actions}</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const amount = moneyOf(appointment);
                  const free = amount === 0;
                  const paid = appointment.paymentStatus === "PAID" || free;
                  const rejected = appointment.status === "CANCELLED";
                  return (
                    <tr key={appointment.id} className={isLate(appointment) ? "secretary-late-row" : ""}>
                      <td>{fmtTime(appointment.startAt)}<div className="soft">{fmtDate(appointment.startAt)}</div></td>
                      <td style={{ fontWeight: 800 }}>{appointment.customerName}<div className="soft">{appointment.customerPhone}</div></td>
                      <td>{appointment.employee?.name}</td>
                      <td>{appointment.service?.name}<div className="soft">{free ? c.free : fmtPrice(amount)}</div></td>
                      <td><Badge tone={STATUS_META[appointment.status]?.tone}>{statusLabel(appointment.status, c)}</Badge></td>
                      <td>{rejected ? <span className="soft">-</span> : <Badge tone={paid ? "success" : PAYMENT_STATUS_META[appointment.paymentStatus]?.tone}>{paymentLabel(appointment.paymentStatus, free, c)}</Badge>}</td>
                      <td>
                        <div className="row wrap" style={{ gap: 6 }}>
                          {appointment.status === "PENDING" && (
                            <>
                              <Button size="sm" onClick={() => updateStatus(appointment, "CONFIRMED")}>{c.accept}</Button>
                              <Button size="sm" variant="danger" onClick={() => updateStatus(appointment, "CANCELLED")}>{c.reject}</Button>
                            </>
                          )}
                          {!rejected && !paid && appointment.paymentMethod === "PAY_AT_STORE" && (
                            <span className="soft">{c.paymentLocked}</span>
                          )}
                          {isLate(appointment) && (
                            <Button size="sm" loading={loadingTicket === appointment.id} onClick={() => printLateTicket(appointment)}>{c.lateTicket}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={c.noTurns} hint={c.noTurnsHint} />
        )}
      </div>

      <div className="card mt-3">
        <div className="section-head">
          <div>
            <h3>{c.todayAccounts}</h3>
            <p>{c.paidToday}: {fmtPrice(paidToday)} · {c.pendingToday}: {fmtPrice(pendingToday)}</p>
          </div>
        </div>
        {appointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{c.customer}</th>
                  <th>{c.service}</th>
                  <th>{c.amount}</th>
                  <th>{c.payment}</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const amount = moneyOf(appointment);
                  const free = amount === 0;
                  const paid = appointment.paymentStatus === "PAID" || free;
                  const rejected = appointment.status === "CANCELLED";
                  return (
                    <tr key={`account-${appointment.id}`}>
                      <td style={{ fontWeight: 800 }}>{appointment.customerName}<div className="soft">{appointment.customerPhone}</div></td>
                      <td>{appointment.service?.name}</td>
                      <td>{free ? c.free : fmtPrice(amount)}</td>
                      <td>{rejected ? <span className="soft">-</span> : <Badge tone={paid ? "success" : "warning"}>{paymentLabel(appointment.paymentStatus, free, c)}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={c.noTurns} hint={c.noTurnsHint} />
        )}
      </div>

      <div className="secretary-print-page" dir="rtl">
        <h1>{c.scheduleTitle}</h1>
        {appointments.map((appointment) => (
          <div key={appointment.id} className="print-appointment">
            <div className="print-customer"><strong>{appointment.customerName}</strong><span>{appointment.customerPhone}</span></div>
            <div>{c.appointment}: {fmtDate(appointment.startAt)} {fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</div>
            <div>{c.employee}: {appointment.employee?.name}</div>
            <div>{c.service}: {appointment.service?.name}</div>
            <div>{c.amount}: {moneyOf(appointment) === 0 ? c.freeService : fmtPrice(moneyOf(appointment))}</div>
          </div>
        ))}
      </div>

      {ticket && (
        <div className="print-ticket-card secretary-late-ticket" dir="rtl">
          <div className="print-ticket-logo">
            <img src={ticket.business?.logoUrl || "/oh-tech-logo.jpg"} alt={ticket.business?.name || "O&H Tech"} />
          </div>
          <div className="print-ticket-business">{ticket.business?.name}</div>
          <div className="print-ticket-name">{ticket.customerName}</div>
          <div className="print-ticket-label">{c.lateEntry}</div>
          <div className="print-ticket-number">{ticket.queueNumber}</div>
          <div className="print-ticket-priority">{ticket.note || c.priority}</div>
          <div className="print-ticket-details">
            <div>{ticket.service} - {ticket.employee}</div>
            <div>{fmtDate(ticket.startAt)} | {fmtTime(ticket.startAt)} - {fmtTime(ticket.endAt)}</div>
            <div>{c.bookingNumber}: #{ticket.bookingNumber}</div>
          </div>
        </div>
      )}
    </div>
  );
}


