import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TradeNotification {
  id: string;
  username: string;
  profit: number;
  token: string;
  timestamp: number;
  isFake?: boolean;
}

const FAKE_USERNAMES = [
  'CryptoKing', 'SolHunter', 'MoonShot99', 'DeFiWhale', 'AlphaTrader',
  'BlockRunner', 'TokenSniper', 'ChainMaster', 'SOLdier', 'PumpKing',
];

const FAKE_TOKENS = [
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SLERF', 'JUP', 'PYTH',
  'WEN', 'MYRO', 'SAMO', 'ORCA', 'RAY', 'DUST',
];

function generateFakeNotification(): TradeNotification {
  const profit = Math.round((Math.random() * 120 + 30) * 10) / 10;
  return {
    id: 'fake-' + Math.random().toString(36).slice(2),
    username: FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)],
    profit,
    token: FAKE_TOKENS[Math.floor(Math.random() * FAKE_TOKENS.length)],
    timestamp: Date.now(),
    isFake: true,
  };
}

function maskUsername(name: string): string {
  if (name.length <= 4) return name.slice(0, 2) + '***';
  return name.slice(0, 3) + '***' + name.slice(-1);
}

export default function LiveTradeNotifications() {
  const [notifications, setNotifications] = useState<TradeNotification[]>([]);
  const fakeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Schedule 3 fake notifications at random times within each hour
  const scheduleFakes = useCallback(() => {
    // Clear old timers
    fakeTimers.current.forEach(clearTimeout);
    fakeTimers.current = [];

    for (let i = 0; i < 3; i++) {
      const delay = Math.random() * 3600000; // random time within the hour
      const timer = setTimeout(() => {
        const fake = generateFakeNotification();
        setNotifications(prev => [fake, ...prev].slice(0, 3));
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== fake.id));
        }, 6000);
      }, delay);
      fakeTimers.current.push(timer);
    }
  }, []);

  // Load recent real notifications on mount
  useEffect(() => {
    const loadRecent = async () => {
      const { data } = await supabase
        .from('trade_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (data && data.length > 0) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          username: row.username,
          profit: Number(row.profit_percent),
          token: row.token_symbol,
          timestamp: new Date(row.created_at).getTime(),
        }));
        // Show the most recent one briefly
        setNotifications([mapped[0]]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== mapped[0].id));
        }, 6000);
      }
    };
    loadRecent();
  }, []);

  // Subscribe to real-time trade notifications
  useEffect(() => {
    const channel = supabase
      .channel('trade-notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_notifications' },
        (payload) => {
          const row = payload.new as any;
          const notif: TradeNotification = {
            id: row.id,
            username: row.username,
            profit: Number(row.profit_percent),
            token: row.token_symbol,
            timestamp: Date.now(),
          };
          setNotifications(prev => [notif, ...prev].slice(0, 3));
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
          }, 6000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Schedule 3 fakes per hour
  useEffect(() => {
    scheduleFakes();
    const hourly = setInterval(scheduleFakes, 3600000);
    return () => {
      clearInterval(hourly);
      fakeTimers.current.forEach(clearTimeout);
    };
  }, [scheduleFakes]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '300px' }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto animate-in slide-in-from-right-full fade-in duration-500 bg-card/95 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-3 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {maskUsername(n.username)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                gained{' '}
                <span className="text-emerald-400 font-bold">+{n.profit}%</span>
                {' '}on{' '}
                <span className="text-primary font-medium">${n.token}</span>
              </p>
            </div>
            <span className="text-[10px] text-emerald-400/70 shrink-0">Solana Signals</span>
          </div>
        </div>
      ))}
    </div>
  );
}
