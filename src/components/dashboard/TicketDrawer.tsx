import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Download, FileArchive, Lock, ServerCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { closeTicket } from "@/lib/tickets.function";
import type { AppSession } from "@/lib/session";
import {
  ROOT_CAUSE_CATEGORIES,
  MAX_FILE_BYTES,
  downloadTicketFile,
  fetchTicketActivity,
  fetchTicketFiles,
  formatBytes,
  logActivity,
  serverPathFor,
  uploadTicketFile,
  type TicketWithFiles,
} from "@/lib/tickets";
import { FileDropzone, type PendingFile } from "./FileDropzone";

export function TicketDrawer({
  ticket,
  session,
  onClose,
  onClosedTicket,
}: {
  ticket: TicketWithFiles | null;
  session: AppSession;
  onClose: () => void;
  onClosedTicket: () => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [markOpen, setMarkOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [fix, setFix] = useState("");

  const ticketId = ticket?.id ?? "";

  const files = useQuery({
    queryKey: ["ticket-files", ticketId],
    queryFn: () => fetchTicketFiles(ticketId),
    enabled: !!ticketId,
  });

  const activity = useQuery({
    queryKey: ["ticket-activity", ticketId],
    queryFn: () => fetchTicketActivity(ticketId),
    enabled: !!ticketId,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!ticket) return;
      for (let i = 0; i < pending.length; i += 1) {
        setPending((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 35 } : f)),
        );
        await uploadTicketFile({
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          file: pending[i]!.file,
          userId: session.userId,
          userName: session.name,
        });
        setPending((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f)),
        );
      }
      await logActivity({
        ticketId: ticket.id,
        actorId: session.userId,
        actorName: session.name,
        action: "Logs uploaded",
        detail: `${pending.length} file(s) added`,
      });
    },
    onSuccess: () => {
      toast.success("Files added to ticket");
      setPending([]);
      files.refetch();
      activity.refetch();
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const close = useMutation({
  mutationFn: async () => {
    if (!ticket) return;
    if (notes.trim().length < 30) {
      throw new Error("Analysis notes must be at least 30 characters.");
    }
    await closeTicket({
      data: {
        id: ticket.id,
        notes: notes.trim(),
        category: category || null,
        fix: fix.trim() || null,
      },
    });
    await logActivity({
      ticketId: ticket.id,
      actorId: session.userId,
      actorName: session.name,
      action: "Marked as done",
      detail: category ? `Root cause: ${category}` : "Analysis recorded",
    });
  },
  onSuccess: () => {
    setMarkOpen(false);
    setNotes("");
    setCategory("");
    setFix("");
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    activity.refetch();
    onClosedTicket();
    onClose();
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : "Could not close ticket"),
});

  const isAdmin = session.role === "admin";
  const isOpen = ticket?.status === "open";

  return (
    <>
      <Sheet open={!!ticket} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {ticket ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-display">
                  {ticket.ticket_number}
                  <Badge variant={isOpen ? "default" : "secondary"}>
                    {isOpen ? "Open" : "Closed"}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {ticket.client_name} · {ticket.issue_type}
                  {ticket.algo_strategy ? ` · ${ticket.algo_strategy}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Engineer" value={ticket.Engineer_name} />
                  <Field
                    label="Created"
                    value={format(new Date(ticket.created_at), "dd MMM yyyy, HH:mm")}
                  />
                  {ticket.closed_at ? (
                    <>
                      <Field label="Closed by" value={ticket.closed_by_name ?? "—"} />
                      <Field
                        label="Closed at"
                        value={format(new Date(ticket.closed_at), "dd MMM yyyy, HH:mm")}
                      />
                    </>
                  ) : null}
                </div>

                {ticket.description ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {ticket.description}
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 font-mono text-xs text-muted-foreground">
                  <ServerCog className="size-4 shrink-0 text-primary" />
                  {serverPathFor(ticket.ticket_number)}
                </div>

                {ticket.analysis_notes ? (
                  <div className="rounded-xl border border-success/40 bg-success/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <CheckCircle2 className="size-4 text-success" /> Analysis &amp; resolution
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {ticket.analysis_notes}
                    </p>
                    {ticket.root_cause_category ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Root cause: {ticket.root_cause_category}
                      </p>
                    ) : null}
                    {ticket.fix_applied ? (
                      <p className="text-xs text-muted-foreground">Fix: {ticket.fix_applied}</p>
                    ) : null}
                  </div>
                ) : null}

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    Files ({files.data?.length ?? 0})
                  </p>
                  {files.data?.length ? (
                    <ul className="space-y-2">
                      {files.data.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                        >
                          <FileArchive className="size-4 shrink-0 text-primary" />
                          <span className="truncate text-sm">{f.file_name}</span>
                          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                            {formatBytes(Number(f.size_bytes))}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() =>
                              downloadTicketFile(f.id).catch(() => toast.error("Could not open that file"))
                            }
                          >
                            <Download className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      No logs yet — quiet market on this one.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Add more logs</p>
                  <FileDropzone
                    files={pending}
                    onAdd={(incoming) =>
                      setPending((prev) => [
                        ...prev,
                        ...incoming
                          .filter((f) => {
                            if (f.size > MAX_FILE_BYTES) {
                              toast.error(`${f.name} exceeds the 500 MB limit`);
                              return false;
                            }
                            return true;
                          })
                          .map((file) => ({ file, status: "queued" as const, progress: 0 })),
                      ])
                    }
                    onRemove={(i) => setPending((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                  {pending.length ? (
                    <Button
                      className="mt-2 w-full"
                      onClick={() => upload.mutate()}
                      disabled={upload.isPending}
                    >
                      {upload.isPending ? "Uploading…" : `Upload ${pending.length} file(s)`}
                    </Button>
                  ) : null}
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Activity</p>
                  <ol className="space-y-3 border-l border-border pl-4">
                    {(activity.data ?? []).map((a) => (
                      <li key={a.id} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                        <p className="font-medium text-foreground">{a.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.actor_name} · {format(new Date(a.created_at), "dd MMM, HH:mm")}
                          {a.detail ? ` · ${a.detail}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                {isOpen ? (
                  isAdmin ? (
                    <Button className="w-full" onClick={() => setMarkOpen(true)}>
                      <CheckCircle2 className="size-4" /> Mark as Done
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">
                          <Button className="w-full" disabled>
                            <Lock className="size-4" /> Mark as Done
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Admin only</TooltipContent>
                    </Tooltip>
                  )
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Close {ticket?.ticket_number}</DialogTitle>
            <DialogDescription>
              Record the root cause so the team can learn from this later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes">Analysis done / root cause &amp; resolution *</Label>
              <Textarea
                id="notes"
                rows={5}
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What the logs showed, why it happened, how it was resolved…"
              />
              <p className="text-xs text-muted-foreground">
                {notes.trim().length}/30 characters minimum
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Root cause category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {ROOT_CAUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fix">Fix applied</Label>
              <Input
                id="fix"
                value={fix}
                maxLength={300}
                onChange={(e) => setFix(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => close.mutate()}
              disabled={close.isPending || notes.trim().length < 30}
            >
              {close.isPending ? "Closing…" : "Confirm & close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
