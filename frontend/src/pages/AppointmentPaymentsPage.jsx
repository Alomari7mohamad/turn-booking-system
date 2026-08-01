import { useCallback, useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  fmtDate,
  fmtPrice,
  fmtTime,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
} from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Modal } from "../components/Modal.jsx";

function todayRange() {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
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
  const [filters, setFilters] = useState({ employeeId: "", paymentStatus: "" });
  const [savingId, setSavingId] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [balanceUsedAmount, setBalanceUsedAmount] = useState("0");
  const [useCustomerBalance, setUseCustomerBalance] = useState(false);

  const load = useCallback((silent = false) => {
    const params = { ...todayRange() };
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

  const openPayment = (appointment) => {
    const due = paymentAmount(appointment);
    setPaymentTarget(appointment);
    setReceivedAmount(String(due));
    setBalanceUsedAmount("0");
    setUseCustomerBalance(false);
  };

  const changePayment = async (event) => {
    event.preventDefault();
    if (!paymentTarget) return;
    const cashReceived = Number(receivedAmount || 0);
    const balanceUsed = Number(balanceUsedAmount);
    const availableBalance = Math.max(0, Number(paymentTarget.customerBalance || 0));
    const due = paymentAmount(paymentTarget);
    const maximumBalanceUse = Math.min(availableBalance, due);
    if (!Number.isFinite(cashReceived) || cashReceived < 0) {
      toast.error(t("appPay.invalidReceivedAmount"));
      return;
    }
    if (!Number.isFinite(balanceUsed) || balanceUsed < 0 || balanceUsed > maximumBalanceUse) {
      toast.error(t("appPay.invalidBalanceUsed"));
      return;
    }
    if (useCustomerBalance && balanceUsed >= due && cashReceived !== 0) {
      toast.error(t("appPay.invalidReceivedAmount"));
      return;
    }
    const totalCovered = cashReceived + balanceUsed;
    const appointment = paymentTarget;
    setSavingId(appointment.id);
    try {
      await api.updateAppointmentPayment(appointment.id, "PAID", totalCovered, balanceUsed);
      toast.success(t("appPay.paymentUpdated"));
      setPaymentTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const changeUseCustomerBalance = (event) => {
    if (!paymentTarget) return;
    const enabled = event.target.checked;
    const due = paymentAmount(paymentTarget);
    const availableBalance = Math.max(0, Number(paymentTarget.customerBalance || 0));
    const automaticBalanceUse = enabled ? Math.min(availableBalance, due) : 0;
    setUseCustomerBalance(enabled);
    setBalanceUsedAmount(String(automaticBalanceUse));
    if (!enabled) {
      setReceivedAmount(String(due));
      return;
    }
    const remaining = Math.max(0, due - automaticBalanceUse);
    setReceivedAmount(String(remaining));
  };

  const changeReceivedAmount = (event) => {
    const value = event.target.value;
    if (value === "") {
      setReceivedAmount("");
      return;
    }
    const requested = Number(value);
    if (!Number.isFinite(requested)) {
      setReceivedAmount("0");
      return;
    }
    setReceivedAmount(String(Math.max(0, Math.min(1_000_000, requested))));
  };

  const rows = (appointments || []).filter((appointment) => ["CONFIRMED", "COMPLETED"].includes(appointment.status));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{t("navAppointmentPayments")}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="payment-page-filters">
          <div className="appointments-filter-select">
            <Select value={filters.employeeId} onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value }))}>
              <option value="">{t("sd.allStaff")}</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
          </div>
          <div className="appointments-filter-select">
            <Select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}>
              <option value="">{t("ap.allPayStatuses")}</option>
              {Object.entries(PAYMENT_STATUS_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <section className="appointment-payments-results">
        {!appointments ? <Spinner page /> : rows.length ? (
          <div className="appointment-payments-grid">
            {rows.map((appointment) => {
              const amount = paymentAmount(appointment);
              const isFree = amount === 0;
              const isPaid = appointment.paymentStatus === "PAID";
              const canChange = !isFree && !isPaid && appointment.paymentMethod === "PAY_AT_STORE";
              return (
                <article className="appointment-payment-card" key={appointment.id}>
                  <header className={`appointment-payment-head${isPaid ? " is-settled" : ""}`}>
                    <div className="appointment-payment-customer">
                      <div>
                        <strong>{appointment.customerName}</strong>
                        <span>{appointment.service?.name || "-"}</span>
                      </div>
                      <a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a>
                    </div>
                    {!isPaid && (
                      <div className="appointment-payment-head-action">
                        {isFree ? (
                          <span className="soft">{t("appPay.noPayment")}</span>
                        ) : canChange ? (
                          <Button size="sm" loading={savingId === appointment.id} onClick={() => openPayment(appointment)}>{t("appPay.receivePayment")}</Button>
                        ) : appointment.paymentMethod === "ONLINE" ? (
                          <span className="soft">{t("appPay.viaGateway")}</span>
                        ) : (
                          <span className="soft">{t("appPay.notEditable")}</span>
                        )}
                      </div>
                    )}
                  </header>

                  <div className="appointment-payment-details">
                    <div>
                      <span>{t("employee")}</span>
                      <strong>{appointment.employee?.name || "-"}</strong>
                    </div>
                    <div>
                      <span>{t("sd.appointment")}</span>
                      <strong>{fmtDate(appointment.startAt)}</strong>
                      <small>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</small>
                    </div>
                    <div>
                      <span>{t("sd.amount")}</span>
                      <strong>{isFree ? t("bc.freeService") : fmtPrice(amount)}</strong>
                      <small>{isFree ? "-" : (PAYMENT_METHOD_META[appointment.paymentMethod]?.label || "-")}</small>
                    </div>
                  </div>

                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("appPay.noBookings")} hint={t("appPay.noBookingsHint")} />
        )}
      </section>

      <Modal
        open={!!paymentTarget}
        onClose={() => !savingId && setPaymentTarget(null)}
        title={t("appPay.receivePayment")}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setPaymentTarget(null)} disabled={!!savingId}>{t("cancel")}</Button>
            <Button type="submit" form="receive-payment-form" loading={!!savingId}>{t("appPay.confirmPayment")}</Button>
          </>
        )}
      >
        {paymentTarget && (
          <form id="receive-payment-form" className="receive-payment-form" onSubmit={changePayment}>
            {(() => {
              const due = paymentAmount(paymentTarget);
              const availableBalance = Math.max(0, Number(paymentTarget.customerBalance || 0));
              const balanceUsed = Number(balanceUsedAmount || 0);
              const cashReceived = Math.max(0, Number(receivedAmount || 0));
              const balanceCoversDue = useCustomerBalance && balanceUsed >= due;
              const balanceAfterPayment = availableBalance + cashReceived - due;
              return (
                <>
            <div className="receive-payment-summary">
              <div><span>{t("appPay.dueAmount")}</span><strong>{fmtPrice(due)}</strong></div>
              <div><span>{t("appPay.currentBalance")}</span><strong>{fmtPrice(paymentTarget.customerBalance || 0)}</strong></div>
            </div>
            <label className={`receive-payment-balance-toggle${useCustomerBalance ? " is-active" : ""}${availableBalance <= 0 ? " is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={useCustomerBalance}
                disabled={availableBalance <= 0}
                onChange={changeUseCustomerBalance}
              />
              <span>{t("appPay.balanceUsedAmount")}</span>
              <strong>{fmtPrice(balanceUsed)}</strong>
            </label>
            <Field label={t("appPay.cashReceivedAmount")}>
              <Input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                autoFocus={!balanceCoversDue}
                disabled={balanceCoversDue}
                value={receivedAmount}
                onChange={changeReceivedAmount}
              />
            </Field>
            <div className="receive-payment-breakdown">
              <span>{t("appPay.cashReceivedAmount")}</span>
              <strong>{fmtPrice(cashReceived)}</strong>
            </div>
            <div className={`receive-payment-result ${balanceAfterPayment < 0 ? "is-debt" : "is-credit"}`}>
              <span>{t("appPay.balanceAfterPayment")}</span>
              <strong>{fmtPrice(balanceAfterPayment)}</strong>
            </div>
                </>
              );
            })()}
          </form>
        )}
      </Modal>
    </div>
  );
}
