import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// التوكن يحمل هوية المستخدم + دوره + businessId (مفتاح العزل بين المحلات).
export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
