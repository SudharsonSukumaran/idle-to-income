import { createFileRoute } from "@tanstack/react-router";
import { useGameState } from "@/hooks/use-game-state";
import { StatsBar } from "@/components/StatsBar";
import { ClickArea } from "@/components/ClickArea";
import { UpgradeShop } from "@/components/UpgradeShop";

export const Route = createFileRoute("/")({
  component: GamePage,
  head: () => ({
    meta: [
      { title: "Idle2Income - Grow Your Wealth Empire" },
      { name: "description", content: "Click, earn, and build passive income streams in this idle wealth-building game." },
    ],
  }),
});

function GamePage() {
  const {
    money,
    incomePerSecond,
    clickValue,
    clickAnimations,
    upgrades,
    getUpgradeCost,
    handleClick,
    buyUpgrade,
  } = useGameState();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            <span className="text-primary">Idle</span>2<span className="text-accent">Income</span>
          </h1>
          <span className="text-xs text-muted-foreground">v1.0</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">
        <StatsBar money={money} incomePerSecond={incomePerSecond} clickValue={clickValue} />

        <div className="mt-8 flex flex-col md:flex-row items-center md:items-start justify-center gap-10">
          <ClickArea onClickAt={handleClick} clickAnimations={clickAnimations} money={money} />
          <UpgradeShop
            upgrades={upgrades}
            money={money}
            getUpgradeCost={getUpgradeCost}
            onBuy={buyUpgrade}
          />
        </div>
      </main>

      <footer className="border-t border-border px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">Auto-saves every 5 seconds • Built with 💚</p>
      </footer>
    </div>
  );
}
