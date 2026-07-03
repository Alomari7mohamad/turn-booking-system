import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button, Field, Input, Spinner, fmtDate, fmtTime } from "../components/ui.jsx";
import { setFavicon } from "../favicon.js";
import { buildBrandThemeVars } from "../brandTheme.js";

const copy = {
  ar: {
    title: "شاشة طباعة الدور",
    sub: "أدخل رقم الهاتف أو رقم الملف، وسيتم تحديد الدور حسب وقت الموعد",
    disabled: "شاشة الطباعة غير مفعلة لهذا المحل",
    phone: "رقم الهاتف / رقم الملف",
    print: "طباعة الدور",
    noTurn: "لا يوجد دور لهذا الرقم اليوم",
    queueNumber: "رقم الدور",
    priority: "الأولوية حسب وقت الموعد، وليس وقت سحب الورقة",
    ahead: "قبلك",
    inTodaySchedule: "في جدول اليوم",
    next: "أنت التالي حسب جدول اليوم",
    bookingNumber: "رقم الحجز اليومي",
    printAgain: "طباعة مرة أخرى",
  },
  he: {
    title: "עמדת הדפסת תור",
    sub: "הכניסו מספר טלפון או מספר תיק, והתור ייקבע לפי שעת התור",
    disabled: "עמדת ההדפסה אינה פעילה לעסק זה",
    phone: "טלפון / מספר תיק",
    print: "הדפסת תור",
    noTurn: "לא נמצא תור למספר זה היום",
    queueNumber: "מספר תור",
    priority: "הקדימות לפי שעת התור, לא לפי זמן הדפסת הפתק",
    ahead: "לפניך",
    inTodaySchedule: "בלוח היום",
    next: "אתם הבאים לפי לוח היום",
    bookingNumber: "מספר הזמנה יומי",
    printAgain: "הדפסה חוזרת",
  },
};

export default function PrintTicketPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const c = copy[language] || copy.ar;
  const [business, setBusiness] = useState(null);
  const [phone, setPhone] = useState("");
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    publicApi.business(slug)
      .then((res) => {
        setBusiness(res.business);
        setFavicon(res.business.logoUrl || "/oh-tech-logo.jpg");
        setReady(true);
        if (!res.business.printScreenEnabled) setMessage(c.disabled);
      })
      .catch((err) => {
        setMessage(err.message);
        setReady(true);
      });
  }, [slug, c.disabled]);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const resetScreen = () => {
    setPhone("");
    setTicket(null);
    setMessage("");
    setLoading(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setLoading(true);
    setMessage("");
    setTicket(null);
    try {
      const res = await publicApi.printTicket(slug, phone);
      setBusiness((current) => ({ ...current, ...res.business }));
      if (!res.ticket) {
        setMessage(res.message || c.noTurn);
        return;
      }
      setTicket(res.ticket);
      setTimeout(() => {
        window.print();
        resetTimerRef.current = setTimeout(resetScreen, 5000);
      }, 250);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return <Spinner page />;

  const brandStyle = buildBrandThemeVars(business?.brandColor);

  return (
    <div className="ticket-page" style={brandStyle} data-no-auto-translate="true">
      <div className="ticket-language-row">
        <LanguageSwitcher />
      </div>
      <div className="ticket-kiosk">
        <div className="ticket-kiosk-head">
          <img src={business?.logoUrl || "/oh-tech-logo.jpg"} alt={business?.name || "O&H Tech"} />
          <div>
            <h1>{business?.name || c.title}</h1>
            <p>{c.sub}</p>
          </div>
        </div>

        <form onSubmit={submit} className="ticket-search">
          <Field label={c.phone}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus inputMode="numeric" placeholder="05xxxxxxxx" />
          </Field>
          <Button type="submit" size="lg" loading={loading} disabled={!!message && !business?.printScreenEnabled}>{c.print}</Button>
        </form>

        {message && <div className="ticket-message">{message}</div>}

        {ticket && (
          <div className="print-ticket-card" dir="rtl">
            <div className="print-ticket-logo">
              <img src={business?.logoUrl || "/oh-tech-logo.jpg"} alt={business?.name || "O&H Tech"} />
            </div>
            <div className="print-ticket-business">{business?.name}</div>
            <div className="print-ticket-name">{ticket.customerName}</div>
            <div className="print-ticket-label">{c.queueNumber}</div>
            <div className="print-ticket-number">{ticket.queueNumber}</div>
            <div className="print-ticket-priority">{c.priority}</div>
            <div className="print-ticket-details">
              <div>{ticket.service}</div>
              <div>{fmtDate(ticket.startAt)} | {fmtTime(ticket.startAt)} - {fmtTime(ticket.endAt)}</div>
              <div>{ticket.peopleAhead ? `${c.ahead} ${ticket.peopleAhead} ${c.inTodaySchedule}` : c.next}</div>
              <div>{c.bookingNumber}: #{ticket.bookingNumber}</div>
            </div>
            <Button className="ticket-print-button" variant="ghost" onClick={() => window.print()}>{c.printAgain}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
