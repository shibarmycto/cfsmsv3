import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { EnhancedGameEngine, GameInput } from './EnhancedGameEngine';
import { GameBuilding } from './UKWorld';
import { RealtimeMultiplayer } from './RealtimeMultiplayer';
import EliteHUD from './EliteHUD';
import OneStateHUD from './OneStateHUD';
import GameSideMenu from './GameSideMenu';
import ShopUI from './ShopUI';
import SplashScreen from './SplashScreen';
import ShopInterior from './ShopInterior';
import GameCombat from './GameCombat';
import EnhancedMobileControls from './EnhancedMobileControls';

interface EliteGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function EliteGame({ characterId, characterName, onExit }: EliteGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EnhancedGameEngine | null>(null);
  const multiplayerRef = useRef<RealtimeMultiplayer | null>(null);
  const inputRef = useRef<GameInput>({ forward: 0, right: 0, jump: false, sprint: false });
  const keysRef = useRef<Record<string, boolean>>({});
  const sprintingRef = useRef(false);
  
  const [showSplash, setShowSplash] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [stats, setStats] = useState({ health: 100, hunger: 100, energy: 100, cash: 500, bank: 0, wantedLevel: 0 });
  const [gameTime, setGameTime] = useState('12:00');
  const [nearbyBuilding, setNearbyBuilding] = useState<GameBuilding | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, time: string}[]>([]);
  const [walkieTalkieActive, setWalkieTalkieActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'third' | 'first'>('third');
  const [insideBuilding, setInsideBuilding] = useState<GameBuilding | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [equippedWeapon, setEquippedWeapon] = useState('fists');
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3(0, 0, 0));
  const [playerRotation, setPlayerRotation] = useState(0);
  const [isSprinting, setIsSprinting] = useState(false);
  
  const isMobile = useIsMobile();

  // Load character data and equipped weapon
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

  // Initialize realtime multiplayer
  useEffect(() => {
    if (showSplash || !engineRef.current) return;
    
    const multiplayer = new RealtimeMultiplayer(characterId, characterName, engineRef.current.scene);
    multiplayerRef.current = multiplayer;
    
    multiplayer.setPlayerCountHandler((count) => {
      setOnlinePlayers(count);
    });
    
    multiplayer.initialize().then(() => {
      console.log('Multiplayer initialized');
    });
    
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
  const handleSendMessage = useCallback((message: string) => {
    supabase.channel('cf-roleplay-world').send({
      type: 'broadcast',
      event: 'chat',
      payload: { sender: characterName, message }
    });
    setChatMessages(prev => [...prev, {
      sender: characterName,
      message,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }]);
  }, [characterName]);

  // Mobile controls
  const handleMobileMove = useCallback((x: number, z: number) => {
    inputRef.current.right = x;
    inputRef.current.forward = -z;
  }, []);

  const handleMobileAction = useCallback((action: 'jump' | 'interact' | 'sprint' | 'menu' | 'walkie') => {
    if (action === 'jump') inputRef.current.jump = true;
    else if (action === 'sprint') inputRef.current.sprint = true;
    else if (action === 'interact' && nearbyBuilding) {
      setInsideBuilding(nearbyBuilding);
    }
    else if (action === 'menu') setShowMenu(true);
    else if (action === 'walkie') setWalkieTalkieActive(prev => !prev);
  }, [nearbyBuilding]);

  // Initialize game engine
  useEffect(() => {
    if (!containerRef.current || showSplash || insideBuilding) return;

    let engine: EnhancedGameEngine | null = null;
    let frameId: number = 0;
    let isCleanedUp = false;

    try {
      engine = new EnhancedGameEngine(containerRef.current, isMobile);
      engine.initWorld(characterName, { x: 0, z: 0 });
      engineRef.current = engine;

      // Keyboard input
      const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        keysRef.current[key] = true;
        
        if (key === 'escape') setShowMenu(prev => !prev);
        if (key === 't' && !showChat) { e.preventDefault(); setShowChat(true); }
        if (key === 'v') setCameraMode(prev => prev === 'third' ? 'first' : 'third');
        if (key === 'e' && nearbyBuilding) setInsideBuilding(nearbyBuilding);
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        keysRef.current[e.key.toLowerCase()] = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      // Game loop
      const gameLoop = () => {
        if (isCleanedUp || !engine) return;
        frameId = requestAnimationFrame(gameLoop);

        try {
          // Only reset when using keyboard; mobile handlers write to inputRef directly
          const hasKeyboard = keysRef.current['w'] || keysRef.current['s'] ||
                              keysRef.current['a'] || keysRef.current['d'] ||
                              keysRef.current['arrowup'] || keysRef.current['arrowdown'] ||
                              keysRef.current['arrowleft'] || keysRef.current['arrowright'] ||
                              keysRef.current[' '] || keysRef.current['shift'];

          if (hasKeyboard) {
            inputRef.current.forward = 0;
            inputRef.current.right = 0;
            inputRef.current.jump = false;
            inputRef.current.sprint = sprintingRef.current;

            if (keysRef.current['w'] || keysRef.current['arrowup']) inputRef.current.forward = 1;
            if (keysRef.current['s'] || keysRef.current['arrowdown']) inputRef.current.forward = -1;
            if (keysRef.current['a'] || keysRef.current['arrowleft']) inputRef.current.right = -1;
            if (keysRef.current['d'] || keysRef.current['arrowright']) inputRef.current.right = 1;
            if (keysRef.current[' ']) inputRef.current.jump = true;
            if (keysRef.current['shift']) inputRef.current.sprint = true;
          }

          const result = engine.update(inputRef.current);
          setNearbyBuilding(result.nearbyBuilding);
          
          // Update position state for combat system
          const pos = engine.playerState.position;
          const rot = engine.playerState.rotation;
          setPlayerPosition(pos.clone());
          setPlayerRotation(rot);
          
          // Broadcast position to other players
          if (multiplayerRef.current) {
            const state = engine.playerState.isMoving 
              ? (engine.playerState.isSprinting ? 'running' : 'walking') 
              : 'idle';
            multiplayerRef.current.broadcastPosition(pos, rot, state, stats.health, equippedWeapon);
            
            // Update remote player meshes
            const delta = 0.016; // ~60fps
            multiplayerRef.current.update(delta);
          }
        } catch (error) {
          console.error('Game loop error:', error);
        }
      };

      gameLoop();

      // Resize handler
      const handleResize = () => {
        if (engine) engine.handleResize();
      };
      window.addEventListener('resize', handleResize);

      // Cleanup function
      return () => {
        isCleanedUp = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
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
  }, [showSplash, characterName, isMobile, showChat, nearbyBuilding, insideBuilding, onExit, stats.health, equippedWeapon]);

  // Update camera mode in engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCameraMode(cameraMode);
    }
  }, [cameraMode]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
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

  // Handle menu actions
  const handleMenuAction = useCallback((action: string) => {
    switch(action) {
      case 'garage':
      case 'armory':
        setShowShop(true);
        setShowSideMenu(false);
        break;
      case 'main-menu':
        handleExit();
        break;
      default:
        toast.info(`${action} coming soon!`);
    }
    setShowSideMenu(false);
  }, [handleExit]);

  // Handle shop purchase
  const handleShopPurchase = useCallback((item: { id: string; name: string; price: number }) => {
    if (stats.cash >= item.price) {
      setStats(prev => ({ ...prev, cash: prev.cash - item.price }));
      toast.success(`Purchased ${item.name}!`);
    }
  }, [stats.cash]);

  // Show splash screen
  if (showSplash) {
    return <SplashScreen characterName={characterName} onComplete={() => setShowSplash(false)} />;
  }

  // Show shop interior
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
    <div className="fixed inset-0 bg-black overflow-hidden touch-none">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Mobile: Enhanced controls with combat */}
      {isMobile && (
        <>
          <EnhancedMobileControls
            onMove={handleMobileMove}
            onAttack={() => {}} // Handled by GameCombat
            onJump={() => { inputRef.current.jump = true; }}
            onInteract={() => { if (nearbyBuilding) setInsideBuilding(nearbyBuilding); }}
            onSprint={(active) => { 
              sprintingRef.current = active;
              setIsSprinting(active);
              inputRef.current.sprint = active; 
            }}
            onOpenMenu={() => setShowSideMenu(true)}
            onOpenChat={() => setShowChat(true)}
            onToggleVoice={() => setWalkieTalkieActive(prev => !prev)}
            isLandscape={isLandscape}
            onToggleFullscreen={toggleFullscreen}
            isSprinting={isSprinting}
            voiceActive={walkieTalkieActive}
            nearbyInteraction={nearbyBuilding?.name || null}
            equippedWeapon={equippedWeapon}
          />
          
          {/* Mobile HUD overlay */}
          <div className="fixed top-3 left-3 z-40 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-2 border border-white/10">
              <div className="text-white font-bold text-sm">{characterName}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-green-400 text-xs">❤️ {stats.health}%</div>
                <div className="text-yellow-400 text-xs">💰 ${stats.cash.toLocaleString()}</div>
              </div>
              <div className="text-gray-400 text-xs mt-1">🌐 {onlinePlayers} online • {gameTime}</div>
            </div>
          </div>
        </>
      )}

      {/* Desktop HUD */}
      {!isMobile && (
        <EliteHUD
          characterName={characterName}
          stats={stats}
          gameTime={gameTime}
          onlinePlayers={onlinePlayers}
          nearbyBuilding={nearbyBuilding}
          showChat={showChat}
          setShowChat={setShowChat}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          chatMessages={chatMessages}
          onExit={handleExit}
          onSendMessage={handleSendMessage}
          isMobile={isMobile}
          walkieTalkieActive={walkieTalkieActive}
          setWalkieTalkieActive={setWalkieTalkieActive}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
        />
      )}

      {/* Combat system - works on both mobile and desktop */}
      <GameCombat
        characterId={characterId}
        characterName={characterName}
        playerPosition={playerPosition}
        playerRotation={playerRotation}
        health={stats.health}
        onHealthChange={(health) => setStats(prev => ({ ...prev, health }))}
        multiplayer={multiplayerRef.current}
        equippedWeapon={equippedWeapon}
        nearbyBuilding={nearbyBuilding}
        ammo={999}
        onAmmoChange={() => {}}
      />

      {/* Side menu panel */}
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
        onPurchase={handleShopPurchase}
      />
    </div>
  );
}
