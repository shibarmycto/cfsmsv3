import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Heart, Zap, DollarSign, Users, Shield, Menu, X, MessageSquare,
  Briefcase, Car, Building2, Settings, HelpCircle, BookOpen,
  Star, UserPlus, LogOut, Clock
} from 'lucide-react';

interface OpenWorldGameProps {
  characterId: string;
  characterName: string;
  onExit: () => void;
}

interface OtherPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  mesh?: THREE.Group;
}

interface GameBuilding {
  id: string;
  name: string;
  type: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}

export default function OpenWorldGame({ characterId, characterName, onExit }: OpenWorldGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const keysRef = useRef<Record<string, boolean>>({});
  const playerPosRef = useRef({ x: 0, y: 0, z: 0 });
  const playerRotRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });
  const isGroundedRef = useRef(true);
  const buildingsRef = useRef<GameBuilding[]>([]);
  const otherPlayersRef = useRef<Map<string, OtherPlayer>>(new Map());

  // UI State
  const [stats, setStats] = useState({
    health: 100, hunger: 100, energy: 100,
    cash: 500, bank: 0, wantedLevel: 0
  });
  const [gameTime, setGameTime] = useState('12:00');
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nearbyBuilding, setNearbyBuilding] = useState<GameBuilding | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      const { data } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', characterId)
        .single();
      
      if (data) {
        setStats({
          health: data.health || 100,
          hunger: data.hunger || 100,
          energy: data.energy || 100,
          cash: data.cash || 500,
          bank: data.bank_balance || 0,
          wantedLevel: data.wanted_level || 0
        });
        playerPosRef.current = { x: data.position_x || 0, y: 0, z: data.position_y || 0 };
      }
    };
    loadCharacter();
  }, [characterId]);

  // Game time clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setGameTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Multiplayer sync
  useEffect(() => {
    const channel = supabase.channel('game-world')
      .on('broadcast', { event: 'player-move' }, ({ payload }) => {
        if (payload.id !== characterId) {
          const existing = otherPlayersRef.current.get(payload.id);
          if (existing) {
            existing.x = payload.x;
            existing.y = payload.y;
            existing.z = payload.z;
            existing.name = payload.name;
          } else {
            otherPlayersRef.current.set(payload.id, {
              id: payload.id,
              name: payload.name,
              x: payload.x,
              y: payload.y,
              z: payload.z
            });
          }
          setOnlinePlayers(otherPlayersRef.current.size + 1);
        }
      })
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        setChatMessages(prev => [...prev.slice(-50), {
          sender: payload.sender,
          message: payload.message,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [characterId]);

  // Broadcast position
  const broadcastPosition = useCallback(() => {
    supabase.channel('game-world').send({
      type: 'broadcast',
      event: 'player-move',
      payload: {
        id: characterId,
        name: characterName,
        x: playerPosRef.current.x,
        y: playerPosRef.current.y,
        z: playerPosRef.current.z
      }
    });
  }, [characterId, characterName]);

  // Send chat message
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    supabase.channel('game-world').send({
      type: 'broadcast',
      event: 'chat-message',
      payload: { sender: characterName, message: chatInput }
    });
    setChatInput('');
  }, [chatInput, characterName]);

  // Initialize 3D scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 500, 2000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(200, 300, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 1000;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    scene.add(sun);

    // Ground
    createGround(scene);

    // Roads
    createRoads(scene);

    // Buildings
    createBuildings(scene);

    // Player
    const player = createPlayer(scene);
    playerMeshRef.current = player;

    // Input handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') setShowMenu(prev => !prev);
      if (e.key === 'Enter' && showChat) { e.preventDefault(); sendChatMessage(); }
      if (e.key.toLowerCase() === 't' && !showChat) { e.preventDefault(); setShowChat(true); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation loop
    let frameId: number;
    let lastBroadcast = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clockRef.current.getDelta(), 0.05);
      
      // Player movement
      const speed = keysRef.current['shift'] ? 15 : 8;
      let moveX = 0, moveZ = 0;

      if (keysRef.current['w'] || keysRef.current['arrowup']) moveZ = -1;
      if (keysRef.current['s'] || keysRef.current['arrowdown']) moveZ = 1;
      if (keysRef.current['a'] || keysRef.current['arrowleft']) moveX = -1;
      if (keysRef.current['d'] || keysRef.current['arrowright']) moveX = 1;

      if (moveX !== 0 || moveZ !== 0) {
        const angle = Math.atan2(moveX, moveZ);
        playerRotRef.current = angle;
        playerPosRef.current.x += Math.sin(angle) * speed * delta;
        playerPosRef.current.z += Math.cos(angle) * speed * delta;
      }

      // Gravity & jumping
      if (keysRef.current[' '] && isGroundedRef.current) {
        velocityRef.current.y = 8;
        isGroundedRef.current = false;
      }
      velocityRef.current.y -= 20 * delta;
      playerPosRef.current.y += velocityRef.current.y * delta;
      if (playerPosRef.current.y <= 0) {
        playerPosRef.current.y = 0;
        velocityRef.current.y = 0;
        isGroundedRef.current = true;
      }

      // Update player mesh
      if (playerMeshRef.current) {
        playerMeshRef.current.position.set(
          playerPosRef.current.x,
          playerPosRef.current.y,
          playerPosRef.current.z
        );
        playerMeshRef.current.rotation.y = playerRotRef.current;

        // Walking animation
        if (moveX !== 0 || moveZ !== 0) {
          const t = Date.now() * 0.01;
          const leftLeg = playerMeshRef.current.getObjectByName('leftLeg') as THREE.Mesh;
          const rightLeg = playerMeshRef.current.getObjectByName('rightLeg') as THREE.Mesh;
          const leftArm = playerMeshRef.current.getObjectByName('leftArm') as THREE.Mesh;
          const rightArm = playerMeshRef.current.getObjectByName('rightArm') as THREE.Mesh;
          if (leftLeg) leftLeg.rotation.x = Math.sin(t) * 0.5;
          if (rightLeg) rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5;
          if (leftArm) leftArm.rotation.x = Math.sin(t + Math.PI) * 0.3;
          if (rightArm) rightArm.rotation.x = Math.sin(t) * 0.3;
        }
      }

      // Camera follow
      const camDist = 8;
      const camHeight = 4;
      camera.position.set(
        playerPosRef.current.x - Math.sin(playerRotRef.current) * camDist,
        playerPosRef.current.y + camHeight,
        playerPosRef.current.z - Math.cos(playerRotRef.current) * camDist
      );
      camera.lookAt(playerPosRef.current.x, playerPosRef.current.y + 1.5, playerPosRef.current.z);

      // Check nearby buildings
      const playerVec = new THREE.Vector3(playerPosRef.current.x, 0, playerPosRef.current.z);
      let closest: GameBuilding | null = null;
      let closestDist = 30;
      buildingsRef.current.forEach(b => {
        const dist = playerVec.distanceTo(new THREE.Vector3(b.position.x, 0, b.position.z));
        if (dist < closestDist) {
          closestDist = dist;
          closest = b;
        }
      });
      setNearbyBuilding(closest);

      // Update other players
      otherPlayersRef.current.forEach((p, id) => {
        if (!p.mesh && sceneRef.current) {
          p.mesh = createOtherPlayer(sceneRef.current, p.name);
        }
        if (p.mesh) {
          p.mesh.position.set(p.x, p.y, p.z);
        }
      });

      // Broadcast position every 100ms
      if (Date.now() - lastBroadcast > 100) {
        broadcastPosition();
        lastBroadcast = Date.now();
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [broadcastPosition, sendChatMessage, showChat]);

  // Save position on exit
  const handleExit = async () => {
    await supabase.from('game_characters').update({
      position_x: playerPosRef.current.x,
      position_y: playerPosRef.current.z,
      is_online: false,
      health: stats.health,
      hunger: stats.hunger,
      energy: stats.energy
    }).eq('id', characterId);
    onExit();
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top HUD */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex justify-between items-start p-4">
          {/* Logo & Time */}
          <div className="bg-black/80 rounded-lg p-3 pointer-events-auto">
            <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CF ROLEPLAY
            </div>
            <div className="flex items-center gap-2 text-white text-sm mt-1">
              <Clock className="w-4 h-4" />
              <span>{gameTime}</span>
            </div>
          </div>

          {/* Wanted Level */}
          <div className="bg-black/80 rounded-lg p-3">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <Star 
                  key={i} 
                  className={`w-5 h-5 ${i <= stats.wantedLevel ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-black/80 rounded-lg p-3 min-w-[200px]">
            <div className="text-white text-sm font-bold mb-2">{characterName}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${stats.health}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${stats.energy}%` }} />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-white">
              <span className="text-green-400">${stats.cash.toLocaleString()}</span>
              <span className="text-blue-400">Bank: ${stats.bank.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-4 pointer-events-none">
        <div className="flex justify-between items-end">
          {/* Mobile joystick area */}
          <div className="w-32 h-32 bg-white/10 rounded-full border-2 border-white/30 pointer-events-auto touch-none" 
               id="joystick" />

          {/* Interaction prompt */}
          {nearbyBuilding && (
            <div className="bg-yellow-600/90 rounded-lg px-4 py-2 text-white text-center">
              <div className="font-bold">{nearbyBuilding.name}</div>
              <div className="text-sm">Press [E] to interact</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button onClick={() => setShowChat(prev => !prev)} 
                    className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </button>
            <button onClick={() => setShowMenu(prev => !prev)}
                    className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg">
              <Menu className="w-6 h-6 text-white" />
            </button>
            <button onClick={handleExit}
                    className="bg-red-600 hover:bg-red-700 p-3 rounded-lg">
              <LogOut className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Players online */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-black/70 rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
          <Users className="w-4 h-4 text-green-400" />
          <span>{onlinePlayers} Online</span>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed bottom-20 left-4 z-30 w-80 bg-black/90 rounded-lg border border-gray-700">
          <div className="p-2 border-b border-gray-700 flex justify-between items-center">
            <span className="text-white font-bold text-sm">World Chat</span>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-48 overflow-y-auto p-2 space-y-1">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-500">[{msg.time}]</span>
                <span className="text-cyan-400 ml-1">{msg.sender}:</span>
                <span className="text-white ml-1">{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-700">
            <input 
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              placeholder="Type message... (Enter to send)"
              className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 outline-none"
            />
          </div>
        </div>
      )}

      {/* Game Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Game Menu</h2>
              <button onClick={() => setShowMenu(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MenuButton icon={BookOpen} label="Rules" onClick={() => { setShowMenu(false); setShowRules(true); }} />
              <MenuButton icon={HelpCircle} label="How to Play" onClick={() => { setShowMenu(false); setShowHelp(true); }} />
              <MenuButton icon={Briefcase} label="Jobs" onClick={() => toast.info('Jobs coming soon!')} />
              <MenuButton icon={Car} label="Vehicles" onClick={() => toast.info('Vehicles coming soon!')} />
              <MenuButton icon={Building2} label="Properties" onClick={() => toast.info('Properties coming soon!')} />
              <MenuButton icon={Shield} label="Police" onClick={() => toast.info('Police system coming soon!')} />
              <MenuButton icon={Users} label="Organizations" onClick={() => toast.info('Orgs coming soon!')} />
              <MenuButton icon={Settings} label="Settings" onClick={() => toast.info('Settings coming soon!')} />
            </div>
            <button onClick={handleExit} 
                    className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg">
              Exit Game
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <Modal title="CF Roleplay Rules" onClose={() => setShowRules(false)}>
          <div className="space-y-3 text-gray-300 text-sm">
            <Rule num={1} text="No racism, discrimination, or hate speech of any kind." />
            <Rule num={2} text="No sexual content or harassment." />
            <Rule num={3} text="Roleplay realistically - no 'fail RP'." />
            <Rule num={4} text="Value your life - act as you would in real danger." />
            <Rule num={5} text="No metagaming - don't use out-of-game information." />
            <Rule num={6} text="No powergaming - give others a chance to respond." />
            <Rule num={7} text="Respect all players and staff." />
            <Rule num={8} text="No exploiting bugs or glitches." />
            <Rule num={9} text="Follow traffic laws unless in a chase." />
            <Rule num={10} text="Criminal activities require proper RP setup." />
          </div>
          <p className="mt-4 text-red-400 text-sm font-bold">
            Breaking rules may result in warnings, kicks, or permanent bans.
          </p>
        </Modal>
      )}

      {/* Help Modal */}
      {showHelp && (
        <Modal title="How to Play" onClose={() => setShowHelp(false)}>
          <div className="space-y-4 text-gray-300 text-sm">
            <HelpSection title="Movement">
              <li>WASD / Arrow Keys - Move around</li>
              <li>SHIFT - Run faster</li>
              <li>SPACE - Jump</li>
              <li>Mouse - Look around</li>
            </HelpSection>
            <HelpSection title="Interaction">
              <li>E - Interact with buildings/objects</li>
              <li>T - Open chat</li>
              <li>ESC - Open menu</li>
              <li>V - Push-to-talk (voice)</li>
            </HelpSection>
            <HelpSection title="Economy">
              <li>Get a job at the Job Center</li>
              <li>Complete tasks to earn money</li>
              <li>Deposit cash at banks</li>
              <li>Buy properties and vehicles</li>
            </HelpSection>
            <HelpSection title="Crime">
              <li>Criminal activities increase wanted level</li>
              <li>Police will chase you at high wanted levels</li>
              <li>Get caught = jail time or fines</li>
              <li>Rob other players (with proper RP)</li>
            </HelpSection>
          </div>
        </Modal>
      )}

      {/* Controls hint */}
      <div className="fixed top-1/2 right-4 -translate-y-1/2 z-10 pointer-events-none">
        <div className="bg-black/60 rounded-lg p-3 text-white text-xs space-y-1">
          <div className="font-bold mb-2">Controls</div>
          <div>WASD - Move</div>
          <div>SHIFT - Run</div>
          <div>SPACE - Jump</div>
          <div>E - Interact</div>
          <div>T - Chat</div>
          <div>ESC - Menu</div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function MenuButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 flex flex-col items-center gap-2 transition-colors">
      <Icon className="w-6 h-6 text-cyan-400" />
      <span className="text-white text-sm">{label}</span>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center overflow-y-auto">
      <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 my-8 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Rule({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-cyan-400 font-bold">{num}.</span>
      <span>{text}</span>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-cyan-400 mb-1">{title}</h3>
      <ul className="list-disc list-inside space-y-1">{children}</ul>
    </div>
  );
}

// 3D Creation Functions
function createGround(scene: THREE.Scene) {
  // Main ground
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createRoads(scene: THREE.Scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  
  // Main roads
  const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(20, 1000), roadMat);
  mainRoad.rotation.x = -Math.PI / 2;
  mainRoad.position.y = 0.01;
  scene.add(mainRoad);

  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(1000, 20), roadMat.clone());
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.y = 0.01;
  scene.add(crossRoad);

  // Road markings
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (let z = -480; z < 500; z += 20) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 8), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, z);
    scene.add(line);
  }

  // Yellow edge lines (UK style)
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
  const leftYellow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1000), yellowMat);
  leftYellow.rotation.x = -Math.PI / 2;
  leftYellow.position.set(-9.5, 0.02, 0);
  scene.add(leftYellow);

  const rightYellow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1000), yellowMat.clone());
  rightYellow.rotation.x = -Math.PI / 2;
  rightYellow.position.set(9.5, 0.02, 0);
  scene.add(rightYellow);
}

