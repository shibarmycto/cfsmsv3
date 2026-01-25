import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Flame, Trophy, BarChart3 } from 'lucide-react';

interface TokenStats {
  id: string;
  name: string;
  symbol: string;
  logo_emoji: string;
  price_per_token: number;
  total_volume: number;
  market_cap: number;
  status: string;
  daily_volume: number;
  daily_buy_volume: number;
  daily_sell_volume: number;
}

interface TokenLeaderboardProps {
  onTokenSelect?: (tokenId: string) => void;
}

export const TokenLeaderboard = ({ onTokenSelect }: TokenLeaderboardProps) => {
  const [tokens, setTokens] = useState<TokenStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);

      // Get all active tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('user_tokens')
        .select('id, name, symbol, logo_emoji, price_per_token, total_volume, market_cap, status')
        .neq('status', 'suspended');

      if (tokensError || !tokensData) {
        console.error('Error fetching tokens:', tokensError);
        setLoading(false);
        return;
      }

      // Get transactions from last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: txData } = await supabase
        .from('token_transactions')
        .select('token_id, transaction_type, total_credits')
        .gte('created_at', yesterday.toISOString())
        .in('transaction_type', ['buy', 'sell']);

      // Calculate daily volumes per token
      const volumeMap = new Map<string, { buy: number; sell: number }>();
      txData?.forEach((tx) => {
        const current = volumeMap.get(tx.token_id) || { buy: 0, sell: 0 };
        if (tx.transaction_type === 'buy') {
          current.buy += tx.total_credits;
        } else {
          current.sell += tx.total_credits;
        }
        volumeMap.set(tx.token_id, current);
      });

      // Merge token data with daily volumes
      const enrichedTokens: TokenStats[] = tokensData.map((token) => {
        const volumes = volumeMap.get(token.id) || { buy: 0, sell: 0 };
        return {
          ...token,
          daily_volume: volumes.buy + volumes.sell,
          daily_buy_volume: volumes.buy,
          daily_sell_volume: volumes.sell,
        };
      });

      setTokens(enrichedTokens);
      setLoading(false);
    };

    fetchLeaderboard();

    // Refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const topGainers = [...tokens]
    .filter((t) => t.daily_buy_volume > 0)
    .sort((a, b) => b.daily_buy_volume - a.daily_buy_volume)
    .slice(0, 5);

  const topLosers = [...tokens]
    .filter((t) => t.daily_sell_volume > 0)
    .sort((a, b) => b.daily_sell_volume - a.daily_sell_volume)
    .slice(0, 5);

  const topVolume = [...tokens]
    .filter((t) => t.daily_volume > 0)
    .sort((a, b) => b.daily_volume - a.daily_volume)
    .slice(0, 5);

  const renderTokenRow = (token: TokenStats, index: number, type: 'gainer' | 'loser' | 'volume') => {
    const volume = type === 'gainer' 
      ? token.daily_buy_volume 
      : type === 'loser' 
        ? token.daily_sell_volume 
        : token.daily_volume;

    return (
      <div
        key={token.id}
        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onTokenSelect?.(token.id)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-muted-foreground w-6">
            {index + 1}
          </span>
          <span className="text-2xl">{token.logo_emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{token.symbol}</span>
              {token.status === 'verified' && (
                <Badge variant="secondary" className="text-[10px] px-1">✓</Badge>
              )}
              {token.status === 'graduated' && (
                <Badge className="text-[10px] px-1 bg-gradient-to-r from-amber-500 to-purple-500">🎓</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{token.name}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-bold ${
            type === 'gainer' ? 'text-primary' : 
            type === 'loser' ? 'text-destructive' : 
            'text-foreground'
          }`}>
            {volume.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">credits</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            24h Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          24h Leaderboard
          <Badge variant="outline" className="ml-auto text-xs">
            <Flame className="h-3 w-3 mr-1 text-orange-500" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="gainers" className="w-full">
          <TabsList className="w-full grid grid-cols-3 rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger 
              value="gainers" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2"
            >
              <TrendingUp className="h-4 w-4 mr-1 text-primary" />
              Gainers
            </TabsTrigger>
            <TabsTrigger 
              value="losers"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent py-2"
            >
              <TrendingDown className="h-4 w-4 mr-1 text-destructive" />
              Sellers
            </TabsTrigger>
            <TabsTrigger 
              value="volume"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent py-2"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Volume
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gainers" className="mt-0 p-2">
            {topGainers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No buy activity today</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topGainers.map((token, i) => renderTokenRow(token, i, 'gainer'))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="losers" className="mt-0 p-2">
            {topLosers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sell activity today</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topLosers.map((token, i) => renderTokenRow(token, i, 'loser'))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="volume" className="mt-0 p-2">
            {topVolume.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No trading activity today</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topVolume.map((token, i) => renderTokenRow(token, i, 'volume'))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
