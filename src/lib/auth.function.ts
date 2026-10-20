import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("@/server/db.server");
  const u = await getUser();
  return u ? { userId: u.id, email: u.email, name: u.full_name, role: u.role } : null;
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8) }))
  .handler(async ({ data }) => {
    const { pool } = await import("@/server/db.server");
    const bcrypt = await import("bcryptjs")
    const { randomUUID } = await import("node:crypto");
    try {
      await pool.query(
        "INSERT INTO users (id,email,password_hash,full_name) VALUES (?,?,?,?)",
        [randomUUID(), data.email.toLowerCase(), await bcrypt.hash(data.password, 10), data.name],
      );
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") throw new Error("Email already registered.");
      throw e;
    }
    return { ok: true };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string() }))
  .handler(async ({ data }) => {
    const { pool, newToken } = await import("@/server/db.server");
    const { setCookie } = await import("@tanstack/react-start/server");
    const bcrypt = await import("bcryptjs");
    const [rows] = await pool.query<any[]>("SELECT * FROM users WHERE email=?", [data.email.toLowerCase()]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(data.password, u.password_hash))) {
      throw new Error("Invalid email or password.");
    }
    const token = newToken();
    await pool.query(
      "INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))",
      [token, u.id],
    );
    setCookie("sid", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    return { ok: true };
  });
//  setCookie("sid", token, { httpOnly: true, sameSite: "lax", secure: process.env["NODE_ENV"] === "production", path: "/", maxAge: 7 * 86400 });
   // return { ok: true };//
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { pool } = await import("@/server/db.server");
  const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
  const t = getCookie("sid");
  if (t) await pool.query("DELETE FROM sessions WHERE token=?", [t]);
  deleteCookie("sid", { path: "/" });
});