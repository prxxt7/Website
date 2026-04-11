import jwt from "jsonwebtoken";
import { config } from "./config.js";

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return "";
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return "";
  }
  return token.trim();
}

export function createAdminToken(email) {
  return jwt.sign(
    {
      role: "admin",
      email: String(email || "").toLowerCase()
    },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

function verifyAdminToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function makeError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyFirebaseCustomerToken(token) {
  if (!config.firebaseWebApiKey) {
    throw makeError("Customer login is not configured on server.", 500);
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.firebaseWebApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );

  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }

  if (!response.ok) {
    throw makeError("Invalid or expired customer login.", 401);
  }

  const account = Array.isArray(payload.users) ? payload.users[0] : null;
  const uid = String(account?.localId || "").trim();
  const email = String(account?.email || "")
    .trim()
    .toLowerCase();
  const phone = String(account?.phoneNumber || "").trim();

  if (!uid || (!email && !phone)) {
    throw makeError("Customer account data is incomplete.", 401);
  }

  return {
    uid,
    email,
    name: String(account?.displayName || "").trim(),
    phone,
    emailVerified: Boolean(account?.emailVerified)
  };
}

export async function optionalCustomer(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      req.customer = null;
      next();
      return;
    }
    req.customer = await verifyFirebaseCustomerToken(token);
    next();
  } catch (_error) {
    req.customer = null;
    next();
  }
}

export async function requireCustomer(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw makeError("Customer login required.", 401);
    }

    req.customer = await verifyFirebaseCustomerToken(token);
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = "Invalid or expired customer login.";
    }
    next(error);
  }
}

export function requireAdmin(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      const error = new Error("Admin login required.");
      error.statusCode = 401;
      throw error;
    }
    const payload = verifyAdminToken(token);
    const email = String(payload.email || "").toLowerCase();
    const role = String(payload.role || "").toLowerCase();
    const isAllowed = role === "admin" && config.adminEmails.includes(email);
    if (!isAllowed) {
      const error = new Error("Admin access denied.");
      error.statusCode = 403;
      throw error;
    }
    req.user = { role: "admin", email };
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = "Invalid or expired admin token.";
    }
    next(error);
  }
}
