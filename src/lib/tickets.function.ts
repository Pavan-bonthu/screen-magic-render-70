import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ticketMap = (r: any) => ({
  ...r,
  created_at: new Date(r.created_at).toISOString(),
  closed_at: r.closed_at ? new Date(r.closed_at).toISOString() : null,
  filesCount: Number(r.filesCount ?? 0),
});

export const listTickets = createServerFn({ method: "GET" }).handler(async () => {
  const { pool, requireUser } = await import("@/server/db.server");
  await requireUser();
  const [rows] = await pool.query<any[]>(
    `SELECT t.*, (SELECT COUNT(*) FROM ticket_files f WHERE f.ticket_id=t.id) AS filesCount
     FROM tickets t ORDER BY t.created_at DESC`,
  );
  return rows.map(ticketMap);
});

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    ticket_number: z.string().min(1).max(40), client_name: z.string().min(1).max(120),
    issue_type: z.string(), algo_strategy: z.string().nullable(), description: z.string().max(2000),
  }))
  .handler(async ({ data }) => {
    const { pool, requireUser } = await import("@/server/db.server");
    const { randomUUID } = await import("node:crypto");
    const u = await requireUser();
    const id = randomUUID();
    try {
      await pool.query(
        `INSERT INTO tickets (id,ticket_number,client_name,issue_type,algo_strategy,description,Engineer_id,Engineer_name)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, data.ticket_number, data.client_name, data.issue_type, data.algo_strategy, data.description, u.id, u.full_name],
      );
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") throw new Error(`Ticket ${data.ticket_number} already exists.`);
      throw e;
    }
    return { id };
  });

export const closeTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string(), notes: z.string().min(30).max(4000),
    category: z.string().nullable(), fix: z.string().max(300).nullable(),
  }))
  .handler(async ({ data }) => {
    const { pool, requireUser } = await import("@/server/db.server");
    const u = await requireUser();
    if (u.role !== "admin") throw new Error("Only admins can close tickets.");
    await pool.query(
      `UPDATE tickets SET status='closed', analysis_notes=?, root_cause_category=?, fix_applied=?,
       closed_by=?, closed_by_name=?, closed_at=UTC_TIMESTAMP() WHERE id=?`,
      [data.notes, data.category, data.fix, u.id, u.full_name, data.id],
    );
  });

export const listFiles = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticketId: z.string() }))
  .handler(async ({ data }) => {
    const { pool, requireUser } = await import("@/server/db.server");
    await requireUser();
    const [rows] = await pool.query<any[]>("SELECT * FROM ticket_files WHERE ticket_id=? ORDER BY created_at", [data.ticketId]);
    return rows.map((r) => ({ ...r, size_bytes: Number(r.size_bytes), created_at: new Date(r.created_at).toISOString() }));
  });

export const listActivity = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticketId: z.string() }))
  .handler(async ({ data }) => {
    const { pool, requireUser } = await import("@/server/db.server");
    await requireUser();
    const [rows] = await pool.query<any[]>("SELECT * FROM ticket_activity WHERE ticket_id=? ORDER BY created_at", [data.ticketId]);
    return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
  });

export const addActivity = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ticketId: z.string(), action: z.string(), detail: z.string().default("") }))
  .handler(async ({ data }) => {
    const { pool, requireUser } = await import("@/server/db.server");
    const { randomUUID } = await import("node:crypto");
    const u = await requireUser();
    await pool.query(
      "INSERT INTO ticket_activity (id,ticket_id,actor_id,actor_name,action,detail) VALUES (?,?,?,?,?,?)",
      [randomUUID(), data.ticketId, u.id, u.full_name, data.action, data.detail],
    );
  });