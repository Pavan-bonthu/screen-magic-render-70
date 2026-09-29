import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

const SYMBOLS = [
  { symbol: "NIFTY", base: 24812.4 },
  { symbol: "SENSEX", base: 81344.2 },
  { symbol: "BANKNIFTY", base: 54120.8 },
  { symbol: "RELIANCE", base: 2984.5 },
  { symbol: "TCS", base: 4128.9 },
  { symbol: "HDFCBANK", base: 1702.3 },
  { symbol: "INFY", base: 1874.6 },
  { symbol: "SBIN", base: 842.15 },
  { symbol: "ITC", base: 468.9 },
  { symbol: "USDINR", base: 83.42 },
];

type Quote = { symbol: string; price: number; change: number };

function seedQuotes(): Quote[] {
  return SYMBOLS.map((s, i) => ({
    symbol: s.symbol,
    price: s.base,
    change: ((i % 3) - 1) * 0.42,
  }));
}

export function TickerTape() {
  const [quotes, setQuotes] = useState<Quote[]>(seedQuotes);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuotes((prev) =>
        prev.map((q) => {
          const drift = (Math.random() - 0.5) * (q.price * 0.0012);
          const price = Math.max(1, q.price + drift);
          return { ...q, price, change: (drift / q.price) * 100 * 12 };
        }),
      );
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  const doubled = [...quotes, ...quotes];

  return (
    <div className="relative overflow-hidden border-y border-border bg-card/60">
      <div className="ticker-track whitespace-nowrap py-1.5">
        {doubled.map((q, i) => {
          const up = q.change >= 0;
          return (
            <span
              key={`${q.symbol}-${i}`}
              className="mx-4 inline-flex items-center gap-1.5 font-mono text-xs"
            >
              <span className="font-semibold text-foreground">{q.symbol}</span>
              <span className="text-muted-foreground">
                {q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
              <span className={up ? "text-bull" : "text-bear"}>
                {up ? (
                  <TrendingUp className="inline size-3" />
                ) : (
                  <TrendingDown className="inline size-3" />
                )}{" "}
                {up ? "+" : ""}
                {q.change.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
