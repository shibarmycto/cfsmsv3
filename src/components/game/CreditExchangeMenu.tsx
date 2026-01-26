import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Coins, ArrowRight, DollarSign, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CreditExchangeMenuProps {
  character: any;
  onClose: () => void;
  onCharacterUpdate: () => void;
}

const GAME_MONEY_PER_CREDIT = 100;

export default function CreditExchangeMenu({ character, onClose, onCharacterUpdate }: CreditExchangeMenuProps) {
  const [cfCredits, setCfCredits] = useState(0);
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setCfCredits(data.sms_credits || 0);
    }
    setLoading(false);
  };

  const handleExchange = async () => {
    const amount = parseInt(exchangeAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Enter a valid amount (minimum 1 credit)');
      return;
    }

    if (amount > cfCredits) {
      toast.error('Insufficient CF credits');
      return;
    }

    setIsExchanging(true);

    try {
      const { data, error } = await supabase.functions.invoke('game-credits-exchange', {
        body: {
          creditsToExchange: amount,
          characterId: character.id
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Exchange failed');
      } else {
        toast.success(`Exchanged ${data.creditsUsed} credits for $${data.gameMoneyAdded.toLocaleString()}!`);
        setCfCredits(data.remainingCredits);
        setExchangeAmount('');
        onCharacterUpdate();
      }
    } catch (err) {
      toast.error('Failed to exchange credits');
    }

    setIsExchanging(false);
  };

  const previewAmount = parseInt(exchangeAmount) || 0;
  const gameMoneyPreview = previewAmount * GAME_MONEY_PER_CREDIT;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Credit Exchange
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg p-4 text-center border border-primary/30">
            <Coins className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-primary">
              {loading ? '...' : cfCredits.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">CF Credits</p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-lg p-4 text-center border border-green-500/30">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-500">
              ${character.cash.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Game Cash</p>
          </div>
        </div>

        {/* Exchange Rate Info */}
        <div className="bg-secondary/50 rounded-lg p-3 mb-6 text-center">
          <p className="text-sm text-muted-foreground">Exchange Rate</p>
          <p className="text-lg font-bold flex items-center justify-center gap-2">
            <span className="text-primary">1 Credit</span>
            <ArrowRight className="w-4 h-4" />
            <span className="text-green-500">${GAME_MONEY_PER_CREDIT}</span>
          </p>
        </div>

        {/* Exchange Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Credits to Exchange
            </label>
            <Input
              type="number"
              min="1"
              max={cfCredits}
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
              placeholder="Enter amount..."
              className="text-lg"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {[1, 5, 10, 25, 50].map((amt) => (
              <Button
                key={amt}
                size="sm"
                variant="outline"
                onClick={() => setExchangeAmount(String(Math.min(amt, cfCredits)))}
                disabled={amt > cfCredits}
              >
                {amt}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExchangeAmount(String(cfCredits))}
              disabled={cfCredits === 0}
            >
              MAX
            </Button>
          </div>

          {/* Preview */}
          {previewAmount > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">You will receive</p>
              <p className="text-2xl font-bold text-green-500">
                ${gameMoneyPreview.toLocaleString()}
              </p>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleExchange}
            disabled={isExchanging || !exchangeAmount || parseInt(exchangeAmount) < 1 || parseInt(exchangeAmount) > cfCredits}
          >
            {isExchanging ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Exchanging...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Exchange Credits
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          CF Credits are earned by mining or purchasing from the Bank.
          Game money can be used to buy vehicles, properties, and more!
        </p>
      </div>
    </div>
  );
}
