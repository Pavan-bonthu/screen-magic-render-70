import { createServerFn } from "@tanstack/react-start";


// Reads the JSON saved by twap_export.py --upload from MySQL (table twap_analysis).
// Install:  npm i mysql2
// Env (server side, e.g. .env): MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
// Returns the raw JSON string, or null when no analysis has been uploaded for the ticket.
export const getTwapAnalysis = createServerFn({ method: "GET" })
  .inputValidator((input: { ticketNumber: string }) => input)
  .handler(async ({ data }) => {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection(
      process.env["MYSQL_URL"]!
   );

    try {
      const ticket = data.ticketNumber.replace(/[^A-Za-z0-9_-]/g, "");
      const [rows] = await conn.query("SELECT payload FROM twap_analysis WHERE ticket_number = ?", [ticket]);
      const first = (rows as { payload: string }[])[0];
      return first ? String(first.payload) : null;
    } finally {
      await conn.end();
    }
  });