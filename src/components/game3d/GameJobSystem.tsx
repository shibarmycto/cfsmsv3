import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Briefcase, DollarSign, Clock, Star, Truck, Cannabis, ShoppingBag, Skull, Shield, X } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  minPayout: number;
  maxPayout: number;
  cooldownMinutes: number;
  energyCost: number;
  wantedRisk: number;
  type: 'legal' | 'illegal';
}

interface GameJobSystemProps {
  characterId: string;
  characterName: string;
  currentJob: string;
  currentEnergy: number;
  currentCash: number;
  onEnergyChange: (energy: number) => void;
  onCashChange: (cash: number) => void;
  onWantedChange: (wanted: number) => void;
}

const JOBS: Job[] = [
  // Legal Jobs
  {
    id: 'taxi',
    name: 'Taxi Driver',
    icon: <Truck className="w-5 h-5" />,
    description: 'Drive passengers around the city',
    minPayout: 50,
    maxPayout: 150,
    cooldownMinutes: 2,
    energyCost: 10,
    wantedRisk: 0,
    type: 'legal',
  },
  {
    id: 'delivery',
    name: 'Delivery Driver',
    icon: <ShoppingBag className="w-5 h-5" />,
    description: 'Deliver packages around town',
    minPayout: 40,
    maxPayout: 120,
    cooldownMinutes: 2,
    energyCost: 8,
    wantedRisk: 0,
    type: 'legal',
  },
  {
    id: 'security',
    name: 'Security Guard',
    icon: <Shield className="w-5 h-5" />,
    description: 'Protect locations and people',
    minPayout: 60,
    maxPayout: 180,
    cooldownMinutes: 3,
    energyCost: 15,
    wantedRisk: 0,
    type: 'legal',
  },
  // Criminal Jobs
  {
    id: 'pickpocket',
    name: 'Pickpocket',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Steal from pedestrians',
    minPayout: 20,
    maxPayout: 100,
    cooldownMinutes: 1,
    energyCost: 5,
    wantedRisk: 1,
    type: 'illegal',
  },
  {
    id: 'robbery',
    name: 'Store Robbery',
    icon: <Skull className="w-5 h-5" />,
    description: 'Rob a convenience store',
    minPayout: 200,
    maxPayout: 800,
    cooldownMinutes: 5,
    energyCost: 20,
    wantedRisk: 2,
    type: 'illegal',
  },
  {
    id: 'cannabis',
    name: 'Cannabis Growing',
    icon: <Cannabis className="w-5 h-5" />,
    description: 'Grow and sell cannabis',
    minPayout: 100,
    maxPayout: 500,
    cooldownMinutes: 10,
    energyCost: 15,
    wantedRisk: 1,
    type: 'illegal',
  },
  {
    id: 'heist',
    name: 'Bank Heist',
    icon: <Star className="w-5 h-5" />,
    description: 'Rob the bank for massive payout',
    minPayout: 5000,
    maxPayout: 20000,
    cooldownMinutes: 30,
    energyCost: 50,
    wantedRisk: 5,
    type: 'illegal',
  },
];

