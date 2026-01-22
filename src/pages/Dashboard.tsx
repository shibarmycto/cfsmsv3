import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Send,
  Upload,
  CreditCard,
  History,
  Settings,
  LogOut,
  Zap,
  Users,
  Shield,
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
    }
  }, [user]);

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

  const handleSendSms = async () => {
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

    if ((profile?.sms_credits || 0) < creditsNeeded) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${creditsNeeded} credits but only have ${profile?.sms_credits || 0}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          recipients: recipientList,
          message,
          senderId,
          destination,
        },
      });

      if (error) throw error;

      toast({
        title: 'SMS Sent!',
        description: `Successfully sent ${data.sent} messages.`,
      });

      setRecipients('');
      setMessage('');
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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">CFSMS</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="stat-card py-2 px-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-semibold">{profile?.sms_credits || 0}</span>
                <span className="text-muted-foreground text-sm">credits</span>
              </div>
            </div>
            
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate('/admin')}>
                <Shield className="w-4 h-4" />
                Admin
              </Button>
            )}
            
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass-card p-4 space-y-2">
              {[
                { id: 'send', icon: Send, label: 'Send SMS' },
                { id: 'history', icon: History, label: 'History' },
                { id: 'buy', icon: CreditCard, label: 'Buy Credits' },
                { id: 'settings', icon: Settings, label: 'Settings' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'send' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-2">Send SMS</h2>
                <p className="text-muted-foreground mb-6">
                  Send messages using Twilio's messaging API. Phone numbers must be in E.164 format.
                </p>
                
                <div className="space-y-6">
                  {/* From (Twilio Phone Number - Read Only Info) */}
                  <div className="space-y-2">
                    <Label htmlFor="from">From</Label>
                    <div className="bg-secondary/30 border border-border rounded-md px-4 py-3 text-muted-foreground">
                      <span className="font-mono">Your Twilio Phone Number</span>
                      <p className="text-xs mt-1">Configured in your backend settings</p>
                    </div>
                  </div>

                  {/* To (Recipients) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="to">To</Label>
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
                    <Textarea
                      id="to"
                      value={recipients}
                      onChange={(e) => setRecipients(e.target.value)}
                      placeholder="Enter phone numbers in E.164 format (one per line)&#10;+14155552671&#10;+447700900123&#10;+33612345678"
                      className="bg-secondary/50 min-h-[140px] font-mono text-sm"
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{recipients.split('\n').filter(r => r.trim()).length} recipient(s)</span>
                      <span className="text-xs">E.164 format: +[country code][number]</span>
                    </div>
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
                    onClick={handleSendSms}
                    disabled={isSending || recipients.split('\n').filter(r => r.trim()).length === 0 || !message.trim()}
                  >
                    {isSending ? 'Sending...' : 'Send Message'}
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
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

            {activeTab === 'buy' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-6">Buy Credits</h2>
                
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-secondary/30 rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🇬🇧</span>
                      <div>
                        <h3 className="font-bold">UK Credits</h3>
                        <p className="text-sm text-muted-foreground">£100 = 100 SMS</p>
                      </div>
                    </div>
                    <p className="text-4xl font-bold mb-4">£1<span className="text-lg text-muted-foreground">/SMS</span></p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🇺🇸</span>
                      <div>
                        <h3 className="font-bold">USA Credits</h3>
                        <p className="text-sm text-muted-foreground">$100 = 100 SMS</p>
                      </div>
                    </div>
                    <p className="text-4xl font-bold mb-4">$1<span className="text-lg text-muted-foreground">/SMS</span></p>
                  </div>
                </div>

                <div className="bg-secondary/20 rounded-xl p-6 border border-border">
                  <h3 className="font-bold mb-4">Payment Methods</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['Bitcoin', 'Ethereum', 'USDT', 'PayPal'].map((method) => (
                      <div key={method} className="bg-secondary/50 rounded-lg p-4 text-center">
                        <p className="font-medium">{method}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Contact support to purchase credits. Payments are verified manually and credits are added within 24 hours.
                  </p>
                </div>
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
                      <p><span className="text-muted-foreground">Default Sender ID:</span> {profile?.default_sender_id}</p>
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
