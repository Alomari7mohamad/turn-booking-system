import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { rateLimit, securityHeaders } from "./middleware/security.js";

export function createApp() {
  
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(securityHeaders);
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(rateLimit({ name: "api", windowMs: 60 * 1000, max: 240 }));
app.use("/auth/login", rateLimit({ name: "login", windowMs: 15 * 60 * 1000, max: 10 }));
app.use("/public", rateLimit({ name: "public", windowMs: 60 * 1000, max: 80 }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  if (!env.isProd) app.use(morgan("dev"));

 app.use("/api", routes);
app.use("/", routes);

  // معالجة 404 ثم الأخطاء (يجب أن تكون في النهاية)
  app.use(notFound);
  app.use(errorHandler);

 
  return app;


}
const app = createApp();

export default app;