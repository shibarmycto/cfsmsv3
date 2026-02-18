import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';

interface TokenData {
  priceUsd: number;
  priceNative: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  txns24h: { buys: number; sells: number };
  holders: number;
  priceChange24h: number;
}

export default function TokenLiveStats() {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
      const json = await res.json();
      const pair = json.pairs?.[0];
      if (pair) {
        setData({
          priceUsd: parseFloat(pair.priceUsd || '0'),
          priceNative: parseFloat(pair.priceNative || '0'),
          marketCap: pair.marketCap || pair.fdv || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          txns24h: { buys: pair.txns?.h24?.buys || 0, sells: pair.txns?.h24?.sells || 0 },
          holders: pair.holders || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
        });
      }
    } catch (e) {
      console.error('Failed to fetch token data', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = data ? [
    { label: 'Price (USD)', value: `$${data.priceUsd < 0.0001 ? data.priceUsd.toExponential(2) : data.priceUsd.toFixed(6)}`, icon: DollarSign, change: data.priceChange24h },
    { label: 'Market Cap', value: `$${(data.marketCap).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp },
    { label: '24h Volume', value: `$${(data.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: BarChart3 },
    { label: '24h Txns', value: `${data.txns24h.buys + data.txns24h.sells}`, icon: Users, sub: `${data.txns24h.buys} buys / ${data.txns24h.sells} sells` },
    { label: 'Liquidity', value: `$${(data.liquidity).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
    { label: 'Price (SOL)', value: `${data.priceNative < 0.0001 ? data.priceNative.toExponential(2) : data.priceNative.toFixed(8)}`, icon: TrendingUp },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Live Token Stats</h3>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 text-muted-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-secondary/30 border-border/50 animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="bg-secondary/30 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <s.icon className="w-3.5 h-3.5" /> {s.label}
                </div>
                <p className="text-lg font-bold text-foreground truncate">{s.value}</p>
                {s.change !== undefined && (
                  <span className={`text-xs font-semibold ${s.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}% 24h
                  </span>
                )}
                {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
