import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, Check, X, Loader2, RefreshCw, User, Bot, Clock 
} from "lucide-react";

interface PhoneRequest {
  id: string;
  user_id: string;
  phone_number: string;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  credits_charged: number;
  admin_notes: string | null;
  telnyx_number_id: string | null;
  created_at: string;
}

export default function AdminPhoneRequestsTab() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PhoneRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('telnyx_phone_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as PhoneRequest[]);

      // Load user emails
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        
        if (profiles) {
          const emailMap: Record<string, string> = {};
          profiles.forEach((p: any) => {
            emailMap[p.user_id] = p.email;
          });
          setUserEmails(emailMap);
        }
      }
    } catch (error) {
      console.error("Failed to load requests:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load phone requests"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: PhoneRequest) => {
    if (!confirm(`Approve request for ${request.phone_number}?\n\nThis will:\n- Deduct ${request.credits_charged} CF Credits from the user\n- Purchase the Telnyx number\n- Assign it to their AI agent`)) {
      return;
    }

    setProcessing(request.id);
    try {
      // First check if user has enough credits
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', request.user_id)
        .single();

      if (walletError || !wallet) {
        throw new Error("User wallet not found");
      }

      if (wallet.balance < request.credits_charged) {
        throw new Error(`User only has ${wallet.balance} credits, needs ${request.credits_charged}`);
      }

      // Purchase the number via Telnyx
      const { data: purchaseResult, error: purchaseError } = await supabase.functions.invoke(
        "telnyx-phone-numbers",
        { body: { action: "purchase_number", phone_number: request.phone_number } }
      );

      if (purchaseError || purchaseResult?.error) {
        throw new Error(purchaseResult?.error || "Failed to purchase number from Telnyx");
      }

      // Deduct credits from user wallet
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ 
          balance: wallet.balance - request.credits_charged,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (deductError) {
        throw new Error("Failed to deduct credits");
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('telnyx_phone_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          telnyx_number_id: purchaseResult?.order?.id || null
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast({
        title: "Request Approved",
        description: `Number ${request.phone_number} purchased and ${request.credits_charged} credits deducted.`
      });

      loadRequests();
    } catch (error) {
      console.error("Approval failed:", error);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Could not approve request"
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt("Rejection reason (optional):");
    
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('telnyx_phone_requests')
        .update({
          status: 'rejected',
          admin_notes: reason || 'Rejected by admin',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: "Phone number request has been rejected."
      });

      loadRequests();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: "Could not reject request"
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning text-warning-foreground';
      case 'approved': return 'bg-success text-success-foreground';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary';
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            Phone Number Requests
          </h2>
          <p className="text-muted-foreground">
            Approve or reject Telnyx phone number requests (5 credits each)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Pending Requests */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          Pending Requests ({pendingRequests.length})
        </h3>
        
        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No pending phone number requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div 
                key={req.id} 
                className="border border-warning/30 bg-warning/5 rounded-lg p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold">{req.phone_number}</span>
                      <Badge className={getStatusColor(req.status)}>
                        {req.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {userEmails[req.user_id] || req.user_id.slice(0, 8)}
                      </span>
                      {req.agent_name && (
                        <span className="flex items-center gap-1">
                          <Bot className="h-4 w-4" />
                          {req.agent_name}
                        </span>
                      )}
                      <span>{req.credits_charged} CF Credits</span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Requested: {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApprove(req)}
                      disabled={processing === req.id}
                      className="bg-success hover:bg-success/90"
                    >
                      {processing === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(req.id)}
                      disabled={processing === req.id}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      <div>
        <h3 className="text-lg font-semibold mb-4">History ({processedRequests.length})</h3>
        
        {processedRequests.length > 0 && (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {processedRequests.map((req) => (
                <div 
                  key={req.id} 
                  className="border rounded-lg p-3 bg-secondary/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{req.phone_number}</span>
                      <Badge className={getStatusColor(req.status)}>
                        {req.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {userEmails[req.user_id] || req.user_id.slice(0, 8)}
                    </span>
                  </div>
                  {req.admin_notes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Note: {req.admin_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
