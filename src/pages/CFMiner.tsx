import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Pickaxe,
  Coins,
  ArrowLeft,
  CheckCircle,
  Trophy,
  Clock,
  Target,
  Medal,
  Crown,
  Users,
  Play,
  Globe,
  Youtube,
  Bitcoin,
  ExternalLink,
  Timer,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import VerifiedBadge from '@/components/VerifiedBadge';

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
  is_verified: boolean;
}

interface TaskStatus {
  signup: { completed: boolean; completedAt: string | null };
  freebitcoin: { completed: boolean; lastCompleted: string | null; canDoAt: string | null };
  youtube: { completed: boolean; lastCompleted: string | null; canDoAt: string | null };
}

const TASKS_PER_TOKEN = 1000;

export default function CFMiner() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const youtubeRef = useRef<HTMLIFrameElement>(null);
  const videoStartTimeRef = useRef<number | null>(null);

  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [session, setSession] = useState<MiningSession | null>(null);
  const [balance, setBalance] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'leaderboard'>('tasks');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    signup: { completed: false, completedAt: null },
    freebitcoin: { completed: false, lastCompleted: null, canDoAt: null },
    youtube: { completed: false, lastCompleted: null, canDoAt: null },
  });
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [youtubeWatching, setYoutubeWatching] = useState(false);
  const [freeBitcoinOpen, setFreeBitcoinOpen] = useState(false);
  const [countdown, setCountdown] = useState<{ freebitcoin: number; youtube: number }>({ freebitcoin: 0, youtube: 0 });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkMinerStatus();
      fetchLeaderboard();
      fetchTaskStatus();
    }
  }, [user]);

  // Countdown timer for cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCountdown({
        freebitcoin: taskStatus.freebitcoin.canDoAt 
          ? Math.max(0, Math.floor((new Date(taskStatus.freebitcoin.canDoAt).getTime() - now) / 1000))
          : 0,
        youtube: taskStatus.youtube.canDoAt
          ? Math.max(0, Math.floor((new Date(taskStatus.youtube.canDoAt).getTime() - now) / 1000))
          : 0,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [taskStatus]);

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
    } else {
      setIsApproved(false);
    }
  };

  const fetchTaskStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('cfminer-task-status');
      if (error) throw error;
      
      if (data.success) {
        setTaskStatus(data.status);
        setSession(data.session);
      }
    } catch (error) {
      console.error('Error fetching task status:', error);
    }
  };

  const completeTask = async (taskType: 'signup' | 'freebitcoin' | 'youtube', details?: object) => {
    setIsSubmitting(taskType);
    
    try {
      const { data, error } = await supabase.functions.invoke('cfminer-complete-task', {
        body: { taskType, details }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: '✅ Task Completed!',
          description: data.message,
        });
        
        if (data.tokensAwarded > 0) {
          setBalance(data.newBalance);
          toast({
            title: '🎉 Token Earned!',
            description: `You earned ${data.tokensAwarded} CFSMS token${data.tokensAwarded > 1 ? 's' : ''}!`,
          });
        }

        setSession(data.session);
        await fetchTaskStatus();
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }

    setIsSubmitting(null);
  };

  const handleSignupComplete = () => {
    completeTask('signup', { method: 'website_visit' });
  };

  const handleFreeBitcoinRoll = () => {
    setFreeBitcoinOpen(true);
    // Open in new window since iframe won't work due to CORS
    window.open('https://freebitco.in/?r=11266035', '_blank', 'width=1000,height=700');
  };

  const confirmFreeBitcoinRoll = () => {
    completeTask('freebitcoin', { referral: '11266035' });
    setFreeBitcoinOpen(false);
  };

  const handleYoutubeWatch = () => {
    setYoutubeWatching(true);
    videoStartTimeRef.current = Date.now();
  };

  const handleYoutubeComplete = () => {
    const watchTime = videoStartTimeRef.current ? (Date.now() - videoStartTimeRef.current) / 1000 : 0;
    if (watchTime < 30) {
      toast({
        title: 'Watch Longer',
        description: 'Please watch at least 30 seconds of the video',
        variant: 'destructive'
      });
      return;
    }
    completeTask('youtube', { videoId: 'avFU7vFfdvY', watchTime: Math.floor(watchTime) });
    setYoutubeWatching(false);
    videoStartTimeRef.current = null;
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressToNextToken = session ? (session.captchasCompleted % TASKS_PER_TOKEN) : 0;
  const progressPercent = (progressToNextToken / TASKS_PER_TOKEN) * 100;

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Tasks Done</p>
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
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">To Next Token</p>
                  <p className="text-lg font-bold">{TASKS_PER_TOKEN - progressToNextToken}</p>
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
                {progressToNextToken} / {TASKS_PER_TOKEN}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </CardContent>
        </Card>

        {/* Tabs for Tasks and Leaderboard */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tasks' | 'leaderboard')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Pickaxe className="w-4 h-4" />
              Mining Tasks
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4 mt-6">
            {/* Task 1: Website Sign-up */}
            <Card className={`border-2 ${taskStatus.signup.completed ? 'border-green-500/30 bg-green-500/5' : 'border-primary/20'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${taskStatus.signup.completed ? 'bg-green-500/20' : 'bg-primary/10'}`}>
                      <Globe className={`w-6 h-6 ${taskStatus.signup.completed ? 'text-green-500' : 'text-primary'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        Website Sign-up
                        {taskStatus.signup.completed && (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Done
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Complete a website sign-up task</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">+1 Job</p>
                    <p className="text-xs text-muted-foreground">One-time</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {taskStatus.signup.completed ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    You've completed this task
                  </p>
                ) : (
                  <Button 
                    onClick={handleSignupComplete}
                    disabled={isSubmitting === 'signup'}
                    className="w-full"
                  >
                    {isSubmitting === 'signup' ? 'Processing...' : 'Complete Sign-up Task'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Task 2: FreeBitcoin Roll */}
            <Card className={`border-2 ${countdown.freebitcoin === 0 && !taskStatus.freebitcoin.completed ? 'border-orange-500/30' : 'border-muted'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${countdown.freebitcoin === 0 ? 'bg-orange-500/20' : 'bg-muted'}`}>
                      <Bitcoin className={`w-6 h-6 ${countdown.freebitcoin === 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        FreeBitcoin Roll
                        {countdown.freebitcoin > 0 && (
                          <Badge variant="secondary" className="bg-muted">
                            <Timer className="w-3 h-3 mr-1" />
                            {formatCountdown(countdown.freebitcoin)}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Complete one roll per hour on FreeBitcoin</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">+1 Job</p>
                    <p className="text-xs text-muted-foreground">Hourly</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {freeBitcoinOpen ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Complete your roll in the opened window, then confirm below.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={confirmFreeBitcoinRoll}
                        disabled={isSubmitting === 'freebitcoin'}
                        className="flex-1"
                      >
                        {isSubmitting === 'freebitcoin' ? 'Verifying...' : 'Confirm Roll Completed'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setFreeBitcoinOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : countdown.freebitcoin > 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Next roll available in {formatCountdown(countdown.freebitcoin)}
                  </p>
                ) : (
                  <Button 
                    onClick={handleFreeBitcoinRoll}
                    variant="outline"
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open FreeBitcoin & Roll
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Task 3: YouTube Watch */}
            <Card className={`border-2 ${countdown.youtube === 0 ? 'border-red-500/30' : 'border-muted'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${countdown.youtube === 0 ? 'bg-red-500/20' : 'bg-muted'}`}>
                      <Youtube className={`w-6 h-6 ${countdown.youtube === 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        Watch YouTube Video
                        {countdown.youtube > 0 && (
                          <Badge variant="secondary" className="bg-muted">
                            <Timer className="w-3 h-3 mr-1" />
                            {formatCountdown(countdown.youtube)}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Watch videos to earn (once per hour)</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">+1 Job</p>
                    <p className="text-xs text-muted-foreground">Hourly</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {youtubeWatching ? (
                  <div className="space-y-4">
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                      <iframe
                        ref={youtubeRef}
                        width="100%"
                        height="100%"
                        src="https://www.youtube.com/embed/avFU7vFfdvY?autoplay=1&rel=0"
                        title="CFSMS Watch to Earn Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Watch for at least 30 seconds to earn. Available once per hour.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleYoutubeComplete}
                        disabled={isSubmitting === 'youtube'}
                        className="flex-1"
                      >
                        {isSubmitting === 'youtube' ? 'Verifying...' : 'Complete - I Watched the Video'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setYoutubeWatching(false);
                          videoStartTimeRef.current = null;
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : countdown.youtube > 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-4">
                    {/* Circular countdown timer */}
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 56}
                          strokeDashoffset={2 * Math.PI * 56 * (1 - countdown.youtube / 3600)}
                          className="text-primary transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Timer className="w-5 h-5 text-primary mb-1" />
                        <span className="text-2xl font-bold font-mono">{formatCountdown(countdown.youtube)}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Next video available in</p>
                      <p className="text-xs text-muted-foreground">You can watch once per hour</p>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={handleYoutubeWatch}
                    variant="outline"
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Watching Video
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info Box */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  <strong>How it works:</strong> Complete tasks to earn progress. Every {TASKS_PER_TOKEN} tasks = 1 CFSMS token. 
                  FreeBitcoin rolls and YouTube watches can be done once per hour.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Mining Leaderboard
                </CardTitle>
                <CardDescription>Top miners by tokens earned</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No miners yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.rank}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          entry.is_current_user ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                        }`}
                      >
                        <div className="w-8 text-center">
                          {entry.rank === 1 ? (
                            <Crown className="w-6 h-6 text-yellow-500 mx-auto" />
                          ) : entry.rank === 2 ? (
                            <Medal className="w-6 h-6 text-gray-400 mx-auto" />
                          ) : entry.rank === 3 ? (
                            <Medal className="w-6 h-6 text-amber-600 mx-auto" />
                          ) : (
                            <span className="text-lg font-bold text-muted-foreground">
                              {entry.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium flex items-center gap-1">
                            @{entry.username}
                            {entry.is_verified && <VerifiedBadge size="sm" />}
                            {entry.is_current_user && (
                              <span className="text-xs text-primary ml-1">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.captchas_completed.toLocaleString()} tasks completed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            {Number(entry.tokens_earned).toLocaleString()}
                          </p>
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
