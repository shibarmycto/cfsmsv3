import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Clock, User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  price_per_token: number;
  total_credits: number;
  created_at: string;
  buyer_id: string | null;
  seller_id: string | null;
  buyer_username?: string;
  seller_username?: string;
}

interface TradeHistoryPanelProps {
  tokenId: string;
  tokenSymbol: string;
}

export const TradeHistoryPanel = ({ tokenId, tokenSymbol }: TradeHistoryPanelProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      
      // Fetch recent transactions for this token
      const { data: txData, error } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('token_id', tokenId)
        .in('transaction_type', ['buy', 'sell'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching transactions:', error);
        setLoading(false);
        return;
      }

      if (!txData || txData.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = new Set<string>();
      txData.forEach(tx => {
        if (tx.buyer_id) userIds.add(tx.buyer_id);
        if (tx.seller_id) userIds.add(tx.seller_id);
      });

      // Fetch usernames from wallets table
      const { data: wallets } = await supabase
        .from('wallets')
        .select('user_id, username')
        .in('user_id', Array.from(userIds));

      const usernameMap = new Map<string, string>();
      wallets?.forEach(w => usernameMap.set(w.user_id, w.username));

      // Map transactions with usernames
      const enrichedTransactions = txData.map(tx => ({
        ...tx,
        buyer_username: tx.buyer_id ? usernameMap.get(tx.buyer_id) || 'Anonymous' : undefined,
        seller_username: tx.seller_id ? usernameMap.get(tx.seller_id) || 'Market' : undefined,
      }));

      setTransactions(enrichedTransactions);
      setLoading(false);
    };

    fetchTransactions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`trade-history-${tokenId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_transactions',
          filter: `token_id=eq.${tokenId}`,
        },
        async (payload) => {
          const newTx = payload.new as Transaction;
          if (newTx.transaction_type !== 'buy' && newTx.transaction_type !== 'sell') return;

          // Fetch username for the new transaction
          const userIds = [newTx.buyer_id, newTx.seller_id].filter(Boolean) as string[];
          const { data: wallets } = await supabase
            .from('wallets')
            .select('user_id, username')
            .in('user_id', userIds);

          const usernameMap = new Map<string, string>();
          wallets?.forEach(w => usernameMap.set(w.user_id, w.username));

          const enrichedTx = {
            ...newTx,
            buyer_username: newTx.buyer_id ? usernameMap.get(newTx.buyer_id) || 'Anonymous' : undefined,
            seller_username: newTx.seller_id ? usernameMap.get(newTx.seller_id) || 'Market' : undefined,
          };

          setTransactions(prev => [enrichedTx, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tokenId]);

  const formatUsername = (username?: string) => {
    if (!username) return '---';
    if (username.length > 10) return username.slice(0, 8) + '...';
    return username;
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trade History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Trade History
          <Badge variant="secondary" className="ml-auto text-xs">
            {transactions.length} trades
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No trades yet</p>
              <p className="text-xs">Be the first to trade {tokenSymbol}!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {tx.transaction_type === 'buy' ? (
                        <div className="flex items-center gap-1 text-primary">
                          <ArrowUpRight className="h-4 w-4" />
                          <span className="font-medium text-sm">BUY</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <ArrowDownRight className="h-4 w-4" />
                          <span className="font-medium text-sm">SELL</span>
                        </div>
                      )}
                      <span className="text-sm font-mono">
                        {tx.amount.toLocaleString()} {tokenSymbol}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          {tx.transaction_type === 'buy' 
                            ? formatUsername(tx.buyer_username)
                            : formatUsername(tx.seller_username)
                          }
                        </span>
                      </div>
                      <span>@{tx.price_per_token.toFixed(4)} credits</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {tx.total_credits.toLocaleString()} credits
                    </span>
                  </div>
                  
                  <div className="text-[10px] text-muted-foreground/70 mt-1">
                    {format(new Date(tx.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
