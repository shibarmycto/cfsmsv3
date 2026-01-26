import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface MobileGame3DProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function MobileGame3D({ characterId, characterName, onExit }: MobileGame3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const playerPosRef = useRef({ x: 0, y: 0, z: 0 });
  const playerRotRef = useRef(0);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileControls, setShowMobileControls] = useState(true);

  // Mobile touch controls
  const touchStartRef = useRef({ x: 0, y: 0 });
  const movementRef = useRef({ forward: 0, right: 0 });
  const gamepadRef = useRef<Gamepad | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // Dark background
    scene.fog = new THREE.Fog(0x1a1a2e, 500, 1500);
    sceneRef.current = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Mobile-optimized camera (first-person over-shoulder)
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    // Renderer with mobile optimization
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio for mobile
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting (GTA-style)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(100, 80, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -300;
    directionalLight.shadow.camera.right = 300;
    directionalLight.shadow.camera.top = 300;
    directionalLight.shadow.camera.bottom = -300;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Create realistic terrain
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundCanvas = createAsphaltTexture();
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.repeat.set(8, 8);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.8,
      metalness: 0,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create realistic buildings (GTA style)
    createRealisticBuildings(scene);

    // Create player (realistic character)
    const player = createRealisticCharacter(scene);
    playerRef.current = player;
    setIsLoading(false);

    // Mobile input handlers
    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;

        // Left side movement
        if (touchStartRef.current.x < window.innerWidth / 2) {
          movementRef.current.forward = -deltaY / 100;
          movementRef.current.right = deltaX / 100;
        }
      }
    };

    const handleTouchEnd = () => {
      movementRef.current = { forward: 0, right: 0 };
    };

    // Keyboard input
    const keys: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys[key] = true;

      if (key === 'escape') {
        onExit();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys[key] = false;
    };

    // Update player movement based on input
    const updateMovement = () => {
      let forward = 0;
      let right = 0;

      if (keys['w'] || keys['arrowup']) forward -= 1;
      if (keys['s'] || keys['arrowdown']) forward += 1;
      if (keys['a'] || keys['arrowleft']) right -= 1;
      if (keys['d'] || keys['arrowright']) right += 1;

      // Mobile touch
      forward = Math.max(Math.min(forward + movementRef.current.forward, 1), -1);
      right = Math.max(Math.min(right + movementRef.current.right, 1), -1);

      // Gamepad support
      const gamepad = navigator.getGamepads()[0];
      if (gamepad) {
        gamepadRef.current = gamepad;
        // Left stick for movement
        forward += gamepad.axes[1] * -1;
        right += gamepad.axes[0];
        forward = Math.max(Math.min(forward, 1), -1);
        right = Math.max(Math.min(right, 1), -1);
      }

      return { forward: forward * 0.15, right: right * 0.15 };
    };

    // Animation loop
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const deltaTime = clock.getDelta();

      if (player) {
        const movement = updateMovement();

        // Update player position with collision
        const newX = playerPosRef.current.x + movement.right;
        const newZ = playerPosRef.current.z + movement.forward;

        // Check bounds
        if (Math.abs(newX) < 900 && Math.abs(newZ) < 900) {
          playerPosRef.current.x = newX;
          playerPosRef.current.z = newZ;
        }

        player.position.set(playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z);

        // Update rotation
        if (movement.forward !== 0 || movement.right !== 0) {
          const angle = Math.atan2(movement.right, movement.forward);
          playerRotRef.current = angle;
          player.rotation.y = angle;
        }

        // Update camera to follow player (over-shoulder view)
        const cameraDistance = 3;
        const cameraHeight = 1.6;
        const cameraOffsetX = Math.cos(playerRotRef.current + Math.PI / 2) * cameraDistance;
        const cameraOffsetZ = Math.sin(playerRotRef.current + Math.PI / 2) * cameraDistance;

        camera.position.x = playerPosRef.current.x + cameraOffsetX;
        camera.position.y = playerPosRef.current.y + cameraHeight;
        camera.position.z = playerPosRef.current.z + cameraOffsetZ;
        camera.lookAt(
          playerPosRef.current.x,
          playerPosRef.current.y + 0.5,
          playerPosRef.current.z
        );

        setPlayerPos({
          x: Math.round(playerPosRef.current.x),
          y: Math.round(playerPosRef.current.y),
          z: Math.round(playerPosRef.current.z),
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    // Handle resize
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onExit]);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {/* Mobile HUD */}
      <div className="fixed top-4 left-4 right-4 z-10 text-white pointer-events-none">
        <div className="bg-black/70 rounded-lg p-3 w-fit">
          <div className="font-bold text-sm">{characterName}</div>
          <div className="text-xs text-gray-400">
            X: {playerPos.x} Z: {playerPos.z}
          </div>
        </div>
      </div>

      {/* Exit Button */}
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-20 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold pointer-events-auto"
      >
        EXIT
      </button>

      {/* Mobile Controls Info */}
      {showMobileControls && (
        <div className="fixed bottom-4 left-4 right-4 bg-black/80 text-white p-4 rounded-lg z-10 pointer-events-auto">
          <div className="text-sm mb-2">
            <p className="font-bold text-cyan-400 mb-1">Controls:</p>
            <p className="text-xs">📱 Touch left side to move</p>
            <p className="text-xs">🎮 PS/Xbox controller supported</p>
            <p className="text-xs">⌨️ WASD or Arrow keys</p>
          </div>
          <button
            onClick={() => setShowMobileControls(false)}
            className="text-xs text-gray-400 hover:text-white"
          >
            Close
          </button>
        </div>
      )}

      {/* Performance Stats */}
      <div className="fixed bottom-4 right-4 bg-black/70 text-white text-xs p-2 rounded pointer-events-none font-mono">
        <div className="text-cyan-400">Mobile Game</div>
        <div className="text-gray-400">Realistic Graphics</div>
      </div>
    </div>
  );
}

