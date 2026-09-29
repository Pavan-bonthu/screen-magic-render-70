import { Check } from "lucide-react";

const PIECES = Array.from({ length: 28 }, (_, i) => i);

export function Celebration() {
  return (
    <div className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center">
      <div className="animate-tick-pop flex size-24 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg">
        <Check className="size-12" strokeWidth={3} />
      </div>
      {PIECES.map((i) => (
        <span
          key={i}
          className="absolute top-1/3 size-2 rounded-sm"
          style={{
            left: `${8 + (i * 84) / PIECES.length}%`,
            backgroundColor: `var(--color-chart-${(i % 5) + 1})`,
            animation: `confetti-fall ${1 + (i % 7) * 0.16}s ease-in ${(i % 5) * 0.08}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
