import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Zap, Wallet, TrendingUp, RefreshCw, Play, Square, 
  Eye, EyeOff, Copy, ExternalLink, Shield, Clock, Coins,
  Bell, Activity, BarChart3, History, AlertTriangle, 
  ChevronRight, Wifi, WifiOff, DollarSign, ShoppingCart, ArrowRightLeft, Settings
} from 'lucide-react';

interface Signal {
  id: string;
  type: 'NEW_TOKEN_LAUNCH' | 'WHALE_BUY' | 'SNIPE_OPPORTUNITY' | 'PRICE_SPIKE';
  token_name: string;
  token_symbol: string;
  mint_address: string;
  market_cap_usd: number;
  liquidity_usd: number;
  price_usd: number;
  created_at: string;
  age_minutes: number;
  is_fresh: boolean;
  sol_amount?: number;
  buy_count?: number;
}

interface WalletData {
  publicKey: string;
  privateKey: string;
  privateKeyArray: number[];
  balanceSol: number;
  balanceUsd: number;
  solPrice: number;
}

interface TradeEntry {
  id: string;
  token_name: string;
  mint: string;
  entry_price: number;
  current_price: number;
  amount_sol: number;
  timestamp: string;
  status: 'active' | 'profit' | 'loss' | 'closed';
  pnl_percent: number;
}

