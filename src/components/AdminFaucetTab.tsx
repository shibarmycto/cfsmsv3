import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Droplets } from 'lucide-react';

interface FaucetRequest {
  id: string;
  user_id: string;
  is_approved: boolean;
  created_at: string;
  email?: string;
}

export default function AdminFaucetTab() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<FaucetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('faucet_access')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get emails
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const emailMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.email]));
      setRequests(data.map(d => ({ ...d, email: emailMap[d.user_id] || 'Unknown' })) as FaucetRequest[]);
    }
    setLoading(false);
  };

  const handleApproval = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from('faucet_access')
      .update({
        is_approved: approved,
        approved_at: approved ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: approved ? 'Approved' : 'Revoked', description: `Faucet access ${approved ? 'granted' : 'revoked'}.` });
      fetchRequests();
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Droplets className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Faucet Access Management</h2>
          <p className="text-muted-foreground">Approve or revoke user access to the SOL Faucet Agent (1 credit/day)</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No faucet access requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-secondary/30 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">{req.email}</p>
                <p className="text-xs text-muted-foreground">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${req.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {req.is_approved ? 'Approved' : 'Pending'}
                </span>
                {!req.is_approved ? (
                  <Button size="sm" onClick={() => handleApproval(req.id, true)} className="bg-green-600 hover:bg-green-700">
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => handleApproval(req.id, false)}>
                    <X className="w-4 h-4 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
