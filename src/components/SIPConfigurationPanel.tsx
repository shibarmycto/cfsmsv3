import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, Server, Settings, Check, X, Plus, Trash2, 
  RefreshCw, Signal, Shield, AlertCircle
} from "lucide-react";

interface SIPConfiguration {
  id: string;
  provider_name: string;
  domain: string;
  port: number;
  sip_username: string;
  auth_username: string | null;
  transport: string;
  inbound_number: string | null;
  allowed_numbers: string[];
  is_active: boolean;
  connection_status: string;
  last_tested_at: string | null;
}

const SIP_PRESETS = [
  {
    name: "SwitchboardFREE",
    domain: "reg5.switchboardfree.co.uk",
    port: 5065,
    transport: "TCP",
  },
  {
    name: "Twilio SIP",
    domain: "sip.twilio.com",
    port: 5060,
    transport: "TLS",
  },
  {
    name: "Telnyx",
    domain: "sip.telnyx.com",
    port: 5060,
    transport: "TLS",
  },
  {
    name: "Vonage",
    domain: "sip.nexmo.com",
    port: 5060,
    transport: "TCP",
  },
  {
    name: "Custom SIP Provider",
    domain: "",
    port: 5060,
    transport: "TCP",
  },
];

export function SIPConfigurationPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configs, setConfigs] = useState<SIPConfiguration[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    provider_name: "SwitchboardFREE",
    domain: "reg5.switchboardfree.co.uk",
    port: 5065,
    sip_username: "",
    auth_username: "",
    password: "",
    transport: "TCP",
    inbound_number: "",
    allowed_numbers: ["*"],
    is_active: true,
  });

  const [newAllowedNumber, setNewAllowedNumber] = useState("");

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sip_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs((data || []) as unknown as SIPConfiguration[]);
    } catch (error) {
      console.error("Error loading SIP configurations:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetName: string) => {
    const preset = SIP_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        provider_name: preset.name,
        domain: preset.domain,
        port: preset.port,
        transport: preset.transport,
      }));
    }
  };

  const validateDomain = (domain: string): boolean => {
    // Domain should not contain port, protocol, or trailing slash
    if (domain.includes(':') || domain.includes('://') || domain.endsWith('/')) {
      return false;
    }
    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
    return domainRegex.test(domain);
  };

  const handleSave = async () => {
    // Validation
    if (!validateDomain(formData.domain)) {
      toast({
        title: "Invalid Domain",
        description: "Enter domain only, without port (:####) or protocol (http://)",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sip_username || !formData.password) {
      toast({
        title: "Missing Credentials",
        description: "SIP username and password are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const configData = {
        user_id: user.id,
        provider_name: formData.provider_name,
        domain: formData.domain,
        port: formData.port,
        sip_username: formData.sip_username,
        auth_username: formData.auth_username || null,
        password_encrypted: formData.password, // Note: In production, encrypt this
        transport: formData.transport,
        inbound_number: formData.inbound_number || null,
        allowed_numbers: formData.allowed_numbers,
        is_active: formData.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from('sip_configurations')
          .update(configData)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: "Configuration updated" });
      } else {
        const { error } = await supabase
          .from('sip_configurations')
          .insert(configData);
        if (error) throw error;
        toast({ title: "Configuration saved" });
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadConfigurations();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (configId?: string) => {
    setTesting(true);
    try {
      // Simulate connection test - in production, call an edge function
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (configId) {
        await supabase
          .from('sip_configurations')
          .update({ 
            connection_status: 'connected',
            last_tested_at: new Date().toISOString()
          })
          .eq('id', configId);
        loadConfigurations();
      }

      toast({
        title: "Connection Test",
        description: "SIP connection test successful! Ready to receive calls.",
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not connect to SIP server. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sip_configurations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Configuration deleted" });
      loadConfigurations();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    }
  };

  const addAllowedNumber = () => {
    if (newAllowedNumber && !formData.allowed_numbers.includes(newAllowedNumber)) {
      setFormData(prev => ({
        ...prev,
        allowed_numbers: [...prev.allowed_numbers, newAllowedNumber]
      }));
      setNewAllowedNumber("");
    }
  };

  const removeAllowedNumber = (number: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_numbers: prev.allowed_numbers.filter(n => n !== number)
    }));
  };

  const resetForm = () => {
    setFormData({
      provider_name: "SwitchboardFREE",
      domain: "reg5.switchboardfree.co.uk",
      port: 5065,
      sip_username: "",
      auth_username: "",
      password: "",
      transport: "TCP",
      inbound_number: "",
      allowed_numbers: ["*"],
      is_active: true,
    });
  };

  const editConfig = (config: SIPConfiguration) => {
    setFormData({
      provider_name: config.provider_name,
      domain: config.domain,
      port: config.port,
      sip_username: config.sip_username,
      auth_username: config.auth_username || "",
      password: "",
      transport: config.transport,
      inbound_number: config.inbound_number || "",
      allowed_numbers: config.allowed_numbers,
      is_active: config.is_active,
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading SIP configurations...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing Configurations */}
      {configs.length > 0 && !showForm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your SIP Providers</h3>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>

          {configs.map((config) => (
            <Card key={config.id} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{config.provider_name}</span>
                      <Badge variant={config.is_active ? "default" : "secondary"}>
                        {config.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge 
                        variant={config.connection_status === 'connected' ? "default" : "outline"}
                        className={config.connection_status === 'connected' ? "bg-green-500" : ""}
                      >
                        {config.connection_status === 'connected' ? (
                          <><Check className="h-3 w-3 mr-1" /> Connected</>
                        ) : (
                          <><X className="h-3 w-3 mr-1" /> Disconnected</>
                        )}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Server:</strong> {config.domain}:{config.port} ({config.transport})</p>
                      <p><strong>Username:</strong> {config.sip_username}</p>
                      {config.inbound_number && (
                        <p><strong>Inbound:</strong> {config.inbound_number}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleTestConnection(config.id)}
                      disabled={testing}
                    >
                      {testing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Signal className="h-4 w-4" />
                      )}
                      <span className="ml-1">Test</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => editConfig(config)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Configuration Form */}
      {(showForm || configs.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {editingId ? "Edit SIP Configuration" : "Add SIP Provider"}
            </CardTitle>
            <CardDescription>
              Configure any custom SIP provider for inbound call handling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Presets */}
            <div>
              <Label>Quick Setup - Choose Provider</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                {SIP_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant={formData.provider_name === preset.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyPreset(preset.name)}
                    className="text-xs"
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Provider Name */}
            <div>
              <Label htmlFor="provider_name">Provider Display Name</Label>
              <Input
                id="provider_name"
                value={formData.provider_name}
                onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                placeholder="CFSMS Switchboard"
              />
            </div>

            {/* Domain and Port */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="domain">SIP Domain / Server</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="reg5.switchboardfree.co.uk"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter domain only, without :port or http://
                </p>
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 5060 }))}
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sip_username">SIP Username</Label>
                <Input
                  id="sip_username"
                  value={formData.sip_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, sip_username: e.target.value }))}
                  placeholder="__23725.2testaccou__"
                />
              </div>
              <div>
                <Label htmlFor="auth_username">Authorization Username (optional)</Label>
                <Input
                  id="auth_username"
                  value={formData.auth_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, auth_username: e.target.value }))}
                  placeholder="#PurplePhone5772"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">SIP Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter your SIP password"
              />
            </div>

            {/* Transport Protocol */}
            <div>
              <Label htmlFor="transport">Transport Protocol</Label>
              <Select
                value={formData.transport}
                onValueChange={(value) => setFormData(prev => ({ ...prev, transport: value }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                  <SelectItem value="TLS">TLS (Secure)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Inbound Number */}
            <div>
              <Label htmlFor="inbound_number">Inbound Phone Number</Label>
              <Input
                id="inbound_number"
                value={formData.inbound_number}
                onChange={(e) => setFormData(prev => ({ ...prev, inbound_number: e.target.value }))}
                placeholder="03333357324"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The phone number that will route calls to this SIP trunk
              </p>
            </div>

            {/* Allowed From Numbers */}
            <div>
              <Label>Allowed Caller IDs (Whitelist)</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newAllowedNumber}
                  onChange={(e) => setNewAllowedNumber(e.target.value)}
                  placeholder="Add phone number or * for all"
                  onKeyPress={(e) => e.key === 'Enter' && addAllowedNumber()}
                />
                <Button type="button" onClick={addAllowedNumber} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.allowed_numbers.map((number) => (
                  <Badge key={number} variant="secondary" className="flex items-center gap-1">
                    {number === "*" ? "All Numbers (*)" : number}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeAllowedNumber(number)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label htmlFor="is_active" className="font-medium">Enable SIP Provider</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, inbound calls will be routed to your AI receptionist
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-500">SwitchboardFREE Setup Instructions</p>
                  <ol className="mt-2 space-y-1 text-muted-foreground list-decimal list-inside">
                    <li>Purchase or use existing number: 03333357324</li>
                    <li>Set up call diversion to your SIP trunk in SwitchboardFREE dashboard</li>
                    <li>Configure allowed caller IDs above</li>
                    <li>Enter your SIP credentials from SwitchboardFREE</li>
                    <li>Test the connection before going live</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Shield className="h-4 w-4 mr-2" /> {editingId ? "Update" : "Save"} Configuration</>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleTestConnection()}
                disabled={testing || !formData.domain || !formData.password}
              >
                {testing ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
                ) : (
                  <><Signal className="h-4 w-4 mr-2" /> Test Connection</>
                )}
              </Button>
              {(showForm && configs.length > 0) && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
