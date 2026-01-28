import { useRef, useEffect, useCallback, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface MobileControlsProps {
  onMove: (x: number, z: number) => void;
  onAction: (action: 'jump' | 'interact' | 'sprint') => void;
  isLandscape: boolean;
  onToggleFullscreen: () => void;
}

export default function MobileControls({ onMove, onAction, isLandscape, onToggleFullscreen }: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  const handleJoystickStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsTouching(true);
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickRef.current || !isTouching) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = rect.width / 2 - 20;
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    setJoystickPos({ x: dx, y: dy });
    
    // Normalize to -1 to 1
    const normalizedX = dx / maxDistance;
    const normalizedZ = dy / maxDistance;
    onMove(normalizedX, normalizedZ);
  }, [isTouching, onMove]);

  const handleJoystickEnd = useCallback(() => {
    setIsTouching(false);
    setJoystickPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  const handleSprint = useCallback((active: boolean) => {
    setIsSprinting(active);
    if (active) onAction('sprint');
  }, [onAction]);

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Fullscreen toggle */}
      <button 
        onClick={onToggleFullscreen}
        className="absolute top-4 right-4 pointer-events-auto bg-black/60 p-2 rounded-lg"
      >
        {isLandscape ? (
          <Minimize2 className="w-6 h-6 text-white" />
        ) : (
          <Maximize2 className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Landscape hint */}
      {!isLandscape && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 rounded-xl p-6 pointer-events-auto text-center">
          <Maximize2 className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
          <p className="text-white font-bold">Rotate for best experience</p>
          <p className="text-gray-400 text-sm mt-1">Turn your device to landscape mode</p>
        </div>
      )}

      {/* Joystick - Left side */}
      <div 
        ref={joystickRef}
        className="absolute bottom-8 left-8 w-32 h-32 pointer-events-auto touch-none"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onMouseDown={handleJoystickStart}
        onMouseMove={handleJoystickMove}
        onMouseUp={handleJoystickEnd}
        onMouseLeave={handleJoystickEnd}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-sm" />
        
        {/* Inner stick */}
        <div 
          className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg border-2 border-cyan-300"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
            transition: isTouching ? 'none' : 'transform 0.2s ease-out'
          }}
        />
      </div>

      {/* Action buttons - Right side */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-3 pointer-events-auto">
        {/* Jump button */}
        <button
          onTouchStart={() => onAction('jump')}
          onClick={() => onAction('jump')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-700 border-2 border-green-300 flex items-center justify-center shadow-lg active:scale-95"
        >
          <span className="text-white font-bold text-xs">JUMP</span>
        </button>

        {/* Interact button */}
        <button
          onTouchStart={() => onAction('interact')}
          onClick={() => onAction('interact')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 border-2 border-yellow-300 flex items-center justify-center shadow-lg active:scale-95"
        >
          <span className="text-white font-bold text-xs">E</span>
        </button>

        {/* Sprint toggle */}
        <button
          onTouchStart={() => handleSprint(true)}
          onTouchEnd={() => handleSprint(false)}
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-lg active:scale-95 ${
            isSprinting 
              ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-300' 
              : 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300'
          }`}
        >
          <span className="text-white font-bold text-xs">RUN</span>
        </button>
      </div>
    </div>
  );
}
