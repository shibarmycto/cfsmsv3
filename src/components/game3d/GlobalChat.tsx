import { useState, useEffect } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: Date;
  type: 'global' | 'private';
}

interface GlobalChatProps {
  playerName: string;
  playerId: string;
  isMinimized?: boolean;
}

export default function GlobalChat({ playerName, playerId, isMinimized = false }: GlobalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isOpen, setIsOpen] = useState(!isMinimized);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to global chat
    const channel = supabase
      .channel('global_chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          if (payload.new) {
            const newMessage: ChatMessage = {
              id: payload.new.id,
              playerName: payload.new.player_name,
              message: payload.new.message,
              timestamp: new Date(payload.new.created_at),
              type: 'global',
            };
            setMessages((prev) => [...prev, newMessage]);

            if (!isOpen) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    try {
      const { error } = await supabase.from('chat_messages').insert({
        player_name: playerName,
        player_id: playerId,
        message: inputMessage,
        type: 'global',
      });

      if (!error) {
        setInputMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-20 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg relative z-40"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 w-80 h-96 bg-gray-900 border-2 border-cyan-500 rounded-lg flex flex-col shadow-2xl z-40">
      {/* Header */}
      <div className="bg-gray-950 border-b border-cyan-500 p-3 flex justify-between items-center">
        <h3 className="font-bold text-cyan-400">Global Chat</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className="text-cyan-400 font-bold">{msg.playerName}:</span>
              <span className="text-gray-300 ml-2">{msg.message}</span>
              <div className="text-gray-600 text-xs mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-gray-700 p-3 flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
