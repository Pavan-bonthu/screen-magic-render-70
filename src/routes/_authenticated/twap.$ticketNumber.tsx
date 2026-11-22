import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getTwapAnalysis } from "@/lib/twap.function";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/twap/$ticketNumber")({
  head: () => ({ meta: [{ title: "TWAP Analysis — IOB LogDesk" }] }),
  component: TwapAnalysisPage,
});

type TraceRow = {
  exch_order_no: string;
  seq: string;
  time: string;
  status: string;
  qty: string;
  price: string;
  event: string;
};

type Fill = { qty: number; price: string; time: string; exch_order_no: string };

type Wave = {
  wave_id: string;
  time: string;
  status: string;
  qty: number;
  filled: number;
  remaining: number;
  pending: number | null;
  price: string;
  avg_price: string;
  fill_count: number;
  fills: Fill[];
  trace: TraceRow[];
};

type ExchOrder = {
  exch_order_no: string;
  wave_id: string;
  first_time: string;
  last_status: string;
  qty: string;
  price: string;
  events: TraceRow[];
};

type TwapOrder = {
  basket_id: string;
  trading_symbol: string;
  exchange_seg: string;
  service: string;
  account_id: string;
  transaction: string;
  product: string;
  order_type: string;
  algo_type: string;
  exec_style: string;
  disclosed_qty: string;
  order_duration: string;
  parent_qty: number;
  parent_price: string;
  start_time: string;
  end_time: string;
  statuses: string[];
  summary: {
    total_wave_qty: number;
    total_filled: number;
    total_remaining: number;
    fill_pct: number;
    qty_pending_last: number | null;
    total_fills: number;
    interventions: number;
    pv_updates: number;
  };
  interventions: { time: string; request: string; seq: string; exch_order_no: string }[];
  issues: string[];
  waves: Wave[];
  exch_orders: ExchOrder[];
};

type TwapDoc = { ticket: string; source: string; generated: string; orders: TwapOrder[] };

async function loadAnalysis(ticketNumber: string): Promise<TwapDoc | null> {
  const raw = await getTwapAnalysis({ data: { ticketNumber } });
  return raw ? (JSON.parse(raw) as TwapDoc) : null;
}

