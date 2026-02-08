import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Gamepad2 } from 'lucide-react';
import CharacterCustomization from '@/components/game/CharacterCustomization';
import MobileOnlyGame from '@/components/game3d/MobileOnlyGame';
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

  // Loading state
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

  // In-game view - Mobile optimized full screen
  if (showGame && character) {
    return (
      <MobileOnlyGame 
        characterId={character.id}
        characterName={character.name}
        onExit={handleExitGame}
      />
    );
  }

  // Pre-game menu - Mobile optimized
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-cyan-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 px-4 py-6 min-h-screen flex flex-col">
        {!user ? (
          <GuestWelcome onSignIn={() => navigate('/auth')} />
        ) : !character ? (
          <div className="flex-1 flex items-center justify-center">
            <CharacterCustomization userId={user.id} onCharacterCreated={handleCharacterCreated} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            {/* Game Card */}
            <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-b border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <span className="text-white font-black text-xl">CF</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white tracking-tight">CF ROLEPLAY</h1>
                    <p className="text-cyan-400 text-sm">Mobile Open World</p>
                  </div>
                </div>
              </div>

              {/* Player Info */}
              <div className="p-4 space-y-4">
                <div className="text-center">
                  <p className="text-gray-400 text-xs">Welcome back</p>
                  <h2 className="text-2xl font-bold text-white">{character.name}</h2>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Cash" value={`$${character.cash.toLocaleString()}`} color="text-green-400" />
                  <StatBox label="Bank" value={`$${character.bank_balance.toLocaleString()}`} color="text-blue-400" />
                  <StatBox label="Job" value={character.current_job.replace('_', ' ')} color="text-purple-400" />
                </div>

                {/* Health/Energy bars */}
                <div className="space-y-2">
                  <ProgressBar label="Health" value={character.health} color="from-red-600 to-red-400" icon="❤️" />
                  <ProgressBar label="Energy" value={character.energy} color="from-yellow-600 to-yellow-400" icon="⚡" />
                </div>

                {/* Play button */}
                {isBanned ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                    <p className="text-red-400 font-bold text-sm">⛔ You are banned from CF Roleplay</p>
                  </div>
                ) : (
                  <button 
                    onClick={handleEnterGame}
                    className="w-full relative overflow-hidden group bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/30 active:scale-95"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Gamepad2 className="w-5 h-5" />
                      ENTER GAME
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile controls info */}
            <div className="mt-4 text-center text-gray-500 text-xs">
              <p>📱 Touch joystick to move • Tap buttons to interact</p>
              <p className="mt-1">🔄 Best in landscape mode</p>
            </div>

            {/* Back button */}
            <button 
              onClick={() => navigate('/dashboard')} 
              className="mt-4 text-gray-400 text-sm underline mx-auto"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GuestWelcome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-sm w-full">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-cyan-600/30 to-blue-600/30 p-6 text-center border-b border-white/10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 mx-auto">
              <span className="text-white font-black text-3xl">CF</span>
            </div>
            <h1 className="text-2xl font-black text-white mt-4">CF ROLEPLAY</h1>
            <p className="text-cyan-400 text-sm">Mobile Open World Game</p>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">Play Now!</h2>
              <p className="text-gray-400 text-sm">Create a character, explore, work, fight!</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <FeatureBox icon="🏙️" title="Open World" />
              <FeatureBox icon="💼" title="Jobs & Crime" />
              <FeatureBox icon="🚗" title="Vehicles" />
              <FeatureBox icon="👥" title="Multiplayer" />
            </div>
            
            <button 
              onClick={onSignIn}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/30 active:scale-95"
            >
              Sign In to Play
            </button>
            
            <p className="text-center text-gray-500 text-xs">
              Free to play • No download required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 text-center border border-white/5">
      <p className={`${color} font-bold text-sm capitalize truncate`}>{value}</p>
      <p className="text-gray-500 text-[10px]">{label}</p>
    </div>
  );
}

function ProgressBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-0.5">
          <span className="text-[10px] text-gray-400">{label}</span>
          <span className="text-[10px] text-gray-400">{value}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} 
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FeatureBox({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 border border-white/5 text-center">
      <span className="text-xl">{icon}</span>
      <p className="text-white text-xs font-medium mt-1">{title}</p>
    </div>
  );
}
