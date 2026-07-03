import { useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { Badge, Button, EmptyState, Field, Input, Spinner, fmtDate, fmtNumber, fmtPrice } from "../components/ui.jsx";

function monthInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function averageReview(review) {
  const values = [review.serviceRating, review.employeeRating, review.businessRating].map(Number).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Stars({ value }) {
  const rounded = Math.round(Number(value || 0) * 2) / 2;
  return (
    <span className="rating-stars" aria-label={`${rounded} من 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        return <span key={starValue} className={rounded >= starValue ? "filled" : rounded >= starValue - 0.5 ? "half" : ""}>★</span>;
      })}
    </span>
  );
}

export default function CustomersPage() {
  const { api } = useBusinessManage();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(monthInput());
  const [pointsPercent, setPointsPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [reviewsTarget, setReviewsTarget] = useState(null);
  const [reviews, setReviews] = useState(null);

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
      toast.success("تم حفظ نسبة النقاط");
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

  if (!data) return <Spinner page />;

  if (!data.enabled) {
    return (
      <EmptyState
        title="مجمع الزبائن غير مفعل لهذا المحل"
        hint="يمكن لصاحب المحل تفعيل مجمع الزبائن من إعدادات المحل."
      />
    );
  }

  const summary = data.summary || {};

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">الزبائن</div>
          <div className="page-sub">مجمع الزبائن، عدد الزيارات، المدفوعات الشهرية ونقاط الولاء.</div>
        </div>
      </div>

      <div className="customer-summary-grid">
        <div className="card card-pad">
          <span className="soft">إجمالي الزبائن</span>
          <strong>{fmtNumber(summary.customers)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">زيارات الشهر</span>
          <strong>{fmtNumber(summary.monthlyVisits)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">مدفوعات الشهر</span>
          <strong>{fmtPrice(summary.monthlyPaid)}</strong>
        </div>
        <div className="card card-pad">
          <span className="soft">مجموع النقاط</span>
          <strong>{fmtNumber(summary.points)}</strong>
        </div>
      </div>

      <div className="card card-pad mt-3">
        <div className="customers-toolbar">
          <Field label="الشهر">
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
          <Field label="بحث">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="اسم، هاتف، بريد..." />
          </Field>
          <form onSubmit={saveSettings} className="customers-points-form">
            <Field label="نسبة النقاط من قيمة الدفع">
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
                <Button type="submit" size="sm" loading={saving}>حفظ</Button>
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
                  <th>الزبون</th>
                  <th>الهاتف</th>
                  <th>زيارات الشهر</th>
                  <th>مدفوعات الشهر</th>
                  <th>كل الزيارات</th>
                  <th>كل المدفوعات</th>
                  <th>النقاط</th>
                  <th>آخر زيارة</th>
                  <th>التقييمات</th>
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
                    <td><Button size="sm" variant="ghost" onClick={() => openReviews(customer)}>رؤية التقييمات</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="لا يوجد زبائن" hint="سيظهر كل شخص يقوم بحجز دور هنا تلقائيًا." />
        )}
      </div>

      <Modal
        open={!!reviewsTarget}
        onClose={() => setReviewsTarget(null)}
        title={reviewsTarget ? `تقييمات ${reviewsTarget.name}` : "التقييمات"}
        footer={<Button variant="ghost" onClick={() => setReviewsTarget(null)}>إغلاق</Button>}
      >
        {!reviews ? <Spinner /> : reviews.length ? (
          <div className="col" style={{ gap: 12 }}>
            {reviews.map((review) => (
              <div key={review.id} className="card card-pad" style={{ boxShadow: "none" }}>
                <div className="row-between">
                  <strong>{review.service?.name || "-"}</strong>
                  <Stars value={averageReview(review)} />
                </div>
                <div className="soft mt-1" style={{ fontSize: 13 }}>
                  {review.employee?.name || "-"} · {review.appointment?.startAt ? fmtDate(review.appointment.startAt) : fmtDate(review.createdAt)}
                </div>
                <div className="row wrap mt-2" style={{ gap: 8 }}>
                  <Badge tone="info">الخدمة {review.serviceRating}/5</Badge>
                  <Badge tone="success">العامل {review.employeeRating}/5</Badge>
                  <Badge tone="warning">المحل {review.businessRating}/5</Badge>
                </div>
                {review.comment && <p className="mt-2" style={{ marginBottom: 0 }}>{review.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="لا توجد تقييمات لهذا الزبون" />
        )}
      </Modal>
    </div>
  );
}
