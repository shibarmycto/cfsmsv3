import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Lock, Zap, Bot, TrendingUp, ArrowRight, Shield, Square, RotateCw } from 'lucide-react';

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
  id: string;
  name: string;
  coin: string;
  emoji: string;
  reward: string;
  status: 'idle' | 'working' | 'claimed' | 'cooldown' | 'error';
  lastClaimed: string | null;
  earnedThisCycle: number;
}

const FAUCET_EMOJIS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', DOGE: '🐕', LTC: 'Ł', TRX: '⟐', BNB: '◆', MATIC: '⬡',
};

export default function FaucetTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [access, setAccess] = useState<FaucetAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const [agentRunning, setAgentRunning] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', type: 'agent', text: "🤖 Autonomous Faucet Agent ready. I will scan, solve captchas, claim rewards, and earn crypto — all automatically. Enter your SOL wallet and hit START. I'll go to work." },
  ]);
  const [faucets, setFaucets] = useState<FaucetSource[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalSOL, setTotalSOL] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [currentFaucet, setCurrentFaucet] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    fetchAccess();
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, [userId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
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
    const { error } = await supabase.from('faucet_access').insert({ user_id: userId });
    if (error) {
      toast({ title: 'Request Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Access Requested', description: 'Waiting for admin approval. 1 credit/day once active.' });
      fetchAccess();
    }
    setRequesting(false);
  };

  const chargeDaily = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (access?.last_charged_at === today) return true;
    const { data: profile } = await supabase.from('profiles').select('sms_credits').eq('user_id', userId).single();
    if (!profile || profile.sms_credits < 1) {
      toast({ title: 'Insufficient Credits', description: 'Need at least 1 credit to run the agent today.', variant: 'destructive' });
      return false;
    }
    await supabase.from('profiles').update({ sms_credits: profile.sms_credits - 1 }).eq('user_id', userId);
    await supabase.from('faucet_access').update({ last_charged_at: today }).eq('user_id', userId);
    return true;
  };

  const addMsg = useCallback((type: ChatMessage['type'], text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), type, text }]);
  }, []);

  const callAgent = async (action: string, extra?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/faucet-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, wallet_address: walletAddress, ...extra }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Agent call failed');
    }
    return res.json();
  };

  const startAgent = async () => {
    if (!walletAddress.trim()) {
      toast({ title: 'Wallet Required', description: 'Enter your SOL wallet address.', variant: 'destructive' });
      return;
    }

    const charged = await chargeDaily();
    if (!charged) return;

    setAgentRunning(true);
    runningRef.current = true;
    addMsg('system', `✅ 1 credit charged. Agent activated for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
    addMsg('agent', '🔍 Analyzing all faucet sources... Claude AI is building an execution plan.');
    setProgress(10);

    try {
      const startData = await callAgent('start');
      
      // Populate faucet list from backend
      if (startData.faucets) {
        setFaucets(startData.faucets.map((f: any) => ({
          id: f.id,
          name: f.name,
          coin: f.coin,
          emoji: FAUCET_EMOJIS[f.coin] || '●',
          reward: `${f.minReward}-${f.maxReward} ${f.coin}`,
          status: 'idle' as const,
          lastClaimed: null,
          earnedThisCycle: 0,
        })));
      }

      addMsg('agent', `📊 AI Plan ready. ${startData.faucets?.length || 0} faucets targeted. Beginning autonomous work cycle...`);
      if (startData.aiPlan) {
        addMsg('agent', `🧠 ${typeof startData.aiPlan === 'string' ? startData.aiPlan.slice(0, 500) : 'Plan generated.'}`);
      }
      setProgress(20);

      // Start first cycle
      runCycle();
    } catch (e) {
      addMsg('error', `❌ Failed to start: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setAgentRunning(false);
      runningRef.current = false;
    }
  };

  const runCycle = async () => {
    if (!runningRef.current) return;

    addMsg('agent', `🔄 Starting work cycle #${cyclesCompleted + 1}... Working through all faucets autonomously.`);
    setProgress(30);

    try {
      // Mark all faucets as working
      setFaucets(prev => prev.map(f => ({ ...f, status: 'working' as const })));

      const cycleData = await callAgent('cycle');

      if (cycleData.results) {
        let cycleTasksDone = 0;
        
        // Update faucet statuses based on results
        setFaucets(prev => prev.map(f => {
          const result = cycleData.results.find((r: any) => r.faucetId === f.id);
          if (!result) return f;
          
          if (result.success) cycleTasksDone++;

          return {
            ...f,
            status: result.success ? 'claimed' as const : 'cooldown' as const,
            lastClaimed: result.success ? new Date().toLocaleTimeString() : f.lastClaimed,
            earnedThisCycle: result.success ? result.reward : 0,
          };
        }));

        setTasksDone(prev => prev + cycleTasksDone);

        // Log each result
        for (const r of cycleData.results) {
          if (r.success) {
            addMsg('system', `💰 ${r.faucetName}: Earned ${r.reward.toFixed(8)} ${r.coin} (~$${r.usdValue.toFixed(6)})`);
          } else {
            addMsg('agent', `⏳ ${r.faucetName}: ${r.message}`);
          }
        }
      }

      if (cycleData.totalEarnedUSD > 0) {
        setTotalEarned(prev => prev + cycleData.totalEarnedUSD);
        setTotalSOL(prev => prev + cycleData.totalSOL);
        addMsg('system', `✅ Cycle earned: $${cycleData.totalEarnedUSD.toFixed(6)} (~${cycleData.totalSOL.toFixed(8)} SOL)`);
      } else {
        addMsg('agent', '⏳ No claims this cycle — faucets on cooldown. Will retry next cycle.');
      }

      if (cycleData.aiSummary) {
        addMsg('agent', `🧠 ${typeof cycleData.aiSummary === 'string' ? cycleData.aiSummary.slice(0, 400) : 'Cycle analysis complete.'}`);
      }

      setCyclesCompleted(prev => prev + 1);
      setProgress(100);

      // Schedule next cycle
      const nextIn = (cycleData.nextCycleIn || 300) * 1000;
      addMsg('agent', `⏰ Next cycle in ${Math.round(nextIn / 60000)} minutes. Agent is working autonomously...`);

      if (runningRef.current) {
        // Reset progress for next cycle
        setTimeout(() => setProgress(0), 2000);
        cycleTimerRef.current = setTimeout(() => {
          if (runningRef.current) runCycle();
        }, nextIn);
      }
    } catch (e) {
      addMsg('error', `❌ Cycle error: ${e instanceof Error ? e.message : 'Unknown'}. Retrying in 2 minutes...`);
      if (runningRef.current) {
        cycleTimerRef.current = setTimeout(() => {
          if (runningRef.current) runCycle();
        }, 120000);
      }
    }
  };

  const stopAgent = () => {
    runningRef.current = false;
    setAgentRunning(false);
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    addMsg('system', `⏹ Agent stopped. Total earned: $${totalEarned.toFixed(6)} (~${totalSOL.toFixed(8)} SOL)`);
    setProgress(0);
    setCurrentFaucet(null);
  };

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse-glow w-12 h-12 rounded-xl bg-primary/20" />
      </div>
    );
  }

  if (!access) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">SOL Faucet AI Agent</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Autonomous AI agent that claims crypto from faucets, solves captchas, and earns SOL — all automatically. Requires admin approval. <strong>1 credit/day</strong>.
        </p>
        <Button onClick={requestAccess} disabled={requesting} size="lg">
          {requesting ? 'Requesting...' : 'Request Access'}
        </Button>
      </div>
    );
  }

  if (!access.is_approved) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-bold">Access Pending</h2>
        <p className="text-muted-foreground">Your request is pending admin approval.</p>
        <span className="inline-block text-xs px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400">Pending Approval</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-green-400 flex items-center justify-center text-xl">🤖</div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-green-400 bg-clip-text text-transparent">Autonomous Faucet Agent</h2>
            <p className="text-xs text-muted-foreground font-mono tracking-wider">AI CLAIMS • CAPTCHA SOLVING • AUTO EARN</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-full px-4 py-2 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${agentRunning ? 'bg-green-400 shadow-[0_0_6px] shadow-green-400 animate-pulse' : 'bg-destructive'}`} />
          {agentRunning ? 'AGENT WORKING' : 'AGENT OFFLINE'}
        </div>
      </div>

      {/* Wallet + Controls */}
      <div className="bg-card/50 border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-mono text-primary tracking-wider">SOL WALLET:</span>
        <Input
          value={walletAddress}
          onChange={e => setWalletAddress(e.target.value)}
          placeholder="Your Solana wallet address..."
          className="flex-1 min-w-[200px] bg-background font-mono text-sm"
          disabled={agentRunning}
        />
        {!agentRunning ? (
          <Button onClick={startAgent} className="bg-gradient-to-r from-primary to-green-500 text-primary-foreground">
            <Zap className="w-4 h-4 mr-1" /> START AGENT
          </Button>
        ) : (
          <Button onClick={stopAgent} variant="destructive" size="sm">
            <Square className="w-3 h-3 mr-1" /> STOP
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'EARNED TOTAL', value: `$${totalEarned.toFixed(4)}`, sub: 'USD VALUE', color: 'text-green-400' },
          { label: 'EST. SOL', value: totalSOL.toFixed(6), sub: 'ACCUMULATED', color: 'text-green-400' },
          { label: 'TASKS DONE', value: tasksDone.toString(), sub: 'CLAIMS MADE', color: 'text-foreground' },
          { label: 'CYCLES', value: cyclesCompleted.toString(), sub: 'COMPLETED', color: 'text-primary' },
          { label: 'DAILY COST', value: '1 Credit', sub: 'PER DAY', color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="bg-card/50 border border-border rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Faucet Sources — 3 cols */}
        <div className="lg:col-span-3 bg-card/50 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-widest uppercase">Faucet Workers</h3>
            <div className="flex items-center gap-2">
              {agentRunning && <RotateCw className="w-3 h-3 text-green-400 animate-spin" />}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {agentRunning ? 'AUTONOMOUS' : 'IDLE'}
              </span>
            </div>
          </div>
          <div className="p-3 space-y-2 max-h-[450px] overflow-y-auto">
            {faucets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm font-mono">
                Start the agent to load faucet sources
              </div>
            ) : (
              faucets.map((f) => (
                <div key={f.id} className={`bg-background/50 border rounded-xl p-3 flex items-center gap-3 transition-all ${
                  f.status === 'working' ? 'border-yellow-400/40 bg-yellow-400/5 animate-pulse' :
                  f.status === 'claimed' ? 'border-green-400/40 bg-green-400/5' :
                  f.status === 'cooldown' ? 'border-muted/40 opacity-60' :
                  f.status === 'error' ? 'border-destructive/40 bg-destructive/5' :
                  'border-border hover:border-primary/30'
                }`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {f.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{f.name}</p>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        f.status === 'working' ? 'bg-yellow-400/20 text-yellow-400' :
                        f.status === 'claimed' ? 'bg-green-400/20 text-green-400' :
                        f.status === 'cooldown' ? 'bg-muted/20 text-muted-foreground' :
                        f.status === 'error' ? 'bg-destructive/20 text-destructive' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {f.status === 'working' ? '⚙️ WORKING' :
                         f.status === 'claimed' ? '✅ CLAIMED' :
                         f.status === 'cooldown' ? '⏳ COOLDOWN' :
                         f.status === 'error' ? '❌ ERROR' : '● IDLE'}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {f.coin} • {f.reward}
                      {f.lastClaimed && ` • Last: ${f.lastClaimed}`}
                    </p>
                  </div>
                  {f.earnedThisCycle > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-green-400 font-bold">+{f.earnedThisCycle.toFixed(8)}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{f.coin}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Agent Log — 2 cols */}
        <div className="lg:col-span-2 bg-card/50 border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-widest uppercase">Agent Activity</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-400/20 text-green-400 border border-green-400/30">
              {agentRunning ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div ref={chatRef} className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[400px] min-h-[300px]">
            {messages.map(msg => (
              <div key={msg.id} className={`text-xs font-mono p-2.5 rounded-lg leading-relaxed ${
                msg.type === 'agent' ? 'bg-primary/10 border border-primary/20 text-primary-foreground/80' :
                msg.type === 'system' ? 'bg-green-400/10 border border-green-400/20 text-green-400' :
                msg.type === 'error' ? 'bg-destructive/10 border border-destructive/20 text-destructive' :
                'bg-secondary/50 border border-border'
              }`}>
                <p className="text-[9px] opacity-50 mb-1 uppercase tracking-wider">
                  {msg.type === 'agent' ? '🤖 AI AGENT' : msg.type === 'system' ? '💰 EARNINGS' : msg.type === 'error' ? '⚠️ ERROR' : 'USER'}
                </p>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
            {agentRunning && faucets.some(f => f.status === 'working') && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground p-2">
                <RotateCw className="w-3 h-3 animate-spin text-primary" />
                Working on faucets...
              </div>
            )}
          </div>

          {/* Progress */}
          {agentRunning && (
            <div className="px-4 pb-3">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>CYCLE PROGRESS</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-[10px] font-mono text-yellow-500/70 leading-relaxed">
        ⚠️ Autonomous AI agent that works faucets on your behalf. Uses Claude AI for strategy and 2Captcha for captcha solving. Earnings are small ($0.01–$0.50/day). Agent runs continuously and converts earnings to SOL estimates. Never share your seed phrase.
      </div>
    </div>
  );
}
