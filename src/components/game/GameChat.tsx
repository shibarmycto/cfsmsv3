import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send } from 'lucide-react';

interface Message {
  id: string;
  character_name: string;
  message: string;
  created_at: string;
}

interface GameChatProps {
  characterId: string;
  characterName: string;
  onClose: () => void;
}

// Simple in-memory chat for now (could be extended to use a game_chat table)
const chatMessages: Message[] = [];

export default function GameChat({ characterId, characterName, onClose }: GameChatProps) {
  const [messages, setMessages] = useState<Message[]>(chatMessages);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      character_name: characterName,
      message: input.trim(),
      created_at: new Date().toISOString(),
    };

    chatMessages.push(newMessage);
    setMessages([...chatMessages]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed bottom-20 left-4 w-[350px] max-w-[calc(100vw-2rem)] bg-black/80 backdrop-blur-sm rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white text-sm font-medium">Global Chat</span>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-white/70 hover:text-white" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-[200px] overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-white/50 text-sm text-center py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className={`font-medium ${msg.character_name === characterName ? 'text-primary' : 'text-blue-400'}`}>
                {msg.character_name}:
              </span>
              <span className="text-white ml-2">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-2 border-t border-white/10">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          maxLength={200}
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
