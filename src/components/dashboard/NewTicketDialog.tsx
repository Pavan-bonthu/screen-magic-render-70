import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { AppSession } from "@/lib/session";
import {
  ALGO_STRATEGIES,
  ISSUE_TYPES,
  MAX_FILE_BYTES,
  logActivity,
  sanitizeTicketNumber,
  serverPathFor,
  uploadTicketFile,
} from "@/lib/tickets";
import { FileDropzone, type PendingFile } from "./FileDropzone";

export function NewTicketDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: AppSession;
}) {
  const queryClient = useQueryClient();
  const [ticketNumber, setTicketNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [issueType, setIssueType] = useState<string>("");
  const [algoStrategy, setAlgoStrategy] = useState<string>("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);

  const reset = () => {
    setTicketNumber("");
    setClientName("");
    setIssueType("");
    setAlgoStrategy("");
    setDescription("");
    setFiles([]);
  };

  const addFiles = (incoming: File[]) => {
    const accepted: PendingFile[] = [];
    for (const file of incoming) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than the 500 MB limit`);
        continue;
      }
      accepted.push({ file, status: "queued", progress: 0 });
    }
    setFiles((prev) => [...prev, ...accepted]);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const safeNumber = sanitizeTicketNumber(ticketNumber);
      if (!safeNumber) throw new Error("Ticket number is required (letters, numbers, - and _).");
      if (!clientName.trim()) throw new Error("Client / broker name is required.");
      if (!issueType) throw new Error("Please choose an issue type.");

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          ticket_number: safeNumber,
          client_name: clientName.trim(),
          issue_type: issueType,
          algo_strategy: issueType === "Algo Order" ? algoStrategy || null : null,
          description: description.trim(),
          engineer_id: session.userId,
          engineer_name: session.name,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          throw new Error(`Ticket ${safeNumber} already exists.`);
        }
        throw error;
      }

      await logActivity({
        ticketId: ticket.id,
        actorId: session.userId,
        actorName: session.name,
        action: "Ticket created",
        detail: `${issueType} · ${clientName.trim()}`,
      });

      for (let i = 0; i < files.length; i += 1) {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 35 } : f)),
        );
        try {
          await uploadTicketFile({
            ticketId: ticket.id,
            ticketNumber: safeNumber,
            file: files[i]!.file,
            userId: session.userId,
            userName: session.name,
          });
          setFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f)),
          );
        } catch (err) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: "error",
                    progress: 100,
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : f,
            ),
          );
        }
      }

      if (files.length) {
        await logActivity({
          ticketId: ticket.id,
          actorId: session.userId,
          actorName: session.name,
          action: "Logs uploaded",
          detail: `${files.length} file(s) stored under ${serverPathFor(safeNumber)}`,
        });
      }

      return safeNumber;
    },
    onSuccess: (safeNumber) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`Ticket ${safeNumber} created`, {
        description: `Logs filed under ${serverPathFor(safeNumber)}`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create ticket"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submit.isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">New ticket &amp; log upload</DialogTitle>
          <DialogDescription>
            Files are filed per ticket, mirroring {serverPathFor("TKT-10245")} on the log server.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Engineer</Label>
            <Input value={session.name} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-number">Ticket number *</Label>
            <Input
              id="ticket-number"
              placeholder="TKT-10245"
              value={ticketNumber}
              maxLength={40}
              onChange={(e) => setTicketNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client">Client / broker *</Label>
            <Input
              id="client"
              placeholder="e.g. Zenith Securities"
              value={clientName}
              maxLength={120}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Issue type *</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {issueType === "Algo Order" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Algo strategy</Label>
              <div className="flex gap-2">
                <Select value={algoStrategy} onValueChange={setAlgoStrategy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGO_STRATEGIES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button type="button" variant="secondary" disabled>
                        <Sparkles className="size-4" /> Auto-Analyze
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon — automated strategy log analysis</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="desc">Description / notes</Label>
            <Textarea
              id="desc"
              rows={3}
              maxLength={2000}
              placeholder="What the client reported, order IDs, timestamps…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Log files</Label>
            <FileDropzone
              files={files}
              onAdd={addFiles}
              onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={submit.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Creating…" : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
