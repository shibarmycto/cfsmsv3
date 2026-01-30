import { useRef, useCallback, useState, useEffect } from 'react';
import { Maximize2, Minimize2, Crosshair, Menu, Sword, MessageCircle } from 'lucide-react';

interface MobileGameControlsProps {
  onMove: (x: number, z: number) => void;
  onAction: (action: 'jump' | 'interact' | 'sprint' | 'menu' | 'attack' | 'chat') => void;
  isLandscape: boolean;
  onToggleFullscreen: () => void;
  isSprinting: boolean;
  isAttacking: boolean;
  hasWeapon: boolean;
}

export default function MobileGameControls({ 
  onMove, 
  onAction, 
  isLandscape, 
  onToggleFullscreen,
  isSprinting,
  isAttacking,
  hasWeapon
}: MobileGameControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const [sprintHeld, setSprintHeld] = useState(false);
  const touchId = useRef<number | null>(null);

  // Continuous sprint check
  useEffect(() => {
    if (sprintHeld && isTouching) {
      const interval = setInterval(() => onAction('sprint'), 50);
      return () => clearInterval(interval);
    }
  }, [sprintHeld, isTouching, onAction]);

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    touchId.current = touch.identifier;
    setIsTouching(true);
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    if (!joystickRef.current || !isTouching) return;
    
    // Find the touch that matches our joystick
    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchId.current) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
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

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    // Check if our touch ended
    let found = false;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchId.current) {
        found = true;
        break;
      }
    }
    
    if (!found) {
      touchId.current = null;
      setIsTouching(false);
      setJoystickPos({ x: 0, y: 0 });
      onMove(0, 0);
    }
  }, [onMove]);

  // Prevent default on touch to avoid scrolling
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      if (e.target instanceof Element && e.target.closest('.game-controls')) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventScroll);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 game-controls">
      {/* Top bar - Fullscreen & Menu */}
      <div className="absolute top-3 right-3 flex gap-2 pointer-events-auto">
        <button 
          onClick={() => onAction('menu')}
          className="bg-black/70 backdrop-blur-sm p-2.5 rounded-xl border border-white/20 active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
        <button 
          onClick={onToggleFullscreen}
          className="bg-black/70 backdrop-blur-sm p-2.5 rounded-xl border border-white/20 active:scale-95 transition-transform"
        >
          {isLandscape ? (
            <Minimize2 className="w-5 h-5 text-white" />
          ) : (
            <Maximize2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Landscape hint overlay */}
      {!isLandscape && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-gray-900/90 rounded-2xl p-8 text-center border border-cyan-500/30 mx-4 shadow-xl shadow-cyan-500/20">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 animate-pulse" />
              <Maximize2 className="absolute inset-0 m-auto w-10 h-10 text-white" />
            </div>
            <p className="text-white font-bold text-xl mb-2">Rotate Your Device</p>
            <p className="text-gray-400 text-sm">CF Roleplay works best in<br/>landscape mode for gaming</p>
          </div>
        </div>
      )}

      {/* === LEFT SIDE - Movement Joystick === */}
      <div 
        ref={joystickRef}
        className="absolute bottom-6 left-6 w-32 h-32 md:w-36 md:h-36 pointer-events-auto touch-none"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {/* Outer ring with direction indicators */}
        <div className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/30 shadow-inner">
          {/* Direction arrows */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-transparent border-b-white/40" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-white/40" />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[8px] border-transparent border-r-white/40" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-white/40" />
        </div>
        
        {/* Inner joystick */}
        <div 
          className={`absolute w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl border-2 transition-all duration-75 ${
            isTouching 
              ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-cyan-300 shadow-cyan-500/50' 
              : 'bg-gradient-to-br from-gray-600 to-gray-800 border-white/30'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
        </div>
      </div>

      {/* Sprint button (near joystick) */}
      <button
        onTouchStart={() => { setSprintHeld(true); onAction('sprint'); }}
        onTouchEnd={() => setSprintHeld(false)}
        className={`absolute bottom-6 left-44 md:left-48 pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 ${
          sprintHeld || isSprinting
            ? 'bg-orange-500/50 border-orange-400 shadow-orange-500/50 shadow-lg' 
            : 'bg-black/50 backdrop-blur-sm border-white/20'
        }`}
      >
        <span className={`text-[10px] md:text-xs font-bold ${sprintHeld || isSprinting ? 'text-orange-300' : 'text-gray-300'}`}>RUN</span>
      </button>

      {/* === RIGHT SIDE - Action Buttons === */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 pointer-events-auto">
        {/* Attack button - prominent */}
        <button
          onTouchStart={() => onAction('attack')}
          className={`w-16 h-16 md:w-18 md:h-18 rounded-full border-2 flex items-center justify-center shadow-lg transition-all active:scale-90 ${
            isAttacking
              ? 'bg-red-500/60 border-red-400 shadow-red-500/50'
              : hasWeapon 
                ? 'bg-gradient-to-br from-red-600 to-red-700 border-red-400'
                : 'bg-gradient-to-br from-orange-600 to-red-600 border-orange-400'
          }`}
        >
          <Sword className="w-6 h-6 md:w-7 md:h-7 text-white" />
        </button>

        {/* Jump button */}
        <button
          onTouchStart={() => onAction('jump')}
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"
        >
          <span className="text-white font-black text-xs">JUMP</span>
        </button>

        {/* Interact button */}
        <button
          onTouchStart={() => onAction('interact')}
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-90 transition-transform"
        >
          <span className="text-white font-black text-lg">E</span>
        </button>

        {/* Chat button */}
        <button
          onTouchStart={() => onAction('chat')}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 border-2 border-blue-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        >
          <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </button>
      </div>

      {/* Center crosshair for aiming */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        <Crosshair className="w-6 h-6 text-white drop-shadow-lg" />
      </div>
    </div>
  );
}
