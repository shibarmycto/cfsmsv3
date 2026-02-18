import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calculator, ArrowRight } from 'lucide-react';

const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';

export default function TokenCalculator() {
  const [tokenAmount, setTokenAmount] = useState('1000000');
  const [priceUsd, setPriceUsd] = useState(0);
  const [solPrice, setSolPrice] = useState(0);

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
        if (pair) setPriceUsd(parseFloat(pair.priceUsd || '0'));
        if (solJson.solana?.usd) setSolPrice(solJson.solana.usd);
      } catch (e) {
        console.error('Price fetch error', e);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const amount = parseFloat(tokenAmount) || 0;
  const costUsd = amount * priceUsd;
  const costSol = solPrice > 0 ? costUsd / solPrice : 0;

  return (
    <Card className="bg-secondary/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" /> Token Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">How many $CFB tokens?</label>
          <Input
            type="number"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            className="text-lg font-mono"
            placeholder="1000000"
          />
        </div>

        <div className="flex items-center gap-3 text-muted-foreground">
          <ArrowRight className="w-4 h-4 shrink-0" />
          <span className="text-sm">Current price per token:</span>
          <span className="text-foreground font-semibold">
            ${priceUsd < 0.0001 ? priceUsd.toExponential(2) : priceUsd.toFixed(6)}
          </span>
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Cost in USD</span>
            <span className="font-bold text-foreground">${costUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Cost in SOL</span>
            <span className="font-bold text-foreground">{costSol.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">SOL Price</span>
            <span className="text-foreground">${solPrice.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Prices update every 30s via DexScreener & CoinGecko
        </p>
      </CardContent>
    </Card>
  );
}
