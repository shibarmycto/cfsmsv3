import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Pickaxe,
  Coins,
  Zap,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trophy,
  Clock,
  Target,
} from 'lucide-react';

interface CaptchaJob {
  type: 'text' | 'math' | 'pattern';
  challenge: string;
  answer?: string;
  jobId: string;
  hint: string;
}

interface MiningSession {
  id: string;
  captchasCompleted: number;
  tokensEarned: number;
}

const CAPTCHAS_PER_TOKEN = 1000;

export default function CFMiner() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [currentJob, setCurrentJob] = useState<CaptchaJob | null>(null);
  const [answer, setAnswer] = useState('');
  const [session, setSession] = useState<MiningSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkMinerStatus();
    }
  }, [user]);

  const checkMinerStatus = async () => {
    if (!user) return;

    const { data: wallet } = await supabase
      .from('wallets')
      .select('is_miner_approved, balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (wallet) {
      setIsApproved(wallet.is_miner_approved);
      setBalance(wallet.balance);
      if (wallet.is_miner_approved) {
        fetchNewJob();
      }
    } else {
      setIsApproved(false);
    }
  };

  const fetchNewJob = useCallback(async () => {
    setIsLoading(true);
    setAnswer('');
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('cfminer-get-job');

      if (error) throw error;

      if (data.success) {
        setCurrentJob(data.captcha);
        setSession(data.session);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      toast({ title: 'Error', description: 'Failed to get new task', variant: 'destructive' });
    }

    setIsLoading(false);
  }, [toast]);

  const submitAnswer = async () => {
    if (!currentJob || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('cfminer-submit-job', {
        body: {
          jobId: currentJob.jobId,
          answer: answer.trim(),
          captchaType: currentJob.type,
          expectedAnswer: currentJob.answer || currentJob.challenge
        }
      });

      if (error) throw error;

      if (data.correct) {
        setLastResult('correct');
        setStreak(prev => prev + 1);
        setTotalToday(prev => prev + 1);
        
        if (data.tokensAwarded > 0) {
          setBalance(data.newBalance);
          toast({
            title: '🎉 Token Earned!',
            description: `You earned ${data.tokensAwarded} CFSMS token${data.tokensAwarded > 1 ? 's' : ''}!`,
          });
        }

        if (session) {
          setSession({
            ...session,
            captchasCompleted: data.captchasCompleted,
            tokensEarned: data.tokensEarned
          });
        }

        // Auto-fetch next job after short delay
        setTimeout(() => {
          fetchNewJob();
        }, 500);
      } else {
        setLastResult('incorrect');
        setStreak(0);
        toast({ title: 'Incorrect', description: 'Try again!', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast({ title: 'Error', description: 'Failed to submit answer', variant: 'destructive' });
    }

    setIsSubmitting(false);
  };

  const progressToNextToken = session ? (session.captchasCompleted % CAPTCHAS_PER_TOKEN) : 0;
  const progressPercent = (progressToNextToken / CAPTCHAS_PER_TOKEN) * 100;

  if (loading || isApproved === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-md mx-auto mt-20">
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
                <Pickaxe className="w-8 h-8 text-yellow-500" />
              </div>
              <CardTitle>CFMiner Access Required</CardTitle>
              <CardDescription>
                You need to be approved as a miner to access CFMiner. 
                Request miner status from your CFSMS Bank.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => navigate('/bank')} className="w-full">
                <Coins className="w-4 h-4 mr-2" />
                Go to CFSMS Bank
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-500/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/bank')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                <Pickaxe className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h1 className="font-bold text-lg">CFMiner</h1>
                <p className="text-xs text-muted-foreground">Earn CFSMS Tokens</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xl font-bold">{balance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">CFSMS Balance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-lg font-bold">{session?.captchasCompleted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tokens Earned</p>
                  <p className="text-lg font-bold">{session?.tokensEarned || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Streak</p>
                  <p className="text-lg font-bold">{streak}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-lg font-bold">{totalToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress to Next Token */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress to Next Token</span>
              <span className="text-sm text-muted-foreground">
                {progressToNextToken} / {CAPTCHAS_PER_TOKEN}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {CAPTCHAS_PER_TOKEN - progressToNextToken} more tasks to earn 1 CFSMS token
            </p>
          </CardContent>
        </Card>

        {/* Mining Interface */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Current Task
                </CardTitle>
                <CardDescription>
                  Complete the task below to earn progress
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchNewJob}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Loading task...</p>
              </div>
            ) : currentJob ? (
              <div className="space-y-6">
                {/* Challenge Display */}
                <div className="p-8 bg-muted/50 rounded-lg text-center">
                  {currentJob.type === 'text' && (
                    <div 
                      className="text-4xl md:text-5xl font-mono font-bold tracking-widest select-none"
                      style={{
                        textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                        letterSpacing: '0.5em',
                        fontStyle: 'italic',
                        transform: `rotate(${Math.random() * 6 - 3}deg)`
                      }}
                    >
                      {currentJob.challenge}
                    </div>
                  )}
                  {currentJob.type === 'math' && (
                    <div className="text-3xl md:text-4xl font-mono font-bold">
                      {currentJob.challenge}
                    </div>
                  )}
                  {currentJob.type === 'pattern' && (
                    <div className="text-2xl md:text-3xl font-mono">
                      {currentJob.challenge}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">{currentJob.hint}</p>
                </div>

                {/* Answer Input */}
                <div className="flex gap-3">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter your answer..."
                    className="text-center text-lg font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <Button 
                    onClick={submitAnswer}
                    disabled={isSubmitting || !answer.trim()}
                    size="lg"
                    className="px-8"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Submit'
                    )}
                  </Button>
                </div>

                {/* Result Feedback */}
                {lastResult && (
                  <div className={`flex items-center justify-center gap-2 p-4 rounded-lg ${
                    lastResult === 'correct' 
                      ? 'bg-green-500/10 text-green-500' 
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {lastResult === 'correct' ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Correct! Loading next task...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">Incorrect. Try again!</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Pickaxe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No task loaded</p>
                <Button onClick={fetchNewJob}>
                  <Pickaxe className="w-4 h-4 mr-2" />
                  Start Mining
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-3">How CFMiner Works</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Complete verification tasks to earn progress
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Every 1,000 completed tasks = 1 CFSMS token
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Tokens are instantly credited to your wallet
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Exchange tokens for SMS credits or withdraw to crypto
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
