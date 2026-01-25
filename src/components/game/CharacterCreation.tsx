import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CharacterCreationProps {
  userId: string;
  onCharacterCreated: (character: any) => void;
}

const SKIN_COLORS = ['#f5d0c5', '#e8beac', '#d4a98c', '#c68c6a', '#8d5524', '#5c3c1f'];
const HAIR_COLORS = ['#3d2314', '#1a1a1a', '#6b4423', '#b8860b', '#8b0000', '#ffd700', '#4169e1', '#32cd32'];
const SHIRT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#1a1a1a'];
const PANTS_COLORS = ['#1e3a5f', '#1a1a1a', '#4a5568', '#1e40af', '#065f46', '#7c2d12'];

export default function CharacterCreation({ userId, onCharacterCreated }: CharacterCreationProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[0]);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [shirtColor, setShirtColor] = useState(SHIRT_COLORS[0]);
  const [pantsColor, setPantsColor] = useState(PANTS_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a character name');
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
          gender,
          skin_color: skinColor,
          hair_color: hairColor,
          shirt_color: shirtColor,
          pants_color: pantsColor,
          is_online: true,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Character created successfully!');
      onCharacterCreated(data);
    } catch (error: any) {
      console.error('Error creating character:', error);
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gradient mb-2">Create Your Character</h1>
        <p className="text-center text-muted-foreground mb-8">Design your avatar for the CF Roleplay world</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="flex flex-col items-center justify-center bg-secondary/30 rounded-xl p-8">
            <svg width="180" height="270" viewBox="0 0 60 90" className="drop-shadow-lg">
              {/* Body */}
              <rect x="15" y="30" width="30" height="35" rx="3" fill={shirtColor} />
              {/* Head */}
              <circle cx="30" cy="18" r="14" fill={skinColor} />
              {/* Hair - different styles based on gender */}
              {gender === 'female' ? (
                <>
                  <ellipse cx="30" cy="8" rx="14" ry="8" fill={hairColor} />
                  <rect x="16" y="10" width="5" height="20" rx="2" fill={hairColor} />
                  <rect x="39" y="10" width="5" height="20" rx="2" fill={hairColor} />
                </>
              ) : (
                <ellipse cx="30" cy="10" rx="12" ry="6" fill={hairColor} />
              )}
              {/* Legs */}
              <rect x="17" y="65" width="10" height="20" rx="2" fill={pantsColor} />
              <rect x="33" y="65" width="10" height="20" rx="2" fill={pantsColor} />
              {/* Arms */}
              <rect x="5" y="32" width="10" height="25" rx="3" fill={shirtColor} />
              <rect x="45" y="32" width="10" height="25" rx="3" fill={shirtColor} />
              {/* Hands */}
              <circle cx="10" cy="60" r="4" fill={skinColor} />
              <circle cx="50" cy="60" r="4" fill={skinColor} />
              {/* Face */}
              <circle cx="25" cy="18" r="2" fill="#333" />
              <circle cx="35" cy="18" r="2" fill="#333" />
              <path d="M26 24 Q30 28 34 24" stroke="#333" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="mt-4 text-lg font-semibold">{name || 'Your Character'}</div>
          </div>

          {/* Options */}
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label>Character Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a name..."
                maxLength={20}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <Button
                    key={g}
                    variant={gender === g ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGender(g)}
                    className="flex-1 capitalize"
                  >
                    {g}
                  </Button>
                ))}
              </div>
            </div>

            {/* Skin Color */}
            <div className="space-y-2">
              <Label>Skin Tone</Label>
              <div className="flex gap-2 flex-wrap">
                {SKIN_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSkinColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      skinColor === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Hair Color */}
            <div className="space-y-2">
              <Label>Hair Color</Label>
              <div className="flex gap-2 flex-wrap">
                {HAIR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setHairColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      hairColor === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Shirt Color */}
            <div className="space-y-2">
              <Label>Shirt Color</Label>
              <div className="flex gap-2 flex-wrap">
                {SHIRT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setShirtColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      shirtColor === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Pants Color */}
            <div className="space-y-2">
              <Label>Pants Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PANTS_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPantsColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      pantsColor === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleCreate}
              disabled={creating || !name.trim()}
            >
              {creating ? 'Creating...' : 'Create Character'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
