import axios from "axios";

// عميل axios موحّد. baseURL = /api (Vite proxy يوجّهه للـ backend).
export const api = axios.create({ baseURL: "/api" });

const TOKEN_KEY = "tb_token";

function readToken() {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) return sessionToken;

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

export const tokenStore = {
  get: readToken,
  set: (t) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    localStorage.removeItem(TOKEN_KEY);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },
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
