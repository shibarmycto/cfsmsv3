import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { 
  Zap, Wallet, TrendingUp, RefreshCw, Play, Square, 
  Eye, EyeOff, Copy, ExternalLink, Shield, Clock, Coins,
  Bell, Activity, BarChart3, History, AlertTriangle, 
  ChevronRight, Wifi, WifiOff, DollarSign, ShoppingCart, ArrowRightLeft
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
  const [totalProfit, setTotalProfit] = useState(0);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const autoTradeInterval = useRef<NodeJS.Timeout | null>(null);

  // Manual trade state
  const [tradeAmountSol, setTradeAmountSol] = useState('0.01');
  const [isExecutingTrade, setIsExecutingTrade] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const balanceInterval = useRef<NodeJS.Timeout | null>(null);
  const signalInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      checkAccess();
      loadWallet();
      loadTokenBalance();
    }
    return () => {
      if (balanceInterval.current) clearInterval(balanceInterval.current);
      if (signalInterval.current) clearInterval(signalInterval.current);
      if (autoTradeInterval.current) clearInterval(autoTradeInterval.current);
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

  const runScalperScan = async (executeMode = false) => {
    setIsScanning(true);
    setScanStatus('Scanning all sources...');
    try {
      const { data, error } = await supabase.functions.invoke('solana-auto-trade', {
        body: { action: executeMode ? 'activate' : 'scan' },
      });
      // Don't throw on error — still check for opportunities in response
      if (error && !data) throw new Error(error.message);

      // Always store discovered opportunities
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
        toast.success(data.message);
        if (data.explorer_url) {
          toast.info('View on Solscan', {
            action: { label: 'Open', onClick: () => window.open(data.explorer_url, '_blank') },
            duration: 10000,
          });
        }
        refreshBalance();
        setScanStatus(`✅ Executed: ${data.token_name} (${data.match_pct}% match)`);
      } else {
        const oppCount = data?.opportunities?.length || opportunities.length;
        const bestName = data?.best_match?.name || '';
        const bestPct = data?.best_match?.match_pct || '';
        setScanStatus(
          data?.message || 
          (oppCount > 0 
            ? `Found ${oppCount} opportunities — best: ${bestName} (${bestPct}% match)`
            : 'Scanning...')
        );
      }

      if (data?.remaining_tokens !== undefined) setTokenBalance(data.remaining_tokens);
    } catch (e: any) {
      // Don't clear opportunities on error — keep showing what we found
      setScanStatus(`Scan error: ${e.message} — retrying...`);
    } finally {
      setIsScanning(false);
    }
  };

  const activateAutoTrade = async () => {
    setIsAutoTradeActive(true);
    // First scan to discover opportunities
    await runScalperScan(false);
    // Then continuously scan and auto-execute every 30 seconds
    autoTradeInterval.current = setInterval(() => runScalperScan(true), 30000);
  };

  const stopAutoTrade = () => {
    setIsAutoTradeActive(false);
    if (autoTradeInterval.current) {
      clearInterval(autoTradeInterval.current);
      autoTradeInterval.current = null;
    }
    setScanStatus('');
    setOpportunities([]);
  };

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
              <p className="text-2xl font-bold text-[#00ff88]">50</p>
              <p className="text-xs text-[#8899aa]">Credits / 24 lists</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <p className="text-2xl font-bold text-[#00ff88]">100</p>
              <p className="text-xs text-[#8899aa]">Credits / 48 lists</p>
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
                    <span className="text-sm font-medium">{signal.token_name}</span>
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
              step="0.01"
              min="0.001"
            />
            <span className="text-xs text-[#8899aa]">SOL</span>
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
                    <p className="font-bold">{signal.token_name} <span className="text-[#8899aa] text-xs">({signal.token_symbol})</span></p>
                    <p className="text-xs font-mono text-[#8899aa] truncate max-w-[200px]">{signal.mint_address}</p>
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

          {/* Auto-Trade Control */}
          <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Zap className="w-10 h-10 mx-auto mb-3 text-amber-400" />
            <h3 className="font-bold text-lg mb-1">Auto-Trade Bot</h3>
            <p className="text-xs text-[#8899aa] mb-4">Scans all sources every 30s — always finds & executes the best opportunity</p>
            
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
                    <span>Scanning all sources...</span>
                  </div>
                )}
                {scanStatus && (
                  <p className="text-xs text-[#8899aa] px-2">{scanStatus}</p>
                )}
                <div className="text-xs text-[#8899aa] space-y-0.5">
                  <p>✓ $10 USD per trade · 2× TP · −30% SL · 15 min max hold</p>
                  <p>✓ Auto-scanning every 30s · Always finds best match</p>
                  <p>✓ {opportunities.length} opportunities found last scan</p>
                </div>
                <Button variant="destructive" onClick={stopAutoTrade} className="w-full">
                  <Square className="w-4 h-4 mr-2" />Stop Auto-Trade
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
                  disabled={!wallet || isScanning}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
                  size="lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isScanning ? 'Starting...' : 'Start Auto-Trade Bot — $10/trade'}
                </Button>
                {!wallet && <p className="text-xs text-[#ff4444] mt-2">Create a wallet first</p>}
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
                          <span className="font-medium text-sm">{opp.name}</span>
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
                      <p className="text-sm font-medium">{trade.token_name}</p>
                      <p className="text-xs text-[#8899aa]">{trade.amount_sol.toFixed(3)} SOL</p>
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
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">Trade History</span>
              <span className="text-sm text-[#00ff88]">Total: ${totalProfit.toFixed(2)}</span>
            </div>
            {trades.filter(t => t.status === 'closed' || t.status === 'profit' || t.status === 'loss').length === 0 ? (
              <div className="text-center py-12 text-[#8899aa]">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No completed trades yet</p>
                <p className="text-xs mt-1">Activate auto-trade to start</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trades.filter(t => t.status !== 'active').map(trade => (
                  <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div>
                      <p className="text-sm font-medium">{trade.token_name}</p>
                      <p className="text-xs text-[#8899aa]">{new Date(trade.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={trade.status === 'profit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                        {trade.status === 'profit' ? '✓ PROFIT' : '✗ LOSS'}
                      </Badge>
                      <p className="text-xs mt-1">{trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
