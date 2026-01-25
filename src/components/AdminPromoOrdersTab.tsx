import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Youtube,
  Check,
  X,
  Search,
  ExternalLink,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Coins,
  Wallet,
  CreditCard,
  Eye,
} from 'lucide-react';

interface PromoOrder {
  id: string;
  user_id: string;
  youtube_url: string;
  video_title: string | null;
  package_type: string;
  price_gbp: number;
  payment_method: string;
  crypto_type: string | null;
  tx_hash: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  view_count: number;
}

interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
}

export default function AdminPromoOrdersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PromoOrder[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchUsers();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('promo_orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data as PromoOrder[]);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, email, full_name');
    
    if (data) setUsers(data as UserProfile[]);
  };

  const getUserEmail = (userId: string) => {
    const userProfile = users.find(u => u.user_id === userId);
    return userProfile?.email || userId.slice(0, 8) + '...';
  };

  const handleApprove = async (order: PromoOrder) => {
    setProcessing(order.id);
    
    const now = new Date();
    const days = order.package_type === '7_days' ? 7 : 30;
    const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('promo_orders')
      .update({
        status: 'active',
        reviewed_by: user?.id,
        reviewed_at: now.toISOString(),
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        admin_notes: adminNotes[order.id] || null,
      })
      .eq('id', order.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve order.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Order Approved',
        description: `Video promo is now active for ${days} days.`,
      });
      fetchOrders();
    }
    setProcessing(null);
  };

  const handleReject = async (order: PromoOrder) => {
    setProcessing(order.id);

    const { error } = await supabase
      .from('promo_orders')
      .update({
        status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes[order.id] || null,
      })
      .eq('id', order.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject order.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Order Rejected',
        description: 'The promo order has been rejected.',
      });
      fetchOrders();
    }
    setProcessing(null);
  };

  const handleMarkPaid = async (order: PromoOrder) => {
    setProcessing(order.id);

    const { error } = await supabase
      .from('promo_orders')
      .update({
        status: 'paid',
        admin_notes: adminNotes[order.id] || null,
      })
      .eq('id', order.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update order.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Marked as Paid',
        description: 'Order marked as paid and ready for approval.',
      });
      fetchOrders();
    }
    setProcessing(null);
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    const { error } = await supabase
      .from('promo_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Order Deleted',
        description: 'The promo order has been removed.',
      });
      fetchOrders();
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ReactNode }> = {
      pending: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
      paid: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Coins className="w-3 h-3" /> },
      approved: { className: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Check className="w-3 h-3" /> },
      active: { className: 'bg-primary/20 text-primary border-primary/30', icon: <Play className="w-3 h-3" /> },
      completed: { className: 'bg-muted text-muted-foreground border-muted', icon: <CheckCircle className="w-3 h-3" /> },
      rejected: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: <XCircle className="w-3 h-3" /> },
      expired: { className: 'bg-muted text-muted-foreground border-muted', icon: <Clock className="w-3 h-3" /> },
    };
    const { className, icon } = config[status] || config.pending;
    return (
      <Badge className={`${className} flex items-center gap-1`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'tokens': return <Coins className="w-4 h-4 text-primary" />;
      case 'crypto': return <Wallet className="w-4 h-4 text-orange-500" />;
      case 'manual': return <CreditCard className="w-4 h-4 text-blue-500" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const filteredOrders = orders.filter(order => {
    const userEmail = getUserEmail(order.user_id);
    const searchLower = searchQuery.toLowerCase();
    return (
      userEmail.toLowerCase().includes(searchLower) ||
      order.youtube_url.toLowerCase().includes(searchLower) ||
      (order.video_title && order.video_title.toLowerCase().includes(searchLower)) ||
      order.status.toLowerCase().includes(searchLower)
    );
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending' || o.status === 'paid');
  const activeOrders = filteredOrders.filter(o => o.status === 'active');
  const otherOrders = filteredOrders.filter(o => !['pending', 'paid', 'active'].includes(o.status));

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Youtube className="w-6 h-6 text-destructive" />
            YouTube Promo Orders
          </h2>
          <p className="text-muted-foreground">Manage video promotion submissions</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="pl-10 bg-secondary/50 w-64"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{orders.filter(o => o.status === 'pending').length}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{orders.filter(o => o.status === 'paid').length}</div>
          <div className="text-sm text-muted-foreground">Paid</div>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-primary">{orders.filter(o => o.status === 'active').length}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{orders.length}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
      </div>

      {/* Pending & Paid Orders */}
      {pendingOrders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            Awaiting Action ({pendingOrders.length})
          </h3>
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div key={order.id} className="bg-secondary/30 rounded-lg p-6 border border-yellow-500/20">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(order.status)}
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        {getPaymentIcon(order.payment_method)}
                        {order.payment_method === 'crypto' ? `${order.payment_method} (${order.crypto_type})` : order.payment_method}
                      </span>
                      <span className="text-sm font-medium">
                        {order.package_type === '7_days' ? '7-Day' : '30-Day'} • £{order.price_gbp}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-destructive" />
                      <a 
                        href={order.youtube_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {order.video_title || order.youtube_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {getUserEmail(order.user_id)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <Textarea
                      placeholder="Admin notes (optional)..."
                      value={adminNotes[order.id] || ''}
                      onChange={(e) => setAdminNotes({ ...adminNotes, [order.id]: e.target.value })}
                      className="mt-2 bg-background/50"
                      rows={2}
                    />
                  </div>

                  <div className="flex flex-col gap-2 min-w-[160px]">
                    {order.status === 'pending' && order.payment_method !== 'tokens' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkPaid(order)}
                        disabled={processing === order.id}
                      >
                        <Coins className="w-4 h-4 mr-2" />
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleApprove(order)}
                      disabled={processing === order.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve & Start
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(order)}
                      disabled={processing === order.id}
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

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Currently Active ({activeOrders.length})
          </h3>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Youtube className="w-5 h-5 text-destructive" />
                    <a 
                      href={order.youtube_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {order.video_title || 'View Video'}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{getUserEmail(order.user_id)}</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Eye className="w-4 h-4" />
                      {order.view_count.toLocaleString()} views
                    </span>
                    {order.ends_at && (
                      <span>Ends: {new Date(order.ends_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Orders */}
      {otherOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">
            History ({otherOrders.length})
          </h3>
          <div className="space-y-2">
            {otherOrders.map((order) => (
              <div key={order.id} className="bg-muted/20 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Youtube className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[300px]">{order.video_title || order.youtube_url}</span>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>£{order.price_gbp}</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(order.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Youtube className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No promo orders found.</p>
        </div>
      )}
    </div>
  );
}
