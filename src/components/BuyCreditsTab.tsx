import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Check } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface PricingPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  destination: 'uk' | 'usa';
  popular?: boolean;
}

const UK_PACKAGES: PricingPackage[] = [
  { id: 'uk-100', name: '100 SMS', credits: 100, price: 15, currency: 'GBP', destination: 'uk' },
  { id: 'uk-500', name: '500 SMS', credits: 500, price: 75, currency: 'GBP', destination: 'uk' },
  { id: 'uk-1000', name: '1,000 SMS', credits: 1000, price: 150, currency: 'GBP', destination: 'uk' },
  { id: 'uk-5000', name: '5,000 SMS', credits: 5000, price: 750, currency: 'GBP', destination: 'uk', popular: true },
  { id: 'uk-10000', name: '10,000 SMS', credits: 10000, price: 1500, currency: 'GBP', destination: 'uk' },
  { id: 'uk-20000', name: '20,000 SMS', credits: 20000, price: 3000, currency: 'GBP', destination: 'uk' },
];

const USA_PACKAGES: PricingPackage[] = [
  { id: 'usa-100', name: '100 SMS', credits: 100, price: 15, currency: 'USD', destination: 'usa' },
  { id: 'usa-500', name: '500 SMS', credits: 500, price: 75, currency: 'USD', destination: 'usa' },
  { id: 'usa-1000', name: '1,000 SMS', credits: 1000, price: 150, currency: 'USD', destination: 'usa' },
  { id: 'usa-5000', name: '5,000 SMS', credits: 5000, price: 750, currency: 'USD', destination: 'usa', popular: true },
  { id: 'usa-10000', name: '10,000 SMS', credits: 10000, price: 1500, currency: 'USD', destination: 'usa' },
  { id: 'usa-20000', name: '20,000 SMS', credits: 20000, price: 3000, currency: 'USD', destination: 'usa' },
];

interface BuyCreditsTabProps {
  user: User | null;
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

export default function BuyCreditsTab({ user, toast }: BuyCreditsTabProps) {
  const [selectedPackage, setSelectedPackage] = useState<PricingPackage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRegion, setActiveRegion] = useState<'uk' | 'usa'>('uk');

  const packages = activeRegion === 'uk' ? UK_PACKAGES : USA_PACKAGES;
  const currencySymbol = activeRegion === 'uk' ? '£' : '$';

  const handleRequestPurchase = async () => {
    if (!selectedPackage || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('purchase_requests').insert({
        user_id: user.id,
        package_name: selectedPackage.name,
        credits_amount: selectedPackage.credits,
        price: selectedPackage.price,
        currency: selectedPackage.currency,
        destination: selectedPackage.destination,
      });

      if (error) throw error;

      toast({
        title: 'Purchase Request Submitted',
        description: 'An admin will review your request and provide payment instructions.',
      });
      setSelectedPackage(null);
    } catch (err: any) {
      toast({
        title: 'Request Failed',
        description: err.message || 'Could not submit request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">Buy Credits</h2>
      <p className="text-muted-foreground mb-6">Select a package and submit a purchase request</p>

      {/* Region Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeRegion === 'uk' ? 'default' : 'outline'}
          onClick={() => setActiveRegion('uk')}
          className="flex-1"
        >
          🇬🇧 UK SMS
        </Button>
        <Button
          variant={activeRegion === 'usa' ? 'default' : 'outline'}
          onClick={() => setActiveRegion('usa')}
          className="flex-1"
        >
          🇺🇸 USA SMS
        </Button>
      </div>

      {/* Packages Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg)}
            className={`relative text-left p-4 rounded-xl border-2 transition-all ${
              selectedPackage?.id === pkg.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-secondary/30'
            }`}
          >
            {pkg.popular && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                Popular
              </span>
            )}
            <p className="font-bold text-lg">{pkg.name}</p>
            <p className="text-2xl font-bold text-primary mt-2">
              {currencySymbol}{pkg.price}
            </p>
            <p className="text-sm text-muted-foreground">
              {currencySymbol}{(pkg.price / pkg.credits * 100).toFixed(0)}p per SMS
            </p>
            {selectedPackage?.id === pkg.id && (
              <Check className="absolute top-4 right-4 w-5 h-5 text-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Selected Package Summary */}
      {selectedPackage && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package</span>
              <span className="font-medium">{selectedPackage.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credits</span>
              <span className="font-medium">{selectedPackage.credits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Region</span>
              <span className="font-medium">{selectedPackage.destination.toUpperCase()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary/20">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary text-lg">
                {currencySymbol}{selectedPackage.price}
              </span>
            </div>
          </div>
        </div>
      )}

      <Button
        variant="hero"
        size="lg"
        className="w-full"
        onClick={handleRequestPurchase}
        disabled={!selectedPackage || isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Request Purchase'}
        <ShoppingCart className="w-5 h-5" />
      </Button>

      {/* Payment Methods Info */}
      <div className="mt-8 bg-secondary/20 rounded-xl p-6 border border-border">
        <h3 className="font-bold mb-4">Payment Methods</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Bitcoin', 'Ethereum', 'USDT', 'PayPal'].map((method) => (
            <div key={method} className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="font-medium text-sm">{method}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          After submitting a request, an admin will review and provide payment details. Credits are added within 24 hours of payment confirmation.
        </p>
      </div>
    </div>
  );
}