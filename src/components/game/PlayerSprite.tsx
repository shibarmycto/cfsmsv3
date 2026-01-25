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
}

export default function PlayerSprite({ player, isCurrentPlayer }: PlayerSpriteProps) {
  return (
    <div
      className="absolute transition-all duration-75"
      style={{
        left: player.position_x,
        top: player.position_y,
        zIndex: Math.floor(player.position_y),
      }}
    >
      {/* Name tag */}
      <div className={`absolute -top-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs px-2 py-0.5 rounded ${
        isCurrentPlayer ? 'bg-primary text-primary-foreground' : 'bg-black/70 text-white'
      }`}>
        {player.name}
        {player.current_job !== 'unemployed' && (
          <span className="ml-1 text-[10px] opacity-70">
            [{player.current_job.replace('_', ' ')}]
          </span>
        )}
      </div>
      
      {/* Character SVG */}
      <svg width="40" height="60" viewBox="0 0 40 60" className="drop-shadow-md">
        {/* Shadow */}
        <ellipse cx="20" cy="58" rx="12" ry="3" fill="rgba(0,0,0,0.3)" />
        
        {/* Body */}
        <rect x="10" y="22" width="20" height="22" rx="2" fill={player.shirt_color} />
        
        {/* Head */}
        <circle cx="20" cy="13" r="10" fill={player.skin_color} />
        
        {/* Hair */}
        {player.gender === 'female' ? (
          <>
            <ellipse cx="20" cy="7" rx="10" ry="6" fill={player.hair_color} />
            <rect x="10" y="8" width="4" height="14" rx="2" fill={player.hair_color} />
            <rect x="26" y="8" width="4" height="14" rx="2" fill={player.hair_color} />
          </>
        ) : (
          <ellipse cx="20" cy="8" rx="9" ry="5" fill={player.hair_color} />
        )}
        
        {/* Legs */}
        <rect x="12" y="44" width="7" height="13" rx="2" fill={player.pants_color} />
        <rect x="21" y="44" width="7" height="13" rx="2" fill={player.pants_color} />
        
        {/* Arms */}
        <rect x="4" y="24" width="6" height="15" rx="2" fill={player.shirt_color} />
        <rect x="30" y="24" width="6" height="15" rx="2" fill={player.shirt_color} />
        
        {/* Hands */}
        <circle cx="7" cy="40" r="3" fill={player.skin_color} />
        <circle cx="33" cy="40" r="3" fill={player.skin_color} />
        
        {/* Face */}
        <circle cx="16" cy="13" r="1.5" fill="#333" />
        <circle cx="24" cy="13" r="1.5" fill="#333" />
        <path d="M17 17 Q20 20 23 17" stroke="#333" strokeWidth="1" fill="none" />
      </svg>
      
      {/* Current player indicator */}
      {isCurrentPlayer && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}
