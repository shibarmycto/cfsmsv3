import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Sparkles, 
  Upload, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Play,
  MessageSquare,
  Loader2,
  Wallet,
  Send,
  CalendarClock,
  Coins,
  Calendar,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { formatPhoneNumbers } from '@/lib/phoneUtils';
import { useNavigate } from 'react-router-dom';

interface AIAgentTabProps {
  user: User | null;
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  target_audience: string;
  message_template: string;
  recipients: string[];
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  admin_notes: string | null;
  whatsapp_number: string;
  days_requested: number;
  daily_cost: number;
  total_cost: number;
  destination: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  is_scheduled: boolean;
  scheduled_at: string | null;
}

interface CampaignLog {
  id: string;
  campaign_id: string;
  log_type: string;
  message: string;
  created_at: string;
}

const DAILY_COST = 25;

export default function AIAgentTab({ user, toast }: AIAgentTabProps) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState('create');
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<CampaignLog[]>([]);
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [optimizedMessage, setOptimizedMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [daysRequested, setDaysRequested] = useState(1);
  const [destination, setDestination] = useState('uk');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('09:00');

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from('ai_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) {
      setCampaigns(data as Campaign[]);
    }
  };

  const fetchCampaignLogs = async (campaignId: string) => {
    const { data } = await supabase
      .from('ai_campaign_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    
    if (data) {
      setCampaignLogs(data as CampaignLog[]);
    }
  };

  const handleOptimizeMessage = async () => {
    if (!messageTemplate.trim() || !targetAudience.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both message and target audience.',
        variant: 'destructive',
      });
      return;
    }

    setIsOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-campaign-agent', {
        body: {
          action: 'optimize',
          campaignData: {
            messageTemplate,
            targetAudience,
          },
        },
      });

      if (error) throw error;

      setOptimizedMessage(data.optimizedMessage);
      toast({
        title: 'Message Optimized',
        description: 'AI has optimized your message for better engagement.',
      });
    } catch (err: any) {
      toast({
        title: 'Optimization Failed',
        description: err.message || 'Failed to optimize message.',
        variant: 'destructive',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = formatPhoneNumbers(text);
      setRecipients(result.formatted);
      toast({
        title: 'File Uploaded',
        description: `Loaded ${result.stats.valid} phone numbers.`,
      });
    };
    reader.readAsText(file);
  };

  const handleCreateCampaign = async () => {
    const recipientList = recipients.split('\n').filter(r => r.trim());
    
    if (!campaignName.trim() || !targetAudience.trim() || !messageTemplate.trim() || recipientList.length === 0 || !whatsappNumber.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Validate WhatsApp number
    if (!whatsappNumber.startsWith('+')) {
      toast({
        title: 'Invalid WhatsApp Number',
        description: 'WhatsApp number must start with + and country code.',
        variant: 'destructive',
      });
      return;
    }

    // Calculate scheduled_at timestamp if scheduling
    let scheduledAt: string | null = null;
    if (isScheduled && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduled = new Date(scheduledDate);
      scheduled.setHours(hours, minutes, 0, 0);
      scheduledAt = scheduled.toISOString();
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-campaign-agent', {
        body: {
          action: 'create',
          campaignData: {
            name: campaignName,
            description,
            targetAudience,
            messageTemplate: optimizedMessage || messageTemplate,
            recipients: recipientList,
            whatsappNumber,
            daysRequested,
            destination,
            isScheduled,
            scheduledAt,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Campaign Created',
        description: 'Please complete payment to submit for admin approval.',
      });

      // Reset form
      setCampaignName('');
      setDescription('');
      setTargetAudience('');
      setMessageTemplate('');
      setOptimizedMessage('');
      setRecipients('');
      setWhatsappNumber('');
      setDaysRequested(1);
      setIsScheduled(false);
      setScheduledDate(undefined);
      setScheduledTime('09:00');
      
      fetchCampaigns();
      setActiveSubTab('campaigns');
    } catch (err: any) {
      toast({
        title: 'Creation Failed',
        description: err.message || 'Failed to create campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (campaign: Campaign, method: 'manual' | 'crypto' | 'credits') => {
    if (method === 'crypto') {
      // Navigate to crypto payment page with campaign info
      navigate(`/buy-crypto?type=campaign&campaignId=${campaign.id}&amount=${campaign.total_cost}`);
    } else if (method === 'credits') {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('pay-with-credits', {
          body: {
            campaignId: campaign.id,
            paymentType: 'credits',
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: 'Paid with CFSMS Credits!',
          description: `Used ${data.tokensUsed} tokens. Campaign submitted for approval.`,
        });

        fetchCampaigns();
      } catch (err: any) {
        toast({
          title: 'Payment Failed',
          description: err.message || 'Failed to process credit payment.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('process-campaign-payment', {
          body: {
            campaignId: campaign.id,
            paymentMethod: 'manual',
          },
        });

        if (error) throw error;

        // Update campaign status locally
        await supabase
          .from('ai_campaigns')
          .update({ status: 'pending_approval' })
          .eq('id', campaign.id);

        toast({
          title: 'Payment Request Submitted',
          description: 'Your payment request is pending admin approval.',
        });

        fetchCampaigns();
      } catch (err: any) {
        toast({
          title: 'Payment Failed',
          description: err.message || 'Failed to process payment.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      pending_payment: { variant: 'outline', icon: <CreditCard className="w-3 h-3" />, label: 'Awaiting Payment' },
      pending_approval: { variant: 'secondary', icon: <Clock className="w-3 h-3" />, label: 'Pending Approval' },
      approved: { variant: 'default', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
      scheduled: { variant: 'secondary', icon: <CalendarClock className="w-3 h-3" />, label: 'Scheduled' },
      running: { variant: 'default', icon: <Play className="w-3 h-3" />, label: 'Running' },
      completed: { variant: 'default', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      rejected: { variant: 'destructive', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
      cancelled: { variant: 'secondary', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, icon: <AlertCircle className="w-3 h-3" />, label: status };
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const totalCost = DAILY_COST * daysRequested;
  const recipientCount = recipients.split('\n').filter(r => r.trim()).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">CFSMS AI Agent</h2>
            <p className="text-sm text-muted-foreground">Automated SMS campaigns powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span>£{DAILY_COST}/day</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>AI-optimized messages</span>
          </div>
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            <span>WhatsApp updates</span>
          </div>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Campaign</TabsTrigger>
          <TabsTrigger value="campaigns">My Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                New AI Campaign
              </CardTitle>
              <CardDescription>
                Create an AI-powered SMS campaign. The AI will optimize your message for better engagement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name *</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Summer Sale 2024"
                  className="bg-secondary/50"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your campaign..."
                  className="bg-secondary/50 min-h-[80px]"
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience *</Label>
                <Input
                  id="targetAudience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Young professionals aged 25-35 interested in tech"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Describe your audience - the AI will optimize the message for them
                </p>
              </div>

              {/* Message Template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="messageTemplate">Message Template *</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOptimizeMessage}
                    disabled={isOptimizing || !messageTemplate.trim() || !targetAudience.trim()}
                    className="flex items-center gap-2"
                  >
                    {isOptimizing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Optimize with AI
                  </Button>
                </div>
                <Textarea
                  id="messageTemplate"
                  value={messageTemplate}
                  onChange={(e) => {
                    setMessageTemplate(e.target.value);
                    setOptimizedMessage('');
                  }}
                  placeholder="Enter your message here..."
                  className="bg-secondary/50 min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  {messageTemplate.length} characters • {messageTemplate.length <= 160 ? '1 segment' : `${Math.ceil(messageTemplate.length / 153)} segments`}
                </p>
              </div>

              {/* Optimized Message Preview */}
              {optimizedMessage && optimizedMessage !== messageTemplate && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">AI Optimized Message</span>
                  </div>
                  <p className="text-sm">{optimizedMessage}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {optimizedMessage.length} characters • This will be used for the campaign
                  </p>
                </div>
              )}

              {/* Recipients */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recipients">Recipients *</Label>
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
                  id="recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    const result = formatPhoneNumbers(pastedText);
                    setRecipients(result.formatted);
                    toast({
                      title: 'Numbers Auto-Formatted',
                      description: `${result.stats.valid} valid numbers detected.`,
                    });
                  }}
                  placeholder="Paste phone numbers here..."
                  className="bg-secondary/50 min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {recipientCount} recipient(s)
                </p>
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">Your WhatsApp Number *</Label>
                <Input
                  id="whatsappNumber"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+447123456789"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send campaign completion updates to this WhatsApp number (free)
                </p>
              </div>

              {/* Campaign Duration */}
              <div className="space-y-2">
                <Label htmlFor="days">Campaign Duration (days)</Label>
                <div className="flex items-center gap-4">
                  {[1, 3, 7, 14, 30].map((days) => (
                    <Button
                      key={days}
                      variant={daysRequested === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDaysRequested(days)}
                    >
                      {days} day{days > 1 ? 's' : ''}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Schedule Campaign */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schedule-toggle" className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4" />
                      Schedule for Later
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Set a specific date and time for your campaign to start
                    </p>
                  </div>
                  <Switch
                    id="schedule-toggle"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={scheduledDate}
                            onSelect={setScheduledDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-time">Time</Label>
                      <Input
                        id="scheduled-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    {scheduledDate && (
                      <div className="col-span-2 text-sm text-muted-foreground">
                        Campaign will start on{' '}
                        <span className="font-medium text-foreground">
                          {format(scheduledDate, 'EEEE, MMMM d, yyyy')} at {scheduledTime}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cost Summary */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Cost Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Daily Rate:</span>
                    <span className="ml-2 font-medium">£{DAILY_COST}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-medium">{daysRequested} day{daysRequested > 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recipients:</span>
                    <span className="ml-2 font-medium">{recipientCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Total:</span>
                    <span className="ml-2 font-bold text-primary">£{totalCost}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleCreateCampaign}
                disabled={isLoading || !campaignName || !targetAudience || !messageTemplate || recipientCount === 0 || !whatsappNumber || (isScheduled && !scheduledDate)}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : isScheduled ? (
                  <CalendarClock className="w-5 h-5 mr-2" />
                ) : (
                  <Bot className="w-5 h-5 mr-2" />
                )}
                {isScheduled ? `Schedule Campaign (£${totalCost})` : `Create Campaign (£${totalCost})`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4 mt-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No campaigns yet.</p>
              <p className="text-sm">Create your first AI campaign to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {campaign.description || 'No description'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Recipients</span>
                        <span className="font-medium">{campaign.total_recipients}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Sent</span>
                        <span className="font-medium text-primary">{campaign.sent_count}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Failed</span>
                        <span className="font-medium text-destructive">{campaign.failed_count}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Cost</span>
                        <span className="font-medium">£{campaign.total_cost}</span>
                      </div>
                    </div>
                    
                    {campaign.is_scheduled && campaign.scheduled_at && (
                      <div className="flex items-center gap-2 text-sm bg-secondary/30 rounded-lg p-3">
                        <CalendarClock className="w-4 h-4 text-primary" />
                        <span>
                          Scheduled for:{' '}
                          <span className="font-medium">
                            {format(new Date(campaign.scheduled_at), 'PPP')} at{' '}
                            {format(new Date(campaign.scheduled_at), 'HH:mm')}
                          </span>
                        </span>
                      </div>
                    )}

                    {campaign.status === 'pending_payment' && (
                      <div className="flex flex-col gap-2 pt-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePayment(campaign, 'manual')}
                            disabled={isLoading}
                            className="flex-1"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Manual Payment
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePayment(campaign, 'crypto')}
                            className="flex-1"
                          >
                            <Wallet className="w-4 h-4 mr-2" />
                            Pay with Crypto
                          </Button>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePayment(campaign, 'credits')}
                          disabled={isLoading}
                          className="w-full"
                        >
                          <Coins className="w-4 h-4 mr-2" />
                          Pay with CFSMS Credits ({campaign.total_cost * 10} tokens)
                        </Button>
                      </div>
                    )}

                    {campaign.admin_notes && (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                        <p className="text-sm text-warning">
                          <strong>Admin Note:</strong> {campaign.admin_notes}
                        </p>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        fetchCampaignLogs(campaign.id);
                      }}
                      className="w-full"
                    >
                      View Details & Logs
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Campaign Details Modal */}
          {selectedCampaign && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedCampaign.name}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">{getStatusBadge(selectedCampaign.status)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target Audience:</span>
                      <p className="font-medium">{selectedCampaign.target_audience}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Message:</span>
                      <p className="font-medium bg-secondary/30 rounded p-2 mt-1">{selectedCampaign.message_template}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Campaign Logs</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {campaignLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No logs yet.</p>
                      ) : (
                        campaignLogs.map((log) => (
                          <div
                            key={log.id}
                            className={`text-sm p-2 rounded ${
                              log.log_type === 'error' ? 'bg-destructive/10 text-destructive' :
                              log.log_type === 'success' ? 'bg-primary/10 text-primary' :
                              'bg-secondary/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{log.message}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
