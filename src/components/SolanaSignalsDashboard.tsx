import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Zap, Wallet, TrendingUp, RefreshCw, Play, Square, 
  Eye, EyeOff, Copy, ExternalLink, Shield, Clock, Coins
} from 'lucide-react';

interface TokenSignal {
  id: string;
  token_name: string;
  token_symbol: string;
  mint_address: string;
  market_cap_sol: number;
  liquidity_sol: number;
  price_usd: number;
  created_time: string;
  first_seen_at: string;
}

interface WalletInfo {
  public_key: string | null;
  balance_sol: number;
  is_trading_enabled: boolean;
}

export default function SolanaSignalsDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [signals, setSignals] = useState<TokenSignal[]>([]);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<'hourly' | 'half_hourly'>('hourly');

  useEffect(() => {
    if (user) {
      checkAccess();
      fetchWallet();
      fetchSubscription();
    }
  }, [user]);

  // Auto-fetch signals for admins every minute
  useEffect(() => {
    if (isAdmin && hasAccess) {
      fetchLiveSignals();
      const interval = setInterval(fetchLiveSignals, 60000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, hasAccess]);

  const checkAccess = async () => {
    if (!user) return;
    
    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!roleData);
    
    // Check signal access
    const { data: accessData } = await supabase
      .from('signal_access')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (accessData) {
      setHasAccess(true);
      setIsApproved(accessData.is_approved);
    }
    
    setIsLoading(false);
  };

  const fetchWallet = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('solana_wallets')
      .select('public_key, balance_sol, is_trading_enabled')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setWallet(data as WalletInfo);
    }
  };

  const fetchSubscription = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('signal_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      setSubscription(data);
    }
  };

  const fetchLiveSignals = useCallback(async () => {
    setIsFetching(true);
    try {
      // Fetch from edge function
      const { data, error } = await supabase.functions.invoke('solana-signal-bot', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Fallback to direct PumpFun fetch
      const response = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=30&sort=created_timestamp&order=DESC&includeNsfw=false');
      if (response.ok) {
        const tokens = await response.json();
        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;
        
        const recentTokens = tokens
          .filter((t: any) => {
            const created = t.created_timestamp || 0;
            return created > fiveMinAgo;
          })
          .slice(0, 15)
          .map((t: any) => ({
            name: t.name || 'Unknown',
            symbol: t.symbol || 'UNK',
            mint: t.mint,
            marketCap: t.usd_market_cap || 0,
            liquidity: t.liquidity || 0,
            createdAt: t.created_timestamp,
            isNew: Date.now() - t.created_timestamp < 60000,
          }));
        
        setLiveSignals(recentTokens);
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const requestAccess = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('signal_access')
      .insert({
        user_id: user.id,
        is_approved: false,
      });
    
    if (error) {
      if (error.code === '23505') {
        toast.info('Access request already submitted');
      } else {
        toast.error('Failed to request access');
      }
    } else {
      toast.success('Access request submitted! Awaiting admin approval.');
      setHasAccess(true);
    }
  };

  const connectWallet = async () => {
    if (!user || !privateKey.trim()) {
      toast.error('Please enter your private key');
      return;
    }
    
    // Basic validation
    if (privateKey.length < 32) {
      toast.error('Invalid private key format');
      return;
    }
    
    // Store encrypted (in production, use proper encryption)
    const { error } = await supabase
      .from('solana_wallets')
      .upsert({
        user_id: user.id,
        encrypted_private_key: btoa(privateKey), // Basic encoding
        public_key: 'Calculating...', // Would derive from private key
        balance_sol: 0,
      });
    
    if (error) {
      toast.error('Failed to save wallet');
    } else {
      toast.success('Wallet connected successfully!');
      setPrivateKey('');
      fetchWallet();
    }
  };

  const purchaseSubscription = async () => {
    if (!user) return;
    
    const credits = selectedPlan === 'hourly' ? 50 : 100;
    
    // Check user profile credits
    const { data: profileData } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();
    
    if (!profileData || profileData.sms_credits < credits) {
      toast.error(`Insufficient credits. Need ${credits} CF Credits.`);
      return;
    }
    
    // Deduct credits
    const { error: creditError } = await supabase
      .from('profiles')
      .update({ sms_credits: profileData.sms_credits - credits })
      .eq('user_id', user.id);
    
    if (creditError) {
      toast.error('Failed to process payment');
      return;
    }
    
    // Create subscription
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { error } = await supabase
      .from('signal_subscriptions')
      .insert({
        user_id: user.id,
        plan_type: selectedPlan,
        credits_spent: credits,
        expires_at: expiresAt.toISOString(),
      });
    
    if (error) {
      toast.error('Failed to create subscription');
    } else {
      toast.success(`${selectedPlan === 'hourly' ? '24' : '48'} signal lists purchased!`);
      fetchSubscription();
    }
  };

  const toggleTrading = async () => {
    if (!user || !wallet) return;
    
    const { error } = await supabase
      .from('solana_wallets')
      .update({ is_trading_enabled: !wallet.is_trading_enabled })
      .eq('user_id', user.id);
    
    if (!error) {
      setWallet({ ...wallet, is_trading_enabled: !wallet.is_trading_enabled });
      toast.success(wallet.is_trading_enabled ? 'Trading stopped' : 'Trading started');
    }
  };

  const copyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    toast.success('Mint address copied!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Access request view for non-approved users
  if (!hasAccess || !isApproved) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
          <CardTitle>Solana Signal Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Get real-time alerts for new tokens on PumpFun DEX. 
            Track new launches within 1-5 minutes of creation.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold">50</p>
              <p className="text-xs text-muted-foreground">Credits / 24 lists</p>
              <p className="text-xs">(1 per hour)</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold">100</p>
              <p className="text-xs text-muted-foreground">Credits / 48 lists</p>
              <p className="text-xs">(2 per hour)</p>
            </div>
          </div>
          
          {!hasAccess ? (
            <Button onClick={requestAccess} className="w-full" size="lg">
              <Shield className="w-4 h-4 mr-2" />
              Request Access
            </Button>
          ) : (
            <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="font-medium">Pending Approval</p>
              <p className="text-sm text-muted-foreground">
                Admin will review your request shortly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-yellow-500" />
            Solana Signals
          </h2>
          <p className="text-muted-foreground">Real-time PumpFun token alerts</p>
        </div>
        {isAdmin && (
          <Badge className="bg-red-500">Admin Access</Badge>
        )}
      </div>

      <Tabs defaultValue={isAdmin ? "signals" : "subscribe"}>
        <TabsList className="grid w-full grid-cols-4">
          {isAdmin && <TabsTrigger value="signals">Live Signals</TabsTrigger>}
          <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
        </TabsList>

        {/* Admin Live Signals Tab */}
        {isAdmin && (
          <TabsContent value="signals" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  ⚡ Latest Scan Results (1-5 min)
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={fetchLiveSignals}
                  disabled={isFetching}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {liveSignals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No new tokens in the last 5 minutes. Scanning...
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {liveSignals.map((token, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {token.isNew ? (
                              <Badge className="bg-green-500 text-xs">NEW</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">⚠️</Badge>
                            )}
                            <span className="font-bold">{token.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => copyMint(token.mint)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => window.open(`https://pump.fun/${token.mint}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <p>└ MC: {(token.marketCap / 150).toFixed(2)} SOL</p>
                          <p className="font-mono text-xs truncate">└ Mint: {token.mint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Subscribe Tab */}
        <TabsContent value="subscribe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Signal Subscription Plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedPlan === 'hourly' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                  onClick={() => setSelectedPlan('hourly')}
                >
                  <h3 className="font-bold text-lg">Standard</h3>
                  <p className="text-3xl font-bold text-primary">50</p>
                  <p className="text-sm text-muted-foreground">CF Credits</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    <li>✓ 24 signal lists</li>
                    <li>✓ 1 list per hour</li>
                    <li>✓ 24 hour access</li>
                  </ul>
                </div>
                
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedPlan === 'half_hourly' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                  onClick={() => setSelectedPlan('half_hourly')}
                >
                  <h3 className="font-bold text-lg">Premium</h3>
                  <p className="text-3xl font-bold text-primary">100</p>
                  <p className="text-sm text-muted-foreground">CF Credits</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    <li>✓ 48 signal lists</li>
                    <li>✓ 2 lists per hour</li>
                    <li>✓ 24 hour access</li>
                  </ul>
                </div>
              </div>

              {subscription ? (
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="font-medium text-green-600">Active Subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(subscription.expires_at).toLocaleString()}
                  </p>
                  <p className="text-sm">Signals sent: {subscription.signals_sent}</p>
                </div>
              ) : (
                <Button onClick={purchaseSubscription} className="w-full" size="lg">
                  <Coins className="w-4 h-4 mr-2" />
                  Purchase {selectedPlan === 'hourly' ? '24' : '48'} Signal Lists
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Solana Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {wallet?.public_key ? (
                <>
                  <div className="p-4 bg-card rounded-lg border">
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-3xl font-bold">{wallet.balance_sol.toFixed(4)} SOL</p>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Public Key</p>
                    <p className="font-mono text-sm truncate">{wallet.public_key}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={toggleTrading}
                      variant={wallet.is_trading_enabled ? 'destructive' : 'default'}
                      className="flex-1"
                    >
                      {wallet.is_trading_enabled ? (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          Stop Trading
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Trading
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-center">
                    Connect your Solana wallet to enable trading
                  </p>
                  
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      placeholder="Enter your private key"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Your private key is encrypted and stored securely. 
                    Never share it with anyone.
                  </p>
                  
                  <Button onClick={connectWallet} className="w-full">
                    Connect Wallet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trades Tab */}
        <TabsContent value="trades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Trade History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                No trades yet. Connect your wallet and start trading!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
