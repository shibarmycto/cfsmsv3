import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, Coins, TrendingUp, TrendingDown, Search, 
  Plus, Zap, BarChart3, ArrowUpRight, ArrowDownRight,
  Star, Shield, Award, Crown, RefreshCw, Radio
} from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';
import TokenPriceChart from '@/components/TokenPriceChart';
import { TradeHistoryPanel } from '@/components/TradeHistoryPanel';

interface Token {
  id: string;
  creator_id: string;
  name: string;
  symbol: string;
  description: string | null;
  logo_emoji: string;
  total_supply: number;
  circulating_supply: number;
  price_per_token: number;
  market_cap: number;
  total_volume: number;
  total_sales_value: number;
  status: 'active' | 'established' | 'verified' | 'graduated' | 'suspended';
  is_featured: boolean;
  created_at: string;
}

interface TokenHolding {
  id: string;
  token_id: string;
  amount: number;
  avg_buy_price: number;
  token?: Token;
}

interface TokenNews {
  id: string;
  token_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  impact: string;
  created_at: string;
  token?: Token;
}

const EMOJI_OPTIONS = ['🪙', '💎', '🚀', '🌙', '⭐', '🔥', '💰', '🦊', '🐕', '🐸', '🦁', '🐉', '🌈', '⚡', '🎯', '🎮'];

