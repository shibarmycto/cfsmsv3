import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { 
  Youtube, 
  Check, 
  Clock, 
  Coins, 
  CreditCard,
  Wallet,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Eye,
  Calendar
} from 'lucide-react';

interface PromoPackage {
  id: string;
  name: string;
  days: number;
  price: number;
  features: string[];
  popular?: boolean;
}

interface PromoOrder {
  id: string;
  youtube_url: string;
  video_title: string | null;
  package_type: string;
  price_gbp: number;
  payment_method: string;
  status: string;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  view_count: number;
}

const PROMO_PACKAGES: PromoPackage[] = [
  {
    id: '7_days',
    name: '7-Day Promo',
    days: 7,
    price: 20,
    features: [
      'Added to Watch-to-Earn playlist',
      'Exposure to active miners',
      'Daily views from real users',
      '7 days of promotion',
    ],
  },
  {
    id: '30_days',
    name: '30-Day Promo',
    days: 30,
    price: 50,
    features: [
      'Added to Watch-to-Earn playlist',
      'Exposure to active miners',
      'Daily views from real users',
      '30 days of promotion',
      'Priority placement',
      'Best value!',
    ],
    popular: true,
  },
];

const WALLET_ADDRESSES = {
  SOL: { address: 'TXFm5oQQ4Qp51tMkPgdqSESYdQaN6hqQkpoZidWMdSy', name: 'Solana' },
  ETH: { address: '0x125FeD6C4A538aaD4108cE5D598628DC42635Fe9', name: 'Ethereum' },
  BTC: { address: 'bc1p3red8wgfa9k2qyhxxj9vpnehvy29ld63lg5t6kfvrcy6lz7l9mhspyjk3k', name: 'Bitcoin' },
};

