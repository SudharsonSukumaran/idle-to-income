import type { Upgrade } from "@/hooks/use-game-state";

interface UpgradeShopProps {
  upgrades: Upgrade[];
  money: number;
  getUpgradeCost: (u: Upgrade) => number;
  onBuy: (id: string) => void;
}

function formatMoney(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function UpgradeShop({ upgrades, money, getUpgradeCost, onBuy }: UpgradeShopProps) {
  return (
    <div className="w-full max-w-md">
      <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <span>🏪</span> Income Streams
      </h2>
      <div className="flex flex-col gap-2">
        {upgrades.map((upgrade) => {
          const cost = getUpgradeCost(upgrade);
          const canAfford = money >= cost;
          return (
            <button
              key={upgrade.id}
              onClick={() => canAfford && onBuy(upgrade.id)}
              disabled={!canAfford}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                canAfford
                  ? "border-primary/30 bg-card hover:border-primary/60 hover:shadow-[0_0_20px_-8px_var(--primary)] cursor-pointer"
                  : "border-border bg-card/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="text-2xl">{upgrade.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground text-sm">{upgrade.name}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    x{upgrade.owned}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{upgrade.description}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs font-semibold ${canAfford ? "text-primary" : "text-muted-foreground"}`}>
                    {formatMoney(cost)}
                  </span>
                  <span className="text-xs text-accent">
                    +{formatMoney(upgrade.incomePerSecond)}/s
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
