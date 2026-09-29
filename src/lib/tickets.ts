import { supabase } from "@/integrations/supabase/client";

export const LOG_BASE_PATH = "/IOBLOGS";

export const ISSUE_TYPES = [
  "Algo Order",
  "Fixed Order",
  "Connectivity",
  "Market Data",
  "Other",
] as const;

export const ALGO_STRATEGIES = ["TWAP", "VWAP", "POV", "Other"] as const;

export const ROOT_CAUSE_CATEGORIES = [
  "Client Configuration",
  "Exchange / Connectivity",
  "Market Data Feed",
  "Algo Logic",
  "Product Defect",
  "User Error",
  "Other",
] as const;

export const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per file

export type TicketRow = {
  id: string;
  ticket_number: string;
  client_name: string;
  issue_type: string;
  algo_strategy: string | null;
  description: string;
  status: string;
  engineer_id: string;
  engineer_name: string;
  analysis_notes: string | null;
  root_cause_category: string | null;
  fix_applied: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  created_at: string;
};

export type TicketWithFiles = TicketRow & { filesCount: number };

/** Mirrors the on-disk layout /IOBLOGS/<TicketNumber>/ */
export function sanitizeTicketNumber(value: string) {
  return value.trim().replace(/[^A-Za-z0-9_-]/g, "");
}

export function sanitizeFileName(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]/g, "_");
}

export function serverPathFor(ticketNumber: string, fileName?: string) {
  const dir = `${LOG_BASE_PATH}/${sanitizeTicketNumber(ticketNumber)}`;
  return fileName ? `${dir}/${fileName}` : `${dir}/`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export async function fetchTickets(): Promise<TicketWithFiles[]> {
  const [{ data: tickets, error }, { data: files }] = await Promise.all([
    supabase.from("tickets").select("*").order("created_at", { ascending: false }),
    supabase.from("ticket_files").select("ticket_id"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const f of files ?? []) {
    counts.set(f.ticket_id, (counts.get(f.ticket_id) ?? 0) + 1);
  }

  return (tickets ?? []).map((t) => ({ ...t, filesCount: counts.get(t.id) ?? 0 }));
}

export async function fetchTicketFiles(ticketId: string) {
  const { data, error } = await supabase
    .from("ticket_files")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTicketActivity(ticketId: string) {
  const { data, error } = await supabase
    .from("ticket_activity")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function uploadTicketFile(opts: {
  ticketId: string;
  ticketNumber: string;
  file: File;
  userId: string;
  userName: string;
}) {
  const safeTicket = sanitizeTicketNumber(opts.ticketNumber);
  const safeName = sanitizeFileName(opts.file.name);
  // Never overwrite: prefix a timestamp so repeat names coexist.
  const stamped = `${Date.now()}-${safeName}`;
  const storagePath = `${safeTicket}/${stamped}`;

  const { error } = await supabase.storage
    .from("ticket-logs")
    .upload(storagePath, opts.file, { upsert: false });
  if (error) throw error;

  const { error: rowError } = await supabase.from("ticket_files").insert({
    ticket_id: opts.ticketId,
    file_name: safeName,
    storage_path: storagePath,
    size_bytes: opts.file.size,
    uploaded_by: opts.userId,
    uploaded_by_name: opts.userName,
  });
  if (rowError) throw rowError;
}

export async function downloadTicketFile(storagePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from("ticket-logs")
    .createSignedUrl(storagePath, 120, { download: fileName });
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function logActivity(opts: {
  ticketId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
}) {
  await supabase.from("ticket_activity").insert({
    ticket_id: opts.ticketId,
    actor_id: opts.actorId,
    actor_name: opts.actorName,
    action: opts.action,
    detail: opts.detail ?? "",
  });
}

export function ticketsToCsv(rows: TicketWithFiles[]) {
  const header = [
    "Ticket No",
    "Client / Broker",
    "Issue Type",
    "Algo Strategy",
    "Engineer",
    "Files",
    "Status",
    "Created",
    "Closed",
    "Analysis Notes",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.ticket_number,
      r.client_name,
      r.issue_type,
      r.algo_strategy ?? "",
      r.engineer_name,
      r.filesCount,
      r.status,
      new Date(r.created_at).toISOString(),
      r.closed_at ? new Date(r.closed_at).toISOString() : "",
      r.analysis_notes ?? "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.map(escape).join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
