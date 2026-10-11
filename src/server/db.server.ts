import mysql from "mysql2/promise";

import {randomBytes} from "node:crypto";

import {getCookie} from "@tanstack/react-start/server";


export const pool =mysql.createPool({
    uri: process.env["MYSQL_URL"]!,
    connectionLimit:10,
    timezone:"Z",
})

export const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function getUser() {
  const token = getCookie("sid");
  if (!token) return null;
  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.email, u.full_name, u.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [token],
  );
  return rows[0] ?? null;
}

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new Error("Unauthorized");
  return u as { id: string; email: string; full_name: string; role: "admin" | "Engineer" };
}

export const newToken = () => randomBytes(32).toString("hex");