export default function Promo() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'packages' | 'details' | 'payment' | 'orders'>('packages');
  const [selectedPackage, setSelectedPackage] = useState<PromoPackage | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'crypto' | 'tokens'>('manual');
  const [selectedCrypto, setSelectedCrypto] = useState<'SOL' | 'ETH' | 'BTC'>('SOL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState<PromoOrder[]>([]);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchWallet();
    }
  }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('promo_orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data as PromoOrder[]);
  };

  const fetchWallet = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (data) setWallet(data);
  };

  const validateYoutubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleSelectPackage = (pkg: PromoPackage) => {
    setSelectedPackage(pkg);
    setStep('details');
  };

  const handleContinueToPayment = () => {
    if (!validateYoutubeUrl(youtubeUrl)) {
      toast({
        title: 'Invalid YouTube URL',
        description: 'Please enter a valid YouTube video URL.',
        variant: 'destructive',
      });
      return;
    }
    setStep('payment');
  };

  const handleSubmitOrder = async () => {
    if (!selectedPackage || !user) return;

    // Validate token payment
    if (paymentMethod === 'tokens') {
      if (!wallet || wallet.balance < selectedPackage.price) {
        toast({
          title: 'Insufficient Tokens',
          description: `You need ${selectedPackage.price} tokens. Current balance: ${wallet?.balance || 0}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('promo_orders').insert({
        user_id: user.id,
        youtube_url: youtubeUrl.trim(),
        video_title: videoTitle.trim() || null,
        package_type: selectedPackage.id,
        price_gbp: selectedPackage.price,
        payment_method: paymentMethod,
        status: paymentMethod === 'tokens' ? 'paid' : 'pending',
        crypto_type: paymentMethod === 'crypto' ? selectedCrypto : null,
      });
      if (error) throw error;

      // Deduct tokens if paying with tokens
      if (paymentMethod === 'tokens' && wallet) {
        const { error: walletError } = await supabase
          .from('wallets')
          .update({ balance: wallet.balance - selectedPackage.price })
          .eq('user_id', user.id);
        
        if (walletError) throw walletError;

        // Log the transaction
        const { data: walletData } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (walletData) {
          await supabase.from('wallet_transactions').insert({
            from_wallet_id: walletData.id,
            amount: selectedPackage.price,
            transaction_type: 'promo_purchase',
            description: `YouTube Promo: ${selectedPackage.name}`,
            status: 'completed',
          });
        }
      }

      toast({
        title: paymentMethod === 'tokens' ? 'Promo Order Placed!' : 'Order Submitted!',
        description: paymentMethod === 'tokens' 
          ? 'Your video will be added to the playlist shortly.'
          : 'An admin will review and process your order.',
      });

      // Reset form
      setStep('orders');
      setSelectedPackage(null);
      setYoutubeUrl('');
      setVideoTitle('');
      fetchOrders();
      fetchWallet();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Could not submit order.';
      toast({
        title: 'Order Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      active: 'bg-primary/20 text-primary border-primary/30',
      completed: 'bg-muted text-muted-foreground border-muted',
      rejected: 'bg-destructive/20 text-destructive border-destructive/30',
    };
    return styles[status] || styles.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mb-4">
            <Youtube className="w-4 h-4" />
            YouTube Video Promotion
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Promote Your <span className="text-gradient">YouTube Video</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get your video featured in our Watch-to-Earn miner playlist. Real users, real views, real engagement.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          <Button 
            variant={step === 'packages' || step === 'details' || step === 'payment' ? 'default' : 'outline'}
            onClick={() => setStep('packages')}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            New Promo
          </Button>
          <Button 
            variant={step === 'orders' ? 'default' : 'outline'}
            onClick={() => setStep('orders')}
          >
            <Clock className="w-4 h-4 mr-2" />
            My Orders ({orders.length})
          </Button>
        </div>

        {/* Step: Packages */}
        {step === 'packages' && (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PROMO_PACKAGES.map((pkg) => (
              <Card 
                key={pkg.id} 
                className={`glass-card relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer ${
                  pkg.popular ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleSelectPackage(pkg)}
              >
                {pkg.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    {pkg.name}
                  </CardTitle>
                  <CardDescription>
                    {pkg.days} days of promotion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-4">
                    £{pkg.price}
                    <span className="text-sm font-normal text-muted-foreground"> / {pkg.days} days</span>
                  </div>
                  <ul className="space-y-2">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-6" variant={pkg.popular ? 'default' : 'outline'}>
                    Select Package
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step: Video Details */}
        {step === 'details' && selectedPackage && (
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <Button variant="ghost" size="sm" onClick={() => setStep('packages')} className="w-fit mb-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Packages
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                Video Details
              </CardTitle>
              <CardDescription>
                Enter your YouTube video information for the {selectedPackage.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{selectedPackage.name}</span>
                  <span className="text-2xl font-bold">£{selectedPackage.price}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="youtube-url">YouTube Video URL *</Label>
                  <Input
                    id="youtube-url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the full URL of your YouTube video
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-title">Video Title (Optional)</Label>
                  <Input
                    id="video-title"
                    placeholder="My Amazing Video"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleContinueToPayment}
                disabled={!youtubeUrl}
              >
                Continue to Payment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Payment */}
        {step === 'payment' && selectedPackage && (
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <Button variant="ghost" size="sm" onClick={() => setStep('details')} className="w-fit mb-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Details
              </Button>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Choose how you'd like to pay for your promo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Order Summary */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Package</span>
                  <span>{selectedPackage.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Video</span>
                  <span className="truncate max-w-[200px]">{youtubeUrl}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>£{selectedPackage.price}</span>
                </div>
              </div>

              {/* Payment Options */}
              <div className="space-y-3">
                {/* Token Payment */}
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentMethod === 'tokens' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setPaymentMethod('tokens')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Coins className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Pay with CFSMS Tokens</div>
                        <div className="text-sm text-muted-foreground">
                          Balance: {wallet?.balance ?? 0} tokens
                        </div>
                      </div>
                    </div>
                    <Badge variant={wallet && wallet.balance >= selectedPackage.price ? 'default' : 'destructive'}>
                      {selectedPackage.price} tokens
                    </Badge>
                  </div>
                </div>

                {/* Crypto Payment */}
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentMethod === 'crypto' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setPaymentMethod('crypto')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-medium">Pay with Cryptocurrency</div>
                      <div className="text-sm text-muted-foreground">SOL, ETH, or BTC</div>
                    </div>
                  </div>
                </div>

                {/* Crypto Selection */}
                {paymentMethod === 'crypto' && (
                  <div className="ml-4 p-4 rounded-lg bg-muted/50 space-y-3">
                    <Label>Select Cryptocurrency</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['SOL', 'ETH', 'BTC'] as const).map((crypto) => (
                        <Button
                          key={crypto}
                          variant={selectedCrypto === crypto ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCrypto(crypto)}
                        >
                          {crypto}
                        </Button>
                      ))}
                    </div>
                    <div className="p-3 rounded bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Send to:</p>
                      <code className="text-xs break-all">{WALLET_ADDRESSES[selectedCrypto].address}</code>
                    </div>
                  </div>
                )}

                {/* Manual Payment */}
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentMethod === 'manual' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setPaymentMethod('manual')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium">Manual Payment</div>
                      <div className="text-sm text-muted-foreground">Request admin payment instructions</div>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : `Submit Order - £${selectedPackage.price}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Orders */}
        {step === 'orders' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {orders.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <Youtube className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Promo Orders Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get your YouTube video in front of active CF SMS miners!
                  </p>
                  <Button onClick={() => setStep('packages')}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start a Promo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="glass-card">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                          <Youtube className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {order.video_title || order.youtube_url}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.package_type === '7_days' ? '7-Day' : '30-Day'} Promo • £{order.price_gbp}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusBadge(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        {order.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-primary">
                              <Eye className="w-4 h-4" />
                              <span className="font-medium">{order.view_count.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">views</span>
                            </div>
                            {order.ends_at && (
                              <span className="text-xs text-muted-foreground">
                                • Ends {new Date(order.ends_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Benefits Section */}
        {step === 'packages' && (
          <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Real Views</h3>
              <p className="text-sm text-muted-foreground">
                Miners watch your video to earn tokens, giving you genuine engagement.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Boost Visibility</h3>
              <p className="text-sm text-muted-foreground">
                Increased watch time helps your video rank better on YouTube.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Affordable</h3>
              <p className="text-sm text-muted-foreground">
                Pay with crypto, tokens, or manual transfer - flexible options.
              </p>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
