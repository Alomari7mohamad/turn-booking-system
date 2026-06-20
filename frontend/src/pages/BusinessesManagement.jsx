import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/endpoints.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Select, Badge, Spinner, EmptyState, fmtDate, fmtNumber } from "../components/ui.jsx";
import { LogoPicker } from "../components/LogoPicker.jsx";
import { BellIcon } from "../components/Icons.jsx";

const planLabel = (plan, t) => (plan === "YEARLY" ? t("yearly") : t("monthly"));

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function defaultEndDate(plan, startsAt, freeMonths = 0) {
  const start = startsAt ? new Date(`${startsAt}T00:00:00`) : new Date();
  const baseEnd = addDays(start, plan === "YEARLY" ? 365 : 30);
  return toDateInput(addMonths(baseEnd, Number(freeMonths || 0)));
}

function createEmptyForm() {
  const startsAt = toDateInput(new Date());
  return {
    name: "", slug: "", phone: "", address: "",
    ownerName: "", ownerEmail: "", ownerPassword: "", plan: "MONTHLY",
    logoUrl: "",
    brandColor: "#064e3b",
    requiresAppointmentApproval: true,
    startsAt,
    endsAt: defaultEndDate("MONTHLY", startsAt),
    freeMonths: 0,
  };
}

const emptyEditForm = {
  id: null,
  name: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  phone: "",
  address: "",
  logoUrl: "",
  brandColor: "#064e3b",
  requiresAppointmentApproval: true,
};

