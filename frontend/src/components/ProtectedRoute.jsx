import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "./ui.jsx";

// يحمي المسارات: يتحقق من تسجيل الدخول والدور المسموح.
export function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner page />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
