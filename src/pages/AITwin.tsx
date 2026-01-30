import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VoiceChat } from "@/components/VoiceChat";
import { TelnyxPhoneSetup } from "@/components/TelnyxPhoneSetup";
import { 
  Bot, Phone, Brain, Settings, PhoneCall, Clock, 
  Wallet, Trash2, ArrowLeft, Save, Plus, MessageSquare,
  User, Heart, Sparkles, Volume2, Headphones, Smartphone
} from "lucide-react";

interface AITwin {
  id: string;
  name: string;
  personality_traits: string[];
  speaking_style: string;
  tone_calm: number;
  tone_playful: number;
  tone_intuitive: number;
  greeting_message: string;
  custom_instructions: string | null;
  voice_id: string;
  language: string;
  is_active: boolean;
  forwarding_number: string | null;
  cost_per_minute: number;
  total_minutes_used: number;
  total_calls: number;
}

interface CallLog {
  id: string;
  caller_phone: string;
  call_status: string;
  duration_seconds: number;
  tokens_charged: number;
  transcript: any[];
  caller_sentiment: string | null;
  started_at: string;
  ended_at: string | null;
}

interface Memory {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  memory_type: string;
  memory_content: string;
  importance: number;
  created_at: string;
}

// ElevenLabs voices - high quality AI voices
const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (American Female)' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (British Male)' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura (American Female)' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Australian Male)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda (American Female)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (British Male)' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (British Female)' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian (American Male)' },
];

const PERSONALITY_TRAITS = [
  'warm', 'friendly', 'supportive', 'calm', 'playful', 
  'intuitive', 'wise', 'empathetic', 'encouraging', 'patient'
];

