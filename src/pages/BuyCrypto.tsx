import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  ArrowLeft,
  Clock,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
} from 'lucide-react';

const WALLET_ADDRESSES = {
  solana: {
    address: 'TXFm5oQQ4Qp51tMkPgdqSESYdQaN6hqQkpoZidWMdSy',
    name: 'Solana (SOL)',
    icon: '◎',
    color: 'bg-gradient-to-r from-purple-500 to-green-400',
  },
  ethereum: {
    address: '0x125FeD6C4A538aaD4108cE5D598628DC42635Fe9',
    name: 'Ethereum (ETH)',
    icon: 'Ξ',
    color: 'bg-gradient-to-r from-blue-500 to-purple-500',
  },
  bitcoin: {
    address: 'bc1p3red8wgfa9k2qyhxxj9vpnehvy29ld63lg5t6kfvrcy6lz7l9mhspyjk3k',
    name: 'Bitcoin (BTC)',
    icon: '₿',
    color: 'bg-gradient-to-r from-orange-500 to-yellow-500',
  },
};

// Approximate crypto prices in USD (would need real API for production)
const CRYPTO_PRICES = {
  solana: 180,
  ethereum: 3500,
  bitcoin: 95000,
};

type CryptoType = 'solana' | 'ethereum' | 'bitcoin';

interface Order {
  id: string;
  credits_amount: number;
  price_usd: number;
  crypto_type: CryptoType;
  expected_amount: number;
  status: string;
  expires_at: string;
  tx_hash: string | null;
}

