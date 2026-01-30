import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Coins, DollarSign, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

interface CFCreditsExchangeProps {
  characterId: string;
  userId: string;
  currentCash: number;
  cfCredits: number;
  onClose: () => void;
  onExchange: (cashGained: number, creditsSpent: number) => void;
}

// Exchange rate: 10 CF Credits = $100 in-game cash (1 credit = $10)
const EXCHANGE_RATE = 10;

const PACKAGES = [
  { credits: 1, cash: 10, label: 'Starter' },
  { credits: 5, cash: 50, label: 'Basic' },
  { credits: 10, cash: 100, label: 'Standard' },
  { credits: 25, cash: 250, label: 'Premium' },
  { credits: 50, cash: 500, label: 'VIP' },
  { credits: 100, cash: 1000, label: 'Whale' },
];

export default function CFCreditsExchange({
  characterId,
  userId,
  currentCash,
  cfCredits,
  onClose,
  onExchange
}: CFCreditsExchangeProps) {
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const handleExchange = async () => {
    if (!selectedPackage) {
      toast.error('Select a package first!');
      return;
    }

    if (cfCredits < selectedPackage.credits) {
      toast.error('Not enough CF Credits!');
      return;
    }

    setLoading(true);

    try {
      // Call edge function to process the exchange
      const { data, error } = await supabase.functions.invoke('game-credits-exchange', {
        body: {
          user_id: userId,
          character_id: characterId,
          credits_spent: selectedPackage.credits,
          cash_to_add: selectedPackage.cash
        }
      });

      if (error) throw error;

      toast.success(`Exchanged ${selectedPackage.credits} CF Credits for $${selectedPackage.cash} in-game cash!`);
      onExchange(selectedPackage.cash, selectedPackage.credits);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Exchange failed');
    } finally {
      setLoading(false);
    }
  };

  const customCredits = parseInt(customAmount) || 0;
  const customCash = customCredits * EXCHANGE_RATE;
  const canAffordCustom = customCredits > 0 && cfCredits >= customCredits;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-yellow-950/30 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-yellow-500/20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border border-yellow-500/30 flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">CF Credits Exchange</h2>
              <p className="text-xs text-gray-500">Convert credits to in-game cash</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Balance display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400 text-sm">CF Credits</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{cfCredits}</div>
          </div>
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-gray-400 text-sm">In-Game Cash</span>
            </div>
            <div className="text-2xl font-bold text-green-400">${currentCash.toLocaleString()}</div>
          </div>
        </div>

        {/* Exchange rate info */}
        <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-white/5 flex items-center justify-center gap-3">
          <div className="text-yellow-400 font-bold">1 CF Credit</div>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <div className="text-green-400 font-bold">${EXCHANGE_RATE} In-Game</div>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PACKAGES.map(pkg => {
            const canAfford = cfCredits >= pkg.credits;
            const isSelected = selectedPackage?.credits === pkg.credits;
            
            return (
              <button
                key={pkg.credits}
                onClick={() => canAfford && setSelectedPackage(pkg)}
                disabled={!canAfford}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/20'
                    : canAfford
                    ? 'bg-gray-800/50 border-white/10 hover:border-yellow-500/50'
                    : 'bg-gray-800/20 border-white/5 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">{pkg.label}</div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold">{pkg.credits}</span>
                  <ArrowRight className="w-3 h-3 text-gray-500" />
                  <span className="text-green-400 font-bold">${pkg.cash}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mb-6">
          <label className="text-gray-400 text-sm mb-2 block">Custom Amount</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="Enter credits..."
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-white/10 focus:border-yellow-500/50 outline-none"
              />
              {customCredits > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">
                  = ${customCash}
                </div>
              )}
            </div>
            {customCredits > 0 && (
              <button
                onClick={() => canAffordCustom && setSelectedPackage({ credits: customCredits, cash: customCash, label: 'Custom' })}
                disabled={!canAffordCustom}
                className={`px-4 rounded-lg transition-all ${
                  canAffordCustom
                    ? 'bg-yellow-600 text-white hover:bg-yellow-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Select
              </button>
            )}
          </div>
        </div>

        {/* Selected package summary */}
        {selectedPackage && (
          <div className="mb-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-400 text-sm">You will exchange:</div>
                <div className="text-xl font-bold text-white">
                  <span className="text-yellow-400">{selectedPackage.credits} CF Credits</span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="text-green-400">${selectedPackage.cash} Cash</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="mb-6 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-orange-400 text-xs">
            This exchange is final and cannot be reversed. CF Credits will be deducted from your account.
          </p>
        </div>

        {/* Exchange button */}
        <button
          onClick={handleExchange}
          disabled={!selectedPackage || loading}
          className={`w-full py-4 rounded-xl font-bold transition-all ${
            selectedPackage && !loading
              ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-500 hover:to-orange-500 shadow-lg shadow-yellow-500/30'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? 'Processing...' : selectedPackage ? `Exchange ${selectedPackage.credits} Credits` : 'Select a Package'}
        </button>
      </div>
    </div>
  );
}
