import { useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Spinner,
  fmtDate,
  fmtNumber,
  fmtPrice,
  fmtTime,
  PAYMENT_STATUS_META,
  STATUS_META,
} from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

function monthInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function averageReview(review) {
  const values = [review.serviceRating, review.employeeRating, review.businessRating]
    .map(Number)
    .filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Stars({ value, t }) {
  const rounded = Math.round(Number(value || 0) * 2) / 2;
  return (
    <span className="rating-stars" aria-label={t("review.outOf5", { n: rounded })}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        return (
          <span key={starValue} className={rounded >= starValue ? "filled" : rounded >= starValue - 0.5 ? "half" : ""}>
            ★
          </span>
        );
      })}
    </span>
  );
}

export default function CustomersPage() {
  const { api, isAdminManaging } = useBusinessManage();
  const toast = useToast();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(monthInput());
  const [pointsPercent, setPointsPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [reviewsTarget, setReviewsTarget] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsFrom, setDetailsFrom] = useState("");
  const [detailsTo, setDetailsTo] = useState("");

  const load = () => {
    setData(null);
    api.customers({ month })
      .then((res) => {
        setData(res);
        setPointsPercent(res.customerPointsPercent || 0);
      })
      .catch((err) => {
        toast.error(err.message);
        setData({ enabled: false, customers: [], summary: {} });
      });
  };

  useEffect(() => {
    load();
  }, [month]);

  const customers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data?.customers || [];
    if (!q) return rows;
    return rows.filter((customer) =>
      [customer.name, customer.phone, customer.email].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [data, search]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateCustomerSettings({ customerPointsPercent: Number(pointsPercent || 0) });
      toast.success(t("cust.pointsSaved"));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openReviews = async (customer) => {
    setReviewsTarget(customer);
    setReviews(null);
    try {
      const res = await api.customerReviews(customer.phone);
      setReviews(res.reviews || []);
    } catch (err) {
      toast.error(err.message);
      setReviews([]);
    }
  };

  const openDetails = async (customer) => {
    if (isAdminManaging) return;
    setDetailsTarget(customer);
    setDetails(null);
    try {
      const res = await api.customerDetails(customer.phone, {
        from: detailsFrom || undefined,
        to: detailsTo || undefined,
      });
      setDetails(res);
    } catch (err) {
      toast.error(err.message);
      setDetails({ appointments: [], summary: {} });
    }
  };

  if (!data) return <Spinner page />;

  if (!data.enabled) {
    return (
      <EmptyState
        title={t("cust.notEnabled")}
        hint={t("cust.notEnabledHint")}
      />
    );
  }

  const summary = data.summary || {};

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{t("navCustomers")}</div>
          <div className="page-sub">{t("cust.sub")}</div>
        </div>
      </div>

      <div className="customer-summary-grid">
        <div className="card card-pad">
          <span className="soft">{t("cust.totalCustomers")}</span>
          <strong>{fmtNumber(summary.customers)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">{t("cust.monthVisits")}</span>
          <strong>{fmtNumber(summary.monthlyVisits)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">{t("cust.monthPaid")}</span>
          <strong>{fmtPrice(summary.monthlyPaid)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">{t("cust.totalPoints")}</span>
          <strong>{fmtNumber(summary.points)}</strong>
        </div>
      </div>

      <div className="card card-pad mt-3">
        <div className="customers-toolbar">
          <Field label={t("cust.month")}>
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
          <Field label={t("search")}>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("cust.searchPlaceholder")} />
          </Field>
          <form onSubmit={saveSettings} className="customers-points-form">
            <Field label={t("cust.pointsPercent")}>
              <div className="row customer-points-row">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={pointsPercent}
                  onChange={(event) => setPointsPercent(event.target.value)}
                />
                <span className="soft">%</span>
                <Button type="submit" size="sm" loading={saving}>{t("save")}</Button>
              </div>
            </Field>
          </form>
        </div>
      </div>

      <div className="card mt-3">
        {customers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("phone")}</th>
                  <th>{t("cust.monthVisits")}</th>
                  <th>{t("cust.monthPaid")}</th>
                  <th>{t("cust.allVisits")}</th>
                  <th>{t("cust.allPaid")}</th>
                  <th>{t("cust.points")}</th>
                  <th>{t("cust.lastVisit")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td style={{ fontWeight: 800 }}>
                      {customer.name}
                      {customer.email && <div className="soft">{customer.email}</div>}
                    </td>
                    <td>{customer.phone}</td>
                    <td><Badge tone="info">{fmtNumber(customer.monthly?.visits || 0)}</Badge></td>
                    <td>{fmtPrice(customer.monthly?.paid || 0)}</td>
                    <td>{fmtNumber(customer.totalVisits)}</td>
                    <td>{fmtPrice(customer.totalPaid)}</td>
                    <td><Badge tone="success">{fmtNumber(customer.points)}</Badge></td>
                    <td>{customer.lastVisitAt ? fmtDate(customer.lastVisitAt) : "-"}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {!isAdminManaging && (
                          <Button size="sm" variant="secondary" onClick={() => openDetails(customer)}>{t("cust.customerDetails")}</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openReviews(customer)}>{t("cust.viewReviews")}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("cust.noCustomers")} hint={t("cust.noCustomersHint")} />
        )}
      </div>

      <Modal
        open={!!reviewsTarget}
        onClose={() => setReviewsTarget(null)}
        title={reviewsTarget ? t("cust.reviewsOf", { name: reviewsTarget.name }) : t("cust.reviews")}
        footer={<Button variant="ghost" onClick={() => setReviewsTarget(null)}>{t("close")}</Button>}
      >
        {!reviews ? <Spinner /> : reviews.length ? (
          <div className="col" style={{ gap: 12 }}>
            {reviews.map((review) => (
              <div key={review.id} className="card card-pad" style={{ boxShadow: "none" }}>
                <div className="row-between">
                  <strong>{review.service?.name || "-"}</strong>
                  <Stars value={averageReview(review)} t={t} />
                </div>
                <div className="soft mt-1" style={{ fontSize: 13 }}>
                  {review.employee?.name || "-"} · {review.appointment?.startAt ? fmtDate(review.appointment.startAt) : fmtDate(review.createdAt)}
                </div>
                <div className="row wrap mt-2" style={{ gap: 8 }}>
                  <Badge tone="info">{t("service")} {review.serviceRating}/5</Badge>
                  <Badge tone="success">{t("employee")} {review.employeeRating}/5</Badge>
                  <Badge tone="warning">{t("business")} {review.businessRating}/5</Badge>
                </div>
                {review.comment && <p className="mt-2" style={{ marginBottom: 0 }}>{review.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("cust.noReviews")} />
        )}
      </Modal>

      <Modal
        open={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={detailsTarget ? t("cust.customerDetailsName", { name: detailsTarget.name }) : t("cust.customerDetails")}
        footer={<Button variant="ghost" onClick={() => setDetailsTarget(null)}>{t("close")}</Button>}
      >
        <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
          <Field label={t("cust.fromDate")}>
            <Input type="date" value={detailsFrom} onChange={(event) => setDetailsFrom(event.target.value)} />
          </Field>
          <Field label={t("cust.toDate")}>
            <Input type="date" value={detailsTo} onChange={(event) => setDetailsTo(event.target.value)} />
          </Field>
          <Button type="button" variant="secondary" onClick={() => detailsTarget && openDetails(detailsTarget)} style={{ alignSelf: "end" }}>
            {t("cust.show")}
          </Button>
        </div>
        {!details ? <Spinner /> : (
          <div className="col" style={{ gap: 14 }}>
            <div className="grid grid-stats">
              <div className="card card-pad"><span className="soft">{t("cust.bookingsCount")}</span><strong>{fmtNumber(details.summary?.appointments)}</strong></div>
              <div className="card card-pad"><span className="soft">{t("cust.totalPaidLabel")}</span><strong>{fmtPrice(details.summary?.paid)}</strong></div>
              <div className="card card-pad"><span className="soft">{t("statusNoShow")}</span><strong>{fmtNumber(details.summary?.noShow)}</strong></div>
              <div className="card card-pad"><span className="soft">{t("cust.rejectedCount")}</span><strong>{fmtNumber(details.summary?.cancelled)}</strong></div>
            </div>
            {details.appointments?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("cust.turn")}</th>
                      <th>{t("service")}</th>
                      <th>{t("employee")}</th>
                      <th>{t("date")}</th>
                      <th>{t("sd.amount")}</th>
                      <th>{t("status")}</th>
                      <th>{t("ap.payment")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.appointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>#{appointment.id}</td>
                        <td>{appointment.service?.name || "-"}</td>
                        <td>{appointment.employee?.name || "-"}</td>
                        <td>{fmtDate(appointment.startAt)} <span className="soft">{fmtTime(appointment.startAt)}</span></td>
                        <td>{fmtPrice(appointment.paymentAmount ?? appointment.service?.price ?? 0)}</td>
                        <td><Badge tone={STATUS_META[appointment.status]?.tone || "muted"}>{STATUS_META[appointment.status]?.label || appointment.status}</Badge></td>
                        <td><Badge tone={PAYMENT_STATUS_META[appointment.paymentStatus]?.tone || "muted"}>{PAYMENT_STATUS_META[appointment.paymentStatus]?.label || appointment.paymentStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={t("cust.noBookingsInRange")} />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
