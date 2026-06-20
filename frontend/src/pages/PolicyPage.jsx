import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

const content = {
  privacy: [
    ["privacyDataTitle", "privacyData"],
    ["privacyUseTitle", "privacyUse"],
    ["privacySecurityTitle", "privacySecurity"],
  ],
  terms: [
    ["termsUseTitle", "termsUse"],
    ["termsOwnerTitle", "termsOwner"],
    ["termsAvailabilityTitle", "termsAvailability"],
  ],
};

export default function PolicyPage({ type = "privacy" }) {
  const { t } = useLanguage();
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? t("privacyTitle") : t("termsTitle");
  const intro = isPrivacy ? t("privacyIntro") : t("termsIntro");

  return (
    <main className="policy-page">
      <section className="policy-card">
        <div className="policy-head">
          <div>
            <span className="policy-kicker">{t("policies")}</span>
            <h1>{title}</h1>
          </div>
          <Link className="btn btn-ghost" to="/">{t("backHome")}</Link>
        </div>
        <p className="policy-intro">{intro}</p>
        <div className="policy-sections">
          {content[type].map(([heading, body]) => (
            <section key={heading}>
              <h2>{t(heading)}</h2>
              <p>{t(body)}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