export default function BusinessesManagement() {
  const toast = useToast();
  const { t } = useLanguage();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // 'create' | 'sub'
  const [form, setForm] = useState(createEmptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [subForm, setSubForm] = useState({
    id: null,
    plan: "MONTHLY",
    price: 0,
    startsAt: toDateInput(new Date()),
    endsAt: defaultEndDate("MONTHLY", toDateInput(new Date())),
    freeMonths: 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  const load = () => adminApi.listBusinesses(search).then((r) => setList(r.businesses));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCreateSubscription = (patch) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      return { ...next, endsAt: defaultEndDate(next.plan, next.startsAt, next.freeMonths) };
    });
  const setRenewSubscription = (patch) =>
    setSubForm((f) => {
      const next = { ...f, ...patch };
      return { ...next, endsAt: defaultEndDate(next.plan, next.startsAt, next.freeMonths) };
    });

  const openCreateModal = () => {
    setForm(createEmptyForm());
    setShowOwnerPassword(false);
    setModal("create");
  };

  const openRenewModal = (business) => {
    const startsAt = toDateInput(new Date());
    setSubForm({
      id: business.id,
      plan: business.subscription?.plan || "MONTHLY",
      price: business.subscription?.price || 0,
      startsAt,
      endsAt: defaultEndDate(business.subscription?.plan || "MONTHLY", startsAt),
      freeMonths: 0,
    });
    setModal("sub");
  };

  const openEditModal = (business) => {
    setShowOwnerPassword(false);
    setEditForm({
      id: business.id,
      name: business.name || "",
      ownerName: business.owner?.name || "",
      ownerEmail: business.owner?.email || "",
      ownerPassword: business.owner?.loginPassword || "",
      phone: business.phone || "",
      address: business.address || "",
      logoUrl: business.logoUrl || "",
      brandColor: business.brandColor || "#064e3b",
      requiresAppointmentApproval: business.requiresAppointmentApproval !== false,
    });
    setModal("edit");
  };

  const createBusiness = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createBusiness(form);
      toast.success("تم إنشاء المحل وحساب صاحبه بنجاح");
      setModal(null);
      setForm(createEmptyForm());
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateBusiness(editForm.id, {
        name: editForm.name,
        ownerName: editForm.ownerName,
        ownerEmail: editForm.ownerEmail,
        ownerPassword: editForm.ownerPassword,
        phone: editForm.phone,
        address: editForm.address,
        logoUrl: editForm.logoUrl,
        brandColor: editForm.brandColor,
        requiresAppointmentApproval: editForm.requiresAppointmentApproval,
      });
      toast.success("تم تحديث بيانات المحل");
      setModal(null);
      setEditForm(emptyEditForm);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doToggle = async () => {
    const b = confirmToggle;
    setConfirmToggle(null);
    try {
      await adminApi.toggleStatus(b.id, !b.isActive);
      toast.success(b.isActive ? "تم إيقاف المحل" : "تم تفعيل المحل");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveSub = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSubscription(subForm.id, {
        plan: subForm.plan,
        price: Number(subForm.price),
        startsAt: subForm.startsAt,
        endsAt: subForm.endsAt,
        freeMonths: Number(subForm.freeMonths || 0),
      });
      toast.success("تم تجديد الاشتراك");
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!list) return <Spinner page />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiringSoon = list.filter((business) => {
    if (!business.subscription?.endsAt) return false;
    const end = new Date(business.subscription.endsAt);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end - today) / 86400000);
    return daysLeft >= 0 && daysLeft <= 7;
  });
  const isExpiringSoon = (business) => expiringSoon.some((item) => item.id === business.id);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("businessesManagementTitle")}</div>
          <div className="page-sub">{t("businessesManagementSub")}</div>
        </div>
        <div className="row wrap" style={{ justifyContent: "flex-start" }}>
          <div className="notifications-menu">
            <Button
              className="notification-bell"
              variant={expiringSoon.length ? "primary" : "ghost"}
              onClick={() => setShowAlerts((value) => !value)}
              aria-label={t("notifications")}
              title={t("notifications")}
            >
              <BellIcon />
              {expiringSoon.length ? <span className="notification-count">{fmtNumber(expiringSoon.length)}</span> : null}
            </Button>
            {showAlerts && (
              <div className="notifications-popover">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("subscriptionsEndingSoon")}</div>
                {expiringSoon.length ? (
                  expiringSoon.map((business) => {
                    const end = new Date(business.subscription.endsAt);
                    end.setHours(0, 0, 0, 0);
                    const daysLeft = Math.ceil((end - today) / 86400000);
                    return (
                      <div key={business.id} className="notification-row">
                        <span>{business.name}</span>
                        <span className="soft">{daysLeft === 0 ? t("endsToday") : `${t("daysLeft")} ${fmtNumber(daysLeft)} ${t("days")}`}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="soft">{t("noExpiringSubscriptions")}</div>
                )}
              </div>
            )}
          </div>
          <Button onClick={openCreateModal}>{t("newBusiness")}</Button>
        </div>
      </div>

      <div className="card card-pad mt-2" style={{ marginBottom: 18 }}>
        <form
          className="row"
          onSubmit={(e) => { e.preventDefault(); load(); }}
        >
          <Input placeholder={t("searchBusinessPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="ghost" type="submit">{t("search")}</Button>
        </form>
      </div>

      <div className="card">
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("business")}</th>
                  <th>{t("owner")}</th>
                  <th className="hide-mobile">{t("statistics")}</th>
                  <th>{t("subscription")}</th>
                  <th>{t("subscriptionStart")}</th>
                  <th>{t("subscriptionEnd")}</th>
                  <th>{t("status")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className={isExpiringSoon(b) ? "subscription-expiring-row" : ""}>
                    <td>
                      <div className="business-cell">
                        {b.logoUrl ? <img src={b.logoUrl} alt={b.name} /> : <span className="business-cell-placeholder">🏪</span>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{b.name}</div>
                          <div className="soft" style={{ fontSize: 12.5 }}>/book/{b.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {b.owner ? (
                        <>
                          <div>{b.owner.name}</div>
                          <div className="soft" style={{ fontSize: 12.5 }}>{b.owner.email}</div>
                        </>
                      ) : <span className="soft">—</span>}
                    </td>
                    <td className="hide-mobile muted" style={{ fontSize: 13 }}>
                      {fmtNumber(b.counts.appointments)} {t("appointmentsShort")} · {fmtNumber(b.counts.employees)} {t("employeesShort")} · {fmtNumber(b.counts.services)} {t("servicesShort")}
                    </td>
                    <td>
                      {b.subscription ? (
                        <Badge tone={b.subscription.plan === "YEARLY" ? "primary" : "info"}>
                          {planLabel(b.subscription.plan, t)}
                        </Badge>
                      ) : <span className="soft">—</span>}
                    </td>
                    <td>{fmtDate(b.subscription?.startsAt)}</td>
                    <td>{fmtDate(b.subscription?.endsAt)}</td>
                    <td>
                      <Badge tone={b.isActive ? "success" : "danger"}>
                        {b.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Link to={`/admin/businesses/${b.id}/control`} className="btn btn-sm btn-primary">
                          {t("control")}
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(b)}>
                          {t("edit")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openRenewModal(b)}>
                          {t("renewSubscription")}
                        </Button>
                        <Button size="sm" variant={b.isActive ? "danger" : "primary"} onClick={() => setConfirmToggle(b)}>
                          {b.isActive ? "إيقاف" : "تفعيل"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🏢" title={t("noBusinesses")} hint={t("addFirstBusinessForStart")} action={<Button onClick={openCreateModal}>{t("newBusiness")}</Button>} />
        )}
      </div>

      {/* إنشاء محل */}
      <Modal
        open={modal === "create"}
        onClose={() => setModal(null)}
        title="إضافة محل جديد"
        large
        closeOnOverlay={false}
        footer={
          <>
            <Button form="create-biz" type="submit" loading={saving}>إنشاء المحل</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>إلغاء</Button>
          </>
        }
      >
        <form id="create-biz" onSubmit={createBusiness} className="col" style={{ gap: 16 }}>
          <div style={{ fontWeight: 700 }}>بيانات المحل</div>
          <div className="grid grid-2">
            <Field label="اسم المحل"><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label="الرابط (slug)" hint="يُترك فارغًا للتوليد التلقائي"><Input value={form.slug} onChange={set("slug")} placeholder="my-salon" /></Field>
            <Field label="الهاتف"><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label="العنوان"><Input value={form.address} onChange={set("address")} /></Field>
            <Field label="شعار المحل">
              <LogoPicker value={form.logoUrl} onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))} onError={toast.error} />
            </Field>
            <Field label="لون المحل">
              <div className="row" style={{ gap: 10 }}>
                <Input className="color-picker" type="color" value={form.brandColor} onChange={set("brandColor")} />
                <span className="soft">{form.brandColor}</span>
              </div>
            </Field>
            <Field label="سياسة تأكيد الحجوزات" hint="للعيادات يمكن تأكيد كل الأدوار تلقائيًا، وللصالونات يمكن مراجعة الدور وقبوله أو رفضه.">
              <Select
                value={form.requiresAppointmentApproval ? "REVIEW" : "AUTO"}
                onChange={(e) => setForm((f) => ({ ...f, requiresAppointmentApproval: e.target.value === "REVIEW" }))}
              >
                <option value="REVIEW">مراجعة الحجوزات قبل التأكيد</option>
                <option value="AUTO">تأكيد كل الحجوزات تلقائيًا</option>
              </Select>
            </Field>
          </div>

          <div style={{ fontWeight: 700, marginTop: 6 }}>حساب صاحب المحل</div>
          <div className="grid grid-2">
            <Field label="الاسم"><Input value={form.ownerName} onChange={set("ownerName")} required /></Field>
            <Field label="البريد الإلكتروني"><Input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} required /></Field>
            <Field label="كلمة المرور"><Input type="text" value={form.ownerPassword} onChange={set("ownerPassword")} required /></Field>
            <Field label="نوع الاشتراك">
              <Select value={form.plan} onChange={(e) => setCreateSubscription({ plan: e.target.value })}>
                <option value="MONTHLY">شهري</option>
                <option value="YEARLY">سنوي</option>
              </Select>
            </Field>
            <Field label="تاريخ بداية الاشتراك">
              <Input type="date" value={form.startsAt} onChange={(e) => setCreateSubscription({ startsAt: e.target.value })} required />
            </Field>
            <Field label="تاريخ نهاية الاشتراك">
              <Input type="date" value={form.endsAt} onChange={set("endsAt")} required />
            </Field>
            <Field label="مدة الفترة المجانية بالأشهر">
              <Input type="number" min="0" value={form.freeMonths} onChange={(e) => setCreateSubscription({ freeMonths: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      {/* تعديل محل */}
      <Modal
        open={modal === "edit"}
        onClose={() => setModal(null)}
        title="تعديل بيانات المحل"
        large
        footer={
          <>
            <Button form="edit-biz" type="submit" loading={saving}>حفظ التغييرات</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>إلغاء</Button>
          </>
        }
      >
        <form id="edit-biz" onSubmit={saveEdit} className="col" style={{ gap: 16 }}>
          <div className="grid grid-2">
            <Field label="اسم المحل"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></Field>
            <Field label="اسم صاحب المحل"><Input value={editForm.ownerName} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} required /></Field>
            <Field label="رقم الهاتف"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
            <Field label="العنوان"><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
            <Field label="البريد الإلكتروني"><Input type="email" value={editForm.ownerEmail} onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })} required /></Field>
            <Field label="كلمة السر">
              <div className="password-input">
                <Input
                  type={showOwnerPassword ? "text" : "password"}
                  value={editForm.ownerPassword}
                  onChange={(e) => setEditForm({ ...editForm, ownerPassword: e.target.value })}
                  placeholder={editForm.ownerPassword ? "" : "غير محفوظة سابقًا"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowOwnerPassword((value) => !value)}
                  aria-label={showOwnerPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                  title={showOwnerPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                >
                  {showOwnerPassword ? "🙈" : "👁"}
                </button>
              </div>
            </Field>
            <Field label="شعار المحل">
              <LogoPicker value={editForm.logoUrl} onChange={(logoUrl) => setEditForm((f) => ({ ...f, logoUrl }))} onError={toast.error} />
            </Field>
            <Field label="لون المحل">
              <div className="row" style={{ gap: 10 }}>
                <Input className="color-picker" type="color" value={editForm.brandColor} onChange={(e) => setEditForm({ ...editForm, brandColor: e.target.value })} />
                <span className="soft">{editForm.brandColor}</span>
              </div>
            </Field>
            <Field label="سياسة تأكيد الحجوزات" hint="اختر هل يحتاج الحجز قبولًا من صاحب المحل أو يتم تأكيده تلقائيًا.">
              <Select
                value={editForm.requiresAppointmentApproval ? "REVIEW" : "AUTO"}
                onChange={(e) => setEditForm((f) => ({ ...f, requiresAppointmentApproval: e.target.value === "REVIEW" }))}
              >
                <option value="REVIEW">مراجعة الحجوزات قبل التأكيد</option>
                <option value="AUTO">تأكيد كل الحجوزات تلقائيًا</option>
              </Select>
            </Field>
          </div>
          <p className="help-text">لا يمكن تغيير الرابط أو الاشتراك من هذه النافذة.</p>
        </form>
      </Modal>

      {/* تعديل الاشتراك */}
      <Modal
        open={modal === "sub"}
        onClose={() => setModal(null)}
        title="تجديد الاشتراك"
        footer={
          <>
            <Button form="sub-form" type="submit" loading={saving}>حفظ</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>إلغاء</Button>
          </>
        }
      >
        <form id="sub-form" onSubmit={saveSub} className="col" style={{ gap: 16 }}>
          <Field label="نوع الاشتراك">
            <Select value={subForm.plan} onChange={(e) => setRenewSubscription({ plan: e.target.value })}>
              <option value="MONTHLY">شهري (30 يومًا)</option>
              <option value="YEARLY">سنوي (365 يومًا)</option>
            </Select>
          </Field>
          <Field label="القيمة (₪)">
            <Input type="number" min="0" value={subForm.price} onChange={(e) => setSubForm({ ...subForm, price: e.target.value })} />
          </Field>
          <div className="grid grid-2">
            <Field label="تاريخ البداية">
              <Input type="date" value={subForm.startsAt} onChange={(e) => setRenewSubscription({ startsAt: e.target.value })} required />
            </Field>
            <Field label="تاريخ النهاية">
              <Input type="date" value={subForm.endsAt} onChange={(e) => setSubForm({ ...subForm, endsAt: e.target.value })} required />
            </Field>
          </div>
          <Field label="المدة المجانية بالأشهر">
            <Input type="number" min="0" value={subForm.freeMonths} onChange={(e) => setRenewSubscription({ freeMonths: e.target.value })} />
          </Field>
          <p className="help-text">سيتم إنشاء اشتراك فعّال جديد بهذه القيم.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.isActive ? "إيقاف المحل" : "تفعيل المحل"}
        message={confirmToggle?.isActive
          ? `سيتم إيقاف "${confirmToggle?.name}" ولن يتمكن صاحبه أو زبائنه من استخدامه.`
          : `سيتم تفعيل "${confirmToggle?.name}".`}
        confirmText={confirmToggle?.isActive ? "إيقاف" : "تفعيل"}
        danger={confirmToggle?.isActive}
        onConfirm={doToggle}
        onClose={() => setConfirmToggle(null)}
      />
    </>
  );
}
