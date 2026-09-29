/** Animated candlestick + trend-line backdrop for the login screen. */

function candles(seed: number, count: number) {
  let value = 60;
  const bars: { x: number; open: number; close: number; high: number; low: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const wobble = Math.sin((i + seed) * 0.7) * 9 + Math.cos((i + seed) * 1.9) * 5;
    const open = value;
    const close = Math.max(12, Math.min(108, value + wobble));
    bars.push({
      x: i * 18,
      open,
      close,
      high: Math.max(open, close) + 6,
      low: Math.min(open, close) - 6,
    });
    value = close;
  }
  return bars;
}

export function ChartBackdrop() {
  const bars = candles(1, 40);
  const line = bars.map((b, i) => `${i === 0 ? "M" : "L"}${b.x},${120 - b.close}`).join(" ");

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 navy-gradient" />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-primary-glow) 1px, transparent 1px), linear-gradient(to bottom, var(--color-primary-glow) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 30% 40%, black, transparent 75%)",
        }}
      />
      <div className="absolute bottom-0 left-0 h-1/2 w-[200%] animate-chart-drift">
        <svg viewBox="0 0 720 120" className="h-full w-1/2" preserveAspectRatio="none">
          {bars.map((b) => (
            <g key={b.x} opacity="0.45">
              <line
                x1={b.x + 5}
                x2={b.x + 5}
                y1={120 - b.high}
                y2={120 - b.low}
                stroke={b.close >= b.open ? "var(--color-bull)" : "var(--color-bear)"}
                strokeWidth="1.4"
              />
              <rect
                x={b.x}
                y={120 - Math.max(b.open, b.close)}
                width="10"
                height={Math.max(2, Math.abs(b.close - b.open))}
                fill={b.close >= b.open ? "var(--color-bull)" : "var(--color-bear)"}
                rx="1.5"
              />
            </g>
          ))}
          <path
            d={line}
            fill="none"
            stroke="var(--color-primary-glow)"
            strokeWidth="2"
            opacity="0.9"
          />
        </svg>
        <svg
          viewBox="0 0 720 120"
          className="absolute left-1/2 top-0 h-full w-1/2"
          preserveAspectRatio="none"
        >
          {bars.map((b) => (
            <g key={`b-${b.x}`} opacity="0.45">
              <rect
                x={b.x}
                y={120 - Math.max(b.open, b.close)}
                width="10"
                height={Math.max(2, Math.abs(b.close - b.open))}
                fill={b.close >= b.open ? "var(--color-bull)" : "var(--color-bear)"}
                rx="1.5"
              />
            </g>
          ))}
          <path
            d={line}
            fill="none"
            stroke="var(--color-primary-glow)"
            strokeWidth="2"
            opacity="0.9"
          />
        </svg>
      </div>
    </div>
  );
}
