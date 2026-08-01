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
const ADMIN_SUBSCRIPTION_ALERTS_KEY = "tb_admin_subscription_alert_states";

function loadAdminSubscriptionAlertStates() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SUBSCRIPTION_ALERTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function subscriptionAlertKey(business) {
  return `${business.id}:${toDateInput(business.subscription?.endsAt)}`;
}

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
    name: "",
    slug: "",
    phone: "",
    address: "",
    mapUrl: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    plan: "MONTHLY",
    logoUrl: "",
    bookingHeroImageUrl: "",
    brandColor: "#064e3b",
    requiresAppointmentApproval: true,
    printScreenEnabled: false,
    reviewsEnabled: false,
    startsAt,
    endsAt: defaultEndDate("MONTHLY", startsAt),
    freeMonths: 0,
  };
}

const emptyEditForm = {
  id: null,
  name: "",
  slug: "",
  email: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  phone: "",
  address: "",
  mapUrl: "",
  timezone: "Asia/Riyadh",
  logoUrl: "",
  bookingHeroImageUrl: "",
  brandColor: "#064e3b",
  isActive: true,
  requiresAppointmentApproval: true,
  printScreenEnabled: false,
  reviewsEnabled: false,
  onlinePaymentEnabled: false,
  payAtStoreEnabled: true,
  subscriptionPlan: "MONTHLY",
  subscriptionPrice: 0,
  subscriptionStartsAt: "",
  subscriptionEndsAt: "",
  subscriptionFreeMonths: 0,
};

