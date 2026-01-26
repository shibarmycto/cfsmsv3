import { useState, useEffect } from 'react';

interface PlayerSpriteProps {
  player: {
    name: string;
    gender: 'male' | 'female' | 'other';
    skin_color: string;
    hair_color: string;
    shirt_color: string;
    pants_color: string;
    position_x: number;
    position_y: number;
    current_job: string;
  };
  isCurrentPlayer: boolean;
  animationState?: 'idle' | 'walking' | 'running' | 'emote';
  emoteType?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export default function PlayerSprite({ 
  player, 
  isCurrentPlayer, 
  animationState = 'idle',
  emoteType = '',
  direction = 'down'
}: PlayerSpriteProps) {
  const [walkCycle, setWalkCycle] = useState(0);

  // Animate walk cycle
  useEffect(() => {
    if (animationState !== 'walking' && animationState !== 'running') {
      setWalkCycle(0);
      return;
    }

    const interval = setInterval(() => {
      setWalkCycle(prev => (prev + 1) % 4);
    }, animationState === 'running' ? 75 : 150);

    return () => clearInterval(interval);
  }, [animationState]);

  // Calculate arm and leg positions based on walk cycle
  const getAnimationOffsets = () => {
    if (animationState === 'idle' || animationState === 'emote') {
      return { armOffset: 0, legOffset: 0 };
    }

    const cycle = walkCycle;
    const multiplier = animationState === 'running' ? 4 : 2;
    const armOffset = Math.sin((cycle / 4) * Math.PI * 2) * multiplier;
    const legOffset = Math.sin((cycle / 4) * Math.PI * 2) * multiplier;

    return { armOffset, legOffset };
  };

  const offsets = getAnimationOffsets();

  return (
    <div
      className="absolute"
      style={{
        left: player.position_x,
        top: player.position_y,
        zIndex: Math.floor(player.position_y),
        transition: animationState === 'idle' ? 'all 100ms ease-out' : 'none',
      }}
    >
      {/* Name tag */}
      <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs px-2 py-0.5 rounded font-semibold ${
        isCurrentPlayer ? 'bg-blue-500 text-white' : 'bg-black/80 text-white'
      }`}>
        {player.name}
        {player.current_job !== 'unemployed' && (
          <span className="ml-1 text-[10px] opacity-80">
            [{player.current_job.replace('_', ' ')}]
          </span>
        )}
      </div>

      {/* Emote/Action indicator */}
      {emoteType && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-2xl animate-bounce">
          {emoteType === 'wave' && '👋'}
          {emoteType === 'dance' && '💃'}
          {emoteType === 'sit' && '🪑'}
          {emoteType === 'sleep' && '😴'}
          {emoteType === 'celebrate' && '🎉'}
          {emoteType === 'angry' && '😠'}
        </div>
      )}
      
      {/* Character SVG with enhanced details */}
      <svg width="48" height="68" viewBox="0 0 48 68" className="drop-shadow-lg filter">
        {/* Shadow */}
        <ellipse cx="24" cy="66" rx="14" ry="3" fill="rgba(0,0,0,0.4)" />
        
        {/* Torso/Body */}
        <rect x="12" y="26" width="24" height="24" rx="3" fill={player.shirt_color} />
        <polygon points="12,26 8,32 8,48 12,50 36,50 40,48 40,32 36,26" fill={player.shirt_color} opacity="0.9" />
        
        {/* Head */}
        <circle cx="24" cy="15" r="12" fill={player.skin_color} />
        
        {/* Hair */}
        {player.gender === 'female' ? (
          <>
            <ellipse cx="24" cy="8" rx="12" ry="7" fill={player.hair_color} />
            <rect x="10" y="10" width="5" height="16" rx="2.5" fill={player.hair_color} />
            <rect x="33" y="10" width="5" height="16" rx="2.5" fill={player.hair_color} />
          </>
        ) : (
          <>
            <path d="M 12 10 Q 24 3 36 10 Q 32 8 24 7 Q 16 8 12 10" fill={player.hair_color} />
            <ellipse cx="24" cy="10" rx="11" ry="6" fill={player.hair_color} />
          </>
        )}
        
        {/* Arms with walking animation */}
        <rect 
          x="6" 
          y={24 + offsets.armOffset} 
          width="6" 
          height="20" 
          rx="3" 
          fill={player.skin_color}
          style={{ transition: animationState === 'idle' ? 'all 100ms' : 'none' }}
        />
        <rect 
          x="36" 
          y={24 - offsets.armOffset} 
          width="6" 
          height="20" 
          rx="3" 
          fill={player.skin_color}
          style={{ transition: animationState === 'idle' ? 'all 100ms' : 'none' }}
        />
        
        {/* Hands */}
        <circle cx="9" cy={44 + offsets.armOffset} r="3.5" fill={player.skin_color} />
        <circle cx="39" cy={44 - offsets.armOffset} r="3.5" fill={player.skin_color} />
        
        {/* Legs with walking animation */}
        <rect 
          x="14" 
          y={50 + offsets.legOffset} 
          width="8" 
          height="14" 
          rx="2" 
          fill={player.pants_color}
          style={{ transition: animationState === 'idle' ? 'all 100ms' : 'none' }}
        />
        <rect 
          x="26" 
          y={50 - offsets.legOffset} 
          width="8" 
          height="14" 
          rx="2" 
          fill={player.pants_color}
          style={{ transition: animationState === 'idle' ? 'all 100ms' : 'none' }}
        />
        
        {/* Shoes */}
        <ellipse cx="18" cy="65" rx="4" ry="2.5" fill="#333" />
        <ellipse cx="30" cy="65" rx="4" ry="2.5" fill="#333" />
        
        {/* Face */}
        <circle cx="20" cy="14" r="1.8" fill="#333" />
        <circle cx="28" cy="14" r="1.8" fill="#333" />
        {animationState === 'emote' && emoteType === 'angry' ? (
          <>
            <path d="M 20 18 Q 24 21 28 18" stroke="#333" strokeWidth="1.2" fill="none" />
          </>
        ) : (
          <path d="M 20 19 Q 24 21 28 19" stroke="#333" strokeWidth="1.2" fill="none" />
        )}
      </svg>
      
      {/* Current player indicator */}
      {isCurrentPlayer && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}
