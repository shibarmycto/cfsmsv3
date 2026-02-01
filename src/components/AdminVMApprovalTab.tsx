import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Coins,
  User,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface VMRental {
  id: string;
  user_id: string;
  plan_type: string;
  credits_paid: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  status: string;
  user_email?: string;
}

export default function AdminVMApprovalTab() {
  const [rentals, setRentals] = useState<VMRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'expired'>('all');

  useEffect(() => {
    fetchRentals();
  }, []);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vm_rentals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const emailMap = new Map((profiles || []).map((p: any) => [p.user_id, p.email]));

      const rentalsWithEmails = (data || []).map((r: any) => ({
        ...r,
        user_email: emailMap.get(r.user_id) || 'Unknown'
      }));

      setRentals(rentalsWithEmails);
    } catch (error) {
      console.error('Error fetching rentals:', error);
      toast.error('Failed to load VM rentals');
    } finally {
      setLoading(false);
    }
  };

  const updateRentalStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('vm_rentals')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(isActive ? 'VM activated' : 'VM deactivated');
      fetchRentals();
    } catch (error) {
      console.error('Error updating rental:', error);
      toast.error('Failed to update rental');
    }
  };

  const extendRental = async (id: string, hours: number) => {
    try {
      const rental = rentals.find(r => r.id === id);
      if (!rental) return;

      const currentExpiry = new Date(rental.expires_at);
      currentExpiry.setHours(currentExpiry.getHours() + hours);

      const { error } = await supabase
        .from('vm_rentals')
        .update({ expires_at: currentExpiry.toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Extended by ${hours} hours`);
      fetchRentals();
    } catch (error) {
      console.error('Error extending rental:', error);
      toast.error('Failed to extend rental');
    }
  };

  const filteredRentals = rentals.filter(r => {
    const now = new Date();
    const expiry = new Date(r.expires_at);
    
    switch (filter) {
      case 'active':
        return r.is_active && expiry > now;
      case 'expired':
        return expiry <= now;
      case 'pending':
        return !r.is_active && expiry > now;
      default:
        return true;
    }
  });

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const remaining = expiry - now;

    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const stats = {
    total: rentals.length,
    active: rentals.filter(r => r.is_active && new Date(r.expires_at) > new Date()).length,
    expired: rentals.filter(r => new Date(r.expires_at) <= new Date()).length,
    revenue: rentals.reduce((sum, r) => sum + r.credits_paid, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl p-4 border border-cyan-500/30">
          <Monitor className="w-6 h-6 text-cyan-400 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Rentals</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl p-4 border border-green-500/30">
          <CheckCircle className="w-6 h-6 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.active}</p>
          <p className="text-sm text-gray-400">Active Now</p>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-rose-600/20 rounded-xl p-4 border border-red-500/30">
          <XCircle className="w-6 h-6 text-red-400 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.expired}</p>
          <p className="text-sm text-gray-400">Expired</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 rounded-xl p-4 border border-yellow-500/30">
          <Coins className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.revenue}</p>
          <p className="text-sm text-gray-400">Credits Earned</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'pending', 'expired'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={fetchRentals} className="ml-auto">
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Rentals List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filteredRentals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No VM rentals found</p>
            </div>
          ) : (
            filteredRentals.map((rental) => {
              const isExpired = new Date(rental.expires_at) <= new Date();
              
              return (
                <div 
                  key={rental.id}
                  className="bg-card/50 border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-white">{rental.user_email}</span>
                        <Badge variant={rental.plan_type === '7d' ? 'default' : 'secondary'}>
                          {rental.plan_type === '7d' ? '7-Day' : '24-Hour'}
                        </Badge>
                        <Badge variant={isExpired ? 'destructive' : rental.is_active ? 'default' : 'secondary'}>
                          {isExpired ? 'Expired' : rental.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Coins className="w-3 h-3" />
                          {rental.credits_paid} credits
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(rental.started_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimeRemaining(rental.expires_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {!isExpired && (
                        <>
                          <Button
                            size="sm"
                            variant={rental.is_active ? 'destructive' : 'default'}
                            onClick={() => updateRentalStatus(rental.id, !rental.is_active)}
                          >
                            {rental.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => extendRental(rental.id, 24)}
                          >
                            +24h
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
