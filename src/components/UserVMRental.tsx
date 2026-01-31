import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Terminal, 
  Monitor, 
  Globe, 
  Clock, 
  Coins,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  Home,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface VMRental {
  id: string;
  plan_type: string;
  credits_paid: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  time_remaining_seconds: number | null;
}

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
  content: string;
}

const PLANS = [
  { type: '24h', credits: 30, label: '24 Hours', description: 'Full VM access for 24 hours' },
  { type: '7d', credits: 100, label: '7 Days', description: 'Save £110 with weekly access' }
];

export default function UserVMRental() {
  const { user, profile } = useAuth();
  const [activeRental, setActiveRental] = useState<VMRental | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState('terminal');
  
  // Terminal state
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<TerminalLine[]>([
    { id: 1, type: 'info', content: '╔═══════════════════════════════════════════════════════════════╗' },
    { id: 2, type: 'info', content: '║        CF USER VIRTUAL MACHINE - Ubuntu 22.04 LTS             ║' },
    { id: 3, type: 'info', content: '╚═══════════════════════════════════════════════════════════════╝' },
    { id: 4, type: 'success', content: 'VM ready. Type "help" for commands.' },
  ]);
  const [currentPath, setCurrentPath] = useState('/home/user');

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('https://www.google.com');
  const [browserHistory, setBrowserHistory] = useState<string[]>(['https://www.google.com']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  // Fetch wallet balance
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchActiveRental();
      fetchWalletBalance();
    }
  }, [user]);

  useEffect(() => {
    if (!activeRental?.is_active) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(activeRental.expires_at).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setActiveRental(prev => prev ? { ...prev, is_active: false } : null);
        toast.error('Your VM session has expired');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRental]);

  const fetchActiveRental = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('vm_rentals')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveRental(data as VMRental);
        const now = new Date().getTime();
        const expires = new Date(data.expires_at).getTime();
        setTimeRemaining(Math.max(0, Math.floor((expires - now) / 1000)));
      }
    } catch (error) {
      console.error('Error fetching rental:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (data) {
      setWalletBalance(data.balance);
    }
  };

  const purchasePlan = async (planType: string, credits: number) => {
    if (walletBalance < credits) {
      toast.error(`Insufficient balance. Need ${credits} credits, have ${walletBalance}`);
      return;
    }

    setPurchasing(true);
    try {
      // Deduct credits from wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          balance: walletBalance - credits,
          total_sent: walletBalance + credits
        })
        .eq('user_id', user?.id);

      if (walletError) throw walletError;

      // Calculate expiry
      const now = new Date();
      const expiresAt = new Date(now);
      if (planType === '24h') {
        expiresAt.setHours(expiresAt.getHours() + 24);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 7);
      }

      // Create rental
      const { data: rental, error: rentalError } = await supabase
        .from('vm_rentals')
        .insert({
          user_id: user?.id,
          plan_type: planType,
          credits_paid: credits,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (rentalError) throw rentalError;

      setActiveRental(rental as VMRental);
      setWalletBalance(prev => prev - credits);
      toast.success(`VM activated! Expires in ${planType === '24h' ? '24 hours' : '7 days'}`);
    } catch (error) {
      console.error('Error purchasing plan:', error);
      toast.error('Failed to purchase VM access');
    } finally {
      setPurchasing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addLine = (type: TerminalLine['type'], content: string) => {
    setHistory(prev => [...prev, { id: prev.length + 1, type, content }]);
  };

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    const parts = trimmedCmd.split(' ');
    const mainCmd = parts[0];

    addLine('input', `${currentPath}$ ${cmd}`);

    switch (mainCmd) {
      case 'help':
        addLine('output', `
Available Commands:
  ls, pwd, cd, cat, mkdir, rm, clear
  neofetch, htop, df -h, free -m
  browser - Open web browser
  exit - Exit terminal
`);
        break;
      case 'clear':
        setHistory([]);
        break;
      case 'ls':
        addLine('output', '📁 Documents\n📁 Downloads\n📁 Projects\n📄 readme.txt');
        break;
      case 'pwd':
        addLine('output', currentPath);
        break;
      case 'browser':
        setShowBrowser(true);
        setActiveTab('browser');
        addLine('success', 'Opening web browser...');
        break;
      case 'neofetch':
        addLine('output', `
       .-/+oossssoo+/-.              user@cf-vm
    \`:+ssssssssssssssssss+:\`          ─────────────
  -+ssssssssssssssssssss+-           OS: Ubuntu 22.04 LTS
   -+sssssssssssssssss+-              Shell: bash 5.1.16
      \`:+ssssssss+:\`                   Terminal: CF User VM
         .-/+o+/-.                     Time Left: ${formatTime(timeRemaining)}
`);
        break;
      default:
        addLine('error', `Command not found: ${mainCmd}`);
    }
    setCommand('');
  };

  const navigateTo = (url: string) => {
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.')) {
        finalUrl = 'https://' + url;
      } else {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    setBrowserUrl(finalUrl);
    const newHistory = [...browserHistory.slice(0, historyIndex + 1), finalUrl];
    setBrowserHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setBrowserUrl(browserHistory[historyIndex - 1]);
    }
  };

  const goForward = () => {
    if (historyIndex < browserHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setBrowserUrl(browserHistory[historyIndex + 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Purchase screen if no active rental
  if (!activeRental || !activeRental.is_active) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Virtual Machine Rental</h2>
          <p className="text-gray-400">Get your own Ubuntu VM with web browsing capabilities</p>
        </div>

        {/* Balance */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-white/10 text-center">
          <p className="text-sm text-gray-400 mb-1">Your Balance</p>
          <p className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <Coins className="w-6 h-6" />
            {walletBalance.toLocaleString()} Credits
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6">
          {PLANS.map((plan) => (
            <div 
              key={plan.type}
              className={`bg-gray-800/50 rounded-2xl p-6 border transition-all ${
                plan.type === '7d' 
                  ? 'border-primary shadow-lg shadow-primary/20' 
                  : 'border-white/10'
              }`}
            >
              {plan.type === '7d' && (
                <div className="text-xs text-primary font-bold mb-2 uppercase">Best Value</div>
              )}
              <h3 className="text-xl font-bold text-white mb-2">{plan.label}</h3>
              <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
              
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{plan.credits}</span>
                <span className="text-gray-400">credits</span>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2 text-gray-300">
                  <Terminal className="w-4 h-4 text-green-400" />
                  Full Ubuntu Terminal
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <Globe className="w-4 h-4 text-blue-400" />
                  Web Browser Access
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  Live Timer Display
                </li>
              </ul>

              <Button
                className="w-full"
                variant={plan.type === '7d' ? 'default' : 'outline'}
                disabled={purchasing || walletBalance < plan.credits}
                onClick={() => purchasePlan(plan.type, plan.credits)}
              >
                {walletBalance < plan.credits ? 'Insufficient Credits' : 'Start Now'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active VM session
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gray-950' : ''}`}>
      {/* Timer Bar */}
      <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border border-cyan-500/30 rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Clock className="w-6 h-6 text-cyan-400 animate-pulse" />
          <div>
            <p className="text-sm text-gray-400">Time Remaining</p>
            <p className="text-2xl font-mono font-bold text-white">{formatTime(timeRemaining)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            timeRemaining > 3600 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {activeRental.plan_type === '24h' ? '24-Hour Plan' : '7-Day Plan'}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* VM Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-100px)]">
        <TabsList className="w-full justify-start rounded-none bg-gray-800/50 border-b border-white/5 p-0 h-auto mb-0">
          <TabsTrigger value="terminal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 py-3 px-4 gap-2">
            <Terminal className="w-4 h-4" />
            Terminal
          </TabsTrigger>
          <TabsTrigger value="browser" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 py-3 px-4 gap-2">
            <Globe className="w-4 h-4" />
            Browser
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terminal" className="h-[500px] m-0 p-0">
          <div className="h-full bg-gray-950 flex flex-col rounded-b-xl overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="font-mono text-sm space-y-1">
                {history.map((line) => (
                  <div 
                    key={line.id} 
                    className={`whitespace-pre-wrap ${
                      line.type === 'input' ? 'text-cyan-400' :
                      line.type === 'error' ? 'text-red-400' :
                      line.type === 'success' ? 'text-green-400' :
                      line.type === 'info' ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-white/10 p-4 bg-gray-900/50">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-green-400">user@cf-vm</span>
                <span className="text-gray-500">:</span>
                <span className="text-blue-400">{currentPath}</span>
                <span className="text-gray-500">$</span>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && command.trim() && executeCommand(command)}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 p-0 h-auto text-white font-mono"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="browser" className="h-[500px] m-0 p-0">
          <div className="h-full bg-white rounded-b-xl overflow-hidden flex flex-col">
            {/* Browser Chrome */}
            <div className="bg-gray-200 p-2 flex items-center gap-2 border-b border-gray-300">
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goBack} disabled={historyIndex === 0}>
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goForward} disabled={historyIndex === browserHistory.length - 1}>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigateTo('https://www.google.com')}>
                  <Home className="w-4 h-4 text-gray-600" />
                </Button>
              </div>

              <div className="flex-1 flex items-center bg-white rounded-full px-4 py-1 border border-gray-300">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && navigateTo(browserUrl)}
                  className="flex-1 text-sm text-gray-800 outline-none"
                  placeholder="Search or enter URL"
                />
              </div>

              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7"
                onClick={() => setActiveTab('terminal')}
              >
                <X className="w-4 h-4 text-gray-600" />
              </Button>
            </div>

            {/* Browser Content */}
            <div className="flex-1 relative">
              <iframe
                src={browserUrl}
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                title="Browser"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
