export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
}

export function asSafeString(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

export function asSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function deviceTypeFromUserAgent(ua) {
  const value = String(ua || "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("mobile")) return "mobile";
  if (value.includes("tablet")) return "tablet";
  return "desktop";
}

export function normalizePaymentMethod(input) {
  const value = String(input || "").trim().toLowerCase();
  if (value === "upi") return "UPI";
  if (value === "card") return "Card";
  if (value === "bank transfer") return "Bank Transfer";
  if (value === "cash on delivery" || value === "cod") return "COD";
  return "";
}

export function normalizeOrderStatus(input) {
  const value = String(input || "").trim().toLowerCase();
  const allowed = ["new", "confirmed", "packed", "shipped", "delivered", "cancelled"];
  return allowed.includes(value) ? value : "";
}

export function makeOrderNumber() {
  const rand = Math.floor(Math.random() * 900 + 100);
  return `SGH-${Date.now()}-${rand}`;
}

