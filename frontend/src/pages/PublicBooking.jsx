import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useRef } from "react";
import { publicApi } from "../api/endpoints.js";
import { setFavicon } from "../favicon.js";
import { AppFooter } from "../components/AppFooter.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, fmtDate, fmtPrice, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { applyBrandTheme, buildBrandThemeVars, resetBrandTheme } from "../brandTheme.js";

function dateInputFrom(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInput() {
  return dateInputFrom(new Date());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildWazeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/waze\.com|ul\.waze\.com/i.test(raw)) return raw;
  return `https://waze.com/ul?q=${encodeURIComponent(raw)}&navigate=yes`;
}

function buildWhatsappUrl(value, message) {
  const raw = String(value || "").replace(/\D/g, "");
  if (!raw) return null;
  const phone = raw.startsWith("972") ? raw : raw.startsWith("0") ? `972${raw.slice(1)}` : raw;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message || "")}`;
}

function calendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, index) => addDays(start, index));
}

function isPastDate(dateStr) {
  return dateStr < todayInput();
}

function serviceIcon(name = "") {
  if (/شعر|قص/i.test(name)) return "قص";
  if (/حلاق|حلاقة/i.test(name)) return "حلق";
  if (/تنظيف|بشرة/i.test(name)) return "بشرة";
  if (/صبغ|صبغة/i.test(name)) return "صبغ";
  return "+";
}

function normalizeLocalPhoneInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function validLocalPhone(value) {
  return /^05\d{8}$/.test(String(value || ""));
}

function RatingLine({ value, count, compact = false }) {
  const { t } = useLanguage();
  if (!value) return null;
  return (
    <div className={compact ? "booking-rating-line compact" : "booking-rating-line"}>
      <span aria-hidden="true">★★★★★</span>
      <strong>{value}</strong>
      {count ? <small>({count} {t("pb.reviewsWord")})</small> : null}
    </div>
  );
}

export default function PublicBooking() {
  const { slug } = useParams();
  const { t, monthName } = useLanguage();
  const dayKeys = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [devCode, setDevCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [session, setSession] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsView, setAppointmentsView] = useState("upcoming");
  const [activeTab, setActiveTab] = useState("home");
  const [step, setStep] = useState("service");
  const [service, setService] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInput());
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [monthStatus, setMonthStatus] = useState({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", dateOfBirth: "" });
  const [booking, setBooking] = useState(false);
  const bookingRequestRef = useRef(false);
  const [bookErr, setBookErr] = useState("");
  const [success, setSuccess] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    publicApi.business(slug).then(setData).catch((err) => setError(err.message));
  }, [slug]);

  useEffect(() => {
    if (data?.business) setFavicon(data.business.logoUrl || "/oh-tech-logo.jpg");
  }, [data]);

  useEffect(() => {
    if (!data?.business) return undefined;
    applyBrandTheme(data.business.brandColor);
    return () => resetBrandTheme();
  }, [data?.business?.brandColor]);

  useEffect(() => {
    document.documentElement.classList.add("public-booking-page");
    document.documentElement.classList.toggle("public-booking-authenticated", Boolean(session?.token));
    return () => {
      document.documentElement.classList.remove("public-booking-page", "public-booking-authenticated");
    };
  }, [session?.token]);

  const business = data?.business;
  const services = data?.services || [];
  const employees = data?.employees || [];
  const brandStyle = buildBrandThemeVars(business?.brandColor);
  const hasLoginImage = Boolean(business?.bookingHeroImageUrl);
  const loginCardStyle = hasLoginImage ? { "--booking-card-bg": `url("${business.bookingHeroImageUrl}")` } : undefined;
  const wazeUrl = buildWazeUrl(business?.mapUrl || business?.address);
  const whatsappUrl = buildWhatsappUrl(business?.phone, t("pb.whatsappHelp"));
  const serviceEmployees = service ? employees.filter((item) => item.serviceIds.includes(service.id)) : [];
  const methods = useMemo(() => {
    const result = [];
    if (business?.onlinePaymentEnabled) result.push("ONLINE");
    if (business?.payAtStoreEnabled) result.push("PAY_AT_STORE");
    return result;
  }, [business]);
  const upcomingAppointments = useMemo(() => appointments
    .filter((appointment) => ["PENDING", "CONFIRMED"].includes(appointment.status) && new Date(appointment.startAt) > new Date())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)), [appointments]);
  const previousAppointments = useMemo(() => appointments
    .filter((appointment) => !(["PENDING", "CONFIRMED"].includes(appointment.status) && new Date(appointment.startAt) > new Date()))
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)), [appointments]);
  const nextConfirmedAppointment = upcomingAppointments.find((appointment) => appointment.status === "CONFIRMED") || null;
  const filteredServices = services.filter((item) => item.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()));
  const paymentMethodLabel = paymentMethod === "ONLINE" ? t("pb.payOnline") : paymentMethod === "PAY_AT_STORE" ? t("pb.payAtStore") : "";
  const showTimeConfirm = activeTab === "new"
    && step === "time"
    && Boolean(selectedDate)
    && monthStatus[selectedDate] === "available"
    && Boolean(slot);

  const refreshAppointments = async (targetPhone = session?.phone, targetToken = session?.token) => {
    if (!targetPhone) return;
    const res = await publicApi.findAppointmentByPhone(slug, targetPhone, true, targetToken);
    setAppointments(res.appointments || []);
    if (res.customer) {
      setSession((current) => current ? {
        ...current,
        name: res.customer.name || current.name,
        balance: Number(res.customer.balance || 0),
      } : current);
      setCustomerForm((current) => ({
        ...current,
        name: res.customer.name || current.name,
        email: res.customer.email || current.email,
        dateOfBirth: res.customer.dateOfBirth || current.dateOfBirth,
      }));
    }
  };

  useEffect(() => {
    if (!session?.phone) return undefined;
    const refresh = () => {
      if (!document.hidden) refreshAppointments(session.phone).catch(() => {});
    };
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [session?.phone, session?.token, slug]);

  useEffect(() => {
    if (!appointmentToCancel) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !cancelingId) {
        setAppointmentToCancel(null);
        setCancelError("");
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [appointmentToCancel, cancelingId]);

  const sendCode = async () => {
    if (!validLocalPhone(phone)) {
      setLoginMessage(t("pb.wrongNumber"));
      setCodeSent(false);
      setCode("");
      return;
    }
    setSendingCode(true);
    setLoginMessage("");
    setDevCode("");
    setCodeSent(false);
    setCode("");
    try {
      const res = await publicApi.sendPhoneVerification(slug, phone);
      if (res.verified && res.token) {
        const nextSession = { phone, token: res.token, name: "", email: "", balance: 0 };
        setSession(nextSession);
        setCustomerForm({ name: "", email: "", dateOfBirth: "" });
        await refreshAppointments(phone, res.token);
        return;
      }
      setLoginMessage(res.message || t("pb.codeSent"));
      setDevCode(res.devCode || "");
      setCodeSent(true);
    } catch (err) {
      setLoginMessage(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!validLocalPhone(phone)) {
      setLoginMessage(t("pb.wrongNumber"));
      setCodeSent(false);
      return;
    }
    setVerifyingCode(true);
    setLoginMessage("");
    try {
      const res = await publicApi.confirmPhoneVerification(slug, { phone, code });
      const nextSession = { phone, token: res.token, name: "", email: "", balance: 0 };
      setSession(nextSession);
      setCustomerForm({ name: "", email: "", dateOfBirth: "" });
      await refreshAppointments(phone, res.token);
    } catch (err) {
      setLoginMessage(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "new" || step !== "time" || !service) return;
    let cancelled = false;
    setSlots(null);
    setSlot(null);
    publicApi.availability(slug, {
      serviceId: service.id,
      employeeId: employee?.id || undefined,
      date: selectedDate,
      customerPhone: session?.phone,
    }, session?.token)
      .then((res) => {
        if (cancelled) return;
        const nextSlots = res.slots || [];
        setSlots(nextSlots);
        setMonthStatus((current) => ({
          ...current,
          [selectedDate]: res.closed ? "closed" : (nextSlots.length ? "available" : "unavailable"),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setMonthStatus((current) => ({ ...current, [selectedDate]: "unavailable" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, step, service, employee, selectedDate, slug, session?.phone, session?.token]);

  useEffect(() => {
    if (activeTab !== "new" || step !== "time" || !service) return;
    let cancelled = false;
    setMonthLoading(true);
    setMonthStatus({});
    setSlots(null);
    setSlot(null);
    const days = calendarDays(monthDate);

    (async () => {
      const res = await publicApi.availabilityCalendar(slug, {
        serviceId: service.id,
        employeeId: employee?.id || undefined,
        from: dateInputFrom(days[0]),
        to: dateInputFrom(days[days.length - 1]),
        customerPhone: session?.phone,
      }, session?.token);
      if (cancelled) return;
      const nextStatus = res.statuses || {};
      setMonthStatus(nextStatus);
      setSelectedDate((currentDate) => {
        if (nextStatus[currentDate] === "available") return currentDate;
        const firstAvailable = Object.entries(nextStatus).find(([dateStr, status]) => {
          const date = new Date(`${dateStr}T00:00:00`);
          return status === "available" && date.getMonth() === monthDate.getMonth();
        });
        return firstAvailable ? firstAvailable[0] : currentDate;
      });
      setMonthLoading(false);
    })().catch(() => {
      if (!cancelled) setMonthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, step, service, employee, monthDate, slug, session?.phone, session?.token]);

  useEffect(() => {
    if (methods.length === 1) setPaymentMethod(methods[0]);
    if (methods.length === 0) setPaymentMethod(null);
  }, [methods]);

  if (error) return <CenterCard><EmptyState title={t("bookingPageUnavailable")} hint={error} /></CenterCard>;
  if (!data) return <Spinner page />;

  const resetNewBooking = () => {
    setActiveTab("new");
    setStep("service");
    setService(null);
    setEmployee(null);
    setSlot(null);
    setSuccess(null);
    setBookErr("");
    setSelectedDate(todayInput());
    setMonthDate(new Date());
    setPaymentMethod(methods.length === 1 ? methods[0] : null);
  };

  const chooseService = (item) => {
    setService(item);
    setEmployee(null);
    setMonthStatus({});
    setMonthLoading(false);
    setSlots(null);
    setSlot(null);
    setPaymentMethod(methods.length === 1 ? methods[0] : null);
    setStep("employee");
  };

  const chooseEmployee = (item) => {
    setEmployee(item);
    setMonthStatus({});
    setMonthLoading(false);
    setSlots(null);
    setSlot(null);
    setStep("time");
  };

  const confirmBooking = async () => {
    if (bookingRequestRef.current) return;
    const name = (customerForm.name || session?.name || "").trim();
    if (!name) {
      setBookErr(t("pb.enterName"));
      return;
    }
    const isFree = Number(service.price || 0) === 0;
    if (!isFree && !paymentMethod) {
      setBookErr(t("pb.choosePayment"));
      return;
    }
    bookingRequestRef.current = true;
    setBooking(true);
    setBookErr("");
    try {
      const res = await publicApi.book(slug, {
        serviceId: service.id,
        employeeId: employee?.id || undefined,
        startAt: slot.startAt,
        customerName: name,
        customerPhone: session.phone,
        customerEmail: customerForm.email || session.email || "",
        customerDateOfBirth: customerForm.dateOfBirth || "",
        paymentMethod: isFree ? "PAY_AT_STORE" : paymentMethod,
        phoneVerificationToken: session.token,
      });
      if (res.requiresPayment && res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }
      const appointment = { ...res.appointment, business: business.name };
      setSuccess(appointment);
      setSession((current) => ({ ...current, name, email: customerForm.email || "", dateOfBirth: customerForm.dateOfBirth || "" }));
      setActiveTab("new");
      setStep("success");
      await refreshAppointments(session.phone);
    } catch (err) {
      if (err.status === 409) {
        setSlot(null);
        setSlots(null);
        setBookErr(t("pb.slotNoLongerAvailable"));
        try {
          const refreshed = await publicApi.availability(slug, {
            serviceId: service.id,
            employeeId: employee?.id || undefined,
            date: selectedDate,
            customerPhone: session?.phone,
          }, session?.token);
          const nextSlots = refreshed.slots || [];
          setSlots(nextSlots);
          setMonthStatus((current) => ({
            ...current,
            [selectedDate]: nextSlots.length ? "available" : "unavailable",
          }));
        } catch {
          setSlots([]);
          setMonthStatus((current) => ({ ...current, [selectedDate]: "unavailable" }));
        }
      } else {
        setBookErr(err.message);
      }
    } finally {
      bookingRequestRef.current = false;
      setBooking(false);
    }
  };

  const requestAppointmentCancellation = (appointment) => {
    setCancelError("");
    setAppointmentToCancel(appointment);
  };

  const closeCancellationDialog = () => {
    if (cancelingId) return;
    setAppointmentToCancel(null);
    setCancelError("");
  };

  const confirmAppointmentCancellation = async () => {
    if (!appointmentToCancel || cancelingId) return;
    setCancelingId(appointmentToCancel.id);
    setCancelError("");
    try {
      await publicApi.cancelAppointment(slug, appointmentToCancel.id, session.phone, session.token);
      await refreshAppointments(session.phone);
      setAppointmentToCancel(null);
    } catch (err) {
      setCancelError(err.message || t("pb.cancelFailed"));
    } finally {
      setCancelingId(null);
    }
  };

  const saveCustomerSettings = async () => {
    setSettingsMessage("");
    try {
      const res = await publicApi.updateCustomerProfile(slug, {
        phone: session.phone,
        name: customerForm.name,
        email: customerForm.email,
        dateOfBirth: customerForm.dateOfBirth,
      }, session.token);
      const customer = res.customer || {};
      setCustomerForm((current) => ({
        ...current,
        name: customer.name || current.name,
        email: customer.email || current.email,
        dateOfBirth: customer.dateOfBirth || current.dateOfBirth,
      }));
      setSession((current) => ({
        ...current,
        name: customer.name || customerForm.name,
        email: customer.email || customerForm.email,
        dateOfBirth: customer.dateOfBirth || customerForm.dateOfBirth,
        balance: Number(customer.balance ?? current.balance ?? 0),
      }));
      setSettingsMessage(t("pb.detailsSaved"));
    } catch (err) {
      setSettingsMessage(err.message);
    }
  };

  const addToCalendar = () => {
    if (!success) return;
    const start = new Date(success.startAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end = new Date(success.endAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${business.name} - ${success.service}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "appointment.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareAppointment = async () => {
    if (!success) return;
    const text = t("pb.shareText", { business: business.name, service: success.service, date: fmtDate(success.startAt), time: fmtTime(success.startAt) });
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
  };

  if (!session?.token) {
    return (
      <div className="booking-mobile-page booking-login-page" style={brandStyle}>
        <div className={`booking-login-card ${hasLoginImage ? "has-login-image" : ""}`} style={loginCardStyle}>
          <div className="booking-login-top"><LanguageSwitcher /></div>
          {!hasLoginImage && (
            <div className="booking-login-visual">
              <img src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
            </div>
          )}
          <div className="booking-login-content">
            <h1>{t("pb.welcomeTo", { name: business.name })}</h1>
            <RatingLine value={business.averageRating} count={business.reviewsCount} />
            <p>{t("pb.heroLine1")}<br />{t("pb.heroLine2")}</p>
            <div className="booking-login-form">
              <Field label={t("phoneNumber")}>
                <div className="phone-entry">
                  <Input
                    value={phone}
                    onChange={(event) => {
                      setPhone(normalizeLocalPhoneInput(event.target.value));
                      setLoginMessage("");
                      setCodeSent(false);
                      setCode("");
                    }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="05XXXXXXXX"
                  />
                </div>
              </Field>
              <Button size="lg" block loading={sendingCode} disabled={!phone} onClick={sendCode}>{t("continue")}</Button>
              {(loginMessage || devCode) && <div className="booking-login-message">{loginMessage}{devCode ? ` ${t("pb.devCode", { code: devCode })}` : ""}</div>}
              {codeSent && (
                <>
                  <Field label={t("pb.verifyCode")}>
                    <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" placeholder={t("pb.enterCode")} />
                  </Field>
                  <Button size="lg" block variant="secondary" loading={verifyingCode} disabled={!phone || !code} onClick={verifyCode}>{t("pb.confirmNumber")}</Button>
                </>
              )}
            </div>
            <div className="booking-login-inline-footer"><AppFooter /></div>
          </div>
        </div>
        {wazeUrl && <a className="waze-floating-button" href={wazeUrl} target="_blank" rel="noreferrer" aria-label="Waze"><img src="/waze.jpg" alt="" /></a>}
      </div>
    );
  }

  return (
    <div className="booking-mobile-page has-bottom-nav" style={brandStyle}>
      <div className="booking-app-shell">
        <header className="booking-app-header">
          <div>
            <span>{t("pb.greeting", { name: session.name || t("pb.guest") })}</span>
            <strong>{business.name}</strong>
            <RatingLine value={business.averageRating} count={business.reviewsCount} compact />
          </div>
          <img src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
        </header>

        {activeTab === "home" && (
          <main className="booking-app-content">
            <section className="booking-panel">
              <h3>{t("pb.yourNextAppointment")}</h3>
              {upcomingAppointments[0] ? <AppointmentCard appointment={upcomingAppointments[0]} isNext={upcomingAppointments[0].id === nextConfirmedAppointment?.id} onCancel={requestAppointmentCancellation} canceling={cancelingId === upcomingAppointments[0].id} /> : <EmptyState title={t("pb.noNextAppt")} hint={t("pb.bookFirstNow")} />}
            </section>
          </main>
        )}

        {activeTab === "appointments" && (
          <main className="booking-app-content">
            <PageTitle title={t("pb.myAppointments")} subtitle={t("pb.apptsLinkedToPhone")} />
            <div className="booking-appointments-tabs" role="tablist" aria-label={t("pb.filterAppointments")}>
              <button type="button" role="tab" aria-selected={appointmentsView === "upcoming"} className={appointmentsView === "upcoming" ? "active" : ""} onClick={() => setAppointmentsView("upcoming")}>
                {t("pb.upcomingTurns")} <span>{upcomingAppointments.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={appointmentsView === "previous"} className={appointmentsView === "previous" ? "active" : ""} onClick={() => setAppointmentsView("previous")}>
                {t("pb.previousTurns")} <span>{previousAppointments.length}</span>
              </button>
            </div>
            {(appointmentsView === "upcoming" ? upcomingAppointments : previousAppointments).length ? (appointmentsView === "upcoming" ? upcomingAppointments : previousAppointments).map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} isNext={appointment.id === nextConfirmedAppointment?.id} onCancel={requestAppointmentCancellation} canceling={cancelingId === appointment.id} />
            )) : appointmentsView === "upcoming"
              ? <EmptyState title={t("noUpcomingAppointments")} hint={t("pb.canBookNow")} />
              : <EmptyState title={t("pb.noHistory")} hint={t("pb.historyHint")} />}
          </main>
        )}

        {activeTab === "settings" && (
          <main className="booking-app-content">
            <PageTitle title={t("pb.settings")} subtitle={t("pb.settingsSub")} />
            <div className="booking-panel">
              <div className={`booking-customer-balance ${Number(session.balance || 0) < 0 ? "is-debt" : Number(session.balance || 0) > 0 ? "is-credit" : ""}`}>
                <span>{t("pb.accountBalance")}</span>
                <strong>{fmtPrice(session.balance || 0)}</strong>
                {Number(session.balance || 0) < 0 && <small>{t("pb.debtReminder")}</small>}
              </div>
              <Field label={t("pb.name")}>
                <Input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label={t("phoneNumber")}>
                <Input value={session.phone} readOnly />
              </Field>
              <Field label={t("email")}>
                <Input value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label={t("pb.dateOfBirth")}>
                <Input type="date" value={customerForm.dateOfBirth} onChange={(event) => setCustomerForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
              </Field>
              {settingsMessage && <div className="booking-login-message">{settingsMessage}</div>}
              <Button onClick={saveCustomerSettings}>{t("pb.saveDetails")}</Button>
            </div>
          </main>
        )}

        {activeTab === "new" && (
          <main className={`booking-app-content booking-flow-content ${showTimeConfirm ? "has-floating-confirm" : ""}`}>
            {step !== "success" && <BackButton onClick={() => {
              if (step === "service") setActiveTab("home");
              if (step === "employee") setStep("service");
              if (step === "time") setStep("employee");
              if (step === "details") setStep("time");
            }} />}
            {step === "service" && (
              <>
                <PageTitle title={t("chooseService")} subtitle={t("pb.chooseServiceSub")} />
                <Input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder={t("pb.searchService")} />
                <div className="booking-service-grid">
                  {filteredServices.map((item) => (
                    <button key={item.id} className="booking-service-card" onClick={() => chooseService(item)}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{serviceIcon(item.name)}</span>}
                      <strong>{item.name}</strong>
                      {item.description && <p className="booking-service-note">{item.description}</p>}
                      <small>{item.durationMinutes} {t("minutes")} - {Number(item.price || 0) === 0 ? t("pb.free") : fmtPrice(item.price)}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "employee" && (
              <>
                <PageTitle title={t("chooseEmployee")} subtitle={t("pb.chooseEmployeeSub")} />
                <button className={`booking-employee-card ${employee === null ? "selected" : ""}`} onClick={() => chooseEmployee(null)}>
                  <div><strong>{t("anyAvailableEmployee")}</strong><span>{t("pb.systemPicks")}</span></div><i />
                </button>
                {serviceEmployees.map((item) => (
                  <button key={item.id} className={`booking-employee-card ${employee?.id === item.id ? "selected" : ""}`} onClick={() => chooseEmployee(item)}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.title || t("pb.serviceProvider")}</span>
                      <RatingLine value={item.averageRating} count={item.reviewsCount} compact />
                    </div>
                    <i />
                  </button>
                ))}
              </>
            )}

            {step === "time" && (
              <>
                <PageTitle title={t("pb.chooseAppointment")} subtitle={t("pb.chooseAppointmentSub")} />
                <div className="booking-month-head">
                  <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>‹</button>
                  <strong>{monthName(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), "long")} {monthDate.getFullYear()}</strong>
                  <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>›</button>
                </div>
                {monthLoading && (
                  <div className="booking-calendar-progress"><Spinner /><span>{t("pb.checkingDays")}</span></div>
                )}
                <div className={`booking-calendar ${monthLoading ? "is-loading" : ""}`}>
                  {dayKeys.map((day) => <span key={day}>{day}</span>)}
                  {calendarDays(monthDate).map((date) => {
                    const dateStr = dateInputFrom(date);
                    const status = monthStatus[dateStr];
                    const outsideMonth = date.getMonth() !== monthDate.getMonth();
                    const disabled = outsideMonth || status !== "available";
                    const active = selectedDate === dateStr && status === "available";
                    return (
                      <button
                        key={dateStr}
                        disabled={disabled}
                        className={`${active ? "active" : ""} ${disabled ? "disabled" : ""} ${status === "unavailable" ? "unavailable" : ""} ${status === "closed" ? "closed" : ""}`}
                        onClick={() => {
                          if (status === "available") setSelectedDate(dateStr);
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
                {!monthLoading && (
                  <>
                    <h3 className="booking-section-title">{t("pb.chooseTime")}</h3>
                    {slots === null ? <Spinner /> : slots.length ? (
                      <div className="booking-slots">
                        {slots.map((item) => (
                          <button key={item.startAt} className={slot?.startAt === item.startAt ? "active" : ""} onClick={() => setSlot(item)}>
                            {item.time}
                          </button>
                        ))}
                      </div>
                    ) : <EmptyState title={t("pb.noTimes")} hint={t("pb.tryAnother")} />}
                  </>
                )}
              </>
            )}

            {step === "details" && (
              <>
                <PageTitle title={t("pb.confirmBooking")} subtitle={t("pb.confirmBookingSub")} />
                <div className="booking-panel">
                  <Field label={t("pb.name")}>
                    <Input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} required />
                  </Field>
                  <Field label={t("optionalEmail")}>
                    <Input value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
                  </Field>
                  {Number(service.price || 0) > 0 && (
                    <Field label={t("paymentMethod")}>
                      {methods.length === 1 ? (
                        <Input value={paymentMethodLabel || (methods[0] === "ONLINE" ? t("pb.payOnline") : t("pb.payAtStore"))} readOnly />
                      ) : (
                        <Select value={paymentMethod || ""} onChange={(event) => setPaymentMethod(event.target.value)}>
                          <option value="" disabled>{t("pb.choosePaymentMethod")}</option>
                          {methods.includes("PAY_AT_STORE") && <option value="PAY_AT_STORE">{t("pb.payAtStore")}</option>}
                          {methods.includes("ONLINE") && <option value="ONLINE">{t("pb.payOnline")}</option>}
                        </Select>
                      )}
                    </Field>
                  )}
                  {Number(service.price || 0) === 0 && <div className="booking-free-note">{t("pb.thisServiceFree")}</div>}
                  {bookErr && <div className="error-text">{bookErr}</div>}
                  <Button className="booking-submit-button" size="lg" block loading={booking} onClick={confirmBooking}>{t("pb.saveRequest")}</Button>
                </div>
              </>
            )}

            {step === "success" && success && (
              <SuccessView appointment={success} business={business} onCalendar={addToCalendar} onShare={shareAppointment} onHome={() => setActiveTab("home")} />
            )}
          </main>
        )}

        {showTimeConfirm && (
          <div className="booking-floating-confirm">
            <Button size="lg" block onClick={() => setStep("details")}>{t("pb.confirmAppointment")}</Button>
          </div>
        )}

        <nav className="booking-bottom-nav">
          <button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><span className="booking-nav-icon booking-home-icon" aria-hidden="true" />{t("pb.home")}</button>
          <button
            className={activeTab === "appointments" ? "active" : ""}
            aria-label={nextConfirmedAppointment ? t("pb.myApptsWithNext") : t("pb.myAppointments")}
            onClick={() => { refreshAppointments(); setAppointmentsView("upcoming"); setActiveTab("appointments"); }}
          >
            <span className="booking-nav-icon-wrap" aria-hidden="true">
              <span className="booking-nav-icon booking-queue-icon" />
              {nextConfirmedAppointment && <span className="booking-next-dot" />}
            </span>
            {t("pb.myAppointments")}
          </button>
          <button className="book-now" onClick={resetNewBooking}><b>+</b><span>{t("pb.bookNow")}</span></button>
          <a className="booking-whatsapp-nav" href={whatsappUrl || "#"} target={whatsappUrl ? "_blank" : undefined} rel="noreferrer" aria-disabled={!whatsappUrl} onClick={(event) => { if (!whatsappUrl) event.preventDefault(); }}><span className="booking-nav-icon booking-whatsapp-icon" aria-hidden="true" />{t("pb.whatsapp")}</a>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}><span className="booking-nav-icon booking-settings-icon" aria-hidden="true" />{t("pb.settings")}</button>
        </nav>
      </div>
      {appointmentToCancel && (
        <div className="booking-confirm-overlay" role="presentation" onMouseDown={closeCancellationDialog}>
          <section
            className="booking-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-appointment-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="booking-confirm-close" type="button" aria-label={t("close")} disabled={Boolean(cancelingId)} onClick={closeCancellationDialog}>×</button>
            <div className="booking-confirm-symbol" aria-hidden="true">!</div>
            <h2 id="cancel-appointment-title">{t("pb.confirmCancelTitle")}</h2>
            <p>{t("pb.confirmCancelText")}</p>
            <div className="booking-confirm-summary">
              <strong>{appointmentToCancel.service}</strong>
              <span>{fmtDate(appointmentToCancel.startAt)} · {fmtTime(appointmentToCancel.startAt)} - {fmtTime(appointmentToCancel.endAt)}</span>
            </div>
            {cancelError && <div className="booking-confirm-error">{cancelError}</div>}
            <div className="booking-confirm-actions">
              <Button variant="ghost" disabled={Boolean(cancelingId)} onClick={closeCancellationDialog}>{t("pb.undo")}</Button>
              <Button variant="danger" loading={Boolean(cancelingId)} onClick={confirmAppointmentCancellation}>{t("pb.yesCancel")}</Button>
            </div>
          </section>
        </div>
      )}
      {wazeUrl && <a className="waze-floating-button" href={wazeUrl} target="_blank" rel="noreferrer" aria-label="Waze"><img src="/waze.jpg" alt="" /></a>}
    </div>
  );
}

function CenterCard({ children }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>{children}</div>;
}

function PageTitle({ title, subtitle }) {
  return <div className="booking-page-title"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>;
}

function BackButton({ onClick }) {
  const { t } = useLanguage();
  return <button className="booking-back" onClick={onClick} aria-label={t("back")}>←</button>;
}

function AppointmentCard({ appointment, isNext = false, onCancel, canceling }) {
  const { t } = useLanguage();
  const future = new Date(appointment.startAt) > new Date();
  const statusMeta = {
    PENDING: { label: t("pb.statusPending"), tone: "warning" },
    CONFIRMED: { label: t("pb.statusConfirmed"), tone: "success" },
    COMPLETED: { label: t("pb.statusCompleted"), tone: "success" },
    NO_SHOW: { label: t("pb.statusNoShow"), tone: "muted" },
    REJECTED: { label: t("pb.statusRejected"), tone: "danger" },
  }[appointment.status];
  const canCancel = future && ["PENDING", "CONFIRMED"].includes(appointment.status);
  const paymentLabel = appointment.paymentStatus === "PAID"
    ? t("pb.paid")
    : Number(appointment.paymentAmount || 0) === 0
      ? t("pb.freeService")
      : t("pb.awaitingPayment");
  return (
    <article className={`booking-appointment-card is-${String(appointment.status || "").toLowerCase()}`}>
      <header className="booking-appointment-head">
        <div>
          <strong className="booking-appointment-service">{appointment.service}</strong>
          <span className="booking-appointment-employee">{t("pb.with", { name: appointment.employee })}</span>
        </div>
        <div className="booking-appointment-tags">
          {isNext && <span className="booking-appointment-next">{t("pb.nearest")}</span>}
          <span className="booking-appointment-number">#{appointment.id}</span>
        </div>
      </header>

      <div className="booking-appointment-time">
        <span>{fmtDate(appointment.startAt)}</span>
        <strong>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</strong>
      </div>

      <div className="booking-appointment-meta">
        {statusMeta && <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>}
        {appointment.status !== "REJECTED" && <small>{paymentLabel}</small>}
      </div>

      {canCancel && (
        <Button className="booking-cancel-button" size="sm" variant="ghost" loading={canceling} onClick={() => onCancel(appointment)}>
          {t("pb.cancelAppointment")}
        </Button>
      )}
    </article>
  );
}

function SuccessView({ appointment, business, onCalendar, onShare, onHome }) {
  const { t } = useLanguage();
  const isPending = appointment.status === "PENDING";
  return (
    <div className="booking-success">
      <div className="booking-success-check">{isPending ? "…" : "✓"}</div>
      <h2>{isPending ? t("pb.pendingTitle") : t("pb.bookedSuccess")}</h2>
      <p>{isPending ? t("pb.pendingSub") : t("pb.lookForward")}</p>
      <div className="booking-success-card">
        <Row label={t("service")} value={appointment.service} />
        <Row label={t("employee")} value={appointment.employee} />
        <Row label={t("date")} value={fmtDate(appointment.startAt)} />
        <Row label={t("pb.time")} value={fmtTime(appointment.startAt)} />
        <Row label={t("pb.bookingNumber")} value={`#${appointment.id}`} />
        <Row label={t("status")} value={isPending ? t("pb.waiting") : t("statusConfirmed")} />
      </div>
      {!isPending && <Button size="lg" block onClick={onCalendar}>{t("pb.addToCalendar")}</Button>}
      <Button size="lg" block variant="secondary" onClick={onShare}>{isPending ? t("pb.shareRequest") : t("pb.shareAppointment")}</Button>
      <button className="booking-home-link" onClick={onHome}>{t("pb.backHomeTo", { name: business.name })}</button>
    </div>
  );
}

function Row({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
