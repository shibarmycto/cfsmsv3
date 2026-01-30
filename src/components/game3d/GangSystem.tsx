import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  X, Users, Crown, Shield, Swords, Plus, Check, Clock, 
  DollarSign, Trophy, Star, UserPlus, Settings, Trash2
} from 'lucide-react';

interface Gang {
  id: string;
  name: string;
  tag: string;
  color: string;
  leader_id: string;
  treasury: number;
  reputation: number;
  member_count: number;
  max_members: number;
  is_approved: boolean;
  description: string;
}

interface GangMember {
  id: string;
  name: string;
  kills: number;
  is_leader: boolean;
}

interface GangSystemProps {
  characterId: string;
  characterName: string;
  currentGangId: string | null;
  onClose: () => void;
  onJoinGang: (gangId: string) => void;
  onLeaveGang: () => void;
}

export default function GangSystem({
  characterId,
  characterName,
  currentGangId,
  onClose,
  onJoinGang,
  onLeaveGang
}: GangSystemProps) {
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [myGang, setMyGang] = useState<Gang | null>(null);
  const [members, setMembers] = useState<GangMember[]>([]);
  const [tab, setTab] = useState<'browse' | 'create' | 'my-gang'>('browse');
  const [loading, setLoading] = useState(false);

  // Create gang form
  const [gangName, setGangName] = useState('');
  const [gangTag, setGangTag] = useState('');
  const [gangColor, setGangColor] = useState('#ff0000');
  const [gangDescription, setGangDescription] = useState('');

  useEffect(() => {
    loadGangs();
    if (currentGangId) {
      loadMyGang();
      setTab('my-gang');
    }
  }, [currentGangId]);

  const loadGangs = async () => {
    const { data } = await supabase
      .from('game_gangs')
      .select('*')
      .eq('is_approved', true)
      .order('reputation', { ascending: false });

    if (data) setGangs(data);
  };

  const loadMyGang = async () => {
    if (!currentGangId) return;

    const { data: gang } = await supabase
      .from('game_gangs')
      .select('*')
      .eq('id', currentGangId)
      .single();

    if (gang) {
      setMyGang(gang);

      // Load members
      const { data: memberData } = await supabase
        .from('game_characters')
        .select('id, name, kills')
        .eq('gang_id', currentGangId);

      if (memberData) {
        setMembers(memberData.map(m => ({
          ...m,
          is_leader: m.id === gang.leader_id
        })));
      }
    }
  };

  const createGang = async () => {
    if (!gangName.trim() || !gangTag.trim()) {
      toast.error('Gang name and tag are required!');
      return;
    }

    if (gangTag.length > 4) {
      toast.error('Tag must be 4 characters or less!');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.from('game_gangs').insert({
      name: gangName,
      tag: gangTag.toUpperCase(),
      color: gangColor,
      leader_id: characterId,
      description: gangDescription,
      is_approved: false // Needs admin approval
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      // Join the gang
      await supabase.from('game_characters').update({
        gang_id: data.id
      }).eq('id', characterId);

      toast.success('Gang created! Waiting for admin approval.');
      onJoinGang(data.id);
    }

    setLoading(false);
  };

  const applyToGang = async (gang: Gang) => {
    if (currentGangId) {
      toast.error('You are already in a gang!');
      return;
    }

    if (gang.member_count >= gang.max_members) {
      toast.error('Gang is full!');
      return;
    }

    const { error } = await supabase.from('game_gang_applications').insert({
      gang_id: gang.id,
      character_id: characterId,
      message: `${characterName} wants to join ${gang.name}`
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('You already applied to this gang!');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(`Applied to ${gang.name}!`);
    }
  };

  const leaveGang = async () => {
    if (!currentGangId || !myGang) return;

    if (myGang.leader_id === characterId) {
      toast.error('Leaders cannot leave! Transfer leadership first.');
      return;
    }

    await supabase.from('game_characters').update({
      gang_id: null
    }).eq('id', characterId);

    // Update member count
    await supabase.from('game_gangs').update({
      member_count: myGang.member_count - 1
    }).eq('id', currentGangId);

    toast.success('Left the gang');
    onLeaveGang();
  };

  const kickMember = async (memberId: string, memberName: string) => {
    if (!myGang || myGang.leader_id !== characterId) {
      toast.error('Only leaders can kick members!');
      return;
    }

    await supabase.from('game_characters').update({
      gang_id: null
    }).eq('id', memberId);

    await supabase.from('game_gangs').update({
      member_count: Math.max(1, myGang.member_count - 1)
    }).eq('id', myGang.id);

    toast.success(`Kicked ${memberName} from the gang`);
    loadMyGang();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/30 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-purple-500/20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Gangs</h2>
              <p className="text-xs text-gray-500">Criminal organizations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('browse')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              tab === 'browse' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Browse Gangs
          </button>
          <button
            onClick={() => setTab('create')}
            disabled={!!currentGangId}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              tab === 'create' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 
              currentGangId ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed' : 'bg-gray-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Create Gang
          </button>
          {currentGangId && (
            <button
              onClick={() => setTab('my-gang')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                tab === 'my-gang' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              My Gang
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'browse' && (
            <div className="space-y-3">
              {gangs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No gangs available</p>
                  <p className="text-sm">Create one to get started!</p>
                </div>
              ) : (
                gangs.map(gang => (
                  <div
                    key={gang.id}
                    className="p-4 rounded-xl bg-gray-800/50 border border-white/5 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-white"
                        style={{ backgroundColor: gang.color }}
                      >
                        {gang.tag}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white">{gang.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                            {gang.member_count}/{gang.max_members}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-yellow-400" />
                            {gang.reputation} REP
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-green-400" />
                            ${gang.treasury.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => applyToGang(gang)}
                        disabled={!!currentGangId || gang.member_count >= gang.max_members}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          currentGangId || gang.member_count >= gang.max_members
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'create' && (
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Gang Name *</label>
                <input
                  type="text"
                  value={gangName}
                  onChange={e => setGangName(e.target.value)}
                  placeholder="The Street Kings"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-white/10 focus:border-purple-500/50 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Tag (4 chars) *</label>
                  <input
                    type="text"
                    value={gangTag}
                    onChange={e => setGangTag(e.target.value.slice(0, 4))}
                    placeholder="TSK"
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-white/10 focus:border-purple-500/50 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Color</label>
                  <input
                    type="color"
                    value={gangColor}
                    onChange={e => setGangColor(e.target.value)}
                    className="w-full h-12 bg-gray-800 rounded-lg border border-white/10 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Description</label>
                <textarea
                  value={gangDescription}
                  onChange={e => setGangDescription(e.target.value)}
                  placeholder="Tell us about your gang..."
                  rows={3}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-white/10 focus:border-purple-500/50 outline-none resize-none"
                />
              </div>
              <button
                onClick={createGang}
                disabled={loading || !gangName.trim() || !gangTag.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Gang (Requires Admin Approval)'}
              </button>
            </div>
          )}

          {tab === 'my-gang' && myGang && (
            <div className="space-y-6">
              {/* Gang info */}
              <div className="p-6 rounded-xl bg-gray-800/50 border border-white/5">
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center font-black text-xl text-white"
                    style={{ backgroundColor: myGang.color }}
                  >
                    {myGang.tag}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {myGang.name}
                      {!myGang.is_approved && (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-400 text-sm">{myGang.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="text-2xl font-bold text-white">{myGang.member_count}</div>
                    <div className="text-xs text-gray-500">Members</div>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">{myGang.reputation}</div>
                    <div className="text-xs text-gray-500">Reputation</div>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">${myGang.treasury.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Treasury</div>
                  </div>
                </div>
              </div>

              {/* Members list */}
              <div>
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Members
                </h4>
                <div className="space-y-2">
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        {member.is_leader && <Crown className="w-4 h-4 text-yellow-400" />}
                        <span className="text-white">{member.name}</span>
                        {member.id === characterId && (
                          <span className="text-xs text-cyan-400">(You)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          <Swords className="w-3 h-3 inline mr-1" />
                          {member.kills} kills
                        </span>
                        {myGang.leader_id === characterId && member.id !== characterId && (
                          <button
                            onClick={() => kickMember(member.id, member.name)}
                            className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave gang button */}
              {myGang.leader_id !== characterId && (
                <button
                  onClick={leaveGang}
                  className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                >
                  Leave Gang
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
