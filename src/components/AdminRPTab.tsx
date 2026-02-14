import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, Skull, DollarSign, Shield, CheckCircle, XCircle, 
  Ban, Eye, Clock, Star, AlertTriangle, Coins, Gamepad2
} from 'lucide-react';

interface GangApplication {
  id: string;
  character_id: string;
  gang_id: string;
  message: string;
  status: string;
  created_at: string;
  character?: { name: string; user_id: string };
  gang?: { name: string; tag: string };
}

interface CreditExchange {
  id: string;
  character_id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
  description: string;
}

interface GameCharacter {
  id: string;
  name: string;
  user_id: string;
  cash: number;
  bank_balance: number;
  health: number;
  wanted_level: number;
  is_online: boolean;
  is_in_jail: boolean;
  current_job: string;
  kills: number;
  deaths: number;
  created_at: string;
}

interface GameBan {
  id: string;
  user_id: string;
  character_id: string;
  reason: string;
  is_permanent: boolean;
  is_active: boolean;
  expires_at: string | null;
  banned_at: string;
  character?: { name: string };
}

export default function AdminRPTab() {
  const [gangApplications, setGangApplications] = useState<GangApplication[]>([]);
  const [creditExchanges, setCreditExchanges] = useState<CreditExchange[]>([]);
  const [characters, setCharacters] = useState<GameCharacter[]>([]);
  const [bans, setBans] = useState<GameBan[]>([]);
  const [stats, setStats] = useState({
    totalPlayers: 0,
    onlinePlayers: 0,
    totalCash: 0,
    totalBanned: 0,
    pendingApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch gang applications
      const { data: apps } = await supabase
        .from('game_gang_applications')
        .select('*, character:game_characters(name, user_id), gang:game_gangs(name, tag)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setGangApplications((apps as GangApplication[]) || []);

      // Fetch recent credit exchanges
      const { data: exchanges } = await supabase
        .from('game_transactions')
        .select('*')
        .eq('transaction_type', 'credit_exchange')
        .order('created_at', { ascending: false })
        .limit(50);
      setCreditExchanges((exchanges as CreditExchange[]) || []);

      // Fetch all characters
      const { data: chars } = await supabase
        .from('game_characters')
        .select('*')
        .order('created_at', { ascending: false });
      setCharacters((chars as GameCharacter[]) || []);

      // Fetch active bans
      const { data: banData } = await supabase
        .from('game_bans')
        .select('*, character:game_characters(name)')
        .eq('is_active', true)
        .order('banned_at', { ascending: false });
      setBans((banData as GameBan[]) || []);

      // Calculate stats
      if (chars) {
        setStats({
          totalPlayers: chars.length,
          onlinePlayers: chars.filter((c: GameCharacter) => c.is_online).length,
          totalCash: chars.reduce((sum: number, c: GameCharacter) => sum + c.cash + c.bank_balance, 0),
          totalBanned: banData?.length || 0,
          pendingApplications: apps?.length || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching RP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGangApplication = async (appId: string, approved: boolean) => {
    const app = gangApplications.find(a => a.id === appId);
    if (!app) return;

    try {
      await supabase
        .from('game_gang_applications')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', appId);

      if (approved) {
        // Add character to gang
        await supabase
          .from('game_characters')
          .update({ gang_id: app.gang_id })
          .eq('id', app.character_id);

        // Update gang member count
        const { data: gangData } = await supabase
          .from('game_gangs')
          .select('member_count')
          .eq('id', app.gang_id)
          .single();
        
        if (gangData) {
          await supabase
            .from('game_gangs')
            .update({ member_count: (gangData.member_count || 0) + 1 })
            .eq('id', app.gang_id);
        }
      }

      toast.success(approved ? 'Gang application approved!' : 'Gang application rejected');
      fetchData();
    } catch (error) {
      toast.error('Failed to process application');
    }
  };

  const handleBanPlayer = async (characterId: string, userId: string, reason: string, isPermanent: boolean) => {
    try {
      await supabase.from('game_bans').insert({
        user_id: userId,
        character_id: characterId,
        reason,
        is_permanent: isPermanent,
        banned_by: (await supabase.auth.getUser()).data.user?.id,
        expires_at: isPermanent ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      toast.success('Player banned successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to ban player');
    }
  };

  const handleUnbanPlayer = async (banId: string) => {
    try {
      await supabase
        .from('game_bans')
        .update({ is_active: false })
        .eq('id', banId);

      toast.success('Player unbanned');
      fetchData();
    } catch (error) {
      toast.error('Failed to unban player');
    }
  };

  const handleAdjustCash = async (characterId: string, amount: number) => {
    try {
      const char = characters.find(c => c.id === characterId);
      if (!char) return;

      await supabase
        .from('game_characters')
        .update({ cash: char.cash + amount })
        .eq('id', characterId);

      toast.success(`Adjusted cash by $${amount.toLocaleString()}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to adjust cash');
    }
  };

  const handleResetAllCharacters = async () => {
    if (!window.confirm('⚠️ RESET ALL CHARACTERS?\n\nThis will delete ALL game characters. Every player will need to create a new character.\n\nThis cannot be undone!')) return;
    if (!window.confirm('Are you ABSOLUTELY sure? Type OK to confirm.')) return;

    try {
      const { error } = await supabase.from('game_characters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('All game characters have been reset! Players will create new characters on next login.');
      fetchData();
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset characters');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Actions */}
      <Card className="glass-card border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Game Management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button 
            variant="destructive" 
            onClick={handleResetAllCharacters}
            className="bg-red-600 hover:bg-red-700"
          >
            <Gamepad2 className="w-4 h-4 mr-2" />
            Reset All Characters (New Update)
          </Button>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-400" />
            <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            <div className="text-xs text-muted-foreground">Total Players</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.onlinePlayers}</div>
            <div className="text-xs text-muted-foreground">Online Now</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <div className="text-2xl font-bold">${(stats.totalCash / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-muted-foreground">Economy</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Ban className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <div className="text-2xl font-bold text-red-400">{stats.totalBanned}</div>
            <div className="text-xs text-muted-foreground">Banned</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
            <div className="text-2xl font-bold text-yellow-400">{stats.pendingApplications}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="applications" className="gap-2">
            <Skull className="w-4 h-4" /> Gang Apps
            {gangApplications.length > 0 && (
              <Badge variant="destructive" className="ml-1">{gangApplications.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="players" className="gap-2">
            <Users className="w-4 h-4" /> Players
          </TabsTrigger>
          <TabsTrigger value="economy" className="gap-2">
            <Coins className="w-4 h-4" /> Economy
          </TabsTrigger>
          <TabsTrigger value="bans" className="gap-2">
            <Ban className="w-4 h-4" /> Bans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Skull className="w-5 h-5" />
                Pending Gang Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gangApplications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending gang applications
                </div>
              ) : (
                <div className="space-y-4">
                  {gangApplications.map(app => (
                    <div key={app.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="font-bold">{app.character?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Applying to: <span className="text-primary">[{app.gang?.tag}] {app.gang?.name}</span>
                        </div>
                        {app.message && (
                          <div className="text-sm mt-1 italic">"{app.message}"</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500"
                          onClick={() => handleGangApplication(app.id, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500"
                          onClick={() => handleGangApplication(app.id, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                All Players ({characters.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Cash</th>
                      <th className="text-left p-2">Job</th>
                      <th className="text-left p-2">Wanted</th>
                      <th className="text-left p-2">K/D</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {characters.slice(0, 20).map(char => (
                      <tr key={char.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{char.name}</td>
                        <td className="p-2 text-green-400">${char.cash.toLocaleString()}</td>
                        <td className="p-2 capitalize">{char.current_job}</td>
                        <td className="p-2">
                          {Array(char.wanted_level).fill('⭐').join('')}
                          {char.wanted_level === 0 && '-'}
                        </td>
                        <td className="p-2">{char.kills || 0}/{char.deaths || 0}</td>
                        <td className="p-2">
                          {char.is_online ? (
                            <Badge className="bg-green-500">Online</Badge>
                          ) : char.is_in_jail ? (
                            <Badge className="bg-orange-500">Jail</Badge>
                          ) : (
                            <Badge variant="outline">Offline</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleAdjustCash(char.id, 1000)}>
                              +$1K
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleBanPlayer(char.id, char.user_id, 'Admin action', false)}>
                              Ban
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="economy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                CF Credits Exchanges
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditExchanges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No credit exchanges yet
                </div>
              ) : (
                <div className="space-y-2">
                  {creditExchanges.map(exchange => (
                    <div key={exchange.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{exchange.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(exchange.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-green-400 font-bold">
                        +${exchange.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Active Bans ({bans.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active bans
                </div>
              ) : (
                <div className="space-y-3">
                  {bans.map(ban => (
                    <div key={ban.id} className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div>
                        <div className="font-bold text-red-400">{ban.character?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">Reason: {ban.reason}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          Banned: {new Date(ban.banned_at).toLocaleDateString()}
                          {ban.is_permanent ? (
                            <Badge variant="destructive">Permanent</Badge>
                          ) : ban.expires_at && (
                            <span>Expires: {new Date(ban.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500 border-green-500"
                        onClick={() => handleUnbanPlayer(ban.id)}
                      >
                        Unban
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
