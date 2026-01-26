import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Users, Home, Briefcase, MessageSquare, DollarSign, Shield, Car, Coins, BookOpen, Gamepad2, Skull } from 'lucide-react';
import GameHUD from './GameHUD';
import GameChatSystem from './GameChatSystem';
import GameMenu from './GameMenu';
import OrganizationMenu from './OrganizationMenu';
import PlayerSprite from './PlayerSprite';
import VehicleSprite from './VehicleSprite';
import VehicleMenu from './VehicleMenu';
import TaxiJobMenu from './TaxiJobMenu';
import CreditExchangeMenu from './CreditExchangeMenu';
import CrimeSystem from './CrimeSystem';
import PoliceApplicationMenu from './PoliceApplicationMenu';
import RulesMenu from './RulesMenu';
import HowToPlayMenu from './HowToPlayMenu';

interface GameCharacter {
  id: string;
  user_id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  skin_color: string;
  hair_color: string;
  shirt_color: string;
  pants_color: string;
  position_x: number;
  position_y: number;
  cash: number;
  bank_balance: number;
  health: number;
  hunger: number;
  energy: number;
  current_job: string;
  job_experience: number;
  is_online: boolean;
  wanted_level?: number;
  is_knocked_out?: boolean;
  knocked_out_until?: string;
}

interface Property {
  id: string;
  name: string;
  property_type: string;
  position_x: number;
  position_y: number;
  price: number;
  owner_id: string | null;
  is_for_sale: boolean;
}

interface Vehicle {
  id: string;
  owner_id: string | null;
  vehicle_type: string;
  name: string;
  color: string;
  position_x: number;
  position_y: number;
  rotation: number;
  speed: number;
  max_speed: number;
  price: number;
  is_for_sale: boolean;
  fuel: number;
  health: number;
  is_locked: boolean;
  driver_id: string | null;
}

interface GameWorldProps {
  character: GameCharacter;
  onExit: () => void;
}

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1500;
const MOVE_SPEED = 5;
const VEHICLE_ACCELERATION = 0.5;
const VEHICLE_DECELERATION = 0.3;
const VEHICLE_TURN_SPEED = 3;
const UPDATE_INTERVAL = 100;

