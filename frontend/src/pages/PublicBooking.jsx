import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { setFavicon } from "../favicon.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button, Field, Input, Spinner, EmptyState, fmtPrice, fmtDate } from "../components/ui.jsx";
import { BookingConfirmation } from "../components/BookingConfirmation.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function PublicBooking() {
  const { slug } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState(null);
  const [closedNotice, setClosedNotice] = useState(null);
  const [slot, setSlot] = useState(null);
  const [customer, setCustomer] = useState({ customerName: "", customerPhone: "", customerEmail: "" });
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState(null);
  const [done, setDone] = useState(null);

  const steps = [t("bookingStepService"), t("bookingStepEmployee"), t("bookingStepDateTime"), t("bookingStepDetails")];

  const openDayText = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return `${t(dayKeys[d.getDay()])} ${fmtDate(d)}`;
  };

  useEffect(() => {
    publicApi.business(slug).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    if (data?.business) setFavicon(data.business.logoUrl || "/favicon.svg");
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const methods = [];
    if (data.business.onlinePaymentEnabled) methods.push("ONLINE");
    if (data.business.payAtStoreEnabled) methods.push("PAY_AT_STORE");
    if (methods.length === 1) setPaymentMethod(methods[0]);
  }, [data]);

  useEffect(() => {
    if (step !== 2 || !service) return;
    setSlots(null);
    setSlot(null);
    setClosedNotice(null);
    publicApi
      .availability(slug, { serviceId: service.id, employeeId: employee?.id || undefined, date })
      .then((r) => {
        setSlots(r.slots || []);
        setClosedNotice(r.closed || null);
      })
      .catch(() => {
        setSlots([]);
        setClosedNotice(null);
      });
  }, [step, service, employee, date, slug]);

  useEffect(() => {
    if (!done?.id || done.status !== "PENDING") return;
    const timer = setInterval(() => {
      publicApi.appointmentStatus(done.id)
        .then((r) => setDone((current) => current?.id === done.id ? { ...current, ...r.appointment } : current))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [done?.id, done?.status]);

  if (error) {
    return (
      <CenterCard>
        <EmptyState title={t("bookingPageUnavailable")} hint={error} />
      </CenterCard>
    );
  }
  if (!data) return <Spinner page />;

  const { business, services, employees } = data;
  const brandStyle = {
    "--primary": business.brandColor || "#064e3b",
    "--primary-hover": business.brandColor || "#022c22",
    "--gradient": `linear-gradient(135deg, ${business.brandColor || "#064e3b"} 0%, #022c22 100%)`,
  };
  const eligibleEmployees = service ? employees.filter((item) => item.serviceIds.includes(service.id)) : [];
  const isServiceFree = Number(service?.price ?? 0) === 0;
  const methods = [];
  if (business.onlinePaymentEnabled) methods.push("ONLINE");
  if (business.payAtStoreEnabled) methods.push("PAY_AT_STORE");

  const confirm = async () => {
    setBooking(true);
    setBookErr(null);
    try {
      const res = await publicApi.book(slug, {
        serviceId: service.id,
        employeeId: employee?.id || undefined,
        startAt: slot.startAt,
        paymentMethod: isServiceFree ? "PAY_AT_STORE" : paymentMethod,
        ...customer,
      });
      if (res.requiresPayment && res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }
      setDone({ ...res.appointment, business: data.business.name });
    } catch (err) {
      setBookErr(err.message);
    } finally {
      setBooking(false);
    }
  };

  const resetBooking = () => {
    setDone(null);
    setStep(0);
    setService(null);
    setEmployee(null);
    setSlot(null);
    setCustomer({ customerName: "", customerPhone: "", customerEmail: "" });
    const online = data.business.onlinePaymentEnabled;
    const store = data.business.payAtStoreEnabled;
    setPaymentMethod(online && store ? null : online ? "ONLINE" : "PAY_AT_STORE");
  };

  if (done) {
    const isRejected = done.status === "CANCELLED";
    const isPending = done.status === "PENDING";
    return (
      <BookingShell business={business} brandStyle={brandStyle}>
        <div className="card card-pad success-screen">
          <div className="success-circle">{isRejected ? "!" : isPending ? "..." : "✓"}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>
            {isRejected ? t("bookingRejectedTitle") : isPending ? t("bookingPendingTitle") : t("bookingConfirmedTitle")}
          </h2>
          <p className="muted mt-1">
            {isRejected ? t("bookingRejectedText") : isPending ? t("bookingPendingText") : t("bookingConfirmedText")}
          </p>
          <div className="mt-3">
            <BookingConfirmation
              data={{
                bookingNumber: done.id,
                business: done.business,
                service: done.service,
                employee: done.employee,
                startAt: done.startAt,
                endAt: done.endAt,
                amount: done.paymentAmount,
                paymentMethod: done.paymentMethod,
                paymentStatus: done.paymentStatus,
              }}
            />
          </div>
          <Button className="mt-3" onClick={resetBooking}>{t("bookAnother")}</Button>
        </div>
      </BookingShell>
    );
  }

  return (
    <BookingShell business={business} brandStyle={brandStyle}>
      <div className="stepper">
        {steps.map((label, index) => (
          <div key={label} className={`step-pill ${index === step ? "active" : index < step ? "done" : ""}`}>
            <span className="step-num">{index < step ? "✓" : index + 1}</span> {label}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        {step === 0 && (
          <Section title={t("chooseService")}>
            {services.length ? (
              <div className="option-grid">
                {services.map((item) => (
                  <div
                    key={item.id}
                    className={`option-card ${service?.id === item.id ? "selected" : ""}`}
                    onClick={() => {
                      setService(item);
                      setEmployee(null);
                      setStep(1);
                    }}
                  >
                    <div className="option-title">{item.name}</div>
                    {item.description && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{item.description}</div>}
                    <div className="option-meta">
                      <span>{item.durationMinutes} {t("دقائق")}</span>
                      <span>{Number(item.price || 0) === 0 ? t("freeService") : fmtPrice(item.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title={t("noServicesAvailable")} />
            )}
          </Section>
        )}

        {step === 1 && (
          <Section title={t("chooseEmployee")} onBack={() => setStep(0)} t={t}>
            <div className="option-grid">
              <div className={`option-card ${employee === null ? "selected" : ""}`} onClick={() => { setEmployee(null); setStep(2); }}>
                <div className="option-title">{t("anyAvailableEmployee")}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("autoChooseEmployee")}</div>
              </div>
              {eligibleEmployees.map((item) => (
                <div key={item.id} className={`option-card ${employee?.id === item.id ? "selected" : ""}`} onClick={() => { setEmployee(item); setStep(2); }}>
                  <div className="option-title">{item.name}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{item.title || t("employee")}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section title={t("chooseDateTime")} onBack={() => setStep(1)} t={t}>
            <Field label={t("date")}>
              <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 240 }} />
            </Field>
            <div className="mt-3">
              {slots === null ? <Spinner /> : slots.length ? (
                <div className="slots-grid">
                  {slots.map((item) => (
                    <button key={item.startAt} className={`slot ${slot?.startAt === item.startAt ? "selected" : ""}`} onClick={() => setSlot(item)}>
                      {item.time}
                    </button>
                  ))}
                </div>
              ) : closedNotice ? (
                <EmptyState
                  title={t("closedTodayTitle")}
                  hint={closedNotice.nextOpenDate ? `${t("nextOpenPrefix")} ${openDayText(closedNotice.nextOpenDate)}` : `${t("nextOpenPrefix")} ${t("nearestWorkingDay")}`}
                />
              ) : (
                <EmptyState title={t("allSlotsBooked")} hint={t("tryAnotherDayOrEmployee")} />
              )}
            </div>
            {slot && (
              <div className="mt-3">
                <Button size="lg" block onClick={() => setStep(3)}>
                  {t("continue")} - {slot.time}{employee ? "" : ` (${slot.employeeName})`}
                </Button>
              </div>
            )}
          </Section>
        )}

        {step === 3 && (
          <Section title={t("enterYourDetails")} onBack={() => setStep(2)} t={t}>
            <div className="card card-pad" style={{ background: "var(--primary-soft)", borderColor: "transparent", marginBottom: 18 }}>
              <div className="row-between" style={{ fontSize: 14 }}>
                <span>{service.name} - {employee?.name || slot.employeeName}</span>
                <span style={{ fontWeight: 700 }}>{fmtDate(slot.startAt)} - {slot.time}</span>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); confirm(); }} className="col" style={{ gap: 16 }}>
              <Field label={t("fullName")}>
                <Input value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} required />
              </Field>
              <Field label={t("phoneNumber")}>
                <Input type="tel" value={customer.customerPhone} onChange={(e) => setCustomer({ ...customer, customerPhone: e.target.value })} required placeholder="05xxxxxxxx" />
              </Field>
              <Field label={t("optionalEmail")}>
                <Input type="email" value={customer.customerEmail} onChange={(e) => setCustomer({ ...customer, customerEmail: e.target.value })} />
              </Field>

              {isServiceFree ? (
                <Notice tone="success">{t("freeServicePaymentHint")}</Notice>
              ) : methods.length === 0 ? (
                <Notice tone="danger">{t("bookingUnavailableNoPayment")}</Notice>
              ) : (
                <Field label={t("paymentMethod")}>
                  <div className="option-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    {methods.map((method) => (
                      <div key={method} className={`option-card ${paymentMethod === method ? "selected" : ""}`} onClick={() => setPaymentMethod(method)} style={{ padding: 14 }}>
                        <div className="option-title">{method === "ONLINE" ? t("onlinePayment") : t("payAtStore")}</div>
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                          {method === "ONLINE" ? t("payOnlineHint") : t("payAtStoreHint")}
                        </div>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              {bookErr && <Notice tone="danger">{bookErr}</Notice>}

              <Button type="submit" size="lg" block loading={booking} disabled={!isServiceFree && (methods.length === 0 || !paymentMethod)}>
                {isServiceFree ? t("confirmFreeBooking") : paymentMethod === "ONLINE" ? `${t("continueToPayment")} - ${fmtPrice(service.price)}` : t("confirmBooking")}
              </Button>
            </form>
          </Section>
        )}
      </div>

      <p className="text-center muted mt-3" style={{ fontSize: 13 }}>{t("poweredByBooking")}</p>
    </BookingShell>
  );
}

function BookingShell({ business, brandStyle, children }) {
  const { t } = useLanguage();
  return (
    <div className="booking-page" style={brandStyle}>
      <div className="booking-language">
        <LanguageSwitcher />
      </div>
      <div className="booking-hero">
        {business.logoUrl && <img className="booking-logo" src={business.logoUrl} alt={business.name} />}
        <h1>{business.name}</h1>
        <p>{business.address || t("bookEasily")}</p>
      </div>
      <div className="booking-container">{children}</div>
    </div>
  );
}

function Section({ title, onBack, t, children }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 18 }}>
        {onBack && <button className="icon-btn" onClick={onBack} title={t?.("back")} aria-label={t?.("back")}>→</button>}
        <h3 className="card-title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Notice({ tone, children }) {
  const styles = {
    success: { background: "var(--success-soft)", color: "var(--success)" },
    danger: { background: "var(--danger-soft)", color: "var(--danger)" },
  }[tone];
  return (
    <div className="card" style={{ ...styles, borderColor: "transparent", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>
      {children}
    </div>
  );
}

function CenterCard({ children }) {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 20 }}>
      <div className="card card-pad" style={{ maxWidth: 420, width: "100%" }}>{children}</div>
    </div>
  );
}
