import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Check, Wallet, Copy } from 'lucide-react';
import CountrySelector from '@/components/CountrySelector';
import { COUNTRIES, SMS_PACKAGES, formatPrice, getConvertedPrice, type Country } from '@/lib/countries';
import type { User } from '@supabase/supabase-js';

interface BuyCreditsTabProps {
  user: User | null;
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

interface SelectedPackage {
  credits: number;
  basePrice: number;
  popular?: boolean;
}

const USDT_WALLET = 'TPY9rNr3Eb1PV86e3dkkFGgRQTH4oQYmJq';

const BuyCreditsTab = forwardRef<HTMLDivElement, BuyCreditsTabProps>(({ user, toast }, ref) => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<SelectedPackage | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestPurchase = async () => {
    if (!selectedPackage || !user) return;
    const convertedPrice = getConvertedPrice(selectedPackage.basePrice, selectedCountry);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('purchase_requests').insert({
        user_id: user.id,
        package_name: `${selectedPackage.credits.toLocaleString()} Credits`,
        credits_amount: selectedPackage.credits,
        price: convertedPrice,
        currency: selectedCountry.currency,
        destination: selectedCountry.code.toLowerCase(),
      });
      if (error) throw error;
      toast({ title: 'Purchase Request Submitted', description: 'An admin will review your request and provide payment instructions.' });
      setSelectedPackage(null);
    } catch (err: any) {
      toast({ title: 'Request Failed', description: err.message || 'Could not submit request.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(USDT_WALLET);
    toast({ title: 'Copied!', description: 'USDT wallet address copied.' });
  };

  return (
    <div ref={ref} className="glass-card p-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">Buy Credits</h2>
      <p className="text-muted-foreground mb-2">$1 = 1 Credit — Select a package below</p>
      
      {/* USDT Recommended */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-green-400 mb-2">⭐ Pay with USDT (TRC-20) for lowest fees</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-secondary/50 rounded px-2 py-1 flex-1 truncate font-mono">{USDT_WALLET}</code>
          <Button variant="outline" size="sm" onClick={copyWallet}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Country Selector */}
      <div className="mb-6">
        <CountrySelector selectedCountry={selectedCountry} onSelect={setSelectedCountry} />
      </div>

      {/* Packages Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {SMS_PACKAGES.map((pkg) => {
          const isSelected = selectedPackage?.credits === pkg.credits;
          return (
            <button
              key={pkg.credits}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 bg-secondary/30'
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">Popular</span>
              )}
              <p className="font-bold text-lg">{pkg.credits.toLocaleString()} Credits</p>
              <p className="text-2xl font-bold text-primary mt-2">{formatPrice(pkg.basePrice, selectedCountry)}</p>
              <p className="text-sm text-muted-foreground">${pkg.basePrice} USD</p>
              {isSelected && <Check className="absolute top-4 right-4 w-5 h-5 text-primary" />}
            </button>
          );
        })}
      </div>

      {/* Selected Package Summary */}
      {selectedPackage && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package</span>
              <span className="font-medium">{selectedPackage.credits.toLocaleString()} Credits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country</span>
              <span className="font-medium">{selectedCountry.flag} {selectedCountry.name}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary/20">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary text-lg">{formatPrice(selectedPackage.basePrice, selectedCountry)}</span>
            </div>
          </div>
        </div>
      )}

      <Button variant="hero" size="lg" className="w-full" onClick={handleRequestPurchase} disabled={!selectedPackage || isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Request Purchase'}
        <ShoppingCart className="w-5 h-5" />
      </Button>

      {/* Crypto Payment Option */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or pay instantly with</span>
          </div>
        </div>
        <Button variant="outline" size="lg" className="w-full mt-4" onClick={() => navigate('/buy-crypto')}>
          <Wallet className="w-5 h-5 mr-2" />
          Pay with Cryptocurrency
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          USDT (TRC-20) • SOL • ETH • BTC — Automatic verification & instant credits
        </p>
      </div>
    </div>
  );
});

BuyCreditsTab.displayName = 'BuyCreditsTab';
export default BuyCreditsTab;
