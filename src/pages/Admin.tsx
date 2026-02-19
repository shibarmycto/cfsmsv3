import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Users,
  Shield,
  Check,
  X,
  ArrowLeft,
  Search,
  Zap,
  Trash2,
  UserCheck,
  Clock,
  Phone,
  Mail,
  User,
  ShoppingCart,
  Wallet,
  Link,
  History,
  Bot,
  Play,
  Send,
  Coins,
  Hash,
  BadgeCheck,
  Youtube,
  TrendingUp,
  Gamepad2,
  Terminal,
  Monitor,
} from 'lucide-react';
import AdminBankTab from '@/components/AdminBankTab';
import AdminForumTab from '@/components/AdminForumTab';
import AdminVerifyUsersTab from '@/components/AdminVerifyUsersTab';
import AdminPromoOrdersTab from '@/components/AdminPromoOrdersTab';
import AdminExchangeTab from '@/components/AdminExchangeTab';
import AdminGameTab from '@/components/AdminGameTab';
import AdminPhoneRequestsTab from '@/components/AdminPhoneRequestsTab';
import AdminVMTerminal from '@/components/AdminVMTerminal';
import SuperAdminVMTab from '@/components/SuperAdminVMTab';
import UserVMRental from '@/components/UserVMRental';
import AdminVMApprovalTab from '@/components/AdminVMApprovalTab';
import AdminRPTab from '@/components/AdminRPTab';
import AdminSignalAccessTab from '@/components/AdminSignalAccessTab';
import AdminFaucetTab from '@/components/AdminFaucetTab';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  sms_credits: number;
  default_sender_id: string;
  is_approved: boolean;
  created_at: string;
  daily_sms_limit: number | null;
  daily_sms_used: number;
}

interface SenderIdRequest {
  id: string;
  user_id: string;
  sender_id: string;
  status: string;
  created_at: string;
}