export default function AITwin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [twin, setTwin] = useState<AITwin | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalCalls: 0,
    costPerMinute: 1,
    walletBalance: 0,
  });
  const [activeTab, setActiveTab] = useState("voice");

  // Form state
  const [formData, setFormData] = useState({
    name: "My AI Twin",
    personality_traits: ["warm", "friendly", "supportive"],
    speaking_style: "conversational",
    tone_calm: 0.7,
    tone_playful: 0.3,
    tone_intuitive: 0.5,
    greeting_message: "Hey there! How are you feeling today?",
    custom_instructions: "",
    voice_id: "JBFqnCBsd6RMkjVDRZzb",
    language: "en-GB",
    is_active: true,
    forwarding_number: "",
    cost_per_minute: 1,
    elevenlabs_agent_id: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load twin
      const { data: twinData } = await supabase.functions.invoke('ai-twin-manage', {
        body: { action: 'get_twin' }
      });
      
      if (twinData?.twin) {
        setTwin(twinData.twin);
        setFormData({
          name: twinData.twin.name || "My AI Twin",
          personality_traits: twinData.twin.personality_traits || ["warm", "friendly", "supportive"],
          speaking_style: twinData.twin.speaking_style || "conversational",
          tone_calm: twinData.twin.tone_calm ?? 0.7,
          tone_playful: twinData.twin.tone_playful ?? 0.3,
          tone_intuitive: twinData.twin.tone_intuitive ?? 0.5,
          greeting_message: twinData.twin.greeting_message || "Hey there! How are you feeling today?",
          custom_instructions: twinData.twin.custom_instructions || "",
          voice_id: twinData.twin.voice_id || "JBFqnCBsd6RMkjVDRZzb",
          language: twinData.twin.language || "en-GB",
          is_active: twinData.twin.is_active ?? true,
          forwarding_number: twinData.twin.forwarding_number || "",
          cost_per_minute: twinData.twin.cost_per_minute || 1,
          elevenlabs_agent_id: (twinData.twin as any).elevenlabs_agent_id || "",
        });
      }

      // Load calls
      const { data: callsData } = await supabase.functions.invoke('ai-twin-manage', {
        body: { action: 'get_calls' }
      });
      if (callsData?.calls) {
        setCalls(callsData.calls);
      }

      // Load memories
      const { data: memoriesData } = await supabase.functions.invoke('ai-twin-manage', {
        body: { action: 'get_memories' }
      });
      if (memoriesData?.memories) {
        setMemories(memoriesData.memories);
      }

      // Load stats
      const { data: statsData } = await supabase.functions.invoke('ai-twin-manage', {
        body: { action: 'get_stats' }
      });
      if (statsData?.stats) {
        setStats(statsData.stats);
      }

    } catch (error) {
      console.error("Error loading AI Twin data:", error);
      toast({
        title: "Error",
        description: "Failed to load AI Twin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const action = twin ? 'update_twin' : 'create_twin';
      const { data, error } = await supabase.functions.invoke('ai-twin-manage', {
        body: { action, config: formData }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to save");
      }

      toast({
        title: "Success",
        description: twin ? "AI Twin updated successfully" : "AI Twin created successfully",
      });
      
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save AI Twin",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await supabase.functions.invoke('ai-twin-manage', {
        body: { action: 'delete_memory', memoryId }
      });
      setMemories(prev => prev.filter(m => m.id !== memoryId));
      toast({ title: "Memory deleted" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete memory",
        variant: "destructive",
      });
    }
  };

  const toggleTrait = (trait: string) => {
    setFormData(prev => ({
      ...prev,
      personality_traits: prev.personality_traits.includes(trait)
        ? prev.personality_traits.filter(t => t !== trait)
        : [...prev.personality_traits, trait]
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading AI Twin...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">AI Virtual Twin</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={twin?.is_active ? "default" : "secondary"}>
                {twin?.is_active ? "Active" : "Inactive"}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span>{stats.walletBalance.toLocaleString()} tokens</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <PhoneCall className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalMinutes.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Minutes Used</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{memories.length}</p>
                <p className="text-xs text-muted-foreground">Memories</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wallet className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.costPerMinute}</p>
                <p className="text-xs text-muted-foreground">Token/Min</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 mb-6">
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Phone</span>
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
            <TabsTrigger value="personality" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Personality</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="memories" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Memories</span>
            </TabsTrigger>
          </TabsList>

          {/* Voice Chat Tab - Browser-based voice */}
          <TabsContent value="voice">
            <div className="grid md:grid-cols-2 gap-6">
              <VoiceChat
                twinName={formData.name}
                greeting={formData.greeting_message}
                agentId={formData.elevenlabs_agent_id}
                onCallStart={() => {
                  console.log("Voice call started");
                }}
                onCallEnd={(duration) => {
                  console.log("Voice call ended, duration:", duration);
                }}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    ElevenLabs Agent Setup
                  </CardTitle>
                  <CardDescription>
                    Connect your custom ElevenLabs agent for voice conversations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="elevenlabs_agent_id">ElevenLabs Agent ID</Label>
                    <Input
                      id="elevenlabs_agent_id"
                      value={formData.elevenlabs_agent_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, elevenlabs_agent_id: e.target.value }))}
                      placeholder="Your ElevenLabs Agent ID"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a free agent at{" "}
                      <a 
                        href="https://elevenlabs.io/agents" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        elevenlabs.io/agents
                      </a>
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Quick Setup Guide</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Go to <strong>elevenlabs.io/agents</strong></li>
                      <li>Click "Create Agent" and choose a template or start blank</li>
                      <li>Configure the agent's voice and personality</li>
                      <li>Copy the Agent ID from the settings</li>
                      <li>Paste it above and save</li>
                    </ol>
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      ✨ ElevenLabs offers realistic AI voices with UK accents and works directly in your browser—no phone number needed!
                    </p>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? "Saving..." : "Save Agent ID"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Phone Tab - Telnyx phone numbers for mobile calls */}
          <TabsContent value="phone">
            <div className="grid md:grid-cols-2 gap-6">
              <TelnyxPhoneSetup />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    How Phone Calls Work
                  </CardTitle>
                  <CardDescription>
                    Get a UK phone number that answers calls with your AI agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-3">Call Flow</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-background rounded">📱 Caller</span>
                      <span>→</span>
                      <span className="px-2 py-1 bg-background rounded">📞 Telnyx</span>
                      <span>→</span>
                      <span className="px-2 py-1 bg-primary/20 text-primary rounded">🤖 AI Agent</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>UK phone numbers for 5 CF Credits</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>Admin approval required before activation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>Calls routed to your ElevenLabs AI agent</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>Works as a receptionist, assistant, or companion</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> Credits are only deducted once your request is approved by an admin.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Setup Tab */}
          <TabsContent value="setup">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Basic Configuration
                  </CardTitle>
                  <CardDescription>
                    Set up your AI Twin's identity and phone settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Twin Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My AI Twin"
                    />
                  </div>

                  <div>
                    <Label htmlFor="forwarding">Your Phone Number (for call forwarding)</Label>
                    <Input
                      id="forwarding"
                      value={formData.forwarding_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, forwarding_number: e.target.value }))}
                      placeholder="+44XXXXXXXXXX"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Forward calls from this number to your AI Twin
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active</Label>
                      <p className="text-xs text-muted-foreground">Enable/disable your AI Twin</p>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                  </div>

                  <div>
                    <Label>Cost Per Minute (tokens)</Label>
                    <Select
                      value={formData.cost_per_minute.toString()}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, cost_per_minute: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 token/min</SelectItem>
                        <SelectItem value="2">2 tokens/min</SelectItem>
                        <SelectItem value="5">5 tokens/min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Voice Settings
                  </CardTitle>
                  <CardDescription>
                    Choose how your AI Twin sounds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Voice</Label>
                    <Select
                      value={formData.voice_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, voice_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ELEVENLABS_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Language</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="es-ES">Spanish</SelectItem>
                        <SelectItem value="fr-FR">French</SelectItem>
                        <SelectItem value="de-DE">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="greeting">Greeting Message</Label>
                    <Textarea
                      id="greeting"
                      value={formData.greeting_message}
                      onChange={(e) => setFormData(prev => ({ ...prev, greeting_message: e.target.value }))}
                      placeholder="Hey there! How are you feeling today?"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Call Forwarding Instructions */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    How to Set Up Call Forwarding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="font-medium">To receive calls on your AI Twin:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Enter your phone number above (with country code)</li>
                      <li>Save your configuration</li>
                      <li>On your phone, set up call forwarding to: <code className="bg-background px-2 py-1 rounded">+1 (Twilio number - coming soon)</code></li>
                      <li>When someone calls your number, they'll speak with your AI Twin!</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-4">
                      💡 Your wallet will be charged {formData.cost_per_minute} token(s) per minute of call time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Personality Tab */}
          <TabsContent value="personality">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Personality Traits
                  </CardTitle>
                  <CardDescription>
                    Select the traits that define your AI Twin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {PERSONALITY_TRAITS.map((trait) => (
                      <Badge
                        key={trait}
                        variant={formData.personality_traits.includes(trait) ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleTrait(trait)}
                      >
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Speaking Style</CardTitle>
                  <CardDescription>How should your AI Twin communicate?</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.speaking_style}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, speaking_style: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conversational">Conversational & Natural</SelectItem>
                      <SelectItem value="professional">Professional & Polished</SelectItem>
                      <SelectItem value="casual">Casual & Relaxed</SelectItem>
                      <SelectItem value="empathetic">Deeply Empathetic</SelectItem>
                      <SelectItem value="wise">Wise & Thoughtful</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Tone Balance</CardTitle>
                  <CardDescription>Adjust the emotional balance of responses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Calm & Soothing</Label>
                      <span className="text-sm text-muted-foreground">{(formData.tone_calm * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[formData.tone_calm]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, tone_calm: value }))}
                      max={1}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Playful & Light</Label>
                      <span className="text-sm text-muted-foreground">{(formData.tone_playful * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[formData.tone_playful]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, tone_playful: value }))}
                      max={1}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Intuitive & Insightful</Label>
                      <span className="text-sm text-muted-foreground">{(formData.tone_intuitive * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[formData.tone_intuitive]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, tone_intuitive: value }))}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Custom Instructions</CardTitle>
                  <CardDescription>
                    Add specific instructions, background info, or personality details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.custom_instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, custom_instructions: e.target.value }))}
                    placeholder="Example: You represent me, John. I'm a life coach who loves helping people find their path. Always remind callers that they have the power within them..."
                    rows={5}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5" />
                  Call History
                </CardTitle>
                <CardDescription>
                  View all calls your AI Twin has handled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {calls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No calls yet</p>
                      <p className="text-sm">Your AI Twin is ready to receive calls!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {calls.map((call) => (
                        <div
                          key={call.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="font-medium">{call.caller_phone}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Wallet className="h-3 w-3" />
                                  {call.tokens_charged} tokens
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={call.call_status === 'completed' ? 'default' : 'secondary'}>
                                {call.call_status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(call.started_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {call.transcript && call.transcript.length > 0 && (
                            <details className="mt-3">
                              <summary className="text-sm text-primary cursor-pointer">
                                View Transcript ({call.transcript.length} messages)
                              </summary>
                              <div className="mt-2 space-y-2 text-sm">
                                {call.transcript.slice(0, 10).map((msg: any, idx: number) => (
                                  <div key={idx} className={`p-2 rounded ${msg.role === 'user' ? 'bg-muted' : 'bg-primary/10'}`}>
                                    <span className="font-medium capitalize">{msg.role}:</span> {msg.content}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memories Tab */}
          <TabsContent value="memories">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Caller Memories
                </CardTitle>
                <CardDescription>
                  Your AI Twin remembers these details about callers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {memories.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No memories yet</p>
                      <p className="text-sm">Memories are created from conversations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memories.map((memory) => (
                        <div
                          key={memory.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="capitalize">
                                  {memory.memory_type}
                                </Badge>
                                <span className="text-sm text-muted-foreground">{memory.caller_phone}</span>
                                {memory.caller_name && (
                                  <span className="text-sm font-medium">({memory.caller_name})</span>
                                )}
                              </div>
                              <p className="text-sm">{memory.memory_content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(memory.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteMemory(memory.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="fixed bottom-6 right-6">
          <Button 
            size="lg" 
            onClick={handleSave} 
            disabled={saving}
            className="shadow-lg"
          >
            {saving ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {twin ? "Save Changes" : "Create AI Twin"}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
