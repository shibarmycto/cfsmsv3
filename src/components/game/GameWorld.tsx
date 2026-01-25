import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Users, Home, Briefcase, MessageSquare, DollarSign } from 'lucide-react';
import GameHUD from './GameHUD';
import GameChat from './GameChat';
import GameMenu from './GameMenu';
import PlayerSprite from './PlayerSprite';

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

interface GameWorldProps {
  character: GameCharacter;
  onExit: () => void;
}

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1500;
const MOVE_SPEED = 5;
const UPDATE_INTERVAL = 100; // ms between position updates

export default function GameWorld({ character: initialCharacter, onExit }: GameWorldProps) {
  const [character, setCharacter] = useState(initialCharacter);
  const [otherPlayers, setOtherPlayers] = useState<GameCharacter[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  
  const gameLoopRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const positionRef = useRef({ x: character.position_x, y: character.position_y });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      const { data } = await supabase.from('game_properties').select('*');
      if (data) setProperties(data as Property[]);
    };
    fetchProperties();
  }, []);

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
      }
      if (key === 'enter' || key === 't') {
        if (!showChat) {
          e.preventDefault();
          setShowChat(true);
        }
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
  }, [showChat]);

  // Game loop
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
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

        // Update camera
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        setCameraOffset({
          x: Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, newX - viewportWidth / 2)),
          y: Math.max(0, Math.min(WORLD_HEIGHT - viewportHeight, newY - viewportHeight / 2)),
        });

        // Send position update to server periodically
        if (timestamp - lastUpdateRef.current > UPDATE_INTERVAL) {
          lastUpdateRef.current = timestamp;
          supabase
            .from('game_characters')
            .update({ position_x: newX, position_y: newY })
            .eq('id', character.id)
            .then();
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [keysPressed, character.id]);

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

        {/* Other Players */}
        {otherPlayers.map(player => (
          <PlayerSprite
            key={player.id}
            player={player}
            isCurrentPlayer={false}
          />
        ))}

        {/* Current Player */}
        <PlayerSprite
          player={character}
          isCurrentPlayer={true}
        />
      </div>

      {/* HUD */}
      <GameHUD character={character} />

      {/* Action Buttons */}
      <div className="fixed bottom-4 left-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('jobs')}>
          <Briefcase className="w-4 h-4 mr-1" /> Jobs
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('players')}>
          <Users className="w-4 h-4 mr-1" /> Players
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowChat(true)}>
          <MessageSquare className="w-4 h-4 mr-1" /> Chat
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowMenu('bank')}>
          <DollarSign className="w-4 h-4 mr-1" /> Bank
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

      {/* Chat */}
      {showChat && (
        <GameChat 
          characterId={character.id} 
          characterName={character.name}
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

      {/* Controls hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-white/50 text-xs hidden md:block">
        WASD or Arrow Keys to move • T to chat • ESC to close menus
      </div>
    </div>
  );
}
