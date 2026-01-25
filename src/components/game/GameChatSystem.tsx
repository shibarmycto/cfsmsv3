import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Globe, MessageSquare, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string | null;
  message: string;
  message_type: 'world' | 'private' | 'proximity';
  created_at: string;
}

interface Player {
  id: string;
  name: string;
  is_online: boolean;
}

interface GameChatSystemProps {
  characterId: string;
  characterName: string;
  otherPlayers: Player[];
  onClose: () => void;
}

export default function GameChatSystem({ 
  characterId, 
  characterName, 
  otherPlayers,
  onClose 
}: GameChatSystemProps) {
  const [activeTab, setActiveTab] = useState<'world' | 'private' | 'voice'>('world');
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      // Fetch world messages
      const { data: worldMsgs } = await supabase
        .from('game_messages')
        .select('*')
        .eq('message_type', 'world')
        .order('created_at', { ascending: true })
        .limit(100);

      if (worldMsgs) setMessages(worldMsgs as Message[]);

      // Fetch private messages for this character
      const { data: privateMsgs } = await supabase
        .from('game_messages')
        .select('*')
        .eq('message_type', 'private')
        .or(`sender_id.eq.${characterId},receiver_id.eq.${characterId}`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (privateMsgs) setPrivateMessages(privateMsgs as Message[]);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('game-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          
          if (newMsg.message_type === 'world') {
            setMessages(prev => [...prev, newMsg]);
          } else if (newMsg.message_type === 'private') {
            if (newMsg.sender_id === characterId || newMsg.receiver_id === characterId) {
              setPrivateMessages(prev => [...prev, newMsg]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [characterId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeTab, selectedPlayer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, privateMessages]);

  const handleSendWorld = async () => {
    if (!input.trim()) return;

    const { error } = await supabase
      .from('game_messages')
      .insert({
        sender_id: characterId,
        sender_name: characterName,
        message: input.trim(),
        message_type: 'world',
      });

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    setInput('');
  };

  const handleSendPrivate = async () => {
    if (!input.trim() || !selectedPlayer) return;

    const { error } = await supabase
      .from('game_messages')
      .insert({
        sender_id: characterId,
        sender_name: characterName,
        receiver_id: selectedPlayer.id,
        message: input.trim(),
        message_type: 'private',
      });

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeTab === 'world') {
        handleSendWorld();
      } else if (activeTab === 'private' && selectedPlayer) {
        handleSendPrivate();
      }
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Voice Chat - Push to Talk
  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      setVoiceEnabled(true);
      toast.success('Voice chat enabled! Hold V to talk');
    } catch {
      toast.error('Microphone access denied');
    }
  }, []);

  const startTalking = useCallback(() => {
    if (!voiceEnabled || isMuted) return;
    setIsTalking(true);
    // In a real implementation, this would stream audio to other players
    // via WebRTC or a voice server
  }, [voiceEnabled, isMuted]);

  const stopTalking = useCallback(() => {
    setIsTalking(false);
  }, []);

  // Handle V key for push-to-talk
  useEffect(() => {
    if (activeTab !== 'voice') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        if (!e.repeat) startTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        stopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTab, startTalking, stopTalking]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const filteredPrivateMessages = selectedPlayer
    ? privateMessages.filter(
        m => 
          (m.sender_id === characterId && m.receiver_id === selectedPlayer.id) ||
          (m.sender_id === selectedPlayer.id && m.receiver_id === characterId)
      )
    : [];

  return (
    <div className="fixed bottom-20 left-4 w-[400px] max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-md border border-border rounded-lg overflow-hidden shadow-2xl z-50">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-muted/50">
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant={activeTab === 'world' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('world')}
            className="h-7 px-2 text-xs"
          >
            <Globe className="w-3 h-3 mr-1" />
            World
          </Button>
          <Button 
            size="sm" 
            variant={activeTab === 'private' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('private')}
            className="h-7 px-2 text-xs"
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Private
          </Button>
          <Button 
            size="sm" 
            variant={activeTab === 'voice' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('voice')}
            className="h-7 px-2 text-xs"
          >
            <Mic className="w-3 h-3 mr-1" />
            Voice
          </Button>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* World Chat Tab */}
      {activeTab === 'world' && (
        <>
          <div className="h-[220px] overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-8">
                No messages yet. Say hello to the world!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className={`font-medium ${msg.sender_id === characterId ? 'text-primary' : 'text-blue-400'}`}>
                    {msg.sender_name}:
                  </span>
                  <span className="text-foreground ml-2">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 p-2 border-t border-border">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message everyone..."
              className="text-sm"
              maxLength={200}
            />
            <Button size="icon" onClick={handleSendWorld} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}

      {/* Private Messages Tab */}
      {activeTab === 'private' && (
        <>
          {!selectedPlayer ? (
            <div className="h-[250px] overflow-y-auto p-3">
              <p className="text-xs text-muted-foreground mb-2">Select a player to message:</p>
              <div className="space-y-1">
                {otherPlayers.filter(p => p.is_online).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No other players online</p>
                ) : (
                  otherPlayers.filter(p => p.is_online).map(player => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayer(player)}
                      className="w-full p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-left flex items-center gap-2 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">{player.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelectedPlayer(null)}
                >
                  ←
                </Button>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">{selectedPlayer.name}</span>
              </div>
              <div className="h-[180px] overflow-y-auto p-3 space-y-2">
                {filteredPrivateMessages.length === 0 ? (
                  <div className="text-muted-foreground text-sm text-center py-8">
                    No messages yet. Start a private conversation!
                  </div>
                ) : (
                  filteredPrivateMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`text-sm p-2 rounded-lg max-w-[80%] ${
                        msg.sender_id === characterId 
                          ? 'bg-primary/20 ml-auto text-right' 
                          : 'bg-secondary'
                      }`}
                    >
                      <span className="text-foreground">{msg.message}</span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2 p-2 border-t border-border">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedPlayer.name}...`}
                  className="text-sm"
                  maxLength={200}
                />
                <Button size="icon" onClick={handleSendPrivate} disabled={!input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Voice Chat Tab */}
      {activeTab === 'voice' && (
        <div className="h-[250px] p-4 flex flex-col items-center justify-center">
          {!voiceEnabled ? (
            <div className="text-center space-y-4">
              <Mic className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Enable voice chat to talk with nearby players
              </p>
              <Button onClick={startVoice}>
                Enable Voice Chat
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              {/* PTT Button */}
              <div 
                className={`w-24 h-24 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  isTalking 
                    ? 'bg-primary scale-110 shadow-lg shadow-primary/50' 
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
                onMouseDown={startTalking}
                onMouseUp={stopTalking}
                onMouseLeave={stopTalking}
                onTouchStart={startTalking}
                onTouchEnd={stopTalking}
              >
                {isTalking ? (
                  <Volume2 className="w-10 h-10 text-primary-foreground animate-pulse" />
                ) : (
                  <Mic className={`w-10 h-10 ${isMuted ? 'text-muted-foreground' : 'text-foreground'}`} />
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {isTalking ? 'Transmitting...' : 'Hold to talk (or press V)'}
              </p>

              {/* Mute Toggle */}
              <Button 
                size="sm" 
                variant={isMuted ? 'destructive' : 'outline'}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>

              {/* Online Players */}
              <div className="pt-2 border-t border-border w-full">
                <p className="text-xs text-muted-foreground mb-2">
                  Nearby players ({otherPlayers.filter(p => p.is_online).length})
                </p>
                <div className="flex flex-wrap gap-1 justify-center">
                  {otherPlayers.filter(p => p.is_online).slice(0, 6).map(player => (
                    <span 
                      key={player.id}
                      className="text-xs bg-secondary px-2 py-1 rounded-full"
                    >
                      {player.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
