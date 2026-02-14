import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedGameEngine, GameInput } from './EnhancedGameEngine';
import { GameBuilding } from './UKWorld';
import { RealtimeMultiplayer } from './RealtimeMultiplayer';
import ShopInterior from './ShopInterior';
import GameCombat, { WEAPONS } from './GameCombat';
import SplashScreen from './SplashScreen';
import GameSideMenu from './GameSideMenu';
import ShopUI from './ShopUI';
import CriminalJobsSystem from './CriminalJobsSystem';
import GangSystem from './GangSystem';
import TryYourLuckPanel, { type LuckPrize } from './TryYourLuckPanel';
import MobileInfoModal from './MobileInfoModal';
import CFCreditsExchangeMenu from './CFCreditsExchangeMenu';
import PropertyInterior from './PropertyInterior';
import WeaponWheel from './WeaponWheel';
import VehicleSystem, { addVehicleToInventory, addWeaponToInventory, SHOP_TO_WEAPON, type OwnedVehicle } from './VehicleSystem';
import { Maximize2, X, Menu, MessageSquare, Mic, Crosshair, ChevronUp, Map, Star, Users, Heart, Zap, DollarSign, ShoppingCart, Swords, Car, Shield } from 'lucide-react';

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
  const voiceStreamRef = useRef<MediaStream | null>(null);
  
  const [showSplash, setShowSplash] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [stats, setStats] = useState<GameStats>({ health: 100, hunger: 100, energy: 100, cash: 500, bank: 0, wantedLevel: 0 });
  const [armor, setArmor] = useState(0);
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
  const [showCreditsExchange, setShowCreditsExchange] = useState(false);
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
  const [engineReady, setEngineReady] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [attackTrigger, setAttackTrigger] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [showWeaponWheel, setShowWeaponWheel] = useState(false);
  const [ownedWeapons, setOwnedWeapons] = useState<string[]>(['fists']);
  const [isInVehicle, setIsInVehicle] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState<OwnedVehicle | null>(null);
  const [showGarage, setShowGarage] = useState(false);
  const [ammo, setAmmo] = useState(30);
  const [aimOffset, setAimOffset] = useState({ x: 0, y: 0 });
  const aimTouchRef = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const [charColors, setCharColors] = useState<{ skinTone?: number; hairColor?: number; shirtColor?: number; pantsColor?: number } | null>(null);

  const weapon = WEAPONS[equippedWeapon] || WEAPONS.fists;
  const hasGun = weapon.type === 'ranged';
  const [controlsFlipped, setControlsFlipped] = useState(false);

  // Load character data including colors
  useEffect(() => {
    const loadCharacter = async () => {
      const { data } = await supabase.from('game_characters').select('*').eq('id', characterId).single();
      if (data) {
        setStats({ health: data.health || 100, hunger: data.hunger || 100, energy: data.energy || 100, cash: data.cash || 500, bank: data.bank_balance || 0, wantedLevel: data.wanted_level || 0 });
        setArmor((data as any).armor || 0);
        setEquippedWeapon(data.equipped_weapon || 'fists');
        setGangId(data.gang_id ?? null);
        // Parse hex colors to THREE.js hex numbers
        const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);
        setCharColors({
          skinTone: data.skin_color ? hexToNum(data.skin_color) : undefined,
          hairColor: data.hair_color ? hexToNum(data.hair_color) : undefined,
          shirtColor: data.shirt_color ? hexToNum(data.shirt_color) : undefined,
          pantsColor: data.pants_color ? hexToNum(data.pants_color) : undefined,
        });
      }
    };
    loadCharacter();
    const raw = localStorage.getItem(`cf_weapons_${characterId}`);
    if (raw) { try { setOwnedWeapons(['fists', ...JSON.parse(raw).filter((w: string) => w !== 'fists')]); } catch {} }
  }, [characterId]);

  useEffect(() => {
    const handleOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setGameTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!engineReady || !engineRef.current) return;
    const multiplayer = new RealtimeMultiplayer(characterId, characterName, engineRef.current.scene);
    multiplayerRef.current = multiplayer;
    multiplayer.setPlayerCountHandler((count) => setOnlinePlayers(count));
    multiplayer.initialize();
    supabase.from('game_characters').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', characterId).then();
    return () => {
      multiplayer.dispose();
      multiplayerRef.current = null;
      supabase.from('game_characters').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('id', characterId).then();
    };
  }, [engineReady, characterId, characterName]);

  const chatChannelRef = useRef<any>(null);
  useEffect(() => {
    const channel = supabase.channel('cf-roleplay-world-chat', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev.slice(-50), { sender: payload.sender, message: payload.message, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }]);
      }).subscribe();
    chatChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); chatChannelRef.current = null; };
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !chatChannelRef.current) return;
    chatChannelRef.current.send({ type: 'broadcast', event: 'chat', payload: { sender: characterName, message: chatInput.trim() } });
    setChatMessages(prev => [...prev, { sender: characterName, message: chatInput.trim(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }]);
    setChatInput('');
  }, [chatInput, characterName]);

  // Voice - real mic access for walkie-talkie
  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      setVoiceActive(true);
      toast.success('🎙️ Mic active - Push to talk');
    } catch {
      toast.error('Mic access denied');
    }
  }, []);

  const stopVoice = useCallback(() => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach(t => t.stop());
      voiceStreamRef.current = null;
    }
    setVoiceActive(false);
  }, []);

  useEffect(() => {
    return () => { stopVoice(); };
  }, [stopVoice]);

  useEffect(() => {
    if (!containerRef.current || showSplash || insideBuilding || !charColors) return;
    let engine: EnhancedGameEngine | null = null;
    let frameId = 0;
    let isCleanedUp = false;
    try {
      engine = new EnhancedGameEngine(containerRef.current, true);
      engine.initWorld(characterName, { x: 0, z: 0 }, charColors);
      engineRef.current = engine;
      setEngineReady(true);
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
            const state = engine.playerState.isMoving ? (engine.playerState.isSprinting ? 'running' : 'walking') : 'idle';
            multiplayerRef.current.broadcastPosition(pos, rot, state, stats.health, equippedWeapon);
            multiplayerRef.current.update(0.016);
          }
        } catch (err) { console.error('Game loop error:', err); }
      };
      gameLoop();
      const handleResize = () => engine?.handleResize();
      window.addEventListener('resize', handleResize);
      return () => {
        isCleanedUp = true; setEngineReady(false); cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (engine) { engine.dispose(); if (containerRef.current?.contains(engine.renderer.domElement)) containerRef.current.removeChild(engine.renderer.domElement); }
      };
    } catch (err) { console.error('Engine init failed:', err); toast.error('Failed to load game.'); onExit(); }
  }, [showSplash, characterName, insideBuilding, onExit, stats.health, equippedWeapon, charColors]);

  // Joystick
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
    for (let i = 0; i < e.touches.length; i++) { if (e.touches[i].identifier === touchIdRef.current) { touch = e.touches[i]; break; } }
    if (!touch) return;
    let dx = touch.clientX - joystickOrigin.x;
    let dy = touch.clientY - joystickOrigin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 55;
    if (distance > maxDist) { dx = (dx / distance) * maxDist; dy = (dy / distance) * maxDist; }
    setJoystickPos({ x: dx, y: dy });
    inputRef.current.right = dx / maxDist;
    inputRef.current.forward = dy / maxDist;
    const shouldSprint = distance >= 50;
    if (shouldSprint !== autoSprintRef.current) { autoSprintRef.current = shouldSprint; inputRef.current.sprint = shouldSprint; setIsSprinting(shouldSprint); }
  }, [joystickOrigin]);

  const handleJoystickEnd = useCallback(() => {
    touchIdRef.current = null; setJoystickActive(false); setJoystickPos({ x: 0, y: 0 });
    inputRef.current.forward = 0; inputRef.current.right = 0;
    if (autoSprintRef.current) { autoSprintRef.current = false; inputRef.current.sprint = false; setIsSprinting(false); }
  }, []);

  const handleExit = useCallback(async () => {
    if (engineRef.current) {
      const pos = engineRef.current.playerState.position;
      await supabase.from('game_characters').update({ position_x: pos.x, position_y: pos.z, is_online: false, health: stats.health, hunger: stats.hunger, energy: stats.energy }).eq('id', characterId);
    }
    onExit();
  }, [characterId, onExit, stats]);

  const handleMenuAction = useCallback((action: string) => {
    const openInfo = (t: string, m: string) => { setInfoModal({ title: t, message: m }); setShowSideMenu(false); };
    switch(action) {
      case 'garage': setShowGarage(true); setShowSideMenu(false); break;
      case 'armory': case 'business': setShowShop(true); setShowSideMenu(false); break;
      case 'parking': setShowGarage(true); setShowSideMenu(false); break;
      case 'jobs': setShowJobs(true); setShowSideMenu(false); break;
      case 'gangs': setShowGangs(true); setShowSideMenu(false); break;
      case 'luck': setShowLuck(true); setShowSideMenu(false); break;
      case 'events': openInfo('Events', 'No live events right now. Check back soon for double XP weekends and heist events!'); break;
      case 'tasks': openInfo('Daily Tasks', '1. ✅ Login today\n2. ⬜ Complete 3 jobs\n3. ⬜ Win a fight\n4. ⬜ Earn $5,000\n\nRewards reset at midnight.'); break;
      case 'friends': openInfo('Friends', 'Add friends by tapping on nearby players. Friends list coming in next update!'); break;
      // parking handled above
      case 'factions': openInfo('Factions', 'Join a gang first to unlock faction wars! Visit the Gangs menu.'); break;
      case 'profile': openInfo('Profile', `Name: ${characterName}\nWeapon: ${equippedWeapon}\nCash: $${stats.cash.toLocaleString()}\nBank: $${stats.bank.toLocaleString()}\nWanted: ${'⭐'.repeat(stats.wantedLevel)}${'☆'.repeat(5 - stats.wantedLevel)}`); break;
      case 'main-menu': handleExit(); break;
      default: openInfo('Coming Soon', 'This feature is being developed.');
    }
  }, [characterName, equippedWeapon, handleExit, stats]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  // Auto-enter fullscreen immersive mode on game load
  useEffect(() => {
    const enterImmersive = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    // Small delay to ensure DOM is ready
    const timer = setTimeout(enterImmersive, 500);
    return () => clearTimeout(timer);
  }, [showSplash]);

  // Handle entering buildings
  const handleEnterBuilding = useCallback(() => {
    if (!nearbyBuilding) return;
    setInsideBuilding(nearbyBuilding);
  }, [nearbyBuilding]);

  if (showSplash) return <SplashScreen characterName={characterName} onComplete={() => setShowSplash(false)} />;

  // Property interior (houses)
  if (insideBuilding && insideBuilding.type === 'property') {
    return (
      <PropertyInterior
        building={insideBuilding}
        characterId={characterId}
        characterName={characterName}
        stats={stats}
        onExit={() => setInsideBuilding(null)}
        onStatsChange={(newStats) => setStats(prev => ({ ...prev, ...newStats }))}
      />
    );
  }

  // Regular building interior
  if (insideBuilding) {
    return (
      <ShopInterior building={insideBuilding} characterId={characterId} stats={stats}
        onExit={() => setInsideBuilding(null)}
        onPurchase={(item, cost) => { setStats(prev => ({ ...prev, cash: prev.cash - cost })); toast.success(`Purchased ${item}!`); }}
        onDeposit={(amount) => { setStats(prev => ({ ...prev, cash: prev.cash - amount, bank: prev.bank + amount })); }}
        onWithdraw={(amount) => { setStats(prev => ({ ...prev, cash: prev.cash + amount, bank: prev.bank - amount })); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden touch-none select-none">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Landscape prompt */}
      {!isLandscape && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-cyan-500/30 mx-6 max-w-sm">
            <Maximize2 className="w-20 h-20 text-cyan-400 mx-auto mb-4 animate-pulse" />
            <p className="text-white font-bold text-2xl mb-2">Rotate Device</p>
            <p className="text-gray-400">Please rotate to landscape mode</p>
          </div>
        </div>
      )}

      {/* ======= ONESTATE HUD ======= */}

      {/* TOP LEFT - Minimap */}
      <div className="fixed top-2 left-2 z-40 pointer-events-auto">
        <div className="text-[10px] text-white/50 font-mono mb-1">60 FPS • 📶</div>
        {showMinimap && (
          <div className="relative w-[130px] h-[95px] bg-gray-800/80 backdrop-blur-sm rounded-lg overflow-hidden border border-yellow-500/50">
            <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 to-gray-700/40" />
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-yellow-400/40" />
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-yellow-400/40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ transform: `translate(-50%, -50%) rotate(${playerRotation * (180/Math.PI)}deg)` }}>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[14px] border-transparent border-b-yellow-400 drop-shadow-lg" />
            </div>
            <div className="absolute top-3 right-4 w-2 h-2 bg-red-500 rounded-full" />
            <div className="absolute bottom-4 left-6 w-2 h-2 bg-blue-400 rounded-full" />
          </div>
        )}
      </div>

      {/* LEFT quick buttons */}
      <div className="fixed left-2 top-[120px] z-40 flex flex-col gap-2 pointer-events-auto">
        <button onClick={() => setShowMinimap(!showMinimap)} className="w-9 h-9 rounded-lg bg-green-600/30 border border-green-500/50 flex items-center justify-center active:scale-90">
          <Map className="w-4 h-4 text-green-400" />
        </button>
        <button onClick={() => setShowSideMenu(true)} className="w-9 h-9 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center active:scale-90">
          <div className="grid grid-cols-2 gap-0.5"><div className="w-1.5 h-1.5 bg-white/60 rounded-sm" /><div className="w-1.5 h-1.5 bg-white/60 rounded-sm" /><div className="w-1.5 h-1.5 bg-white/60 rounded-sm" /><div className="w-1.5 h-1.5 bg-white/60 rounded-sm" /></div>
        </button>
        <button onClick={() => setShowLuck(true)} className="relative w-9 h-9 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center active:scale-90">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">!</span>
        </button>
        <button onClick={() => setShowGangs(true)} className="w-9 h-9 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center active:scale-90">
          <Users className="w-4 h-4 text-white/60" />
        </button>
        <button onClick={() => { const next = !isSprinting; setIsSprinting(next); inputRef.current.sprint = next; }}
          className={`w-9 h-9 rounded-full border flex items-center justify-center active:scale-90 mt-2 ${isSprinting ? 'bg-orange-500/40 border-orange-400' : 'bg-gray-700/30 border-gray-600/30'}`}>
          <span className="text-sm">🏃</span>
        </button>
      </div>

      {/* TOP CENTER - Chat bar */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
        <button onClick={() => setShowChat(!showChat)} className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm rounded-lg px-4 py-1.5 border border-gray-700/50">
          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400 text-xs">Tap to write a message</span>
        </button>
      </div>

      {/* TOP RIGHT - Store + Currency + Stats + Weapon */}
      <div className="fixed top-2 right-2 z-40 pointer-events-auto flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowJobs(true)} className="p-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50"><span className="text-sm">💼</span></button>
          <button onClick={() => setShowLuck(true)} className="relative p-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50">
            <span className="text-sm">🎁</span>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
          </button>
          <button className="relative p-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50">
            <span className="text-sm">🔔</span>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">5</span>
          </button>
          <button onClick={() => setShowShop(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/80 rounded-lg font-bold text-black text-xs active:scale-95">
            <ShoppingCart className="w-4 h-4" /> STORE
          </button>
        </div>
        {/* Cash display - tap + to open CF Credits Exchange */}
        <div className="flex items-center gap-1 bg-gray-800/60 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-gray-700/50">
          <DollarSign className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-bold text-sm">{(stats.cash + stats.bank).toLocaleString()}</span>
          <button onClick={() => setShowCreditsExchange(true)} className="ml-1 w-5 h-5 bg-yellow-500 rounded text-black font-bold text-xs flex items-center justify-center active:scale-90">+</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center border-2 border-yellow-300">
            <span className="text-[10px] font-black text-black">1</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-400" />
              <div className="w-16 h-1.5 bg-gray-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all" style={{ width: `${stats.health}%` }} />
              </div>
            </div>
            {armor > 0 && (
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-400" />
                <div className="w-16 h-1.5 bg-gray-700/80 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${armor}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-400" />
              <div className="w-16 h-1.5 bg-gray-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${stats.energy}%` }} />
              </div>
            </div>
          </div>
        </div>
        {/* Weapon info + ammo */}
        <div className="flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm rounded-lg p-1.5 border border-gray-700/50">
          <div className="w-12 h-8 bg-gray-700/60 rounded flex items-center justify-center">
            <span className="text-lg">{weapon.icon}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white font-bold text-sm">{weapon.type === 'ranged' ? ammo : '∞'}</span>
            {weapon.type === 'ranged' && ammo <= 5 && ammo > 0 && <span className="text-red-400 text-[8px]">LOW</span>}
            {weapon.type === 'ranged' && ammo === 0 && <span className="text-red-500 text-[8px] font-bold animate-pulse">EMPTY</span>}
          </div>
        </div>
      </div>

      {/* Menu + Fullscreen buttons */}
      <div className="fixed top-2 right-[calc(50%-60px)] z-40 flex gap-1.5 pointer-events-auto">
        <button onClick={() => setShowSideMenu(true)} className="p-2 bg-black/50 backdrop-blur-sm rounded-lg border border-white/15 active:scale-90">
          <Menu className="w-5 h-5 text-white" />
        </button>
        <button onClick={toggleFullscreen} className="p-2 bg-black/50 backdrop-blur-sm rounded-lg border border-white/15 active:scale-90">
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* RIGHT SIDE - Chat + Voice */}
      <div className="fixed right-3 top-[40%] -translate-y-1/2 z-40 flex flex-col gap-3 pointer-events-auto">
        <button onClick={() => setShowChat(!showChat)} className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90">
          <MessageSquare className="w-5 h-5 text-white/70" />
        </button>
        <button 
          onTouchStart={(e) => { e.preventDefault(); startVoice(); }} 
          onTouchEnd={() => stopVoice()}
          onMouseDown={() => startVoice()}
          onMouseUp={() => stopVoice()}
          className={`w-11 h-11 rounded-full flex items-center justify-center border active:scale-90 ${voiceActive ? 'bg-green-500/70 border-green-400 animate-pulse' : 'bg-white/10 border-white/20'}`}>
          <Mic className={`w-5 h-5 ${voiceActive ? 'text-white' : 'text-white/70'}`} />
        </button>
      </div>

      {/* LEFT - Joystick zone */}
      <div className="fixed bottom-0 left-0 w-[45%] h-[65%] touch-none z-30"
        onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd} onTouchCancel={handleJoystickEnd}>
        <div className="absolute w-[140px] h-[140px] pointer-events-none"
          style={{ left: joystickActive ? joystickOrigin.x - 70 : 30, top: joystickActive ? joystickOrigin.y - 70 : 'auto', bottom: joystickActive ? 'auto' : 40, transition: joystickActive ? 'none' : 'all 0.2s ease-out' }}>
          <div className={`absolute inset-0 rounded-full transition-all ${joystickActive ? 'bg-white/15 border-2 border-cyan-400/70 shadow-lg shadow-cyan-500/30' : 'bg-white/10 border-2 border-white/20'}`}>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-transparent border-b-white/50" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-transparent border-t-white/50" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[12px] border-transparent border-r-white/50" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-l-[12px] border-transparent border-l-white/50" />
          </div>
          <div className={`absolute w-[65px] h-[65px] rounded-full border-2 transition-colors ${joystickActive ? isSprinting ? 'bg-gradient-to-br from-orange-400 to-red-500 border-orange-300 shadow-xl shadow-orange-500/50' : 'bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300 shadow-xl shadow-cyan-500/50' : 'bg-gradient-to-br from-gray-500 to-gray-700 border-white/40'}`}
            style={{ left: 37.5 + joystickPos.x, top: 37.5 + joystickPos.y, transition: joystickActive ? 'none' : 'all 0.15s ease-out' }}>
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/30" />
          </div>
          {joystickActive && isSprinting && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-orange-500/80 px-2 py-1 rounded text-white text-xs font-bold animate-pulse">🏃 SPRINT</div>
          )}
        </div>
      </div>

      {/* FIRE BUTTON - on opposite side of AIM (left side by default, right if flipped) */}
      <div className={`fixed bottom-6 ${controlsFlipped ? 'right-4' : 'left-[180px]'} z-40 pointer-events-auto flex flex-col items-center gap-2`}>
        {/* Jump button */}
        <button onTouchStart={() => { inputRef.current.jump = true; }} onTouchEnd={() => { inputRef.current.jump = false; }}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90">
          <ChevronUp className="w-6 h-6 text-white" />
        </button>
        {/* FIRE / ATTACK button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); setAttackTrigger(prev => prev + 1); }}
          onClick={() => setAttackTrigger(prev => prev + 1)}
          className={`w-[72px] h-[72px] rounded-full border-4 flex items-center justify-center shadow-xl active:scale-90 transition-transform ${
            hasGun
              ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-400/80 shadow-red-500/50'
              : 'bg-gradient-to-br from-orange-500 to-red-600 border-orange-400/80 shadow-orange-500/50'
          }`}>
          <span className="text-4xl">{weapon.icon}</span>
        </button>
      </div>

      {/* AIM BUTTON - on opposite side of FIRE (right side by default, left if flipped) */}
      <div className={`fixed bottom-6 ${controlsFlipped ? 'left-[180px]' : 'right-4'} z-40 pointer-events-auto flex flex-col items-center gap-2`}>
        {/* Weapon switch */}
        <button onClick={() => setShowWeaponWheel(true)}
          className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/10 flex items-center gap-1.5 active:scale-95">
          <span className="text-lg">{weapon.icon}</span>
          <div>
            <div className="text-white text-[10px] font-bold capitalize">{equippedWeapon}</div>
            <div className="text-gray-400 text-[8px]">{weapon.damage} DMG • {weapon.range}m</div>
          </div>
        </button>
        {/* Garage */}
        <button onClick={() => setShowGarage(true)}
          className="w-10 h-10 rounded-full bg-cyan-600/40 border border-cyan-400/50 flex items-center justify-center active:scale-90">
          <Car className="w-5 h-5 text-cyan-300" />
        </button>
        {/* Enter building */}
        {nearbyBuilding && (
          <button onClick={handleEnterBuilding}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/40 active:scale-90 animate-pulse">
            <span className="text-white font-black text-lg">E</span>
          </button>
        )}
        {/* AIM button - touch & drag to move crosshair */}
        {hasGun && (
          <div
            onTouchStart={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              aimTouchRef.current = { id: t.identifier, startX: t.clientX, startY: t.clientY };
              setIsAiming(true);
            }}
            onTouchMove={(e) => {
              if (!aimTouchRef.current) return;
              let touch: React.Touch | null = null;
              for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === aimTouchRef.current.id) { touch = e.touches[i]; break; }
              }
              if (!touch) return;
              const dx = touch.clientX - aimTouchRef.current.startX;
              const dy = touch.clientY - aimTouchRef.current.startY;
              const maxOffset = 150;
              setAimOffset({
                x: Math.max(-maxOffset, Math.min(maxOffset, dx * 1.5)),
                y: Math.max(-maxOffset, Math.min(maxOffset, dy * 1.5))
              });
            }}
            onTouchEnd={() => { aimTouchRef.current = null; setIsAiming(false); setAimOffset({ x: 0, y: 0 }); }}
            onTouchCancel={() => { aimTouchRef.current = null; setIsAiming(false); setAimOffset({ x: 0, y: 0 }); }}
            onMouseDown={() => setIsAiming(true)}
            onMouseUp={() => { setIsAiming(false); setAimOffset({ x: 0, y: 0 }); }}
            className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all active:scale-90 ${
              isAiming
                ? 'bg-red-500/60 border-red-400 shadow-lg shadow-red-500/50'
                : 'bg-white/10 border-white/30'
            }`}>
            <Crosshair className={`w-7 h-7 ${isAiming ? 'text-red-300' : 'text-white/60'}`} />
          </div>
        )}
      </div>

      {/* Flip controls button - small toggle in top-left near menu */}
      <div className="fixed top-14 left-2 z-40 pointer-events-auto">
        <button onClick={() => setControlsFlipped(f => !f)}
          className="w-8 h-8 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center active:scale-90"
          title="Switch hands">
          <span className="text-xs">🔄</span>
        </button>
      </div>

      {/* Crosshair - ONLY visible when aiming with a gun */}
      {hasGun && isAiming && (
        <div className="fixed pointer-events-none z-20"
          style={{ left: window.innerWidth / 2 + aimOffset.x, top: window.innerHeight / 2 + aimOffset.y, transform: 'translate(-50%, -50%)' }}>
          <Crosshair className="w-10 h-10 text-red-400 drop-shadow-lg" />
          <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}

      {/* Nearby building prompt */}
      {nearbyBuilding && (
        <div className="fixed bottom-[30%] left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-cyan-500/60">
            <span className="text-cyan-400 font-bold text-sm">📍 {nearbyBuilding.name}</span>
            {nearbyBuilding.type === 'property' && <span className="text-yellow-400 text-xs ml-2">🏠 Enter</span>}
          </div>
        </div>
      )}

      {/* Server time */}
      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-20">
        <div className="text-[10px] text-white/40 font-mono">SERVER TIME: {gameTime} • 🌐 {onlinePlayers} online</div>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-black/90 backdrop-blur-sm rounded-xl border border-white/20 z-50 pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <span className="text-white font-bold text-sm">World Chat</span>
            <button onClick={() => setShowChat(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="h-32 overflow-y-auto px-4 py-2 space-y-1">
            {chatMessages.slice(-10).map((msg, i) => (
              <div key={i} className="text-xs"><span className="text-cyan-400 font-medium">{msg.sender}:</span><span className="text-white ml-2">{msg.message}</span></div>
            ))}
          </div>
          <div className="flex px-4 py-2 border-t border-white/10 gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type message..."
              className="flex-1 bg-gray-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
            <button onClick={handleSendMessage} className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium">Send</button>
          </div>
        </div>
      )}

      {/* Combat system */}
      <GameCombat
        characterId={characterId} characterName={characterName}
        playerPosition={playerPosition} playerRotation={playerRotation}
        health={stats.health} armor={armor}
        onHealthChange={(h) => setStats(prev => ({ ...prev, health: h }))}
        onArmorChange={setArmor}
        multiplayer={multiplayerRef.current} equippedWeapon={equippedWeapon}
        nearbyBuilding={nearbyBuilding} attackTrigger={attackTrigger}
        aimOffset={aimOffset} ammo={ammo} onAmmoChange={setAmmo}
        camera={engineRef.current?.camera ?? null}
      />
      <CFCreditsExchangeMenu
        isOpen={showCreditsExchange}
        onClose={() => setShowCreditsExchange(false)}
        characterId={characterId}
        currentCash={stats.cash}
        onCashChange={(newCash) => setStats(prev => ({ ...prev, cash: newCash }))}
      />

      {/* Weapon Wheel */}
      <WeaponWheel
        isOpen={showWeaponWheel}
        onClose={() => setShowWeaponWheel(false)}
        equippedWeapon={equippedWeapon}
        ownedWeapons={ownedWeapons}
        onSelectWeapon={(w) => {
          setEquippedWeapon(w);
          void supabase.from('game_characters').update({ equipped_weapon: w }).eq('id', characterId);
          toast.success(`Equipped ${w}!`);
        }}
      />

      {/* Vehicle Garage */}
      <VehicleSystem
        characterId={characterId}
        playerPosition={playerPosition}
        playerRotation={playerRotation}
        isInVehicle={isInVehicle}
        onEnterVehicle={(v) => { setIsInVehicle(true); setCurrentVehicle(v); }}
        onExitVehicle={() => { setIsInVehicle(false); setCurrentVehicle(null); }}
        onPositionUpdate={() => {}}
      />

      {/* Overlays */}
      <GameSideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} gameTime={gameTime} onlinePlayers={onlinePlayers} onMenuAction={handleMenuAction} />
      <ShopUI isOpen={showShop} onClose={() => setShowShop(false)} playerCash={stats.cash}
        onPurchase={(item) => {
          if (stats.cash >= item.price) {
            setStats(prev => ({ ...prev, cash: prev.cash - item.price }));
            // Save vehicle or weapon to inventory
            if (item.category === 'vehicles') {
              addVehicleToInventory(characterId, item.id, item.name);
              toast.success(`${item.name} added to garage!`);
            } else if (item.id === 'weapon-6') {
              // Body Armor purchase
              setArmor(prev => Math.min(100, prev + 50));
              void supabase.from('game_characters').update({ armor: Math.min(100, armor + 50) }).eq('id', characterId);
              toast.success(`🛡️ +50 Armor equipped!`);
            } else if (item.category === 'weapons' && SHOP_TO_WEAPON[item.id]) {
              addWeaponToInventory(characterId, SHOP_TO_WEAPON[item.id]);
              setOwnedWeapons(prev => prev.includes(SHOP_TO_WEAPON[item.id]) ? prev : [...prev, SHOP_TO_WEAPON[item.id]]);
              toast.success(`${item.name} added to armory!`);
            } else if (item.category === 'food') {
              // Ammo purchases
              if (item.id === 'ammo-1' || item.id === 'ammo-2') {
                setAmmo(prev => prev + 30);
                toast.success(`+30 ammo loaded!`);
              } else if (item.id === 'ammo-3') {
                setAmmo(prev => prev + 90);
                toast.success(`+90 ammo loaded!`);
              }
              // Apply food effects
              else if (item.id === 'food-5') setStats(prev => ({ ...prev, health: Math.min(100, prev.health + 50) }));
              else if (item.id === 'food-3' || item.id === 'food-4') setStats(prev => ({ ...prev, energy: Math.min(100, prev.energy + (item.id === 'food-3' ? 25 : 15)) }));
              else setStats(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + (item.id === 'food-2' ? 30 : 20)) }));
              toast.success(`Used ${item.name}!`);
            } else {
              toast.success(`Purchased ${item.name}!`);
            }
            void supabase.from('game_characters').update({ cash: stats.cash - item.price }).eq('id', characterId);
          }
        }} />
      {showJobs && <CriminalJobsSystem characterId={characterId} characterName={characterName} cash={stats.cash} energy={stats.energy} wantedLevel={stats.wantedLevel}
        onCashChange={(d) => setStats(prev => ({ ...prev, cash: prev.cash + d }))} onEnergyChange={(d) => setStats(prev => ({ ...prev, energy: Math.max(0, Math.min(100, prev.energy + d)) }))}
        onWantedLevelChange={(l) => setStats(prev => ({ ...prev, wantedLevel: Math.max(0, Math.min(5, l)) }))} onClose={() => setShowJobs(false)} />}
      {showGangs && <GangSystem characterId={characterId} characterName={characterName} currentGangId={gangId}
        onClose={() => setShowGangs(false)} onJoinGang={(id) => setGangId(id)} onLeaveGang={() => setGangId(null)} />}
      <TryYourLuckPanel isOpen={showLuck} characterId={characterId} cash={stats.cash} spinCost={5000}
        onClose={() => setShowLuck(false)}
        onCashDelta={(d) => { setStats(prev => { const nc = prev.cash + d; void supabase.from('game_characters').update({ cash: nc }).eq('id', characterId); return { ...prev, cash: nc }; }); }}
        onPrizeWon={(prize: LuckPrize) => { if (prize.kind === 'item') void supabase.from('game_messages').insert({ sender_id: characterId, sender_name: characterName, message_type: 'system', message: `🎁 ${characterName} won: ${prize.label}`, receiver_id: null }); }} />
      <MobileInfoModal isOpen={!!infoModal} title={infoModal?.title || ''} message={infoModal?.message || ''} onClose={() => setInfoModal(null)} />
    </div>
  );
}
