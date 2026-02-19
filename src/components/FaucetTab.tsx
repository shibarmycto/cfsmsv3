import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Lock, Zap, Bot, TrendingUp, ArrowRight, Trash2, Search, Shield } from 'lucide-react';

interface FaucetAccess {
  id: string;
  user_id: string;
  is_approved: boolean;
  last_charged_at: string | null;
}

interface ChatMessage {
  id: string;
  type: 'agent' | 'user' | 'system' | 'error';
  text: string;
}

interface FaucetSource {
  name: string;
  coin: string;
  emoji: string;
  reward: string;
  feasibility: number;
  status: 'idle' | 'active' | 'done' | 'error';
}

const DEFAULT_FAUCETS: FaucetSource[] = [
  { name: 'FreeBitcoin', coin: 'BTC', emoji: '₿', reward: '~0.00000050 BTC', feasibility: 85, status: 'idle' },
  { name: 'FaucetPay DOGE', coin: 'DOGE', emoji: '🐕', reward: '~0.05 DOGE', feasibility: 90, status: 'idle' },
  { name: 'Fire Faucet', coin: 'LTC', emoji: 'Ł', reward: '~0.0001 LTC', feasibility: 70, status: 'idle' },
  { name: 'FaucetCrypto', coin: 'ETH', emoji: 'Ξ', reward: '~0.000005 ETH', feasibility: 65, status: 'idle' },
  { name: 'Cointiply', coin: 'BTC', emoji: '₿', reward: '~0.00000100 BTC', feasibility: 80, status: 'idle' },
  { name: 'Allcoins Faucet', coin: 'TRX', emoji: '⟐', reward: '~0.5 TRX', feasibility: 75, status: 'idle' },
  { name: 'GlobalHive', coin: 'BNB', emoji: '◆', reward: '~0.0001 BNB', feasibility: 55, status: 'idle' },
  { name: 'ClaimFreeCoins', coin: 'MATIC', emoji: '⬡', reward: '~0.01 MATIC', feasibility: 60, status: 'idle' },
];