export default function GameWorld({ character: initialCharacter, onExit }: GameWorldProps) {
  const [character, setCharacter] = useState(initialCharacter);
  const [otherPlayers, setOtherPlayers] = useState<GameCharacter[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showVehicleMenu, setShowVehicleMenu] = useState(false);
  const [showTaxiMenu, setShowTaxiMenu] = useState(false);
  const [showCreditExchange, setShowCreditExchange] = useState(false);
  const [showCrimeMenu, setShowCrimeMenu] = useState<any>(null);
  const [showPoliceApp, setShowPoliceApp] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  
  const gameLoopRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const positionRef = useRef({ x: character.position_x, y: character.position_y });
  const vehicleRef = useRef<{ speed: number; rotation: number }>({ speed: 0, rotation: 0 });

  // Fetch properties and vehicles
  useEffect(() => {
    const fetchData = async () => {
      const [propsRes, vehiclesRes] = await Promise.all([
        supabase.from('game_properties').select('*'),
        supabase.from('game_vehicles').select('*')
      ]);
      if (propsRes.data) setProperties(propsRes.data as Property[]);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data as Vehicle[]);
    };
    fetchData();

    // Subscribe to vehicle changes
    const vehicleChannel = supabase
      .channel('game-vehicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_vehicles' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Vehicle;
          setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
          if (currentVehicle?.id === updated.id) {
            setCurrentVehicle(updated);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(vehicleChannel);
    };
  }, [currentVehicle?.id]);

  // Subscribe to other players
  useEffect(() => {
    const fetchOtherPlayers = async () => {
      const { data } = await supabase
        .from('game_characters')
        .select('*')
        .eq('is_online', true)
        .neq('id', character.id);
      
      if (data) setOtherPlayers(data as GameCharacter[]);
    };

    fetchOtherPlayers();

    const channel = supabase
      .channel('game-world')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_characters' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as GameCharacter;
            if (updated.id === character.id) return;
            
            setOtherPlayers(prev => {
              if (!updated.is_online) {
                return prev.filter(p => p.id !== updated.id);
              }
              const exists = prev.find(p => p.id === updated.id);
              if (exists) {
                return prev.map(p => p.id === updated.id ? updated : p);
              }
              return [...prev, updated];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [character.id]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showChat) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setKeysPressed(prev => new Set(prev).add(key));
      }
      if (key === 'escape') {
        setShowMenu(null);
        setShowChat(false);
        setShowVehicleMenu(false);
        setShowTaxiMenu(false);
      }
      if (key === 'enter' || key === 't') {
        if (!showChat) {
          e.preventDefault();
          setShowChat(true);
        }
      }
      // Exit vehicle with F key
      if (key === 'f' && currentVehicle) {
        e.preventDefault();
        exitVehicle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setKeysPressed(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showChat, currentVehicle]);

  // Game loop - handles both walking and driving
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (currentVehicle) {
        // Vehicle driving mode
        let accelerating = false;
        let braking = false;
        let turningLeft = false;
        let turningRight = false;

        if (keysPressed.has('w') || keysPressed.has('arrowup')) accelerating = true;
        if (keysPressed.has('s') || keysPressed.has('arrowdown')) braking = true;
        if (keysPressed.has('a') || keysPressed.has('arrowleft')) turningLeft = true;
        if (keysPressed.has('d') || keysPressed.has('arrowright')) turningRight = true;

        // Update speed
        if (accelerating) {
          vehicleRef.current.speed = Math.min(
            vehicleRef.current.speed + VEHICLE_ACCELERATION,
            currentVehicle.max_speed / 10
          );
        } else if (braking) {
          vehicleRef.current.speed = Math.max(vehicleRef.current.speed - VEHICLE_DECELERATION * 2, -3);
        } else {
          // Natural deceleration
          if (vehicleRef.current.speed > 0) {
            vehicleRef.current.speed = Math.max(0, vehicleRef.current.speed - VEHICLE_DECELERATION);
          } else if (vehicleRef.current.speed < 0) {
            vehicleRef.current.speed = Math.min(0, vehicleRef.current.speed + VEHICLE_DECELERATION);
          }
        }

        // Update rotation only when moving
        if (Math.abs(vehicleRef.current.speed) > 0.5) {
          if (turningLeft) vehicleRef.current.rotation -= VEHICLE_TURN_SPEED * (vehicleRef.current.speed > 0 ? 1 : -1);
          if (turningRight) vehicleRef.current.rotation += VEHICLE_TURN_SPEED * (vehicleRef.current.speed > 0 ? 1 : -1);
        }

        // Calculate movement based on rotation
        const radians = (vehicleRef.current.rotation - 90) * (Math.PI / 180);
        const dx = Math.cos(radians) * vehicleRef.current.speed;
        const dy = Math.sin(radians) * vehicleRef.current.speed;

        const newX = Math.max(0, Math.min(WORLD_WIDTH - 40, positionRef.current.x + dx));
        const newY = Math.max(0, Math.min(WORLD_HEIGHT - 60, positionRef.current.y + dy));

        positionRef.current = { x: newX, y: newY };
        setCharacter(prev => ({ ...prev, position_x: newX, position_y: newY }));
        setCurrentVehicle(prev => prev ? { ...prev, position_x: newX, position_y: newY, rotation: vehicleRef.current.rotation } : null);

        // Update camera
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        setCameraOffset({
          x: Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, newX - viewportWidth / 2)),
          y: Math.max(0, Math.min(WORLD_HEIGHT - viewportHeight, newY - viewportHeight / 2)),
        });

        // Sync to server
        if (timestamp - lastUpdateRef.current > UPDATE_INTERVAL) {
          lastUpdateRef.current = timestamp;
          Promise.all([
            supabase.from('game_characters').update({ position_x: newX, position_y: newY }).eq('id', character.id),
            supabase.from('game_vehicles').update({ 
              position_x: newX, 
              position_y: newY, 
              rotation: vehicleRef.current.rotation,
              speed: vehicleRef.current.speed 
            }).eq('id', currentVehicle.id)
          ]);
        }
      } else {
        // Walking mode
        let dx = 0;
        let dy = 0;

        if (keysPressed.has('w') || keysPressed.has('arrowup')) dy -= MOVE_SPEED;
        if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy += MOVE_SPEED;
        if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx -= MOVE_SPEED;
        if (keysPressed.has('d') || keysPressed.has('arrowright')) dx += MOVE_SPEED;

        if (dx !== 0 || dy !== 0) {
          const newX = Math.max(0, Math.min(WORLD_WIDTH - 40, positionRef.current.x + dx));
          const newY = Math.max(0, Math.min(WORLD_HEIGHT - 60, positionRef.current.y + dy));
          
          positionRef.current = { x: newX, y: newY };
          setCharacter(prev => ({ ...prev, position_x: newX, position_y: newY }));

          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          setCameraOffset({
            x: Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, newX - viewportWidth / 2)),
            y: Math.max(0, Math.min(WORLD_HEIGHT - viewportHeight, newY - viewportHeight / 2)),
          });

          if (timestamp - lastUpdateRef.current > UPDATE_INTERVAL) {
            lastUpdateRef.current = timestamp;
            supabase.from('game_characters').update({ position_x: newX, position_y: newY }).eq('id', character.id);
          }
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [keysPressed, character.id, currentVehicle]);

  const enterVehicle = async (vehicle: Vehicle) => {
    if (vehicle.is_locked && vehicle.owner_id !== character.id) {
      return;
    }

    await supabase.from('game_vehicles').update({ driver_id: character.id }).eq('id', vehicle.id);
    
    setCurrentVehicle(vehicle);
    vehicleRef.current = { speed: 0, rotation: vehicle.rotation };
    positionRef.current = { x: vehicle.position_x, y: vehicle.position_y };
    setCharacter(prev => ({ ...prev, position_x: vehicle.position_x, position_y: vehicle.position_y }));
  };

  const exitVehicle = async () => {
    if (!currentVehicle) return;

    await supabase.from('game_vehicles').update({ 
      driver_id: null, 
      speed: 0 
    }).eq('id', currentVehicle.id);

    setCurrentVehicle(null);
    vehicleRef.current = { speed: 0, rotation: 0 };
  };

  const refreshCharacter = useCallback(async () => {
    const { data } = await supabase
      .from('game_characters')
      .select('*')
      .eq('id', character.id)
      .single();
    if (data) {
      setCharacter(data as GameCharacter);
    }
  }, [character.id]);

  return (
    <div className="fixed inset-0 bg-[#2d5a27] overflow-hidden">
      {/* Game Canvas */}
      <div 
        className="absolute"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate(${-cameraOffset.x}px, ${-cameraOffset.y}px)`,
        }}
      >
        {/* Ground tiles */}
        <div className="absolute inset-0">
          {Array.from({ length: Math.ceil(WORLD_WIDTH / 100) }).map((_, x) =>
            Array.from({ length: Math.ceil(WORLD_HEIGHT / 100) }).map((_, y) => (
              <div
                key={`${x}-${y}`}
                className="absolute w-[100px] h-[100px] border border-[#3d6a37]/30"
                style={{ left: x * 100, top: y * 100 }}
              />
            ))
          )}
        </div>

        {/* Roads */}
        <div className="absolute left-0 right-0 top-[300px] h-[60px] bg-[#3a3a3a]">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-yellow-400 opacity-50" style={{ transform: 'translateY(-50%)' }} />
        </div>
        <div className="absolute top-0 bottom-0 left-[500px] w-[60px] bg-[#3a3a3a]">
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-yellow-400 opacity-50" style={{ transform: 'translateX(-50%)' }} />
        </div>

        {/* Properties */}
        {properties.map(property => (
          <div
            key={property.id}
            className={`absolute cursor-pointer transition-transform hover:scale-105 ${
              property.is_for_sale ? 'opacity-100' : 'opacity-90'
            }`}
            style={{ left: property.position_x, top: property.position_y }}
            onClick={() => setShowMenu(`property-${property.id}`)}
          >
            <div className={`
              w-24 h-20 rounded-lg shadow-lg flex flex-col items-center justify-center
              ${property.property_type === 'small_apartment' ? 'bg-amber-700' : ''}
              ${property.property_type === 'medium_house' ? 'bg-blue-700' : ''}
              ${property.property_type === 'large_mansion' ? 'bg-purple-700' : ''}
              ${property.property_type === 'business' ? 'bg-emerald-700' : ''}
              ${property.property_type === 'gang_hideout' ? 'bg-red-900' : ''}
            `}>
              <Home className="w-8 h-8 text-white" />
              <span className="text-[10px] text-white mt-1 truncate px-1">{property.name}</span>
            </div>
            {property.is_for_sale && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                FOR SALE
              </div>
            )}
          </div>
        ))}

        {/* Vehicles */}
        {vehicles.map(vehicle => (
          <div
            key={vehicle.id}
            onClick={() => {
              if (!currentVehicle && !vehicle.driver_id) {
                enterVehicle(vehicle);
              }
            }}
            className="cursor-pointer"
          >
            <VehicleSprite
              vehicle={vehicle}
              isPlayerDriving={currentVehicle?.id === vehicle.id}
            />
          </div>
        ))}

        {/* Other Players */}
        {otherPlayers.map(player => (
          <PlayerSprite
            key={player.id}
            player={player}
            isCurrentPlayer={false}
          />
        ))}

        {/* Current Player (hide if in vehicle) */}
        {!currentVehicle && (
          <PlayerSprite
            player={character}
            isCurrentPlayer={true}
          />
        )}
      </div>

      {/* Vehicle HUD */}
      {currentVehicle && (
        <div className="fixed top-20 left-4 bg-black/70 text-white p-3 rounded-lg text-sm">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4" />
            <span className="font-bold">{currentVehicle.name}</span>
          </div>
          <div className="space-y-1 text-xs">
            <div>Speed: {Math.abs(Math.round(vehicleRef.current.speed * 10))} mph</div>
            <div>Fuel: {currentVehicle.fuel}%</div>
          </div>
          <Button size="sm" variant="destructive" className="mt-2 w-full" onClick={exitVehicle}>
            Exit Vehicle (F)
          </Button>
        </div>
      )}

      {/* HUD */}
      <GameHUD character={character} />

      {/* Action Buttons */}
      <div className="fixed bottom-4 left-4 flex gap-2 flex-wrap max-w-[50vw]">
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('jobs')}>
          <Briefcase className="w-4 h-4 mr-1" /> Jobs
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowVehicleMenu(true)}>
          <Car className="w-4 h-4 mr-1" /> Vehicles
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowTaxiMenu(true)}>
          🚕 Taxi
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('players')}>
          <Users className="w-4 h-4 mr-1" /> Players
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowOrgMenu(true)}>
          <Shield className="w-4 h-4 mr-1" /> Org
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowChat(true)}>
          <MessageSquare className="w-4 h-4 mr-1" /> Chat
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('bank')}>
          <DollarSign className="w-4 h-4 mr-1" /> Bank
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowCreditExchange(true)} className="bg-gradient-to-r from-yellow-600 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-400">
          <Coins className="w-4 h-4 mr-1" /> Exchange
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowPoliceApp(true)}>
          <Shield className="w-4 h-4 mr-1" /> Police
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowRules(true)}>
          <BookOpen className="w-4 h-4 mr-1" /> Rules
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowHowToPlay(true)}>
          <Gamepad2 className="w-4 h-4 mr-1" /> Help
        </Button>
      </div>

      {/* Exit Button */}
      <Button
        size="sm"
        variant="destructive"
        className="fixed top-4 right-4"
        onClick={onExit}
      >
        <X className="w-4 h-4 mr-1" /> Exit
      </Button>

      {/* Mobile Controls */}
      <div className="fixed bottom-4 right-4 md:hidden">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12"
            onTouchStart={() => setKeysPressed(prev => new Set(prev).add('w'))}
            onTouchEnd={() => setKeysPressed(prev => { const n = new Set(prev); n.delete('w'); return n; })}
          >
            ▲
          </Button>
          <div />
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12"
            onTouchStart={() => setKeysPressed(prev => new Set(prev).add('a'))}
            onTouchEnd={() => setKeysPressed(prev => { const n = new Set(prev); n.delete('a'); return n; })}
          >
            ◀
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12"
            onTouchStart={() => setKeysPressed(prev => new Set(prev).add('s'))}
            onTouchEnd={() => setKeysPressed(prev => { const n = new Set(prev); n.delete('s'); return n; })}
          >
            ▼
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12"
            onTouchStart={() => setKeysPressed(prev => new Set(prev).add('d'))}
            onTouchEnd={() => setKeysPressed(prev => { const n = new Set(prev); n.delete('d'); return n; })}
          >
            ▶
          </Button>
        </div>
      </div>

      {/* Chat System */}
      {showChat && (
        <GameChatSystem 
          characterId={character.id} 
          characterName={character.name}
          otherPlayers={otherPlayers.map(p => ({ id: p.id, name: p.name, is_online: p.is_online }))}
          onClose={() => setShowChat(false)} 
        />
      )}

      {/* Menus */}
      {showMenu && (
        <GameMenu
          menuType={showMenu}
          character={character}
          properties={properties}
          otherPlayers={otherPlayers}
          onClose={() => setShowMenu(null)}
          onCharacterUpdate={refreshCharacter}
        />
      )}

      {/* Organization Menu */}
      {showOrgMenu && (
        <OrganizationMenu
          character={character}
          onClose={() => setShowOrgMenu(false)}
          onCharacterUpdate={refreshCharacter}
        />
      )}

      {/* Vehicle Menu */}
      {showVehicleMenu && (
        <VehicleMenu
          character={character}
          onClose={() => setShowVehicleMenu(false)}
          onCharacterUpdate={refreshCharacter}
          onEnterVehicle={enterVehicle}
        />
      )}

      {/* Taxi Job Menu */}
      {showTaxiMenu && (
        <TaxiJobMenu
          character={character}
          currentVehicle={currentVehicle}
          onClose={() => setShowTaxiMenu(false)}
          onCharacterUpdate={refreshCharacter}
        />
      )}

      {/* Credit Exchange Menu */}
      {showCreditExchange && (
        <CreditExchangeMenu
          character={character}
          onClose={() => setShowCreditExchange(false)}
          onCharacterUpdate={refreshCharacter}
        />
      )}

      {/* Crime System */}
      {showCrimeMenu && (
        <CrimeSystem
          character={character}
          targetPlayer={showCrimeMenu}
          onClose={() => setShowCrimeMenu(null)}
          onCharacterUpdate={refreshCharacter}
        />
      )}

      {/* Police Application */}
      {showPoliceApp && (
        <PoliceApplicationMenu
          character={character}
          onClose={() => setShowPoliceApp(false)}
        />
      )}

      {/* Rules Menu */}
      {showRules && <RulesMenu onClose={() => setShowRules(false)} />}

      {/* How to Play */}
      {showHowToPlay && <HowToPlayMenu onClose={() => setShowHowToPlay(false)} />}

      {/* Controls hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-white/50 text-xs hidden md:block">
        {currentVehicle 
          ? 'W/S to accelerate/brake • A/D to steer • F to exit vehicle'
          : 'WASD or Arrow Keys to move • T to chat • Click vehicle to enter'
        }
      </div>
    </div>
  );
}
