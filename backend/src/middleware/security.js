const defaultWindowMs = 60 * 1000;
const stores = new Map();

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}

export function rateLimit({ name = "default", windowMs = defaultWindowMs, max = 120 } = {}) {
  if (!stores.has(name)) stores.set(name, new Map());
  const hits = stores.get(name);

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${req.path}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message: "طلبات كثيرة خلال وقت قصير. يرجى المحاولة بعد قليل.",
      });
    }

    return next();
  };
}
