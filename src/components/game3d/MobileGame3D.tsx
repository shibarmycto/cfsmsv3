import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { createRealisticCharacter, animateCharacter } from './RealisticCharacter';
import { createUKWorld, GameBuilding } from './UKWorld';
import MobileControls from './MobileControls';
import SplashScreen from './SplashScreen';
import GameHUD from './GameHUD';

interface MobileGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function MobileGame3D({ characterId, characterName, onExit }: MobileGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const buildingsRef = useRef<GameBuilding[]>([]);
  const playerPosRef = useRef({ x: 0, y: 0, z: 0 });
  const playerRotRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });
  const isGroundedRef = useRef(true);
  const moveInputRef = useRef({ x: 0, z: 0 });
  const isSprintingRef = useRef(false);
  const isMovingRef = useRef(false);
  
  const [showSplash, setShowSplash] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [stats, setStats] = useState({ health: 100, hunger: 100, energy: 100, cash: 500, bank: 0, wantedLevel: 0 });
  const [gameTime, setGameTime] = useState('12:00');
  const [nearbyBuilding, setNearbyBuilding] = useState<GameBuilding | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, time: string}[]>([]);
  
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadCharacter = async () => {
      const { data } = await supabase.from('game_characters').select('*').eq('id', characterId).single();
      if (data) {
        setStats({ health: data.health || 100, hunger: data.hunger || 100, energy: data.energy || 100, cash: data.cash || 500, bank: data.bank_balance || 0, wantedLevel: data.wanted_level || 0 });
        playerPosRef.current = { x: Number(data.position_x) || 0, y: 0, z: Number(data.position_y) || 0 };
      }
    };
    loadCharacter();
  }, [characterId]);

  useEffect(() => {
    const handleOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setGameTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMobileMove = useCallback((x: number, z: number) => { moveInputRef.current = { x, z }; }, []);
  const handleMobileAction = useCallback((action: 'jump' | 'interact' | 'sprint') => {
    if (action === 'jump' && isGroundedRef.current) { velocityRef.current.y = 8; isGroundedRef.current = false; }
    else if (action === 'interact' && nearbyBuilding) toast.info(`Entering ${nearbyBuilding.name}...`);
    else if (action === 'sprint') { isSprintingRef.current = true; setTimeout(() => { isSprintingRef.current = false; }, 100); }
  }, [nearbyBuilding]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    if (!containerRef.current || showSplash) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 200, 800);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(100, 200, 50);
    sun.castShadow = true;
    scene.add(sun);

    buildingsRef.current = createUKWorld(scene);
    const player = createRealisticCharacter({ name: characterName, isPlayer: true });
    player.position.set(playerPosRef.current.x, 0, playerPosRef.current.z);
    scene.add(player);
    playerMeshRef.current = player;

    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') setShowMenu(prev => !prev); };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clockRef.current.getDelta(), 0.05);

      let moveX = moveInputRef.current.x, moveZ = moveInputRef.current.z;
      if (keys['w'] || keys['arrowup']) moveZ = -1;
      if (keys['s'] || keys['arrowdown']) moveZ = 1;
      if (keys['a'] || keys['arrowleft']) moveX = -1;
      if (keys['d'] || keys['arrowright']) moveX = 1;
      if (keys['shift']) isSprintingRef.current = true;

      const speed = isSprintingRef.current ? 12 : 6;
      isMovingRef.current = moveX !== 0 || moveZ !== 0;

      if (isMovingRef.current) {
        const angle = Math.atan2(moveX, moveZ);
        playerRotRef.current = angle;
        playerPosRef.current.x += Math.sin(angle) * speed * delta;
        playerPosRef.current.z += Math.cos(angle) * speed * delta;
      }

      if (keys[' '] && isGroundedRef.current) { velocityRef.current.y = 8; isGroundedRef.current = false; }
      velocityRef.current.y -= 20 * delta;
      playerPosRef.current.y += velocityRef.current.y * delta;
      if (playerPosRef.current.y <= 0) { playerPosRef.current.y = 0; velocityRef.current.y = 0; isGroundedRef.current = true; }

      if (playerMeshRef.current) {
        playerMeshRef.current.position.set(playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z);
        playerMeshRef.current.rotation.y = playerRotRef.current;
        animateCharacter(playerMeshRef.current, isMovingRef.current, isSprintingRef.current, delta);
      }

      const camDist = isMobile ? 6 : 8;
      camera.position.set(playerPosRef.current.x - Math.sin(playerRotRef.current) * camDist, playerPosRef.current.y + 4, playerPosRef.current.z - Math.cos(playerRotRef.current) * camDist);
      camera.lookAt(playerPosRef.current.x, playerPosRef.current.y + 1.5, playerPosRef.current.z);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', handleResize);

    return () => { cancelAnimationFrame(frameId); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('resize', handleResize); renderer.dispose(); containerRef.current?.contains(renderer.domElement) && containerRef.current.removeChild(renderer.domElement); };
  }, [showSplash, characterName, isMobile]);

  const handleExit = useCallback(async () => {
    await supabase.from('game_characters').update({ position_x: playerPosRef.current.x, position_y: playerPosRef.current.z, is_online: false }).eq('id', characterId);
    onExit();
  }, [characterId, onExit]);

  if (showSplash) return <SplashScreen characterName={characterName} onComplete={() => setShowSplash(false)} />;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden touch-none">
      <div ref={containerRef} className="w-full h-full" />
      <GameHUD characterName={characterName} stats={stats} gameTime={gameTime} onlinePlayers={onlinePlayers} nearbyBuilding={nearbyBuilding} showChat={showChat} setShowChat={setShowChat} showMenu={showMenu} setShowMenu={setShowMenu} chatMessages={chatMessages} onExit={handleExit} isMobile={isMobile} />
      {isMobile && <MobileControls onMove={handleMobileMove} onAction={handleMobileAction} isLandscape={isLandscape} onToggleFullscreen={toggleFullscreen} />}
    </div>
  );
}
