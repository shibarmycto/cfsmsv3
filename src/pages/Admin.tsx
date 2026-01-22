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
} from 'lucide-react';

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

export default function Admin() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('pending');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [senderRequests, setSenderRequests] = useState<SenderIdRequest[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [cryptoOrders, setCryptoOrders] = useState<CryptoOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [creditAmounts, setCreditAmounts] = useState<{ [key: string]: string }>({});

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
    }
  }, [isAdmin]);

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
                { id: 'crypto', icon: Wallet, label: 'Crypto Orders', count: cryptoOrders.filter(o => o.status === 'pending').length },
                { id: 'purchases', icon: ShoppingCart, label: 'Purchase Requests', count: purchaseRequests.length },
                { id: 'users', icon: Users, label: 'All Users', count: approvedUsers.length },
                { id: 'sender-ids', icon: MessageSquare, label: 'Sender ID Requests', count: senderRequests.length },
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
