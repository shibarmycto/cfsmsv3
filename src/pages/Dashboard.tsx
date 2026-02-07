import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import BuyCreditsTab from '@/components/BuyCreditsTab';
import IPhoneMessagePreview from '@/components/IPhoneMessagePreview';
import SendingOverlay from '@/components/SendingOverlay';
import AIAgentTab from '@/components/AIAgentTab';
import UserVMRental from '@/components/UserVMRental';
import SolanaSignalsDashboard from '@/components/SolanaSignalsDashboard';
import { Switch } from '@/components/ui/switch';
import { formatPhoneNumbers } from '@/lib/phoneUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Upload,
  CreditCard,
  History,
  Settings,
  LogOut,
  Zap,
  Shield,
  Sparkles,
  Link,
  Mail,
  Trash2,
  Bot,
  Coins,
  Pickaxe,
  TrendingUp,
  PlusCircle,
  Gamepad2,
  Monitor,
} from 'lucide-react';

interface SmsLog {
  id: string;
  recipient: string;
  message: string;
  status: string;
  created_at: string;
  destination: string;
}

export default function Dashboard() {
  const { user, profile, isAdmin, signOut, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('send');
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [destination, setDestination] = useState<'uk' | 'usa'>('uk');
  const [senderId, setSenderId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [customSenderId, setCustomSenderId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [useCustomSenderId, setUseCustomSenderId] = useState(true);
  const [formatStats, setFormatStats] = useState<{ valid: number; invalid: number; countries: Record<string, number> } | null>(null);
  const [urlRequest, setUrlRequest] = useState('');
  const [urlDescription, setUrlDescription] = useState('');
  const [urlRequests, setUrlRequests] = useState<any[]>([]);
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
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
    if (profile) {
      setSenderId(profile.default_sender_id || 'CFSMS');
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchSmsLogs();
      fetchUrlRequests();
      fetchApprovedSenderIds();
      fetchSenderIdRequests();
    }
  }, [user]);

  const fetchApprovedSenderIds = async () => {
    if (!user) return;
    
    // Get ALL approved sender IDs that are NOT 'CFSMS'
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
      // Set the first one as default if none selected
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
    
    if (data) {
      setSenderIdRequests(data);
    }
  };

  const handleDeleteSenderId = async (requestId: string, senderId: string) => {
    setIsDeletingSenderId(requestId);
    
    const { error } = await supabase
      .from('sender_id_requests')
      .delete()
      .eq('id', requestId);
    
    setIsDeletingSenderId(null);
    
    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete sender ID.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sender ID Deleted',
        description: `"${senderId}" has been removed.`,
      });
      fetchApprovedSenderIds();
      fetchSenderIdRequests();
    }
  };

  const fetchUrlRequests = async () => {
    const { data } = await supabase
      .from('url_whitelist_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUrlRequests(data);
    }
  };

  const fetchSmsLogs = async () => {
    const { data } = await supabase
      .from('sms_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setSmsLogs(data as SmsLog[]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const numbers = lines.map(line => {
        const parts = line.split(',');
        return parts[0].trim().replace(/[^0-9+]/g, '');
      }).filter(num => num.length >= 10);
      
      setRecipients(numbers.join('\n'));
      toast({
        title: 'File Uploaded',
        description: `Loaded ${numbers.length} phone numbers.`,
      });
    };
    reader.readAsText(file);
  };

  const maxRecipients = isAdmin ? 100 : 30;

  const handlePreviewSms = () => {
    if (!recipients.trim() || !message.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter recipients and a message.',
        variant: 'destructive',
      });
      return;
    }

    const recipientList = recipients.split('\n').filter(r => r.trim());
    const creditsNeeded = recipientList.length;

    // Check recipient limit
    if (recipientList.length > maxRecipients) {
      toast({
        title: 'Recipient Limit Exceeded',
        description: `Maximum ${maxRecipients} recipients allowed per send.${!isAdmin ? ' Contact admin for higher limits.' : ''}`,
        variant: 'destructive',
      });
      return;
    }

    if ((profile?.sms_credits || 0) < creditsNeeded) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${creditsNeeded} credits but only have ${profile?.sms_credits || 0}.`,
        variant: 'destructive',
      });
      return;
    }

    // Show the preview modal
    setShowPreview(true);
  };

  // Check if user has valid approved custom sender IDs
  const hasApprovedCustomSenderId = approvedSenderIds.length > 0 && !!selectedSenderId;

  const handleConfirmSend = async () => {
    const recipientList = recipients.split('\n').filter(r => r.trim());
    
    // Only use custom sender ID if user has an approved one AND toggle is on
    const shouldUseCustomSender = useCustomSenderId && hasApprovedCustomSenderId;
    const effectiveSenderId = shouldUseCustomSender ? selectedSenderId : '';
    
    setShowPreview(false);
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          recipients: recipientList,
          message,
          senderId: effectiveSenderId,
          destination,
          useCustomSender: shouldUseCustomSender,
        },
      });

      if (error) throw error;

      toast({
        title: 'SMS Sent!',
        description: `Successfully sent ${data.sent} messages via CF SMS.`,
      });

      setRecipients('');
      setMessage('');
      setShowPreview(false);
      refreshProfile();
      fetchSmsLogs();
    } catch (err: any) {
      toast({
        title: 'Send Failed',
        description: err.message || 'Failed to send SMS. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRequestSenderId = async () => {
    if (!customSenderId.trim() || customSenderId.length > 11) {
      toast({
        title: 'Invalid Sender ID',
        description: 'Sender ID must be 1-11 characters.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('sender_id_requests').insert({
      user_id: user?.id,
      sender_id: customSenderId,
    });

    if (error) {
      toast({
        title: 'Request Failed',
        description: 'Could not submit request. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Request Submitted',
        description: 'Your sender ID request is pending approval.',
      });
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
      {/* Sending Overlay */}
      {isSending && (
        <SendingOverlay recipientCount={recipients.split('\n').filter(r => r.trim()).length} />
      )}
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-3 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <span className="text-lg md:text-xl font-bold text-primary">CFSMS</span>
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
          {/* Mobile Tab Bar */}
          <div className="lg:col-span-1">
            <div className="grid grid-cols-5 lg:flex lg:flex-col gap-1 lg:gap-2 bg-card/50 lg:bg-transparent rounded-lg lg:rounded-none p-2 lg:p-4 border border-border lg:border-border/50">
              {[
                { id: 'send', icon: Send, label: 'Send' },
                { id: 'ai-agent', icon: Bot, label: 'AI' },
                { id: 'cfgpt', icon: Sparkles, label: 'CFGPT', isExternal: true, href: 'https://cfgpt.org/' },
                { id: 'forum', icon: MessageSquare, label: 'Forum', isLink: true, href: '/forum' },
                { id: 'exchange', icon: TrendingUp, label: 'Exchange', isLink: true, href: '/exchange' },
                { id: 'create-coin', icon: PlusCircle, label: 'Coin', isLink: true, href: '/exchange?tab=create' },
                { id: 'signals', icon: Zap, label: 'Signals' },
                { id: 'vm', icon: Monitor, label: 'VM' },
                { id: 'history', icon: History, label: 'History' },
                { id: 'buy', icon: CreditCard, label: 'Buy' },
                { id: 'bank', icon: Coins, label: 'Bank', isLink: true, href: '/bank' },
                { id: 'miner', icon: Pickaxe, label: 'Miner', isLink: true, href: '/miner' },
                { id: 'roleplay', icon: Gamepad2, label: 'RP', isLink: true, href: '/roleplay' },
                { id: 'urls', icon: Link, label: 'URLs' },
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
            {activeTab === 'send' && (
              <div className="bg-card/50 border border-border rounded-lg p-4 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Send SMS</h2>
                <p className="text-muted-foreground text-sm md:text-base mb-4 md:mb-6">
                  Paste numbers below - we auto-format them.
                </p>
                
                <div className="space-y-6">
                  {/* From (Sender ID) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="from">From</Label>
                      {/* Only show toggle if user has an approved custom sender ID */}
                      {hasApprovedCustomSenderId && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Custom Sender ID
                          </span>
                          <Switch
                            checked={useCustomSenderId}
                            onCheckedChange={setUseCustomSenderId}
                          />
                        </div>
                      )}
                    </div>
                    <div className="bg-secondary/30 border border-border rounded-md px-4 py-3">
                      {/* Only show custom sender if toggle is on AND user has approved sender ID */}
                      {useCustomSenderId && hasApprovedCustomSenderId ? (
                        <>
                          <Select value={selectedSenderId} onValueChange={setSelectedSenderId}>
                            <SelectTrigger className="w-full bg-background border border-border rounded-md px-3 py-2 h-auto font-mono text-primary font-semibold">
                              <SelectValue placeholder="Select Sender ID" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border z-50">
                              {approvedSenderIds.map((id) => (
                                <SelectItem key={id} value={id} className="font-mono">
                                  {id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-2">
                            {approvedSenderIds.length > 1 
                              ? `You have ${approvedSenderIds.length} approved sender IDs` 
                              : 'Using your approved custom sender ID'}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-muted-foreground">
                            Default Device Number
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Messages sent from CF SMS default number
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* To (Recipients) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="to">To</Label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (recipients.trim()) {
                              const result = formatPhoneNumbers(recipients);
                              setRecipients(result.formatted);
                              setFormatStats(result.stats);
                              toast({
                                title: 'Numbers Formatted',
                                description: `${result.stats.valid} valid, ${result.stats.invalid} invalid numbers detected.`,
                              });
                            }
                          }}
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Sparkles className="w-4 h-4" />
                          Auto-Format
                        </button>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <span className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Upload className="w-4 h-4" />
                            Upload CSV
                          </span>
                        </label>
                      </div>
                    </div>
                    <Textarea
                      id="to"
                      value={recipients}
                      onChange={(e) => {
                        setRecipients(e.target.value);
                        setFormatStats(null);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        const result = formatPhoneNumbers(pastedText);
                        setRecipients(prev => {
                          const newValue = prev ? `${prev}\n${result.formatted}` : result.formatted;
                          return newValue;
                        });
                        setFormatStats(result.stats);
                        toast({
                          title: 'Numbers Auto-Formatted',
                          description: `${result.stats.valid} valid numbers detected.`,
                        });
                      }}
                      placeholder="Paste phone numbers here..."
                      className="bg-secondary/50 min-h-[100px] md:min-h-[140px] font-mono text-sm touch-manipulation"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className={recipients.split('\n').filter(r => r.trim()).length > maxRecipients ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                        {recipients.split('\n').filter(r => r.trim()).length} / {maxRecipients} recipient(s)
                      </span>
                      {formatStats && formatStats.valid > 0 ? (
                        <span className="text-xs text-primary">
                          ✓ {Object.entries(formatStats.countries).map(([country, count]) => `${count} ${country}`).join(', ')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Paste numbers - auto-format on paste</span>
                      )}
                    </div>
                    {formatStats && formatStats.invalid > 0 && (
                      <p className="text-xs text-warning">
                        ⚠ {formatStats.invalid} number(s) couldn't be auto-formatted. Please check they start with + and country code.
                      </p>
                    )}
                  </div>

                  {/* Body (Message) */}
                  <div className="space-y-2">
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                      id="body"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your message content..."
                      className="bg-secondary/50 min-h-[120px]"
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{message.length} characters</span>
                      <span className="text-xs">
                        {message.length <= 160 
                          ? '1 SMS segment' 
                          : `${Math.ceil(message.length / 153)} SMS segments`}
                      </span>
                    </div>
                  </div>

                  {/* Message Info Card */}
                  <div className="bg-secondary/20 rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium mb-2">Message Preview</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Recipients:</span>
                        <span className="ml-2 font-medium">{recipients.split('\n').filter(r => r.trim()).length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credits needed:</span>
                        <span className="ml-2 font-medium">{recipients.split('\n').filter(r => r.trim()).length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Your balance:</span>
                        <span className="ml-2 font-medium">{profile?.sms_credits || 0} credits</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Segments:</span>
                        <span className="ml-2 font-medium">
                          {message.length <= 160 ? 1 : Math.ceil(message.length / 153)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={handlePreviewSms}
                    disabled={isSending || recipients.split('\n').filter(r => r.trim()).length === 0 || !message.trim()}
                  >
                    Preview & Send
                    <Send className="w-5 h-5" />
                  </Button>
                </div>

                {/* iPhone Message Preview Modal */}
                {showPreview && (
                  <IPhoneMessagePreview
                    senderId={useCustomSenderId && hasApprovedCustomSenderId ? selectedSenderId : 'Unknown Number'}
                    message={message}
                    recipientCount={recipients.split('\n').filter(r => r.trim()).length}
                    onConfirm={handleConfirmSend}
                    onCancel={() => setShowPreview(false)}
                    isLoading={isSending}
                  />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-6">SMS History</h2>
                
                {smsLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages sent yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {smsLogs.map((log) => (
                      <div key={log.id} className="bg-secondary/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm">{log.recipient}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            log.status === 'sent' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                          }`}>
                            {log.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{log.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai-agent' && (
              <AIAgentTab user={user} toast={toast} />
            )}

            {activeTab === 'buy' && (
              <BuyCreditsTab user={user} toast={toast} />
            )}

            {activeTab === 'urls' && (
              <div className="bg-card/50 border border-border rounded-lg p-4 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold mb-1">Request URL Whitelist</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Submit URLs for whitelisting approval
                </p>

                {/* Submit Form */}
                <div className="space-y-4 mb-8">
                  <div>
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={urlRequest}
                      onChange={(e) => setUrlRequest(e.target.value)}
                      placeholder="https://example.com"
                      className="bg-secondary/50 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={urlDescription}
                      onChange={(e) => setUrlDescription(e.target.value)}
                      placeholder="Why do you need this URL whitelisted?"
                      className="bg-secondary/50 mt-1 min-h-[80px]"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!urlRequest.trim()) {
                        toast({
                          title: 'Missing URL',
                          description: 'Please enter a URL to request.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setIsSubmittingUrl(true);
                      const { error } = await supabase.from('url_whitelist_requests').insert({
                        user_id: user?.id,
                        url: urlRequest.trim(),
                        description: urlDescription.trim() || null,
                      });
                      setIsSubmittingUrl(false);
                      if (error) {
                        toast({
                          title: 'Request Failed',
                          description: 'Could not submit URL request.',
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: 'Request Submitted',
                          description: 'Your URL whitelist request is pending approval.',
                        });
                        setUrlRequest('');
                        setUrlDescription('');
                        fetchUrlRequests();
                      }
                    }}
                    disabled={isSubmittingUrl}
                    className="w-full md:w-auto"
                  >
                    {isSubmittingUrl ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>

                {/* Previous Requests */}
                <div>
                  <h3 className="font-semibold mb-4">Your Requests</h3>
                  {urlRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Link className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No URL requests yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {urlRequests.map((req) => (
                        <div key={req.id} className="bg-secondary/30 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm text-primary truncate">{req.url}</p>
                              {req.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{req.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(req.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                              req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                              req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="glass-card p-8 animate-fade-in text-center">
                <div className="max-w-md mx-auto space-y-6">
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <Coins className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">CFSMS Digital Bank</h2>
                    <p className="text-muted-foreground">
                      Access your CFSMS token wallet, send tokens to friends, chat, and mine tokens.
                    </p>
                  </div>
                  <Button onClick={() => navigate('/bank')} size="lg" className="w-full">
                    <Coins className="w-4 h-4 mr-2" />
                    Open CFSMS Bank
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'vm' && (
              <div className="glass-card p-8 animate-fade-in">
                <UserVMRental />
              </div>
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
                      <p><span className="text-muted-foreground">Credits:</span> {profile?.sms_credits}</p>
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
                      <Button onClick={handleRequestSenderId}>
                        Request
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Sender IDs must be 1-11 alphanumeric characters. Approval typically takes 24 hours.
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
                          <a 
                            href="mailto:customercare@cfsmsbulk.com" 
                            className="text-primary hover:underline font-medium"
                          >
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
