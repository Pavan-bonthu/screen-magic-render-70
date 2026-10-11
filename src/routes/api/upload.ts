import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { pool, requireUser } = await import("@/server/db.server");
        const { createWriteStream } = await import("node:fs");
        const { mkdir } = await import("node:fs/promises");
        const { Readable } = await import("node:stream");
        const { pipeline } = await import("node:stream/promises");
        const { randomUUID } = await import("node:crypto");
        const path = await import("node:path");

        let u;
        try { u = await requireUser(); } catch { return new Response("Unauthorized", { status: 401 }); }

        const url = new URL(request.url);
        const ticketId = url.searchParams.get("ticketId") ?? "";
        const name = (url.searchParams.get("name") ?? "file").replace(/[^A-Za-z0-9._-]/g, "_");
        const [t] = await pool.query<any[]>("SELECT ticket_number FROM tickets WHERE id=?", [ticketId]);
        if (!t[0] || !request.body) return new Response("Bad request", { status: 400 });

        const ticketDir = t[0].ticket_number.replace(/[^A-Za-z0-9_-]/g, "");
        const rel = `${ticketDir}/${Date.now()}-${name}`;
        const abs = path.join(process.env["LOG_ROOT"] ?? "/IOBLOGS", rel);
        await mkdir(path.dirname(abs), { recursive: true });

        await pipeline(Readable.fromWeb(request.body as any), createWriteStream(abs));
        const { size } = await (await import("node:fs/promises")).stat(abs);

        await pool.query(
          `INSERT INTO ticket_files (id,ticket_id,file_name,storage_path,size_bytes,uploaded_by,uploaded_by_name)
           VALUES (?,?,?,?,?,?,?)`,
          [randomUUID(), ticketId, name, rel, size, u.id, u.full_name],
        );
        return Response.json({ ok: true });
      },
    },
  },
});