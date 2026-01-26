import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Game3DPlayer from './Game3DPlayer';
import Game3DWorld from './Game3DWorld';
import Game3DUI from './Game3DUI';

interface Game3DSceneProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

export default function Game3DScene({ characterId, characterName, onExit }: Game3DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<Game3DPlayer | null>(null);
  const worldRef = useRef<Game3DWorld | null>(null);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 1000, 2000);
    sceneRef.current = scene;

    // Camera Setup (Isometric view)
    const width = window.innerWidth;
    const height = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(50, 80, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Initialize World
    const world = new Game3DWorld(scene);
    worldRef.current = world;

    // Initialize Player
    const player = new Game3DPlayer(scene, characterId, characterName);
    playerRef.current = player;
    setIsLoading(false);

    // Handle mouse/keyboard input
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation Loop
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const deltaTime = clock.getDelta();

      // Update player movement
      let moveX = 0;
      let moveZ = 0;

      if (keys['w'] || keys['arrowup']) moveZ -= 5;
      if (keys['s'] || keys['arrowdown']) moveZ += 5;
      if (keys['a'] || keys['arrowleft']) moveX -= 5;
      if (keys['d'] || keys['arrowright']) moveX += 5;

      if (player) {
        player.move(moveX, moveZ, deltaTime);
        setPlayerPos({
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
        });

        // Update camera to follow player (isometric angle)
        const cameraDistance = 100;
        const cameraHeight = 80;
        camera.position.x = player.position.x + cameraDistance * 0.7;
        camera.position.y = player.position.y + cameraHeight;
        camera.position.z = player.position.z + cameraDistance * 0.7;
        camera.lookAt(player.position);
      }

      // Update animations
      if (player) {
        player.update(deltaTime);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
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
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [characterId, characterName, onExit]);

  return (
    <div className="fixed inset-0">
      <div ref={containerRef} className="w-full h-full" />
      <Game3DUI
        playerName={characterName}
        position={playerPos}
        onExit={onExit}
        isLoading={isLoading}
      />
    </div>
  );
}
