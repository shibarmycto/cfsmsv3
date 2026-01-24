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
  Medal,
  Crown,
  Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CaptchaJob {
  type: 'text' | 'math' | 'pattern' | 'image';
  challenge: string;
  answer?: string;
  jobId: string;
  hint: string;
  isReal?: boolean;
}

interface MiningSession {
  id: string;
  captchasCompleted: number;
  tokensEarned: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  tokens_earned: number;
  captchas_completed: number;
  is_current_user: boolean;
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'mine' | 'leaderboard'>('mine');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkMinerStatus();
      fetchLeaderboard();
    }
  }, [user]);

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_mining_leaderboard', { limit_count: 50 });
      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
    setLeaderboardLoading(false);
  };

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
          expectedAnswer: currentJob.answer || currentJob.challenge,
          isReal: currentJob.isReal || false
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

        {/* Tabs for Mining and Leaderboard */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mine' | 'leaderboard')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mine" className="flex items-center gap-2">
              <Pickaxe className="w-4 h-4" />
              Mine
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="space-y-6 mt-6">
            {/* Progress to Next Token */}
            <Card>
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
                      {currentJob.type === 'image' && (
                        <div className="space-y-4">
                          <img 
                            src={currentJob.challenge.startsWith('data:') 
                              ? currentJob.challenge 
                              : `data:image/png;base64,${currentJob.challenge}`}
                            alt="Captcha"
                            className="max-w-full h-auto mx-auto rounded border select-none"
                            style={{ maxHeight: '200px' }}
                            draggable={false}
                          />
                          {currentJob.isReal && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                              Live Task
                            </span>
                          )}
                        </div>
                      )}
                      {currentJob.type === 'text' && (
                        <div className="space-y-2">
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
                          {!currentJob.isReal && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                              Practice Mode
                            </span>
                          )}
                        </div>
                      )}
                      {currentJob.type === 'math' && (
                        <div className="space-y-2">
                          <div className="text-3xl md:text-4xl font-mono font-bold">
                            {currentJob.challenge}
                          </div>
                          {!currentJob.isReal && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                              Practice Mode
                            </span>
                          )}
                        </div>
                      )}
                      {currentJob.type === 'pattern' && (
                        <div className="space-y-2">
                          <div className="text-2xl md:text-3xl font-mono">
                            {currentJob.challenge}
                          </div>
                          {!currentJob.isReal && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                              Practice Mode
                            </span>
                          )}
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
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
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
            <Card>
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
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Top Miners
                    </CardTitle>
                    <CardDescription>
                      Rankings based on tokens earned and tasks completed
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchLeaderboard}
                    disabled={leaderboardLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${leaderboardLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading leaderboard...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No miners on the leaderboard yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Be the first to earn tokens!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div 
                        key={entry.username}
                        className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                          entry.is_current_user 
                            ? 'bg-primary/10 border-2 border-primary/30' 
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-12 text-center">
                          {entry.rank === 1 ? (
                            <Crown className="w-8 h-8 mx-auto text-yellow-500" />
                          ) : entry.rank === 2 ? (
                            <Medal className="w-7 h-7 mx-auto text-gray-400" />
                          ) : entry.rank === 3 ? (
                            <Medal className="w-6 h-6 mx-auto text-amber-600" />
                          ) : (
                            <span className="text-xl font-bold text-muted-foreground">
                              #{entry.rank}
                            </span>
                          )}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold truncate ${
                              entry.is_current_user ? 'text-primary' : ''
                            }`}>
                              @{entry.username}
                            </span>
                            {entry.is_current_user && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.captchas_completed.toLocaleString()} tasks completed
                          </p>
                        </div>

                        {/* Tokens */}
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Coins className="w-4 h-4 text-yellow-500" />
                            <span className="font-bold text-lg">
                              {Number(entry.tokens_earned).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">tokens</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
