import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

import charBoss from '@/assets/characters/char-boss.png';
import charEnforcer from '@/assets/characters/char-enforcer.png';
import charHitman from '@/assets/characters/char-hitman.png';
import charExecutive from '@/assets/characters/char-executive.png';
import charSoldier from '@/assets/characters/char-soldier.png';
import charRebel from '@/assets/characters/char-rebel.png';
import charAgent from '@/assets/characters/char-agent.png';
import charHunter from '@/assets/characters/char-hunter.png';
import cfCharactersRef from '@/assets/cf-characters-ref.png';

interface CharacterCustomizationProps {
  userId: string;
  onCharacterCreated: (character: any) => void;
}

const CHARACTER_PRESETS = [
  { 
    id: 'boss', name: 'The Boss', image: charBoss, 
    gender: 'male' as const, description: 'Runs the streets',
    skin: '#8d5524', hair: '#1a1a1a', shirt: '#1e3a5f', pants: '#1a1a1a'
  },
  { 
    id: 'enforcer', name: 'The Enforcer', image: charEnforcer, 
    gender: 'female' as const, description: 'Tattoos & trouble',
    skin: '#e8beac', hair: '#1a1a1a', shirt: '#1a1a1a', pants: '#1e3a5f'
  },
  { 
    id: 'hitman', name: 'The Hitman', image: charHitman, 
    gender: 'male' as const, description: 'Cold & calculated',
    skin: '#d4a98c', hair: '#1a1a1a', shirt: '#1a1a1a', pants: '#1a1a1a'
  },
  { 
    id: 'executive', name: 'The Executive', image: charExecutive, 
    gender: 'male' as const, description: 'Money talks',
    skin: '#d4a98c', hair: '#3d2314', shirt: '#1e40af', pants: '#1a1a1a'
  },
  { 
    id: 'soldier', name: 'The Soldier', image: charSoldier, 
    gender: 'male' as const, description: 'Military precision',
    skin: '#c68c6a', hair: '#3d2314', shirt: '#065f46', pants: '#4a5568'
  },
  { 
    id: 'rebel', name: 'The Rebel', image: charRebel, 
    gender: 'male' as const, description: 'Chaos incarnate',
    skin: '#c68c6a', hair: '#9400d3', shirt: '#1a1a1a', pants: '#1a1a1a'
  },
  { 
    id: 'agent', name: 'The Agent', image: charAgent, 
    gender: 'female' as const, description: 'Silent & deadly',
    skin: '#f5d0c5', hair: '#1a1a1a', shirt: '#1a1a1a', pants: '#1a1a1a'
  },
  { 
    id: 'hunter', name: 'The Hunter', image: charHunter, 
    gender: 'female' as const, description: 'Tracks any target',
    skin: '#e8beac', hair: '#6b4423', shirt: '#374151', pants: '#374151'
  },
];

export default function CharacterCustomization({ userId, onCharacterCreated }: CharacterCustomizationProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedChar = CHARACTER_PRESETS.find(c => c.id === selected);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Enter a character name');
      return;
    }
    if (!selectedChar) {
      toast.error('Select a character');
      return;
    }
    if (name.length < 3 || name.length > 20) {
      toast.error('Name must be 3-20 characters');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .insert({
          user_id: userId,
          name: name.trim(),
          gender: selectedChar.gender,
          skin_color: selectedChar.skin,
          hair_color: selectedChar.hair,
          shirt_color: selectedChar.shirt,
          pants_color: selectedChar.pants,
          is_online: true,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Character created!');
      onCharacterCreated(data);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You already have a character');
      } else {
        toast.error('Failed to create character');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4">
      {/* Header with banner */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <img 
          src={cfCharactersRef} 
          alt="CF Roleplay Characters" 
          className="w-full h-32 sm:h-44 object-cover object-top"
          style={{ filter: 'brightness(0.5)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">CHOOSE YOUR CHARACTER</h1>
          <p className="text-cyan-400 text-sm">Select a preset and enter your name</p>
        </div>
      </div>

      {/* Character Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {CHARACTER_PRESETS.map((char) => (
          <button
            key={char.id}
            onClick={() => setSelected(char.id)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
              selected === char.id 
                ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 scale-[1.02]' 
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <img 
              src={char.image} 
              alt={char.name} 
              className="w-full aspect-[2/3] object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-white font-bold text-xs sm:text-sm truncate">{char.name}</p>
              <p className="text-gray-400 text-[10px] sm:text-xs">{char.description}</p>
            </div>
            {selected === char.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Name Input & Create */}
      <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-4">
        <div>
          <label className="text-white text-sm font-medium mb-1 block">Character Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your street name..."
            maxLength={20}
            className="bg-gray-800/50 border-white/10 text-white text-lg"
          />
        </div>
        
        {selectedChar && (
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
            <img src={selectedChar.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div>
              <p className="text-white font-bold text-sm">{name || selectedChar.name}</p>
              <p className="text-gray-400 text-xs capitalize">{selectedChar.gender} • {selectedChar.description}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !selected}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/30 active:scale-95"
        >
          {creating ? 'Creating...' : 'CREATE CHARACTER'}
        </button>
      </div>
    </div>
  );
}
