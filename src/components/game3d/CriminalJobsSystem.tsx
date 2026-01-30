import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  X, Briefcase, DollarSign, Clock, AlertTriangle, Leaf, 
  Car, Store, Skull, Coins, Zap, Timer, TrendingUp
} from 'lucide-react';

interface CriminalJob {
  id: string;
  name: string;
  job_type: string;
  description: string;
  min_payout: number;
  max_payout: number;
  cooldown_minutes: number;
  wanted_level_risk: number;
  energy_cost: number;
  icon: string;
}

interface CriminalJobsProps {
  characterId: string;
  characterName: string;
  cash: number;
  energy: number;
  wantedLevel: number;
  onCashChange: (amount: number) => void;
  onEnergyChange: (amount: number) => void;
  onWantedLevelChange: (level: number) => void;
  onClose: () => void;
}

export default function CriminalJobsSystem({
  characterId,
  characterName,
  cash,
  energy,
  wantedLevel,
  onCashChange,
  onEnergyChange,
  onWantedLevelChange,
  onClose
}: CriminalJobsProps) {
  const [jobs, setJobs] = useState<CriminalJob[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<CriminalJob | null>(null);
  const [jobProgress, setJobProgress] = useState(0);

  useEffect(() => {
    loadJobs();
    loadCooldowns();
  }, [characterId]);

  // Countdown timer for cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] = Math.max(0, updated[key] - 1);
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    const { data } = await supabase.from('game_criminal_jobs').select('*');
    if (data) setJobs(data);
  };

  const loadCooldowns = async () => {
    const { data } = await supabase
      .from('game_job_logs')
      .select('job_type, created_at')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });

    if (data) {
      const now = Date.now();
      const cooldownMap: Record<string, number> = {};
      
      data.forEach(log => {
        if (!cooldownMap[log.job_type]) {
          const job = jobs.find(j => j.job_type === log.job_type);
          if (job) {
            const elapsed = (now - new Date(log.created_at).getTime()) / 1000;
            const remaining = Math.max(0, job.cooldown_minutes * 60 - elapsed);
            cooldownMap[log.job_type] = Math.floor(remaining);
          }
        }
      });
      
      setCooldowns(cooldownMap);
    }
  };

  const startJob = useCallback(async (job: CriminalJob) => {
    if (energy < job.energy_cost) {
      toast.error('Not enough energy!');
      return;
    }

    if (cooldowns[job.job_type] && cooldowns[job.job_type] > 0) {
      toast.error('Job still on cooldown!');
      return;
    }

    setActiveJob(job);
    setJobProgress(0);
    setLoading(true);

    // Simulate job progress
    const duration = 3000 + Math.random() * 2000; // 3-5 seconds
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setJobProgress(progress);
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        completeJob(job);
      }
    }, 50);
  }, [energy, cooldowns]);

  const completeJob = async (job: CriminalJob) => {
    // Calculate success/failure
    const successChance = Math.max(0.3, 1 - (wantedLevel * 0.1)); // Lower success with higher wanted
    const isSuccess = Math.random() < successChance;

    if (isSuccess) {
      const payout = Math.floor(job.min_payout + Math.random() * (job.max_payout - job.min_payout));
      
      // Update character
      await supabase.from('game_characters').update({
        cash: cash + payout,
        energy: Math.max(0, energy - job.energy_cost),
        wanted_level: Math.min(5, wantedLevel + (Math.random() < 0.5 ? job.wanted_level_risk : 0))
      }).eq('id', characterId);

      // Log the job
      await supabase.from('game_job_logs').insert({
        character_id: characterId,
        job_type: job.job_type,
        payout,
        success: true
      });

      onCashChange(payout);
      onEnergyChange(-job.energy_cost);
      
      // Maybe add wanted level
      if (Math.random() < 0.5) {
        onWantedLevelChange(Math.min(5, wantedLevel + job.wanted_level_risk));
        toast.warning(`+${job.wanted_level_risk} Wanted Star!`);
      }

      toast.success(`${job.name} complete! Earned $${payout.toLocaleString()}`);
    } else {
      // Failed - lose energy, possibly gain wanted level
      await supabase.from('game_characters').update({
        energy: Math.max(0, energy - job.energy_cost),
        wanted_level: Math.min(5, wantedLevel + job.wanted_level_risk)
      }).eq('id', characterId);

      await supabase.from('game_job_logs').insert({
        character_id: characterId,
        job_type: job.job_type,
        payout: 0,
        success: false
      });

      onEnergyChange(-job.energy_cost);
      onWantedLevelChange(Math.min(5, wantedLevel + job.wanted_level_risk));
      
      toast.error(`${job.name} failed! +${job.wanted_level_risk} Wanted Stars`);
    }

    // Set cooldown
    setCooldowns(prev => ({
      ...prev,
      [job.job_type]: job.cooldown_minutes * 60
    }));

    setActiveJob(null);
    setJobProgress(0);
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getJobIcon = (iconStr: string) => {
    const icons: Record<string, React.ReactNode> = {
      '👛': <Coins className="w-6 h-6" />,
      '🚗': <Car className="w-6 h-6" />,
      '💊': <Skull className="w-6 h-6" />,
      '🌿': <Leaf className="w-6 h-6" />,
      '🏪': <Store className="w-6 h-6" />,
      '🏦': <DollarSign className="w-6 h-6" />,
      '😈': <AlertTriangle className="w-6 h-6" />,
      '💀': <Skull className="w-6 h-6" />,
    };
    return icons[iconStr] || <Briefcase className="w-6 h-6" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-red-950/30 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-red-500/20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-600/20 border border-red-500/30 flex items-center justify-center">
              <Skull className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Criminal Activities</h2>
              <p className="text-xs text-gray-500">High risk, high reward</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mb-6 p-3 bg-black/30 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-bold">${cash.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold">{energy}%</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-bold">{wantedLevel}/5 Stars</span>
          </div>
        </div>

        {/* Active job progress */}
        {activeJob && (
          <div className="mb-6 p-4 bg-red-500/10 rounded-xl border border-red-500/30 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold">{activeJob.name} in progress...</span>
              <span className="text-red-400">{Math.floor(jobProgress)}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-100"
                style={{ width: `${jobProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Jobs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map(job => {
            const isOnCooldown = cooldowns[job.job_type] > 0;
            const canAfford = energy >= job.energy_cost;

            return (
              <button
                key={job.id}
                onClick={() => !isOnCooldown && canAfford && !loading && startJob(job)}
                disabled={isOnCooldown || !canAfford || loading}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isOnCooldown || !canAfford || loading
                    ? 'bg-gray-800/30 border-white/5 opacity-60 cursor-not-allowed'
                    : 'bg-gray-800/50 border-red-500/20 hover:border-red-500/50 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    job.wanted_level_risk >= 4 ? 'bg-red-500/20 text-red-400' :
                    job.wanted_level_risk >= 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {getJobIcon(job.icon)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">{job.name}</h3>
                      {isOnCooldown && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {formatTime(cooldowns[job.job_type])}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{job.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-green-400 text-sm font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        ${job.min_payout}-${job.max_payout}
                      </span>
                      <span className="text-yellow-400 text-xs flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        -{job.energy_cost}
                      </span>
                      <span className="text-blue-400 text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        +{job.wanted_level_risk}★
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Warning */}
        <div className="mt-6 p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
          <p className="text-red-400 text-sm">
            ⚠️ Criminal activities increase your wanted level. Police may arrest you!
          </p>
        </div>
      </div>
    </div>
  );
}