function TwapAnalysisPage() {
  const { ticketNumber } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["twap-analysis", ticketNumber],
    queryFn: () => loadAnalysis(ticketNumber),
  });
  const [basket, setBasket] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedNest, setSelectedNest] = useState<string | null>(null);

  const order = useMemo(() => {
    if (!data) return null;
    return data.orders.find((o) => o.basket_id === basket) ?? data.orders[0] ?? null;
  }, [data, basket]);

  const q = search.trim().toLowerCase();
  const nestRows = useMemo(
    () =>
      (order?.exch_orders ?? []).filter(
        (e) => !q || e.exch_order_no.toLowerCase().includes(q) || e.wave_id.toLowerCase() === q,
      ),
    [order, q],
  );
  const selectedOrder = order?.exch_orders.find((e) => e.exch_order_no === selectedNest) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
          <h1 className="font-display text-lg font-bold">TWAP Analysis</h1>
          <span className="font-mono text-sm text-primary">{ticketNumber}</span>
        </div>
      </header>

      <main className="space-y-6 p-4 md:p-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data || !order ? (
          <Card className="glass-panel p-8 text-center">
            <p className="font-display text-lg font-semibold">No TWAP analysis for this ticket yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run this on the log server, then refresh:
            </p>
            <code className="mt-3 inline-block rounded-md bg-muted px-3 py-2 font-mono text-xs">
              python3 twap_export.py --ticket {ticketNumber} --upload
            </code>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Basket ID</span>
              {data.orders.map((o) => (
                <button
                  key={o.basket_id}
                  onClick={() => {
                    setBasket(o.basket_id);
                    setSelectedNest(null);
                  }}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                    o.basket_id === order.basket_id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {o.basket_id}
                  {o.issues.length ? " ⚠" : ""}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                Generated {data.generated}
              </span>
            </div>

            <Card className="glass-panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Symbol" value={order.trading_symbol} />
              <Info label="Side" value={order.transaction} />
              <Info label="Algo" value={order.algo_type} />
              <Info label="Account" value={order.account_id} />
              <Info label="Order type" value={order.order_type} />
              <Info label="Parent qty / price" value={`${order.parent_qty} @ ${order.parent_price}`} />
              <Info label="Window" value={`${order.start_time} → ${order.end_time}`} />
              <Info label="Status flow" value={order.statuses.join(" → ")} />
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Filled" value={`${order.summary.total_filled} (${order.summary.fill_pct}%)`} />
              <Stat label="Remaining" value={String(order.summary.total_remaining)} />
              <Stat label="Qty pending (last)" value={String(order.summary.qty_pending_last ?? "—")} />
              <Stat label="Waves" value={String(order.waves.length)} />
              <Stat label="Nest orders" value={String(order.exch_orders.length)} />
            </div>

            {order.issues.length ? (
              <Card className="border-destructive/40 bg-destructive/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="size-4" /> Issues detected
                </p>
                <ul className="mt-2 list-disc pl-6 text-sm text-foreground">
                  {order.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Nest order no (64001)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs defaultValue="nest">
              <TabsList>
                <TabsTrigger value="nest">By Nest order ID</TabsTrigger>
                <TabsTrigger value="waves">Waves &amp; trace</TabsTrigger>
                <TabsTrigger value="events">Interventions</TabsTrigger>
              </TabsList>

              <TabsContent value="nest" className="space-y-4">
                <Card className="glass-panel overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        {["Nest order no", "Wave", "Time", "Last status", "Qty", "Price", "Events"].map(
                          (h) => (
                            <th key={h} className="px-4 py-3 font-medium">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {nestRows.map((e) => (
                        <tr
                          key={e.exch_order_no}
                          onClick={() => setSelectedNest(e.exch_order_no)}
                          className={`cursor-pointer border-b last:border-0 hover:bg-accent/50 ${
                            e.exch_order_no === selectedNest ? "bg-accent/60" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 font-mono text-primary">{e.exch_order_no}</td>
                          <td className="px-4 py-2.5">{e.wave_id}</td>
                          <td className="px-4 py-2.5 font-mono">{e.first_time}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary">{e.last_status || "—"}</Badge>
                          </td>
                          <td className="px-4 py-2.5">{e.qty}</td>
                          <td className="px-4 py-2.5 font-mono">{e.price}</td>
                          <td className="px-4 py-2.5">{e.events.length}</td>
                        </tr>
                      ))}
                      {nestRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            No Nest order IDs match.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </Card>

                {selectedOrder ? (
                  <Card className="glass-panel p-4">
                    <p className="mb-3 text-sm font-semibold">
                      Events for Nest order{" "}
                      <span className="font-mono text-primary">{selectedOrder.exch_order_no}</span>
                    </p>
                    <TraceTable rows={selectedOrder.events} />
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="waves" className="space-y-4">
                {order.waves.map((w) => (
                  <Card key={w.wave_id} className="glass-panel p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-display font-semibold">Wave {w.wave_id}</span>
                      <Badge variant="secondary">{w.status}</Badge>
                      <span className="text-muted-foreground">
                        {w.time} · qty {w.qty} · filled {w.filled} · pending {w.pending ?? "—"} ·{" "}
                        {w.price}
                      </span>
                    </div>
                    <TraceTable
                      rows={w.trace.filter(
                        (r) => !q || r.exch_order_no.toLowerCase().includes(q),
                      )}
                    />
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="events">
                <Card className="glass-panel overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        {["Time", "Request", "Seq", "Nest order no"].map((h) => (
                          <th key={h} className="px-4 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {order.interventions.map((m, i) => (
                        <tr key={`${m.seq}-${i}`} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-mono">{m.time}</td>
                          <td className="px-4 py-2.5">{m.request}</td>
                          <td className="px-4 py-2.5 font-mono">{m.seq}</td>
                          <td className="px-4 py-2.5 font-mono">{m.exch_order_no || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

function TraceTable({ rows }: { rows: TraceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr className="border-b">
            {["Nest order no", "Seq", "Time", "Status / Request", "Qty", "Price", "Event"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.seq}-${i}`} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-primary">{r.exch_order_no || "—"}</td>
              <td className="px-3 py-2 font-mono">{r.seq}</td>
              <td className="px-3 py-2 font-mono">{r.time}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">{r.qty}</td>
              <td className="px-3 py-2 font-mono">{r.price}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.event}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="glass-panel gap-1 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </Card>
  );
}