interface PurchaseRequest {
  id: string;
  user_id: string;
  package_name: string;
  credits_amount: number;
  price: number;
  currency: string;
  destination: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface CryptoOrder {
  id: string;
  user_id: string;
  credits_amount: number;
  price_usd: number;
  crypto_type: string;
  expected_amount: number;
  tx_hash: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

interface UrlWhitelistRequest {
  id: string;
  user_id: string;
  url: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface SmsLog {
  id: string;
  user_id: string;
  recipient: string;
  message: string;
  sender_id: string;
  status: string | null;
  destination: string;
  credits_used: number;
  created_at: string;
}

interface AICampaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_audience: string;
  message_template: string;
  recipients: string[];
  destination: string;
  whatsapp_number: string;
  days_requested: number;
  daily_cost: number;
  total_cost: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  admin_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AICampaignLog {
  id: string;
  campaign_id: string;
  message: string;
  log_type: string;
  metadata: any;
  created_at: string;
}

export default function Admin() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('pending');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [senderRequests, setSenderRequests] = useState<SenderIdRequest[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [cryptoOrders, setCryptoOrders] = useState<CryptoOrder[]>([]);
  const [urlRequests, setUrlRequests] = useState<UrlWhitelistRequest[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [aiCampaigns, setAiCampaigns] = useState<AICampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [creditAmounts, setCreditAmounts] = useState<{ [key: string]: string }>({});
  const [dailyLimits, setDailyLimits] = useState<{ [key: string]: string }>({});
  const [startingCampaign, setStartingCampaign] = useState<string | null>(null);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<string | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<AICampaignLog[]>([]);
  const [testWhatsappNumber, setTestWhatsappNumber] = useState('');
  const [testWhatsappMessage, setTestWhatsappMessage] = useState('🧪 Test message from CFSMS Admin Panel. WhatsApp integration is working!');
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges.',
          variant: 'destructive',
        });
        navigate('/dashboard');
      }
    }
  }, [user, isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchSenderRequests();
      fetchPurchaseRequests();
      fetchCryptoOrders();
      fetchUrlRequests();
      fetchSmsLogs();
      fetchAiCampaigns();
    }
  }, [isAdmin]);

  // Realtime subscription for AI campaigns
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('ai-campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_campaigns',
        },
        (payload) => {
          console.log('AI Campaign update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setAiCampaigns((prev) => [payload.new as AICampaign, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAiCampaigns((prev) =>
              prev.map((campaign) =>
                campaign.id === payload.new.id ? (payload.new as AICampaign) : campaign
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAiCampaigns((prev) =>
              prev.filter((campaign) => campaign.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Realtime subscription for campaign logs
  useEffect(() => {
    if (!isAdmin || !selectedCampaignLogs) return;

    const channel = supabase
      .channel('campaign-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_campaign_logs',
          filter: `campaign_id=eq.${selectedCampaignLogs}`,
        },
        (payload) => {
          setCampaignLogs((prev) => [payload.new as AICampaignLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, selectedCampaignLogs]);

  const fetchCampaignLogs = async (campaignId: string) => {
    const { data } = await supabase
      .from('ai_campaign_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (data) {
      setCampaignLogs(data as AICampaignLog[]);
    }
  };

  const handleViewLogs = (campaignId: string) => {
    setSelectedCampaignLogs(campaignId);
    fetchCampaignLogs(campaignId);
  };

  const getLogTypeColor = (logType: string) => {
    switch (logType) {
      case 'success': return 'text-success';
      case 'error': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'info': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getLogTypeIcon = (logType: string) => {
    switch (logType) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUsers(data as UserProfile[]);
    }
  };

  const fetchSenderRequests = async () => {
    const { data } = await supabase
      .from('sender_id_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) {
      setSenderRequests(data as SenderIdRequest[]);
    }
  };

  const fetchPurchaseRequests = async () => {
    const { data } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) {
      setPurchaseRequests(data as PurchaseRequest[]);
    }
  };

  const fetchCryptoOrders = async () => {
    const { data } = await supabase
      .from('crypto_orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setCryptoOrders(data as CryptoOrder[]);
    }
  };

  const fetchUrlRequests = async () => {
    const { data } = await supabase
      .from('url_whitelist_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUrlRequests(data as UrlWhitelistRequest[]);
    }
  };

  const handleUrlRequest = async (requestId: string, approved: boolean) => {
    const { error } = await supabase
      .from('url_whitelist_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not process URL request.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: approved ? 'Approved' : 'Rejected',
      description: `URL whitelist request has been ${approved ? 'approved' : 'rejected'}.`,
    });
    
    fetchUrlRequests();
  };

  const fetchSmsLogs = async () => {
    const { data } = await supabase
      .from('sms_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (data) {
      setSmsLogs(data as SmsLog[]);
    }
  };

  const fetchAiCampaigns = async () => {
    const { data } = await supabase
      .from('ai_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setAiCampaigns(data as AICampaign[]);
    }
  };

  const handleApproveCampaign = async (campaignId: string) => {
    // First, get the campaign to check if it's scheduled
    const { data: campaign, error: fetchError } = await supabase
      .from('ai_campaigns')
      .select('is_scheduled, scheduled_at, name')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      toast({
        title: 'Approval Failed',
        description: 'Could not find campaign.',
        variant: 'destructive',
      });
      return;
    }

    // Determine the status based on whether campaign is scheduled
    const newStatus = campaign.is_scheduled && campaign.scheduled_at 
      ? 'scheduled' 
      : 'approved';

    const { error } = await supabase
      .from('ai_campaigns')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq('id', campaignId);

    if (error) {
      toast({
        title: 'Approval Failed',
        description: 'Could not approve campaign.',
        variant: 'destructive',
      });
      return;
    }

    const description = campaign.is_scheduled && campaign.scheduled_at
      ? `Campaign "${campaign.name}" is scheduled to run at ${new Date(campaign.scheduled_at).toLocaleString()}`
      : 'Campaign has been approved and is ready to start.';

    toast({
      title: 'Campaign Approved',
      description,
    });
    
    fetchAiCampaigns();
  };

  const handleRejectCampaign = async (campaignId: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    
    const { error } = await supabase
      .from('ai_campaigns')
      .update({
        status: 'rejected',
        admin_notes: reason || 'Rejected by admin',
      })
      .eq('id', campaignId);

    if (error) {
      toast({
        title: 'Rejection Failed',
        description: 'Could not reject campaign.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Campaign Rejected',
      description: 'Campaign has been rejected.',
    });
    
    fetchAiCampaigns();
  };

  const handleStartCampaign = async (campaign: AICampaign) => {
    if (!confirm(`Start campaign "${campaign.name}" with ${campaign.total_recipients} recipients?`)) {
      return;
    }

    setStartingCampaign(campaign.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-campaign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start campaign');
      }

      toast({
        title: 'Campaign Started',
        description: `Campaign is now running. ${result.totalRecipients} messages will be sent.`,
      });
      
      fetchAiCampaigns();
    } catch (error: any) {
      toast({
        title: 'Start Failed',
        description: error.message || 'Could not start campaign.',
        variant: 'destructive',
      });
    } finally {
      setStartingCampaign(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    const { error } = await supabase
      .from('ai_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete campaign.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Campaign Deleted',
      description: 'Campaign has been removed.',
    });
    
    fetchAiCampaigns();
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'bg-warning/20 text-warning';
      case 'pending_approval': return 'bg-primary/20 text-primary';
      case 'approved': return 'bg-success/20 text-success';
      case 'running': return 'bg-blue-500/20 text-blue-500';
      case 'completed': return 'bg-success/20 text-success';
      case 'rejected': return 'bg-destructive/20 text-destructive';
      case 'failed': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const pendingApprovalCampaigns = aiCampaigns.filter(c => c.status === 'pending_approval');
  const approvedCampaigns = aiCampaigns.filter(c => c.status === 'approved');

  const handleDeleteCryptoOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this crypto order?')) {
      return;
    }

    const { error } = await supabase
      .from('crypto_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete crypto order.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Order Deleted',
      description: 'Crypto order has been removed.',
    });
    
    fetchCryptoOrders();
  };

  const handleApproveCryptoOrder = async (order: CryptoOrder) => {
    if (!confirm(`Approve this order and add ${order.credits_amount} credits to the user?`)) {
      return;
    }

    // Update order status to approved
    const { error: orderError } = await supabase
      .from('crypto_orders')
      .update({
        status: 'approved',
        paid_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq('id', order.id);

    if (orderError) {
      toast({
        title: 'Approval Failed',
        description: 'Could not approve crypto order.',
        variant: 'destructive',
      });
      return;
    }

    // Add credits to user
    const userProfile = users.find(u => u.user_id === order.user_id);
    const newCredits = (userProfile?.sms_credits || 0) + order.credits_amount;

    await supabase
      .from('profiles')
      .update({ sms_credits: newCredits })
      .eq('user_id', order.user_id);

    // Create transaction record
    await supabase.from('transactions').insert({
      user_id: order.user_id,
      amount: order.price_usd,
      credits_purchased: order.credits_amount,
      payment_method: `crypto_${order.crypto_type}`,
      currency: 'USD',
      status: 'completed',
    });

    toast({
      title: 'Order Approved',
      description: `Added ${order.credits_amount} credits to ${getUserEmail(order.user_id)}.`,
    });

    fetchCryptoOrders();
    fetchUsers();
  };

  const getUserEmail = (userId: string) => {
    const userProfile = users.find(u => u.user_id === userId);
    return userProfile?.email || 'Unknown';
  };

  const getUserName = (userId: string) => {
    const userProfile = users.find(u => u.user_id === userId);
    return userProfile?.full_name || 'No name';
  };

  const handleApproveUser = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: true })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Approval Failed',
        description: 'Could not approve user.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'User Approved',
        description: 'The user can now access the platform.',
      });
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    // Delete profile (this will cascade due to RLS)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (profileError) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete user profile.',
        variant: 'destructive',
      });
      return;
    }

    // Delete user roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    toast({
      title: 'User Deleted',
      description: `${userEmail} has been removed.`,
    });
    fetchUsers();
  };

  const handleSetCredits = async (userId: string) => {
    const amount = parseInt(creditAmounts[userId] || '0');
    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid number.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ sms_credits: amount })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not update credits.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Credits Updated',
        description: `Set credits to ${amount}.`,
      });
      fetchUsers();
      setCreditAmounts({ ...creditAmounts, [userId]: '' });
    }
  };

  const handleAddCredits = async (userId: string) => {
    const amount = parseInt(creditAmounts[userId] || '0');
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a positive number.',
        variant: 'destructive',
      });
      return;
    }

    const currentUser = users.find(u => u.user_id === userId);
    const newCredits = (currentUser?.sms_credits || 0) + amount;

    const { error } = await supabase
      .from('profiles')
      .update({ sms_credits: newCredits })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not add credits.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Credits Added',
        description: `Added ${amount} credits.`,
      });
      fetchUsers();
      setCreditAmounts({ ...creditAmounts, [userId]: '' });
    }
  };

  const handleSetDailyLimit = async (userId: string) => {
    const limitStr = dailyLimits[userId];
    const limit = limitStr === '' || limitStr === undefined ? null : parseInt(limitStr);
    
    if (limitStr !== '' && limitStr !== undefined && (isNaN(limit!) || limit! < 0)) {
      toast({ title: 'Invalid Limit', description: 'Please enter a valid number or leave empty for unlimited.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ daily_sms_limit: limit, daily_sms_used: 0 })
      .eq('user_id', userId);

    if (error) {
      toast({ title: 'Update Failed', description: 'Could not set daily limit.', variant: 'destructive' });
    } else {
      toast({ title: 'Daily Limit Set', description: limit ? `Set to ${limit} SMS/day.` : 'Removed daily limit.' });
      fetchUsers();
      setDailyLimits({ ...dailyLimits, [userId]: '' });
    }
  };

  const handleSenderRequest = async (requestId: string, approved: boolean, userId: string, senderId: string) => {
    const { error } = await supabase
      .from('sender_id_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not process request.',
        variant: 'destructive',
      });
      return;
    }

    if (approved) {
      await supabase
        .from('profiles')
        .update({ default_sender_id: senderId })
        .eq('user_id', userId);
    }

    toast({
      title: approved ? 'Approved' : 'Rejected',
      description: `Sender ID request has been ${approved ? 'approved' : 'rejected'}.`,
    });
    
    fetchSenderRequests();
  };

  const handlePurchaseRequest = async (request: PurchaseRequest, approved: boolean) => {
    const { error } = await supabase
      .from('purchase_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq('id', request.id);

    if (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not process request.',
        variant: 'destructive',
      });
      return;
    }

    if (approved) {
      // Add credits to the user
      const userProfile = users.find(u => u.user_id === request.user_id);
      const newCredits = (userProfile?.sms_credits || 0) + request.credits_amount;
      
      await supabase
        .from('profiles')
        .update({ sms_credits: newCredits })
        .eq('user_id', request.user_id);

      // Create a transaction record
      await supabase.from('transactions').insert({
        user_id: request.user_id,
        amount: request.price,
        credits_purchased: request.credits_amount,
        payment_method: 'admin_approved',
        currency: request.currency,
        status: 'completed',
      });
    }

    toast({
      title: approved ? 'Approved' : 'Rejected',
      description: approved 
        ? `Added ${request.credits_amount} credits to user.`
        : 'Purchase request has been rejected.',
    });
    
    fetchPurchaseRequests();
    fetchUsers();
  };

  const handleTestWhatsapp = async () => {
    if (!testWhatsappNumber.trim()) {
      toast({
        title: 'Missing Number',
        description: 'Please enter a WhatsApp number to test.',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsapp(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            to: testWhatsappNumber,
            message: testWhatsappMessage,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send WhatsApp message');
      }

      toast({
        title: 'WhatsApp Sent!',
        description: `Test message sent successfully. SID: ${result.messageSid}`,
      });
    } catch (error: any) {
      toast({
        title: 'WhatsApp Failed',
        description: error.message || 'Could not send WhatsApp message.',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const pendingUsers = users.filter(u => !u.is_approved);
  const approvedUsers = users.filter(u => u.is_approved);
  
  const filteredPendingUsers = pendingUsers.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const filteredApprovedUsers = approvedUsers.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading || !isAdmin) {
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold">Admin Panel</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass-card p-4 space-y-2">
              {[
                { id: 'pending', icon: Clock, label: 'Pending Approval', count: pendingUsers.length },
                { id: 'ai-campaigns', icon: Bot, label: 'AI Campaigns', count: pendingApprovalCampaigns.length },
                { id: 'crypto', icon: Wallet, label: 'Crypto Orders', count: cryptoOrders.filter(o => o.status === 'pending').length },
                { id: 'purchases', icon: ShoppingCart, label: 'Purchase Requests', count: purchaseRequests.length },
                { id: 'promo-orders', icon: Youtube, label: 'Promo Orders', count: 0 },
                { id: 'urls', icon: Link, label: 'URL Requests', count: urlRequests.filter(r => r.status === 'pending').length },
                { id: 'sms-history', icon: History, label: 'SMS History', count: smsLogs.length },
                { id: 'users', icon: Users, label: 'All Users', count: approvedUsers.length },
                { id: 'sender-ids', icon: MessageSquare, label: 'Sender ID Requests', count: senderRequests.length },
                { id: 'bank', icon: Coins, label: 'CFSMS Bank', count: 0 },
                { id: 'exchange', icon: TrendingUp, label: 'CF Exchange', count: 0 },
                { id: 'forum', icon: Hash, label: 'Forum', count: 0 },
                { id: 'verify-users', icon: BadgeCheck, label: 'Verify Users', count: 0 },
                { id: 'phone-requests', icon: Phone, label: 'Phone Numbers', count: 0 },
                { id: 'game', icon: Gamepad2, label: 'CF Roleplay', count: 0 },
                { id: 'signals', icon: Zap, label: 'Solana Signals', count: 0 },
                { id: 'vm-terminal', icon: Terminal, label: 'VM Terminal', count: 0 },
                { id: 'vm-approval', icon: Monitor, label: 'VM Approvals', count: 0 },
                { id: 'super-admin-vm', icon: Shield, label: 'Super Admin VM', count: 0 },
                { id: 'user-vm', icon: Terminal, label: 'User VM Rentals', count: 0 },
                { id: 'faucet', icon: Zap, label: 'Faucet Access', count: 0 },
                { id: 'whatsapp-test', icon: Send, label: 'Test WhatsApp', count: 0 },
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
                  {item.count > 0 && (
                    <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                      activeTab === item.id 
                        ? 'bg-primary-foreground/20 text-primary-foreground' 
                        : 'bg-destructive text-destructive-foreground'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Pending Approval Tab */}
            {activeTab === 'pending' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Pending Approval</h2>
                    <p className="text-muted-foreground">Review and approve new user registrations</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="pl-10 bg-secondary/50 w-64"
                    />
                  </div>
                </div>

                {filteredPendingUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending approvals.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPendingUsers.map((u) => (
                      <div key={u.id} className="bg-secondary/30 rounded-lg p-6 border border-warning/20">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-semibold text-lg">{u.full_name || 'No name provided'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="w-4 h-4" />
                              <span>{u.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-4 h-4" />
                              <span>{u.phone_number || 'No phone number'}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Registered: {new Date(u.created_at).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="default"
                              onClick={() => handleApproveUser(u.user_id)}
                              className="bg-success hover:bg-success/90"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteUser(u.user_id, u.email)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Campaigns Tab */}
            {activeTab === 'ai-campaigns' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">AI Campaigns</h2>
                    <p className="text-muted-foreground">Review, approve, and manage AI SMS campaigns</p>
                  </div>
                </div>

                {/* Pending Approval Section */}
                {pendingApprovalCampaigns.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-warning" />
                      Pending Approval ({pendingApprovalCampaigns.length})
                    </h3>
                    <div className="space-y-4">
                      {pendingApprovalCampaigns.map((campaign) => (
                        <div key={campaign.id} className="bg-secondary/30 rounded-lg p-6 border border-warning/20">
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-primary" />
                                <span className="font-semibold text-lg">{campaign.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${getCampaignStatusColor(campaign.status)}`}>
                                  {campaign.status.replace('_', ' ')}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span>{getUserName(campaign.user_id)} ({getUserEmail(campaign.user_id)})</span>
                              </div>

                              {campaign.description && (
                                <p className="text-sm text-muted-foreground">{campaign.description}</p>
                              )}
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block">Target Audience</span>
                                  <span className="font-medium">{campaign.target_audience}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Recipients</span>
                                  <span className="font-medium">{campaign.total_recipients.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Duration</span>
                                  <span className="font-medium">{campaign.days_requested} day(s)</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Total Cost</span>
                                  <span className="font-bold text-primary">£{campaign.total_cost}</span>
                                </div>
                              </div>

                              <div className="bg-secondary/50 rounded p-3 mt-2">
                                <span className="text-muted-foreground text-xs block mb-1">Message Template</span>
                                <p className="text-sm font-mono">{campaign.message_template}</p>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  WhatsApp: {campaign.whatsapp_number}
                                </span>
                                <span>Region: {campaign.destination.toUpperCase()}</span>
                              </div>

                              {(campaign as any).is_scheduled && (campaign as any).scheduled_at && (
                                <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg p-2">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    Scheduled for: {new Date((campaign as any).scheduled_at).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              
                              <p className="text-sm text-muted-foreground">
                                Created: {new Date(campaign.created_at).toLocaleString()}
                              </p>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <Button
                                className="bg-success hover:bg-success/90"
                                onClick={() => handleApproveCampaign(campaign.id)}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleRejectCampaign(campaign.id)}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approved - Ready to Start Section */}
                {approvedCampaigns.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Check className="w-5 h-5 text-success" />
                      Ready to Start ({approvedCampaigns.length})
                    </h3>
                    <div className="space-y-4">
                      {approvedCampaigns.map((campaign) => (
                        <div key={campaign.id} className="bg-secondary/30 rounded-lg p-6 border border-success/20">
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-primary" />
                                <span className="font-semibold text-lg">{campaign.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${getCampaignStatusColor(campaign.status)}`}>
                                  {campaign.status}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span>{getUserName(campaign.user_id)} ({getUserEmail(campaign.user_id)})</span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block">Recipients</span>
                                  <span className="font-medium">{campaign.total_recipients.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Duration</span>
                                  <span className="font-medium">{campaign.days_requested} day(s)</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Total Cost</span>
                                  <span className="font-bold text-primary">£{campaign.total_cost}</span>
                                </div>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                Approved: {campaign.approved_at ? new Date(campaign.approved_at).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <Button
                                onClick={() => handleStartCampaign(campaign)}
                                disabled={startingCampaign === campaign.id}
                                className="bg-primary hover:bg-primary/90"
                              >
                                {startingCampaign === campaign.id ? (
                                  <>
                                    <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                    Starting...
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Start Campaign
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteCampaign(campaign.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Campaigns Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    All Campaigns ({aiCampaigns.length})
                  </h3>
                  
                  {aiCampaigns.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No AI campaigns yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2">Campaign</th>
                            <th className="text-left py-3 px-2">User</th>
                            <th className="text-left py-3 px-2">Recipients</th>
                            <th className="text-left py-3 px-2">Progress</th>
                            <th className="text-left py-3 px-2">Status</th>
                            <th className="text-left py-3 px-2">Created</th>
                            <th className="text-right py-3 px-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiCampaigns.map((campaign) => (
                            <tr key={campaign.id} className="border-b border-border/50 hover:bg-secondary/20">
                              <td className="py-3 px-2">
                                <div className="font-medium">{campaign.name}</div>
                                <div className="text-xs text-muted-foreground">{campaign.destination.toUpperCase()}</div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="text-muted-foreground">{getUserEmail(campaign.user_id)}</div>
                              </td>
                              <td className="py-3 px-2">{campaign.total_recipients.toLocaleString()}</td>
                              <td className="py-3 px-2">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span>
                                      <span className="text-success">{campaign.sent_count}</span>
                                      <span className="text-muted-foreground"> / </span>
                                      <span className="text-destructive">{campaign.failed_count}</span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      {campaign.total_recipients > 0 
                                        ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100)
                                        : 0}%
                                    </span>
                                  </div>
                                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div 
                                      className="h-full flex"
                                      style={{ width: `${campaign.total_recipients > 0 ? ((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100 : 0}%` }}
                                    >
                                      <div 
                                        className="bg-success h-full"
                                        style={{ 
                                          width: `${(campaign.sent_count + campaign.failed_count) > 0 
                                            ? (campaign.sent_count / (campaign.sent_count + campaign.failed_count)) * 100 
                                            : 0}%` 
                                        }}
                                      />
                                      <div 
                                        className="bg-destructive h-full"
                                        style={{ 
                                          width: `${(campaign.sent_count + campaign.failed_count) > 0 
                                            ? (campaign.failed_count / (campaign.sent_count + campaign.failed_count)) * 100 
                                            : 0}%` 
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${getCampaignStatusColor(campaign.status)}`}>
                                  {campaign.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-muted-foreground">
                                {new Date(campaign.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewLogs(campaign.id)}
                                    className="text-primary hover:text-primary"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCampaign(campaign.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Campaign Logs Viewer */}
                {selectedCampaignLogs && (
                  <div className="mt-8 border-t border-border pt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Campaign Logs
                        <span className="text-sm font-normal text-muted-foreground">
                          ({aiCampaigns.find(c => c.id === selectedCampaignLogs)?.name})
                        </span>
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCampaignLogs(null);
                          setCampaignLogs([]);
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Close
                      </Button>
                    </div>

                    {campaignLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No logs available for this campaign.</p>
                      </div>
                    ) : (
                      <div className="bg-secondary/20 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                        {campaignLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 bg-background/50 rounded border border-border/50"
                          >
                            <span className={`font-mono text-lg ${getLogTypeColor(log.log_type)}`}>
                              {getLogTypeIcon(log.log_type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${getLogTypeColor(log.log_type)}`}>
                                {log.message}
                              </p>
                              {log.metadata && (
                                <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* All Users Tab */}
            {activeTab === 'users' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Approved Users</h2>
                    <p className="text-muted-foreground">Manage user accounts and credits</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="pl-10 bg-secondary/50 w-64"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredApprovedUsers.map((u) => (
                    <div key={u.id} className="bg-secondary/30 rounded-lg p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{u.full_name || 'No name'}</span>
                            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Approved</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {u.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {u.phone_number || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="font-semibold">{u.sms_credits}</span>
                            <span className="text-muted-foreground text-sm">credits</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={creditAmounts[u.user_id] || ''}
                            onChange={(e) => setCreditAmounts({
                              ...creditAmounts,
                              [u.user_id]: e.target.value
                            })}
                            className="w-24 bg-secondary/50"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCredits(u.user_id)}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSetCredits(u.user_id)}
                          >
                            Set
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Daily Limit:</span>
                          <Input
                            type="number"
                            placeholder={u.daily_sms_limit ? String(u.daily_sms_limit) : '∞'}
                            value={dailyLimits[u.user_id] || ''}
                            onChange={(e) => setDailyLimits({ ...dailyLimits, [u.user_id]: e.target.value })}
                            className="w-20 bg-secondary/50 h-8 text-sm"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleSetDailyLimit(u.user_id)}>
                            Set
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Used: {u.daily_sms_used || 0}
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(u.user_id, u.email)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredApprovedUsers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No approved users found.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Purchase Requests Tab */}
            {activeTab === 'purchases' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-2">Purchase Requests</h2>
                <p className="text-muted-foreground mb-6">Review and approve credit purchase orders</p>

                {purchaseRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending purchase requests.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchaseRequests.map((req) => (
                      <div key={req.id} className="bg-secondary/30 rounded-lg p-6 border border-warning/20">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-semibold">{getUserName(req.user_id)}</span>
                              <span className="text-muted-foreground">({getUserEmail(req.user_id)})</span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground block">Package</span>
                                <span className="font-medium">{req.package_name}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Credits</span>
                                <span className="font-medium">{req.credits_amount.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Price</span>
                                <span className="font-bold text-primary">
                                  {req.currency === 'GBP' ? '£' : '$'}{req.price}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Region</span>
                                <span className="font-medium">{req.destination.toUpperCase()}</span>
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              Requested: {new Date(req.created_at).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              className="bg-success hover:bg-success/90"
                              onClick={() => handlePurchaseRequest(req, true)}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Approve & Add Credits
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handlePurchaseRequest(req, false)}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sender ID Requests Tab */}
            {activeTab === 'sender-ids' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-6">Sender ID Requests</h2>

                {senderRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending requests.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {senderRequests.map((req) => (
                      <div key={req.id} className="bg-secondary/30 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-lg font-bold text-primary">{req.sender_id}</p>
                            <p className="text-sm text-muted-foreground">
                              Requested: {new Date(req.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-success hover:bg-success/90"
                              onClick={() => handleSenderRequest(req.id, true, req.user_id, req.sender_id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleSenderRequest(req.id, false, req.user_id, req.sender_id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Crypto Orders Tab */}
            {activeTab === 'crypto' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-2">Crypto Orders</h2>
                <p className="text-muted-foreground mb-6">Monitor cryptocurrency payment orders</p>

                {cryptoOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No crypto orders yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cryptoOrders.map((order) => (
                      <div 
                        key={order.id} 
                        className={`bg-secondary/30 rounded-lg p-6 border ${
                          order.status === 'paid' ? 'border-success/30' :
                          order.status === 'expired' ? 'border-destructive/30' :
                          'border-warning/30'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-semibold">{getUserName(order.user_id)}</span>
                              <span className="text-muted-foreground">({getUserEmail(order.user_id)})</span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground block">Credits</span>
                                <span className="font-medium">{order.credits_amount.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Price</span>
                                <span className="font-bold text-primary">${order.price_usd}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Crypto</span>
                                <span className="font-medium uppercase">{order.crypto_type}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Amount</span>
                                <span className="font-mono text-xs">{order.expected_amount.toFixed(6)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                order.status === 'paid' ? 'bg-success/20 text-success' :
                                order.status === 'expired' ? 'bg-destructive/20 text-destructive' :
                                'bg-warning/20 text-warning'
                              }`}>
                                {order.status.toUpperCase()}
                              </span>
                              {order.tx_hash && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  TX: {order.tx_hash.slice(0, 16)}...
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(order.created_at).toLocaleString()} | 
                              Expires: {new Date(order.expires_at).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {order.status === 'pending' && (
                              <Button
                                className="bg-success hover:bg-success/90"
                                size="sm"
                                onClick={() => handleApproveCryptoOrder(order)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteCryptoOrder(order.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* URL Whitelist Requests Tab */}
            {activeTab === 'urls' && (
              <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-2xl font-bold mb-2">URL Whitelist Requests</h2>
                <p className="text-muted-foreground mb-6">Review and approve URL whitelist requests</p>

                {urlRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Link className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No URL requests yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {urlRequests.map((req) => (
                      <div 
                        key={req.id} 
                        className={`bg-secondary/30 rounded-lg p-6 border ${
                          req.status === 'approved' ? 'border-success/30' :
                          req.status === 'rejected' ? 'border-destructive/30' :
                          'border-warning/30'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-semibold">{getUserName(req.user_id)}</span>
                              <span className="text-muted-foreground">({getUserEmail(req.user_id)})</span>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <span className="text-muted-foreground text-sm block">URL</span>
                                <span className="font-mono text-primary break-all">{req.url}</span>
                              </div>
                              {req.description && (
                                <div>
                                  <span className="text-muted-foreground text-sm block">Description</span>
                                  <span className="text-sm">{req.description}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                req.status === 'approved' ? 'bg-success/20 text-success' :
                                req.status === 'rejected' ? 'bg-destructive/20 text-destructive' :
                                'bg-warning/20 text-warning'
                              }`}>
                                {req.status.toUpperCase()}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(req.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Button
                                className="bg-success hover:bg-success/90"
                                onClick={() => handleUrlRequest(req.id, true)}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleUrlRequest(req.id, false)}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SMS History Tab */}
            {activeTab === 'sms-history' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">SMS History</h2>
                    <p className="text-muted-foreground">View all SMS messages sent by users</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      className="pl-10 bg-secondary/50 w-64"
                    />
                  </div>
                </div>

                {smsLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No SMS messages sent yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {smsLogs
                      .filter(log => 
                        log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        getUserEmail(log.user_id).toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((log) => (
                      <div key={log.id} className="bg-secondary/30 rounded-lg p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                {getUserEmail(log.user_id)}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                log.status === 'sent' ? 'bg-success/20 text-success' : 
                                log.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                                'bg-warning/20 text-warning'
                              }`}>
                                {log.status || 'pending'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {log.destination.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-mono text-muted-foreground">{log.recipient}</span>
                              <span className="text-xs text-muted-foreground">
                                From: {log.sender_id || 'Default'}
                              </span>
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">{log.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()} • {log.credits_used} credit{log.credits_used !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CFSMS Bank Tab */}
            {activeTab === 'bank' && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Coins className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">CFSMS Digital Bank</h2>
                    <p className="text-muted-foreground">Manage wallets, withdrawals, miners, and transactions</p>
                  </div>
                </div>
                <AdminBankTab />
              </div>
            )}

            {/* WhatsApp Test Tab */}
            {activeTab === 'whatsapp-test' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                    <Send className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Test WhatsApp Integration</h2>
                    <p className="text-muted-foreground">Send a test message to verify Twilio WhatsApp is working</p>
                  </div>
                </div>

                <div className="max-w-xl space-y-6">
                  <div className="bg-secondary/30 rounded-lg p-6 border border-border">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      Recipient WhatsApp Number
                    </h3>
                    <Input
                      type="tel"
                      placeholder="+44 7XXX XXX XXX"
                      value={testWhatsappNumber}
                      onChange={(e) => setTestWhatsappNumber(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter the phone number with country code (e.g., +447123456789)
                    </p>
                  </div>

                  <div className="bg-secondary/30 rounded-lg p-6 border border-border">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Test Message
                    </h3>
                    <textarea
                      value={testWhatsappMessage}
                      onChange={(e) => setTestWhatsappMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                      placeholder="Enter your test message..."
                    />
                  </div>

                  <Button
                    onClick={handleTestWhatsapp}
                    disabled={sendingWhatsapp || !testWhatsappNumber.trim()}
                    className="w-full bg-success hover:bg-success/90"
                    size="lg"
                  >
                    {sendingWhatsapp ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-success-foreground/30 border-t-success-foreground rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Test WhatsApp
                      </>
                    )}
                  </Button>

                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                    <h4 className="font-semibold text-warning mb-2">Important Notes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• For Twilio Sandbox: The recipient must first join your sandbox by sending a message to your Twilio WhatsApp number</li>
                      <li>• For Production: Ensure your Twilio WhatsApp number is fully registered and approved</li>
                      <li>• Messages can only be sent to users who have opted in within the last 24 hours</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Forum Tab */}
            {activeTab === 'forum' && user && (
              <AdminForumTab userId={user.id} />
            )}

            {/* Verify Users Tab */}
            {activeTab === 'verify-users' && (
              <AdminVerifyUsersTab />
            )}

            {/* Promo Orders Tab */}
            {activeTab === 'promo-orders' && (
              <AdminPromoOrdersTab />
            )}

            {/* Exchange Tab */}
            {activeTab === 'exchange' && (
              <AdminExchangeTab />
            )}

            {/* Phone Requests Tab */}
            {activeTab === 'phone-requests' && (
              <AdminPhoneRequestsTab />
            )}

            {/* Game Tab */}
            {activeTab === 'game' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">CF Roleplay Management</h2>
                  <p className="text-muted-foreground">Manage police applications, bans, transactions, and players</p>
                </div>
                <AdminGameTab />
              </div>
            )}

            {/* RP Admin Tab */}
            {activeTab === 'rp-admin' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">🎮 Roleplay Admin Panel</h2>
                  <p className="text-muted-foreground">Gang applications, economy, players, and bans</p>
                </div>
                <AdminRPTab />
              </div>
            )}

            {/* VM Terminal Tab */}
            {activeTab === 'vm-terminal' && (
              <AdminVMTerminal />
            )}

            {/* Super Admin VM Controls Tab */}
            {activeTab === 'super-admin-vm' && (
              <div className="glass-card p-8 animate-fade-in">
                <SuperAdminVMTab />
              </div>
            )}

            {/* VM Approval Tab */}
            {activeTab === 'vm-approval' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">VM Rental Approvals</h2>
                  <p className="text-muted-foreground">Manage and approve user VM rental requests</p>
                </div>
                <AdminVMApprovalTab />
              </div>
            )}

            {/* User VM Rental Tab */}
            {activeTab === 'user-vm' && (
              <div className="glass-card p-8 animate-fade-in">
                <UserVMRental />
              </div>
            )}

            {/* Faucet Access Tab */}
            {activeTab === 'faucet' && (
              <div className="glass-card p-8 animate-fade-in">
                <AdminFaucetTab />
              </div>
            )}

            {/* Solana Signals Admin Tab */}
            {activeTab === 'signals' && (
              <div className="glass-card p-8 animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Zap className="text-yellow-500" />
                    Solana Signals Admin
                  </h2>
                  <p className="text-muted-foreground">Manage signal access, live tokens, and subscriptions</p>
                </div>
                <AdminSignalAccessTab />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