export default function BuyCrypto() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [credits, setCredits] = useState(1000);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Price calculation: $0.15 per SMS credit
  const priceUsd = credits * 0.15;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Timer countdown
  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const expiresAt = new Date(order.expires_at).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setOrder({ ...order, status: 'expired' });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  // Auto-check payment every 30 seconds
  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const checkPayment = async () => {
      setIsChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke('check-crypto-payment', {
          body: { orderId: order.id },
        });

        if (error) throw error;

        if (data.status === 'paid') {
          setOrder({ ...order, status: 'paid', tx_hash: data.txHash });
          toast({
            title: '🎉 Payment Confirmed!',
            description: `${order.credits_amount} credits have been added to your account.`,
          });
        } else if (data.status === 'expired') {
          setOrder({ ...order, status: 'expired' });
        }
      } catch (err) {
        console.error('Payment check error:', err);
      } finally {
        setIsChecking(false);
      }
    };

    // Check immediately, then every 30 seconds
    checkPayment();
    const interval = setInterval(checkPayment, 30000);

    return () => clearInterval(interval);
  }, [order?.id, order?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateOrder = async () => {
    if (!selectedCrypto || !user) return;

    setIsCreating(true);
    try {
      const cryptoPrice = CRYPTO_PRICES[selectedCrypto];
      const expectedAmount = priceUsd / cryptoPrice;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const { data, error } = await supabase
        .from('crypto_orders')
        .insert({
          user_id: user.id,
          credits_amount: credits,
          price_usd: priceUsd,
          crypto_type: selectedCrypto,
          wallet_address: WALLET_ADDRESSES[selectedCrypto].address,
          expected_amount: expectedAmount,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setOrder(data as Order);
      setStep('payment');
      setTimeLeft(3600);
    } catch (err: any) {
      toast({
        title: 'Order Failed',
        description: err.message || 'Could not create order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Wallet address copied to clipboard.',
    });
  };

  const getCryptoAmount = () => {
    if (!selectedCrypto) return '0';
    return (priceUsd / CRYPTO_PRICES[selectedCrypto]).toFixed(6);
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="animate-pulse-glow w-16 h-16 rounded-2xl bg-primary/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold">Buy Credits with Crypto</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-2xl">
        {step === 'select' && (
          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-2xl font-bold mb-2">Purchase SMS Credits</h2>
            <p className="text-muted-foreground mb-8">Pay with cryptocurrency - instant delivery</p>

            {/* Credits Input */}
            <div className="space-y-4 mb-8">
              <Label htmlFor="credits">Number of Credits (up to 20,000)</Label>
              <Input
                id="credits"
                type="number"
                min={100}
                max={20000}
                step={100}
                value={credits}
                onChange={(e) => setCredits(Math.min(20000, Math.max(100, parseInt(e.target.value) || 100)))}
                className="bg-secondary/50 text-2xl font-bold text-center py-6"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Min: 100 credits</span>
                <span>Max: 20,000 credits</span>
              </div>
              
              {/* Quick select buttons */}
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2500, 5000, 10000, 20000].map((amount) => (
                  <Button
                    key={amount}
                    variant={credits === amount ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCredits(amount)}
                  >
                    {amount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Price Display */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Price</span>
                <span className="text-3xl font-bold text-primary">${priceUsd.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Rate: $0.15 per SMS credit
              </p>
            </div>

            {/* Crypto Selection */}
            <div className="space-y-4 mb-8">
              <Label>Select Payment Method</Label>
              <div className="grid gap-4">
                {(Object.keys(WALLET_ADDRESSES) as CryptoType[]).map((crypto) => {
                  const wallet = WALLET_ADDRESSES[crypto];
                  const cryptoAmount = (priceUsd / CRYPTO_PRICES[crypto]).toFixed(6);
                  
                  return (
                    <button
                      key={crypto}
                      onClick={() => setSelectedCrypto(crypto)}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        selectedCrypto === crypto
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 bg-secondary/30'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${wallet.color} flex items-center justify-center text-white text-2xl font-bold`}>
                        {wallet.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{wallet.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ≈ {cryptoAmount} {crypto.toUpperCase()}
                        </p>
                      </div>
                      {selectedCrypto === crypto && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={handleCreateOrder}
              disabled={!selectedCrypto || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'payment' && order && (
          <div className="glass-card p-8 animate-fade-in">
            {order.status === 'pending' && (
              <>
                {/* Timer */}
                <div className={`flex items-center justify-center gap-2 mb-6 p-4 rounded-xl ${
                  timeLeft < 300 ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                }`}>
                  <Clock className="w-5 h-5" />
                  <span className="font-mono text-2xl font-bold">{formatTime(timeLeft)}</span>
                  <span className="text-sm">remaining</span>
                </div>

                <h2 className="text-2xl font-bold mb-2">Send Payment</h2>
                <p className="text-muted-foreground mb-6">
                  Send exactly the amount below to complete your purchase
                </p>

                {/* Amount to Send */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Send exactly:</p>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-primary">
                      {order.expected_amount.toFixed(6)} {order.crypto_type.toUpperCase()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(order.expected_amount.toFixed(6))}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">≈ ${order.price_usd.toFixed(2)} USD</p>
                </div>

                {/* Wallet Address */}
                <div className="space-y-2 mb-6">
                  <Label>To Wallet Address:</Label>
                  <div className="bg-secondary/50 rounded-xl p-4 break-all font-mono text-sm">
                    {WALLET_ADDRESSES[order.crypto_type as CryptoType].address}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyToClipboard(WALLET_ADDRESSES[order.crypto_type as CryptoType].address)}
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copy Address
                  </Button>
                </div>

                {/* Order Details */}
                <div className="bg-secondary/30 rounded-xl p-4 mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits to receive:</span>
                    <span className="font-semibold">{order.credits_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono text-xs">{order.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 p-4 bg-secondary/20 rounded-xl">
                  {isChecking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>Checking blockchain for payment...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Waiting for payment...</span>
                    </>
                  )}
                </div>
              </>
            )}

            {order.status === 'paid' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Payment Confirmed!</h2>
                <p className="text-muted-foreground mb-6">
                  {order.credits_amount.toLocaleString()} credits have been added to your account.
                </p>
                {order.tx_hash && (
                  <p className="text-xs text-muted-foreground font-mono mb-6">
                    TX: {order.tx_hash.slice(0, 20)}...
                  </p>
                )}
                <Button variant="hero" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            )}

            {order.status === 'expired' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Order Expired</h2>
                <p className="text-muted-foreground mb-6">
                  This order has expired. Please create a new order to purchase credits.
                </p>
                <Button variant="hero" onClick={() => {
                  setStep('select');
                  setOrder(null);
                  setSelectedCrypto(null);
                }}>
                  Create New Order
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}