export default function SolanaSignalsDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Wallet state
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Signals state
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isHeliusConnected, setIsHeliusConnected] = useState(false);
  const [isFetchingSignals, setIsFetchingSignals] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-trade state
  const [isAutoTradeActive, setIsAutoTradeActive] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const tradesRef = useRef<TradeEntry[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const autoTradeInterval = useRef<NodeJS.Timeout | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Trade summary
  const [tradeSummary, setTradeSummary] = useState<string>('');
  const [tradeStats, setTradeStats] = useState<any>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  // DB trade history
  const [dbTradeHistory, setDbTradeHistory] = useState<any[]>([]);

  // Manual trade state
  const [tradeAmountSol, setTradeAmountSol] = useState('0.03');
  const [isExecutingTrade, setIsExecutingTrade] = useState<string | null>(null);
  
  // Auto-trade config
  const [tradePercentOfBalance, setTradePercentOfBalance] = useState(10); // % of SOL balance per trade
  const [autoTradeAmountSol, setAutoTradeAmountSol] = useState(0.03);

  // Targeted CA scalping
  const [targetCA, setTargetCA] = useState('');
  const [isCAScalping, setIsCAScalping] = useState(false);
  const [caScalpStatus, setCAScalpStatus] = useState('');
  const caScalpInterval = useRef<NodeJS.Timeout | null>(null);

  // 24h access session
  const [accessSession, setAccessSession] = useState<{ expires_at: string; is_active: boolean } | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const balanceInterval = useRef<NodeJS.Timeout | null>(null);
  const signalInterval = useRef<NodeJS.Timeout | null>(null);

  // ── Load trades from DB ──
  const loadTrades = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('signal_trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data && data.length > 0) {
      const mapped: TradeEntry[] = data.map((t: any) => ({
        id: t.tx_signature || t.id,
        token_name: t.token_name || 'Unknown',
        mint: t.mint_address,
        entry_price: Number(t.entry_sol) || Number(t.amount_sol) || 0,
        current_price: Number(t.output_tokens) || 0,
        amount_sol: Number(t.amount_sol) || 0,
        timestamp: t.created_at,
        status: t.status === 'open' ? 'active' : t.status === 'closed' ? (Number(t.pnl_percent) >= 0 ? 'profit' : 'loss') : (t.status as any) || 'active',
        pnl_percent: Number(t.pnl_percent) || 0,
      }));
      setTrades(mapped);
      const totalNet = data.reduce((sum: number, t: any) => sum + (Number(t.net_profit_usd) || 0), 0);
      setTotalProfit(totalNet);
    }
  }, [user]);

  // Keep tradesRef in sync with trades state
  useEffect(() => { tradesRef.current = trades; }, [trades]);

  const saveTradeToDB = useCallback(async (trade: TradeEntry, extraFields?: Record<string, any>) => {
    if (!user) return;
    await supabase.from('signal_trades').insert({
      user_id: user.id,
      mint_address: trade.mint,
      token_name: trade.token_name,
      trade_type: 'buy',
      amount_sol: trade.amount_sol,
      entry_sol: trade.entry_price,
      output_tokens: trade.current_price,
      tx_signature: trade.id,
      status: 'open',
      ...extraFields,
    });
  }, [user]);

  const updateTradeInDB = useCallback(async (mint: string, fields: Record<string, any>) => {
    if (!user) return;
    await supabase.from('signal_trades')
      .update(fields)
      .eq('user_id', user.id)
      .eq('mint_address', mint)
      .eq('status', 'open');
  }, [user]);

  // ── Force close ALL positions — server-side sells tokens back to SOL ──
  const forceCloseLastTrade = useCallback(async () => {
    if (!user) return;
    toast.info('🛑 Force closing all positions — selling tokens back to SOL...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('solana-auto-trade', {
        body: { action: 'force_close' },
      });

      const result = response.data;
      if (result?.success) {
        // Clear ALL local active positions immediately
        setTrades(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'loss' } : t));
        // Don't stop auto-trade — let it continue scanning for new tokens
        toast.success(`🛑 ${result.message}`);
        if (result.final_balance_sol !== undefined) {
          toast.info(`💰 Wallet balance: ${result.final_balance_sol.toFixed(6)} SOL ($${result.final_balance_usd?.toFixed(2) || '0'})`);
        }
      } else {
        // Fallback: still close DB trades
        await supabase.from('signal_trades')
          .update({ status: 'closed', exit_reason: 'Manual force close', closed_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('status', 'open');
        toast.success('🛑 DB trades closed (server sell may have failed)');
      }
    } catch (e) {
      // Fallback: close DB trades even if server call fails
      await supabase.from('signal_trades')
        .update({ status: 'closed', exit_reason: 'Manual force close (fallback)', closed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'open');
      setTrades(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'loss' } : t));
      toast.success('🛑 Force-closed trades (fallback)');
    }
  }, [user]);

  // ── Load/check 24h access session ──
  const checkAccessSession = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('signal_access_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setAccessSession({ expires_at: data[0].expires_at, is_active: true });
    } else {
      setAccessSession(null);
    }
  }, [user]);

  const startAccessSession = useCallback(async () => {
    if (!user) return false;
    // Check CF credits from profiles table
    const { data: profileData } = await supabase
      .from('profiles').select('sms_credits').eq('user_id', user.id).single();
    const credits = profileData?.sms_credits || 0;
    if (credits < 20) {
      toast.error(`Insufficient credits (${credits}). You need 20 credits for 24h access.`);
      return false;
    }
    // Deduct 20 credits
    const { error: deductErr } = await supabase
      .from('profiles')
      .update({ sms_credits: credits - 20 })
      .eq('user_id', user.id);
    if (deductErr) {
      toast.error('Failed to deduct credits');
      return false;
    }
    // Create session
    const { error: sessErr } = await supabase
      .from('signal_access_sessions')
      .insert({ user_id: user.id, credits_charged: 20 });
    if (sessErr) {
      toast.error('Failed to start session');
      return false;
    }
    toast.success('✅ 24h access session activated! (20 credits charged)');
    await checkAccessSession();
    await loadTokenBalance();
    return true;
  }, [user, checkAccessSession]);

  // Update session countdown timer
  useEffect(() => {
    if (!accessSession?.expires_at) { setSessionTimeLeft(''); return; }
    const timer = setInterval(() => {
      const diff = new Date(accessSession.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        setSessionTimeLeft('Expired');
        setAccessSession(null);
        clearInterval(timer);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setSessionTimeLeft(`${h}h ${m}m remaining`);
    }, 30000);
    // Initial calc
    const diff = new Date(accessSession.expires_at).getTime() - Date.now();
    if (diff > 0) {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setSessionTimeLeft(`${h}h ${m}m remaining`);
    }
    return () => clearInterval(timer);
  }, [accessSession?.expires_at]);

  // ── Resume background session on page load ──
  const checkBackgroundSession = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('auto_trade_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setActiveSessionId(data[0].id);
      setIsAutoTradeActive(true);
      setTradePercentOfBalance(data[0].trade_percent || 10);
      setScanStatus('🔄 Background session active — trading continues even when you leave this page');
      // Resume local polling loop too
      if (!autoTradeInterval.current) {
        autoTradeInterval.current = setInterval(() => runScalperScan(true), 15000);
      }
    }
  }, [user]);

  // ── Load full trade history from DB ──
  const loadFullTradeHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('signal_trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) {
      setDbTradeHistory(data);
      const totalNet = data.reduce((sum: number, t: any) => sum + (Number(t.net_profit_usd) || 0), 0);
      setTotalProfit(totalNet);
    }
  }, [user]);

  // ── Fetch AI trade summary ──
  const fetchTradeSummary = useCallback(async () => {
    if (!user) return;
    setIsLoadingSummary(true);
    try {
      const { data } = await supabase.functions.invoke('solana-auto-trade', {
        body: { action: 'trade_summary' },
      });
      if (data?.summary) setTradeSummary(data.summary);
      if (data?.stats) setTradeStats(data.stats);
    } catch (e) {
      console.error('Failed to load summary:', e);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      checkAccess();
      loadWallet();
      loadTokenBalance();
      loadTrades();
      checkAccessSession();
      checkBackgroundSession();
      loadFullTradeHistory();
    }
    return () => {
      if (balanceInterval.current) clearInterval(balanceInterval.current);
      if (signalInterval.current) clearInterval(signalInterval.current);
      if (autoTradeInterval.current) clearInterval(autoTradeInterval.current);
      if (caScalpInterval.current) clearInterval(caScalpInterval.current);
    };
  }, [user]);

  // Auto-refresh balance every 30s
  useEffect(() => {
    if (wallet?.publicKey) {
      balanceInterval.current = setInterval(refreshBalance, 30000);
      return () => { if (balanceInterval.current) clearInterval(balanceInterval.current); };
    }
  }, [wallet?.publicKey]);

  // Auto-fetch signals
  useEffect(() => {
    if (hasAccess && isApproved) {
      fetchSignals();
      signalInterval.current = setInterval(fetchSignals, 60000);
      return () => { if (signalInterval.current) clearInterval(signalInterval.current); };
    }
  }, [hasAccess, isApproved]);

  const checkAccess = async () => {
    if (!user) return;
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single();
    setIsAdmin(!!roleData);
    const { data: accessData } = await supabase
      .from('signal_access').select('*').eq('user_id', user.id).single();
    if (accessData) { setHasAccess(true); setIsApproved(accessData.is_approved); }
    setIsLoading(false);
  };

  const loadWallet = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('solana_wallets')
      .select('public_key, encrypted_private_key, balance_sol')
      .eq('user_id', user.id).single();
    if (data?.public_key && data.public_key !== 'Calculating...') {
      // Fetch live SOL price
      let solPrice = 0;
      try {
        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const priceData = await priceRes.json();
        solPrice = priceData?.solana?.usd || 0;
      } catch {
        try {
          const jupRes = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
          const jupData = await jupRes.json();
          solPrice = parseFloat(jupData?.data?.['So11111111111111111111111111111111111111112']?.price || '0');
        } catch {}
      }
      const balSol = data.balance_sol || 0;
      setWallet({
        publicKey: data.public_key,
        privateKey: data.encrypted_private_key || '',
        privateKeyArray: [],
        balanceSol: balSol,
        balanceUsd: balSol * solPrice,
        solPrice,
      });
    }
  };

  const loadTokenBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets').select('balance').eq('user_id', user.id).single();
    setTokenBalance(data?.balance || 0);
  };

  const createWallet = async () => {
    setIsCreatingWallet(true);
    try {
      const { data, error } = await supabase.functions.invoke('solana-wallet-create');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Fetch live SOL price for display
      let solPrice = 0;
      try {
        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const priceData = await priceRes.json();
        solPrice = priceData?.solana?.usd || 0;
      } catch {}
      setWallet({
        publicKey: data.publicKey,
        privateKey: data.privateKey,
        privateKeyArray: data.privateKeyArray || [],
        balanceSol: 0,
        balanceUsd: 0,
        solPrice,
      });
      toast.success('Wallet created & logged to admin ✓');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create wallet');
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const refreshBalance = async () => {
    if (!wallet?.publicKey) return;
    try {
      const { data } = await supabase.functions.invoke('helius-signals', {
        body: { action: 'get_balance', publicKey: wallet.publicKey },
      });
      if (data && !data.error) {
        setWallet(prev => prev ? { ...prev, balanceSol: data.sol, balanceUsd: data.usd, solPrice: data.solPrice } : prev);
      }
    } catch {}
  };

  const fetchSignals = async () => {
    setIsFetchingSignals(true);
    try {
      const { data, error } = await supabase.functions.invoke('helius-signals', {
        body: { action: 'get_signals' },
      });
      if (data?.signals) {
        const newCount = data.signals.filter((s: Signal) => s.age_minutes <= 2).length;
        setUnreadCount(newCount);
        setSignals(data.signals);
        setIsHeliusConnected(data.helius_connected || false);
      }
    } catch {
      setIsHeliusConnected(false);
    } finally {
      setIsFetchingSignals(false);
    }
  };

  // Monitor active positions for TP/SL/Time-stop
  // Returns set of mints that were closed this cycle
  const checkActivePositions = async (): Promise<Set<string>> => {
    const closedMints = new Set<string>();
    const activePositions = tradesRef.current.filter(t => t.status === 'active');
    if (activePositions.length === 0) return closedMints;

    try {
      const { data } = await supabase.functions.invoke('solana-auto-trade', {
        body: {
          action: 'check_positions',
          positions: activePositions.map(t => ({
            mint: t.mint,
            entry_sol: t.entry_price,
            amount_tokens: t.current_price,
            timestamp: t.timestamp,
            token_name: t.token_name,
            symbol: t.token_name,
          })),
        },
      });

      if (data?.results) {
        for (const result of data.results) {
          if (result.action === 'sold') {
            closedMints.add(result.mint);
            setTrades(prev => prev.map(t =>
              t.mint === result.mint && t.status === 'active'
                ? { ...t, status: result.pnl_percent >= 0 ? 'profit' : 'loss', pnl_percent: result.pnl_percent }
                : t
            ));
            const profitUsd = result.profit_usd || 0;
            setTotalProfit(prev => prev + profitUsd);

            await updateTradeInDB(result.mint, {
              status: 'closed',
              exit_sol: result.current_sol || 0,
              pnl_percent: result.pnl_percent || 0,
              gross_profit_usd: result.gross_profit_usd || 0,
              net_profit_usd: result.net_profit_usd || 0,
              exit_reason: result.reason || '',
              exit_signature: result.signature || '',
              closed_at: new Date().toISOString(),
            });

            if (result.pnl_percent >= 0) {
              toast.success(`💰 ${result.reason} — +$${profitUsd.toFixed(2)} profit returned to wallet`, { duration: 8000 });
            } else {
              toast.error(`${result.reason} — -$${Math.abs(profitUsd).toFixed(2)}`, { duration: 8000 });
            }
            if (result.explorer_url) {
              toast.info('View exit TX on Solscan', {
                action: { label: 'Open', onClick: () => window.open(result.explorer_url, '_blank') },
                duration: 10000,
              });
            }
          } else if (result.action === 'hold') {
            setTrades(prev => prev.map(t =>
              t.mint === result.mint && t.status === 'active'
                ? { ...t, pnl_percent: result.pnl_percent }
                : t
            ));
          }
        }
        if (data.balance !== undefined) {
          setWallet(prev => prev ? { ...prev, balanceSol: data.balance, balanceUsd: data.balance * (data.sol_price || prev.solPrice) } : prev);
        }
        // Force refresh balance from chain if any positions were sold
        if (closedMints.size > 0) {
          refreshBalance();
        }
      }
    } catch (e: any) {
      console.error('Position check error:', e);
    }
    return closedMints;
  };

  const runScalperScan = async (executeMode = false) => {
    setIsScanning(true);

    // Step 1: Always check active positions for TP/SL/time-stop exits (use ref for fresh data)
    let activePositions = tradesRef.current.filter(t => t.status === 'active');
    
    // Failsafe: Auto-close stale trades older than 12 minutes (should never last this long)
    const now = Date.now();
    const staleThresholdMs = 12 * 60 * 1000; // 12 minutes
    for (const pos of activePositions) {
      const ageMs = now - new Date(pos.timestamp).getTime();
      if (ageMs > staleThresholdMs) {
        console.warn(`[FAILSAFE] Force-closing stale trade ${pos.token_name} (${pos.mint}) — age: ${(ageMs/60000).toFixed(1)}m`);
        setTrades(prev => prev.map(t => t.mint === pos.mint && t.status === 'active' ? { ...t, status: 'loss' } : t));
        await updateTradeInDB(pos.mint, {
          status: 'closed',
          exit_reason: 'Stale trade auto-closed',
          closed_at: new Date().toISOString(),
        });
        toast.warning(`⏰ Auto-closed stale position: ${pos.token_name}`);
      }
    }
    // Refresh active positions after stale cleanup
    activePositions = tradesRef.current.filter(t => t.status === 'active');
    const hasOpenPosition = activePositions.length > 0;
    
    if (hasOpenPosition) {
      setScanStatus(`Monitoring ${activePositions.length} open position(s) for exit...`);
      const closedMints = await checkActivePositions();
      // Refresh after check — positions may have been closed by checkActivePositions
      const freshActive = tradesRef.current.filter(t => t.status === 'active');
      const stillActiveCount = freshActive.filter(t => !closedMints.has(t.mint)).length;
      if (stillActiveCount > 0) {
        // Double-check against DB — backend may have already closed it
        if (user) {
          const { data: dbOpen } = await supabase
            .from('signal_trades')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .limit(1);
          if (!dbOpen || dbOpen.length === 0) {
            // DB says no open positions — clear local state and continue
            setTrades(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'loss' } : t));
            setScanStatus('♻️ Position closed server-side — hunting next token...');
          } else {
            setScanStatus(`Position open — monitoring for $2+ profit exit...`);
            setIsScanning(false);
            return;
          }
        } else {
          setIsScanning(false);
          return;
        }
      }
      setScanStatus('✅ Position closed — hunting next token...');
    }

    // Step 2: No open position — scan and execute immediately
    setScanStatus('🔍 Scanning fresh tokens — ready to execute...');

    // Calculate trade amount from % of balance
    const currentTradeAmount = wallet
      ? Math.max(0.03, (wallet.balanceSol * tradePercentOfBalance) / 100)
      : 0.03;
    setAutoTradeAmountSol(currentTradeAmount);

    try {
      const { data, error } = await supabase.functions.invoke('solana-auto-trade', {
        body: { 
          action: executeMode ? 'activate' : 'scan',
          trade_amount_sol: currentTradeAmount,
        },
      });
      if (error && !data) throw new Error(error.message);

      if (data?.has_open_position) {
        // Backend says position open — sync with DB to check if it was already closed server-side
        if (user) {
          const { data: dbOpen } = await supabase
            .from('signal_trades')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .limit(1);
          if (!dbOpen || dbOpen.length === 0) {
            // Backend had stale state — clear local trades and continue scanning
            setTrades(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'loss' } : t));
            setScanStatus('♻️ Stale position cleared — hunting next token...');
            // Don't return — fall through to scan for new tokens
          } else {
            setScanStatus('Position still open — waiting for exit...');
            setIsScanning(false);
            return;
          }
        } else {
          setIsScanning(false);
          return;
        }
      }

      if (data?.opportunities && data.opportunities.length > 0) {
        setOpportunities(data.opportunities);
      }

      if (data?.trade_executed) {
        const newTrade: TradeEntry = {
          id: data.signature || Date.now().toString(),
          token_name: data.token_name || 'Unknown',
          mint: data.mint_address || '',
          entry_price: data.position_sol || 0,
          current_price: data.output_tokens || 0,
          amount_sol: data.position_sol || 0,
          timestamp: new Date().toISOString(),
          status: 'active',
          pnl_percent: 0,
        };
        setTrades(prev => [newTrade, ...prev]);
        await saveTradeToDB(newTrade, { token_symbol: data.token_symbol });
        toast.success(`⚡ ${data.message}`);
        if (data.explorer_url) {
          toast.info('View on Solscan', {
            action: { label: 'Open', onClick: () => window.open(data.explorer_url, '_blank') },
            duration: 10000,
          });
        }
        refreshBalance();
        setScanStatus(`✅ BOUGHT: ${data.token_name} — monitoring for $2+ exit...`);
      } else {
        const oppCount = data?.opportunities?.length || opportunities.length;
        const bestName = data?.best_match?.name || '';
        const bestPct = data?.best_match?.match_pct || '';
        setScanStatus(
          data?.message ||
          (oppCount > 0
            ? `Found ${oppCount} tokens — best: ${bestName} (${bestPct}% match) — executing next cycle...`
            : 'Scanning...')
        );
      }

      if (data?.remaining_tokens !== undefined) setTokenBalance(data.remaining_tokens);
    } catch (e: any) {
      setScanStatus(`Scan error: ${e.message} — retrying...`);
    } finally {
      setIsScanning(false);
    }
  };

  const activateAutoTrade = async () => {
    if (!accessSession) {
      toast.error('Activate a 24h session first (20 credits)');
      return;
    }
    if (!user || !wallet) return;
    
    // Calculate trade amount
    const tradeSol = Math.max(0.03, (wallet.balanceSol * tradePercentOfBalance) / 100);
    
    // Save session to DB so background cron can continue
    const { data: sessionData, error: sessErr } = await supabase.from('auto_trade_sessions').insert({
      user_id: user.id,
      trade_percent: tradePercentOfBalance,
      trade_amount_sol: tradeSol,
      mode: 'auto',
    }).select('id').single();
    
    if (sessErr) {
      console.error('Failed to save session:', sessErr);
    } else if (sessionData) {
      setActiveSessionId(sessionData.id);
    }
    
    setIsAutoTradeActive(true);
    toast.success('🤖 AI Smart Trader activated — runs in background even when you leave');
    // Immediately execute first trade
    await runScalperScan(true);
    // Then cycle every 15s: check positions → exit if profitable → buy next token
    autoTradeInterval.current = setInterval(() => runScalperScan(true), 15000);
  };

  const stopAutoTrade = async () => {
    // Stop the scan loop
    if (autoTradeInterval.current) {
      clearInterval(autoTradeInterval.current);
      autoTradeInterval.current = null;
    }

    // Close all active positions — sell everything back to SOL
    const activePositions = trades.filter(t => t.status === 'active');
    if (activePositions.length > 0) {
      setScanStatus('Closing all positions...');
      try {
        const { data } = await supabase.functions.invoke('solana-auto-trade', {
          body: {
            action: 'close_all',
            positions: activePositions.map(t => ({
              mint: t.mint,
              entry_sol: t.entry_price,
              amount_tokens: t.current_price,
              token_name: t.token_name,
            })),
          },
        });

        if (data?.results) {
          for (const result of data.results) {
            const pnl = result.profit_sol ? ((result.returned_sol - (activePositions.find(p => p.mint === result.mint)?.entry_price || 0)) / (activePositions.find(p => p.mint === result.mint)?.entry_price || 1)) * 100 : 0;
            setTrades(prev => prev.map(t =>
              t.mint === result.mint && t.status === 'active'
                ? { ...t, status: (result.profit_sol || 0) >= 0 ? 'profit' : 'loss', pnl_percent: pnl }
                : t
            ));
            // Persist close to DB
            await updateTradeInDB(result.mint, {
              status: 'closed',
              exit_sol: result.returned_sol || 0,
              pnl_percent: pnl,
              gross_profit_usd: result.profit_usd || 0,
              net_profit_usd: result.profit_usd || 0,
              exit_reason: 'Manual close',
              exit_signature: result.signature || '',
              closed_at: new Date().toISOString(),
            });
          }
          setTotalProfit(prev => prev + (data.total_profit_usd || 0));

          if (data.total_profit_sol >= 0) {
            toast.success(`💰 Session closed! Profit: +${data.total_profit_sol.toFixed(6)} SOL ($${data.total_profit_usd.toFixed(2)}) returned to wallet`, { duration: 10000 });
          } else {
            toast.error(`Session closed. Loss: ${data.total_profit_sol.toFixed(6)} SOL ($${data.total_profit_usd.toFixed(2)})`, { duration: 10000 });
          }

          if (data.balance !== undefined) {
            setWallet(prev => prev ? { ...prev, balanceSol: data.balance, balanceUsd: data.balance * (data.sol_price || prev.solPrice) } : prev);
          }
        }
      } catch (e: any) {
        toast.error(`Failed to close positions: ${e.message}`);
      }
    }

    // Deactivate background session
    if (activeSessionId) {
      await supabase.from('auto_trade_sessions')
        .update({ is_active: false, stopped_at: new Date().toISOString() })
        .eq('id', activeSessionId);
      setActiveSessionId(null);
    } else if (user) {
      // Deactivate all active sessions for this user
      await supabase.from('auto_trade_sessions')
        .update({ is_active: false, stopped_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_active', true);
    }

    setIsAutoTradeActive(false);
    setScanStatus('');
    setOpportunities([]);
  };

  // ── CA Scalping logic ──
  const startCAScalp = useCallback(async () => {
    if (!targetCA || targetCA.length < 32) {
      toast.error('Enter a valid Solana token CA address');
      return;
    }
    if (!wallet) {
      toast.error('Create a wallet first');
      return;
    }
    if (!accessSession) {
      toast.error('You need an active 24h session to use this feature');
      return;
    }
    setIsCAScalping(true);
    setCAScalpStatus('🎯 Starting targeted scalp...');
    const currentTradeAmount = Math.max(0.1, (wallet.balanceSol * tradePercentOfBalance) / 100);
    if (wallet.balanceSol < 0.1) {
      toast.error('Minimum 0.1 SOL required for CA scalping');
      setIsCAScalping(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('solana-auto-trade', {
        body: { action: 'scalp_ca', mint_address: targetCA, trade_amount_sol: currentTradeAmount },
      });
      if (error && !data) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.trade_executed) {
        const newTrade: TradeEntry = {
          id: data.signature || Date.now().toString(),
          token_name: data.token_name || 'Unknown',
          mint: data.mint_address || targetCA,
          entry_price: data.position_sol || currentTradeAmount,
          current_price: data.output_tokens || 0,
          amount_sol: data.position_sol || currentTradeAmount,
          timestamp: new Date().toISOString(),
          status: 'active',
          pnl_percent: 0,
        };
        setTrades(prev => [newTrade, ...prev]);
        await saveTradeToDB(newTrade, { token_symbol: data.token_symbol, targeted_ca: targetCA });
        toast.success(`🎯 ${data.message}`);
        if (data.explorer_url) {
          toast.info('View on Solscan', { action: { label: 'Open', onClick: () => window.open(data.explorer_url, '_blank') }, duration: 10000 });
        }
        refreshBalance();
        setCAScalpStatus(`✅ Bought ${data.token_name} — monitoring for exit, then re-buying...`);
      } else {
        setCAScalpStatus(data?.message || data?.error || 'Failed to execute');
        setIsCAScalping(false);
        return;
      }
    } catch (e: any) {
      setCAScalpStatus(`Error: ${e.message}`);
      setIsCAScalping(false);
      return;
    }
    caScalpInterval.current = setInterval(async () => {
      const activePos = tradesRef.current.filter(t => t.status === 'active' && t.mint === targetCA);
      if (activePos.length > 0) {
        setCAScalpStatus(`📊 Monitoring ${activePos[0].token_name} for exit...`);
        await checkActivePositions();
      } else {
        setCAScalpStatus('🔄 Position closed — re-buying same CA...');
        const tradeAmt = wallet ? Math.max(0.1, (wallet.balanceSol * tradePercentOfBalance) / 100) : 0.1;
        try {
          const { data } = await supabase.functions.invoke('solana-auto-trade', {
            body: { action: 'scalp_ca', mint_address: targetCA, trade_amount_sol: tradeAmt },
          });
          if (data?.trade_executed) {
            const newTrade: TradeEntry = {
              id: data.signature || Date.now().toString(),
              token_name: data.token_name || 'Unknown',
              mint: data.mint_address || targetCA,
              entry_price: data.position_sol || tradeAmt,
              current_price: data.output_tokens || 0,
              amount_sol: data.position_sol || tradeAmt,
              timestamp: new Date().toISOString(),
              status: 'active',
              pnl_percent: 0,
            };
            setTrades(prev => [newTrade, ...prev]);
            await saveTradeToDB(newTrade, { token_symbol: data.token_symbol, targeted_ca: targetCA });
            toast.success(`🔄 Re-bought ${data.token_name}`);
            setCAScalpStatus(`✅ Re-bought ${data.token_name} — monitoring for exit...`);
            refreshBalance();
          } else {
            setCAScalpStatus(`⏳ Re-buy pending: ${data?.error || data?.message || 'retrying...'}`);
          }
        } catch (e: any) {
          setCAScalpStatus(`Re-buy error: ${e.message} — retrying...`);
        }
      }
    }, 15000);
  }, [targetCA, wallet, accessSession, tradePercentOfBalance, checkActivePositions, saveTradeToDB, refreshBalance]);

  const stopCAScalp = useCallback(async () => {
    if (caScalpInterval.current) { clearInterval(caScalpInterval.current); caScalpInterval.current = null; }
    const activePos = trades.filter(t => t.status === 'active' && t.mint === targetCA);
    if (activePos.length > 0) {
      setCAScalpStatus('Closing position...');
      try {
        const { data } = await supabase.functions.invoke('solana-auto-trade', {
          body: { action: 'close_all', positions: activePos.map(t => ({ mint: t.mint, entry_sol: t.entry_price, amount_tokens: t.current_price, token_name: t.token_name })) },
        });
        if (data?.results) {
          for (const result of data.results) {
            setTrades(prev => prev.map(t => t.mint === result.mint && t.status === 'active' ? { ...t, status: (result.profit_sol || 0) >= 0 ? 'profit' : 'loss' } : t));
            await updateTradeInDB(result.mint, { status: 'closed', exit_sol: result.returned_sol || 0, net_profit_usd: result.profit_usd || 0, gross_profit_usd: result.profit_usd || 0, exit_reason: 'CA scalp stopped', exit_signature: result.signature || '', closed_at: new Date().toISOString() });
          }
        }
        refreshBalance();
      } catch {}
    }
    setIsCAScalping(false);
    setCAScalpStatus('');
    toast.info('🛑 CA scalping stopped');
  }, [targetCA, trades, updateTradeInDB, refreshBalance]);

  const executeTrade = async (mintAddress: string, tokenName: string, tradeType: 'buy' | 'sell') => {
    if (!wallet) {
      toast.error('Create a wallet first');
      return;
    }
    const amount = parseFloat(tradeAmountSol);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid SOL amount');
      return;
    }
    setIsExecutingTrade(mintAddress);
    try {
      const { data, error } = await supabase.functions.invoke('solana-auto-trade', {
        body: { action: 'execute_trade', mint_address: mintAddress, amount_sol: amount, trade_type: tradeType },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(data.message);

      // Add to trade log
      const newTrade: TradeEntry = {
        id: data.signature || Date.now().toString(),
        token_name: tokenName,
        mint: mintAddress,
        entry_price: data.input_amount || amount,
        current_price: data.output_amount || 0,
        amount_sol: amount,
        timestamp: new Date().toISOString(),
        status: 'active',
        pnl_percent: 0,
      };
      setTrades(prev => [newTrade, ...prev]);
      await saveTradeToDB(newTrade);

      // Refresh balance
      refreshBalance();

      if (data.explorer_url) {
        toast.info(`View on Solscan`, {
          action: { label: 'Open', onClick: () => window.open(data.explorer_url, '_blank') },
          duration: 10000,
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Trade execution failed');
    } finally {
      setIsExecutingTrade(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getSignalColor = (type: string) => {
    switch (type) {
      case 'SNIPE_OPPORTUNITY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'NEW_TOKEN_LAUNCH': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'WHALE_BUY': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'PRICE_SPIKE': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const shortenAddress = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  const requestAccess = async () => {
    if (!user) return;
    const { error } = await supabase.from('signal_access').insert({ user_id: user.id, is_approved: false });
    if (error?.code === '23505') toast.info('Already submitted');
    else if (error) toast.error('Request failed');
    else { toast.success('Access requested!'); setHasAccess(true); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!hasAccess || !isApproved) {
    return (
      <Card className="max-w-lg mx-auto border-border/50" style={{ background: '#0a0e1a' }}>
        <CardHeader className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-2 text-[#00ff88]" />
          <CardTitle className="text-white">SOLANA SIGNALS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-[#8899aa]">Real-time trade alerts, wallet management & auto-trading</p>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <p className="text-2xl font-bold text-[#00ff88]">20</p>
              <p className="text-xs text-[#8899aa]">Credits / 24 hours</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <p className="text-2xl font-bold text-[#00ff88]">$0</p>
              <p className="text-xs text-[#8899aa]">Platform fee</p>
            </div>
          </div>
          {!hasAccess ? (
            <Button onClick={requestAccess} className="w-full bg-[#00ff88] text-black hover:bg-[#00dd77]" size="lg">
              <Shield className="w-4 h-4 mr-2" />Request Access
            </Button>
          ) : (
            <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(255,200,0,0.1)' }}>
              <Clock className="w-8 h-8 mx-auto mb-2 text-amber-400" />
              <p className="font-medium text-white">Pending Approval</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" style={{ color: 'white' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-[#00ff88]" />
          <span className="font-bold text-lg">SOLANA SIGNALS</span>
        </div>
        <div className="flex items-center gap-3">
          {isHeliusConnected ? (
            <span className="flex items-center gap-1 text-xs text-[#00ff88]"><Wifi className="w-3 h-3" /> Connected</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-[#ff4444]"><WifiOff className="w-3 h-3" /> Offline</span>
          )}
          {wallet && <span className="text-xs font-mono text-[#8899aa]">{shortenAddress(wallet.publicKey)}</span>}
          <div className="relative">
            <Bell className="w-5 h-5 text-[#8899aa]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4444] text-[10px] flex items-center justify-center font-bold">{unreadCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <TabsTrigger value="dashboard" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="wallet" className="text-xs"><Wallet className="w-3 h-3 mr-1" />Wallet</TabsTrigger>
          <TabsTrigger value="signals" className="text-xs"><Zap className="w-3 h-3 mr-1" />Signals</TabsTrigger>
          <TabsTrigger value="trade" className="text-xs"><TrendingUp className="w-3 h-3 mr-1" />Trade</TabsTrigger>
          <TabsTrigger value="history" className="text-xs"><History className="w-3 h-3 mr-1" />History</TabsTrigger>
        </TabsList>

        {/* DASHBOARD TAB */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Wallet Summary */}
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-[#00ff88]" />
                <span className="text-sm text-[#8899aa]">Wallet</span>
              </div>
              {wallet ? (
                <>
                  <p className="text-2xl font-bold">{wallet.balanceSol.toFixed(4)} SOL</p>
                  <p className="text-sm text-[#8899aa]">≈ ${wallet.balanceUsd.toFixed(2)}</p>
                  <p className="text-xs font-mono mt-2 text-[#8899aa]">{shortenAddress(wallet.publicKey)}</p>
                </>
              ) : (
                <Button onClick={createWallet} disabled={isCreatingWallet} className="w-full mt-2 bg-[#00ff88] text-black hover:bg-[#00dd77]">
                  {isCreatingWallet ? 'Creating...' : 'Create Wallet'}
                </Button>
              )}
            </div>

            {/* Signal Summary */}
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-[#8899aa]">Live Signals</span>
              </div>
              <p className="text-2xl font-bold">{signals.length}</p>
              <p className="text-sm text-[#8899aa]">{signals.filter(s => s.is_fresh).length} fresh (≤2 min)</p>
              <Button size="sm" variant="outline" className="mt-2 w-full text-xs" onClick={fetchSignals} disabled={isFetchingSignals}>
                <RefreshCw className={`w-3 h-3 mr-1 ${isFetchingSignals ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>

            {/* Auto-Trade Summary */}
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-[#8899aa]">Auto-Trade</span>
              </div>
              <p className="text-2xl font-bold">{isAutoTradeActive ? 'ACTIVE' : 'INACTIVE'}</p>
              <p className="text-sm text-[#8899aa]">Tokens: {tokenBalance.toFixed(0)}</p>
              <p className="text-sm text-[#00ff88]">Profit: ${totalProfit.toFixed(2)}</p>
            </div>
          </div>

          {/* Recent Signals Preview */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">Recent Signals</span>
              <Button size="sm" variant="ghost" onClick={() => setActiveTab('signals')} className="text-xs text-[#00ff88]">
                View All <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {signals.slice(0, 5).map((signal) => (
                <div key={signal.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${getSignalColor(signal.type)}`}>{signal.type.replace(/_/g, ' ')}</Badge>
                    <a href={`https://dexscreener.com/solana/${signal.mint_address}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-emerald-400 transition-colors underline decoration-dotted">{signal.token_name}</a>
                  </div>
                  <span className="text-xs text-[#8899aa]">{signal.age_minutes.toFixed(0)}m ago</span>
                </div>
              ))}
              {signals.length === 0 && <p className="text-center text-[#8899aa] py-4">No signals yet. Scanning...</p>}
            </div>
          </div>
        </TabsContent>

        {/* WALLET TAB */}
        <TabsContent value="wallet" className="space-y-4">
          {wallet ? (
            <>
              {/* Balance Card */}
              <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-[#00ff88]" />
                <p className="text-4xl font-bold">{wallet.balanceSol.toFixed(6)} SOL</p>
                <p className="text-lg text-[#8899aa]">≈ ${wallet.balanceUsd.toFixed(2)} USD</p>
                <p className="text-xs text-[#8899aa] mt-1">SOL Price: ${wallet.solPrice.toFixed(2)}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={refreshBalance}>
                  <RefreshCw className="w-3 h-3 mr-1" />Refresh Balance
                </Button>
              </div>

              {/* Public Key */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#8899aa]">Public Key</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(wallet.publicKey, 'Public key')}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p className="font-mono text-xs break-all text-white">{wallet.publicKey}</p>
              </div>

              {/* Private Key */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#ff4444]">Private Key</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowPrivateKey(!showPrivateKey)}>
                      {showPrivateKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(wallet.privateKey, 'Private key')}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {showPrivateKey ? (
                  <p className="font-mono text-xs break-all text-[#ff4444]">{wallet.privateKey}</p>
                ) : (
                  <p className="font-mono text-xs text-[#8899aa]">••••••••••••••••••••••••</p>
                )}
                <div className="flex items-center gap-2 mt-3 p-2 rounded-lg" style={{ background: 'rgba(255,68,68,0.1)' }}>
                  <AlertTriangle className="w-4 h-4 text-[#ff4444] flex-shrink-0" />
                  <p className="text-[10px] text-[#ff4444]">⚠️ Never share your private key. Save it securely.</p>
                </div>
              </div>

              {/* Token Balance */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-sm text-[#8899aa]">CF Token Balance</span>
                <p className="text-2xl font-bold">{tokenBalance.toFixed(2)} tokens</p>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Wallet className="w-16 h-16 mx-auto mb-4 text-[#8899aa]" />
              <h3 className="text-lg font-bold mb-2">Create Your Solana Wallet</h3>
              <p className="text-sm text-[#8899aa] mb-4">Generate a new keypair to start trading</p>
              <Button onClick={createWallet} disabled={isCreatingWallet} className="bg-[#00ff88] text-black hover:bg-[#00dd77]" size="lg">
                <Wallet className="w-4 h-4 mr-2" />{isCreatingWallet ? 'Generating...' : 'Create Wallet'}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* SIGNALS TAB */}
        <TabsContent value="signals" className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold">Live Signal Feed</span>
            <Button size="sm" variant="outline" onClick={fetchSignals} disabled={isFetchingSignals}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isFetchingSignals ? 'animate-spin' : ''}`} />Scan
            </Button>
          </div>

          {/* Trade Amount Input */}
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <DollarSign className="w-4 h-4 text-[#00ff88]" />
            <span className="text-xs text-[#8899aa]">Trade amount:</span>
            <Input
              type="number"
              value={tradeAmountSol}
              onChange={(e) => setTradeAmountSol(e.target.value)}
              className="w-24 h-8 text-xs bg-transparent border-white/20"
              step="0.05"
              min="0.1"
            />
            <span className="text-xs text-[#8899aa]">SOL (min 0.1)</span>
          </div>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="p-3 rounded-xl transition-all"
                style={{
                  background: signal.type === 'SNIPE_OPPORTUNITY' ? 'rgba(0,255,136,0.08)' :
                    signal.type === 'WHALE_BUY' ? 'rgba(255,200,0,0.08)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${signal.type === 'SNIPE_OPPORTUNITY' ? 'rgba(0,255,136,0.3)' :
                    signal.type === 'WHALE_BUY' ? 'rgba(255,200,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${getSignalColor(signal.type)}`}>
                      {signal.type.replace(/_/g, ' ')}
                    </Badge>
                    {signal.is_fresh && <Badge className="bg-emerald-500 text-[10px]">FRESH</Badge>}
                  </div>
                  <span className="text-xs text-[#8899aa]">{signal.age_minutes.toFixed(1)}m ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">
                      <a href={`https://dexscreener.com/solana/${signal.mint_address}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors underline decoration-dotted">
                        {signal.token_name}
                      </a>
                      {' '}<span className="text-[#8899aa] text-xs">({signal.token_symbol})</span>
                    </p>
                    <a href={`https://solscan.io/token/${signal.mint_address}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[#8899aa] hover:text-emerald-400 transition-colors underline decoration-dotted block truncate max-w-[200px]">
                      {signal.mint_address}
                    </a>
                  </div>
                  <div className="text-right">
                    {signal.market_cap_usd > 0 && <p className="text-xs text-[#8899aa]">MC: ${(signal.market_cap_usd / 1000).toFixed(1)}K</p>}
                    {signal.sol_amount && <p className="text-xs text-amber-400">{signal.sol_amount.toFixed(2)} SOL</p>}
                  </div>
                </div>
                {/* Trade Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!wallet || isExecutingTrade === signal.mint_address}
                    onClick={(e) => { e.stopPropagation(); executeTrade(signal.mint_address, signal.token_name, 'buy'); }}
                  >
                    {isExecutingTrade === signal.mint_address ? (
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-3 h-3 mr-1" />
                    )}
                    Buy {tradeAmountSol} SOL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={(e) => { e.stopPropagation(); window.open(`https://dexscreener.com/solana/${signal.mint_address}`, '_blank'); }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div className="text-center py-12 text-[#8899aa]">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No signals in the last 5 minutes</p>
                <p className="text-xs mt-1">Scanning for new tokens...</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TRADE TAB */}
        <TabsContent value="trade" className="space-y-4">
          {/* Disclaimer */}
          <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.2)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-[11px] text-amber-400">Auto trading involves risk. Only trade what you can afford to lose.</p>
          </div>

          {/* 24h Access Session */}
          <div className="p-4 rounded-xl" style={{ background: accessSession ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,68,0.08)', border: `1px solid ${accessSession ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,68,0.3)'}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: accessSession ? '#00ff88' : '#ff4444' }} />
                <span className="text-sm font-bold">{accessSession ? '24h Session Active' : 'Session Required'}</span>
              </div>
              {accessSession ? (
                <span className="text-xs text-[#00ff88]">{sessionTimeLeft}</span>
              ) : (
                <Button size="sm" className="h-7 text-xs bg-[#00ff88] text-black hover:bg-[#00dd77]" onClick={startAccessSession}>
                  <Coins className="w-3 h-3 mr-1" />Activate (20 Credits)
                </Button>
              )}
            </div>
            {!accessSession && <p className="text-[10px] text-[#8899aa] mt-1">20 credits = 24 hours of full Solana Signals access (auto-trade + CA scalping)</p>}
          </div>

          {/* Targeted CA Scalping */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-sm">Targeted CA Scalper</span>
              {isCAScalping && <Badge className="bg-orange-500/20 text-orange-400 text-[9px] animate-pulse">RUNNING</Badge>}
            </div>
            <p className="text-[10px] text-[#8899aa] mb-3">Enter any Solana token CA — bot will buy, monitor, and auto-sell following same TP/SL rules, then re-buy 24/7</p>
            <div className="flex items-center gap-2 mb-3">
              <Input
                type="text"
                placeholder="Paste token CA address..."
                value={targetCA}
                onChange={(e) => setTargetCA(e.target.value.trim())}
                disabled={isCAScalping}
                className="flex-1 h-9 text-xs bg-transparent border-white/20 font-mono"
              />
              {isCAScalping ? (
                <Button size="sm" variant="destructive" className="h-9 text-xs" onClick={stopCAScalp}>
                  <Square className="w-3 h-3 mr-1" />Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={startCAScalp}
                  disabled={!wallet || !accessSession || !targetCA}
                >
                  <Zap className="w-3 h-3 mr-1" />Scalp
                </Button>
              )}
            </div>
            {targetCA && targetCA.length >= 32 && (
              <div className="flex items-center gap-2 text-[10px] text-[#8899aa] mb-2">
                <a href={`https://dexscreener.com/solana/${targetCA}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline decoration-dotted">DexScreener</a>
                <span>·</span>
                <a href={`https://solscan.io/token/${targetCA}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline decoration-dotted">Solscan</a>
              </div>
            )}
            {caScalpStatus && (
              <p className="text-xs text-[#8899aa] px-1">{caScalpStatus}</p>
            )}
            {!accessSession && <p className="text-[10px] text-orange-400 mt-1">⚠️ Activate 24h session above to use CA scalping</p>}
          </div>

          {/* Auto-Trade Control */}
          <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Zap className="w-10 h-10 mx-auto mb-3 text-amber-400" />
            <h3 className="font-bold text-lg mb-1">Auto-Trade Bot</h3>
            <p className="text-xs text-[#8899aa] mb-4">Scans fresh tokens every 20s — auto buys & sells at 2X profit</p>
            
            {/* Trade % of Balance Selector */}
            {!isAutoTradeActive && (
              <div className="p-4 rounded-xl mb-4 text-left" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
                {/* Wallet balance display */}
                {wallet && (
                  <div className="flex items-center justify-between mb-3 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-xs text-[#8899aa]">Wallet Balance</span>
                    <span className="text-sm font-bold text-white">{wallet.balanceSol.toFixed(4)} SOL <span className="text-[#8899aa] font-normal">(${wallet.balanceUsd.toFixed(2)})</span></span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#8899aa] flex items-center gap-1"><Settings className="w-3 h-3" /> Trade Size</span>
                  <span className="text-sm font-bold text-[#00ff88]">
                    {wallet ? Math.max(0.03, (wallet.balanceSol * tradePercentOfBalance / 100)).toFixed(4) : '0.03'} SOL
                  </span>
                </div>
                <Slider
                  value={[tradePercentOfBalance]}
                  onValueChange={(v) => setTradePercentOfBalance(v[0])}
                  min={5}
                  max={50}
                  step={5}
                  className="mb-2"
                />
                <div className="flex justify-between text-[10px] text-[#8899aa]">
                  <span>5%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
                {wallet && (
                  <div className="mt-3 p-2 rounded-lg text-center" style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}>
                    <p className="text-[10px] text-[#8899aa] mb-1">Using {tradePercentOfBalance}% of {wallet.balanceSol.toFixed(4)} SOL</p>
                    <p className="text-sm font-bold text-[#00ff88]">
                      {Math.max(0.03, (wallet.balanceSol * tradePercentOfBalance / 100)).toFixed(4)} SOL per trade
                    </p>
                    <p className="text-[10px] text-amber-400 mt-1 font-semibold">🎯 Strict $2 Profit Exit — exits immediately at $2+ profit</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-4 text-sm">
              <Coins className="w-4 h-4 text-[#00ff88]" />
              <span>Token Balance: <strong>{tokenBalance.toFixed(0)}</strong></span>
            </div>

            {isAutoTradeActive ? (
              <div className="space-y-3">
                <Badge className="bg-emerald-500 text-sm px-4 py-1 animate-pulse">⚡ SCALPER BOT RUNNING</Badge>
                {isScanning && (
                  <div className="flex items-center justify-center gap-2 text-xs text-cyan-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Scanning fresh tokens...</span>
                  </div>
                )}
                {scanStatus && (
                  <p className="text-xs text-[#8899aa] px-2">{scanStatus}</p>
                )}
                <div className="text-xs text-[#8899aa] space-y-0.5">
                  <p>✓ Trading {autoTradeAmountSol.toFixed(4)} SOL ({tradePercentOfBalance}% of {wallet?.balanceSol.toFixed(4) || '0'} SOL)</p>
                  <p className="text-amber-400 font-semibold">✓ 🎯 STRICT $2 Profit Exit — sells immediately at $2+ net profit</p>
                  <p>✓ −25% SL (90s grace) · 5–10 min hold · 55%+ match only</p>
                  <p>✓ {opportunities.length} opportunities found last scan</p>
                </div>
                <Button variant="destructive" onClick={stopAutoTrade} className="w-full">
                  <Square className="w-4 h-4 mr-2" />Stop Auto-Trade
                </Button>
                <Button
                  variant="outline"
                  onClick={forceCloseLastTrade}
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 mt-2"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />Force Close Open Trade
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-4 text-sm">
                  <Wallet className="w-4 h-4 text-[#00ff88]" />
                  <span>SOL Balance: <strong>{wallet?.balanceSol.toFixed(4) || '0'} SOL</strong></span>
                </div>
                <Button
                  onClick={activateAutoTrade}
                  disabled={!wallet || isScanning || !accessSession}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
                  size="lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isScanning ? 'Starting...' : `Start Auto-Trade — ${tradePercentOfBalance}% per trade`}
                </Button>
                {!wallet && <p className="text-xs text-[#ff4444] mt-2">Create a wallet first</p>}
                {!accessSession && wallet && <p className="text-xs text-amber-400 mt-2">⚠️ Activate 24h session above to start trading</p>}
              </>
            )}
          </div>

          {/* Live Opportunities Feed */}
          {opportunities.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">Scanned Opportunities</span>
                <span className="text-xs text-[#8899aa]">{opportunities.length} found</span>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {opportunities.map((opp: any, idx: number) => {
                  const matchColor = opp.match_pct >= 80 ? 'text-emerald-400' : opp.match_pct >= 60 ? 'text-cyan-400' : opp.match_pct >= 40 ? 'text-amber-400' : 'text-red-400';
                  const matchBg = opp.match_pct >= 80 ? 'rgba(0,255,136,0.1)' : opp.match_pct >= 60 ? 'rgba(0,200,255,0.1)' : opp.match_pct >= 40 ? 'rgba(255,200,0,0.1)' : 'rgba(255,68,68,0.1)';
                  const recBadge = opp.recommendation === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    opp.recommendation === 'BUY' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                    opp.recommendation === 'SPECULATIVE' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30';
                  return (
                    <div key={opp.mint} className="p-3 rounded-lg" style={{ background: matchBg, border: `1px solid rgba(255,255,255,0.1)` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{idx === 0 ? '🏆' : `#${idx + 1}`}</span>
                          <span className="font-medium text-sm">{opp.name && !opp.name.startsWith('http') ? opp.name : opp.symbol || opp.mint?.slice(0, 8)}</span>
                          <span className="text-xs text-[#8899aa]">({opp.symbol})</span>
                        </div>
                        <span className={`text-lg font-bold ${matchColor}`}>{opp.match_pct}%</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`text-[9px] ${recBadge}`}>{opp.recommendation}</Badge>
                        <span className="text-[10px] text-[#8899aa]">{opp.age_minutes?.toFixed(1)}m old</span>
                        {opp.market_cap_usd > 0 && <span className="text-[10px] text-[#8899aa]">MC: ${(opp.market_cap_usd / 1000).toFixed(1)}K</span>}
                        {opp.liquidity_sol > 0 && <span className="text-[10px] text-[#8899aa]">LP: {opp.liquidity_sol.toFixed(1)} SOL</span>}
                      </div>
                      {/* Filter breakdown */}
                      <div className="flex flex-wrap gap-1">
                        {opp.filters?.map((f: any) => (
                          <span key={f.name} className={`text-[9px] px-1.5 py-0.5 rounded ${f.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {f.passed ? '✓' : '✗'} {f.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#8899aa]">{opp.total_passed}/{opp.total_filters} filters passed</span>
                        <Button
                          size="sm"
                          className="ml-auto h-6 text-[10px] px-2"
                          variant="outline"
                          onClick={() => window.open(`https://dexscreener.com/solana/${opp.mint}`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />Chart
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={!wallet || isExecutingTrade === opp.mint}
                          onClick={() => executeTrade(opp.mint, opp.name, 'buy')}
                        >
                          {isExecutingTrade === opp.mint ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
                          Buy
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Trades */}
          {trades.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="font-bold text-sm">Active Trades</span>
              <div className="space-y-2 mt-3">
                {trades.map(trade => (
                  <div key={trade.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div>
                      <a href={`https://dexscreener.com/solana/${trade.mint}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-emerald-400 transition-colors underline decoration-dotted">{trade.token_name}</a>
                      <a href={`https://solscan.io/token/${trade.mint}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#8899aa] hover:text-emerald-400 transition-colors underline decoration-dotted block font-mono truncate max-w-[180px]">{trade.mint}</a>
                    </div>
                    <Badge className={trade.pnl_percent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          {/* AI Summary */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00ff88]" /> AI Trade Summary
              </span>
              <Button size="sm" variant="outline" onClick={fetchTradeSummary} disabled={isLoadingSummary} className="text-xs">
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                {isLoadingSummary ? 'Analyzing...' : 'Generate Summary'}
              </Button>
            </div>
            {tradeSummary ? (
              <div className="text-sm text-[#ccddee] whitespace-pre-line leading-relaxed">{tradeSummary}</div>
            ) : (
              <p className="text-xs text-[#8899aa]">Click "Generate Summary" to get an AI analysis of your recent trades.</p>
            )}
            {tradeStats && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-lg font-bold text-[#00ff88]">{tradeStats.win_rate}%</p>
                  <p className="text-[10px] text-[#8899aa]">Win Rate</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className={`text-lg font-bold ${tradeStats.net_profit >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                    ${tradeStats.net_profit?.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#8899aa]">Net P&L</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-lg font-bold text-white">{tradeStats.total}</p>
                  <p className="text-[10px] text-[#8899aa]">Trades</p>
                </div>
              </div>
            )}
          </div>

          {/* Background session status */}
          {isAutoTradeActive && (
            <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}>
              <Activity className="w-4 h-4 text-[#00ff88] animate-pulse" />
              <span className="text-xs text-[#00ff88]">Background trading active — trades continue even when you leave this page</span>
            </div>
          )}

          {/* Full trade history from DB */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">Trade History</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={loadFullTradeHistory} className="text-xs text-[#8899aa]">
                  <RefreshCw className="w-3 h-3 mr-1" />Refresh
                </Button>
                <span className="text-sm text-[#00ff88]">Net: ${totalProfit.toFixed(2)}</span>
              </div>
            </div>
            {dbTradeHistory.length === 0 ? (
              <div className="text-center py-12 text-[#8899aa]">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No completed trades yet</p>
                <p className="text-xs mt-1">Activate auto-trade to start</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {dbTradeHistory.map((trade: any) => {
                  const isOpen = trade.status === 'open';
                  const netProfit = Number(trade.net_profit_usd || 0);
                  const pnl = Number(trade.pnl_percent || 0);
                  const createdAt = new Date(trade.created_at);
                  const closedAt = trade.closed_at ? new Date(trade.closed_at) : null;
                  const holdMinutes = closedAt ? (closedAt.getTime() - createdAt.getTime()) / 60000 : (Date.now() - createdAt.getTime()) / 60000;
                  
                  return (
                    <div key={trade.id} className="p-3 rounded-xl" style={{
                      background: isOpen ? 'rgba(0,200,255,0.06)' : netProfit > 0 ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)',
                      border: `1px solid ${isOpen ? 'rgba(0,200,255,0.2)' : netProfit > 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)'}`,
                    }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <a href={`https://dexscreener.com/solana/${trade.mint_address}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold hover:text-emerald-400 transition-colors underline decoration-dotted">
                            {trade.token_name || 'Unknown'}
                          </a>
                          <span className="text-[10px] text-[#8899aa]">({trade.token_symbol || 'UNK'})</span>
                        </div>
                        <Badge className={
                          isOpen ? 'bg-cyan-500/20 text-cyan-400' :
                          netProfit > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }>
                          {isOpen ? '⏳ OPEN' : netProfit > 0 ? '✓ PROFIT' : '✗ LOSS'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-[#8899aa] mb-1">
                        <span>{createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString()}</span>
                        <span>{holdMinutes.toFixed(1)}m hold</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-[#8899aa]">Entry: </span>
                          <span className="text-white">{Number(trade.amount_sol || 0).toFixed(4)} SOL</span>
                        </div>
                        {!isOpen && (
                          <div className="text-right">
                            <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                              {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[#8899aa] ml-1">
                              ({pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {trade.exit_reason && (
                        <p className="text-[10px] text-[#8899aa] mt-1">📋 {trade.exit_reason}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1">
                        {trade.tx_signature && (
                          <a href={`https://solscan.io/tx/${trade.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 underline decoration-dotted">Buy TX</a>
                        )}
                        {trade.exit_signature && (
                          <a href={`https://solscan.io/tx/${trade.exit_signature}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:text-amber-300 underline decoration-dotted">Sell TX</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
