import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { Spinner } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function AppointmentDelayResponse() {
  const { id, answer } = useParams();
  const { t } = useLanguage();
  const [state, setState] = useState({ loading: true, ok: false, message: "" });

  useEffect(() => {
    const response = answer === "accepted" ? "ACCEPTED" : "REJECTED";
    publicApi.respondDelay(id, response)
      .then(() => {
        setState({
          loading: false,
          ok: true,
          message: response === "ACCEPTED" ? t("delay.accepted") : t("delay.rejected"),
        });
      })
      .catch((err) => setState({ loading: false, ok: false, message: err.message || t("delay.error") }));
  }, [answer, id]);

  if (state.loading) return <Spinner page />;

  return (
    <div className="auth-wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card card-pad text-center" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>{state.ok ? "✓" : "!"}</div>
        <h2 style={{ marginBottom: 10 }}>{state.ok ? t("delay.recorded") : t("delay.errorTitle")}</h2>
        <p className="muted">{state.message}</p>
      </div>
    </div>
  );
}
