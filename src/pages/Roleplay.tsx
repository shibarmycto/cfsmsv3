import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import CharacterCreation from '@/components/game/CharacterCreation';
import { EliteGame } from '@/components/game3d';
import { toast } from 'sonner';

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
  wanted_level: number;
}

export default function Roleplay() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<GameCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGame, setShowGame] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    // Allow guests to view the page - only redirect when trying to play
    if (user) {
      checkBanStatus();
      fetchCharacter();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const checkBanStatus = async () => {
    const { data } = await supabase
      .from('game_bans')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) {
      if (data.is_permanent || (data.expires_at && new Date(data.expires_at) > new Date())) {
        setIsBanned(true);
        toast.error(`You are banned: ${data.reason}`);
      }
    }
  };

  const fetchCharacter = async () => {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCharacter(data as GameCharacter);
        await supabase
          .from('game_characters')
          .update({ is_online: true, last_seen_at: new Date().toISOString() })
          .eq('id', data.id);
      }
    } catch (error) {
      console.error('Error fetching character:', error);
      toast.error('Failed to load character');
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterCreated = (newCharacter: GameCharacter) => {
    setCharacter(newCharacter);
  };

  const handleEnterGame = async () => {
    // Require login to play
    if (!user) {
      toast.error('Please sign in to play CF Roleplay');
      navigate('/auth');
      return;
    }
    if (isBanned) {
      toast.error('You are banned from CF Roleplay');
      return;
    }
    if (character) {
      await supabase
        .from('game_characters')
        .update({ is_online: true, last_seen_at: new Date().toISOString() })
        .eq('id', character.id);
      setShowGame(true);
    }
  };

  const handleExitGame = async () => {
    if (character) {
      await supabase
        .from('game_characters')
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq('id', character.id);
    }
    setShowGame(false);
  };

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (character) {
        await supabase
          .from('game_characters')
          .update({ is_online: false })
          .eq('id', character.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [character]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Gamepad2 className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <div className="text-xl text-muted-foreground">Loading CF Roleplay...</div>
        </div>
      </div>
    );
  }

  if (showGame && character) {
    return (
      <EliteGame 
        characterId={character.id}
        characterName={character.name}
        onExit={handleExitGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-cyan-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Back button */}
      <div className="relative z-10 p-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')} 
          className="gap-2 text-gray-400 hover:text-white hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Button>
      </div>

      <div className="relative z-10 container mx-auto px-4 pb-8">
        {!user ? (
          <GuestWelcome onSignIn={() => navigate('/auth')} />
        ) : !character ? (
          <CharacterCreation userId={user.id} onCharacterCreated={handleCharacterCreated} />
        ) : (
          <div className="max-w-xl mx-auto">
            {/* Main Card */}
            <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                      <span className="text-white font-black text-2xl">CF</span>
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-white tracking-tight">CF ROLEPLAY</h1>
                      <p className="text-cyan-400 text-sm">Open World 3D Experience</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Info */}
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Welcome back</p>
                  <h2 className="text-3xl font-bold text-white mt-1">{character.name}</h2>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-green-400 font-bold text-xl">${character.cash.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-1">Cash</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-blue-400 font-bold text-xl">${character.bank_balance.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-1">Bank</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-purple-400 font-bold text-xl capitalize">{character.current_job.replace('_', ' ')}</p>
                    <p className="text-gray-500 text-xs mt-1">Job</p>
                  </div>
                </div>

                {/* Status Bars */}
                <div className="space-y-3">
                  <StatusBar label="Health" value={character.health} color="from-red-600 to-red-500" icon="❤️" />
                  <StatusBar label="Hunger" value={character.hunger} color="from-orange-500 to-amber-400" icon="🍔" />
                  <StatusBar label="Energy" value={character.energy} color="from-yellow-500 to-yellow-400" icon="⚡" />
                </div>

                {/* Enter Game Button */}
                {isBanned ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <p className="text-red-400 font-bold">⛔ You are currently banned from CF Roleplay</p>
                  </div>
                ) : (
                  <button 
                    onClick={handleEnterGame}
                    className="w-full relative overflow-hidden group bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-5 rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      <Gamepad2 className="w-6 h-6" />
                      ENTER GAME WORLD
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="mt-6 text-center text-gray-500 text-xs space-y-1">
              <p>🎮 Use WASD to move • SHIFT to run • SPACE to jump</p>
              <p>📻 Hold R for walkie-talkie • V to toggle camera</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GuestWelcome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10 p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-white font-black text-3xl">CF</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mt-4">CF ROLEPLAY</h1>
          <p className="text-cyan-400 text-center">Open World 3D Experience</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Welcome to CF Roleplay!</h2>
            <p className="text-gray-400">Create your character, explore the city, get a job, build your empire.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-800/50 rounded-xl p-3 border border-white/5">
              <span className="text-2xl">🏙️</span>
              <p className="text-white font-medium mt-1">Open World</p>
              <p className="text-gray-500 text-xs">Explore a realistic UK city</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-white/5">
              <span className="text-2xl">💼</span>
              <p className="text-white font-medium mt-1">Jobs & Crime</p>
              <p className="text-gray-500 text-xs">Legal or illegal income</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-white/5">
              <span className="text-2xl">🚗</span>
              <p className="text-white font-medium mt-1">Vehicles</p>
              <p className="text-gray-500 text-xs">Buy & drive cars</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-white/5">
              <span className="text-2xl">👥</span>
              <p className="text-white font-medium mt-1">Multiplayer</p>
              <p className="text-gray-500 text-xs">Play with others</p>
            </div>
          </div>
          
          <button 
            onClick={onSignIn}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/30"
          >
            Sign In to Play
          </button>
          
          <p className="text-center text-gray-500 text-xs">
            Free to play • No download required
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs text-gray-400">{value}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} 
            style={{ width: `${value}%` }}
          >
            <div className="h-full w-full bg-gradient-to-t from-transparent to-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
