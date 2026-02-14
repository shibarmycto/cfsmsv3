import { useState } from 'react';
import { X, Home, Sofa, Bath, Bed, Coffee, Heart, Zap, Pizza } from 'lucide-react';
import { GameBuilding } from './UKWorld';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PropertyInteriorProps {
  building: GameBuilding;
  characterId: string;
  characterName: string;
  stats: { health: number; hunger: number; energy: number; cash: number; bank: number; wantedLevel: number };
  onExit: () => void;
  onStatsChange: (stats: Partial<{ health: number; hunger: number; energy: number }>) => void;
}

export default function PropertyInterior({ building, characterId, characterName, stats, onExit, onStatsChange }: PropertyInteriorProps) {
  const [resting, setResting] = useState(false);

  const handleRest = async () => {
    setResting(true);
    toast.success('Resting... recovering health and energy');
    await new Promise(r => setTimeout(r, 3000));
    const newHealth = Math.min(100, stats.health + 30);
    const newEnergy = Math.min(100, stats.energy + 40);
    const newHunger = Math.max(0, stats.hunger - 10);
    onStatsChange({ health: newHealth, energy: newEnergy, hunger: newHunger });
    await supabase.from('game_characters').update({ health: newHealth, energy: newEnergy, hunger: newHunger }).eq('id', characterId);
    toast.success('You feel refreshed!');
    setResting(false);
  };

  const handleEat = () => {
    if (stats.hunger >= 100) { toast.info('Not hungry'); return; }
    const newHunger = Math.min(100, stats.hunger + 25);
    onStatsChange({ hunger: newHunger });
    supabase.from('game_characters').update({ hunger: newHunger }).eq('id', characterId);
    toast.success('+25 Hunger restored');
  };

  const handleShower = () => {
    const newEnergy = Math.min(100, stats.energy + 15);
    onStatsChange({ energy: newEnergy });
    supabase.from('game_characters').update({ energy: newEnergy }).eq('id', characterId);
    toast.success('+15 Energy from shower');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/30 flex items-center justify-center">
            <Home className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{building.name}</h1>
            <p className="text-sm text-gray-500">Your Property</p>
          </div>
        </div>
        <button onClick={onExit} className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 max-h-[calc(100vh-100px)] overflow-y-auto">
        <button onClick={handleRest} disabled={resting}
          className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/20 text-left active:scale-95 transition-transform disabled:opacity-50">
          <Bed className="w-10 h-10 text-blue-400 mb-3" />
          <h3 className="font-bold text-white text-lg">Rest</h3>
          <p className="text-gray-400 text-sm mt-1">{resting ? 'Resting...' : '+30 Health, +40 Energy'}</p>
        </button>

        <button onClick={handleEat}
          className="bg-orange-500/10 rounded-xl p-6 border border-orange-500/20 text-left active:scale-95 transition-transform">
          <Pizza className="w-10 h-10 text-orange-400 mb-3" />
          <h3 className="font-bold text-white text-lg">Eat</h3>
          <p className="text-gray-400 text-sm mt-1">+25 Hunger</p>
        </button>

        <button onClick={handleShower}
          className="bg-cyan-500/10 rounded-xl p-6 border border-cyan-500/20 text-left active:scale-95 transition-transform">
          <Bath className="w-10 h-10 text-cyan-400 mb-3" />
          <h3 className="font-bold text-white text-lg">Shower</h3>
          <p className="text-gray-400 text-sm mt-1">+15 Energy</p>
        </button>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10">
          <Sofa className="w-10 h-10 text-gray-400 mb-3" />
          <h3 className="font-bold text-white text-lg">Living Room</h3>
          <p className="text-gray-400 text-sm mt-1">Your safe space</p>
        </div>

        {/* Stats */}
        <div className="col-span-2 bg-gray-800/50 rounded-xl p-4 border border-white/10">
          <h3 className="text-white font-bold mb-3">Your Stats</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-red-400" /><span className="text-gray-300 text-sm flex-1">Health</span>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${stats.health}%` }} /></div>
              <span className="text-white text-sm w-10 text-right">{stats.health}%</span></div>
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /><span className="text-gray-300 text-sm flex-1">Energy</span>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.energy}%` }} /></div>
              <span className="text-white text-sm w-10 text-right">{stats.energy}%</span></div>
            <div className="flex items-center gap-2"><Coffee className="w-4 h-4 text-orange-400" /><span className="text-gray-300 text-sm flex-1">Hunger</span>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${stats.hunger}%` }} /></div>
              <span className="text-white text-sm w-10 text-right">{stats.hunger}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
