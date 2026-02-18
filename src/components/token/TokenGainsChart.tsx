import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';

const SOL_TARGETS = [
  { label: 'Current', price: 0 },
  { label: '$100', price: 100 },
  { label: '$150', price: 150 },
  { label: '$200', price: 200 },
  { label: '$260 ATH', price: 260 },
  { label: '$350', price: 350 },
  { label: '$500', price: 500 },
];

const COLORS = ['hsl(215,20%,55%)', 'hsl(187,80%,45%)', 'hsl(187,90%,50%)', 'hsl(142,76%,46%)', 'hsl(142,76%,56%)', 'hsl(38,92%,50%)', 'hsl(38,92%,60%)'];

export default function TokenGainsChart() {
  const [investUsd, setInvestUsd] = useState('100');
  const [tokenPriceUsd, setTokenPriceUsd] = useState(0);
  const [currentSolPrice, setCurrentSolPrice] = useState(0);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [dexRes, solRes] = await Promise.all([
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`),
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'),
        ]);
        const dexJson = await dexRes.json();
        const solJson = await solRes.json();
        const pair = dexJson.pairs?.[0];
        if (pair) setTokenPriceUsd(parseFloat(pair.priceUsd || '0'));
        if (solJson.solana?.usd) setCurrentSolPrice(solJson.solana.usd);
      } catch (e) {
        console.error('Price fetch error', e);
      }
    };
    fetchPrices();
  }, []);

  const investment = parseFloat(investUsd) || 0;

  const chartData = useMemo(() => {
    if (!tokenPriceUsd || !currentSolPrice || !investment) return [];

    const tokensBought = investment / tokenPriceUsd;
    // Simplified model: token price scales proportionally with SOL price
    const ratio = tokenPriceUsd / currentSolPrice;

    return SOL_TARGETS.map((t) => {
      const solP = t.price || currentSolPrice;
      const futureTokenPrice = ratio * solP;
      const futureValue = tokensBought * futureTokenPrice;
      const gain = futureValue - investment;
      return {
        name: t.price === 0 ? `$${Math.round(currentSolPrice)}` : t.label,
        value: Math.round(futureValue),
        gain: Math.round(gain),
        multiplier: futureValue / investment,
      };
    });
  }, [tokenPriceUsd, currentSolPrice, investment]);

  return (
    <Card className="bg-secondary/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" /> Potential Gains When SOL Rises
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Your investment (USD)</label>
          <Input
            type="number"
            value={investUsd}
            onChange={(e) => setInvestUsd(e.target.value)}
            className="font-mono max-w-xs"
            placeholder="100"
          />
        </div>

        {chartData.length > 0 ? (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(222,47%,10%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'hsl(210,40%,98%)' }}
                    formatter={(value: number, _: string, entry: any) => [
                      `$${value.toLocaleString()} (${entry.payload.multiplier.toFixed(1)}x)`,
                      'Portfolio Value',
                    ]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {chartData.slice(1).map((d) => (
                <div key={d.name} className="glass-card p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">SOL @ {d.name}</p>
                  <p className="text-sm font-bold text-foreground">${d.value.toLocaleString()}</p>
                  <p className={`text-xs font-semibold ${d.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.gain >= 0 ? '+' : ''}{d.gain.toLocaleString()} ({d.multiplier.toFixed(1)}x)
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading price data...</div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Projection assumes $CFB token price scales proportionally with SOL. Past performance ≠ future results.
        </p>
      </CardContent>
    </Card>
  );
}
