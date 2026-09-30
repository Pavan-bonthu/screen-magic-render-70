import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  Download,
  FolderOpen,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerTape } from "@/components/market/TickerTape";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NewTicketDialog } from "@/components/dashboard/NewTicketDialog";
import { TicketDrawer } from "@/components/dashboard/TicketDrawer";
import { Celebration } from "@/components/dashboard/Celebration";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { downloadCsv, fetchTickets, ticketsToCsv } from "@/lib/tickets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IOB LogDesk" },
      { name: "description", content: "Open and closed log tickets, KPIs and uploads." },
      { property: "og:title", content: "Dashboard — IOB LogDesk" },
      { property: "og:description", content: "Track broker log analysis at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const { data: tickets = [], isLoading } = useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });
  const [view, setView] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const closedCount = tickets.length - openCount;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        t.status === view &&
        (!q ||
          t.ticket_number.toLowerCase().includes(q) ||
          t.client_name.toLowerCase().includes(q) ||
          t.engineer_name.toLowerCase().includes(q)),
    );
  }, [tickets, view, search]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  const logout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex size-9 items-center justify-center rounded-lg text-primary-foreground">
              <TrendingUp className="size-5" />
            </div>
            <span className="font-display text-lg font-bold">IOB LogDesk</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{session.name}</div>
              <Badge variant={session.role === "admin" ? "default" : "secondary"} className="capitalize">
                {session.role}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" /> Logout
            </Button>
          </div>
        </div>
        <TickerTape />
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b p-4 md:w-60 md:border-b-0 md:border-r">
          <nav className="flex gap-2 md:flex-col">
            {(
              [
                { key: "open", label: "Open Tickets", icon: FolderOpen, count: openCount },
                { key: "closed", label: "Closed Tickets", icon: CheckCircle2, count: closedCount },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  view === item.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                <span className="ml-auto rounded-full bg-background/20 px-2 text-xs">{item.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 space-y-6 p-4 md:p-6">
          <KpiCards tickets={tickets} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket no, client or engineer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => downloadCsv(`ioblogdesk-${view}-tickets.csv`, ticketsToCsv(visible))}
              disabled={!visible.length}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New ticket
            </Button>
          </div>

          <div className="glass-panel overflow-x-auto rounded-xl">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-display text-lg font-semibold">
                  {view === "open" ? "Markets are calm — no open tickets 📈" : "No closed tickets yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "Try a different search." : "Create a ticket to start collecting logs."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    {["Ticket No", "Client / Broker", "Issue Type", "Algo Type", "Engineer", "Files", "Status", "Created"].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-primary">{t.ticket_number}</td>
                      <td className="px-4 py-3">{t.client_name}</td>
                      <td className="px-4 py-3">{t.issue_type}</td>
                      <td className="px-4 py-3">{t.algo_strategy ?? "—"}</td>
                      <td className="px-4 py-3">{t.engineer_name}</td>
                      <td className="px-4 py-3">{t.filesCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.status === "open" ? "secondary" : "default"} className="capitalize">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(t.created_at), "dd MMM yyyy, HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} session={session} />
      <TicketDrawer
        ticket={selected}
        session={session}
        onClose={() => setSelectedId(null)}
        onClosedTicket={() => {
          setCelebrate(true);
          window.setTimeout(() => setCelebrate(false), 2500);
        }}
      />
      {celebrate ? <Celebration /> : null}
    </div>
  );
}
