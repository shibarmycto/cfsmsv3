import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ComposedChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Activity, BarChart3 } from 'lucide-react';

interface TokenPriceChartProps {
  tokenId: string;
  tokenSymbol: string;
  currentPrice: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  price: number;
  volume: number;
  high: number;
  low: number;
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

export default function TokenPriceChart({ tokenId, tokenSymbol, currentPrice }: TokenPriceChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [priceChange, setPriceChange] = useState<number>(0);
  const [chartType, setChartType] = useState<'area' | 'composed'>('area');

  useEffect(() => {
    fetchChartData();
  }, [tokenId, timeRange]);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      // Fetch transactions for the token
      const { data: transactions } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('token_id', tokenId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) {
        // Generate placeholder data when no transactions exist
        const placeholderData = generatePlaceholderData(timeRange, currentPrice);
        setChartData(placeholderData);
        setPriceChange(0);
        setIsLoading(false);
        return;
      }

      // Aggregate transactions by time period
      const aggregatedData = aggregateTransactions(transactions, timeRange);
      setChartData(aggregatedData);

      // Calculate price change
      if (aggregatedData.length >= 2) {
        const firstPrice = aggregatedData[0].price;
        const lastPrice = aggregatedData[aggregatedData.length - 1].price;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;
        setPriceChange(change);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePlaceholderData = (range: TimeRange, basePrice: number): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];
    const periods = range === '24h' ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    
    for (let i = 0; i < periods; i++) {
      const date = new Date();
      if (range === '24h') {
        date.setHours(date.getHours() - (periods - i));
      } else {
        date.setDate(date.getDate() - (periods - i));
      }
      
      // Small random variation around base price
      const variation = (Math.random() - 0.5) * 0.1;
      const price = basePrice * (1 + variation);
      
      data.push({
        date: date.toISOString(),
        displayDate: range === '24h' 
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        price: Math.round(price * 100) / 100,
        volume: 0,
        high: price,
        low: price,
      });
    }
    
    return data;
  };

  const aggregateTransactions = (transactions: any[], range: TimeRange): ChartDataPoint[] => {
    const grouped: Map<string, any[]> = new Map();
    
    transactions.forEach((tx) => {
      const date = new Date(tx.created_at);
      let key: string;
      
      if (range === '24h') {
        key = `${date.toDateString()} ${date.getHours()}:00`;
      } else {
        key = date.toDateString();
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(tx);
    });

    const result: ChartDataPoint[] = [];
    
    grouped.forEach((txs, key) => {
      const prices = txs.map((t) => t.price_per_token);
      const volume = txs.reduce((sum, t) => sum + t.total_credits, 0);
      
      const date = new Date(key);
      
      result.push({
        date: key,
        displayDate: range === '24h'
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        price: txs[txs.length - 1].price_per_token, // Last price in period
        volume,
        high: Math.max(...prices),
        low: Math.min(...prices),
      });
    });

    // Add current price as last point
    const now = new Date();
    const lastKey = range === '24h' 
      ? `${now.toDateString()} ${now.getHours()}:00`
      : now.toDateString();
    
    if (result.length === 0 || result[result.length - 1].date !== lastKey) {
      result.push({
        date: lastKey,
        displayDate: range === '24h'
          ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : now.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        price: currentPrice,
        volume: 0,
        high: currentPrice,
        low: currentPrice,
      });
    }

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="font-bold text-primary">
            {payload[0]?.value?.toLocaleString()} Credits
          </p>
          {payload[1] && (
            <p className="text-xs text-muted-foreground">
              Volume: {payload[1]?.value?.toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {tokenSymbol} Price Chart
            </CardTitle>
            <Badge 
              variant={priceChange >= 0 ? 'default' : 'destructive'}
              className={priceChange >= 0 ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
            >
              {priceChange >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border">
              {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${
                    timeRange === range 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setChartType(chartType === 'area' ? 'composed' : 'area')}
            >
              <BarChart3 className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={fetchChartData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No trading data available
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fill="url(#priceGradient)" 
                  />
                </AreaChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    yAxisId="right" 
                    dataKey="volume" 
                    fill="hsl(var(--muted))" 
                    opacity={0.5}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="price" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Current</p>
            <p className="text-xs font-bold">{currentPrice}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">High</p>
            <p className="text-xs font-bold text-green-400">
              {chartData.length > 0 ? Math.max(...chartData.map(d => d.high)).toFixed(2) : '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Low</p>
            <p className="text-xs font-bold text-red-400">
              {chartData.length > 0 ? Math.min(...chartData.map(d => d.low)).toFixed(2) : '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Volume</p>
            <p className="text-xs font-bold">
              {chartData.reduce((sum, d) => sum + d.volume, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}