function createBuildings(scene: THREE.Scene) {
  const buildings: GameBuilding[] = [
    { id: 'bank', name: 'Barclays Bank', type: 'bank', position: new THREE.Vector3(-50, 0, -100), size: new THREE.Vector3(30, 25, 20) },
    { id: 'shop1', name: 'Corner Shop', type: 'shop', position: new THREE.Vector3(50, 0, -100), size: new THREE.Vector3(20, 15, 15) },
    { id: 'police', name: 'Police Station', type: 'police', position: new THREE.Vector3(-80, 0, 50), size: new THREE.Vector3(40, 20, 30) },
    { id: 'hospital', name: 'St Mary Hospital', type: 'hospital', position: new THREE.Vector3(80, 0, 50), size: new THREE.Vector3(50, 30, 40) },
    { id: 'jobcenter', name: 'Job Centre', type: 'job', position: new THREE.Vector3(0, 0, 150), size: new THREE.Vector3(35, 18, 25) },
    { id: 'apartments', name: 'City Apartments', type: 'apartment', position: new THREE.Vector3(-100, 0, -200), size: new THREE.Vector3(25, 50, 25) },
    { id: 'pub', name: 'The Crown Pub', type: 'pub', position: new THREE.Vector3(100, 0, -200), size: new THREE.Vector3(20, 12, 18) },
  ];

  buildings.forEach(b => {
    const buildingGroup = new THREE.Group();

    // Main structure
    const geo = new THREE.BoxGeometry(b.size.x, b.size.y, b.size.z);
    const colors: Record<string, number> = {
      bank: 0x2d5a27, shop: 0x8b4513, police: 0x1a3a5c,
      hospital: 0xeeeeee, job: 0x666666, apartment: 0x8b7355, pub: 0x654321
    };
    const mat = new THREE.MeshStandardMaterial({ color: colors[b.type] || 0x888888, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = b.size.y / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    buildingGroup.add(mesh);

    // Windows
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.5, roughness: 0.2 });
    const windowsPerFloor = Math.floor(b.size.x / 6);
    const floors = Math.floor(b.size.y / 8);
    
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < windowsPerFloor; w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), windowMat);
        win.position.set(
          -b.size.x / 2 + 4 + w * 6,
          5 + f * 8,
          b.size.z / 2 + 0.1
        );
        buildingGroup.add(win);
      }
    }

    // Door
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.5), doorMat);
    door.position.set(0, 3, b.size.z / 2 + 0.25);
    buildingGroup.add(door);

    // Sign
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, 128, 40);

    const signTex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signMat);
    sign.position.set(0, b.size.y + 3, b.size.z / 2);
    buildingGroup.add(sign);

    buildingGroup.position.copy(b.position);
    scene.add(buildingGroup);
  });

  // Store for proximity checks - this needs to be on a ref
  (window as any).__buildings = buildings;
}

