import { useRef, useCallback, useState, useEffect } from 'react';
import { Maximize2, Minimize2, Crosshair, Radio, Menu } from 'lucide-react';

interface EliteMobileControlsProps {
  onMove: (x: number, z: number) => void;
  onAction: (action: 'jump' | 'interact' | 'sprint' | 'menu' | 'walkie') => void;
  isLandscape: boolean;
  onToggleFullscreen: () => void;
  isSprinting: boolean;
  walkieTalkieActive: boolean;
}

export default function EliteMobileControls({ 
  onMove, 
  onAction, 
  isLandscape, 
  onToggleFullscreen,
  isSprinting,
  walkieTalkieActive
}: EliteMobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const [sprintHeld, setSprintHeld] = useState(false);

  // Continuous sprint check
  useEffect(() => {
    if (sprintHeld && isTouching) {
      const interval = setInterval(() => onAction('sprint'), 50);
      return () => clearInterval(interval);
    }
  }, [sprintHeld, isTouching, onAction]);

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsTouching(true);
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    if (!joystickRef.current || !isTouching) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const touch = e.touches[0];
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = rect.width / 2 - 25;
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    setJoystickPos({ x: dx, y: dy });
    
    const normalizedX = dx / maxDistance;
    const normalizedZ = dy / maxDistance;
    onMove(normalizedX, normalizedZ);
  }, [isTouching, onMove]);

  const handleJoystickEnd = useCallback(() => {
    setIsTouching(false);
    setJoystickPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Fullscreen toggle */}
      <button 
        onClick={onToggleFullscreen}
        className="absolute top-4 right-16 pointer-events-auto bg-black/60 backdrop-blur-sm p-2.5 rounded-xl border border-white/10"
      >
        {isLandscape ? (
          <Minimize2 className="w-5 h-5 text-white" />
        ) : (
          <Maximize2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Landscape hint */}
      {!isLandscape && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-white/10 mx-4">
            <Maximize2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
            <p className="text-white font-bold text-xl mb-2">Rotate Device</p>
            <p className="text-gray-400 text-sm">For the best gaming experience,<br/>please use landscape mode</p>
          </div>
        </div>
      )}

      {/* === LEFT SIDE - Joystick === */}
      <div 
        ref={joystickRef}
        className="absolute bottom-8 left-8 w-36 h-36 pointer-events-auto touch-none"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {/* Outer ring - Elite style */}
        <div className="absolute inset-0 rounded-full bg-black/40 backdrop-blur-sm border-2 border-white/20">
          {/* Direction indicators */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white/30" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/30" />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white/30" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-white/30" />
        </div>
        
        {/* Inner stick */}
        <div 
          className={`absolute w-16 h-16 rounded-full shadow-2xl border-2 transition-transform ${
            isTouching 
              ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-cyan-300 scale-95' 
              : 'bg-gradient-to-br from-gray-600 to-gray-800 border-white/30'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
            transition: isTouching ? 'none' : 'all 0.2s ease-out',
            boxShadow: isTouching ? '0 0 30px rgba(6, 182, 212, 0.5)' : 'none'
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
        </div>
      </div>

      {/* Sprint toggle (below joystick) */}
      <button
        onTouchStart={() => { setSprintHeld(true); onAction('sprint'); }}
        onTouchEnd={() => setSprintHeld(false)}
        className={`absolute bottom-8 left-48 pointer-events-auto w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
          sprintHeld || isSprinting
            ? 'bg-orange-500/40 border-orange-400 text-orange-400' 
            : 'bg-black/40 backdrop-blur-sm border-white/20 text-gray-400'
        }`}
      >
        <span className="text-xs font-bold">RUN</span>
      </button>

      {/* === RIGHT SIDE - Action Buttons === */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-3 pointer-events-auto">
        {/* Jump - Large prominent button */}
        <button
          onTouchStart={() => onAction('jump')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"
        >
          <span className="text-white font-black text-xs">JUMP</span>
        </button>

        {/* Interact */}
        <button
          onTouchStart={() => onAction('interact')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-90 transition-transform"
        >
          <span className="text-white font-black text-lg">E</span>
        </button>

        {/* Walkie Talkie - Hold to talk */}
        <button
          onTouchStart={() => onAction('walkie')}
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-lg active:scale-90 transition-all ${
            walkieTalkieActive
              ? 'bg-green-500/50 border-green-400 shadow-green-500/50'
              : 'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500'
          }`}
        >
          <Radio className={`w-6 h-6 ${walkieTalkieActive ? 'text-green-300' : 'text-gray-300'}`} />
        </button>
      </div>

      {/* Center crosshair for first person mode */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30">
        <Crosshair className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}
