import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  MessageSquare, ShoppingCart, Bell, Clipboard, Menu as MenuIcon,
  Map, Star, Users, Briefcase, Gift, User, Car, UserPlus, Shield,
  Settings, X, Mic, MoreHorizontal, DollarSign, Heart, Zap
} from 'lucide-react';

interface OneStateHUDProps {
  playerName: string;
  playerLevel: number;
  cash: number;
  bankBalance: number;
  health: number;
  energy: number;
  hunger: number;
  onMove: (x: number, z: number) => void;
  onAction: (action: string) => void;
  onOpenMenu: () => void;
  onOpenStore: () => void;
  onOpenChat: () => void;
  equippedWeapon?: string;
  ammo?: number;
  gameTime: string;
  onlinePlayers: number;
}

// Minimap component
function Minimap({ playerRotation = 0 }: { playerRotation?: number }) {
  return (
    <div className="relative w-[140px] h-[100px] bg-gray-700/80 backdrop-blur-sm rounded-lg overflow-hidden border border-gray-600/50">
      {/* Map placeholder - would be actual minimap in production */}
      <div className="absolute inset-0 bg-gray-600/50" />
      
      {/* Player direction indicator */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ transform: `translate(-50%, -50%) rotate(${playerRotation}deg)` }}
      >
        <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[16px] border-transparent border-b-yellow-400 drop-shadow-lg" />
      </div>
    </div>
  );
}

// Top bar icons
function TopBar({ 
  onOpenStore, 
  notifications = { alerts: 2, clipboard: 1, store: 4 }
}: { 
  onOpenStore: () => void;
  notifications?: { alerts: number; clipboard: number; store: number };
}) {
  return (
    <div className="flex items-center gap-2">
      <button className="relative p-2 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50">
        <Clipboard className="w-5 h-5 text-gray-300" />
      </button>
      <button className="relative p-2 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50">
        <Gift className="w-5 h-5 text-gray-300" />
        {notifications.clipboard > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {notifications.clipboard}
          </span>
        )}
      </button>
      <button className="relative p-2 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50">
        <Bell className="w-5 h-5 text-gray-300" />
        {notifications.alerts > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {notifications.alerts}
          </span>
        )}
      </button>
      <button className="relative p-2 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50">
        <Clipboard className="w-5 h-5 text-gray-300" />
      </button>
      <button 
        onClick={onOpenStore}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg font-bold text-black transition-colors"
      >
        <ShoppingCart className="w-5 h-5" />
        STORE
        {notifications.store > 0 && (
          <span className="w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {notifications.store}
          </span>
        )}
      </button>
      <button className="p-2 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50">
        <MenuIcon className="w-5 h-5 text-gray-300" />
      </button>
    </div>
  );
}

// Currency display
function CurrencyDisplay({ cash, bankBalance }: { cash: number; bankBalance: number }) {
  return (
    <div className="flex items-center gap-1 bg-gray-800/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-700/50">
      <DollarSign className="w-5 h-5 text-green-400" />
      <span className="text-green-400 font-bold text-lg">
        {(cash + bankBalance).toLocaleString()}
      </span>
      <button className="ml-1 w-6 h-6 bg-yellow-500 rounded text-black font-bold text-sm flex items-center justify-center">
        +
      </button>
    </div>
  );
}

// Player stats (right side)
function PlayerStats({ 
  level, 
  health, 
  energy, 
  hunger 
}: { 
  level: number; 
  health: number; 
  energy: number; 
  hunger: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Level badge */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center border-2 border-yellow-300">
          <span className="text-xs font-bold text-black">{level}</span>
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          {/* Health bar */}
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="w-20 h-2 bg-gray-700/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all"
                style={{ width: `${health}%` }}
              />
            </div>
          </div>
          {/* Energy bar */}
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-400" />
            <div className="w-20 h-2 bg-gray-700/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                style={{ width: `${energy}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Weapon display
function WeaponDisplay({ weapon, ammo }: { weapon?: string; ammo?: number }) {
  const getWeaponIcon = () => {
    if (!weapon || weapon === 'fists') {
      return (
        <div className="w-12 h-12 bg-gray-700/80 rounded-lg flex items-center justify-center">
          <span className="text-2xl">👊</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm rounded-lg p-2 border border-gray-700/50">
        <div className="w-16 h-10 bg-gray-700/60 rounded flex items-center justify-center">
          <span className="text-xl">🔫</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-white font-bold text-lg">{ammo ?? 0}</span>
          <div className="w-1 h-6 bg-yellow-500 rounded-full" />
        </div>
      </div>
    );
  };

  return getWeaponIcon();
}

// Virtual joystick
function VirtualJoystick({ onMove }: { onMove: (x: number, z: number) => void }) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const touchId = useRef<number | null>(null);

  const handleStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchId.current = touch.identifier;
    setIsTouching(true);
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    if (!joystickRef.current || !isTouching) return;
    
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
    const maxDistance = rect.width / 2 - 20;
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    setJoystickPos({ x: dx, y: dy });
    onMove(dx / maxDistance, dy / maxDistance);
  }, [isTouching, onMove]);

  const handleEnd = useCallback(() => {
    touchId.current = null;
    setIsTouching(false);
    setJoystickPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  return (
    <div 
      ref={joystickRef}
      className="relative w-28 h-28 touch-none"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {/* Outer ring - subtle */}
      <div className="absolute inset-0 rounded-full bg-white/10 border border-white/20" />
      
      {/* Direction indicator */}
      <div className="absolute inset-4 rounded-full border border-white/10 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/30 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5">
            <div /><div className="w-1 h-1 bg-white/40" /><div />
            <div className="w-1 h-1 bg-white/40" /><div /><div className="w-1 h-1 bg-white/40" />
            <div /><div className="w-1 h-1 bg-white/40" /><div />
          </div>
        </div>
      </div>
      
      {/* Inner stick */}
      <div 
        className={`absolute w-12 h-12 rounded-full border-2 transition-transform ${
          isTouching 
            ? 'bg-white/30 border-white/50' 
            : 'bg-white/10 border-white/20'
        }`}
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
        }}
      />
    </div>
  );
}

