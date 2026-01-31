import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { User, Shirt, Palette, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface CharacterCustomizationProps {
  userId: string;
  onCharacterCreated: (character: any) => void;
}

// Extended color palettes
const SKIN_COLORS = ['#fce4d6', '#f5d0c5', '#e8beac', '#d4a98c', '#c68c6a', '#a67c52', '#8d5524', '#6b4423', '#5c3c1f', '#4a2c17'];
const HAIR_COLORS = ['#3d2314', '#1a1a1a', '#6b4423', '#8b4513', '#b8860b', '#8b0000', '#800020', '#ffd700', '#e6be8a', '#4169e1', '#32cd32', '#ff69b4', '#9400d3', '#00ced1'];
const EYE_COLORS = ['#634e34', '#2e536f', '#3d671d', '#497665', '#1c7847', '#7f7f7f', '#8b4513', '#000000', '#0066cc', '#228b22'];

const SHIRT_STYLES = [
  { id: 'tshirt', name: 'T-Shirt', icon: '👕' },
  { id: 'hoodie', name: 'Hoodie', icon: '🧥' },
  { id: 'tank', name: 'Tank Top', icon: '🎽' },
  { id: 'jacket', name: 'Jacket', icon: '🧥' },
  { id: 'suit', name: 'Suit', icon: '🤵' },
];
const SHIRT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ffffff', '#1a1a1a', '#6b7280', '#dc2626', '#059669'];

const PANTS_STYLES = [
  { id: 'jeans', name: 'Jeans', icon: '👖' },
  { id: 'shorts', name: 'Shorts', icon: '🩳' },
  { id: 'joggers', name: 'Joggers', icon: '👖' },
  { id: 'suit', name: 'Suit Pants', icon: '👔' },
  { id: 'skirt', name: 'Skirt', icon: '👗' },
];
const PANTS_COLORS = ['#1e3a5f', '#1a1a1a', '#4a5568', '#1e40af', '#065f46', '#7c2d12', '#374151', '#dc2626', '#ffffff', '#6b21a8'];

const HAIR_STYLES = [
  { id: 'short', name: 'Short', icon: '💇' },
  { id: 'medium', name: 'Medium', icon: '💇‍♀️' },
  { id: 'long', name: 'Long', icon: '👩‍🦱' },
  { id: 'bald', name: 'Bald', icon: '👨‍🦲' },
  { id: 'curly', name: 'Curly', icon: '👩‍🦱' },
  { id: 'ponytail', name: 'Ponytail', icon: '💁‍♀️' },
  { id: 'mohawk', name: 'Mohawk', icon: '🧑‍🎤' },
  { id: 'afro', name: 'Afro', icon: '🧑‍🦱' },
];

const ACCESSORIES = [
  { id: 'none', name: 'None', icon: '❌' },
  { id: 'glasses', name: 'Glasses', icon: '👓' },
  { id: 'sunglasses', name: 'Sunglasses', icon: '🕶️' },
  { id: 'earring', name: 'Earring', icon: '💎' },
  { id: 'chain', name: 'Chain', icon: '📿' },
  { id: 'hat', name: 'Cap', icon: '🧢' },
  { id: 'beanie', name: 'Beanie', icon: '🎿' },
];

export default function CharacterCustomization({ userId, onCharacterCreated }: CharacterCustomizationProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[2]);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [eyeColor, setEyeColor] = useState(EYE_COLORS[0]);
  const [hairStyle, setHairStyle] = useState(HAIR_STYLES[0].id);
  const [shirtStyle, setShirtStyle] = useState(SHIRT_STYLES[0].id);
  const [shirtColor, setShirtColor] = useState(SHIRT_COLORS[0]);
  const [pantsStyle, setPantsStyle] = useState(PANTS_STYLES[0].id);
  const [pantsColor, setPantsColor] = useState(PANTS_COLORS[0]);
  const [accessory, setAccessory] = useState('none');
  const [bodyHeight, setBodyHeight] = useState([50]);
  const [bodyBuild, setBodyBuild] = useState([50]);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');

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

  const renderCharacterPreview = () => {
    const heightScale = 0.8 + (bodyHeight[0] / 100) * 0.4;
    const buildScale = 0.85 + (bodyBuild[0] / 100) * 0.3;
    
    return (
      <div className="relative flex flex-col items-center justify-center h-full">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent rounded-2xl" />
        
        {/* Character SVG */}
        <svg 
          width="200" 
          height="320" 
          viewBox="0 0 60 100" 
          className="drop-shadow-2xl relative z-10"
          style={{ transform: `scaleY(${heightScale})` }}
        >
          {/* Body */}
          <rect 
            x={15 + (1 - buildScale) * 7.5} 
            y="32" 
            width={30 * buildScale} 
            height="38" 
            rx="4" 
            fill={shirtColor}
          />
          
          {/* Shirt details based on style */}
          {shirtStyle === 'hoodie' && (
            <>
              <path d="M25 32 L30 38 L35 32" stroke={shirtColor === '#1a1a1a' ? '#333' : '#00000030'} strokeWidth="2" fill="none" />
              <ellipse cx="30" cy="35" rx="5" ry="3" fill={shirtColor === '#1a1a1a' ? '#333' : '#00000020'} />
            </>
          )}
          {shirtStyle === 'suit' && (
            <>
              <path d="M24 32 L30 45 L36 32" stroke="#333" strokeWidth="1" fill="none" />
              <circle cx="30" cy="50" r="1.5" fill="#333" />
              <circle cx="30" cy="58" r="1.5" fill="#333" />
            </>
          )}
          
          {/* Head */}
          <circle cx="30" cy="18" r="14" fill={skinColor} />
          
          {/* Hair based on style */}
          {hairStyle !== 'bald' && (
            <>
              {hairStyle === 'short' && (
                <ellipse cx="30" cy="9" rx="12" ry="6" fill={hairColor} />
              )}
              {hairStyle === 'medium' && (
                <>
                  <ellipse cx="30" cy="8" rx="13" ry="7" fill={hairColor} />
                  <rect x="17" y="10" width="5" height="12" rx="2" fill={hairColor} />
                  <rect x="38" y="10" width="5" height="12" rx="2" fill={hairColor} />
                </>
              )}
              {hairStyle === 'long' && (
                <>
                  <ellipse cx="30" cy="8" rx="14" ry="8" fill={hairColor} />
                  <rect x="16" y="10" width="6" height="25" rx="3" fill={hairColor} />
                  <rect x="38" y="10" width="6" height="25" rx="3" fill={hairColor} />
                </>
              )}
              {hairStyle === 'curly' && (
                <>
                  <circle cx="22" cy="8" r="5" fill={hairColor} />
                  <circle cx="30" cy="5" r="5" fill={hairColor} />
                  <circle cx="38" cy="8" r="5" fill={hairColor} />
                  <circle cx="25" cy="4" r="4" fill={hairColor} />
                  <circle cx="35" cy="4" r="4" fill={hairColor} />
                </>
              )}
              {hairStyle === 'ponytail' && (
                <>
                  <ellipse cx="30" cy="8" rx="12" ry="6" fill={hairColor} />
                  <rect x="28" y="10" width="4" height="20" rx="2" fill={hairColor} />
                </>
              )}
              {hairStyle === 'mohawk' && (
                <rect x="27" y="0" width="6" height="15" rx="2" fill={hairColor} />
              )}
              {hairStyle === 'afro' && (
                <circle cx="30" cy="10" r="16" fill={hairColor} />
              )}
            </>
          )}
          
          {/* Eyes */}
          <ellipse cx="25" cy="18" rx="2.5" ry="2" fill="white" />
          <ellipse cx="35" cy="18" rx="2.5" ry="2" fill="white" />
          <circle cx="25" cy="18" r="1.5" fill={eyeColor} />
          <circle cx="35" cy="18" r="1.5" fill={eyeColor} />
          <circle cx="25.5" cy="17.5" r="0.5" fill="white" />
          <circle cx="35.5" cy="17.5" r="0.5" fill="white" />
          
          {/* Eyebrows */}
          <path d="M22 14 Q25 13 28 14" stroke={hairColor === '#ffd700' || hairColor === '#e6be8a' ? '#8b4513' : hairColor} strokeWidth="1.2" fill="none" />
          <path d="M32 14 Q35 13 38 14" stroke={hairColor === '#ffd700' || hairColor === '#e6be8a' ? '#8b4513' : hairColor} strokeWidth="1.2" fill="none" />
          
          {/* Nose */}
          <path d="M29 20 Q30 22 31 20" stroke={skinColor === '#fce4d6' ? '#e8beac' : '#00000020'} strokeWidth="0.8" fill="none" />
          
          {/* Mouth */}
          <path d="M26 25 Q30 28 34 25" stroke="#333" strokeWidth="1" fill="none" />
          
          {/* Accessories */}
          {accessory === 'glasses' && (
            <>
              <circle cx="25" cy="18" r="4" stroke="#333" strokeWidth="1" fill="none" />
              <circle cx="35" cy="18" r="4" stroke="#333" strokeWidth="1" fill="none" />
              <line x1="29" y1="18" x2="31" y2="18" stroke="#333" strokeWidth="1" />
            </>
          )}
          {accessory === 'sunglasses' && (
            <>
              <rect x="21" y="15" width="8" height="5" rx="1" fill="#1a1a1a" />
              <rect x="31" y="15" width="8" height="5" rx="1" fill="#1a1a1a" />
              <line x1="29" y1="17" x2="31" y2="17" stroke="#1a1a1a" strokeWidth="1" />
            </>
          )}
          {accessory === 'chain' && (
            <path d="M22 32 Q30 38 38 32" stroke="#ffd700" strokeWidth="2" fill="none" />
          )}
          {accessory === 'hat' && (
            <>
              <rect x="18" y="4" width="24" height="8" rx="2" fill={shirtColor} />
              <rect x="16" y="10" width="10" height="3" rx="1" fill={shirtColor} />
            </>
          )}
          {accessory === 'beanie' && (
            <ellipse cx="30" cy="6" rx="14" ry="8" fill={shirtColor} />
          )}
          {accessory === 'earring' && (
            <>
              <circle cx="16" cy="20" r="2" fill="#ffd700" />
              <circle cx="44" cy="20" r="2" fill="#ffd700" />
            </>
          )}
          
          {/* Legs */}
          <rect x="17" y="70" width="10" height="25" rx="3" fill={pantsColor} />
          <rect x="33" y="70" width="10" height="25" rx="3" fill={pantsColor} />
          
          {/* Shorts variant */}
          {pantsStyle === 'shorts' && (
            <>
              <rect x="17" y="85" width="10" height="10" fill={skinColor} />
              <rect x="33" y="85" width="10" height="10" fill={skinColor} />
            </>
          )}
          {pantsStyle === 'skirt' && (
            <path d="M15 70 L30 90 L45 70 Z" fill={pantsColor} />
          )}
          
          {/* Arms */}
          <rect x={5 + (1 - buildScale) * 5} y="34" width={10 * buildScale} height="26" rx="4" fill={shirtColor} />
          <rect x={45 - (1 - buildScale) * 5} y="34" width={10 * buildScale} height="26" rx="4" fill={shirtColor} />
          
          {/* Hands */}
          <circle cx="10" cy="62" r="4" fill={skinColor} />
          <circle cx="50" cy="62" r="4" fill={skinColor} />
          
          {/* Shoes */}
          <ellipse cx="22" cy="96" rx="6" ry="3" fill="#1a1a1a" />
          <ellipse cx="38" cy="96" rx="6" ry="3" fill="#1a1a1a" />
        </svg>
        
        {/* Name preview */}
        <div className="mt-4 text-center relative z-10">
          <div className="text-2xl font-bold text-white">{name || 'Your Character'}</div>
          <div className="text-sm text-cyan-400 capitalize">{gender}</div>
        </div>
        
        {/* Rotate hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-gray-500 text-xs">
          <ChevronLeft className="w-4 h-4" />
          <span>Drag to rotate</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20 border-b border-white/10 p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-white tracking-tight">CREATE YOUR CHARACTER</h1>
              <p className="text-cyan-400">Design your unique avatar</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-0">
          {/* Preview Section */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-8 min-h-[500px] flex items-center justify-center border-r border-white/5">
            {renderCharacterPreview()}
          </div>

          {/* Customization Options */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 mb-6 bg-gray-800/50">
                <TabsTrigger value="identity" className="gap-1 text-xs sm:text-sm">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Identity</span>
                </TabsTrigger>
                <TabsTrigger value="face" className="gap-1 text-xs sm:text-sm">
                  <Palette className="w-4 h-4" />
                  <span className="hidden sm:inline">Face</span>
                </TabsTrigger>
                <TabsTrigger value="body" className="gap-1 text-xs sm:text-sm">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Body</span>
                </TabsTrigger>
                <TabsTrigger value="clothes" className="gap-1 text-xs sm:text-sm">
                  <Shirt className="w-4 h-4" />
                  <span className="hidden sm:inline">Clothes</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="identity" className="space-y-6 mt-0">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-white">Character Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter a unique name..."
                    maxLength={20}
                    className="bg-gray-800/50 border-white/10 text-white"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label className="text-white">Gender</Label>
                  <div className="flex gap-2">
                    {(['male', 'female', 'other'] as const).map((g) => (
                      <Button
                        key={g}
                        variant={gender === g ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGender(g)}
                        className={`flex-1 capitalize ${gender === g ? 'bg-cyan-600 hover:bg-cyan-700' : 'border-white/10 text-white hover:bg-white/10'}`}
                      >
                        {g === 'male' ? '👨' : g === 'female' ? '👩' : '🧑'} {g}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="face" className="space-y-6 mt-0">
                {/* Skin Color */}
                <div className="space-y-2">
                  <Label className="text-white">Skin Tone</Label>
                  <div className="flex gap-2 flex-wrap">
                    {SKIN_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSkinColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          skinColor === color ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/50' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Eye Color */}
                <div className="space-y-2">
                  <Label className="text-white">Eye Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {EYE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEyeColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          eyeColor === color ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/50' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Hair Style */}
                <div className="space-y-2">
                  <Label className="text-white">Hair Style</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {HAIR_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setHairStyle(style.id)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          hairStyle === style.id 
                            ? 'border-cyan-400 bg-cyan-500/20' 
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <div className="text-xs text-gray-400 mt-1">{style.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div className="space-y-2">
                  <Label className="text-white">Hair Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {HAIR_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setHairColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          hairColor === color ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/50' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Accessories */}
                <div className="space-y-2">
                  <Label className="text-white">Accessories</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setAccessory(acc.id)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          accessory === acc.id 
                            ? 'border-cyan-400 bg-cyan-500/20' 
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <span className="text-xl">{acc.icon}</span>
                        <div className="text-xs text-gray-400 mt-1">{acc.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="body" className="space-y-6 mt-0">
                {/* Height */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-white">Height</Label>
                    <span className="text-sm text-gray-400">{bodyHeight[0] < 30 ? 'Short' : bodyHeight[0] > 70 ? 'Tall' : 'Average'}</span>
                  </div>
                  <Slider
                    value={bodyHeight}
                    onValueChange={setBodyHeight}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Build */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-white">Body Build</Label>
                    <span className="text-sm text-gray-400">{bodyBuild[0] < 30 ? 'Slim' : bodyBuild[0] > 70 ? 'Athletic' : 'Average'}</span>
                  </div>
                  <Slider
                    value={bodyBuild}
                    onValueChange={setBodyBuild}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </TabsContent>

              <TabsContent value="clothes" className="space-y-6 mt-0">
                {/* Shirt Style */}
                <div className="space-y-2">
                  <Label className="text-white">Top</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {SHIRT_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setShirtStyle(style.id)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          shirtStyle === style.id 
                            ? 'border-cyan-400 bg-cyan-500/20' 
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <div className="text-xs text-gray-400 mt-1">{style.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shirt Color */}
                <div className="space-y-2">
                  <Label className="text-white">Top Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {SHIRT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setShirtColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          shirtColor === color ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/50' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Pants Style */}
                <div className="space-y-2">
                  <Label className="text-white">Bottom</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {PANTS_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setPantsStyle(style.id)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          pantsStyle === style.id 
                            ? 'border-cyan-400 bg-cyan-500/20' 
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <div className="text-xs text-gray-400 mt-1">{style.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pants Color */}
                <div className="space-y-2">
                  <Label className="text-white">Bottom Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PANTS_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setPantsColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          pantsColor === color ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/50' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Create Button */}
            <div className="mt-8">
              <button 
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <Sparkles className="w-6 h-6" />
                  {creating ? 'Creating...' : 'CREATE CHARACTER'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
