import { Button } from '@/components/ui/button';
import { X, Loader } from 'lucide-react';

interface Game3DUIProps {
  playerName: string;
  position: { x: number; y: number; z: number };
  onExit: () => void;
  isLoading: boolean;
}

export default function Game3DUI({ playerName, position, onExit, isLoading }: Game3DUIProps) {
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 animate-spin text-white" />
          <p className="text-white text-xl font-semibold">Loading 3D Game...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* HUD */}
      <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-lg border border-cyan-500 z-40 w-80">
        <div className="space-y-2">
          <div className="text-lg font-bold">{playerName}</div>
          <div className="text-sm text-cyan-400">
            Position: ({position.x.toFixed(1)}, {position.y.toFixed(1)}, {position.z.toFixed(1)})
          </div>
          <div className="text-xs text-gray-300 mt-3">Controls:</div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>WASD or Arrow Keys - Move</div>
            <div>Mouse - Look Around (future)</div>
            <div>ESC - Exit Game</div>
          </div>
        </div>
      </div>

      {/* Exit Button */}
      <Button
        size="lg"
        variant="destructive"
        className="fixed top-4 right-4 z-40"
        onClick={onExit}
      >
        <X className="w-5 h-5 mr-2" />
        Exit Game
      </Button>

      {/* Instructions Panel */}
      <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg border border-cyan-500 z-40 max-w-xs">
        <h3 className="font-bold text-cyan-400 mb-2">Welcome to 3D World!</h3>
        <p className="text-sm text-gray-300">
          Use WASD or arrow keys to move around the 3D world. Explore buildings, roads, and landscapes.
        </p>
        <div className="mt-3 text-xs text-gray-400">
          <p>✓ Dynamic lighting and shadows</p>
          <p>✓ Interactive 3D environment</p>
          <p>✓ Real-time character movement</p>
        </div>
      </div>

      {/* Performance Stats (optional) */}
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded text-xs font-mono z-40">
        <div className="text-cyan-400">3D Game Engine</div>
        <div className="text-gray-400">WebGL • Three.js</div>
      </div>
    </>
  );
}
