import { DollarSign, TrendingUp, MousePointerClick } from "lucide-react";

function formatMoney(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

interface StatsBarProps {
  money: number;
  incomePerSecond: number;
  clickValue: number;
}

export function StatsBar({ money, incomePerSecond, clickValue }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 py-4">
      <div className="flex items-center gap-2 rounded-xl bg-card px-5 py-3 shadow-lg border border-border">
        <DollarSign className="h-5 w-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-lg font-bold text-primary tabular-nums">{formatMoney(money)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-card px-5 py-3 shadow-lg border border-border">
        <TrendingUp className="h-5 w-5 text-accent" />
        <div>
          <p className="text-xs text-muted-foreground">Per Second</p>
          <p className="text-lg font-bold text-accent tabular-nums">{formatMoney(incomePerSecond)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-card px-5 py-3 shadow-lg border border-border">
        <MousePointerClick className="h-5 w-5 text-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Per Click</p>
          <p className="text-lg font-bold text-foreground tabular-nums">{formatMoney(clickValue)}</p>
        </div>
      </div>
    </div>
  );
}
