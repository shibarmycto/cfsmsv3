import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  CheckCircle, XCircle, RefreshCw, Users, Zap, 
  TrendingUp, Clock, Eye, Copy, ExternalLink, Send
} from 'lucide-react';

interface SignalAccess {
  id: string;
  user_id: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  is_approved: boolean;
  can_view_signals: boolean;
  can_execute_trades: boolean;
  created_at: string;
  approved_at: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  credits_spent: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  signals_sent: number;
}

interface LiveToken {
  name: string;
  symbol: string;
  mint: string;
  marketCap: number;
  createdAt: number;
  isNew: boolean;
}

export default function AdminSignalAccessTab() {
  const [accessRequests, setAccessRequests] = useState<SignalAccess[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [liveTokens, setLiveTokens] = useState<LiveToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    fetchData();
    fetchLiveTokens();
    
    // Auto-refresh live tokens every minute
    const interval = setInterval(fetchLiveTokens, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [accessRes, subsRes] = await Promise.all([
      supabase.from('signal_access').select('*').order('created_at', { ascending: false }),
      supabase.from('signal_subscriptions').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    
    if (accessRes.data) setAccessRequests(accessRes.data);
    if (subsRes.data) setSubscriptions(subsRes.data);
    
    setIsLoading(false);
  };

  const fetchLiveTokens = async () => {
    setIsFetching(true);
    try {
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
          .slice(0, 20)
          .map((t: any) => ({
            name: t.name || 'Unknown',
            symbol: t.symbol || 'UNK',
            mint: t.mint,
            marketCap: t.usd_market_cap || 0,
            createdAt: t.created_timestamp,
            isNew: Date.now() - t.created_timestamp < 60000,
          }));
        
        setLiveTokens(recentTokens);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const approveAccess = async (id: string, approve: boolean) => {
    const { error } = await supabase
      .from('signal_access')
      .update({
        is_approved: approve,
        can_view_signals: approve,
        approved_at: approve ? new Date().toISOString() : null,
      })
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to update access');
    } else {
      toast.success(approve ? 'Access approved!' : 'Access revoked');
      fetchData();
    }
  };

  const toggleTradeAccess = async (id: string, canTrade: boolean) => {
    const { error } = await supabase
      .from('signal_access')
      .update({ can_execute_trades: canTrade })
      .eq('id', id);
    
    if (!error) {
      toast.success('Trade access updated');
      fetchData();
    }
  };

  const copyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    toast.success('Mint copied!');
  };

  const pendingCount = accessRequests.filter(r => !r.is_approved).length;
  const approvedCount = accessRequests.filter(r => r.is_approved).length;
  const activeSubsCount = subscriptions.filter(s => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-500">{approvedCount}</p>
              </div>
              <Users className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subs</p>
                <p className="text-2xl font-bold text-primary">{activeSubsCount}</p>
              </div>
              <Zap className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live Tokens</p>
                <p className="text-2xl font-bold">{liveTokens.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">
            <Zap className="w-4 h-4 mr-1" />
            Live Signals
          </TabsTrigger>
          <TabsTrigger value="access">
            <Users className="w-4 h-4 mr-1" />
            Access Requests
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-yellow-500">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <TrendingUp className="w-4 h-4 mr-1" />
            Subscriptions
          </TabsTrigger>
        </TabsList>

        {/* Live Signals Tab - Admin Only */}
        <TabsContent value="signals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                ⚡ Latest Tokens (1-5 min old)
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={fetchLiveTokens}
                disabled={isFetching}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh (1min)
              </Button>
            </CardHeader>
            <CardContent>
              {liveTokens.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No new tokens found in the last 5 minutes. Scanning...
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {liveTokens.map((token, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {token.isNew ? (
                            <Badge className="bg-green-500 text-xs animate-pulse">🆕 NEW</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">⚠️</Badge>
                          )}
                          <span className="font-bold">{token.name}</span>
                          <span className="text-muted-foreground text-sm">({token.symbol})</span>
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
                      <div className="mt-1 text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <p>MC: {(token.marketCap / 150).toFixed(2)} SOL</p>
                        <p>Age: {Math.floor((Date.now() - token.createdAt) / 60000)}m ago</p>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground truncate mt-1">
                        Mint: {token.mint}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Requests Tab */}
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Signal Platform Access</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : accessRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No access requests</p>
              ) : (
                <div className="space-y-3">
                  {accessRequests.map((request) => (
                    <div key={request.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm">{request.user_id.slice(0, 8)}...</p>
                          {request.telegram_username && (
                            <p className="text-sm text-muted-foreground">
                              @{request.telegram_username}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Requested: {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {request.is_approved ? (
                            <>
                              <Badge className="bg-green-500">Approved</Badge>
                              <Button
                                size="sm"
                                variant={request.can_execute_trades ? 'default' : 'outline'}
                                onClick={() => toggleTradeAccess(request.id, !request.can_execute_trades)}
                              >
                                {request.can_execute_trades ? 'Trade: ON' : 'Trade: OFF'}
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => approveAccess(request.id, false)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-yellow-500">Pending</Badge>
                              <Button
                                size="icon"
                                variant="default"
                                className="bg-green-500 hover:bg-green-600"
                                onClick={() => approveAccess(request.id, true)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => approveAccess(request.id, false)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Signal Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No subscriptions yet</p>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm">{sub.user_id.slice(0, 8)}...</p>
                          <p className="text-sm capitalize">
                            Plan: {sub.plan_type === 'hourly' ? '24 lists/day' : '48 lists/day'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sub.credits_spent} credits • {sub.signals_sent} sent
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={sub.is_active ? 'bg-green-500' : 'bg-gray-500'}>
                            {sub.is_active ? 'Active' : 'Expired'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(sub.expires_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
