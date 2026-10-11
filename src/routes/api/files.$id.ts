import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { pool, getUser } = await import("@/server/db.server");
        if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
        const { createReadStream } = await import("node:fs");
        const { Readable } = await import("node:stream");
        const path = await import("node:path");
        const [rows] = await pool.query<any[]>("SELECT file_name, storage_path FROM ticket_files WHERE id=?", [params.id]);
        if (!rows[0]) return new Response("Not found", { status: 404 });
        const abs = path.join(process.env["LOG_ROOT"] ?? "/IOBLOGS", rows[0].storage_path);
        return new Response(Readable.toWeb(createReadStream(abs)) as any, {
          headers: {
            "Content-Disposition": `attachment; filename="${rows[0].file_name}"`,
            "Content-Type": "application/octet-stream",
          },
        });
      },
    },
  },
});