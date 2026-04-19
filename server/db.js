import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool({
  host: config.dbHost,
  port: config.dbPort,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  connectTimeout: config.dbConnectTimeoutMs,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: config.dbSsl !== false ? { rejectUnauthorized: true } : false
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export function withTimeout(promise, timeoutMs, label = "Operation timed out.") {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const error = new Error(label);
      error.code = "TIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timerId);
  });
}

export async function pingDatabase(timeoutMs = config.dbConnectTimeoutMs) {
  await withTimeout(query("SELECT 1 AS ok"), timeoutMs, "Database ping timed out.");
  return true;
}
