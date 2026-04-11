import dotenv from "dotenv";

dotenv.config();

function asNumber(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function asList(input) {
  if (!input) {
    return [];
  }
  return String(input)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: asNumber(process.env.PORT, 8080),
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: asNumber(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER || "spy_app",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "spy_glass_house",
  adminEmails: asList(process.env.ADMIN_EMAILS).map((item) => item.toLowerCase()),
  adminLoginEmail: String(process.env.ADMIN_LOGIN_EMAIL || "").toLowerCase(),
  adminLoginPassword: String(process.env.ADMIN_LOGIN_PASSWORD || ""),
  firebaseWebApiKey: String(process.env.FIREBASE_WEB_API_KEY || ""),
  jwtSecret: String(process.env.JWT_SECRET || "change-me-now"),
  corsOrigins: asList(process.env.CORS_ORIGIN)
};
