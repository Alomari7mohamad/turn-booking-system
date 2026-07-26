import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { Button, EmptyState, Field, Spinner, Textarea, fmtDate } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { buildBrandThemeVars } from "../brandTheme.js";

function RatingInput({ label, value, onChange }) {
  const { t } = useLanguage();
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
            aria-label={t("review.outOf5", { n: item })}
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
  const { t } = useLanguage();
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
        <EmptyState title={t("review.cantOpen")} hint={error} />
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
            <EmptyState title={t("review.thanks")} hint={t("review.received")} />
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
          <div className="review-title">{t("review.title")}</div>
          <div className="review-sub">
            {business.name} - {appointment.service} - {appointment.employee}
            <br />
            {fmtDate(appointment.startAt)}
          </div>

          <RatingInput label={t("review.serviceRating")} value={form.serviceRating} onChange={(serviceRating) => setForm((f) => ({ ...f, serviceRating }))} />
          <RatingInput label={t("review.employeeRating")} value={form.employeeRating} onChange={(employeeRating) => setForm((f) => ({ ...f, employeeRating }))} />
          <RatingInput label={t("review.businessRating")} value={form.businessRating} onChange={(businessRating) => setForm((f) => ({ ...f, businessRating }))} />

          <Field label={t("review.optionalComment")}>
            <Textarea rows="4" value={form.comment} onChange={(event) => setForm((f) => ({ ...f, comment: event.target.value }))} />
          </Field>

          {error && <div className="error-text">{error}</div>}
          <Button type="submit" size="lg" block loading={saving}>{t("review.submit")}</Button>
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
