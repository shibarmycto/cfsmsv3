import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock, Clock, CreditCard, MessageCircle, Users, Unlock, AlertTriangle } from 'lucide-react';

interface JailSystemProps {
  characterId: string;
  characterName: string;
  jailUntil: string | null;
  jailReason: string | null;
  cfCredits: number;
  onRelease: () => void;
  onCreditsSpent: (amount: number) => void;
}

interface Prisoner {
  id: string;
  name: string;
  jail_until: string;
  jail_reason: string;
}

export default function JailSystem({
  characterId,
  characterName,
  jailUntil,
  jailReason,
  cfCredits,
  onRelease,
  onCreditsSpent
}: JailSystemProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showBuyCard, setShowBuyCard] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!jailUntil) return;

    const calculateRemaining = () => {
      const remaining = Math.max(0, new Date(jailUntil).getTime() - Date.now());
      setTimeRemaining(Math.floor(remaining / 1000));

      if (remaining <= 0) {
        releaseFromJail();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [jailUntil]);

  // Load other prisoners
  useEffect(() => {
    loadPrisoners();
    const channel = supabase.channel('jail-chat')
      .on('broadcast', { event: 'jail-message' }, ({ payload }) => {
        setChatMessages(prev => [...prev.slice(-50), payload]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPrisoners = async () => {
    const { data } = await supabase
      .from('game_characters')
      .select('id, name, jail_until, jail_reason')
      .eq('is_in_jail', true)
      .neq('id', characterId);

    if (data) setPrisoners(data as Prisoner[]);
  };

  const releaseFromJail = async () => {
    await supabase.from('game_characters').update({
      is_in_jail: false,
      jail_until: null,
      jail_reason: null
    }).eq('id', characterId);

    // Update jail log
    await supabase.from('game_jail_logs').update({
      released_at: new Date().toISOString()
    }).eq('character_id', characterId).is('released_at', null);

    toast.success('You have been released from jail!');
    onRelease();
  };

  const buyJailCard = async () => {
    if (cfCredits < 1) {
      toast.error('You need 1 CF Credit to buy a jail card!');
      return;
    }

    // Get current credits spent and increment
    const { data: currentChar } = await supabase
      .from('game_characters')
      .select('cf_credits_spent_in_game')
      .eq('id', characterId)
      .single();

    if (currentChar) {
      await supabase.from('game_characters').update({
        cf_credits_spent_in_game: (currentChar.cf_credits_spent_in_game || 0) + 1
      }).eq('id', characterId);
    }

    // Update jail log
    await supabase.from('game_jail_logs').update({
      released_at: new Date().toISOString(),
      used_jail_card: true
    }).eq('character_id', characterId).is('released_at', null);

    onCreditsSpent(1);
    toast.success('Used Jail Card! You are free!');
    releaseFromJail();
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    supabase.channel('jail-chat').send({
      type: 'broadcast',
      event: 'jail-message',
      payload: { sender: characterName, message: chatInput }
    });

    setChatMessages(prev => [...prev, { sender: characterName, message: chatInput }]);
    setChatInput('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Jail bars effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-4 bg-gradient-to-b from-gray-700 via-gray-600 to-gray-700 opacity-20"
            style={{ left: `${(i + 1) * 8}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col h-full p-4 md:p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 border-4 border-red-500/50 flex items-center justify-center mb-4">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">CF JAIL</h1>
          <p className="text-gray-400">{jailReason || 'Serving time'}</p>
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 bg-black/50 rounded-2xl px-8 py-4 border border-white/10">
            <Clock className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-4xl font-black text-white font-mono">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-gray-500 text-sm">Remaining</div>
            </div>
          </div>
        </div>

        {/* Jail Card option */}
        <div className="text-center mb-6">
          <button
            onClick={() => setShowBuyCard(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-yellow-500/30"
          >
            <CreditCard className="w-5 h-5" />
            Buy Jail Card (1 CF Credit)
          </button>
          <p className="text-gray-500 text-xs mt-2">Get out of jail immediately</p>
        </div>

        {/* Main content - split view */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
          {/* Other prisoners */}
          <div className="bg-black/30 rounded-xl border border-white/10 p-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Other Prisoners ({prisoners.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {prisoners.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No other prisoners</p>
                </div>
              ) : (
                prisoners.map(prisoner => (
                  <div
                    key={prisoner.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-white/5"
                  >
                    <div>
                      <div className="text-white font-medium">{prisoner.name}</div>
                      <div className="text-gray-500 text-xs">{prisoner.jail_reason}</div>
                    </div>
                    <div className="text-red-400 text-sm font-mono">
                      {formatTime(Math.max(0, Math.floor((new Date(prisoner.jail_until).getTime() - Date.now()) / 1000)))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Jail chat */}
          <div className="bg-black/30 rounded-xl border border-white/10 p-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-gray-400">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Jail Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  <p>No messages yet</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-cyan-400 font-medium">{msg.sender}:</span>
                    <span className="text-gray-300 ml-1">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Chat with prisoners..."
                className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500/50 outline-none"
              />
              <button
                onClick={sendMessage}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Buy jail card modal */}
      {showBuyCard && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                <Unlock className="w-10 h-10 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Jail Card</h2>
              <p className="text-gray-400 text-sm mt-2">
                Use 1 CF Credit to get out of jail immediately
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Your CF Credits:</span>
                <span className="text-yellow-400 font-bold">{cfCredits}</span>
              </div>
            </div>

            {cfCredits < 1 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">Not enough CF Credits!</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowBuyCard(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={buyJailCard}
                disabled={cfCredits < 1}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  cfCredits >= 1
                    ? 'bg-yellow-600 text-white hover:bg-yellow-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Use 1 Credit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
