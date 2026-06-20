import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../api/endpoints.js";
import { tokenStore } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // عند الإقلاع: إن وُجد توكن، نجلب بيانات المستخدم لاستعادة الجلسة.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const updateCurrentBusiness = useCallback((business) => {
    setUser((current) => {
      if (!current || !business) return current;
      return { ...current, business: { ...(current.business || {}), ...business } };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateCurrentBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
