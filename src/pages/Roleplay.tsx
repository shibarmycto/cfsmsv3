import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CharacterCreation from '@/components/game/CharacterCreation';
import GameWorld from '@/components/game/GameWorld';
import Game3DScene from '@/components/game3d/Game3DScene';
import MobileGame3D from '@/components/game3d/MobileGame3D';
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
}

export default function Roleplay() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<GameCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchCharacter();
    }
  }, [user, authLoading, navigate]);

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
        // Set online status
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

  // Set offline when leaving page
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
        <div className="animate-pulse text-xl text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (showGame && character) {
    return (
      <MobileGame3D 
        characterId={character.id}
        characterName={character.name}
        onExit={handleExitGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!character ? (
          <CharacterCreation userId={user!.id} onCharacterCreated={handleCharacterCreated} />
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Character Card */}
            <div className="bg-card border border-border rounded-xl p-8 text-center space-y-6">
              <h1 className="text-3xl font-bold text-gradient">CF Roleplay</h1>
              <p className="text-muted-foreground">Welcome back, {character.name}!</p>
              
              {/* Character Preview */}
              <div className="flex justify-center">
                <div className="relative">
                  <svg width="120" height="180" viewBox="0 0 60 90">
                    {/* Body */}
                    <rect x="15" y="30" width="30" height="35" rx="3" fill={character.shirt_color} />
                    {/* Head */}
                    <circle cx="30" cy="18" r="14" fill={character.skin_color} />
                    {/* Hair */}
                    <ellipse cx="30" cy="10" rx="12" ry="6" fill={character.hair_color} />
                    {/* Legs */}
                    <rect x="17" y="65" width="10" height="20" rx="2" fill={character.pants_color} />
                    <rect x="33" y="65" width="10" height="20" rx="2" fill={character.pants_color} />
                    {/* Face */}
                    <circle cx="25" cy="18" r="2" fill="#333" />
                    <circle cx="35" cy="18" r="2" fill="#333" />
                    <path d="M26 24 Q30 28 34 24" stroke="#333" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-500">${character.cash.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Cash</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-500">${character.bank_balance.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Bank</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary capitalize">{character.current_job.replace('_', ' ')}</div>
                  <div className="text-xs text-muted-foreground">Job</div>
                </div>
              </div>

              {/* Health/Hunger/Energy Bars */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm w-16">Health</span>
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all" 
                      style={{ width: `${character.health}%` }} 
                    />
                  </div>
                  <span className="text-sm w-10 text-right">{character.health}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm w-16">Hunger</span>
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all" 
                      style={{ width: `${character.hunger}%` }} 
                    />
                  </div>
                  <span className="text-sm w-10 text-right">{character.hunger}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm w-16">Energy</span>
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all" 
                      style={{ width: `${character.energy}%` }} 
                    />
                  </div>
                  <span className="text-sm w-10 text-right">{character.energy}%</span>
                </div>
              </div>

              <Button size="lg" className="w-full" onClick={handleEnterGame}>
                Enter Game World
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