// Action buttons (right side)
function ActionButtons({ 
  onAction, 
  hasWeapon 
}: { 
  onAction: (action: string) => void;
  hasWeapon: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Chat and mic */}
      <div className="flex gap-2">
        <button 
          onClick={() => onAction('chat')}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center"
        >
          <MoreHorizontal className="w-5 h-5 text-white/70" />
        </button>
        <button 
          onClick={() => onAction('voice')}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center"
        >
          <Mic className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Main action button (fist/weapon) */}
      <button 
        onClick={() => onAction('attack')}
        className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-95 transition-transform"
      >
        {hasWeapon ? (
          <span className="text-3xl">🔫</span>
        ) : (
          <span className="text-3xl">👊</span>
        )}
      </button>
    </div>
  );
}

// Left side quick menu
function QuickMenu({ onAction }: { onAction: (action: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Map toggle */}
      <button 
        onClick={() => onAction('map')}
        className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center"
      >
        <Map className="w-5 h-5 text-green-400" />
      </button>
      
      {/* Add/Plus button */}
      <button 
        onClick={() => onAction('add')}
        className="w-10 h-10 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white text-xl font-light"
      >
        +
      </button>
      
      {/* Grid menu */}
      <button 
        onClick={() => onAction('menu')}
        className="relative w-10 h-10 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center"
      >
        <div className="grid grid-cols-2 gap-0.5">
          <div className="w-2 h-2 bg-white/60 rounded-sm" />
          <div className="w-2 h-2 bg-white/60 rounded-sm" />
          <div className="w-2 h-2 bg-white/60 rounded-sm" />
          <div className="w-2 h-2 bg-white/60 rounded-sm" />
        </div>
      </button>
      
      {/* Star/favorites */}
      <button 
        onClick={() => onAction('favorites')}
        className="relative w-10 h-10 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center"
      >
        <Star className="w-5 h-5 text-white/60" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
          5
        </span>
      </button>
      
      {/* Sprint toggle */}
      <button 
        onClick={() => onAction('sprint')}
        className="w-10 h-10 rounded-full bg-gray-700/30 border border-gray-600/30 flex items-center justify-center mt-4"
      >
        <span className="text-lg">🏃</span>
      </button>
    </div>
  );
}

// Chat bar
function ChatBar({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <button 
      onClick={onOpenChat}
      className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700/50 min-w-[280px]"
    >
      <MessageSquare className="w-4 h-4 text-gray-400" />
      <span className="text-gray-400 text-sm">Tap to write a message</span>
    </button>
  );
}

// Main HUD component
export default function OneStateHUD({
  playerName,
  playerLevel,
  cash,
  bankBalance,
  health,
  energy,
  hunger,
  onMove,
  onAction,
  onOpenMenu,
  onOpenStore,
  onOpenChat,
  equippedWeapon,
  ammo,
  gameTime,
  onlinePlayers,
}: OneStateHUDProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Top left - Minimap and FPS */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-auto">
        <div className="text-[10px] text-white/60 font-mono">
          60 FPS • 📶 50
        </div>
        <Minimap />
      </div>

      {/* Top center - Chat bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <ChatBar onOpenChat={onOpenChat} />
      </div>

      {/* Top right - Store, notifications, currency */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 pointer-events-auto">
        <TopBar onOpenStore={onOpenStore} />
        <CurrencyDisplay cash={cash} bankBalance={bankBalance} />
        <PlayerStats level={playerLevel} health={health} energy={energy} hunger={hunger} />
      </div>

      {/* Left side - Quick menu */}
      <div className="absolute left-3 top-36 pointer-events-auto">
        <QuickMenu onAction={onAction} />
      </div>

      {/* Bottom left - Joystick */}
      <div className="absolute bottom-6 left-6 pointer-events-auto">
        <VirtualJoystick onMove={onMove} />
      </div>

      {/* Right side - Weapon display */}
      <div className="absolute right-3 top-44 pointer-events-auto">
        <WeaponDisplay weapon={equippedWeapon} ammo={ammo} />
      </div>

      {/* Bottom right - Action buttons */}
      <div className="absolute bottom-6 right-6 pointer-events-auto">
        <ActionButtons onAction={onAction} hasWeapon={!!equippedWeapon && equippedWeapon !== 'fists'} />
      </div>

      {/* Bottom center - Server time */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="text-[10px] text-white/40 font-mono">
          SERVER TIME: {gameTime}
        </div>
      </div>

      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-4 h-4 flex items-center justify-center">
          <span className="text-white/30 text-lg">+</span>
        </div>
      </div>
    </div>
  );
}
