import { useState, useEffect } from 'react';
import { Heart, Utensils, Zap, DollarSign, Building, AlertTriangle, Clock } from 'lucide-react';

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
    wanted_level?: number;
    position_x?: number;
    position_y?: number;
  };
}

export default function GameHUD({ character }: GameHUDProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  const wantedLevel = character.wanted_level || 0;

  return (
    <>
      {/* CF Roleplay Logo - Top Right */}
      <div className="fixed top-4 right-20 z-40">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2">
          <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            CF
          </span>
          <span className="text-sm font-medium text-white/80 ml-1">Roleplay</span>
        </div>
      </div>

      {/* Game Time - Top Center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
          <div className="flex items-center gap-2 text-white">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-bold text-lg">{formatTime(currentTime)}</span>
          </div>
          <p className="text-xs text-white/60">{formatDate(currentTime)}</p>
        </div>
      </div>

      {/* Wanted Level Display */}
      {wantedLevel > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-pulse">
          <div className="bg-destructive/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <span className="text-white font-bold">WANTED</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${i < wantedLevel ? 'text-yellow-400' : 'text-white/30'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Player Stats - Top Left */}
      <div className="fixed top-4 left-4 space-y-2 z-40">
        {/* Player Info */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white min-w-[200px]">
          <div className="font-bold text-lg mb-2">{character.name}</div>
          
          {/* Money */}
          <div className="flex items-center gap-2 text-sm mb-2">
            <DollarSign className="w-4 h-4 text-success" />
            <span className="text-success">${character.cash.toLocaleString()}</span>
            <span className="text-muted-foreground">|</span>
            <Building className="w-4 h-4 text-primary" />
            <span className="text-primary">${character.bank_balance.toLocaleString()}</span>
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
              <Heart className="w-4 h-4 text-destructive" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${character.health}%` }}
                />
              </div>
              <span className="text-xs w-8 text-right">{character.health}</span>
            </div>

            {/* Hunger */}
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-500" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
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
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
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
                left: `${(120 / 2000) * (character.position_x || 500)}px`,
                top: `${(90 / 1500) * (character.position_y || 500)}px`,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
