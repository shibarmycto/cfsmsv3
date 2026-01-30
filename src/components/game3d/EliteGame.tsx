import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { EnhancedGameEngine, GameInput } from './EnhancedGameEngine';
import { GameBuilding } from './UKWorld';
import EliteHUD from './EliteHUD';
import EliteMobileControls from './EliteMobileControls';
import SplashScreen from './SplashScreen';
import ShopInterior from './ShopInterior';

interface EliteGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function EliteGame({ characterId, characterName, onExit }: EliteGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EnhancedGameEngine | null>(null);
  const inputRef = useRef<GameInput>({ forward: 0, right: 0, jump: false, sprint: false });
  const keysRef = useRef<Record<string, boolean>>({});
  
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
  
  const isMobile = useIsMobile();

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

  // Multiplayer sync
  useEffect(() => {
    const channel = supabase.channel('cf-roleplay-world')
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev.slice(-50), {
          sender: payload.sender,
          message: payload.message,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }]);
      })
      .on('broadcast', { event: 'player-join' }, () => {
        setOnlinePlayers(prev => prev + 1);
      })
      .on('broadcast', { event: 'player-leave' }, () => {
        setOnlinePlayers(prev => Math.max(1, prev - 1));
      })
      .subscribe(() => {
        channel.send({ type: 'broadcast', event: 'player-join', payload: { name: characterName } });
      });

    return () => {
      channel.send({ type: 'broadcast', event: 'player-leave', payload: { name: characterName } });
      supabase.removeChannel(channel);
    };
  }, [characterName]);

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

    const engine = new EnhancedGameEngine(containerRef.current, isMobile);
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
    let frameId: number;
    const gameLoop = () => {
      frameId = requestAnimationFrame(gameLoop);

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
        inputRef.current.sprint = false;

        if (keysRef.current['w'] || keysRef.current['arrowup']) inputRef.current.forward = 1;
        if (keysRef.current['s'] || keysRef.current['arrowdown']) inputRef.current.forward = -1;
        if (keysRef.current['a'] || keysRef.current['arrowleft']) inputRef.current.right = -1;
        if (keysRef.current['d'] || keysRef.current['arrowright']) inputRef.current.right = 1;
        if (keysRef.current[' ']) inputRef.current.jump = true;
        if (keysRef.current['shift']) inputRef.current.sprint = true;
      }

      const result = engine.update(inputRef.current);
      setNearbyBuilding(result.nearbyBuilding);
    };

    gameLoop();

    // Resize handler
    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      if (containerRef.current?.contains(engine.renderer.domElement)) {
        containerRef.current.removeChild(engine.renderer.domElement);
      }
    };
  }, [showSplash, characterName, isMobile, showChat, nearbyBuilding, insideBuilding]);

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
      
      {isMobile && (
        <EliteMobileControls
          onMove={handleMobileMove}
          onAction={handleMobileAction}
          isLandscape={isLandscape}
          onToggleFullscreen={toggleFullscreen}
          isSprinting={inputRef.current.sprint}
          walkieTalkieActive={walkieTalkieActive}
        />
      )}
    </div>
  );
}
