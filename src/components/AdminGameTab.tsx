import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, Users, DollarSign, AlertTriangle, CheckCircle, 
  XCircle, Clock, Ban, Search, Skull, Car, Home 
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminGameTab() {
  const [applications, setApplications] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [crimeLogs, setCrimeLogs] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banReason, setBanReason] = useState('');
  const [banCharacterId, setBanCharacterId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [appsRes, transRes, crimeRes, bansRes, charsRes] = await Promise.all([
      supabase.from('game_police_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('game_transactions').select('*, game_characters(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('game_crime_logs').select('*, criminal:criminal_id(name), victim:victim_id(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('game_bans').select('*').eq('is_active', true).order('banned_at', { ascending: false }),
      supabase.from('game_characters').select('id, name, user_id, current_job, wanted_level, cash, bank_balance').order('name')
    ]);

    setApplications(appsRes.data || []);
    setTransactions(transRes.data || []);
    setCrimeLogs(crimeRes.data || []);
    setBans(bansRes.data || []);
    setCharacters(charsRes.data || []);
    setLoading(false);
  };

  const handleApplicationDecision = async (appId: string, status: 'approved' | 'rejected', notes: string, characterId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('game_police_applications')
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', appId);

    if (error) {
      toast.error('Failed to update application');
      return;
    }

    if (status === 'approved') {
      await supabase
        .from('game_characters')
        .update({ current_job: 'police', job_experience: 0 })
        .eq('id', characterId);
    }

    toast.success(`Application ${status}!`);
    fetchData();
  };

  const handleBan = async (characterId: string, userId: string, reason: string, ruleViolated: string, permanent: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('game_bans').insert({
      character_id: characterId,
      user_id: userId,
      reason,
      rule_violated: ruleViolated,
      banned_by: user?.id,
      is_permanent: permanent,
      expires_at: permanent ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    if (error) {
      toast.error('Failed to ban user');
      return;
    }

    toast.success('User banned successfully');
    setBanReason('');
    setBanCharacterId('');
    fetchData();
  };

  const handleUnban = async (banId: string) => {
    const { error } = await supabase
      .from('game_bans')
      .update({ is_active: false })
      .eq('id', banId);

    if (error) {
      toast.error('Failed to unban');
      return;
    }

    toast.success('User unbanned');
    fetchData();
  };

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingApps = applications.filter(a => a.status === 'pending');

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading game data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{characters.length}</p>
                <p className="text-xs text-muted-foreground">Characters</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{pendingApps.length}</p>
                <p className="text-xs text-muted-foreground">Pending Apps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{crimeLogs.length}</p>
                <p className="text-xs text-muted-foreground">Crime Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{bans.length}</p>
                <p className="text-xs text-muted-foreground">Active Bans</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="applications">
            Police Apps {pendingApps.length > 0 && <Badge variant="destructive" className="ml-1">{pendingApps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="crimes">Crime Logs</TabsTrigger>
          <TabsTrigger value="bans">Ban Manager</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>

        {/* Police Applications */}
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" /> Police Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {applications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No applications</p>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => (
                      <div key={app.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{app.character_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(app.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={
                            app.status === 'pending' ? 'secondary' :
                            app.status === 'approved' ? 'default' : 'destructive'
                          }>
                            {app.status}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{app.reason}</p>
                        {app.experience && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Experience: {app.experience}
                          </p>
                        )}
                        {app.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => handleApplicationDecision(app.id, 'approved', '', app.character_id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplicationDecision(app.id, 'rejected', 'Application rejected', app.character_id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" /> Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium">{tx.game_characters?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.transaction_type} • {tx.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crime Logs */}
        <TabsContent value="crimes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Skull className="w-5 h-5" /> Crime Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {crimeLogs.map((crime) => (
                    <div key={crime.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <span className="text-destructive">{crime.criminal?.name || 'Unknown'}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{crime.victim?.name || 'N/A'}</span>
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {crime.crime_type}
                          {crime.amount_stolen > 0 && ` • $${crime.amount_stolen.toLocaleString()} stolen`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">+{crime.wanted_level_added || 0} ⭐</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(crime.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ban Manager */}
        <TabsContent value="bans">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" /> Ban Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {/* Issue Ban */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium">Issue New Ban</h4>
                  <Input
                    placeholder="Search character name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filteredCharacters.slice(0, 5).map(c => (
                        <Button
                          key={c.id}
                          variant={banCharacterId === c.id ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setBanCharacterId(c.id)}
                        >
                          {c.name} ({c.current_job})
                        </Button>
                      ))}
                    </div>
                  )}
                  <Textarea
                    placeholder="Ban reason..."
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      disabled={!banCharacterId || !banReason}
                      onClick={() => {
                        const char = characters.find(c => c.id === banCharacterId);
                        if (char) handleBan(char.id, char.user_id, banReason, 'rule_violation', false);
                      }}
                    >
                      7-Day Ban
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!banCharacterId || !banReason}
                      onClick={() => {
                        const char = characters.find(c => c.id === banCharacterId);
                        if (char) handleBan(char.id, char.user_id, banReason, 'severe_violation', true);
                      }}
                    >
                      Permanent Ban
                    </Button>
                  </div>
                </div>

                {/* Active Bans */}
                <div>
                  <h4 className="font-medium mb-3">Active Bans ({bans.length})</h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {bans.map((ban) => {
                        const char = characters.find(c => c.id === ban.character_id);
                        return (
                          <div key={ban.id} className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                            <div>
                              <p className="font-medium">{char?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{ban.reason}</p>
                              <p className="text-xs text-destructive">
                                {ban.is_permanent ? 'Permanent' : `Expires: ${new Date(ban.expires_at).toLocaleDateString()}`}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleUnban(ban.id)}>
                              Unban
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Players */}
        <TabsContent value="players">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" /> All Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
              />
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredCharacters.map((char) => (
                    <div key={char.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium">{char.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {char.current_job.replace('_', ' ')}
                          {char.wanted_level > 0 && (
                            <span className="text-destructive ml-2">⭐ Wanted Lv.{char.wanted_level}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-success">
                          ${(char.cash + char.bank_balance).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total wealth</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
