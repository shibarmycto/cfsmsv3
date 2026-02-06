import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, Brain, MessageSquare, Clock, Save, Plus, Trash2,
  RefreshCw, Settings, Volume2, Link2, Sparkles
} from "lucide-react";

interface ReceptionistConfig {
  id: string;
  receptionist_name: string;
  company_name: string | null;
  ai_provider: string;
  ai_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string | null;
  greeting_message: string;
  closing_message: string;
  business_hours: any;
  faq_data: any[];
  linked_voice_profile_id: string | null;
  linked_sip_config_id: string | null;
  is_active: boolean;
}

interface VoiceProfile {
  id: string;
  voice_name: string;
  provider: string;
  training_status: string;
}

interface SIPConfig {
  id: string;
  provider_name: string;
  inbound_number: string | null;
}

const AI_PROVIDERS = [
  { id: 'lovable_ai', name: 'Lovable AI (No API Key Required)', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gpt-5-mini'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { id: 'google', name: 'Google AI', models: ['gemini-pro', 'gemini-ultra'] },
  { id: 'cohere', name: 'Cohere', models: ['command', 'command-light'] },
];

const DEFAULT_SYSTEM_PROMPT = `You are an AI receptionist named {receptionist_name} for {company_name}.

Your role is to:
- Greet callers professionally and warmly
- Answer questions about the business
- Take messages when needed
- Schedule appointments if applicable
- Transfer calls to the appropriate department

Always be:
- Professional and courteous
- Clear and concise
- Helpful and patient
- Accurate with information

Never:
- Share confidential information
- Make promises you can't keep
- Hang up abruptly
- Be rude or dismissive`;

export function AIReceptionistConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ReceptionistConfig | null>(null);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [sipConfigs, setSipConfigs] = useState<SIPConfig[]>([]);
  const [activeTab, setActiveTab] = useState("personality");

  const [formData, setFormData] = useState({
    receptionist_name: "AI Receptionist",
    company_name: "",
    ai_provider: "lovable_ai",
    ai_model: "gemini-2.5-flash",
    temperature: 0.7,
    max_tokens: 500,
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    greeting_message: "Thank you for calling. How may I help you today?",
    closing_message: "Thank you for calling. Have a great day!",
    business_hours: {
      monday: { start: "09:00", end: "17:00", enabled: true },
      tuesday: { start: "09:00", end: "17:00", enabled: true },
      wednesday: { start: "09:00", end: "17:00", enabled: true },
      thursday: { start: "09:00", end: "17:00", enabled: true },
      friday: { start: "09:00", end: "17:00", enabled: true },
      saturday: { start: "10:00", end: "14:00", enabled: false },
      sunday: { start: "00:00", end: "00:00", enabled: false },
    },
    faq_data: [] as { question: string; answer: string }[],
    linked_voice_profile_id: "",
    linked_sip_config_id: "",
    is_active: true,
  });

  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing config
      const { data: configData } = await supabase
        .from('ai_receptionist_configs')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (configData) {
        const typedConfig = configData as unknown as ReceptionistConfig;
        setConfig(typedConfig);
        setFormData({
          receptionist_name: typedConfig.receptionist_name,
          company_name: typedConfig.company_name || "",
          ai_provider: typedConfig.ai_provider,
          ai_model: typedConfig.ai_model,
          temperature: typedConfig.temperature,
          max_tokens: typedConfig.max_tokens,
          system_prompt: typedConfig.system_prompt || DEFAULT_SYSTEM_PROMPT,
          greeting_message: typedConfig.greeting_message,
          closing_message: typedConfig.closing_message,
          business_hours: typedConfig.business_hours,
          faq_data: typedConfig.faq_data || [],
          linked_voice_profile_id: typedConfig.linked_voice_profile_id || "",
          linked_sip_config_id: typedConfig.linked_sip_config_id || "",
          is_active: typedConfig.is_active,
        });
      }

      // Load voice profiles
      const { data: voicesData } = await supabase
        .from('voice_profiles')
        .select('id, voice_name, provider, training_status')
        .eq('training_status', 'completed');
      setVoices((voicesData || []) as unknown as VoiceProfile[]);

      // Load SIP configs
      const { data: sipData } = await supabase
        .from('sip_configurations')
        .select('id, provider_name, inbound_number')
        .eq('is_active', true);
      setSipConfigs((sipData || []) as unknown as SIPConfig[]);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const configData = {
        user_id: user.id,
        receptionist_name: formData.receptionist_name,
        company_name: formData.company_name || null,
        ai_provider: formData.ai_provider,
        ai_model: formData.ai_model,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        system_prompt: formData.system_prompt,
        greeting_message: formData.greeting_message,
        closing_message: formData.closing_message,
        business_hours: formData.business_hours,
        faq_data: formData.faq_data,
        linked_voice_profile_id: formData.linked_voice_profile_id || null,
        linked_sip_config_id: formData.linked_sip_config_id || null,
        is_active: formData.is_active,
      };

      if (config) {
        const { error } = await supabase
          .from('ai_receptionist_configs')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_receptionist_configs')
          .insert(configData);
        if (error) throw error;
      }

      toast({ title: "Configuration saved successfully" });
      loadData();
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

  const addFaq = () => {
    if (newFaq.question && newFaq.answer) {
      setFormData(prev => ({
        ...prev,
        faq_data: [...prev.faq_data, newFaq]
      }));
      setNewFaq({ question: "", answer: "" });
    }
  };

  const removeFaq = (index: number) => {
    setFormData(prev => ({
      ...prev,
      faq_data: prev.faq_data.filter((_, i) => i !== index)
    }));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: {
          ...prev.business_hours[day],
          enabled: !prev.business_hours[day].enabled
        }
      }
    }));
  };

  const updateDayHours = (day: string, field: 'start' | 'end', value: string) => {
    setFormData(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: {
          ...prev.business_hours[day],
          [field]: value
        }
      }
    }));
  };

  const selectedProvider = AI_PROVIDERS.find(p => p.id === formData.ai_provider);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Receptionist
          </h2>
          <p className="text-muted-foreground">Configure your AI-powered call receptionist</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={formData.is_active ? "default" : "secondary"}>
            {formData.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Configuration</>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="personality">
            <Brain className="h-4 w-4 mr-2" />
            Personality
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Provider
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Clock className="h-4 w-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="linking">
            <Link2 className="h-4 w-4 mr-2" />
            Linking
          </TabsTrigger>
        </TabsList>

        {/* Personality Tab */}
        <TabsContent value="personality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Receptionist Identity</CardTitle>
              <CardDescription>Define your AI receptionist's persona</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="receptionist_name">Receptionist Name</Label>
                  <Input
                    id="receptionist_name"
                    value={formData.receptionist_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, receptionist_name: e.target.value }))}
                    placeholder="e.g., Sarah"
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="e.g., CFSMS Solutions"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="system_prompt">System Prompt (Personality Instructions)</Label>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="Define the AI's behavior, tone, and rules..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{receptionist_name}'} and {'{company_name}'} as placeholders
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="font-medium">Enable Receptionist</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, incoming calls will be answered by the AI
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Provider Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>Choose and configure your AI model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>AI Provider</Label>
                <Select
                  value={formData.ai_provider}
                  onValueChange={(value) => {
                    const provider = AI_PROVIDERS.find(p => p.id === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      ai_provider: value,
                      ai_model: provider?.models[0] || ''
                    }));
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.ai_provider === 'lovable_ai' && (
                  <p className="text-xs text-green-500 mt-1">
                    ✓ No API key required—powered by Lovable AI
                  </p>
                )}
              </div>

              <div>
                <Label>Model</Label>
                <Select
                  value={formData.ai_model}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, ai_model: value }))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {selectedProvider?.models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Temperature: {formData.temperature.toFixed(1)}</Label>
                <Slider
                  value={[formData.temperature]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
                  min={0}
                  max={1}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower = more consistent, Higher = more creative
                </p>
              </div>

              <div>
                <Label htmlFor="max_tokens">Max Response Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 500 }))}
                  min={100}
                  max={2000}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Greeting & Closing Messages</CardTitle>
              <CardDescription>Define what the receptionist says at the start and end of calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="greeting_message">Greeting Message</Label>
                <Textarea
                  id="greeting_message"
                  value={formData.greeting_message}
                  onChange={(e) => setFormData(prev => ({ ...prev, greeting_message: e.target.value }))}
                  placeholder="Thank you for calling..."
                />
              </div>

              <div>
                <Label htmlFor="closing_message">Closing Message</Label>
                <Textarea
                  id="closing_message"
                  value={formData.closing_message}
                  onChange={(e) => setFormData(prev => ({ ...prev, closing_message: e.target.value }))}
                  placeholder="Thank you for calling. Have a great day!"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FAQ Knowledge Base</CardTitle>
              <CardDescription>Add common questions and answers for the AI to reference</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Question</Label>
                  <Input
                    value={newFaq.question}
                    onChange={(e) => setNewFaq(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="What are your business hours?"
                  />
                </div>
                <div>
                  <Label>Answer</Label>
                  <Input
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq(prev => ({ ...prev, answer: e.target.value }))}
                    placeholder="We're open Monday-Friday 9am-5pm"
                  />
                </div>
              </div>
              <Button onClick={addFaq} disabled={!newFaq.question || !newFaq.answer}>
                <Plus className="h-4 w-4 mr-2" /> Add FAQ
              </Button>

              {formData.faq_data.length > 0 && (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {formData.faq_data.map((faq, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Q: {faq.question}</p>
                          <p className="text-sm text-muted-foreground">A: {faq.answer}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFaq(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Set when the AI receptionist is available to take calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(formData.business_hours).map(([day, hours]: [string, any]) => (
                  <div key={day} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Switch
                      checked={hours.enabled}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <span className="w-24 font-medium capitalize">{day}</span>
                    <Input
                      type="time"
                      value={hours.start}
                      onChange={(e) => updateDayHours(day, 'start', e.target.value)}
                      disabled={!hours.enabled}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={hours.end}
                      onChange={(e) => updateDayHours(day, 'end', e.target.value)}
                      disabled={!hours.enabled}
                      className="w-32"
                    />
                    {!hours.enabled && (
                      <Badge variant="secondary">Closed</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linking Tab */}
        <TabsContent value="linking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Link Voice Profile
              </CardTitle>
              <CardDescription>Select which cloned voice the receptionist will use</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.linked_voice_profile_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, linked_voice_profile_id: value }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a voice profile" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="">Use Default Voice</SelectItem>
                  {voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.voice_name} ({voice.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {voices.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No trained voice profiles yet. Go to Voice Cloning to create one.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Link SIP Configuration
              </CardTitle>
              <CardDescription>Select which SIP provider to use for inbound calls</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.linked_sip_config_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, linked_sip_config_id: value }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a SIP configuration" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="">No SIP Linked</SelectItem>
                  {sipConfigs.map((sip) => (
                    <SelectItem key={sip.id} value={sip.id}>
                      {sip.provider_name} {sip.inbound_number && `(${sip.inbound_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sipConfigs.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No active SIP configurations. Go to SIP Configuration to set one up.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
