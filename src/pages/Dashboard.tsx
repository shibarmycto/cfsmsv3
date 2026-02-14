import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import BuyCreditsTab from '@/components/BuyCreditsTab';
import AIAgentTab from '@/components/AIAgentTab';
import SolanaSignalsDashboard from '@/components/SolanaSignalsDashboard';
import PlatformInfoTab from '@/components/PlatformInfoTab';
import {
  MessageSquare,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  Shield,
  Sparkles,
  Mail,
  Trash2,
  Bot,
  Coins,
  Pickaxe,
  TrendingUp,
  PlusCircle,
  Gamepad2,
  Info,
  Users,
} from 'lucide-react';

export default function Dashboard() {
  const { user, profile, isAdmin, signOut, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('info');
  const [customSenderId, setCustomSenderId] = useState('');
  const [approvedSenderIds, setApprovedSenderIds] = useState<string[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [senderIdRequests, setSenderIdRequests] = useState<any[]>([]);
  const [isDeletingSenderId, setIsDeletingSenderId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && profile && !profile.is_approved) {
      navigate('/auth');
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchApprovedSenderIds();
      fetchSenderIdRequests();
    }
  }, [user]);

  const fetchApprovedSenderIds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sender_id_requests')
      .select('sender_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .neq('sender_id', 'CFSMS')
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      const senderIds = data.map(d => d.sender_id);
      setApprovedSenderIds(senderIds);
      if (!selectedSenderId || !senderIds.includes(selectedSenderId)) {
        setSelectedSenderId(senderIds[0]);
      }
    } else {
      setApprovedSenderIds([]);
      setSelectedSenderId('');
    }
  };

  const fetchSenderIdRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sender_id_requests')
      .select('*')
      .eq('user_id', user.id)
      .neq('sender_id', 'CFSMS')
      .order('created_at', { ascending: false });
    if (data) setSenderIdRequests(data);
  };

  const handleDeleteSenderId = async (requestId: string, senderId: string) => {
    setIsDeletingSenderId(requestId);
    const { error } = await supabase.from('sender_id_requests').delete().eq('id', requestId);
    setIsDeletingSenderId(null);
    if (error) {
      toast({ title: 'Delete Failed', description: 'Could not delete sender ID.', variant: 'destructive' });
    } else {
      toast({ title: 'Sender ID Deleted', description: `"${senderId}" has been removed.` });
      fetchApprovedSenderIds();
      fetchSenderIdRequests();
    }
  };

  const handleRequestSenderId = async () => {
    if (!customSenderId.trim() || customSenderId.length > 11) {
      toast({ title: 'Invalid Sender ID', description: 'Sender ID must be 1-11 characters.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('sender_id_requests').insert({ user_id: user?.id, sender_id: customSenderId });
    if (error) {
      toast({ title: 'Request Failed', description: 'Could not submit request.', variant: 'destructive' });
    } else {
      toast({ title: 'Request Submitted', description: 'Your sender ID request is pending approval.' });
      setCustomSenderId('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="animate-pulse-glow w-16 h-16 rounded-2xl bg-primary/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-3 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <span className="text-lg md:text-xl font-bold text-primary">CF Network</span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="bg-secondary/50 border border-border rounded-lg py-1.5 px-2 md:py-2 md:px-4">
              <div className="flex items-center gap-1 md:gap-2">
                <Zap className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                <span className="font-semibold text-sm md:text-base">{profile?.sms_credits || 0}</span>
                <span className="text-muted-foreground text-xs md:text-sm hidden sm:inline">credits</span>
              </div>
            </div>
            
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="flex">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            
            <Button variant="ghost" size="sm" onClick={signOut} className="touch-manipulation">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 md:px-6 py-4 md:py-8">
        <div className="grid lg:grid-cols-4 gap-4 md:gap-8">
          {/* Tab Bar */}
          <div className="lg:col-span-1">
            <div className="grid grid-cols-5 lg:flex lg:flex-col gap-1 lg:gap-2 bg-card/50 lg:bg-transparent rounded-lg lg:rounded-none p-2 lg:p-4 border border-border lg:border-border/50">
              {[
                { id: 'info', icon: Info, label: 'Info' },
                { id: 'ai-agent', icon: Bot, label: 'AI' },
                { id: 'cfgpt', icon: Sparkles, label: 'CFGPT', isExternal: true, href: 'https://cfgpt.org/' },
                { id: 'forum', icon: MessageSquare, label: 'Forum', isLink: true, href: '/forum' },
                { id: 'exchange', icon: TrendingUp, label: 'Exchange', isLink: true, href: '/exchange' },
                { id: 'create-coin', icon: PlusCircle, label: 'Coin', isLink: true, href: '/exchange?tab=create' },
                { id: 'signals', icon: Zap, label: 'Signals' },
                { id: 'buy', icon: CreditCard, label: 'Buy' },
                { id: 'bank', icon: Coins, label: 'Bank', isLink: true, href: '/bank' },
                { id: 'miner', icon: Pickaxe, label: 'Miner', isLink: true, href: '/miner' },
                { id: 'roleplay', icon: Gamepad2, label: 'RP', isLink: true, href: '/roleplay' },
                { id: 'crm', icon: Users, label: 'CRM', isLink: true, href: '/crm' },
                { id: 'settings', icon: Settings, label: 'Settings' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if ('isExternal' in item && item.isExternal && 'href' in item) {
                      window.open(item.href as string, '_blank');
                    } else if ('isLink' in item && item.isLink && 'href' in item) {
                      navigate(item.href as string);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-2 px-2 py-2 lg:px-4 lg:py-3 rounded-lg transition-colors touch-manipulation ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 lg:bg-transparent text-muted-foreground active:bg-secondary'
                  }`}
                >
                  <item.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-base whitespace-nowrap">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'info' && (
              <PlatformInfoTab />
            )}

            {activeTab === 'ai-agent' && (
              <AIAgentTab user={user} toast={toast} />
            )}

            {activeTab === 'buy' && (
              <BuyCreditsTab user={user} toast={toast} />
            )}

            {activeTab === 'signals' && (
              <div className="glass-card p-8 animate-fade-in">
                <SolanaSignalsDashboard />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-6">Settings</h2>
                
                <div className="space-y-8">
                  {/* Account Info */}
                  <div>
                    <h3 className="font-semibold mb-4">Account Information</h3>
                    <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                      <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
                      <p><span className="text-muted-foreground">Name:</span> {profile?.full_name || 'Not set'}</p>
                      <p><span className="text-muted-foreground">Credits:</span> {profile?.sms_credits} ($1 = 1 credit)</p>
                      <p><span className="text-muted-foreground">Default Sender ID:</span> {profile?.default_sender_id || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Request Sender ID */}
                  <div>
                    <h3 className="font-semibold mb-4">Request Custom Sender ID</h3>
                    <div className="flex gap-4">
                      <Input
                        value={customSenderId}
                        onChange={(e) => setCustomSenderId(e.target.value.slice(0, 11))}
                        placeholder="YourBrand"
                        className="bg-secondary/50"
                        maxLength={11}
                      />
                      <Button onClick={handleRequestSenderId}>Request</Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Sender IDs must be 1-11 alphanumeric characters.
                    </p>
                  </div>

                  {/* Your Sender IDs */}
                  {senderIdRequests.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-4">Your Sender IDs</h3>
                      <div className="space-y-3">
                        {senderIdRequests.map((req) => (
                          <div key={req.id} className="bg-secondary/30 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-primary font-semibold">{req.sender_id}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSenderId(req.id, req.sender_id)}
                              disabled={isDeletingSenderId === req.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {isDeletingSenderId === req.id ? (
                                <span className="text-xs">Deleting...</span>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Help Section */}
                  <div>
                    <h3 className="font-semibold mb-4">Need Help?</h3>
                    <div className="bg-secondary/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Contact us at:</p>
                          <a href="mailto:customercare@cfsmsbulk.com" className="text-primary hover:underline font-medium">
                            customercare@cfsmsbulk.com
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
