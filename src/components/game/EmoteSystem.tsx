import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smile, Music, Zap, Heart, Angry, Wind } from 'lucide-react';

interface EmoteSystemProps {
  onEmote: (emoteType: string) => void;
  isEmoting: boolean;
}

export default function EmoteSystem({ onEmote, isEmoting }: EmoteSystemProps) {
  const [showEmotes, setShowEmotes] = useState(false);

  const emotes = [
    { id: 'wave', icon: Smile, label: 'Wave', emoji: '👋' },
    { id: 'dance', icon: Music, label: 'Dance', emoji: '💃' },
    { id: 'celebrate', icon: Zap, label: 'Celebrate', emoji: '🎉' },
    { id: 'sit', icon: Wind, label: 'Sit', emoji: '🪑' },
    { id: 'sleep', icon: Heart, label: 'Sleep', emoji: '😴' },
    { id: 'angry', icon: Angry, label: 'Angry', emoji: '😠' },
  ];

  const handleEmote = (emoteId: string) => {
    onEmote(emoteId);
    setShowEmotes(false);
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setShowEmotes(!showEmotes)}
        disabled={isEmoting}
        className="w-full bg-purple-600 hover:bg-purple-700"
        size="sm"
      >
        <Smile className="w-4 h-4 mr-2" />
        Emote
      </Button>

      {showEmotes && (
        <div className="absolute bottom-12 left-0 right-0 grid grid-cols-3 gap-2 p-2 bg-gray-900 rounded-lg border border-purple-500 z-50">
          {emotes.map((emote) => (
            <button
              key={emote.id}
              onClick={() => handleEmote(emote.id)}
              className="flex flex-col items-center gap-1 p-2 hover:bg-purple-600 rounded transition-colors"
              title={emote.label}
            >
              <span className="text-xl">{emote.emoji}</span>
              <span className="text-xs text-gray-300">{emote.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
