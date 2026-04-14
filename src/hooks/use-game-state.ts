import { useState, useEffect, useCallback, useRef } from "react";

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;
  incomePerSecond: number;
  owned: number;
}

const INITIAL_UPGRADES: Upgrade[] = [
  { id: "lemonade", name: "Lemonade Stand", description: "A humble beginning", icon: "🍋", baseCost: 10, incomePerSecond: 0.1, owned: 0 },
  { id: "blog", name: "Blog", description: "Ad revenue adds up", icon: "📝", baseCost: 100, incomePerSecond: 1, owned: 0 },
  { id: "freelance", name: "Freelancing", description: "Sell your skills", icon: "💻", baseCost: 500, incomePerSecond: 5, owned: 0 },
  { id: "stocks", name: "Stock Portfolio", description: "Let money work for you", icon: "📈", baseCost: 2000, incomePerSecond: 20, owned: 0 },
  { id: "rental", name: "Rental Property", description: "Real estate empire", icon: "🏠", baseCost: 10000, incomePerSecond: 100, owned: 0 },
  { id: "startup", name: "Tech Startup", description: "Disrupt the market", icon: "🚀", baseCost: 50000, incomePerSecond: 500, owned: 0 },
];

const SAVE_KEY = "idle2income_save";

function loadState() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function useGameState() {
  const saved = loadState();
  const [money, setMoney] = useState<number>(saved?.money ?? 0);
  const [totalEarned, setTotalEarned] = useState<number>(saved?.totalEarned ?? 0);
  const [clicks, setClicks] = useState<number>(saved?.clicks ?? 0);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(saved?.upgrades ?? INITIAL_UPGRADES);
  const [clickAnimations, setClickAnimations] = useState<{ id: number; x: number; y: number; value: number }[]>([]);
  const animId = useRef(0);

  const clickValue = 1 + Math.floor(clicks / 100) * 0.5;

  const incomePerSecond = upgrades.reduce((sum, u) => sum + u.incomePerSecond * u.owned, 0);

  const getUpgradeCost = useCallback((upgrade: Upgrade) => {
    return Math.floor(upgrade.baseCost * Math.pow(1.15, upgrade.owned));
  }, []);

  const handleClick = useCallback((x: number, y: number) => {
    setMoney((m) => m + clickValue);
    setTotalEarned((t) => t + clickValue);
    setClicks((c) => c + 1);
    const id = animId.current++;
    setClickAnimations((prev) => [...prev, { id, x, y, value: clickValue }]);
    setTimeout(() => {
      setClickAnimations((prev) => prev.filter((a) => a.id !== id));
    }, 800);
  }, [clickValue]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    setUpgrades((prev) => {
      const idx = prev.findIndex((u) => u.id === upgradeId);
      if (idx === -1) return prev;
      const cost = Math.floor(prev[idx].baseCost * Math.pow(1.15, prev[idx].owned));
      if (money < cost) return prev;
      setMoney((m) => m - cost);
      const next = [...prev];
      next[idx] = { ...next[idx], owned: next[idx].owned + 1 };
      return next;
    });
  }, [money]);

  // Passive income tick
  useEffect(() => {
    if (incomePerSecond <= 0) return;
    const interval = setInterval(() => {
      const tick = incomePerSecond / 10;
      setMoney((m) => m + tick);
      setTotalEarned((t) => t + tick);
    }, 100);
    return () => clearInterval(interval);
  }, [incomePerSecond]);

  // Auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ money, totalEarned, clicks, upgrades }));
    }, 5000);
    return () => clearInterval(interval);
  }, [money, totalEarned, clicks, upgrades]);

  return {
    money,
    totalEarned,
    clicks,
    clickValue,
    incomePerSecond,
    upgrades,
    clickAnimations,
    getUpgradeCost,
    handleClick,
    buyUpgrade,
  };
}
