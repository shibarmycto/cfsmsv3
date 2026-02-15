import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, X } from 'lucide-react';

interface TradeNotification {
  id: string;
  username: string;
  profit: number;
  token: string;
  timestamp: number;
}

const USERNAMES = [
  'CryptoKing', 'SolHunter', 'MoonShot99', 'DeFiWhale', 'AlphaTrader',
  'BlockRunner', 'TokenSniper', 'ChainMaster', 'SOLdier', 'PumpKing',
  'DiamondHands', 'FlashBot', 'NightOwl', 'SwapLord', 'PhantomAce',
  'RocketFuel', 'ByteTrader', 'SolSurfer', 'MintMaster', 'LiquidGold',
];

const TOKENS = [
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SLERF', 'JUP', 'PYTH',
  'WEN', 'MYRO', 'SAMO', 'ORCA', 'RAY', 'MNGO', 'STEP', 'COPE',
  'FIDA', 'SRM', 'ATLAS', 'POLIS', 'DUST', 'FORGE', 'HONEY', 'RAIN',
];

function generateNotification(): TradeNotification {
  const profit = Math.round((Math.random() * 180 + 20) * 10) / 10;
  return {
    id: Math.random().toString(36).slice(2),
    username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
    profit,
    token: TOKENS[Math.floor(Math.random() * TOKENS.length)],
    timestamp: Date.now(),
  };
}

export default function LiveTradeNotifications() {
  const [notifications, setNotifications] = useState<TradeNotification[]>([]);

  const addNotification = useCallback(() => {
    const notif = generateNotification();
    setNotifications(prev => [notif, ...prev].slice(0, 3));
    // Auto-remove after 5s
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    }, 5000);
  }, []);

  useEffect(() => {
    // First notification after 3s
    const initialTimeout = setTimeout(addNotification, 3000);
    // Then every 6-12s randomly
    const interval = setInterval(() => {
      addNotification();
    }, 6000 + Math.random() * 6000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [addNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '320px' }}>
      {notifications.map((n, i) => (
        <div
          key={n.id}
          className="pointer-events-auto animate-in slide-in-from-right-full fade-in duration-500 bg-card/95 backdrop-blur-xl border border-green-500/30 rounded-xl p-3 shadow-2xl"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {n.username.slice(0, 4)}***{n.username.slice(-2)}
              </p>
              <p className="text-xs text-muted-foreground">
                gained{' '}
                <span className="text-green-400 font-bold">+{n.profit}%</span>
                {' '}on{' '}
                <span className="text-primary font-medium">${n.token}</span>
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[10px] text-muted-foreground">Solana Signals</span>
              <span className="text-[10px] text-green-400/70">just now</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
