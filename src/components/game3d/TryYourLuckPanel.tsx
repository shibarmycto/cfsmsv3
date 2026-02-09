import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Dice6, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export type LuckPrize =
  | { kind: "cash"; label: string; cashDelta: number }
  | { kind: "item"; label: string; itemId: string; rarity: "common" | "rare" | "epic" | "legendary" };

interface TryYourLuckPanelProps {
  isOpen: boolean;
  characterId: string;
  cash: number;
  spinCost: number;
  onClose: () => void;
  onCashDelta: (delta: number) => void;
  onPrizeWon: (prize: LuckPrize) => void;
}

const dailyKey = (characterId: string) => `cf_roleplay_luck_${characterId}_day`;
const inventoryKey = (characterId: string) => `cf_roleplay_luck_inventory_${characterId}`;

export default function TryYourLuckPanel({
  isOpen,
  characterId,
  cash,
  spinCost,
  onClose,
  onCashDelta,
  onPrizeWon,
}: TryYourLuckPanelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastPrize, setLastPrize] = useState<LuckPrize | null>(null);

  const prizes = useMemo<LuckPrize[]>(
    () => [
      { kind: "cash", label: "Cash: $2,000", cashDelta: 2000 },
      { kind: "cash", label: "Cash: $10,000", cashDelta: 10000 },
      { kind: "cash", label: "Cash: $50,000", cashDelta: 50000 },

      { kind: "item", label: "BMW M3 (Garage)", itemId: "car_bmw_m3", rarity: "rare" },
      { kind: "item", label: "Lamborghini Urus (Garage)", itemId: "car_lambo_urus", rarity: "epic" },
      { kind: "item", label: "Luxury Penthouse (Property)", itemId: "house_penthouse", rarity: "legendary" },
      { kind: "item", label: "Modern House (Property)", itemId: "house_modern", rarity: "epic" },
      { kind: "item", label: "Pistol (Armory)", itemId: "weapon_pistol", rarity: "rare" },
      { kind: "item", label: "Body Armor (Armory)", itemId: "armor_body", rarity: "epic" },
      { kind: "item", label: "Exclusive Gift Crate", itemId: "gift_crate", rarity: "legendary" },
    ],
    []
  );

  const canSpin = cash >= spinCost;

  const spinsUsedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = localStorage.getItem(dailyKey(characterId));
    if (!stored) return 0;
    const [storedDay, countStr] = stored.split(":");
    if (storedDay !== today) return 0;
    return Number(countStr || 0) || 0;
  }, [characterId]);

  const maxDailySpins = 3;

  const setSpinsUsedToday = useCallback(
    (count: number) => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(dailyKey(characterId), `${today}:${count}`);
    },
    [characterId]
  );

  const addToLocalInventory = useCallback(
    (prize: LuckPrize) => {
      if (prize.kind !== "item") return;
      const raw = localStorage.getItem(inventoryKey(characterId));
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      arr.unshift(prize.itemId);
      localStorage.setItem(inventoryKey(characterId), JSON.stringify(arr.slice(0, 100)));
    },
    [characterId]
  );

  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setLastPrize(null);
    }
  }, [isOpen]);

  const weightedPick = () => {
    // Simple weight system: cash/common more likely, legendary less likely.
    const bag: LuckPrize[] = [];
    for (const p of prizes) {
      if (p.kind === "cash") {
        bag.push(p, p, p, p);
      } else {
        const w = p.rarity === "common" ? 4 : p.rarity === "rare" ? 2 : p.rarity === "epic" ? 1 : 0.5;
        const copies = Math.max(1, Math.floor(w * 4));
        for (let i = 0; i < copies; i++) bag.push(p);
      }
    }
    return bag[Math.floor(Math.random() * bag.length)];
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    if (!canSpin) {
      toast.error(`You need $${spinCost.toLocaleString()} cash to spin.`);
      return;
    }
    if (spinsUsedToday >= maxDailySpins) {
      toast.error("Daily limit reached. Come back tomorrow.");
      return;
    }

    setIsSpinning(true);
    onCashDelta(-spinCost);

    // Short spin animation delay
    await new Promise((r) => setTimeout(r, 900));

    const prize = weightedPick();
    setLastPrize(prize);

    if (prize.kind === "cash") {
      onCashDelta(prize.cashDelta);
      toast.success(`You won ${prize.label}!`);
    } else {
      addToLocalInventory(prize);
      toast.success(`You won: ${prize.label}`);
    }

    onPrizeWon(prize);
    setSpinsUsedToday(spinsUsedToday + 1);

    setIsSpinning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative w-full max-w-xl border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Try Your Luck</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Spin cost</span>
              <span className="font-semibold">${spinCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Your cash</span>
              <span className="font-semibold">${cash.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Daily spins</span>
              <span className="font-semibold">{spinsUsedToday}/{maxDailySpins}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleSpin} disabled={!canSpin || isSpinning || spinsUsedToday >= maxDailySpins}>
            <Dice6 className={"mr-2 h-4 w-4" + (isSpinning ? " animate-spin" : "")} />
            {isSpinning ? "Spinning..." : "SPIN"}
          </Button>

          {lastPrize && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="text-muted-foreground">Last win</div>
              <div className="font-semibold">{lastPrize.label}</div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Prizes include luxury cars, properties, cash, rare weapons, and exclusive gift crates.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
