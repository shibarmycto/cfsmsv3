import { Button } from '@/components/ui/button';
import { MessageSquare, Gift, Handshake } from 'lucide-react';

interface NearbyPlayer {
  id: string;
  name: string;
  distance: number;
}

interface ProximityInteractionProps {
  nearbyPlayers: NearbyPlayer[];
  onChat: (playerId: string) => void;
}

export default function ProximityInteraction({ nearbyPlayers, onChat }: ProximityInteractionProps) {
  if (nearbyPlayers.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 max-h-[150px] overflow-y-auto bg-black/90 rounded-lg border border-blue-500 p-3 z-40">
      <div className="text-white text-sm font-semibold mb-2">
        Nearby Players ({nearbyPlayers.length})
      </div>
      <div className="space-y-2">
        {nearbyPlayers.map(player => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-2 bg-blue-900/50 p-2 rounded text-sm"
          >
            <div className="flex-1">
              <div className="text-white">{player.name}</div>
              <div className="text-xs text-gray-400">{Math.round(player.distance)}px away</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onChat(player.id)}
              title="Message"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
