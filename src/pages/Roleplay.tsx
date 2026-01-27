import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import CharacterCreation from '@/components/game/CharacterCreation';
import OpenWorldGame from '@/components/game3d/OpenWorldGame';
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
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkBanStatus();
      fetchCharacter();
    }
  }, [user, authLoading, navigate]);

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
      <OpenWorldGame 
        characterId={character.id}
        characterName={character.name}
        onExit={handleExitGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 text-white hover:text-cyan-400">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!character ? (
          <CharacterCreation userId={user!.id} onCharacterCreated={handleCharacterCreated} />
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/80 border border-cyan-500/30 rounded-xl p-8 text-center space-y-6 backdrop-blur-sm">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  CF ROLEPLAY
                </h1>
                <p className="text-slate-400">Open World 3D Experience</p>
              </div>
              
              <p className="text-xl text-white">Welcome back, <span className="text-cyan-400 font-bold">{character.name}</span>!</p>
              
              <div className="flex justify-center py-4">
                <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border-2 border-cyan-500/50">
                  <Gamepad2 className="w-16 h-16 text-cyan-400" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <StatCard label="Cash" value={`$${character.cash.toLocaleString()}`} color="text-green-400" />
                <StatCard label="Bank" value={`$${character.bank_balance.toLocaleString()}`} color="text-blue-400" />
                <StatCard label="Job" value={character.current_job.replace('_', ' ')} color="text-purple-400" />
              </div>

              <div className="space-y-2">
                <ProgressBar label="Health" value={character.health} color="bg-red-500" />
                <ProgressBar label="Hunger" value={character.hunger} color="bg-orange-500" />
                <ProgressBar label="Energy" value={character.energy} color="bg-yellow-500" />
              </div>

              {isBanned ? (
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                  <p className="text-red-400 font-bold">You are currently banned from CF Roleplay</p>
                </div>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-6"
                  onClick={handleEnterGame}
                >
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Enter Game World
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
      <div className={`text-xl font-bold ${color} capitalize`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400 w-16">{label}</span>
      <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm text-slate-400 w-10 text-right">{value}%</span>
    </div>
  );
}
