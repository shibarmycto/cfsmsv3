import { Heart, Utensils, Zap, DollarSign, Building } from 'lucide-react';

interface GameHUDProps {
  character: {
    name: string;
    cash: number;
    bank_balance: number;
    health: number;
    hunger: number;
    energy: number;
    current_job: string;
    job_experience: number;
  };
}

export default function GameHUD({ character }: GameHUDProps) {
  return (
    <div className="fixed top-4 left-4 space-y-2">
      {/* Player Info */}
      <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white min-w-[200px]">
        <div className="font-bold text-lg mb-2">{character.name}</div>
        
        {/* Money */}
        <div className="flex items-center gap-2 text-sm mb-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <span className="text-green-400">${character.cash.toLocaleString()}</span>
          <span className="text-muted-foreground">|</span>
          <Building className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400">${character.bank_balance.toLocaleString()}</span>
        </div>

        {/* Job */}
        <div className="text-xs text-muted-foreground mb-2">
          Job: <span className="text-primary capitalize">{character.current_job.replace('_', ' ')}</span>
          {character.job_experience > 0 && (
            <span className="ml-2">XP: {character.job_experience}</span>
          )}
        </div>

        {/* Status Bars */}
        <div className="space-y-1.5">
          {/* Health */}
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 transition-all"
                style={{ width: `${character.health}%` }}
              />
            </div>
            <span className="text-xs w-8 text-right">{character.health}</span>
          </div>

          {/* Hunger */}
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-orange-500" />
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${character.hunger}%` }}
              />
            </div>
            <span className="text-xs w-8 text-right">{character.hunger}</span>
          </div>

          {/* Energy */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${character.energy}%` }}
              />
            </div>
            <span className="text-xs w-8 text-right">{character.energy}</span>
          </div>
        </div>
      </div>

      {/* Mini Map */}
      <div className="bg-black/70 backdrop-blur-sm rounded-lg p-2">
        <div className="w-[120px] h-[90px] bg-[#2d5a27] rounded relative overflow-hidden">
          {/* Roads on minimap */}
          <div className="absolute left-0 right-0 top-[18px] h-[4px] bg-[#3a3a3a]" />
          <div className="absolute top-0 bottom-0 left-[30px] w-[4px] bg-[#3a3a3a]" />
          
          {/* Player position indicator */}
          <div 
            className="absolute w-2 h-2 bg-primary rounded-full animate-pulse"
            style={{
              // Scale position to minimap size (2000x1500 -> 120x90)
              left: `${(120 / 2000) * (character as any).position_x}px`,
              top: `${(90 / 1500) * (character as any).position_y}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
