import { useEffect, useState } from "react";
import { AlarmClock, CheckCircle2, FileSearch, Layers, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { TicketWithFiles } from "@/lib/tickets";

function useCountUp(target: number, decimals = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value.toFixed(decimals);
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(1, ...points);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 100},${28 - (p / max) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-24" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--color-primary-glow)" strokeWidth="2" />
    </svg>
  );
}

function Kpi({
  label,
  value,
  decimals,
  suffix,
  icon,
  spark,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon: React.ReactNode;
  spark: number[];
}) {
  const shown = useCountUp(value, decimals ?? 0);
  return (
    <Card className="glass-panel hover-lift animate-rise-in gap-2 p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="kpi-glow font-display text-3xl font-bold text-foreground">
          {shown}
          {suffix ? <span className="ml-1 text-base text-muted-foreground">{suffix}</span> : null}
        </span>
        <Sparkline points={spark} />
      </div>
    </Card>
  );
}

function sparkFor(rows: TicketWithFiles[], predicate: (t: TicketWithFiles) => boolean) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  return days.map((d) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return rows.filter((t) => {
      const created = new Date(t.created_at);
      return predicate(t) && created >= d && created < next;
    }).length;
  });
}

export function KpiCards({ tickets }: { tickets: TicketWithFiles[] }) {
  const open = tickets.filter((t) => t.status === "open");
  const pendingAnalysis = open.filter((t) => t.filesCount > 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const closedToday = tickets.filter(
    (t) => t.closed_at && new Date(t.closed_at) >= todayStart,
  ).length;
  const algoOpen = open.filter((t) => t.issue_type === "Algo Order").length;

  const closed = tickets.filter((t) => t.closed_at);
  const avgHours = closed.length
    ? closed.reduce(
        (sum, t) =>
          sum + (new Date(t.closed_at!).getTime() - new Date(t.created_at).getTime()) / 3_600_000,
        0,
      ) / closed.length
    : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        label="Open Tickets"
        value={open.length}
        icon={<Layers className="size-4" />}
        spark={sparkFor(tickets, (t) => t.status === "open")}
      />
      <Kpi
        label="Pending Log Analysis"
        value={pendingAnalysis.length}
        icon={<FileSearch className="size-4" />}
        spark={sparkFor(tickets, (t) => t.status === "open" && t.filesCount > 0)}
      />
      <Kpi
        label="Closed Today"
        value={closedToday}
        icon={<CheckCircle2 className="size-4" />}
        spark={sparkFor(tickets, (t) => !!t.closed_at)}
      />
      <Kpi
        label="Algo Order Issues"
        value={algoOpen}
        icon={<Zap className="size-4" />}
        spark={sparkFor(tickets, (t) => t.issue_type === "Algo Order")}
      />
      <Kpi
        label="Avg Resolution"
        value={avgHours}
        decimals={1}
        suffix="hrs"
        icon={<AlarmClock className="size-4" />}
        spark={sparkFor(tickets, (t) => !!t.closed_at)}
      />
    </div>
  );
}
