import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, TrendingDown, Search, RefreshCw,
  Coins, Zap, Shield, Award, Crown, Ban, CheckCircle,
  Calendar, DollarSign, Users, Activity
} from 'lucide-react';

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

interface TokenNews {
  id: string;
  token_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  impact: string;
  created_at: string;
  token?: { name: string; symbol: string; logo_emoji: string };
}

interface Transaction {
  id: string;
  token_id: string;
  buyer_id: string | null;
  seller_id: string | null;
  transaction_type: string;
  amount: number;
  price_per_token: number;
  total_credits: number;
  created_at: string;
  token?: Token;
}

export default function AdminExchangeTab() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [news, setNews] = useState<TokenNews[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all tokens including suspended
      const { data: tokensData } = await supabase
        .from('user_tokens')
        .select('*')
        .order('total_volume', { ascending: false });

      if (tokensData) setTokens(tokensData as Token[]);

      // Fetch news
      const { data: newsData } = await supabase
        .from('token_news')
        .select('*, token:user_tokens(name, symbol, logo_emoji)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (newsData) setNews(newsData as any);

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from('token_transactions')
        .select('*, token:user_tokens(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (txData) setTransactions(txData as any);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendToken = async (token: Token) => {
    const newStatus = token.status === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase
      .from('user_tokens')
      .update({ status: newStatus })
      .eq('id', token.id);

    if (error) {
      toast.error('Failed to update token status');
      return;
    }

    // Add news event
    await supabase.from('token_news').insert({
      token_id: token.id,
      event_type: newStatus === 'suspended' ? 'suspended' : 'unsuspended',
      title: newStatus === 'suspended' 
        ? `⚠️ ${token.symbol} has been suspended`
        : `✅ ${token.symbol} trading resumed`,
      description: `Token ${newStatus === 'suspended' ? 'suspended' : 'unsuspended'} by admin`,
      impact: 'high',
    });

    toast.success(`Token ${newStatus === 'suspended' ? 'suspended' : 'unsuspended'}`);
    fetchData();
  };

  const handleFeatureToken = async (token: Token) => {
    const { error } = await supabase
      .from('user_tokens')
      .update({ is_featured: !token.is_featured })
      .eq('id', token.id);

    if (error) {
      toast.error('Failed to update featured status');
      return;
    }

    toast.success(token.is_featured ? 'Removed from featured' : 'Added to featured');
    fetchData();
  };

  const getStatusBadge = (status: Token['status']) => {
    switch (status) {
      case 'established':
        return <Badge className="bg-amber-500/20 text-amber-400"><Shield className="w-3 h-3 mr-1" /> Established</Badge>;
      case 'verified':
        return <Badge className="bg-cyan-500/20 text-cyan-400"><Award className="w-3 h-3 mr-1" /> Verified</Badge>;
      case 'graduated':
        return <Badge className="bg-purple-500/20 text-purple-400"><Crown className="w-3 h-3 mr-1" /> Graduated</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      default:
        return <Badge variant="outline">Active</Badge>;
    }
  };

  // Stats calculations
  const totalMarketCap = tokens.reduce((acc, t) => acc + t.market_cap, 0);
  const totalVolume = tokens.reduce((acc, t) => acc + t.total_volume, 0);
  const activeTokens = tokens.filter((t) => t.status !== 'suspended').length;
  const graduatedTokens = tokens.filter((t) => t.status === 'graduated').length;

  const filteredTokens = tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total Market Cap</p>
                <p className="text-xl font-bold">{totalMarketCap.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-xl font-bold">{totalVolume.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-xs text-muted-foreground">Active Tokens</p>
                <p className="text-xl font-bold">{activeTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-xs text-muted-foreground">Graduated</p>
                <p className="text-xl font-bold">{graduatedTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" /> All Tokens
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <TrendingUp className="w-4 h-4 mr-2" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" /> Economic Calendar
          </TabsTrigger>
        </TabsList>

        {/* All Tokens */}
        <TabsContent value="overview" className="space-y-4">
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

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Market Cap</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Circulating</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{token.logo_emoji}</span>
                        <div>
                          <p className="font-medium">{token.name}</p>
                          <p className="text-xs text-muted-foreground">{token.symbol}</p>
                        </div>
                        {token.is_featured && (
                          <Badge variant="outline" className="text-amber-400 border-amber-400">
                            ⭐ Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(token.status)}</TableCell>
                    <TableCell className="text-right">{token.market_cap.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{token.total_volume.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{token.total_sales_value.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{token.circulating_supply.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={token.is_featured ? 'secondary' : 'outline'}
                          onClick={() => handleFeatureToken(token)}
                        >
                          ⭐
                        </Button>
                        <Button
                          size="sm"
                          variant={token.status === 'suspended' ? 'default' : 'destructive'}
                          onClick={() => handleSuspendToken(token)}
                        >
                          {token.status === 'suspended' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {tx.token && (
                            <div className="flex items-center gap-2">
                              <span>{tx.token.logo_emoji}</span>
                              <span>{tx.token.symbol}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.transaction_type === 'buy'
                                ? 'default'
                                : tx.transaction_type === 'sell'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className={
                              tx.transaction_type === 'buy'
                                ? 'bg-green-500/20 text-green-400'
                                : tx.transaction_type === 'sell'
                                ? 'bg-red-500/20 text-red-400'
                                : ''
                            }
                          >
                            {tx.transaction_type === 'buy' && <TrendingUp className="w-3 h-3 mr-1" />}
                            {tx.transaction_type === 'sell' && <TrendingDown className="w-3 h-3 mr-1" />}
                            {tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{tx.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{tx.price_per_token}</TableCell>
                        <TableCell className="text-right font-medium">
                          {tx.total_credits.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Economic Calendar */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" /> Economic Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {news.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No events yet</p>
                  </div>
                ) : (
                  news.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        item.impact === 'high'
                          ? 'border-l-red-500 bg-red-500/5'
                          : item.impact === 'medium'
                          ? 'border-l-amber-500 bg-amber-500/5'
                          : 'border-l-muted bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {item.token && <span className="text-2xl">{item.token.logo_emoji}</span>}
                          <div>
                            <p className="font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              item.impact === 'high'
                                ? 'destructive'
                                : item.impact === 'medium'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {item.impact}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
