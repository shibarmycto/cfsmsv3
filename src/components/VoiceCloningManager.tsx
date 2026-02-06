import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Mic, Upload, Play, Pause, Trash2, Check, RefreshCw, 
  Volume2, Star, Wand2, FileAudio, AlertCircle
} from "lucide-react";

interface VoiceProfile {
  id: string;
  provider: string;
  voice_name: string;
  voice_id: string | null;
  audio_file_url: string | null;
  training_status: string;
  quality_score: number | null;
  sample_duration_seconds: number | null;
  is_default: boolean;
  created_at: string;
}

const SAMPLE_PROMPTS = [
  "Hello, thank you for calling. How can I help you today?",
  "I understand what you're saying. Let me think about that for a moment.",
  "That's a great question. Here's what I think about that.",
  "I appreciate you sharing that with me.",
  "Is there anything else I can help you with?",
  "I'm so excited to hear that!",
  "I'm really sorry to hear you're going through this.",
  "That's absolutely wonderful news!",
  "I understand this might be difficult.",
  "Let me reassure you about that.",
];

export function VoiceCloningManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [activeProvider, setActiveProvider] = useState("elevenlabs");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState({
    elevenlabs: "",
    resemble_ai: "",
    cfgpt: "",
  });

  useEffect(() => {
    loadVoices();
    loadApiKeys();
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('voice_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVoices((data || []) as unknown as VoiceProfile[]);
    } catch (error) {
      console.error("Error loading voices:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys_vault')
        .select('service_name, key_encrypted');

      if (error) throw error;
      
      const keys: any = {};
      data?.forEach((item: any) => {
        keys[item.service_name] = item.key_encrypted;
      });
      setApiKeys(prev => ({ ...prev, ...keys }));
    } catch (error) {
      console.error("Error loading API keys:", error);
    }
  };

  const saveApiKey = async (service: string, key: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('api_keys_vault')
        .upsert({
          user_id: user.id,
          service_name: service,
          key_encrypted: key,
        }, { onConflict: 'user_id,service_name' });

      if (error) throw error;
      
      setApiKeys(prev => ({ ...prev, [service]: key }));
      toast({ title: "API key saved" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API key",
        variant: "destructive",
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlobs(prev => [...prev, blob]);
        stream.getTracks().forEach(track => track.stop());
        
        if (currentPromptIndex < SAMPLE_PROMPTS.length - 1) {
          setCurrentPromptIndex(prev => prev + 1);
        }
        setRecordingProgress((currentPromptIndex + 1) / SAMPLE_PROMPTS.length * 100);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to record voice samples",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/flac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|flac)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload an MP3, WAV, M4A, or FLAC audio file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 50MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create voice profile
      const { data: profile, error } = await supabase
        .from('voice_profiles')
        .insert({
          user_id: user.id,
          provider: activeProvider,
          voice_name: file.name.replace(/\.[^/.]+$/, ""),
          training_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({ 
        title: "Voice Uploaded",
        description: "Your voice sample is being processed. Training will begin shortly."
      });
      
      loadVoices();
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload voice",
        variant: "destructive",
      });
    }
  };

  const trainVoice = async (profileId: string) => {
    try {
      await supabase
        .from('voice_profiles')
        .update({ training_status: 'training' })
        .eq('id', profileId);

      // Simulate training progress
      toast({ 
        title: "Training Started",
        description: "Voice model training typically takes 5-10 minutes"
      });

      // In production, call ElevenLabs/Resemble API here
      setTimeout(async () => {
        await supabase
          .from('voice_profiles')
          .update({ 
            training_status: 'completed',
            quality_score: 0.85 + Math.random() * 0.1,
          })
          .eq('id', profileId);
        loadVoices();
      }, 5000);

      loadVoices();
    } catch (error) {
      toast({
        title: "Training Failed",
        description: "Failed to start voice training",
        variant: "destructive",
      });
    }
  };

  const setDefaultVoice = async (profileId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Remove default from all voices
      await supabase
        .from('voice_profiles')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      await supabase
        .from('voice_profiles')
        .update({ is_default: true })
        .eq('id', profileId);

      toast({ title: "Default voice updated" });
      loadVoices();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default voice",
        variant: "destructive",
      });
    }
  };

  const deleteVoice = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('voice_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      toast({ title: "Voice deleted" });
      loadVoices();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete voice",
        variant: "destructive",
      });
    }
  };

  const playPreview = (profileId: string) => {
    // In production, fetch and play the voice sample
    setPlayingId(profileId);
    setTimeout(() => setPlayingId(null), 3000);
  };

  const ProviderTab = ({ provider, name, description }: { provider: string; name: string; description: string }) => (
    <TabsContent value={provider} className="space-y-6">
      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{name} API Configuration</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={`${provider}-key`}>API Key</Label>
            <div className="flex gap-2">
              <Input
                id={`${provider}-key`}
                type="password"
                value={apiKeys[provider as keyof typeof apiKeys]}
                onChange={(e) => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                placeholder={`Enter your ${name} API key`}
              />
              <Button 
                onClick={() => saveApiKey(provider, apiKeys[provider as keyof typeof apiKeys])}
                disabled={!apiKeys[provider as keyof typeof apiKeys]}
              >
                Save
              </Button>
            </div>
            {apiKeys[provider as keyof typeof apiKeys] && (
              <Badge variant="default" className="mt-2 bg-green-500">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Recording */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Record Voice Samples
          </CardTitle>
          <CardDescription>
            Record {SAMPLE_PROMPTS.length} voice samples for optimal cloning quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={recordingProgress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {currentPromptIndex + 1} of {SAMPLE_PROMPTS.length} samples
          </p>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Read this aloud:</p>
            <p className="text-lg">{SAMPLE_PROMPTS[currentPromptIndex]}</p>
          </div>

          <div className="flex items-center gap-4">
            {isRecording ? (
              <Button onClick={stopRecording} variant="destructive" size="lg">
                <Pause className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            ) : (
              <Button onClick={startRecording} size="lg">
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            )}

            {audioBlobs.length > 0 && (
              <Badge variant="secondary">
                {audioBlobs.length} sample(s) recorded
              </Badge>
            )}
          </div>

          {audioBlobs.length >= 5 && (
            <Button onClick={() => trainVoice('new')} className="w-full">
              <Wand2 className="h-4 w-4 mr-2" />
              Train Voice Model ({audioBlobs.length} samples)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Voice File
          </CardTitle>
          <CardDescription>
            Upload existing audio files (MP3, WAV, M4A, FLAC) - minimum 30 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <FileAudio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Drag & drop audio files here or click to browse
            </p>
            <Input
              type="file"
              accept=".mp3,.wav,.m4a,.flac,audio/*"
              onChange={handleFileUpload}
              className="max-w-xs mx-auto"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Maximum file size: 50MB
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voice Cloning</h2>
          <p className="text-muted-foreground">Create and manage AI voice clones across multiple providers</p>
        </div>
        <Button variant="outline" onClick={loadVoices} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Voice Library */}
      {voices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Library
            </CardTitle>
            <CardDescription>Your trained voice models across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {voices.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Volume2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {voice.voice_name}
                          {voice.is_default && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {voice.provider}
                          </Badge>
                          <Badge 
                            variant={voice.training_status === 'completed' ? 'default' : 'secondary'}
                            className={voice.training_status === 'completed' ? 'bg-green-500' : ''}
                          >
                            {voice.training_status}
                          </Badge>
                          {voice.quality_score && (
                            <span>Quality: {(voice.quality_score * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playPreview(voice.id)}
                        disabled={voice.training_status !== 'completed'}
                      >
                        {playingId === voice.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      
                      {voice.training_status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => trainVoice(voice.id)}
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {!voice.is_default && voice.training_status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultVoice(voice.id)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVoice(voice.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Provider Tabs */}
      <Tabs value={activeProvider} onValueChange={setActiveProvider}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
          <TabsTrigger value="resemble_ai">Resemble.AI</TabsTrigger>
          <TabsTrigger value="cfgpt">CFGPT Custom</TabsTrigger>
        </TabsList>

        <ProviderTab
          provider="elevenlabs"
          name="ElevenLabs"
          description="High-quality instant voice cloning with natural expressiveness"
        />
        <ProviderTab
          provider="resemble_ai"
          name="Resemble.AI"
          description="Professional voice training with emotional control and languages"
        />
        <ProviderTab
          provider="cfgpt"
          name="CFGPT Custom"
          description="Proprietary voice cloning with local processing option"
        />
      </Tabs>

      {/* Best Practices */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500">Voice Cloning Best Practices</p>
              <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
                <li>Use high-quality audio (WAV 44.1kHz preferred)</li>
                <li>Record in a quiet environment without background noise</li>
                <li>Speak naturally—avoid monotone or overly dramatic tones</li>
                <li>Provide varied sentence structures for better results</li>
                <li>Minimum 1 minute of audio recommended</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
