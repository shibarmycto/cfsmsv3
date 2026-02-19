import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Loader2 } from 'lucide-react';

interface BundlerAccess {
  id: string;
  user_id: string;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
  email?: string;
  full_name?: string;
}

export default function AdminBundlerTab() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<BundlerAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState('');

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase.from('bundler_access').select('*').order('created_at', { ascending: false });
    if (data) {
      // Fetch profile info for each
      const enriched = await Promise.all(data.map(async (r: any) => {
        const { data: p } = await supabase.from('profiles').select('email, full_name').eq('user_id', r.user_id).single();
        return { ...r, email: p?.email, full_name: p?.full_name };
      }));
      setRequests(enriched);
    }
    setLoading(false);
  };

  const handleApproval = async (id: string, userId: string, approve: boolean) => {
    setProcessing(id);
    const { error } = await supabase.from('bundler_access').update({
      is_approved: approve,
      approved_at: approve ? new Date().toISOString() : null,
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: approve ? 'Approved' : 'Revoked', description: `Bundler access ${approve ? 'granted' : 'revoked'}.` });
      fetchRequests();
    }
    setProcessing('');
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">CF Bundler Access</h2>
      <p className="text-muted-foreground mb-6">Manage user access to the multi-wallet bundler tool (20 credits/session).</p>

      {requests.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No bundler access requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-secondary/30 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{r.full_name || r.email || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{r.email}</p>
                <p className="text-xs text-muted-foreground">Requested: {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${r.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {r.is_approved ? 'Approved' : 'Pending'}
                </span>
                {!r.is_approved ? (
                  <Button size="sm" onClick={() => handleApproval(r.id, r.user_id, true)} disabled={processing === r.id}>
                    {processing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                    Approve
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => handleApproval(r.id, r.user_id, false)} disabled={processing === r.id}>
                    {processing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                    Revoke
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
