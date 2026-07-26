import { useEffect, useState, useCallback } from "react";
import { staffApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Button, Select, Spinner, Badge, EmptyState, fmtDate, fmtTime, fmtPrice, STATUS_META } from "../components/ui.jsx";
import { buildReviewUrl, buildReviewWhatsappUrl } from "../reviewLinks.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const STAFF_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const SECRETARY_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isToday(appointment) {
  return new Date(appointment.startAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function StaffDashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const { t, weekdayName } = useLanguage();
  const isSecretaryUser = user?.staffRole === "SECRETARY";
  const manualApproval = user?.business?.requiresAppointmentApproval !== false;
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [range, setRange] = useState("today");

  useEffect(() => {
    if (!isSecretaryUser) return;
    staffApi.employees()
      .then((res) => setEmployees(res.employees || []))
      .catch(() => setEmployees([]));
  }, [isSecretaryUser]);

  const load = useCallback(() => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let params = {};
    if (range === "today") params = { from: iso(today), to: iso(today) };
    else if (range === "week") {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      params = { from: iso(today), to: iso(end) };
    }
    if (isSecretaryUser && manualApproval) params.includePending = "true";
    if (isSecretaryUser && employeeId) params.employeeId = employeeId;
    setData(null);
    staffApi.appointments(params).then(setData).catch((err) => {
      toast.error(err.message);
      setData({ employee: null, appointments: [] });
    });
  }, [range, employeeId, isSecretaryUser, manualApproval, toast]);

  useEffect(() => { load(); }, [load]);

  const isSecretary = data?.employee?.role === "SECRETARY" || isSecretaryUser;
  const allowedStatuses = isSecretary ? SECRETARY_STATUSES : STAFF_STATUSES;
  const visibleAppointments = (data?.appointments || []).filter((appointment) => {
    if (!isSecretary) return true;
    return (manualApproval && appointment.status === "PENDING") || new Date(appointment.startAt) >= new Date();
  });
  const todayAppointments = visibleAppointments.filter(isToday);

  const setStatus = async (id, status, message) => {
    const finalMessage = message || t("sd.statusUpdated");
    try {
      await staffApi.updateStatus(id, status);
      toast.success(finalMessage);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sendReviewLink = async (appointment) => {
    try {
      const result = await staffApi.createReviewLink(appointment.id);
      const url = buildReviewUrl(result.path || result.token);
      window.open(buildReviewWhatsappUrl(appointment.customerPhone, url, appointment.customerName), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const printToday = () => {
    if (!todayAppointments.length) {
      toast.error(t("sd.noTodayToPrint"));
      return;
    }
    window.print();
  };

  const formatAppointmentDate = (appointment) => {
    const start = new Date(appointment.startAt);
    return `${weekdayName(start, "long")} ${fmtDate(appointment.startAt)} ${t("sd.from")} ${fmtTime(appointment.startAt)} ${t("sd.until")} ${fmtTime(appointment.endAt)}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("sd.title")}{data?.employee ? ` - ${data.employee.name}` : ""}</div>
          <div className="page-sub">
            {isSecretary
              ? manualApproval
                ? t("sd.subApproval")
                : t("sd.subAuto")
              : t("sd.subOwn")}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={printToday}>{t("sd.printToday")}</Button>
          <div className="row" style={{ gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
            {[["today", t("sd.today")], ["week", t("sd.week")], ["all", t("sd.all")]].map(([k, l]) => (
              <button key={k} className={`btn btn-sm ${range === k ? "btn-primary" : "btn-ghost"}`} style={range === k ? {} : { border: "none", background: "transparent" }} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {isSecretary && (
        <div className="card card-pad mt-2">
          <div className="row wrap" style={{ gap: 10 }}>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ maxWidth: 280 }}>
              <option value="">{t("sd.allStaff")}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </Select>
            <Button variant="ghost" onClick={load}>{t("sd.refresh")}</Button>
          </div>
        </div>
      )}

      <div className="card mt-3">
        {!data ? <Spinner page /> : visibleAppointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  {isSecretary && <th>{t("employee")}</th>}
                  <th>{t("sd.appointment")}</th>
                  <th>{t("status")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppointments.map((a) => {
                  const amount = amountOf(a);
                  const isPending = a.status === "PENDING";
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.customerName}<div className="soft" style={{ fontSize: 12 }}>{a.customerPhone}</div></td>
                      <td>{a.service?.name}<div className="soft" style={{ fontSize: 12 }}>{amount === 0 ? t("sd.free") : fmtPrice(amount)}</div></td>
                      {isSecretary && <td>{a.employee?.name || "-"}</td>}
                      <td>{fmtDate(a.startAt)}<div className="soft" style={{ fontSize: 12 }}>{fmtTime(a.startAt)}</div></td>
                      <td>
                        <div className="row wrap" style={{ gap: 8 }}>
                          <Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge>
                          {isSecretary && manualApproval && isPending && (
                            <>
                              <Button size="sm" onClick={() => setStatus(a.id, "CONFIRMED", t("sd.accepted"))}>{t("accept")}</Button>
                              <Button size="sm" variant="danger" onClick={() => setStatus(a.id, "CANCELLED", t("sd.rejected"))}>{t("reject")}</Button>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        {a.status === "COMPLETED" && user?.business?.reviewsEnabled && !a.review ? (
                          <Button size="sm" onClick={() => sendReviewLink(a)}>{t("sd.sendReview")}</Button>
                        ) : a.paymentStatus === "PAID" || a.status === "COMPLETED" ? (
                          <Badge tone="success">{t("sd.customerAttended")}</Badge>
                        ) : isSecretary && manualApproval && isPending ? (
                          <span className="soft" style={{ fontSize: 13 }}>{t("sd.awaitingSecretary")}</span>
                        ) : (
                          <Select value={allowedStatuses.includes(a.status) ? a.status : ""} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
                            <option value="" disabled>{t("sd.chooseStatus")}</option>
                            {allowedStatuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </Select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="" title={t("sd.noAppointments")} hint={t("sd.noAppointmentsHint")} />
        )}
      </div>

      <div className="appointments-print-page" dir="rtl">
        <h1>{t("sd.todaySchedule")}</h1>
        {todayAppointments.map((a) => (
          <div key={a.id} className="print-appointment">
            <div className="print-customer"><strong>{a.customerName}</strong><span>{a.customerPhone}</span></div>
            <div>{t("sd.bookingTime")}: {formatAppointmentDate(a)}</div>
            {isSecretary && <div>{t("employee")}: {a.employee?.name || "-"}</div>}
            <div>{t("sd.bookingType")}: {a.service?.name || "-"}</div>
            <div>{t("sd.amount")}: {amountOf(a) === 0 ? t("sd.freeService") : fmtPrice(amountOf(a))}</div>
          </div>
        ))}
      </div>
    </>
  );
}
