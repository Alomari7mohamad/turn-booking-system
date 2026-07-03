import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { setFavicon } from "../favicon.js";
import { AppFooter } from "../components/AppFooter.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Button, EmptyState, Field, Input, Select, Spinner, fmtDate, fmtPrice, fmtTime } from "../components/ui.jsx";
import { applyBrandTheme, buildBrandThemeVars, resetBrandTheme } from "../brandTheme.js";

const dayKeys = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

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

function buildWhatsappUrl(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (!raw) return null;
  const phone = raw.startsWith("972") ? raw : raw.startsWith("0") ? `972${raw.slice(1)}` : raw;
  return `https://wa.me/${phone}?text=${encodeURIComponent("مرحبا , اريد مساعدة")}`;
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

export default function PublicBooking() {
  const { slug } = useParams();
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
  const [activeTab, setActiveTab] = useState("home");
  const [step, setStep] = useState("service");
  const [service, setService] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInput());
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [monthStatus, setMonthStatus] = useState({});
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", dateOfBirth: "" });
  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState("");
  const [success, setSuccess] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

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

  const business = data?.business;
  const services = data?.services || [];
  const employees = data?.employees || [];
  const brandStyle = buildBrandThemeVars(business?.brandColor);
  const hasLoginImage = Boolean(business?.bookingHeroImageUrl);
  const loginCardStyle = hasLoginImage ? { "--booking-card-bg": `url("${business.bookingHeroImageUrl}")` } : undefined;
  const wazeUrl = buildWazeUrl(business?.mapUrl || business?.address);
  const whatsappUrl = buildWhatsappUrl(business?.phone);
  const serviceEmployees = service ? employees.filter((item) => item.serviceIds.includes(service.id)) : [];
  const methods = useMemo(() => {
    const result = [];
    if (business?.onlinePaymentEnabled) result.push("ONLINE");
    if (business?.payAtStoreEnabled) result.push("PAY_AT_STORE");
    return result;
  }, [business]);
  const filteredServices = services.filter((item) => item.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()));

  const refreshAppointments = async (targetPhone = session?.phone) => {
    if (!targetPhone) return;
    const res = await publicApi.findAppointmentByPhone(slug, targetPhone);
    setAppointments(res.appointments || []);
    if (res.customer?.name) {
      setSession((current) => current ? { ...current, name: res.customer.name } : current);
      setCustomerForm((current) => ({
        ...current,
        name: res.customer.name || current.name,
        email: res.customer.email || current.email,
        dateOfBirth: res.customer.dateOfBirth || current.dateOfBirth,
      }));
    }
  };

  const sendCode = async () => {
    if (!validLocalPhone(phone)) {
      setLoginMessage("الرقم خاطئ");
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
        const nextSession = { phone, token: res.token, name: "", email: "" };
        setSession(nextSession);
        setCustomerForm({ name: "", email: "", dateOfBirth: "" });
        await refreshAppointments(phone);
        return;
      }
      setLoginMessage(res.message || "تم إرسال رمز التحقق عبر واتساب");
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
      setLoginMessage("الرقم خاطئ");
      setCodeSent(false);
      return;
    }
    setVerifyingCode(true);
    setLoginMessage("");
    try {
      const res = await publicApi.confirmPhoneVerification(slug, { phone, code });
      const nextSession = { phone, token: res.token, name: "", email: "" };
      setSession(nextSession);
      setCustomerForm({ name: "", email: "", dateOfBirth: "" });
      await refreshAppointments(phone);
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
    publicApi.availability(slug, { serviceId: service.id, employeeId: employee?.id || undefined, date: selectedDate })
      .then((res) => {
        if (!cancelled) setSlots(res.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, step, service, employee, selectedDate, slug]);

  useEffect(() => {
    if (activeTab !== "new" || step !== "time" || !service) return;
    let cancelled = false;
    const days = calendarDays(monthDate);
    Promise.all(days.map(async (date) => {
      const dateStr = dateInputFrom(date);
      if (isPastDate(dateStr)) return [dateStr, "past"];
      try {
        const res = await publicApi.availability(slug, { serviceId: service.id, employeeId: employee?.id || undefined, date: dateStr });
        if (res.closed) return [dateStr, "closed"];
        return [dateStr, (res.slots || []).length ? "available" : "unavailable"];
      } catch {
        return [dateStr, "closed"];
      }
    })).then((entries) => {
      if (!cancelled) setMonthStatus(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, step, service, employee, monthDate, slug]);

  if (error) return <CenterCard><EmptyState title="تعذر فتح صفحة الحجز" hint={error} /></CenterCard>;
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
    setStep("employee");
  };

  const chooseEmployee = (item) => {
    setEmployee(item);
    setStep("time");
  };

  const confirmBooking = async () => {
    const name = (customerForm.name || session?.name || "").trim();
    if (!name) {
      setBookErr("يرجى إدخال الاسم");
      return;
    }
    const isFree = Number(service.price || 0) === 0;
    if (!isFree && !paymentMethod) {
      setBookErr("يرجى اختيار طريقة الدفع");
      return;
    }
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
      setBookErr(err.message);
    } finally {
      setBooking(false);
    }
  };

  const cancelAppointment = async (appointment) => {
    if (!window.confirm("هل أنت متأكد أنك تريد إلغاء هذا الموعد؟")) return;
    setCancelingId(appointment.id);
    try {
      await publicApi.cancelAppointment(slug, appointment.id, session.phone);
      await refreshAppointments(session.phone);
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
      });
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
      }));
      setSettingsMessage("تم حفظ التفاصيل");
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
    const text = `موعدي في ${business.name}: ${success.service} يوم ${fmtDate(success.startAt)} الساعة ${fmtTime(success.startAt)}`;
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
  };

  if (!session?.token) {
    return (
      <div className="booking-mobile-page" style={brandStyle}>
        <div className={`booking-login-card ${hasLoginImage ? "has-login-image" : ""}`} style={loginCardStyle}>
          <div className="booking-login-top"><LanguageSwitcher /></div>
          {!hasLoginImage && (
            <div className="booking-login-visual">
              <img src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
            </div>
          )}
          <h1>أهلاً بك في {business.name}</h1>
          <p>احجز دورك بسهولة وسرعة<br />في أي وقت ومن أي مكان</p>
          <div className="booking-login-form">
            <Field label="رقم الهاتف">
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
            <Button size="lg" block loading={sendingCode} disabled={!phone} onClick={sendCode}>متابعة</Button>
            {(loginMessage || devCode) && <div className="booking-login-message">{loginMessage}{devCode ? ` رمز التجربة: ${devCode}` : ""}</div>}
            {codeSent && (
              <>
                <Field label="رمز التحقق">
                  <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" placeholder="أدخل الرمز المرسل إلى واتساب" />
                </Field>
                <Button size="lg" block variant="secondary" loading={verifyingCode} disabled={!phone || !code} onClick={verifyCode}>تأكيد الرقم</Button>
              </>
            )}
          </div>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="booking-mobile-page has-bottom-nav" style={brandStyle}>
      <div className="booking-app-shell">
        <header className="booking-app-header">
          <div>
            <span>أهلاً، {session.name || "ضيفنا"}</span>
            <strong>{business.name}</strong>
          </div>
          <img src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
        </header>

        {activeTab === "home" && (
          <main className="booking-app-content">
            <section className="booking-panel">
              <h3>موعدك القادم</h3>
              {appointments[0] ? <AppointmentCard appointment={appointments[0]} onCancel={cancelAppointment} canceling={cancelingId === appointments[0].id} /> : <EmptyState title="لا يوجد موعد قادم" hint="احجز موعدك الأول الآن." />}
            </section>
          </main>
        )}

        {activeTab === "appointments" && (
          <main className="booking-app-content">
            <PageTitle title="مواعيدي" subtitle="كل المواعيد القادمة المرتبطة برقم هاتفك" />
            {appointments.length ? appointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} onCancel={cancelAppointment} canceling={cancelingId === appointment.id} />
            )) : <EmptyState title="لا توجد مواعيد" hint="أي موعد مؤكد سيظهر هنا." />}
          </main>
        )}

        {activeTab === "settings" && (
          <main className="booking-app-content">
            <PageTitle title="الإعدادات" subtitle="تفاصيلك الشخصية في صفحة الحجز" />
            <div className="booking-panel">
              <Field label="الاسم">
                <Input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="رقم الهاتف">
                <Input value={session.phone} readOnly />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label="تاريخ الميلاد">
                <Input type="date" value={customerForm.dateOfBirth} onChange={(event) => setCustomerForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
              </Field>
              {settingsMessage && <div className="booking-login-message">{settingsMessage}</div>}
              <Button onClick={saveCustomerSettings}>حفظ التفاصيل</Button>
            </div>
          </main>
        )}

        {activeTab === "new" && (
          <main className="booking-app-content">
            {step !== "success" && <BackButton onClick={() => {
              if (step === "service") setActiveTab("home");
              if (step === "employee") setStep("service");
              if (step === "time") setStep("employee");
              if (step === "details") setStep("time");
            }} />}
            {step === "service" && (
              <>
                <PageTitle title="اختر الخدمة" subtitle="اختر الخدمة التي تريد حجز موعد لها" />
                <Input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="بحث عن خدمة" />
                <div className="booking-service-grid">
                  {filteredServices.map((item) => (
                    <button key={item.id} className="booking-service-card" onClick={() => chooseService(item)}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{serviceIcon(item.name)}</span>}
                      <strong>{item.name}</strong>
                      {item.description && <p className="booking-service-note">{item.description}</p>}
                      <small>{item.durationMinutes} دقيقة - {Number(item.price || 0) === 0 ? "مجانية" : fmtPrice(item.price)}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "employee" && (
              <>
                <PageTitle title="اختر العامل" subtitle="اختر العامل الذي تفضل الحجز معه" />
                <button className={`booking-employee-card ${employee === null ? "selected" : ""}`} onClick={() => chooseEmployee(null)}>
                  <div><strong>أي عامل متاح</strong><span>النظام يختار أقرب وقت مناسب</span></div><i />
                </button>
                {serviceEmployees.map((item) => (
                  <button key={item.id} className={`booking-employee-card ${employee?.id === item.id ? "selected" : ""}`} onClick={() => chooseEmployee(item)}>
                    <div><strong>{item.name}</strong><span>{item.title || "مقدم خدمة"}</span></div><i />
                  </button>
                ))}
              </>
            )}

            {step === "time" && (
              <>
                <PageTitle title="اختر الموعد" subtitle="اختر التاريخ واليوم والوقت المناسب لك" />
                <div className="booking-week-strip">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const date = addDays(new Date(), index);
                    const dateStr = dateInputFrom(date);
                    return (
                      <button key={dateStr} className={selectedDate === dateStr ? "active" : ""} onClick={() => setSelectedDate(dateStr)}>
                        <span>{dayKeys[date.getDay()]}</span><strong>{date.getDate()}</strong>
                      </button>
                    );
                  })}
                </div>
                <div className="booking-month-head">
                  <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>‹</button>
                  <strong>{monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}</strong>
                  <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>›</button>
                </div>
                <div className="booking-calendar">
                  {dayKeys.map((day) => <span key={day}>{day}</span>)}
                  {calendarDays(monthDate).map((date) => {
                    const dateStr = dateInputFrom(date);
                    const status = monthStatus[dateStr];
                    const disabled = status === "past" || status === "closed" || date.getMonth() !== monthDate.getMonth();
                    return (
                      <button key={dateStr} disabled={disabled} className={`${selectedDate === dateStr ? "active" : ""} ${disabled ? "disabled" : ""} ${status === "unavailable" ? "unavailable" : ""}`} onClick={() => setSelectedDate(dateStr)}>
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <h3 className="booking-section-title">اختر الوقت</h3>
                {slots === null ? <Spinner /> : slots.length ? (
                  <div className="booking-slots">
                    {slots.map((item) => (
                      <button key={item.startAt} className={slot?.startAt === item.startAt ? "active" : ""} onClick={() => setSlot(item)}>
                        {item.time}
                      </button>
                    ))}
                  </div>
                ) : <EmptyState title="لا توجد أوقات متاحة" hint="اختر يومًا آخر أو عاملًا آخر." />}
                <Button size="lg" block disabled={!slot} onClick={() => setStep("details")}>تأكيد الموعد</Button>
              </>
            )}

            {step === "details" && (
              <>
                <PageTitle title="تأكيد الحجز" subtitle="أدخل تفاصيل طالب الخدمة قبل إرسال الطلب" />
                <div className="booking-panel">
                  <Field label="الاسم">
                    <Input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} required />
                  </Field>
                  <Field label="البريد الإلكتروني (اختياري)">
                    <Input value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
                  </Field>
                  {Number(service.price || 0) > 0 && (
                    <Field label="طريقة الدفع">
                      <Select value={paymentMethod || ""} onChange={(event) => setPaymentMethod(event.target.value)}>
                        <option value="">اختر طريقة الدفع</option>
                        {methods.includes("PAY_AT_STORE") && <option value="PAY_AT_STORE">الدفع في المحل</option>}
                        {methods.includes("ONLINE") && <option value="ONLINE">الدفع الإلكتروني</option>}
                      </Select>
                    </Field>
                  )}
                  {Number(service.price || 0) === 0 && <div className="booking-free-note">هذه الخدمة مجانية</div>}
                  {bookErr && <div className="error-text">{bookErr}</div>}
                  <Button size="lg" block loading={booking} onClick={confirmBooking}>حفظ الطلب</Button>
                </div>
              </>
            )}

            {step === "success" && success && (
              <SuccessView appointment={success} business={business} onCalendar={addToCalendar} onShare={shareAppointment} onHome={() => setActiveTab("home")} />
            )}
          </main>
        )}

        <nav className="booking-bottom-nav">
          <button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><span className="booking-nav-icon booking-home-icon" aria-hidden="true" />الرئيسية</button>
          <button className={activeTab === "appointments" ? "active" : ""} onClick={() => { refreshAppointments(); setActiveTab("appointments"); }}><span className="booking-nav-icon booking-queue-icon" aria-hidden="true" />مواعيدي</button>
          <button className="book-now" onClick={resetNewBooking}><b>+</b><span>احجز الآن</span></button>
          <a className="booking-whatsapp-nav" href={whatsappUrl || "#"} target={whatsappUrl ? "_blank" : undefined} rel="noreferrer" aria-disabled={!whatsappUrl} onClick={(event) => { if (!whatsappUrl) event.preventDefault(); }}><span className="booking-nav-icon booking-whatsapp-icon" aria-hidden="true" />واتساب</a>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}><span className="booking-nav-icon booking-settings-icon" aria-hidden="true" />الإعدادات</button>
        </nav>
      </div>
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
  return <button className="booking-back" onClick={onClick} aria-label="رجوع">←</button>;
}

function AppointmentCard({ appointment, onCancel, canceling }) {
  const future = new Date(appointment.startAt) > new Date();
  return (
    <article className="booking-appointment-card">
      <strong>{appointment.service}</strong>
      <span>{appointment.employee}</span>
      <p>{fmtDate(appointment.startAt)} - {fmtTime(appointment.startAt)} حتى {fmtTime(appointment.endAt)}</p>
      <small>{appointment.paymentStatus === "PAID" ? "مدفوع" : Number(appointment.paymentAmount || 0) === 0 ? "مجانية" : "بانتظار الدفع"}</small>
      {future && <Button size="sm" variant="danger" loading={canceling} onClick={() => onCancel(appointment)}>إلغاء الموعد</Button>}
    </article>
  );
}

function SuccessView({ appointment, business, onCalendar, onShare, onHome }) {
  return (
    <div className="booking-success">
      <div className="booking-success-check">✓</div>
      <h2>تم حجز موعدك بنجاح!</h2>
      <p>نتطلع لرؤيتك قريبًا</p>
      <div className="booking-success-card">
        <Row label="الخدمة" value={appointment.service} />
        <Row label="العامل" value={appointment.employee} />
        <Row label="التاريخ" value={fmtDate(appointment.startAt)} />
        <Row label="الوقت" value={fmtTime(appointment.startAt)} />
        <Row label="رقم الحجز" value={`#${appointment.id}`} />
      </div>
      <Button size="lg" block onClick={onCalendar}>إضافة إلى التقويم</Button>
      <Button size="lg" block variant="secondary" onClick={onShare}>مشاركة الموعد</Button>
      <button className="booking-home-link" onClick={onHome}>العودة للرئيسية في {business.name}</button>
    </div>
  );
}

function Row({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

