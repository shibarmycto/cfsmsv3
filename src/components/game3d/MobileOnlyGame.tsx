import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedGameEngine, GameInput } from './EnhancedGameEngine';
import { GameBuilding } from './UKWorld';
import { RealtimeMultiplayer } from './RealtimeMultiplayer';
import ShopInterior from './ShopInterior';
import GameCombat from './GameCombat';
import SplashScreen from './SplashScreen';
import GameSideMenu from './GameSideMenu';
import ShopUI from './ShopUI';
import CriminalJobsSystem from './CriminalJobsSystem';
import GangSystem from './GangSystem';
import TryYourLuckPanel, { type LuckPrize } from './TryYourLuckPanel';
import MobileInfoModal from './MobileInfoModal';
import { Maximize2, X, Menu, MessageSquare, Mic, Crosshair, ChevronUp } from 'lucide-react';

interface MobileOnlyGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

interface GameStats {
  health: number;
  hunger: number;
  energy: number;
  cash: number;
  bank: number;
  wantedLevel: number;
}

export default function MobileOnlyGame({ characterId, characterName, onExit }: MobileOnlyGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EnhancedGameEngine | null>(null);
  const multiplayerRef = useRef<RealtimeMultiplayer | null>(null);
  const inputRef = useRef<GameInput>({ forward: 0, right: 0, jump: false, sprint: false });
  const touchIdRef = useRef<number | null>(null);
  const autoSprintRef = useRef(false);
  
  const [showSplash, setShowSplash] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [stats, setStats] = useState<GameStats>({ health: 100, hunger: 100, energy: 100, cash: 500, bank: 0, wantedLevel: 0 });
  const [gameTime, setGameTime] = useState('12:00');
  const [nearbyBuilding, setNearbyBuilding] = useState<GameBuilding | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [insideBuilding, setInsideBuilding] = useState<GameBuilding | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showGangs, setShowGangs] = useState(false);
  const [showLuck, setShowLuck] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
  const [gangId, setGangId] = useState<string | null>(null);
  const [equippedWeapon, setEquippedWeapon] = useState('fists');
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3(0, 0, 0));
  const [playerRotation, setPlayerRotation] = useState(0);
  const [isSprinting, setIsSprinting] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 0, y: 0 });
  const [joystickActive, setJoystickActive] = useState(false);

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      const { data } = await supabase.from('game_characters').select('*').eq('id', characterId).single();
      if (data) {
        setStats({
          health: data.health || 100,
          hunger: data.hunger || 100,
          energy: data.energy || 100,
          cash: data.cash || 500,
          bank: data.bank_balance || 0,
          wantedLevel: data.wanted_level || 0
        });
        setEquippedWeapon(data.equipped_weapon || 'fists');
        setGangId(data.gang_id ?? null);
      }
    };
    loadCharacter();
  }, [characterId]);

  // Orientation change
  useEffect(() => {
    const handleOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, []);

  // Game time
  useEffect(() => {
    const interval = setInterval(() => {
      setGameTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize multiplayer
  useEffect(() => {
    if (showSplash || !engineRef.current) return;
    
    const multiplayer = new RealtimeMultiplayer(characterId, characterName, engineRef.current.scene);
    multiplayerRef.current = multiplayer;
    
    multiplayer.setPlayerCountHandler((count) => {
      setOnlinePlayers(count);
    });
    
    multiplayer.initialize();
    
    return () => {
      multiplayer.dispose();
      multiplayerRef.current = null;
    };
  }, [showSplash, characterId, characterName]);

  // Chat channel
  useEffect(() => {
    const channel = supabase.channel('cf-roleplay-chat')
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev.slice(-50), {
          sender: payload.sender,
          message: payload.message,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Send chat message
  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    supabase.channel('cf-roleplay-world').send({
      type: 'broadcast',
      event: 'chat',
      payload: { sender: characterName, message: chatInput.trim() }
    });
    setChatMessages(prev => [...prev, {
      sender: characterName,
      message: chatInput.trim(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatInput('');
  }, [chatInput, characterName]);

  // Initialize game engine
  useEffect(() => {
    if (!containerRef.current || showSplash || insideBuilding) return;

    let engine: EnhancedGameEngine | null = null;
    let frameId: number = 0;
    let isCleanedUp = false;

    try {
      engine = new EnhancedGameEngine(containerRef.current, true);
      engine.initWorld(characterName, { x: 0, z: 0 });
      engineRef.current = engine;

      // Game loop
      const gameLoop = () => {
        if (isCleanedUp || !engine) return;
        frameId = requestAnimationFrame(gameLoop);

        try {
          const result = engine.update(inputRef.current);
          setNearbyBuilding(result.nearbyBuilding);
          
          const pos = engine.playerState.position;
          const rot = engine.playerState.rotation;
          setPlayerPosition(pos.clone());
          setPlayerRotation(rot);
          
          if (multiplayerRef.current) {
            const state = engine.playerState.isMoving 
              ? (engine.playerState.isSprinting ? 'running' : 'walking') 
              : 'idle';
            multiplayerRef.current.broadcastPosition(pos, rot, state, stats.health, equippedWeapon);
            multiplayerRef.current.update(0.016);
          }
        } catch (error) {
          console.error('Game loop error:', error);
        }
      };

      gameLoop();

      const handleResize = () => engine?.handleResize();
      window.addEventListener('resize', handleResize);

      return () => {
        isCleanedUp = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (engine) {
          engine.dispose();
          if (containerRef.current?.contains(engine.renderer.domElement)) {
            containerRef.current.removeChild(engine.renderer.domElement);
          }
        }
      };
    } catch (error) {
      console.error('Failed to initialize game engine:', error);
      toast.error('Failed to load game. Please try again.');
      onExit();
    }
  }, [showSplash, characterName, insideBuilding, onExit, stats.health, equippedWeapon]);

  // Joystick handlers
  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return;
    
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    setJoystickActive(true);
    setJoystickOrigin({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;

    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    let dx = touch.clientX - joystickOrigin.x;
    let dy = touch.clientY - joystickOrigin.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 55;
    const sprintThreshold = 50;
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    setJoystickPos({ x: dx, y: dy });
    
    const normalizedX = dx / maxDistance;
    const normalizedZ = dy / maxDistance;
    inputRef.current.right = normalizedX;
    inputRef.current.forward = -normalizedZ;
    
    const shouldSprint = distance >= sprintThreshold;
    if (shouldSprint !== autoSprintRef.current) {
      autoSprintRef.current = shouldSprint;
      inputRef.current.sprint = shouldSprint;
      setIsSprinting(shouldSprint);
    }
  }, [joystickOrigin]);

  const handleJoystickEnd = useCallback(() => {
    touchIdRef.current = null;
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    inputRef.current.forward = 0;
    inputRef.current.right = 0;
    if (autoSprintRef.current) {
      autoSprintRef.current = false;
      inputRef.current.sprint = false;
      setIsSprinting(false);
    }
  }, []);

  // Exit game
  const handleExit = useCallback(async () => {
    if (engineRef.current) {
      const pos = engineRef.current.playerState.position;
      await supabase.from('game_characters').update({
        position_x: pos.x,
        position_y: pos.z,
        is_online: false,
        health: stats.health,
        hunger: stats.hunger,
        energy: stats.energy
      }).eq('id', characterId);
    }
    onExit();
  }, [characterId, onExit, stats]);

  // Menu actions
  const handleMenuAction = useCallback((action: string) => {
    const openInfo = (title: string, message: string) => {
      setInfoModal({ title, message });
      setShowSideMenu(false);
    };

    switch(action) {
      case 'garage':
      case 'armory':
      case 'business':
        setShowShop(true);
        setShowSideMenu(false);
        break;
      case 'jobs':
        setShowJobs(true);
        setShowSideMenu(false);
        break;
      case 'gangs':
        setShowGangs(true);
        setShowSideMenu(false);
        break;
      case 'luck':
        setShowLuck(true);
        setShowSideMenu(false);
        break;
      case 'events':
        openInfo('Events', 'No live events are running right now.\n\nCheck back later — limited-time events appear here when they go live.');
        break;
      case 'tasks':
        openInfo('Tasks', 'Daily tasks refresh at midnight.\n\nComplete Jobs to earn cash + XP, and keep your Wanted Level low to increase success rates.');
        break;
      case 'friends':
        openInfo('Friends', 'Friends unlock after you own a Phone.\n\nTip: win one from Try Your Luck or buy one in the store when available.');
        break;
      case 'parking':
        openInfo('Parking', 'Parking unlocks after you own your first vehicle.\n\nBuy a car in Garage or win one from Try Your Luck.');
        break;
      case 'factions':
        openInfo('Factions', 'Factions unlock after you build a reputation.\n\nDo 3+ Jobs or reach Wanted Level 1+ to unlock faction invites.');
        break;
      case 'profile':
        openInfo('Profile', `Name: ${characterName}\nWeapon: ${equippedWeapon}\nCash: $${stats.cash.toLocaleString()}\nBank: $${stats.bank.toLocaleString()}\nWanted: ${stats.wantedLevel}/5`);
        break;
      case 'main-menu':
        handleExit();
        break;
      default:
        openInfo('Locked', 'This feature is locked right now.\n\nProgress by completing Jobs, joining a Gang, and building up your cash.');
    }
  }, [characterName, equippedWeapon, handleExit, stats.bank, stats.cash, stats.wantedLevel]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  // Get weapon icon
  const getWeaponIcon = () => {
    switch (equippedWeapon) {
      case 'knife': return '🔪';
      case 'bat': return '🏏';
      case 'pistol': return '🔫';
      default: return '👊';
    }
  };

  // Splash screen
  if (showSplash) {
    return <SplashScreen characterName={characterName} onComplete={() => setShowSplash(false)} />;
  }

  // Shop interior
  if (insideBuilding) {
    return (
      <ShopInterior
        building={insideBuilding}
        characterId={characterId}
        stats={stats}
        onExit={() => setInsideBuilding(null)}
        onPurchase={(item, cost) => {
          setStats(prev => ({ ...prev, cash: prev.cash - cost }));
          toast.success(`Purchased ${item}!`);
        }}
        onDeposit={(amount) => {
          setStats(prev => ({ ...prev, cash: prev.cash - amount, bank: prev.bank + amount }));
          toast.success(`Deposited $${amount}`);
        }}
        onWithdraw={(amount) => {
          setStats(prev => ({ ...prev, cash: prev.cash + amount, bank: prev.bank - amount }));
          toast.success(`Withdrew $${amount}`);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden touch-none select-none">
      {/* Game canvas */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Landscape mode prompt */}
      {!isLandscape && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-cyan-500/30 mx-6 max-w-sm">
            <Maximize2 className="w-20 h-20 text-cyan-400 mx-auto mb-4 animate-pulse" />
            <p className="text-white font-bold text-2xl mb-2">Rotate Device</p>
            <p className="text-gray-400">Please rotate to landscape mode for the best experience</p>
          </div>
        </div>
      )}

      {/* Mobile HUD - Top Left */}
      <div className="fixed top-3 left-3 z-40 pointer-events-none">
        <div className="bg-black/70 backdrop-blur-sm rounded-xl p-3 border border-white/10 min-w-[140px]">
          <div className="text-white font-bold text-sm truncate max-w-[130px]">{characterName}</div>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xs">❤️</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all" style={{ width: `${stats.health}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-xs">⚡</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all" style={{ width: `${stats.energy}%` }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-green-400">💰 ${stats.cash.toLocaleString()}</span>
            <span className="text-gray-400">{gameTime}</span>
          </div>
          <div className="text-gray-500 text-[10px] mt-1">🌐 {onlinePlayers} online</div>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="fixed top-3 right-3 flex items-center gap-2 z-40">
        <button 
          onClick={() => setShowSideMenu(true)}
          className="p-3 bg-black/60 backdrop-blur-sm rounded-xl border border-white/20 active:scale-95"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
        <button 
          onClick={toggleFullscreen}
          className="p-3 bg-black/60 backdrop-blur-sm rounded-xl border border-white/20 active:scale-95"
        >
          <Maximize2 className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* LEFT SIDE - Large Joystick Zone */}
      <div 
        className="fixed bottom-0 left-0 w-[45%] h-[65%] touch-none z-30"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {/* Joystick visualization */}
        <div 
          className="absolute w-[140px] h-[140px] pointer-events-none"
          style={{
            left: joystickActive ? joystickOrigin.x - 70 : 30,
            top: joystickActive ? joystickOrigin.y - 70 : 'auto',
            bottom: joystickActive ? 'auto' : 40,
            transition: joystickActive ? 'none' : 'all 0.2s ease-out'
          }}
        >
          {/* Outer ring */}
          <div className={`absolute inset-0 rounded-full transition-all ${
            joystickActive 
              ? 'bg-white/15 border-2 border-cyan-400/70 shadow-lg shadow-cyan-500/30' 
              : 'bg-white/10 border-2 border-white/20'
          }`}>
            {/* Direction arrows */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-transparent border-b-white/50" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-transparent border-t-white/50" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[12px] border-transparent border-r-white/50" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-l-[12px] border-transparent border-l-white/50" />
          </div>
          
          {/* Inner stick */}
          <div 
            className={`absolute w-[65px] h-[65px] rounded-full border-2 transition-colors ${
              joystickActive 
                ? isSprinting
                  ? 'bg-gradient-to-br from-orange-400 to-red-500 border-orange-300 shadow-xl shadow-orange-500/50'
                  : 'bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300 shadow-xl shadow-cyan-500/50'
                : 'bg-gradient-to-br from-gray-500 to-gray-700 border-white/40'
            }`}
            style={{
              left: 37.5 + joystickPos.x,
              top: 37.5 + joystickPos.y,
              transition: joystickActive ? 'none' : 'all 0.15s ease-out'
            }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/30" />
          </div>
          
          {/* Sprint indicator */}
          {joystickActive && isSprinting && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-orange-500/80 px-2 py-1 rounded text-white text-xs font-bold animate-pulse">
              🏃 SPRINT
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        {/* Voice */}
        <button
          onTouchStart={() => setVoiceActive(true)}
          onTouchEnd={() => setVoiceActive(false)}
          className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all active:scale-90 ${
            voiceActive 
              ? 'bg-green-500/70 border-green-400 shadow-lg shadow-green-500/40' 
              : 'bg-black/60 border-white/30'
          }`}
        >
          <Mic className={`w-6 h-6 ${voiceActive ? 'text-white' : 'text-gray-300'}`} />
        </button>

        {/* Chat */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="w-14 h-14 rounded-full bg-black/60 border-2 border-white/30 flex items-center justify-center active:scale-90"
        >
          <MessageSquare className="w-6 h-6 text-gray-300" />
        </button>

        {/* Jump */}
        <button
          onTouchStart={() => { inputRef.current.jump = true; }}
          onTouchEnd={() => { inputRef.current.jump = false; }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/40 active:scale-90"
        >
          <ChevronUp className="w-8 h-8 text-white" />
        </button>

        {/* Interact - only when near building */}
        {nearbyBuilding && (
          <button
            onClick={() => setInsideBuilding(nearbyBuilding)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/40 active:scale-90 animate-pulse"
          >
            <span className="text-white font-black text-xl">E</span>
          </button>
        )}

        {/* Attack - Large */}
        <button
          onTouchStart={() => {}}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-400 flex items-center justify-center shadow-xl shadow-red-500/50 active:scale-90"
        >
          <span className="text-4xl">{getWeaponIcon()}</span>
        </button>
      </div>

      {/* Center crosshair */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40 z-20">
        <Crosshair className="w-6 h-6 text-white" />
      </div>

      {/* Interaction prompt */}
      {nearbyBuilding && (
        <div className="fixed bottom-[28%] left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl px-5 py-3 border border-cyan-500/60">
            <span className="text-cyan-400 font-bold">Tap E to enter {nearbyBuilding.name}</span>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-black/90 backdrop-blur-sm rounded-xl border border-white/20 z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <span className="text-white font-bold text-sm">World Chat</span>
            <button onClick={() => setShowChat(false)} className="p-1">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="h-32 overflow-y-auto px-4 py-2 space-y-1">
            {chatMessages.slice(-10).map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="text-cyan-400 font-medium">{msg.sender}:</span>
                <span className="text-white ml-2">{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="flex px-4 py-2 border-t border-white/10 gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="flex-1 bg-gray-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button 
              onClick={handleSendMessage}
              className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Combat system */}
      <GameCombat
        characterId={characterId}
        characterName={characterName}
        playerPosition={playerPosition}
        playerRotation={playerRotation}
        health={stats.health}
        onHealthChange={(health) => setStats(prev => ({ ...prev, health }))}
        multiplayer={multiplayerRef.current}
        equippedWeapon={equippedWeapon}
      />

      {/* Side menu */}
      <GameSideMenu
        isOpen={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        gameTime={gameTime}
        onlinePlayers={onlinePlayers}
        onMenuAction={handleMenuAction}
      />

      {/* Shop UI */}
      <ShopUI
        isOpen={showShop}
        onClose={() => setShowShop(false)}
        playerCash={stats.cash}
        onPurchase={(item) => {
          if (stats.cash >= item.price) {
            setStats(prev => ({ ...prev, cash: prev.cash - item.price }));
            toast.success(`Purchased ${item.name}!`);
          }
        }}
      />

      {/* Jobs */}
      {showJobs && (
        <CriminalJobsSystem
          characterId={characterId}
          characterName={characterName}
          cash={stats.cash}
          energy={stats.energy}
          wantedLevel={stats.wantedLevel}
          onCashChange={(delta) => setStats(prev => ({ ...prev, cash: prev.cash + delta }))}
          onEnergyChange={(delta) => setStats(prev => ({ ...prev, energy: Math.max(0, Math.min(100, prev.energy + delta)) }))}
          onWantedLevelChange={(level) => setStats(prev => ({ ...prev, wantedLevel: Math.max(0, Math.min(5, level)) }))}
          onClose={() => setShowJobs(false)}
        />
      )}

      {/* Gangs */}
      {showGangs && (
        <GangSystem
          characterId={characterId}
          characterName={characterName}
          currentGangId={gangId}
          onClose={() => setShowGangs(false)}
          onJoinGang={(id) => setGangId(id)}
          onLeaveGang={() => setGangId(null)}
        />
      )}

      {/* Try Your Luck */}
      <TryYourLuckPanel
        isOpen={showLuck}
        characterId={characterId}
        cash={stats.cash}
        spinCost={5000}
        onClose={() => setShowLuck(false)}
        onCashDelta={(delta) => {
          setStats((prev) => {
            const nextCash = prev.cash + delta;
            void supabase.from('game_characters').update({ cash: nextCash }).eq('id', characterId);
            return { ...prev, cash: nextCash };
          });
        }}
        onPrizeWon={(prize: LuckPrize) => {
          if (prize.kind === 'item') {
            void supabase.from('game_messages').insert({
              sender_id: characterId,
              sender_name: characterName,
              message_type: 'system',
              message: `🎁 ${characterName} won: ${prize.label}`,
              receiver_id: null,
            });
          }
        }}
      />

      {/* Info modal (replaces "coming soon") */}
      <MobileInfoModal
        isOpen={!!infoModal}
        title={infoModal?.title || ''}
        message={infoModal?.message || ''}
        onClose={() => setInfoModal(null)}
      />
    </div>
  );
}
