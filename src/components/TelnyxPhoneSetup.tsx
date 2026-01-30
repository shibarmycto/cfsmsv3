import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, Search, ShoppingCart, Link2, Settings, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  ExternalLink, Trash2
} from "lucide-react";

interface PhoneNumber {
  phone_number: string;
  locality?: string;
  region?: string;
  monthly_cost?: { amount: string; currency: string };
}

interface OwnedNumber {
  id: string;
  phone_number: string;
  status: string;
  connection_id?: string;
  connection_name?: string;
}

interface SIPConnection {
  id: string;
  connection_name: string;
  active: boolean;
}

export function TelnyxPhoneSetup() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setup");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  
  // Data states
  const [availableNumbers, setAvailableNumbers] = useState<PhoneNumber[]>([]);
  const [ownedNumbers, setOwnedNumbers] = useState<OwnedNumber[]>([]);
  const [connections, setConnections] = useState<SIPConnection[]>([]);
  const [setupInstructions, setSetupInstructions] = useState<any>(null);
  
  // Search state
  const [searchLocality, setSearchLocality] = useState("");
  const [searchCountry, setSearchCountry] = useState("GB");

  useEffect(() => {
    loadOwnedNumbers();
    loadSetupInstructions();
  }, []);

  const loadSetupInstructions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("telnyx-elevenlabs-setup", {
        body: { action: "get_setup_instructions" }
      });
      if (data && !error) {
        setSetupInstructions(data);
      }
    } catch (error) {
      console.error("Failed to load setup instructions:", error);
    }
  };

  const loadOwnedNumbers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telnyx-phone-numbers", {
        body: { action: "list_owned_numbers" }
      });
      
      if (error) throw error;
      setOwnedNumbers(data?.numbers || []);

      // Also load connections
      const { data: connData } = await supabase.functions.invoke("telnyx-phone-numbers", {
        body: { action: "get_connections" }
      });
      setConnections(connData?.connections || []);
    } catch (error) {
      console.error("Failed to load numbers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load phone numbers"
      });
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
          country_code: searchCountry,
          locality: searchLocality || undefined,
          limit: 20
        }
      });
      
      if (error) throw error;
      setAvailableNumbers(data?.numbers || []);
      
      if (data?.numbers?.length === 0) {
        toast({
          title: "No numbers found",
          description: "Try a different location or country"
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

  const purchaseNumber = async (phoneNumber: string) => {
    setPurchaseLoading(phoneNumber);
    try {
      const { data, error } = await supabase.functions.invoke("telnyx-phone-numbers", {
        body: { 
          action: "purchase_number",
          phone_number: phoneNumber
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Number Purchased!",
        description: `${phoneNumber} is now yours. Assign it to your ElevenLabs connection.`
      });
      
      // Refresh owned numbers
      loadOwnedNumbers();
      // Remove from available list
      setAvailableNumbers(prev => prev.filter(n => n.phone_number !== phoneNumber));
    } catch (error) {
      console.error("Purchase failed:", error);
      toast({
        variant: "destructive",
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Could not purchase number"
      });
    } finally {
      setPurchaseLoading(null);
    }
  };

  const releaseNumber = async (numberId: string, phoneNumber: string) => {
    if (!confirm(`Are you sure you want to release ${phoneNumber}? This cannot be undone.`)) {
      return;
    }
    
    try {
      const { error } = await supabase.functions.invoke("telnyx-phone-numbers", {
        body: { action: "release_number", number_id: numberId }
      });
      
      if (error) throw error;
      
      toast({
        title: "Number Released",
        description: `${phoneNumber} has been released`
      });
      
      loadOwnedNumbers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to release",
        description: error instanceof Error ? error.message : "Could not release number"
      });
    }
  };

  const createElevenLabsConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telnyx-elevenlabs-setup", {
        body: { 
          action: "create_fqdn_connection",
          connection_name: "ElevenLabs-AI-Agent"
        }
      });
      
      if (error) throw error;
      
      toast({
        title: data.isExisting ? "Connection Found" : "Connection Created",
        description: data.message
      });
      
      loadOwnedNumbers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: error instanceof Error ? error.message : "Could not create connection"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Phone Number Setup (Telnyx)
        </CardTitle>
        <CardDescription>
          Get a UK phone number that routes calls to your ElevenLabs AI agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="setup">Setup Guide</TabsTrigger>
            <TabsTrigger value="numbers">Buy Numbers</TabsTrigger>
            <TabsTrigger value="manage">My Numbers</TabsTrigger>
          </TabsList>

          {/* Setup Guide Tab */}
          <TabsContent value="setup" className="space-y-4">
            {setupInstructions ? (
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    How It Works
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Callers → Your Telnyx Number → ElevenLabs AI Agent
                  </p>
                </div>

                <div className="space-y-3">
                  {setupInstructions.steps?.map((step: any) => (
                    <div 
                      key={step.step} 
                      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{step.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                        {step.link && (
                          <a 
                            href={step.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    Important
                  </h4>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    {setupInstructions.important_notes?.map((note: string, i: number) => (
                      <li key={i}>• {note}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button onClick={createElevenLabsConnection} disabled={loading} className="flex-1">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Create ElevenLabs Connection
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://portal.telnyx.com" target="_blank" rel="noopener noreferrer">
                      Telnyx Portal <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading setup instructions...
              </div>
            )}
          </TabsContent>

          {/* Buy Numbers Tab */}
          <TabsContent value="numbers" className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="locality" className="sr-only">City/Area</Label>
                <Input
                  id="locality"
                  placeholder="City or area (e.g., London, Manchester)"
                  value={searchLocality}
                  onChange={(e) => setSearchLocality(e.target.value)}
                />
              </div>
              <Button onClick={searchNumbers} disabled={searchLoading}>
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Search UK</span>
              </Button>
            </div>

            {availableNumbers.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {availableNumbers.map((num) => (
                    <div 
                      key={num.phone_number} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-mono font-medium">{num.phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {num.locality || num.region || "UK"} 
                          {num.monthly_cost && ` • ${num.monthly_cost.amount} ${num.monthly_cost.currency}/mo`}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => purchaseNumber(num.phone_number)}
                        disabled={purchaseLoading === num.phone_number}
                      >
                        {purchaseLoading === num.phone_number ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                        <span className="ml-2">Buy</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Search for available UK phone numbers</p>
                <p className="text-xs mt-1">Leave city empty to see all available</p>
              </div>
            )}
          </TabsContent>

          {/* Manage Numbers Tab */}
          <TabsContent value="manage" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {ownedNumbers.length} number{ownedNumbers.length !== 1 ? "s" : ""} owned
              </p>
              <Button variant="ghost" size="sm" onClick={loadOwnedNumbers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {ownedNumbers.length > 0 ? (
              <div className="space-y-2">
                {ownedNumbers.map((num) => (
                  <div 
                    key={num.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-mono font-medium">{num.phone_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={num.status === "active" ? "default" : "secondary"} className="text-xs">
                          {num.status}
                        </Badge>
                        {num.connection_name && (
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {num.connection_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => releaseNumber(num.id, num.phone_number)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No phone numbers yet</p>
                <p className="text-xs mt-1">Purchase a number to get started</p>
              </div>
            )}

            {connections.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">SIP Connections</h4>
                <div className="space-y-2">
                  {connections.map((conn) => (
                    <div className="flex items-center gap-2 text-sm">
                      {conn.active ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{conn.connection_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