// Helper functions
function createAsphaltTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark asphalt
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 512, 512);

  // Add texture variation
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 20, Math.random() * 20);
  }

  return canvas;
}

function createRealisticCharacter(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  // Body (torso)
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.6,
    metalness: 0,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.7;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Head (realistic)
  const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.5,
    metalness: 0,
  });
  const head = new THREE.Mesh(headGeometry, skinMaterial);
  head.position.y = 1.95;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // Arms
  const armGeometry = new THREE.CylinderGeometry(0.2, 0.15, 0.9, 16);
  const armMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.5,
  });

  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.65, 1.2, 0);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.65, 1.2, 0);
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  group.add(rightArm);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.25, 0.2, 1, 16);
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.6,
  });

  const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
  leftLeg.position.set(-0.3, 0.4, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
  rightLeg.position.set(0.3, 0.4, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  group.position.set(0, 0, 0);
  scene.add(group);

  return group;
}

function createRealisticBuildings(scene: THREE.Scene) {
  const buildings = [
    { x: -150, z: -150, width: 80, height: 150, depth: 100, color: 0x333333 },
    { x: 150, z: -150, width: 100, height: 120, depth: 80, color: 0x404040 },
    { x: -150, z: 150, width: 90, height: 140, depth: 110, color: 0x353535 },
    { x: 150, z: 150, width: 110, height: 130, depth: 90, color: 0x3a3a3a },
    { x: 0, z: 0, width: 200, height: 100, depth: 150, color: 0x2f2f2f },
  ];

  buildings.forEach((buildData) => {
    const buildingGeometry = new THREE.BoxGeometry(buildData.width, buildData.height, buildData.depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: buildData.color,
      roughness: 0.7,
      metalness: 0.1,
    });

    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(buildData.x, buildData.height / 2, buildData.z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    // Windows
    const windowSize = 5;
    const spacing = 15;
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.3,
      roughness: 0.2,
    });

    for (let x = -buildData.width / 3; x < buildData.width / 3; x += spacing) {
      for (let y = 10; y < buildData.height - 10; y += spacing) {
        const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(buildData.x + x, buildData.height / 2 + y, buildData.z + buildData.depth / 2 + 0.5);
        scene.add(windowMesh);
      }
    }
  });
}