function createPlayer(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  // Skin material
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.5 });

  // Head with face
  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35), skinMat);
  headGroup.add(head);

  // Eyes
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyePupil = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.08), eyeWhite);
  leftEye.position.set(-0.12, 0.05, 0.3);
  headGroup.add(leftEye);
  
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04), eyePupil);
  leftPupil.position.set(-0.12, 0.05, 0.36);
  headGroup.add(leftPupil);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.08), eyeWhite.clone());
  rightEye.position.set(0.12, 0.05, 0.3);
  headGroup.add(rightEye);

  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04), eyePupil.clone());
  rightPupil.position.set(0.12, 0.05, 0.36);
  headGroup.add(rightPupil);

  // Hair
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.37, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
  hair.position.y = 0.05;
  headGroup.add(hair);

  headGroup.position.y = 1.9;
  group.add(headGroup);

  // Body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1), bodyMat);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);

  // Arms
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7), skinMat.clone());
  leftArm.position.set(-0.45, 1.2, 0);
  leftArm.name = 'leftArm';
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7), skinMat.clone());
  rightArm.position.set(0.45, 1.2, 0);
  rightArm.name = 'rightArm';
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5c });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8), legMat);
  leftLeg.position.set(-0.15, 0.4, 0);
  leftLeg.name = 'leftLeg';
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8), legMat.clone());
  rightLeg.position.set(0.15, 0.4, 0);
  rightLeg.name = 'rightLeg';
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Shoes
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.25), shoeMat);
  leftShoe.position.set(-0.15, 0.05, 0.05);
  group.add(leftShoe);

  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.25), shoeMat.clone());
  rightShoe.position.set(0.15, 0.05, 0.05);
  group.add(rightShoe);

  scene.add(group);
  return group;
}

function createOtherPlayer(scene: THREE.Scene, name: string): THREE.Group {
  const group = createPlayer(scene);
  
  // Add name label
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.roundRect(0, 0, 256, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 42);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.position.y = 2.5;
  sprite.scale.set(2, 0.5, 1);
  group.add(sprite);

  return group;
}
