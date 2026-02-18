import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Rocket, Square, RefreshCw, Wallet, TrendingUp, Zap, AlertTriangle, Activity, DollarSign } from 'lucide-react';

interface SessionData {
  is_active: boolean;
  wallet: string;
  balance: number;
  trade_size_sol: number;
  cycles_completed: number;
  max_cycles: number;
  total_volume_usd: number;
  started_at: string | null;
}

interface TokenData {
  priceUsd: string;
  marketCap: number;
  volume24h: number;
  buysTxns: number;
  sellsTxns: number;
  priceChange24h: number;
}

export default function VolumeBotTab() {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [tradeSize, setTradeSize] = useState('0.005');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const callApi = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) { toast({ title: 'Not authenticated', variant: 'destructive' }); return null; }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volume-bot-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ action, ...extra }),
      }
    );
    return res.json();
  }, [toast]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi('status');
      if (data?.success) {
        setSession(data.session);
        setTokenData(data.token);
        if (data.session?.trade_size_sol) setTradeSize(String(data.session.trade_size_sol));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [callApi]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh every 30s when active
  useEffect(() => {
    if (!session?.is_active) return;
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [session?.is_active, fetchStatus]);

  const handleSetWallet = async () => {
    if (!privateKey.trim()) return;
    setActionLoading('wallet');
    const data = await callApi('set_wallet', { private_key: privateKey.trim() });
    setActionLoading('');
    if (data?.success) {
      toast({ title: 'Wallet Connected', description: `Address: ${data.public_key.slice(0, 8)}...` });
      setPrivateKey('');
      fetchStatus();
    } else {
      toast({ title: 'Error', description: data?.error || 'Failed', variant: 'destructive' });
    }
  };

  const handleSetVolume = async () => {
    setActionLoading('volume');
    const data = await callApi('set_volume', { trade_size_sol: parseFloat(tradeSize) });
    setActionLoading('');
    if (data?.success) {
      toast({ title: 'Trade size updated' });
      fetchStatus();
    } else {
      toast({ title: 'Error', description: data?.error || 'Failed', variant: 'destructive' });
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    const data = await callApi('start');
    setActionLoading('');
    if (data?.success) {
      toast({ title: '🚀 Volume Pump Started!' });
      fetchStatus();
    } else {
      toast({ title: 'Error', description: data?.error || 'Failed', variant: 'destructive' });
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    const data = await callApi('stop');
    setActionLoading('');
    if (data?.success) {
      toast({ title: 'Volume Pump Stopped', description: `Cycles: ${data.cycles_completed}, Volume: $${(data.total_volume_usd || 0).toFixed(2)}` });
      fetchStatus();
    } else {
      toast({ title: 'Error', description: data?.error || 'Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Volume Bot
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Automated buy/sell cycles for $CFB volume generation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status Card */}
      {session && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Session Status</span>
              <span className={`text-sm px-3 py-1 rounded-full ${session.is_active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                {session.is_active ? '🟢 ACTIVE' : '🔴 STOPPED'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</div>
                <p className="font-mono text-sm mt-1 truncate">{session.wallet ? `${session.wallet.slice(0, 8)}...${session.wallet.slice(-4)}` : 'Not set'}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Balance</div>
                <p className="font-semibold text-sm mt-1">{session.balance?.toFixed(4) || '0'} SOL</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Cycles</div>
                <p className="font-semibold text-sm mt-1">{session.cycles_completed} / {session.max_cycles}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Volume</div>
                <p className="font-semibold text-sm mt-1">${(session.total_volume_usd || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token Stats */}
      {tokenData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">$CFB Live Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Price</div>
                <p className="font-semibold mt-1">${tokenData.priceUsd}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Market Cap</div>
                <p className="font-semibold mt-1">${tokenData.marketCap.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">24h Volume</div>
                <p className="font-semibold mt-1">${tokenData.volume24h.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">24h Change</div>
                <p className={`font-semibold mt-1 ${tokenData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tokenData.priceChange24h >= 0 ? '+' : ''}{tokenData.priceChange24h.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Setup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5" /> {session?.wallet ? 'Change Wallet' : 'Connect Wallet'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Paste your Solana private key (base58)"
              className="bg-secondary/50 font-mono text-sm"
            />
            <Button onClick={handleSetWallet} disabled={actionLoading === 'wallet' || !privateKey.trim()}>
              {actionLoading === 'wallet' ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
          <div className="flex items-start gap-2 mt-3 text-xs text-yellow-400/80 bg-yellow-500/10 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Use a dedicated wallet with small SOL amounts only. Your key is stored securely server-side and never exposed to the frontend.</span>
          </div>
        </CardContent>
      </Card>

      {/* Trade Size + Controls */}
      {session?.wallet && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" /> Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Trade Size (SOL per cycle)</label>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={tradeSize}
                  onChange={(e) => setTradeSize(e.target.value)}
                  min={0.001}
                  max={0.01}
                  step={0.001}
                  className="bg-secondary/50 w-40"
                />
                <Button variant="outline" onClick={handleSetVolume} disabled={actionLoading === 'volume'}>
                  {actionLoading === 'volume' ? 'Saving...' : 'Update'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Min: 0.001 SOL — Max: 0.01 SOL</p>
            </div>

            <div className="flex gap-3 pt-2">
              {!session.is_active ? (
                <Button onClick={handleStart} disabled={actionLoading === 'start'} className="bg-green-600 hover:bg-green-700 text-white flex-1">
                  <Rocket className="w-4 h-4 mr-2" />
                  {actionLoading === 'start' ? 'Starting...' : 'Start Pump'}
                </Button>
              ) : (
                <Button onClick={handleStop} disabled={actionLoading === 'stop'} variant="destructive" className="flex-1">
                  <Square className="w-4 h-4 mr-2" />
                  {actionLoading === 'stop' ? 'Stopping...' : 'Stop Pump'}
                </Button>
              )}
            </div>

            {session.is_active && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400">
                Bot is actively running buy/sell cycles with {VOLUME_CONFIG_MIN}-{VOLUME_CONFIG_MAX}s random intervals. Status auto-refreshes every 30s.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>The volume bot executes rapid buy/sell cycles on your $CFB position to generate on-chain trading volume:</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Buys $CFB with SOL</li>
            <li>Waits 3-8 seconds</li>
            <li>Sells $CFB back to SOL</li>
            <li>Waits 30-120 seconds (randomized for organic look)</li>
            <li>Repeats until stopped or max cycles reached</li>
          </ol>
          <p className="text-yellow-400/80 mt-3">⚠️ Costs: Gas fees (~0.001 SOL/cycle) + slippage. Use a dedicated wallet.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Config display constants
const VOLUME_CONFIG_MIN = 30;
const VOLUME_CONFIG_MAX = 120;
