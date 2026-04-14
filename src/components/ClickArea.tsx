import { useState } from "react";

interface ClickAreaProps {
  onClickAt: (x: number, y: number) => void;
  clickAnimations: { id: number; x: number; y: number; value: number }[];
  money: number;
}

function formatMoney(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function ClickArea({ onClickAt, clickAnimations, money }: ClickAreaProps) {
  const [pressed, setPressed] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onClickAt(x, y);
    setPressed(true);
    setTimeout(() => setPressed(false), 100);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <button
          onClick={handleClick}
          className={`relative flex h-48 w-48 md:h-56 md:w-56 items-center justify-center rounded-full bg-card border-2 border-primary/30 shadow-[0_0_40px_-10px_var(--primary)] transition-all duration-100 cursor-pointer select-none active:scale-95 hover:shadow-[0_0_60px_-10px_var(--primary)] hover:border-primary/60 ${pressed ? "scale-95" : "scale-100"}`}
          aria-label="Click to earn money"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl md:text-7xl">💰</span>
            <span className="text-sm font-medium text-muted-foreground mt-2">Tap to earn</span>
          </div>
        </button>

        {clickAnimations.map((anim) => (
          <span
            key={anim.id}
            className="pointer-events-none absolute text-primary font-bold text-lg animate-float-up"
            style={{ left: anim.x, top: anim.y }}
          >
            +${anim.value.toFixed(1)}
          </span>
        ))}
      </div>
      <p className="text-3xl md:text-4xl font-bold text-foreground tabular-nums tracking-tight">
        {formatMoney(money)}
      </p>
    </div>
  );
}
