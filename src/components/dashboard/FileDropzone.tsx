import { useRef, useState } from "react";
import { FileArchive, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes, MAX_FILE_BYTES } from "@/lib/tickets";

export type PendingFile = {
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const ACCEPT = ".log,.txt,.zip,.gz,.csv,.tar,.tgz,.out,.json,.xml";

export function FileDropzone({
  files,
  onAdd,
  onRemove,
  disabled,
}: {
  files: PendingFile[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onAdd(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-accent/60" : "border-border bg-muted/40 hover:border-primary"
        }`}
      >
        <UploadCloud className="size-7 text-primary" />
        <p className="text-sm font-medium text-foreground">Drop log files here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          .log .txt .zip .gz .csv .tar — up to {formatBytes(MAX_FILE_BYTES)} per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            onAdd(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <FileArchive className="size-4 shrink-0 text-primary" />
                <span className="truncate text-sm text-foreground">{f.file.name}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                  {formatBytes(f.file.size)}
                </span>
                {f.status === "queued" ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => onRemove(i)}
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              {f.status !== "queued" ? (
                <div className="mt-2">
                  <Progress value={f.progress} className="h-1.5" />
                  <p
                    className={`mt-1 text-xs ${
                      f.status === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {f.status === "uploading"
                      ? "Uploading…"
                      : f.status === "done"
                        ? "Stored"
                        : (f.error ?? "Failed")}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
