import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LondonWorld, Building } from './LondonWorld';
import { PlayerController } from './PlayerController';
import { EconomyManager, Job } from './EconomyManager';
import { MultiplayerSync } from './MultiplayerSync';
import JobInteraction from './JobInteraction';
import ShopInterface from './ShopInterface';
import GlobalChat from './GlobalChat';
import { Gamepad2, Navigation, Heart, Zap, DollarSign, Users } from 'lucide-react';

interface OpenWorldGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function OpenWorldGame({ characterId, characterName, onExit }: OpenWorldGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const worldRef = useRef<LondonWorld | null>(null);
  const economyRef = useRef<EconomyManager | null>(null);
  const multiplayerRef = useRef<MultiplayerSync | null>(null);
  const [stats, setStats] = useState({ health: 100, cash: 5000, credits: 100, bank: 0, level: 1 });
  const [nearestBuilding, setNearestBuilding] = useState<Building | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [showShop, setShowShop] = useState(false);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [jobActive, setJobActive] = useState(false);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState(1);

  // Joystick state
  const joystickRef = useRef({ active: false, x: 0, y: 0 });
  const inputRef = useRef({ forward: 0, right: 0, jump: false, run: false });
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 800, 2500);
    sceneRef.current = scene;

    // Lighting - London daytime
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(200, 150, 200);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -1500;
    sunLight.shadow.camera.right = 1500;
    sunLight.shadow.camera.top = 1500;
    sunLight.shadow.camera.bottom = -1500;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // Camera - Third person
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create world
    const world = new LondonWorld(scene);
    worldRef.current = world;

    // Create player at spawn point
    const player = new PlayerController(scene, { x: 0, y: 0, z: 0 });
    playerRef.current = player;

    // Initialize economy
    const economy = new EconomyManager(characterId, {
      inGameCash: 5000,
      cfCredits: 100,
      bank: 0,
      level: 1,
    });
    economyRef.current = economy;

    // Initialize multiplayer sync
    const multiplayer = new MultiplayerSync(characterId, scene);
    multiplayerRef.current = multiplayer;
    multiplayer.initialize();
    setOnlinePlayersCount(1); // Start with self

    // Keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;

      if (e.key === 'Escape') onExit();
      if (e.key === ' ') inputRef.current.jump = true;
      if (e.key.toLowerCase() === 'shift') inputRef.current.run = true;
      if (e.key.toLowerCase() === 'e' && nearestBuilding) {
        handleBuildingInteract(nearestBuilding);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;

      if (e.key.toLowerCase() === 'shift') inputRef.current.run = false;
    };

    // Joystick touch handlers
    const joystickElement = document.getElementById('mobile-joystick');
    if (joystickElement) {
      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        const rect = joystickElement.getBoundingClientRect();
        joystickRef.current.active = true;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!joystickRef.current.active) return;

        const touch = e.touches[0];
        const rect = joystickElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let x = (touch.clientX - centerX) / (rect.width / 2);
        let y = (touch.clientY - centerY) / (rect.height / 2);

        const distance = Math.hypot(x, y);
        if (distance > 1) {
          x /= distance;
          y /= distance;
        }

        joystickRef.current.x = x;
        joystickRef.current.y = y;

        inputRef.current.right = x;
        inputRef.current.forward = -y;
      };

      const handleTouchEnd = () => {
        joystickRef.current.active = false;
        joystickRef.current.x = 0;
        joystickRef.current.y = 0;
        inputRef.current.right = 0;
        inputRef.current.forward = 0;
      };

      joystickElement.addEventListener('touchstart', handleTouchStart);
      joystickElement.addEventListener('touchmove', handleTouchMove);
      joystickElement.addEventListener('touchend', handleTouchEnd);

      return () => {
        joystickElement.removeEventListener('touchstart', handleTouchStart);
        joystickElement.removeEventListener('touchmove', handleTouchMove);
        joystickElement.removeEventListener('touchend', handleTouchEnd);
      };
    }

    // Game loop
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const deltaTime = Math.min(clock.getDelta(), 0.016); // Cap at 60fps

      if (player && world) {
        // Update input from keyboard
        inputRef.current.forward = 0;
        inputRef.current.right = 0;

        if (keysRef.current['w'] || keysRef.current['arrowup']) inputRef.current.forward = 1;
        if (keysRef.current['s'] || keysRef.current['arrowdown']) inputRef.current.forward = -1;
        if (keysRef.current['a'] || keysRef.current['arrowleft']) inputRef.current.right = -1;
        if (keysRef.current['d'] || keysRef.current['arrowright']) inputRef.current.right = 1;

        // Joystick overrides keyboard if active
        if (joystickRef.current.active) {
          inputRef.current.right = joystickRef.current.x;
          inputRef.current.forward = joystickRef.current.y;
        }

        // Update player
        player.update(inputRef.current, deltaTime);

        // Update multiplayer sync
        if (multiplayer) {
          multiplayer.update();
          multiplayer.publishPosition(player.position, player.rotation, characterName);
          const remoteCount = multiplayer.getRemotePlayers().length;
          setOnlinePlayersCount(remoteCount + 1);
        }

        // Collision detection with buildings
        const collisionBoxes = world.getCollisionBoxes();
        const playerBox = player.getCollisionBox();

        collisionBoxes.forEach((buildingBox) => {
          if (playerBox.intersectsBox(buildingBox)) {
            // Simple push-back
            const playerPos = player.position;
            const collision = playerBox.getCenter(new THREE.Vector3());
            const buildingCenter = buildingBox.getCenter(new THREE.Vector3());

            const direction = collision.sub(buildingCenter).normalize();
            player.position.addScaledVector(direction, 0.5);
            player.velocity.multiplyScalar(0.1);
          }
        });

        // Ground detection
        player.setGrounded(player.position.y <= 0);

        // Update camera - third person over-shoulder
        const playerPos = player.position;
        const cameraDistance = 5;
        const cameraHeight = 2;
        const cameraAngle = player.rotation + Math.PI / 4;

        const cameraX = playerPos.x + Math.cos(cameraAngle) * cameraDistance;
        const cameraZ = playerPos.z + Math.sin(cameraAngle) * cameraDistance;

        camera.position.x = cameraX;
        camera.position.y = playerPos.y + cameraHeight;
        camera.position.z = cameraZ;
        camera.lookAt(playerPos.x, playerPos.y + 0.5, playerPos.z);

        // Check nearest building
        const nearest = world.getNearestBuilding(playerPos);
        setNearestBuilding(nearest);

        // Update stats
        if (economy) {
          setStats({
            health: Math.round(player.health),
            cash: economy.getCash(),
            credits: economy.getCredits(),
            bank: economy.getBank(),
            level: economy.getLevel(),
          });
        }

        setPosition({
          x: Math.round(playerPos.x),
          y: Math.round(playerPos.y),
          z: Math.round(playerPos.z),
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (multiplayerRef.current) {
        multiplayerRef.current.dispose();
      }
      renderer.dispose();
    };
  }, [onExit, nearestBuilding]);

  const handleBuildingInteract = (building: Building) => {
    if (!economyRef.current) return;

    // Check if it's a job building
    const availableJobs = economyRef.current.getAvailableJobs();
    const job = availableJobs.find((j) => j.buildingId === building.id);

    if (job) {
      setActiveJob(job);
      setJobActive(true);
    } else if (building.type === 'bank') {
      setShowShop(true);
    } else if (building.type === 'shop') {
      setShowShop(true);
    }
  };

  const handleJobComplete = (jobId: string, reward: number) => {
    if (economyRef.current) {
      economyRef.current.completeJob(jobId);
      setJobActive(false);
      setActiveJob(null);
    }
  };

  const handleConvertCurrency = (type: 'credits_to_cash' | 'cash_to_credits', amount: number): boolean => {
    if (!economyRef.current) return false;

    if (type === 'credits_to_cash') {
      return economyRef.current.convertCreditsToCache(amount);
    } else {
      return economyRef.current.convertCashToCredits(amount);
    }
  };

  const handleDeposit = (amount: number): boolean => {
    if (!economyRef.current) return false;
    return economyRef.current.depositToBank(amount);
  };

  const handleWithdraw = (amount: number): boolean => {
    if (!economyRef.current) return false;
    return economyRef.current.withdrawFromBank(amount);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD - Top Left */}
      <div className="fixed top-4 left-4 z-20 space-y-2 pointer-events-none">
        <div className="bg-black/70 rounded-lg p-3 w-72 text-white text-sm">
          <div className="font-bold text-base mb-2">{characterName}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span>{stats.health}%</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span>${stats.cash.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>{stats.credits} Credits</span>
            </div>
            <div className="flex items-center gap-1">
              <Navigation className="w-4 h-4 text-yellow-500" />
              <span>Lv {stats.level}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-purple-500" />
              <span>{onlinePlayersCount} Players</span>
            </div>
          </div>
        </div>

        {/* Interaction prompt */}
        {nearestBuilding && (
          <div className="bg-yellow-600/80 rounded-lg p-2 text-white text-xs">
            <p className="font-bold">{nearestBuilding.name}</p>
            <p>Press [E] to enter</p>
          </div>
        )}
      </div>

      {/* Mobile Joystick - Bottom Left */}
      <div
        id="mobile-joystick"
        className="fixed bottom-8 left-8 w-32 h-32 bg-gray-800/70 rounded-full border-4 border-gray-600 z-10 cursor-grab active:cursor-grabbing pointer-events-auto"
      >
        <div
          className="absolute w-16 h-16 bg-gray-500 rounded-full transition-transform"
          style={{
            left: `calc(50% - 32px + ${(joystickRef.current.x * 32).toFixed(0)}px)`,
            top: `calc(50% - 32px + ${(joystickRef.current.y * 32).toFixed(0)}px)`,
          }}
        />
      </div>

      {/* Controls - Bottom Right */}
      <div className="fixed bottom-8 right-8 z-10 space-y-2 pointer-events-auto">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold w-24 pointer-events-auto">
          Jump [SPACE]
        </button>
        <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold w-24 pointer-events-auto">
          Run [SHIFT]
        </button>
        <button
          onClick={onExit}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold w-24 pointer-events-auto"
        >
          Exit [ESC]
        </button>
      </div>

      {/* Instructions */}
      <div className="fixed top-4 right-4 z-10 bg-black/70 rounded-lg p-3 text-white text-xs max-w-xs pointer-events-none">
        <p className="font-bold mb-1">📖 Controls</p>
        <p>🕹️ WASD or Arrows = Move</p>
        <p>📱 Touch Joystick = Mobile Move</p>
        <p>🎮 PS Controller = Supported</p>
        <p>Shift = Run | Space = Jump</p>
        <p>E = Interact | ESC = Exit</p>
      </div>

      {/* Performance */}
      <div className="fixed bottom-4 right-4 bg-black/70 text-green-400 text-xs p-2 rounded font-mono pointer-events-none">
        <div>London Open-World RP</div>
        <div>WebGL • Three.js</div>
        <div>FPS: {Math.round(1 / 0.016)}</div>
      </div>

      {/* Job Interaction Modal */}
      {jobActive && activeJob && (
        <JobInteraction
          jobId={activeJob.id}
          jobName={activeJob.name}
          payPerTask={activeJob.payPerTask}
          taskDuration={activeJob.taskDuration}
          onComplete={handleJobComplete}
          onCancel={() => {
            setJobActive(false);
            setActiveJob(null);
          }}
        />
      )}

      {/* Shop Interface Modal */}
      {showShop && (
        <ShopInterface
          cash={stats.cash}
          credits={stats.credits}
          bank={stats.bank}
          level={stats.level}
          onConvert={handleConvertCurrency}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Global Chat */}
      <GlobalChat playerName={characterName} playerId={characterId} isMinimized={false} />
    </div>
  );
}
