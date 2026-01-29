import { useState, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, 
  AlertCircle, CheckCircle2, Loader2, MessageSquare 
} from "lucide-react";

interface VoiceChatProps {
  twinName: string;
  greeting: string;
  agentId?: string;
  onCallStart?: () => void;
  onCallEnd?: (durationSeconds: number) => void;
}

export function VoiceChat({ 
  twinName, 
  greeting, 
  agentId,
  onCallStart, 
  onCallEnd 
}: VoiceChatProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [customAgentId, setCustomAgentId] = useState(agentId || "");
  const [showSetup, setShowSetup] = useState(!agentId);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to AI Twin");
      setCallStartTime(Date.now());
      onCallStart?.();
      toast({
        title: "Connected",
        description: `${twinName} is now listening...`,
      });
    },
    onDisconnect: () => {
      console.log("Disconnected from AI Twin");
      if (callStartTime) {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(duration);
        onCallEnd?.(duration);
      }
      setCallStartTime(null);
    },
    onMessage: (message: unknown) => {
      console.log("Message:", message);
      const msg = message as Record<string, unknown>;
      if (msg.type === "user_transcript") {
        const event = msg.user_transcription_event as Record<string, unknown> | undefined;
        const userText = event?.user_transcript as string | undefined;
        if (userText) {
          setTranscript(prev => [...prev, { role: 'user', text: userText }]);
        }
      } else if (msg.type === "agent_response") {
        const event = msg.agent_response_event as Record<string, unknown> | undefined;
        const agentText = event?.agent_response as string | undefined;
        if (agentText) {
          setTranscript(prev => [...prev, { role: 'assistant', text: agentText }]);
        }
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to connect to voice chat. Please try again.",
      });
      setIsConnecting(false);
    },
  });

  // Update call duration every second while connected
  useEffect(() => {
    if (!callStartTime) return;
    
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [callStartTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startConversation = useCallback(async () => {
    const activeAgentId = customAgentId || agentId;
    
    if (!activeAgentId) {
      toast({
        variant: "destructive",
        title: "Setup Required",
        description: "Please enter your ElevenLabs Agent ID first.",
      });
      setShowSetup(true);
      return;
    }

    setIsConnecting(true);
    setTranscript([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agentId: activeAgentId }
      });

      if (error || !data?.token) {
        throw new Error(data?.error || error?.message || "Failed to get conversation token");
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });

      setShowSetup(false);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast({
        variant: "destructive",
        title: "Failed to Connect",
        description: error instanceof Error ? error.message : "Could not start voice chat",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, agentId, customAgentId, toast]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}`,
    });
  }, [conversation, callDuration, toast]);

  const isConnected = conversation.status === "connected";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Web Voice Chat
        </CardTitle>
        <CardDescription>
          Talk to {twinName} directly through your browser - no phone needed!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Setup Section */}
        {showSetup && !isConnected && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Quick Setup Required</p>
                <p className="text-muted-foreground">
                  Create a free ElevenLabs agent at{" "}
                  <a 
                    href="https://elevenlabs.io/agents" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    elevenlabs.io/agents
                  </a>{" "}
                  and paste your Agent ID below.
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="agentId">ElevenLabs Agent ID</Label>
              <Input
                id="agentId"
                value={customAgentId}
                onChange={(e) => setCustomAgentId(e.target.value)}
                placeholder="e.g., abc123xyz..."
                className="mt-1"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSetup(false)}
              disabled={!customAgentId}
            >
              Save & Continue
            </Button>
          </div>
        )}

        {/* Status Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Badge variant="default" className="bg-primary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
              </>
            ) : (
              <Badge variant="secondary">
                <MicOff className="h-3 w-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </div>
          {isConnected && (
            <div className="flex items-center gap-2">
              {conversation.isSpeaking ? (
                <Badge variant="outline" className="text-primary">
                  <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                  Speaking
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Mic className="h-3 w-3 mr-1" />
                  Listening
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <ScrollArea className="h-48 border rounded-lg p-3">
            <div className="space-y-3">
              {transcript.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isConnected ? (
            <Button 
              onClick={startConversation} 
              disabled={isConnecting}
              className="flex-1"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  Start Voice Chat
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={stopConversation}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              End Call
            </Button>
          )}
        </div>

        {/* Help Text */}
        {!isConnected && !showSetup && (
          <p className="text-xs text-muted-foreground text-center">
            Click to start a voice conversation with your AI Twin.
            <br />
            Make sure your microphone is enabled.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
