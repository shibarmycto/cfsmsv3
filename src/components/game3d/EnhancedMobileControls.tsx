import { useRef, useCallback, useState, useEffect, memo } from 'react';
import { Maximize2, Minimize2, Mic, Menu, MessageSquare, Crosshair, Volume2, VolumeX } from 'lucide-react';
import { gameSounds } from './GameSoundSystem';

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

// ─── FIXED JOYSTICK ───────────────────────────────────────────────────
// Stays at a fixed position in bottom-left. Much more reliable than dynamic.
const FixedJoystick = memo(function FixedJoystick({ 
  onMove, 
  onSprint 
}: { 
  onMove: (x: number, z: number) => void;
  onSprint: (active: boolean) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  const moveTimerRef = useRef<number | null>(null);

  // Continuous movement emission for smooth gameplay
  const emitMove = useCallback(() => {
    const { x, y } = posRef.current;
    onMove(x, y);
  }, [onMove]);

  const startContinuousMove = useCallback(() => {
    if (moveTimerRef.current) return;
    const loop = () => {
      emitMove();
      moveTimerRef.current = requestAnimationFrame(loop);
    };
    moveTimerRef.current = requestAnimationFrame(loop);
  }, [emitMove]);

  const stopContinuousMove = useCallback(() => {
    if (moveTimerRef.current) {
      cancelAnimationFrame(moveTimerRef.current);
      moveTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopContinuousMove(), [stopContinuousMove]);

  const handleStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setActive(true);
    startContinuousMove();
  }, [startContinuousMove]);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current === null || !outerRef.current) return;

    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = rect.width / 2 - 15;

    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setPos({ x: dx, y: dy });

    const nx = dx / maxR;
    const ny = dy / maxR;
    posRef.current = { x: nx, y: ny };

    // Auto-sprint at edge
    const shouldSprint = dist / maxR > 0.85;
    onSprint(shouldSprint);
  }, [onSprint]);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    // Check if our touch ended
    let found = false;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) { found = true; break; }
    }
    if (!found) {
      touchIdRef.current = null;
      setActive(false);
      setPos({ x: 0, y: 0 });
      posRef.current = { x: 0, y: 0 };
      onMove(0, 0);
      onSprint(false);
      stopContinuousMove();
    }
  }, [onMove, onSprint, stopContinuousMove]);

  return (
    <div 
      ref={outerRef}
      className="absolute bottom-6 left-6 w-[140px] h-[140px] touch-none pointer-events-auto"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {/* Outer ring */}
      <div className={`absolute inset-0 rounded-full transition-colors duration-150 ${
        active 
          ? 'bg-white/15 border-2 border-cyan-400/60' 
          : 'bg-white/8 border-2 border-white/25'
      }`}>
        {/* Cardinal direction arrows */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold">▲</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold">▼</div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">◀</div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">▶</div>
      </div>
      
      {/* Inner stick - 56px */}
      <div 
        className={`absolute w-14 h-14 rounded-full border-2 ${
          active 
            ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-cyan-300 shadow-xl shadow-cyan-500/40'
            : 'bg-gradient-to-br from-gray-500 to-gray-700 border-white/30'
        }`}
        style={{
          left: `calc(50% - 28px + ${pos.x}px)`,
          top: `calc(50% - 28px + ${pos.y}px)`,
          transition: active ? 'none' : 'all 0.12s ease-out'
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/25" />
      </div>
    </div>
  );
});

// ─── ACTION BUTTON ────────────────────────────────────────────────────
const ActionBtn = memo(function ActionBtn({
  children,
  onPress,
  onRelease,
  className = '',
  size = 64,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onRelease?: () => void;
  className?: string;
  size?: number;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onTouchStart={(e) => { e.preventDefault(); setPressed(true); onPress(); }}
      onTouchEnd={(e) => { e.preventDefault(); setPressed(false); onRelease?.(); }}
      onTouchCancel={() => { setPressed(false); onRelease?.(); }}
      className={`rounded-full flex items-center justify-center transition-transform ${pressed ? 'scale-90' : 'scale-100'} ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  );
});

// ─── MAIN CONTROLS ───────────────────────────────────────────────────
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
  const [sfxEnabled, setSfxEnabled] = useState(gameSounds.isEnabled());

  const handleJump = useCallback(() => {
    if (jumpCooldown) return;
    onJump();
    setJumpCooldown(true);
    setTimeout(() => setJumpCooldown(false), 400);
  }, [jumpCooldown, onJump]);

  const handleAttack = useCallback(() => {
    onAttack();
    if (equippedWeapon && equippedWeapon !== 'fists' && equippedWeapon !== 'knife' && equippedWeapon !== 'bat') {
      gameSounds.playGunshot();
    } else {
      gameSounds.playHit();
    }
  }, [onAttack, equippedWeapon]);

  const toggleSfx = useCallback(() => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    gameSounds.setEnabled(next);
  }, [sfxEnabled]);

  const weaponIcon = (() => {
    switch (equippedWeapon) {
      case 'knife': return '🔪';
      case 'bat': return '🏏';
      case 'pistol': case 'rifle': case 'smg': return '🔫';
      default: return '👊';
    }
  })();

  // Prevent scroll on game controls area
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if (e.target instanceof Element && e.target.closest('.game-mobile-ctrl')) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 game-mobile-ctrl">
      {/* Top bar */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
        <button 
          onClick={toggleSfx}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-xl border border-white/20"
        >
          {sfxEnabled 
            ? <Volume2 className="w-5 h-5 text-green-400" /> 
            : <VolumeX className="w-5 h-5 text-red-400" />
          }
        </button>
        <button 
          onClick={onToggleFullscreen}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-xl border border-white/20"
        >
          {isLandscape ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
        </button>
        <button 
          onClick={onOpenMenu}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-xl border border-white/20"
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
            <p className="text-gray-400">For the best gameplay,<br/>use landscape mode</p>
          </div>
        </div>
      )}

      {/* LEFT: Fixed Joystick */}
      <FixedJoystick onMove={onMove} onSprint={onSprint} />

      {/* RIGHT: Action buttons - vertical stack */}
      <div className="absolute bottom-6 right-4 flex flex-col gap-2.5 pointer-events-auto">
        {/* Voice */}
        <ActionBtn
          onPress={onToggleVoice}
          size={48}
          className={`border-2 ${voiceActive ? 'bg-green-500/60 border-green-400' : 'bg-black/50 border-white/20'}`}
        >
          <Mic className={`w-5 h-5 ${voiceActive ? 'text-white' : 'text-gray-300'}`} />
        </ActionBtn>

        {/* Chat */}
        <ActionBtn
          onPress={onOpenChat}
          size={48}
          className="bg-black/50 border-2 border-white/20"
        >
          <MessageSquare className="w-5 h-5 text-gray-300" />
        </ActionBtn>

        {/* Jump */}
        <ActionBtn
          onPress={handleJump}
          size={56}
          className={`border-2 ${jumpCooldown ? 'bg-gray-600/50 border-gray-500' : 'bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/30'}`}
        >
          <span className="text-white font-black text-xs">JUMP</span>
        </ActionBtn>

        {/* Interact - show when near */}
        {nearbyInteraction && (
          <ActionBtn
            onPress={onInteract}
            size={56}
            className="bg-amber-500 border-2 border-amber-300 shadow-lg shadow-amber-500/30"
          >
            <span className="text-white font-black text-lg">E</span>
          </ActionBtn>
        )}

        {/* ATTACK - largest button */}
        <ActionBtn
          onPress={handleAttack}
          size={72}
          className="bg-red-600 border-4 border-red-400 shadow-xl shadow-red-500/40"
        >
          <span className="text-3xl">{weaponIcon}</span>
        </ActionBtn>
      </div>

      {/* Sprint indicator */}
      {isSprinting && (
        <div className="absolute bottom-[170px] left-[170px] pointer-events-none">
          <div className="bg-orange-500/30 border border-orange-400 rounded-lg px-3 py-1">
            <span className="text-orange-400 font-bold text-xs">🏃 SPRINT</span>
          </div>
        </div>
      )}

      {/* Interaction prompt */}
      {nearbyInteraction && (
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-cyan-500/50">
            <span className="text-cyan-400 font-bold text-sm">Press E to {nearbyInteraction}</span>
          </div>
        </div>
      )}

      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30">
        <Crosshair className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
