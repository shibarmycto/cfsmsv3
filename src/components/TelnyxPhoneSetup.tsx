import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, Search, ShoppingCart, Settings, 
  AlertCircle, Loader2, RefreshCw, Clock, Bot, Coins
} from "lucide-react";

interface PhoneNumber {
  phone_number: string;
  locality?: string;
  region?: string;
}

interface PhoneRequest {
  id: string;
  phone_number: string;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  credits_charged: number;
  created_at: string;
}

interface AITwin {
  id: string;
  name: string;
}

const CREDITS_PER_NUMBER = 5;

export function TelnyxPhoneSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  
  // Data states
  const [availableNumbers, setAvailableNumbers] = useState<PhoneNumber[]>([]);
  const [myRequests, setMyRequests] = useState<PhoneRequest[]>([]);
  const [agents, setAgents] = useState<AITwin[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  
  // Search state
  const [searchLocality, setSearchLocality] = useState("");
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    if (user) {
      loadMyRequests();
      loadAgents();
      loadWalletBalance();
    }
  }, [user]);

  const loadWalletBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setWalletBalance(data.balance || 0);
    }
  };

  const loadAgents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_twins')
      .select('id, name')
      .eq('user_id', user.id);
    
    if (data && data.length > 0) {
      setAgents(data);
      setSelectedAgent(data[0].id);
    }
  };

  const loadMyRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('telnyx_phone_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests((data || []) as PhoneRequest[]);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchNumbers = async () => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telnyx-phone-numbers", {
        body: { 
          action: "search_numbers",
          country_code: "GB",
          locality: searchLocality || undefined,
          limit: 20
        }
      });
      
      if (error) throw error;
      setAvailableNumbers(data?.numbers || []);
      
      if (data?.numbers?.length === 0) {
        toast({
          title: "No numbers found",
          description: "Try a different location"
        });
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Could not search numbers"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const requestNumber = async (phoneNumber: string) => {
    if (!user || !selectedAgent) {
      toast({
        variant: "destructive",
        title: "Missing Agent",
        description: "Please create an AI Twin agent first before requesting a number"
      });
      return;
    }

    if (walletBalance < CREDITS_PER_NUMBER) {
      toast({
        variant: "destructive",
        title: "Insufficient Credits",
        description: `You need ${CREDITS_PER_NUMBER} CF Credits. You have ${walletBalance}.`
      });
      return;
    }

    const agent = agents.find(a => a.id === selectedAgent);

    setRequestLoading(phoneNumber);
    try {
      const { error } = await supabase
        .from('telnyx_phone_requests')
        .insert({
          user_id: user.id,
          phone_number: phoneNumber,
          agent_id: selectedAgent,
          agent_name: agent?.name || 'AI Twin',
          credits_charged: CREDITS_PER_NUMBER,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Request Submitted!",
        description: `Your request for ${phoneNumber} is pending admin approval. ${CREDITS_PER_NUMBER} credits will be deducted upon approval.`
      });
      
      // Remove from available list
      setAvailableNumbers(prev => prev.filter(n => n.phone_number !== phoneNumber));
      loadMyRequests();
    } catch (error) {
      console.error("Request failed:", error);
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Could not submit request"
      });
    } finally {
      setRequestLoading(null);
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Phone Number Setup
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Get a UK phone number for your AI agent
          <Badge variant="outline" className="ml-2">
            <Coins className="h-3 w-3 mr-1" />
            {CREDITS_PER_NUMBER} CF Credits per number
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Balance */}
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
          <span className="text-sm text-muted-foreground">Your Balance:</span>
          <span className="font-bold">{walletBalance.toLocaleString()} CF Credits</span>
        </div>

        {/* Agent Selection */}
        {agents.length > 0 ? (
          <div className="space-y-2">
            <Label>Select AI Agent for Phone</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      {agent.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="p-4 border border-warning/30 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Create an AI Twin agent first in the Setup tab
            </p>
          </div>
        )}

        {/* Search Numbers */}
        <div className="space-y-3">
          <Label>Search UK Phone Numbers</Label>
          <div className="flex gap-2">
            <Input
              placeholder="City or area (e.g., London, Manchester)"
              value={searchLocality}
              onChange={(e) => setSearchLocality(e.target.value)}
            />
            <Button onClick={searchNumbers} disabled={searchLoading || agents.length === 0}>
              {searchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Search</span>
            </Button>
          </div>
        </div>

        {/* Available Numbers */}
        {availableNumbers.length > 0 && (
          <div className="space-y-3">
            <Label>Available Numbers</Label>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {availableNumbers.map((num) => (
                  <div 
                    key={num.phone_number} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-mono font-medium">{num.phone_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {num.locality || num.region || "UK"} • {CREDITS_PER_NUMBER} CF Credits
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => requestNumber(num.phone_number)}
                      disabled={requestLoading === num.phone_number || walletBalance < CREDITS_PER_NUMBER}
                    >
                      {requestLoading === num.phone_number ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      <span className="ml-2">Request</span>
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* My Requests */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              My Requests
            </Label>
            <Button variant="ghost" size="sm" onClick={loadMyRequests} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {myRequests.length > 0 ? (
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {myRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-mono font-medium">{req.phone_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.agent_name} • {req.credits_charged} Credits
                      </p>
                    </div>
                    <Badge className={getStatusColor(req.status)}>
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-muted-foreground border rounded-lg">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No phone number requests yet</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-primary/10 p-4 rounded-lg text-sm space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            How it works
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Search and request a UK phone number</li>
            <li>Admin reviews and approves your request</li>
            <li>{CREDITS_PER_NUMBER} CF Credits are deducted from your wallet</li>
            <li>Your AI agent will answer calls on that number</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
