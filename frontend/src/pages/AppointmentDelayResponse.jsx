import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints.js";
import { Spinner } from "../components/ui.jsx";

export default function AppointmentDelayResponse() {
  const { id, answer } = useParams();
  const [state, setState] = useState({ loading: true, ok: false, message: "" });

  useEffect(() => {
    const response = answer === "accepted" ? "ACCEPTED" : "REJECTED";
    publicApi.respondDelay(id, response)
      .then(() => {
        setState({
          loading: false,
          ok: true,
          message: response === "ACCEPTED"
            ? "تم تثبيت دورك في الوقت الجديد. شكرًا لك."
            : "تم إلغاء الدور وإفراغ الوقت. شكرًا لإبلاغنا.",
        });
      })
      .catch((err) => setState({ loading: false, ok: false, message: err.message || "تعذر تسجيل الرد" }));
  }, [answer, id]);

  if (state.loading) return <Spinner page />;

  return (
    <div className="auth-wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card card-pad text-center" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>{state.ok ? "✓" : "!"}</div>
        <h2 style={{ marginBottom: 10 }}>{state.ok ? "تم تسجيل الرد" : "حدث خطأ"}</h2>
        <p className="muted">{state.message}</p>
      </div>
    </div>
  );
}
