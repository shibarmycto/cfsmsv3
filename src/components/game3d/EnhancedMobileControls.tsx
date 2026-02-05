import { useRef, useCallback, useState, useEffect, memo } from 'react';
import { Maximize2, Minimize2, Mic, Menu, MessageSquare, Crosshair } from 'lucide-react';

interface EnhancedMobileControlsProps {
  onMove: (x: number, z: number) => void;
  onAttack: () => void;
  onJump: () => void;
  onInteract: () => void;
  onSprint: (active: boolean) => void;
  onOpenMenu: () => void;
  onOpenChat: () => void;
  onToggleVoice: () => void;
  isLandscape: boolean;
  onToggleFullscreen: () => void;
  isSprinting: boolean;
  voiceActive: boolean;
  nearbyInteraction: string | null;
  equippedWeapon: string;
}

// Large 120px+ joystick with auto-sprint at edges
const Joystick = memo(function Joystick({ 
  onMove, 
  onSprint 
}: { 
  onMove: (x: number, z: number) => void;
  onSprint: (active: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);
  const autoSprintRef = useRef(false);

  const handleStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return;
    
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    setActive(true);
    
    // Dynamic positioning - joystick appears where touched
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setOrigin({
        x: Math.max(60, Math.min(touch.clientX - rect.left, rect.width - 60)),
        y: Math.max(60, Math.min(touch.clientY - rect.top, rect.height - 60))
      });
    }
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null || !containerRef.current) return;

    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    let dx = touchX - origin.x;
    let dy = touchY - origin.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 55; // Max stick travel
    const sprintThreshold = 50; // Auto-sprint at edge
    
    // Clamp to max distance
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    setPosition({ x: dx, y: dy });
    
    // Normalize for movement (-1 to 1)
    const normalizedX = dx / maxDistance;
    const normalizedZ = dy / maxDistance;
    onMove(normalizedX, normalizedZ);
    
    // Auto-sprint when pushed to edge
    const shouldSprint = distance >= sprintThreshold;
    if (shouldSprint !== autoSprintRef.current) {
      autoSprintRef.current = shouldSprint;
      onSprint(shouldSprint);
    }
  }, [origin, onMove, onSprint]);

  const handleEnd = useCallback(() => {
    touchIdRef.current = null;
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
    if (autoSprintRef.current) {
      autoSprintRef.current = false;
      onSprint(false);
    }
  }, [onMove, onSprint]);

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-0 left-0 w-[45%] h-[60%] touch-none"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {/* Joystick visualization */}
      <div 
        className="absolute w-[130px] h-[130px] pointer-events-none"
        style={{
          left: active ? origin.x - 65 : 30,
          top: active ? origin.y - 65 : 'auto',
          bottom: active ? 'auto' : 30,
          transition: active ? 'none' : 'all 0.2s ease-out'
        }}
      >
        {/* Outer ring with glow */}
        <div className={`absolute inset-0 rounded-full transition-all duration-150 ${
          active 
            ? 'bg-white/15 border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/20' 
            : 'bg-white/10 border-2 border-white/20'
        }`}>
          {/* Direction indicators */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-transparent border-b-white/40" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-transparent border-t-white/40" />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[10px] border-transparent border-r-white/40" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-white/40" />
        </div>
        
        {/* Inner stick - 60px diameter */}
        <div 
          className={`absolute w-[60px] h-[60px] rounded-full border-2 transition-all ${
            active 
              ? autoSprintRef.current
                ? 'bg-gradient-to-br from-orange-400 to-red-500 border-orange-300 shadow-xl shadow-orange-500/40'
                : 'bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300 shadow-xl shadow-cyan-500/40'
              : 'bg-gradient-to-br from-gray-400 to-gray-600 border-white/30'
          }`}
          style={{
            left: 35 + position.x,
            top: 35 + position.y,
            transform: 'translate(0, 0)',
            transition: active ? 'none' : 'all 0.15s ease-out'
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/30" />
        </div>
        
        {/* Sprint indicator */}
        {active && autoSprintRef.current && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-orange-400 text-xs font-bold animate-pulse">
            SPRINT
          </div>
        )}
      </div>
    </div>
  );
});