function ToggleControl({ checked, onChange, title, description, onLabel, offLabel }) {
  const { t } = useLanguage();
  const onText = onLabel ?? t("bz.on");
  const offText = offLabel ?? t("bz.off");
  return (
    <button
      type="button"
      className={`ios-toggle-card ${checked ? "active" : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="ios-toggle-copy">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="ios-toggle-state">
        <span className="ios-toggle-label">{checked ? onText : offText}</span>
        <span className="ios-toggle-track" aria-hidden="true"><span /></span>
      </span>
    </button>
  );
}

function PasswordEye({ visible }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className="password-eye-icon">
      {visible ? (
        <path fill="currentColor" d="M4.3 3 21 19.7 19.7 21l-3-3A10 10 0 0 1 12 19c-5 0-8.5-4.5-9.5-7a13.2 13.2 0 0 1 3.2-4.35L3 4.3 4.3 3Zm3 6.35A9.4 9.4 0 0 0 4.75 12c1 2.15 3.7 5 7.25 5 1.1 0 2.12-.27 3.02-.7l-1.72-1.72a2.8 2.8 0 0 1-3.88-3.88L7.3 9.35ZM12 5c5 0 8.5 4.5 9.5 7a12.6 12.6 0 0 1-2.25 3.35l-1.42-1.42A9.6 9.6 0 0 0 19.25 12c-1-2.15-3.7-5-7.25-5-.77 0-1.5.13-2.18.36L8.25 5.78A9.5 9.5 0 0 1 12 5Z" />
      ) : (
        <path fill="currentColor" d="M12 5c5 0 8.5 4.5 9.5 7-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7C3.5 9.5 7 5 12 5Zm0 2c-3.55 0-6.25 2.85-7.25 5 1 2.15 3.7 5 7.25 5s6.25-2.85 7.25-5c-1-2.15-3.7-5-7.25-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
      )}
    </svg>
  );
}

function ColorPicker({ value, onChange }) {
  const { t } = useLanguage();
  const color = value || "#064e3b";

  return (
    <label className="color-picker-control">
      <span className="color-picker-swatch" style={{ background: color }} aria-hidden="true" />
      <span className="color-picker-copy">
        <strong>{t("bz.chooseBrandColor")}</strong>
        <small>{color}</small>
      </span>
      <input
        type="color"
        value={color}
        onChange={(event) => onChange(event.target.value)}
        aria-label={t("bz.chooseBrandColorAria")}
      />
    </label>
  );
}

export default function BusinessesManagement() {
  const toast = useToast();
  const { t } = useLanguage();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
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
  const [subscriptionAlertStates, setSubscriptionAlertStates] = useState(loadAdminSubscriptionAlertStates);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  const load = () => adminApi.listBusinesses(search).then((r) => setList(r.businesses));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    localStorage.setItem(ADMIN_SUBSCRIPTION_ALERTS_KEY, JSON.stringify(subscriptionAlertStates));
  }, [subscriptionAlertStates]);
  useEffect(() => {
    const syncAlertStates = (event) => {
      if (event.key === ADMIN_SUBSCRIPTION_ALERTS_KEY) {
        setSubscriptionAlertStates(loadAdminSubscriptionAlertStates());
      }
    };
    window.addEventListener("storage", syncAlertStates);
    return () => window.removeEventListener("storage", syncAlertStates);
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setCreateSubscription = (patch) =>
    setForm((current) => {
      const next = { ...current, ...patch };
      return { ...next, endsAt: defaultEndDate(next.plan, next.startsAt, next.freeMonths) };
    });
  const setRenewSubscription = (patch) =>
    setSubForm((current) => {
      const next = { ...current, ...patch };
      return { ...next, endsAt: defaultEndDate(next.plan, next.startsAt, next.freeMonths) };
    });
  const setEditSubscription = (patch) =>
    setEditForm((current) => {
      const next = { ...current, ...patch };
      if ("subscriptionPlan" in patch || "subscriptionStartsAt" in patch || "subscriptionFreeMonths" in patch) {
        return {
          ...next,
          subscriptionEndsAt: defaultEndDate(next.subscriptionPlan, next.subscriptionStartsAt, next.subscriptionFreeMonths),
        };
      }
      return next;
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
      slug: business.slug || "",
      email: business.email || "",
      ownerName: business.owner?.name || "",
      ownerEmail: business.owner?.email || "",
      ownerPassword: business.owner?.loginPassword || "",
      phone: business.phone || "",
      address: business.address || "",
      mapUrl: business.mapUrl || "",
      timezone: business.timezone || "Asia/Riyadh",
      logoUrl: business.logoUrl || "",
      bookingHeroImageUrl: business.bookingHeroImageUrl || "",
      brandColor: business.brandColor || "#064e3b",
      isActive: business.isActive !== false,
      requiresAppointmentApproval: business.requiresAppointmentApproval !== false,
      printScreenEnabled: business.printScreenEnabled === true,
      reviewsEnabled: business.reviewsEnabled === true,
      onlinePaymentEnabled: business.onlinePaymentEnabled === true,
      payAtStoreEnabled: business.payAtStoreEnabled !== false,
      subscriptionPlan: business.subscription?.plan || "MONTHLY",
      subscriptionPrice: business.subscription?.price || 0,
      subscriptionStartsAt: toDateInput(business.subscription?.startsAt) || toDateInput(new Date()),
      subscriptionEndsAt: toDateInput(business.subscription?.endsAt) || defaultEndDate(business.subscription?.plan || "MONTHLY", toDateInput(new Date())),
      subscriptionFreeMonths: 0,
    });
    setModal("edit");
  };

  const createBusiness = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.createBusiness(form);
      toast.success(t("bz.created"));
      setModal(null);
      setForm(createEmptyForm());
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateBusiness(editForm.id, {
        name: editForm.name,
        slug: editForm.slug,
        email: editForm.email,
        ownerName: editForm.ownerName,
        ownerEmail: editForm.ownerEmail,
        ownerPassword: editForm.ownerPassword,
        phone: editForm.phone,
        address: editForm.address,
        mapUrl: editForm.mapUrl,
        timezone: editForm.timezone,
        logoUrl: editForm.logoUrl,
        bookingHeroImageUrl: editForm.bookingHeroImageUrl,
        brandColor: editForm.brandColor,
        isActive: editForm.isActive,
        requiresAppointmentApproval: editForm.requiresAppointmentApproval,
        printScreenEnabled: editForm.printScreenEnabled,
        reviewsEnabled: editForm.reviewsEnabled,
        onlinePaymentEnabled: editForm.onlinePaymentEnabled,
        payAtStoreEnabled: editForm.payAtStoreEnabled,
        subscriptionPlan: editForm.subscriptionPlan,
        subscriptionPrice: Number(editForm.subscriptionPrice || 0),
        subscriptionStartsAt: editForm.subscriptionStartsAt,
        subscriptionEndsAt: editForm.subscriptionEndsAt,
        subscriptionFreeMonths: Number(editForm.subscriptionFreeMonths || 0),
      });
      toast.success(t("bz.updated"));
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
    const business = confirmToggle;
    setConfirmToggle(null);
    try {
      await adminApi.toggleStatus(business.id, !business.isActive);
      toast.success(business.isActive ? t("bz.deactivated") : t("bz.activated"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveSub = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSubscription(subForm.id, {
        plan: subForm.plan,
        price: Number(subForm.price),
        startsAt: subForm.startsAt,
        endsAt: subForm.endsAt,
        freeMonths: Number(subForm.freeMonths || 0),
      });
      toast.success(t("bz.subRenewed"));
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
  const visibleExpiringSoon = expiringSoon.filter((business) => (
    subscriptionAlertStates[subscriptionAlertKey(business)] !== "deleted"
  ));
  const unreadExpiringSoon = visibleExpiringSoon.filter((business) => (
    subscriptionAlertStates[subscriptionAlertKey(business)] !== "read"
  ));
  const markAllSubscriptionAlertsRead = () => {
    setSubscriptionAlertStates((current) => {
      const next = { ...current };
      visibleExpiringSoon.forEach((business) => {
        next[subscriptionAlertKey(business)] = "read";
      });
      return next;
    });
  };
  const deleteAllSubscriptionAlerts = () => {
    setSubscriptionAlertStates((current) => {
      const next = { ...current };
      visibleExpiringSoon.forEach((business) => {
        next[subscriptionAlertKey(business)] = "deleted";
      });
      return next;
    });
  };
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
              variant={unreadExpiringSoon.length ? "primary" : "ghost"}
              onClick={() => setShowAlerts((value) => !value)}
              aria-label={t("notifications")}
              title={t("notifications")}
            >
              <BellIcon />
              {unreadExpiringSoon.length ? <span className="notification-count">{fmtNumber(unreadExpiringSoon.length)}</span> : null}
            </Button>
            {showAlerts && (
              <div className="notifications-popover">
                <div className="row-between" style={{ marginBottom: 8, gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>{t("subscriptionsEndingSoon")}</div>
                  {visibleExpiringSoon.length ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={markAllSubscriptionAlertsRead}>{t("markAllRead")}</button>
                      <button className="btn btn-ghost btn-sm" onClick={deleteAllSubscriptionAlerts}>{t("deleteAll")}</button>
                    </div>
                  ) : null}
                </div>
                {visibleExpiringSoon.length ? (
                  visibleExpiringSoon.map((business) => {
                    const end = new Date(business.subscription.endsAt);
                    end.setHours(0, 0, 0, 0);
                    const daysLeft = Math.ceil((end - today) / 86400000);
                    const isRead = subscriptionAlertStates[subscriptionAlertKey(business)] === "read";
                    return (
                      <div key={subscriptionAlertKey(business)} className={`notification-row ${isRead ? "is-read" : ""}`}>
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
        <form className="row" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <Input placeholder={t("searchBusinessPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
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
                {list.map((business) => (
                  <tr key={business.id} className={isExpiringSoon(business) ? "subscription-expiring-row" : ""}>
                    <td>
                      <div className="business-cell">
                        <img src={business.logoUrl || "/oh-tech-logo.jpg"} alt={business.name} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{business.name}</div>
                          <div className="soft" style={{ fontSize: 12.5 }}>/book/{business.slug}</div>
                          {business.printScreenEnabled && (
                            <a className="soft" style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 800 }} href={`/print/${business.slug}`} target="_blank" rel="noreferrer">
                              /print/{business.slug}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {business.owner ? (
                        <>
                          <div>{business.owner.name}</div>
                          <div className="soft" style={{ fontSize: 12.5 }}>{business.owner.email}</div>
                        </>
                      ) : <span className="soft">-</span>}
                    </td>
                    <td className="hide-mobile muted" style={{ fontSize: 13 }}>
                      {fmtNumber(business.counts.appointments)} {t("appointmentsShort")} - {fmtNumber(business.counts.employees)} {t("employeesShort")} - {fmtNumber(business.counts.services)} {t("servicesShort")}
                    </td>
                    <td>
                      {business.subscription ? (
                        <Badge tone={business.subscription.plan === "YEARLY" ? "primary" : "info"}>
                          {planLabel(business.subscription.plan, t)}
                        </Badge>
                      ) : <span className="soft">-</span>}
                    </td>
                    <td>{fmtDate(business.subscription?.startsAt)}</td>
                    <td>{fmtDate(business.subscription?.endsAt)}</td>
                    <td>
                      <Badge tone={business.isActive ? "success" : "danger"}>
                        {business.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Link to={`/admin/businesses/${business.id}/control`} className="btn btn-sm btn-primary">{t("control")}</Link>
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(business)}>{t("edit")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => openRenewModal(business)}>{t("renewSubscription")}</Button>
                        <Button size="sm" variant={business.isActive ? "danger" : "primary"} onClick={() => setConfirmToggle(business)}>
                          {business.isActive ? t("deactivate") : t("activate")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("noBusinesses")} hint={t("addFirstBusinessForStart")} action={<Button onClick={openCreateModal}>{t("newBusiness")}</Button>} />
        )}
      </div>

      <BusinessFormModal
        mode="create"
        open={modal === "create"}
        saving={saving}
        form={form}
        setForm={setForm}
        showOwnerPassword={showOwnerPassword}
        setShowOwnerPassword={setShowOwnerPassword}
        onClose={() => setModal(null)}
        onSubmit={createBusiness}
        setValue={set}
        setSubscription={setCreateSubscription}
      />

      <BusinessFormModal
        mode="edit"
        open={modal === "edit"}
        saving={saving}
        form={editForm}
        setForm={setEditForm}
        showOwnerPassword={showOwnerPassword}
        setShowOwnerPassword={setShowOwnerPassword}
        onClose={() => setModal(null)}
        onSubmit={saveEdit}
        setSubscription={setEditSubscription}
      />

      <Modal
        open={modal === "sub"}
        onClose={() => setModal(null)}
        title={t("renewSubscription")}
        footer={
          <>
            <Button form="sub-form" type="submit" loading={saving}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("cancel")}</Button>
          </>
        }
      >
        <form id="sub-form" onSubmit={saveSub} className="col" style={{ gap: 16 }}>
          <Field label={t("bz.planType")}>
            <Select value={subForm.plan} onChange={(event) => setRenewSubscription({ plan: event.target.value })}>
              <option value="MONTHLY">{t("bz.monthly30")}</option>
              <option value="YEARLY">{t("bz.yearly365")}</option>
            </Select>
          </Field>
          <Field label={t("bz.value")}>
            <Input type="number" min="0" value={subForm.price} onChange={(event) => setSubForm({ ...subForm, price: event.target.value })} />
          </Field>
          <div className="grid grid-2">
            <Field label={t("wh.startDate")}>
              <Input type="date" value={subForm.startsAt} onChange={(event) => setRenewSubscription({ startsAt: event.target.value })} required />
            </Field>
            <Field label={t("wh.endDate")}>
              <Input type="date" value={subForm.endsAt} onChange={(event) => setSubForm({ ...subForm, endsAt: event.target.value })} required />
            </Field>
          </div>
          <Field label={t("bz.freeMonths")}>
            <Input type="number" min="0" value={subForm.freeMonths} onChange={(event) => setRenewSubscription({ freeMonths: event.target.value })} />
          </Field>
          <p className="help-text">{t("bz.subCreateHint")}</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.isActive ? t("bz.deactivateTitle") : t("bz.activateTitle")}
        message={confirmToggle?.isActive ? t("bz.deactivateMsg", { name: confirmToggle?.name }) : t("bz.activateMsg", { name: confirmToggle?.name })}
        confirmText={confirmToggle?.isActive ? t("deactivate") : t("activate")}
        danger={confirmToggle?.isActive}
        onConfirm={doToggle}
        onClose={() => setConfirmToggle(null)}
      />
    </>
  );
}

function BusinessFormModal({
  mode,
  open,
  saving,
  form,
  setForm,
  showOwnerPassword,
  setShowOwnerPassword,
  onClose,
  onSubmit,
  setSubscription,
}) {
  const { t } = useLanguage();
  const isEdit = mode === "edit";
  const formId = isEdit ? "edit-biz" : "create-biz";
  const title = isEdit ? t("bz.editTitle") : t("bz.createTitle");

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const inputValue = (key) => form[key] ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      large
      closeOnOverlay={!isEdit ? false : undefined}
      footer={
        <>
          <Button form={formId} type="submit" loading={saving}>{isEdit ? t("wh.saveChanges") : t("bz.createBtn")}</Button>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="col" style={{ gap: 16 }}>
        <div style={{ fontWeight: 800 }}>{t("bz.businessData")}</div>
        <div className="grid grid-2">
          <Field label={t("bs.businessName")}><Input value={inputValue("name")} onChange={(event) => update("name", event.target.value)} required /></Field>
          <Field label={t("bz.slug")} hint={t("bz.slugHint")}>
            <Input value={inputValue("slug")} onChange={(event) => update("slug", event.target.value)} placeholder="my-salon" />
          </Field>
          <Field label={t("phone")}><Input value={inputValue("phone")} onChange={(event) => update("phone", event.target.value)} /></Field>
          <Field label={t("bz.businessEmail")}><Input type="email" value={inputValue("email")} onChange={(event) => update("email", event.target.value)} /></Field>
          <Field label={t("bs.address")}><Input value={inputValue("address")} onChange={(event) => update("address", event.target.value)} /></Field>
          <Field label={t("bz.mapUrl")}><Input value={inputValue("mapUrl")} onChange={(event) => update("mapUrl", event.target.value)} placeholder="https://waze.com/ul/..." /></Field>
          <Field label={t("storeLogo")}>
            <LogoPicker
              value={form.logoUrl}
              onChange={(logoUrl) => update("logoUrl", logoUrl)}
              chooseText={t("lp.chooseLogo")}
              changeText={t("lp.changeLogo")}
              removeText={t("lp.removeLogo")}
              previewAlt={t("lp.logoAlt")}
            />
          </Field>
          <Field label={t("bs.heroImage")}>
            <LogoPicker
              value={form.bookingHeroImageUrl}
              onChange={(bookingHeroImageUrl) => update("bookingHeroImageUrl", bookingHeroImageUrl)}
              chooseText={t("svc.chooseImage")}
              changeText={t("svc.changeImage")}
              removeText={t("svc.removeImage")}
              previewAlt={t("bs.heroImage")}
              imageOptions={{ maxSize: 1100, minSize: 360, quality: 0.8, maxBytes: 520 * 1024 }}
            />
          </Field>
          <Field label={t("bs.brandColor")}><ColorPicker value={form.brandColor} onChange={(brandColor) => update("brandColor", brandColor)} /></Field>
        </div>

        <div style={{ fontWeight: 800, marginTop: 8 }}>{t("bz.ownerAccount")}</div>
        <div className="grid grid-2">
          <Field label={t("bz.ownerName")}><Input value={inputValue("ownerName")} onChange={(event) => update("ownerName", event.target.value)} required /></Field>
          <Field label={t("email")}><Input type="email" value={inputValue("ownerEmail")} onChange={(event) => update("ownerEmail", event.target.value)} required /></Field>
          <Field label={t("password")}>
            <div className="password-field">
              <Input
                type={showOwnerPassword ? "text" : "password"}
                value={inputValue("ownerPassword")}
                onChange={(event) => update("ownerPassword", event.target.value)}
                placeholder={isEdit ? t("bz.leaveBlank") : ""}
                required={!isEdit}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowOwnerPassword((value) => !value)}
                aria-label={showOwnerPassword ? t("hidePassword") : t("showPassword")}
                title={showOwnerPassword ? t("hidePassword") : t("showPassword")}
              >
                <PasswordEye visible={showOwnerPassword} />
              </button>
            </div>
          </Field>
        </div>

        <div style={{ fontWeight: 800, marginTop: 8 }}>{t("bz.bookingSettings")}</div>
        <div className="grid grid-2">
          <Field label={t("bz.approvalPolicy")} hint={t("bz.approvalPolicyHint")}>
            <ToggleControl
              checked={form.requiresAppointmentApproval}
              onChange={(value) => update("requiresAppointmentApproval", value)}
              title={t("bz.reviewBookings")}
              description={form.requiresAppointmentApproval ? t("bz.approvalOn") : t("bz.approvalOff")}
              onLabel={t("bz.reviewLabel")}
              offLabel={t("bz.autoLabel")}
            />
          </Field>
          <Field label={t("bz.printScreen")} hint={t("bz.printScreenHint")}>
            <ToggleControl
              checked={form.printScreenEnabled}
              onChange={(value) => update("printScreenEnabled", value)}
              title={t("bz.enablePrint")}
              description={t("bz.enablePrintDesc")}
            />
          </Field>
          <Field label={t("bz.reviewsSystem")} hint={t("bz.reviewsSystemHint")}>
            <ToggleControl
              checked={form.reviewsEnabled}
              onChange={(value) => update("reviewsEnabled", value)}
              title={t("bz.enableReviews")}
              description={t("bz.enableReviewsDesc")}
            />
          </Field>
          {isEdit && (
            <>
              <Field label={t("bz.enableBusiness")}><ToggleControl checked={form.isActive} onChange={(value) => update("isActive", value)} title={t("bz.enableBusiness")} description={t("bz.enableBusinessDesc")} /></Field>
              <Field label={t("bs.onlinePayment")}><ToggleControl checked={form.onlinePaymentEnabled} onChange={(value) => update("onlinePaymentEnabled", value)} title={t("bz.enableOnline")} description={t("bz.enableOnlineDesc")} /></Field>
              <Field label={t("pb.payAtStore")}><ToggleControl checked={form.payAtStoreEnabled} onChange={(value) => update("payAtStoreEnabled", value)} title={t("bz.enableStore")} description={t("bz.enableStoreDesc")} /></Field>
            </>
          )}
        </div>

        <div style={{ fontWeight: 800, marginTop: 8 }}>{t("subscription")}</div>
        <div className="grid grid-2">
          <Field label={t("bz.planType")}>
            <Select
              value={isEdit ? form.subscriptionPlan : form.plan}
              onChange={(event) => isEdit ? setSubscription({ subscriptionPlan: event.target.value }) : setSubscription({ plan: event.target.value })}
            >
              <option value="MONTHLY">{t("monthly")}</option>
              <option value="YEARLY">{t("yearly")}</option>
            </Select>
          </Field>
          <Field label={t("bz.value")}>
            <Input
              type="number"
              min="0"
              value={isEdit ? form.subscriptionPrice : (form.price || 0)}
              onChange={(event) => isEdit ? update("subscriptionPrice", event.target.value) : update("price", event.target.value)}
            />
          </Field>
          <Field label={t("bz.subStart")}>
            <Input
              type="date"
              value={isEdit ? form.subscriptionStartsAt : form.startsAt}
              onChange={(event) => isEdit ? setSubscription({ subscriptionStartsAt: event.target.value }) : setSubscription({ startsAt: event.target.value })}
              required
            />
          </Field>
          <Field label={t("bz.subEnd")}>
            <Input
              type="date"
              value={isEdit ? form.subscriptionEndsAt : form.endsAt}
              onChange={(event) => isEdit ? update("subscriptionEndsAt", event.target.value) : update("endsAt", event.target.value)}
              required
            />
          </Field>
          <Field label={t("bz.freeMonths")}>
            <Input
              type="number"
              min="0"
              value={isEdit ? form.subscriptionFreeMonths : form.freeMonths}
              onChange={(event) => isEdit ? setSubscription({ subscriptionFreeMonths: event.target.value }) : setSubscription({ freeMonths: event.target.value })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}