export default function GameJobSystem({
  characterId,
  characterName,
  currentJob,
  currentEnergy,
  currentCash,
  onEnergyChange,
  onCashChange,
  onWantedChange,
}: GameJobSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'legal' | 'illegal'>('legal');
  const [cooldowns, setCooldowns] = useState<Record<string, Date>>({});
  const [isWorking, setIsWorking] = useState(false);

  // Load cooldowns from local storage
  useEffect(() => {
    const saved = localStorage.getItem(`job_cooldowns_${characterId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      const restored: Record<string, Date> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const date = new Date(value as string);
        if (date > new Date()) {
          restored[key] = date;
        }
      });
      setCooldowns(restored);
    }
  }, [characterId]);

  // Save cooldowns to local storage
  useEffect(() => {
    localStorage.setItem(`job_cooldowns_${characterId}`, JSON.stringify(cooldowns));
  }, [cooldowns, characterId]);

  const getCooldownRemaining = (jobId: string): number => {
    const cooldownEnd = cooldowns[jobId];
    if (!cooldownEnd) return 0;
    return Math.max(0, Math.ceil((new Date(cooldownEnd).getTime() - Date.now()) / 1000));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const doJob = useCallback(async (job: Job) => {
    // Check cooldown
    if (getCooldownRemaining(job.id) > 0) {
      toast.error(`Wait ${formatTime(getCooldownRemaining(job.id))} before doing this job again`);
      return;
    }

    // Check energy
    if (currentEnergy < job.energyCost) {
      toast.error(`Not enough energy! Need ${job.energyCost} energy`);
      return;
    }

    setIsWorking(true);

    // Simulate job with random success
    const success = Math.random() > (job.type === 'illegal' ? 0.2 : 0.1);
    
    setTimeout(async () => {
      if (success) {
        const payout = Math.floor(Math.random() * (job.maxPayout - job.minPayout + 1)) + job.minPayout;
        
        // Update character
        const newEnergy = currentEnergy - job.energyCost;
        const newCash = currentCash + payout;
        
        onEnergyChange(newEnergy);
        onCashChange(newCash);

        await supabase.from('game_characters').update({
          energy: newEnergy,
          cash: newCash,
        }).eq('id', characterId);

        // Add wanted level for illegal jobs
        if (job.type === 'illegal' && job.wantedRisk > 0) {
          const addWanted = Math.random() < 0.3 ? job.wantedRisk : 0;
          if (addWanted > 0) {
            const { data } = await supabase
              .from('game_characters')
              .select('wanted_level')
              .eq('id', characterId)
              .single();
            
            if (data) {
              const newWanted = Math.min(5, (data.wanted_level || 0) + addWanted);
              onWantedChange(newWanted);
              await supabase.from('game_characters').update({
                wanted_level: newWanted,
              }).eq('id', characterId);
              
              if (addWanted > 0) {
                toast.warning(`Police are looking for you! +${addWanted} ⭐`);
              }
            }
          }
        }

        // Log the job
        await supabase.from('game_job_logs').insert({
          character_id: characterId,
          job_type: job.id,
          payout,
          success: true,
        });

        toast.success(`${job.name} complete! Earned $${payout.toLocaleString()}`);
      } else {
        // Failed job
        const fine = Math.floor(job.minPayout * 0.5);
        const newCash = Math.max(0, currentCash - fine);
        const newEnergy = Math.max(0, currentEnergy - job.energyCost);

        onEnergyChange(newEnergy);
        onCashChange(newCash);

        await supabase.from('game_characters').update({
          energy: newEnergy,
          cash: newCash,
        }).eq('id', characterId);

        if (job.type === 'illegal') {
          const { data } = await supabase
            .from('game_characters')
            .select('wanted_level')
            .eq('id', characterId)
            .single();
          
          if (data) {
            const newWanted = Math.min(5, (data.wanted_level || 0) + job.wantedRisk);
            onWantedChange(newWanted);
            await supabase.from('game_characters').update({
              wanted_level: newWanted,
            }).eq('id', characterId);
          }
        }

        await supabase.from('game_job_logs').insert({
          character_id: characterId,
          job_type: job.id,
          payout: -fine,
          success: false,
        });

        toast.error(`${job.name} failed! Lost $${fine}`);
      }

      // Set cooldown
      const cooldownEnd = new Date(Date.now() + job.cooldownMinutes * 60 * 1000);
      setCooldowns(prev => ({ ...prev, [job.id]: cooldownEnd }));

      setIsWorking(false);
    }, 2000);
  }, [characterId, currentEnergy, currentCash, onEnergyChange, onCashChange, onWantedChange]);

  return (
    <>
      {/* Jobs Menu */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full border border-white/10 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-400" />
                Jobs & Activities
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedTab('legal')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  selectedTab === 'legal'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                💼 Legal Jobs
              </button>
              <button
                onClick={() => setSelectedTab('illegal')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  selectedTab === 'illegal'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                💀 Criminal Jobs
              </button>
            </div>

            {/* Job List */}
            <div className="space-y-3">
              {JOBS.filter(job => job.type === selectedTab).map(job => {
                const cooldown = getCooldownRemaining(job.id);
                const canDo = cooldown === 0 && currentEnergy >= job.energyCost && !isWorking;

                return (
                  <div
                    key={job.id}
                    className={`p-4 rounded-xl border transition-all ${
                      canDo
                        ? 'bg-gray-800/50 border-white/10 hover:border-cyan-500/50'
                        : 'bg-gray-800/20 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          job.type === 'legal' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {job.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{job.name}</h3>
                          <p className="text-gray-400 text-xs">{job.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">
                          ${job.minPayout} - ${job.maxPayout}
                        </div>
                        <div className="text-gray-500 text-xs flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {job.cooldownMinutes}m cooldown
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-3 text-xs">
                        <span className="text-yellow-400">⚡ {job.energyCost}</span>
                        {job.wantedRisk > 0 && (
                          <span className="text-red-400">⭐ +{job.wantedRisk} risk</span>
                        )}
                      </div>

                      {cooldown > 0 ? (
                        <div className="text-gray-400 text-sm flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(cooldown)}
                        </div>
                      ) : (
                        <button
                          onClick={() => doJob(job)}
                          disabled={!canDo}
                          className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                            canDo
                              ? job.type === 'legal'
                                ? 'bg-green-600 text-white hover:bg-green-500'
                                : 'bg-red-600 text-white hover:bg-red-500'
                              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isWorking ? 'Working...' : 'Start'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current stats */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg flex justify-between text-sm">
              <div className="text-yellow-400">⚡ Energy: {currentEnergy}%</div>
              <div className="text-green-400">💵 Cash: ${currentCash.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Return the state and methods */}
      {null}
    </>
  );
}

export function useGameJobs(props: GameJobSystemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    setIsOpen,
    JobsMenu: () => <GameJobSystem {...props} />,
  };
}