export default function Exchange() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('market');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [news, setNews] = useState<TokenNews[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTrading, setIsTrading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Create token form
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDescription, setTokenDescription] = useState('');
  const [tokenEmoji, setTokenEmoji] = useState('🪙');
  const [isCreating, setIsCreating] = useState(false);

  // Trade form
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  // Memoized fetch function for realtime updates
  const fetchTokens = useCallback(async () => {
    const { data: tokensData } = await supabase
      .from('user_tokens')
      .select('*')
      .neq('status', 'suspended')
      .order('total_volume', { ascending: false });

    if (tokensData) {
      setTokens(tokensData as Token[]);
      // Update selected token if it exists
      if (selectedToken) {
        const updated = tokensData.find(t => t.id === selectedToken.id);
        if (updated) setSelectedToken(updated as Token);
      }
    }
  }, [selectedToken]);

  const fetchHoldings = useCallback(async () => {
    if (!user) return;
    const { data: holdingsData } = await supabase
      .from('token_holdings')
      .select('*, token:user_tokens(*)')
      .eq('user_id', user.id);

    if (holdingsData) {
      setHoldings(holdingsData as any);
    }
  }, [user]);

  const fetchNews = useCallback(async () => {
    const { data: newsData } = await supabase
      .from('token_news')
      .select('*, token:user_tokens(name, symbol, logo_emoji)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (newsData) {
      setNews(newsData as any);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up realtime subscriptions
      const tokensChannel = supabase
        .channel('exchange-tokens')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_tokens',
          },
          (payload) => {
            console.log('Token update:', payload);
            fetchTokens();
          }
        )
        .subscribe((status) => {
          setIsRealtimeConnected(status === 'SUBSCRIBED');
        });

      const transactionsChannel = supabase
        .channel('exchange-transactions')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'token_transactions',
          },
          (payload) => {
            console.log('New transaction:', payload);
            // Show toast for new trades
            const tx = payload.new as any;
            if (tx.transaction_type === 'buy' || tx.transaction_type === 'sell') {
              toast.info(`New ${tx.transaction_type}: ${tx.amount.toLocaleString()} tokens traded`, {
                duration: 3000,
              });
            }
            fetchTokens();
            fetchHoldings();
          }
        )
        .subscribe();

      const newsChannel = supabase
        .channel('exchange-news')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'token_news',
          },
          (payload) => {
            console.log('New market event:', payload);
            const newsItem = payload.new as any;
            toast.info(`📰 ${newsItem.title}`, {
              duration: 5000,
            });
            fetchNews();
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(tokensChannel);
        supabase.removeChannel(transactionsChannel);
        supabase.removeChannel(newsChannel);
      };
    }
  }, [user, fetchTokens, fetchHoldings, fetchNews]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchTokens(), fetchHoldings(), fetchNews()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast.error('Name and symbol are required');
      return;
    }

    if (tokenSymbol.length < 2 || tokenSymbol.length > 6) {
      toast.error('Symbol must be 2-6 characters');
      return;
    }

    if ((profile?.sms_credits || 0) < 25) {
      toast.error('Need 25 credits to create a token');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('token-trade', {
        body: {
          action: 'create_token',
          name: tokenName.trim(),
          symbol: tokenSymbol.trim(),
          description: tokenDescription.trim() || null,
          logoEmoji: tokenEmoji,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`${tokenSymbol.toUpperCase()} token created successfully!`);
      setTokenName('');
      setTokenSymbol('');
      setTokenDescription('');
      setTokenEmoji('🪙');
      refreshProfile();
      fetchData();
      setActiveTab('market');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create token');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTrade = async () => {
    if (!selectedToken || !tradeAmount || parseInt(tradeAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const amount = parseInt(tradeAmount);

    if (tradeType === 'buy') {
      const cost = amount * selectedToken.price_per_token;
      if ((profile?.sms_credits || 0) < cost) {
        toast.error(`Need ${cost} credits to buy ${amount} tokens`);
        return;
      }
    }

    setIsTrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('token-trade', {
        body: {
          action: tradeType === 'buy' ? 'buy_tokens' : 'sell_tokens',
          tokenId: selectedToken.id,
          amount,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(
        tradeType === 'buy'
          ? `Bought ${amount.toLocaleString()} ${selectedToken.symbol} for ${data.totalCost} credits`
          : `Sold ${amount.toLocaleString()} ${selectedToken.symbol} for ${data.totalValue} credits`
      );
      setTradeAmount('');
      refreshProfile();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Trade failed');
    } finally {
      setIsTrading(false);
    }
  };

  const getStatusBadge = (status: Token['status']) => {
    switch (status) {
      case 'established':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Shield className="w-3 h-3 mr-1" /> Established</Badge>;
      case 'verified':
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"><Award className="w-3 h-3 mr-1" /> Verified</Badge>;
      case 'graduated':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Crown className="w-3 h-3 mr-1" /> Graduated</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Star className="w-3 h-3 mr-1" /> New</Badge>;
    }
  };

  const filteredTokens = tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserHolding = (tokenId: string) => {
    return holdings.find((h) => h.token_id === tokenId);
  };

  const totalPortfolioValue = holdings.reduce((acc, h) => {
    const token = tokens.find((t) => t.id === h.token_id);
    return acc + (token ? h.amount * token.price_per_token : 0);
  }, 0);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold">CF Exchange</h1>
                    {isRealtimeConnected && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Radio className="w-3 h-3 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Token Market</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Your Balance</p>
                <p className="font-bold text-primary">{(profile?.sms_credits || 0).toLocaleString()} Credits</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">Portfolio Value</p>
                <p className="font-bold text-green-400">{totalPortfolioValue.toLocaleString()} Credits</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="market" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Market
                </TabsTrigger>
                <TabsTrigger value="portfolio" className="flex items-center gap-2">
                  <Coins className="w-4 h-4" /> Portfolio
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create
                </TabsTrigger>
                <TabsTrigger value="news" className="flex items-center gap-2">
                  <Zap className="w-4 h-4" /> News
                </TabsTrigger>
              </TabsList>

              {/* Market Tab */}
              <TabsContent value="market" className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* Token List */}
                <div className="space-y-2">
                  {filteredTokens.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center">
                        <Coins className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No tokens found</p>
                        <Button className="mt-4" onClick={() => setActiveTab('create')}>
                          Create First Token
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredTokens.map((token) => {
                      const holding = getUserHolding(token.id);
                      return (
                        <Card
                          key={token.id}
                          className={`cursor-pointer transition-all hover:border-primary/50 ${
                            selectedToken?.id === token.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedToken(token)}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl">
                                  {token.logo_emoji}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{token.name}</h3>
                                    {getStatusBadge(token.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{token.symbol}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{token.price_per_token} Credits</p>
                                <p className="text-xs text-muted-foreground">
                                  MCap: {token.market_cap.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right hidden sm:block">
                                <p className="text-sm">Vol: {token.total_volume.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">
                                  Circ: {token.circulating_supply.toLocaleString()}
                                </p>
                              </div>
                              {holding && (
                                <div className="text-right hidden md:block">
                                  <p className="text-sm text-green-400">
                                    You own: {holding.amount.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ≈ {(holding.amount * token.price_per_token).toLocaleString()} Credits
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* Portfolio Tab */}
              <TabsContent value="portfolio" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Holdings</CardTitle>
                    <CardDescription>
                      Total value: {totalPortfolioValue.toLocaleString()} Credits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {holdings.length === 0 ? (
                      <div className="text-center py-8">
                        <Coins className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No tokens in portfolio</p>
                        <Button className="mt-4" onClick={() => setActiveTab('market')}>
                          Browse Market
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {holdings.map((holding) => {
                          const token = tokens.find((t) => t.id === holding.token_id);
                          if (!token) return null;
                          const value = holding.amount * token.price_per_token;
                          const profitLoss = (token.price_per_token - holding.avg_buy_price) * holding.amount;
                          return (
                            <div
                              key={holding.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                setSelectedToken(token);
                                setActiveTab('market');
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{token.logo_emoji}</span>
                                <div>
                                  <p className="font-medium">{token.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{holding.amount.toLocaleString()} tokens</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{value.toLocaleString()} Credits</p>
                                <p className={`text-xs ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {profitLoss >= 0 ? '+' : ''}{profitLoss.toLocaleString()} P/L
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Create Token Tab */}
              <TabsContent value="create">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" /> Create New Token
                    </CardTitle>
                    <CardDescription>
                      Launch your own cryptocurrency on the CF Network. Costs 25 credits. 999M tokens will be created.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Token Name</Label>
                        <Input
                          placeholder="e.g. MoonCoin"
                          value={tokenName}
                          onChange={(e) => setTokenName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Symbol (2-6 chars)</Label>
                        <Input
                          placeholder="e.g. MOON"
                          value={tokenSymbol}
                          onChange={(e) => setTokenSymbol(e.target.value.toUpperCase().slice(0, 6))}
                          maxLength={6}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Textarea
                        placeholder="Tell people about your token..."
                        value={tokenDescription}
                        onChange={(e) => setTokenDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Token Emoji</Label>
                      <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all ${
                              tokenEmoji === emoji
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-primary/50'
                            }`}
                            onClick={() => setTokenEmoji(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Card className="bg-muted/30">
                      <CardContent className="py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Creation Cost</p>
                            <p className="font-bold text-primary">25 Credits</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Initial Supply</p>
                            <p className="font-bold">999M</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Starting Price</p>
                            <p className="font-bold">1 Credit</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Your Balance</p>
                            <p className="font-bold">{(profile?.sms_credits || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 rounded-lg p-4 border border-amber-500/20">
                      <h4 className="font-semibold mb-2">🏆 Achievement Milestones</h4>
                      <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-400" />
                          <span>10K sales = Established</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-cyan-400" />
                          <span>50K sales = Verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-purple-400" />
                          <span>100K sales = Graduated + Brand Deal</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCreateToken}
                      disabled={isCreating || (profile?.sms_credits || 0) < 25}
                    >
                      {isCreating ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Coins className="w-4 h-4 mr-2" />
                      )}
                      Create Token (25 Credits)
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* News Tab */}
              <TabsContent value="news" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" /> Economic Calendar
                    </CardTitle>
                    <CardDescription>Market events and announcements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {news.length === 0 ? (
                      <div className="text-center py-8">
                        <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No news yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {news.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border-l-4 ${
                              item.impact === 'high'
                                ? 'border-l-red-500 bg-red-500/5'
                                : item.impact === 'medium'
                                ? 'border-l-amber-500 bg-amber-500/5'
                                : 'border-l-muted bg-muted/30'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {item.token && (
                                  <span className="text-lg">{(item.token as any).logo_emoji}</span>
                                )}
                                <p className="font-medium">{item.title}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Trade Panel (Right Sidebar) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedToken ? (
                  <>
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <span className="text-4xl">{selectedToken.logo_emoji}</span>
                      <h3 className="font-bold mt-2">{selectedToken.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedToken.symbol}</p>
                      <div className="mt-2">{getStatusBadge(selectedToken.status)}</div>
                      <p className="text-2xl font-bold text-primary mt-2">
                        {selectedToken.price_per_token} Credits
                      </p>
                    </div>

                    {/* Price Chart */}
                    <TokenPriceChart 
                      tokenId={selectedToken.id} 
                      tokenSymbol={selectedToken.symbol}
                      currentPrice={selectedToken.price_per_token}
                    />

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded bg-muted/30">
                        <p className="text-xs text-muted-foreground">Market Cap</p>
                        <p className="font-medium">{selectedToken.market_cap.toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/30">
                        <p className="text-xs text-muted-foreground">Volume</p>
                        <p className="font-medium">{selectedToken.total_volume.toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/30">
                        <p className="text-xs text-muted-foreground">Circulating</p>
                        <p className="font-medium">{selectedToken.circulating_supply.toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/30">
                        <p className="text-xs text-muted-foreground">Total Sales</p>
                        <p className="font-medium">{selectedToken.total_sales_value.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={tradeType === 'buy' ? 'default' : 'outline'}
                        onClick={() => setTradeType('buy')}
                        className={tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <ArrowUpRight className="w-4 h-4 mr-1" /> Buy
                      </Button>
                      <Button
                        variant={tradeType === 'sell' ? 'default' : 'outline'}
                        onClick={() => setTradeType('sell')}
                        className={tradeType === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        <ArrowDownRight className="w-4 h-4 mr-1" /> Sell
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        min="1"
                      />
                      {tradeAmount && (
                        <p className="text-sm text-muted-foreground">
                          Total: {(parseInt(tradeAmount) * selectedToken.price_per_token).toLocaleString()} Credits
                        </p>
                      )}
                    </div>

                    <Button
                      className={`w-full ${
                        tradeType === 'buy'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                      onClick={handleTrade}
                      disabled={isTrading || !tradeAmount}
                    >
                      {isTrading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : tradeType === 'buy' ? (
                        <ArrowUpRight className="w-4 h-4 mr-2" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 mr-2" />
                      )}
                      {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedToken.symbol}
                    </Button>

                    {/* Trade History Panel */}
                    <TradeHistoryPanel 
                      tokenId={selectedToken.id}
                      tokenSymbol={selectedToken.symbol}
                    />
                  </>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Select a token to trade</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
