import { useCallback, useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
  Spinner,
  fmtDate,
  fmtPrice,
  fmtTime,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  STATUS_META,
} from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { from: today, to: today };
}

function paymentAmount(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

export default function AppointmentPaymentsPage() {
  const { api } = useBusinessManage();
  const toast = useToast();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ ...todayRange(), employeeId: "", paymentStatus: "" });
  const [savingId, setSavingId] = useState(null);

  const load = useCallback((silent = false) => {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
    if (!silent) setAppointments(null);
    api.listAppointments(params).then((res) => setAppointments(res.appointments || [])).catch((err) => {
      toast.error(err.message);
      setAppointments([]);
    });
  }, [api, filters, toast]);

  useEffect(() => {
    api.listEmployees().then((res) => setEmployees(res.employees || [])).catch(() => setEmployees([]));
  }, [api]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const changePayment = async (appointment, nextStatus) => {
    setSavingId(appointment.id);
    try {
      await api.updateAppointmentPayment(appointment.id, nextStatus);
      toast.success(t("appPay.paymentUpdated"));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const rows = (appointments || []).filter((appointment) => !["CANCELLED", "NO_SHOW"].includes(appointment.status));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{t("navAppointmentPayments")}</div>
          <div className="page-sub">{t("appPay.sub")}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap appointments-filters payment-filters" style={{ gap: 10 }}>
          <div className="payment-date-inputs">
            <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
            <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 180 }}>
            <Select value={filters.employeeId} onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value }))}>
              <option value="">{t("sd.allStaff")}</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 160 }}>
            <Select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}>
              <option value="">{t("ap.allPayStatuses")}</option>
              {Object.entries(PAYMENT_STATUS_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </div>
          <Button variant="ghost" onClick={() => setFilters({ ...todayRange(), employeeId: "", paymentStatus: "" })}>{t("sd.today")}</Button>
        </div>
      </div>

      <div className="card">
        {!appointments ? <Spinner page /> : rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  <th>{t("employee")}</th>
                  <th>{t("sd.appointment")}</th>
                  <th>{t("appPay.bookingStatus")}</th>
                  <th>{t("sd.amount")}</th>
                  <th>{t("paymentMethod")}</th>
                  <th>{t("bc.paymentStatus")}</th>
                  <th>{t("appPay.payAction")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((appointment) => {
                  const amount = paymentAmount(appointment);
                  const isFree = amount === 0;
                  const isPaid = appointment.paymentStatus === "PAID";
                  const canChange = !isFree && !isPaid && appointment.paymentMethod === "PAY_AT_STORE";
                  return (
                    <tr key={appointment.id}>
                      <td style={{ fontWeight: 800 }}>
                        {appointment.customerName}
                        <div className="soft" style={{ fontSize: 12 }}>{appointment.customerPhone}</div>
                      </td>
                      <td>{appointment.service?.name || "-"}</td>
                      <td>{appointment.employee?.name || "-"}</td>
                      <td>
                        {fmtDate(appointment.startAt)}
                        <div className="soft" style={{ fontSize: 12 }}>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</div>
                      </td>
                      <td><Badge tone={STATUS_META[appointment.status]?.tone}>{STATUS_META[appointment.status]?.label || appointment.status}</Badge></td>
                      <td>{isFree ? <Badge tone="success">{t("bc.freeService")}</Badge> : fmtPrice(amount)}</td>
                      <td>{isFree ? "-" : (PAYMENT_METHOD_META[appointment.paymentMethod]?.label || "-")}</td>
                      <td><Badge tone={PAYMENT_STATUS_META[appointment.paymentStatus]?.tone}>{isFree ? t("bc.freeService") : PAYMENT_STATUS_META[appointment.paymentStatus]?.label}</Badge></td>
                      <td>
                        {isFree ? (
                          <span className="soft">{t("appPay.noPayment")}</span>
                        ) : canChange ? (
                          <Button size="sm" loading={savingId === appointment.id} onClick={() => changePayment(appointment, "PAID")}>{t("appPay.receivePayment")}</Button>
                        ) : isPaid ? (
                          <Badge tone="success">{t("payStatusPaid")}</Badge>
                        ) : appointment.paymentMethod === "ONLINE" ? (
                          <span className="soft">{t("appPay.viaGateway")}</span>
                        ) : (
                          <span className="soft">{t("appPay.notEditable")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("appPay.noBookings")} hint={t("appPay.noBookingsHint")} />
        )}
      </div>
    </div>
  );
}
