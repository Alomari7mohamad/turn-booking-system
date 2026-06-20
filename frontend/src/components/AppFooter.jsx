import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

export function AppFooter() {
  const { t } = useLanguage();

  return (
    <footer className="app-footer" data-no-auto-translate="true">
      <div className="app-footer-links">
        <Link to="/privacy">{t("privacyPolicy")}</Link>
        <Link to="/terms">{t("sitePolicy")}</Link>
      </div>
      <div className="app-footer-credit">
        {t("builtBy")}{" "}
        <a href="https://oh-tech.co" target="_blank" rel="noreferrer">
          O&amp;H Tech
        </a>
      </div>
    </footer>
  );
}
