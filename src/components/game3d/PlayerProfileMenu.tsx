import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  X, User, Sword, Shield, Skull, DollarSign, Clock, 
  Trophy, Target, Heart, Zap, TrendingUp, Calendar
} from 'lucide-react';

interface PlayerStats {
  kills: number;
  deaths: number;
  arrests: number;
  total_crimes: number;
  job_experience: number;
  current_job: string;
  cash: number;
  bank_balance: number;
  health: number;
  energy: number;
  hunger: number;
  wanted_level: number;
  created_at: string;
}

interface PlayerProfileProps {
  characterId: string;
  characterName: string;
  gangName?: string;
  gangColor?: string;
  onClose: () => void;
}

export default function PlayerProfileMenu({
  characterId,
  characterName,
  gangName,
  gangColor,
  onClose
}: PlayerProfileProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [combatHistory, setCombatHistory] = useState<any[]>([]);

  useEffect(() => {
    loadProfile();
  }, [characterId]);

  const loadProfile = async () => {
    // Load character stats
    const { data: character } = await supabase
      .from('game_characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (character) {
      setStats(character as PlayerStats);
    }

    // Load recent jobs
    const { data: jobs } = await supabase
      .from('game_job_logs')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (jobs) setRecentJobs(jobs);

    // Load combat history
    const { data: combat } = await supabase
      .from('game_combat_logs')
      .select('*, victim:victim_id(name), attacker:attacker_id(name)')
      .or(`attacker_id.eq.${characterId},victim_id.eq.${characterId}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (combat) setCombatHistory(combat);
  };

  const kd = stats ? (stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toString()) : '0';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-cyan-950/30 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-cyan-500/20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Profile Header */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-4 border-cyan-500/30 flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{characterName}</h2>
          {gangName && (
            <div 
              className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${gangColor}30`, color: gangColor }}
            >
              <Shield className="w-3 h-3" />
              {gangName}
            </div>
          )}
          <p className="text-gray-500 text-sm mt-2 capitalize">
            {stats?.current_job?.replace('_', ' ') || 'Unemployed'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={<Sword className="w-4 h-4 text-red-400" />} label="Kills" value={stats?.kills || 0} />
          <StatCard icon={<Skull className="w-4 h-4 text-gray-400" />} label="Deaths" value={stats?.deaths || 0} />
          <StatCard icon={<Target className="w-4 h-4 text-yellow-400" />} label="K/D" value={kd} />
          <StatCard icon={<Shield className="w-4 h-4 text-blue-400" />} label="Arrests" value={stats?.arrests || 0} />
          <StatCard icon={<Skull className="w-4 h-4 text-orange-400" />} label="Crimes" value={stats?.total_crimes || 0} />
          <StatCard icon={<Trophy className="w-4 h-4 text-purple-400" />} label="XP" value={stats?.job_experience || 0} />
        </div>

        {/* Financials */}
        <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5 mb-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Finances
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-green-400">${stats?.cash.toLocaleString() || 0}</div>
              <div className="text-gray-500 text-xs">Cash on Hand</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">${stats?.bank_balance.toLocaleString() || 0}</div>
              <div className="text-gray-500 text-xs">Bank Account</div>
            </div>
          </div>
        </div>

        {/* Status Bars */}
        <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5 mb-6">
          <h3 className="text-white font-bold mb-3">Status</h3>
          <div className="space-y-3">
            <StatusBar 
              icon={<Heart className="w-3 h-3 text-red-400" />} 
              label="Health" 
              value={stats?.health || 0} 
              color="from-red-600 to-red-400"
            />
            <StatusBar 
              icon={<Zap className="w-3 h-3 text-yellow-400" />} 
              label="Energy" 
              value={stats?.energy || 0} 
              color="from-yellow-500 to-amber-400"
            />
            <StatusBar 
              icon={<TrendingUp className="w-3 h-3 text-orange-400" />} 
              label="Hunger" 
              value={stats?.hunger || 0} 
              color="from-orange-500 to-amber-400"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Recent Activity
          </h3>
          {recentJobs.length === 0 && combatHistory.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentJobs.slice(0, 3).map((job, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                  <span className="text-gray-300 capitalize">{job.job_type.replace('_', ' ')}</span>
                  <span className={job.success ? 'text-green-400' : 'text-red-400'}>
                    {job.success ? `+$${job.payout}` : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member since */}
        {stats?.created_at && (
          <div className="mt-4 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            Member since {new Date(stats.created_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="p-3 rounded-xl bg-gray-800/50 border border-white/5 text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  );
}

function StatusBar({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <span className="text-xs text-gray-400">{value}%</span>
      </div>
      <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${color} transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