// Action button with haptic feedback visual
const ActionButton = memo(function ActionButton({
  children,
  onPress,
  className = '',
  size = 'normal',
  disabled = false
}: {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  size?: 'small' | 'normal' | 'large';
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  
  const sizeClasses = {
    small: 'w-12 h-12',
    normal: 'w-16 h-16',
    large: 'w-20 h-20'
  };

  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault();
    if (disabled) return;
    setPressed(true);
    onPress();
  };

  return (
    <button
      onTouchStart={handleTouch}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      onClick={() => !disabled && onPress()}
      disabled={disabled}
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all 
        ${pressed ? 'scale-90' : 'scale-100'} 
        ${disabled ? 'opacity-50' : ''} 
        ${className}`}
    >
      {children}
    </button>
  );
});

export default function EnhancedMobileControls({
  onMove,
  onAttack,
  onJump,
  onInteract,
  onSprint,
  onOpenMenu,
  onOpenChat,
  onToggleVoice,
  isLandscape,
  onToggleFullscreen,
  isSprinting,
  voiceActive,
  nearbyInteraction,
  equippedWeapon
}: EnhancedMobileControlsProps) {
  const [jumpCooldown, setJumpCooldown] = useState(false);

  const handleJump = useCallback(() => {
    if (jumpCooldown) return;
    onJump();
    setJumpCooldown(true);
    setTimeout(() => setJumpCooldown(false), 400);
  }, [jumpCooldown, onJump]);

  // Get weapon icon
  const getWeaponIcon = () => {
    switch (equippedWeapon) {
      case 'knife': return '🔪';
      case 'bat': return '🏏';
      case 'pistol': return '🔫';
      case 'rifle': return '🔫';
      default: return '👊';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Top bar */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
        <button 
          onClick={onToggleFullscreen}
          className="p-2.5 bg-black/50 backdrop-blur-sm rounded-xl border border-white/20"
        >
          {isLandscape ? (
            <Minimize2 className="w-5 h-5 text-white" />
          ) : (
            <Maximize2 className="w-5 h-5 text-white" />
          )}
        </button>
        
        <button 
          onClick={onOpenMenu}
          className="p-2.5 bg-black/50 backdrop-blur-sm rounded-xl border border-white/20"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Landscape prompt */}
      {!isLandscape && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-white/10 mx-6">
            <Maximize2 className="w-20 h-20 text-cyan-400 mx-auto mb-4 animate-pulse" />
            <p className="text-white font-bold text-2xl mb-2">Rotate Your Device</p>
            <p className="text-gray-400">For the best gameplay experience,<br/>please use landscape mode</p>
          </div>
        </div>
      )}

      {/* LEFT SIDE - Joystick area (45% of screen width) */}
      <div className="pointer-events-auto">
        <Joystick onMove={onMove} onSprint={onSprint} />
      </div>

      {/* RIGHT SIDE - Action buttons */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3 pointer-events-auto">
        {/* Voice chat */}
        <ActionButton
          onPress={onToggleVoice}
          size="normal"
          className={`border-2 ${
            voiceActive 
              ? 'bg-green-500/60 border-green-400 shadow-lg shadow-green-500/30' 
              : 'bg-black/50 border-white/20'
          }`}
        >
          <Mic className={`w-6 h-6 ${voiceActive ? 'text-white' : 'text-gray-300'}`} />
        </ActionButton>

        {/* Chat */}
        <ActionButton
          onPress={onOpenChat}
          size="normal"
          className="bg-black/50 border-2 border-white/20"
        >
          <MessageSquare className="w-6 h-6 text-gray-300" />
        </ActionButton>

        {/* Jump */}
        <ActionButton
          onPress={handleJump}
          size="normal"
          disabled={jumpCooldown}
          className={`border-2 ${
            jumpCooldown 
              ? 'bg-gray-600/50 border-gray-500' 
              : 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-300 shadow-lg shadow-emerald-500/30'
          }`}
        >
          <span className="text-white font-black text-sm">JUMP</span>
        </ActionButton>

        {/* Interact - only show when near something */}
        {nearbyInteraction && (
          <ActionButton
            onPress={onInteract}
            size="normal"
            className="bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 shadow-lg shadow-amber-500/30"
          >
            <span className="text-white font-black text-lg">E</span>
          </ActionButton>
        )}

        {/* Attack - LARGE button */}
        <ActionButton
          onPress={onAttack}
          size="large"
          className="bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-400 shadow-xl shadow-red-500/40"
        >
          <span className="text-4xl">{getWeaponIcon()}</span>
        </ActionButton>
      </div>

      {/* Sprint indicator (when manually enabled) */}
      {isSprinting && (
        <div className="absolute bottom-40 left-48 pointer-events-none">
          <div className="bg-orange-500/30 border border-orange-400 rounded-lg px-3 py-1">
            <span className="text-orange-400 font-bold text-sm">🏃 SPRINTING</span>
          </div>
        </div>
      )}

      {/* Interaction prompt */}
      {nearbyInteraction && (
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-cyan-500/50">
            <span className="text-cyan-400 font-bold">Press E to {nearbyInteraction}</span>
          </div>
        </div>
      )}

      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        <Crosshair className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}
