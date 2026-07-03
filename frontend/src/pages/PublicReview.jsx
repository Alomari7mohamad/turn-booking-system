import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { Button, EmptyState, Field, Spinner, Textarea, fmtDate } from "../components/ui.jsx";
import { buildBrandThemeVars } from "../brandTheme.js";

function RatingInput({ label, value, onChange }) {
  const values = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

  return (
    <Field label={label}>
      <div className="rating-control" role="radiogroup" aria-label={label}>
        {values.map((item) => (
          <button
            key={item}
            type="button"
            className={item <= value ? "active" : ""}
            onClick={() => onChange(item)}
            title={`${item} / 5`}
            aria-label={`${item} من 5`}
          >
            {item % 1 === 0 ? "★" : "☆"}
          </button>
        ))}
        <strong>{value.toFixed(1)}</strong>
      </div>
    </Field>
  );
}

export default function PublicReview() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    serviceRating: 5,
    employeeRating: 5,
    businessRating: 5,
    comment: "",
  });

  useEffect(() => {
    publicApi.review(token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await publicApi.submitReview(token, form);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return (
      <ReviewCenter>
        <EmptyState title="تعذر فتح رابط التقييم" hint={error} />
      </ReviewCenter>
    );
  }
  if (!data) return <Spinner page />;

  const appointment = data.appointment;
  const business = appointment.business || {};
  const brandStyle = buildBrandThemeVars(business.brandColor);

  if (data.alreadyReviewed || sent) {
    return (
      <div className="review-page" style={brandStyle}>
        <ReviewCenter>
          <div className="review-card">
            <img className="review-logo" src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
            <EmptyState title="شكرًا لكم" hint="تم استلام تقييمكم بنجاح." />
          </div>
        </ReviewCenter>
      </div>
    );
  }

  return (
    <div className="review-page" style={brandStyle}>
      <ReviewCenter>
        <form className="review-card" onSubmit={submit}>
          <img className="review-logo" src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
          <div className="review-title">تقييم التجربة</div>
          <div className="review-sub">
            {business.name} - {appointment.service} - {appointment.employee}
            <br />
            {fmtDate(appointment.startAt)}
          </div>

          <RatingInput label="تقييم الخدمة" value={form.serviceRating} onChange={(serviceRating) => setForm((f) => ({ ...f, serviceRating }))} />
          <RatingInput label="تقييم العامل" value={form.employeeRating} onChange={(employeeRating) => setForm((f) => ({ ...f, employeeRating }))} />
          <RatingInput label="تقييم المحل" value={form.businessRating} onChange={(businessRating) => setForm((f) => ({ ...f, businessRating }))} />

          <Field label="تعليق اختياري">
            <Textarea rows="4" value={form.comment} onChange={(event) => setForm((f) => ({ ...f, comment: event.target.value }))} />
          </Field>

          {error && <div className="error-text">{error}</div>}
          <Button type="submit" size="lg" block loading={saving}>إرسال التقييم</Button>
        </form>
      </ReviewCenter>
    </div>
  );
}

function ReviewCenter({ children }) {
  return (
    <div className="review-center">
      {children}
    </div>
  );
}
