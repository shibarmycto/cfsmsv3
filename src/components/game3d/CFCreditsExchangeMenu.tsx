import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, DollarSign, ArrowRight, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CFCreditsExchangeMenuProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  currentCash: number;
  onCashChange: (cash: number) => void;
}

// Exchange rate: 1 CF Credit = $10 in-game
const CREDIT_TO_CASH_RATE = 10;

export default function CFCreditsExchangeMenu({
  isOpen,
  onClose,
  characterId,
  currentCash,
  onCashChange,
}: CFCreditsExchangeMenuProps) {
  const { user } = useAuth();
  const [cfCredits, setCfCredits] = useState(0);
  const [exchangeAmount, setExchangeAmount] = useState(1);
  const [isExchanging, setIsExchanging] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      fetchCredits();
    }
  }, [user, isOpen]);

  const fetchCredits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setCfCredits(data.sms_credits || 0);
    }
  };

  const handleExchange = async () => {
    if (!user || exchangeAmount < 1 || exchangeAmount > cfCredits) return;

    setIsExchanging(true);
    try {
      const response = await supabase.functions.invoke('game-credits-exchange', {
        body: {
          creditsToExchange: exchangeAmount,
          characterId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { data } = response;
      if (data?.success) {
        setCfCredits(data.remainingCredits);
        onCashChange(data.newCash);
        toast.success(`Exchanged ${exchangeAmount} CF Credits for $${data.gameMoneyAdded.toLocaleString()}!`);
        setExchangeAmount(1);
      }
    } catch (error: any) {
      toast.error(error.message || 'Exchange failed');
    } finally {
      setIsExchanging(false);
    }
  };

  if (!isOpen) return null;

  const gameMoneyToReceive = exchangeAmount * CREDIT_TO_CASH_RATE;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-md w-full border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-cyan-400" />
            CF Credits Exchange
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
            <div className="text-cyan-400 text-xs mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              CF Credits
            </div>
            <div className="text-2xl font-bold text-white">{cfCredits}</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
            <div className="text-green-400 text-xs mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Game Cash
            </div>
            <div className="text-2xl font-bold text-white">${currentCash.toLocaleString()}</div>
          </div>
        </div>

        {/* Exchange Rate Info */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-6 text-center">
          <span className="text-gray-400 text-sm">Exchange Rate: </span>
          <span className="text-cyan-400 font-bold">1 CF Credit = $10 Game Cash</span>
        </div>

        {/* Exchange Amount Selector */}
        <div className="mb-6">
          <label className="text-gray-400 text-sm mb-2 block">Amount to Exchange</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={Math.max(1, cfCredits)}
              value={exchangeAmount}
              onChange={e => setExchangeAmount(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={cfCredits === 0}
            />
            <input
              type="number"
              min={1}
              max={cfCredits}
              value={exchangeAmount}
              onChange={e => setExchangeAmount(Math.min(cfCredits, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20 bg-gray-800 text-white text-center rounded-lg px-3 py-2 border border-white/10"
              disabled={cfCredits === 0}
            />
          </div>
        </div>

        {/* Quick Select Buttons */}
        <div className="flex gap-2 mb-6">
          {[1, 5, 10, 25, 50, 100].map(amount => (
            <button
              key={amount}
              onClick={() => setExchangeAmount(Math.min(amount, cfCredits))}
              disabled={cfCredits < amount}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                cfCredits >= amount
                  ? 'bg-gray-800 text-white hover:bg-gray-700'
                  : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
              }`}
            >
              {amount}
            </button>
          ))}
        </div>

        {/* Exchange Preview */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-green-500/20 rounded-xl p-4 mb-6 border border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-cyan-400 font-bold text-2xl">{exchangeAmount}</div>
              <div className="text-cyan-400/60 text-xs">CF Credits</div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="text-center">
              <div className="text-green-400 font-bold text-2xl">${gameMoneyToReceive.toLocaleString()}</div>
              <div className="text-green-400/60 text-xs">Game Cash</div>
            </div>
          </div>
        </div>

        {/* Exchange Button */}
        <button
          onClick={handleExchange}
          disabled={cfCredits === 0 || exchangeAmount < 1 || isExchanging}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            cfCredits > 0 && exchangeAmount >= 1 && !isExchanging
              ? 'bg-gradient-to-r from-cyan-600 to-green-600 text-white hover:from-cyan-500 hover:to-green-500 shadow-lg shadow-cyan-500/30'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isExchanging ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exchanging...
            </span>
          ) : cfCredits === 0 ? (
            'No CF Credits Available'
          ) : (
            `Exchange for $${gameMoneyToReceive.toLocaleString()}`
          )}
        </button>

        {/* Buy More Credits Link */}
        <div className="text-center mt-4">
          <a
            href="/dashboard"
            target="_blank"
            className="text-cyan-400 hover:text-cyan-300 text-sm underline"
          >
            Buy more CF Credits →
          </a>
        </div>
      </div>
    </div>
  );
}