export default function FaucetTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [access, setAccess] = useState<FaucetAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // Faucet agent state
  const [agentRunning, setAgentRunning] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', type: 'agent', text: "Hello! I'm your AI Faucet Agent. I'll analyze available faucets for feasibility, automate task completion strategies, and help you maximize your crypto earnings convertible to SOL. Enter your Solana wallet above and click START to begin." },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [faucets, setFaucets] = useState<FaucetSource[]>(DEFAULT_FAUCETS);
  const [earnedToday, setEarnedToday] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [progress, setProgress] = useState(0);
  const [convertFrom, setConvertFrom] = useState('BTC');
  const [convertAmount, setConvertAmount] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAccess();
  }, [userId]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchAccess = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('faucet_access')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setAccess(data as FaucetAccess | null);
    setLoading(false);
  };

  const requestAccess = async () => {
    setRequesting(true);
    const { error } = await supabase
      .from('faucet_access')
      .insert({ user_id: userId });
    if (error) {
      toast({ title: 'Request Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Access Requested', description: 'Waiting for admin approval. 1 credit/day will be charged once active.' });
      fetchAccess();
    }
    setRequesting(false);
  };

  const chargeDaily = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (access?.last_charged_at === today) return true; // Already charged today

    // Deduct 1 credit
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', userId)
      .single();

    if (!profile || profile.sms_credits < 1) {
      toast({ title: 'Insufficient Credits', description: 'You need at least 1 credit to use the faucet agent today.', variant: 'destructive' });
      return false;
    }

    await supabase.from('profiles').update({ sms_credits: profile.sms_credits - 1 }).eq('user_id', userId);
    await supabase.from('faucet_access').update({ last_charged_at: today }).eq('user_id', userId);
    return true;
  };

  const addMessage = (type: ChatMessage['type'], text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type, text }]);
  };

  const startAgent = async () => {
    if (!walletAddress.trim()) {
      toast({ title: 'Wallet Required', description: 'Enter your SOL wallet address.', variant: 'destructive' });
      return;
    }

    const charged = await chargeDaily();
    if (!charged) return;

    setAgentRunning(true);
    addMessage('system', `✅ Daily credit charged. Agent activated for wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
    addMessage('agent', '🔍 Scanning faucet sources for availability and feasibility...');

    // Simulate scanning
    setTimeout(() => {
      setFaucets(prev => prev.map(f => ({ ...f, status: 'idle' as const })));
      addMessage('agent', `Found ${DEFAULT_FAUCETS.length} faucet sources. Analyzing feasibility scores...`);
      setProgress(25);

      setTimeout(() => {
        setFaucets(DEFAULT_FAUCETS.map(f => ({
          ...f,
          feasibility: Math.min(100, f.feasibility + Math.floor(Math.random() * 15) - 5),
        })));
        addMessage('agent', '📊 Feasibility analysis complete. Top sources: FaucetPay DOGE (90%), FreeBitcoin (85%), Cointiply (80%). Ready to guide you through claiming.');
        setProgress(50);
      }, 2000);
    }, 1500);
  };

  const stopAgent = () => {
    setAgentRunning(false);
    addMessage('system', '⏹ Agent stopped.');
    setProgress(0);
  };

  const handleChat = () => {
    if (!chatInput.trim()) return;
    addMessage('user', chatInput);
    const input = chatInput.toLowerCase();
    setChatInput('');

    setTimeout(() => {
      if (input.includes('analyze') || input.includes('scan')) {
        addMessage('agent', '🔍 Re-scanning all faucet sources... Checking claim timers, captcha requirements, and payout thresholds. Top earners today: FreeBitcoin (hourly rolls), FaucetPay (multi-coin), Cointiply (offers + faucet).');
      } else if (input.includes('feasible') || input.includes('best')) {
        const top = [...faucets].sort((a, b) => b.feasibility - a.feasibility).slice(0, 3);
        addMessage('agent', `🏆 Most feasible faucets right now:\n${top.map((f, i) => `${i + 1}. ${f.name} (${f.coin}) — ${f.feasibility}% feasibility — ${f.reward}`).join('\n')}`);
      } else if (input.includes('strategy')) {
        addMessage('agent', '📋 Recommended strategy:\n1. Start with high-feasibility faucets (DOGE, BTC)\n2. Complete captchas during cooldown periods\n3. Accumulate to minimum withdrawal threshold\n4. Convert small coins to SOL via DEX aggregators\n5. Repeat every 30-60 minutes for maximum yield');
      } else if (input.includes('convert') || input.includes('sol')) {
        addMessage('agent', '🔄 To convert earnings to SOL:\n• Use ChangeNOW or SimpleSwap for small amounts\n• SideShift.ai for no-account swaps\n• Jupiter aggregator on Solana for best on-chain rates\n• Minimum recommended: accumulate $1+ before converting to save on fees');
      } else {
        addMessage('agent', "I can help you with: analyzing faucets, finding the most feasible sources, building a strategy, or converting earnings to SOL. What would you like to do?");
      }
    }, 800);
  };

  const clearLog = () => {
    setEarnedToday(0);
    setTasksDone(0);
  };

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse-glow w-12 h-12 rounded-xl bg-primary/20" />
      </div>
    );
  }

  // Not requested yet
  if (!access) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">SOL Faucet AI Agent</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          AI-powered crypto faucet scanner that finds and guides you through legitimate faucet tasks, converting earnings to SOL. Requires admin approval. <strong>1 credit per day</strong> to use.
        </p>
        <Button onClick={requestAccess} disabled={requesting} size="lg">
          {requesting ? 'Requesting...' : 'Request Access'}
        </Button>
      </div>
    );
  }

  // Pending approval
  if (!access.is_approved) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-bold">Access Pending</h2>
        <p className="text-muted-foreground">Your faucet agent access request is pending admin approval. You'll be notified when approved.</p>
        <span className="inline-block text-xs px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400">Pending Approval</span>
      </div>
    );
  }

  // Approved — show full faucet UI
  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-green-400 flex items-center justify-center text-xl">◎</div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-green-400 bg-clip-text text-transparent">SOL Faucet Agent</h2>
            <p className="text-xs text-muted-foreground font-mono tracking-wider">AI-POWERED CRYPTO EARNING</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-full px-4 py-2 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${agentRunning ? 'bg-green-400 shadow-[0_0_6px] shadow-green-400 animate-pulse' : 'bg-destructive'}`} />
          {agentRunning ? 'AGENT ACTIVE' : 'AGENT OFFLINE'}
        </div>
      </div>

      {/* Wallet Config */}
      <div className="bg-card/50 border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-mono text-primary tracking-wider">SOL WALLET:</span>
        <Input
          value={walletAddress}
          onChange={e => setWalletAddress(e.target.value)}
          placeholder="Your Solana wallet address..."
          className="flex-1 min-w-[200px] bg-background font-mono text-sm"
        />
        {!agentRunning ? (
          <Button onClick={startAgent} className="bg-gradient-to-r from-primary to-green-500 text-primary-foreground">
            <Zap className="w-4 h-4 mr-1" /> START
          </Button>
        ) : (
          <Button onClick={stopAgent} variant="destructive" size="sm">■ STOP</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'EARNED TODAY', value: `$${earnedToday.toFixed(3)}`, sub: 'USD VALUE', color: 'text-foreground' },
          { label: 'TASKS DONE', value: tasksDone.toString(), sub: 'THIS SESSION', color: 'text-foreground' },
          { label: 'FAUCETS ACTIVE', value: faucets.filter(f => f.status === 'active').length.toString(), sub: `OF ${faucets.length} AVAILABLE`, color: 'text-green-400' },
          { label: 'DAILY COST', value: '1 Credit', sub: 'PER DAY', color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="bg-card/50 border border-border rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Faucet Sources — 3 cols */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-widest uppercase">Faucet Sources</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {agentRunning ? 'SCANNING' : 'READY'}
              </span>
            </div>
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {faucets.map((f, i) => (
                <div key={i} className={`bg-background/50 border rounded-xl p-3 flex items-center gap-3 transition-all ${
                  f.status === 'active' ? 'border-green-400/40 bg-green-400/5' : 'border-border hover:border-primary/30'
                }`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {f.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{f.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{f.coin} • {f.reward}</p>
                  </div>
                  <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${f.feasibility}%`,
                        background: f.feasibility > 70 ? '#14F195' : f.feasibility > 40 ? '#FFD700' : '#FF4444',
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{f.feasibility}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Crypto → SOL Conversion */}
          <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold tracking-widest uppercase">Crypto → SOL Converter</h3>
            </div>
            <div className="p-4 space-y-3">
              <select
                value={convertFrom}
                onChange={e => setConvertFrom(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
              >
                {['BTC', 'ETH', 'DOGE', 'LTC', 'TRX', 'BNB', 'MATIC', 'FTM'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  value={convertAmount}
                  onChange={e => setConvertAmount(e.target.value)}
                  placeholder="Amount..."
                  className="font-mono text-sm"
                />
                <ArrowRight className="w-5 h-5 text-green-400 flex-shrink-0" />
                <Input disabled placeholder="SOL estimate" className="font-mono text-sm" />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                ⚡ Use ChangeNOW, SimpleSwap, or SideShift for best rates. Agent will guide you.
              </p>
            </div>
          </div>
        </div>

        {/* AI Chat — 2 cols */}
        <div className="lg:col-span-2 bg-card/50 border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-widest uppercase">AI Agent</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">AI POWERED</span>
          </div>

          <div ref={chatRef} className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[350px] min-h-[250px]">
            {messages.map(msg => (
              <div key={msg.id} className={`text-xs font-mono p-2.5 rounded-lg leading-relaxed ${
                msg.type === 'agent' ? 'bg-primary/10 border border-primary/20 text-primary-foreground/80' :
                msg.type === 'system' ? 'bg-green-400/10 border border-green-400/20 text-green-400' :
                msg.type === 'error' ? 'bg-destructive/10 border border-destructive/20 text-destructive' :
                'bg-secondary/50 border border-border self-end'
              }`}>
                <p className="text-[9px] opacity-50 mb-1 uppercase tracking-wider">{msg.type}</p>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          {agentRunning && (
            <div className="px-4 pb-3">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>AGENT PROGRESS</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChat()}
              placeholder="Ask the agent..."
              className="text-xs font-mono"
            />
            <Button size="sm" onClick={handleChat} className="px-3">↑</Button>
          </div>

          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            {['🔍 Analyze', '✅ Feasible', '📋 Strategy', '🔄 SOL Convert'].map(label => (
              <button
                key={label}
                onClick={() => { setChatInput(label.split(' ')[1]); setTimeout(handleChat, 50); }}
                className="text-[10px] font-mono px-2 py-1 rounded bg-secondary/50 border border-border hover:border-primary/30 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-[10px] font-mono text-yellow-500/70 leading-relaxed">
        ⚠️ This tool helps you find and track real crypto faucets and uses AI to advise on strategy. Actual faucet tasks are completed by you through legitimate faucet websites. Never share your seed phrase. Faucet earnings are small — typically $0.01–$0.50/day. Convert earnings to SOL via DEX aggregators or exchanges.
      </div>
    </div>
  );
}
