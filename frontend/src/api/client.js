import axios from "axios";

// عميل axios موحّد. baseURL = /api (Vite proxy يوجّهه للـ backend).
export const api = axios.create({ baseURL: "/api" });

const TOKEN_KEY = "tb_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// حقن التوكن في كل طلب
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// توحيد رسائل الخطأ القادمة من الـ backend
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message || err.message || "حدث خطأ غير متوقع";
    // 401 غير متعلق بمحاولة تسجيل الدخول => انتهت الجلسة
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      tokenStore.clear();
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(new Error(message));
  }
);
