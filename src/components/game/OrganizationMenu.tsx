import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Users, Crown, Shield, Skull, Building2, UserPlus, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface OrganizationMenuProps {
  character: any;
  onClose: () => void;
  onCharacterUpdate: () => void;
}

type OrgType = 'gang' | 'business' | 'police_department' | 'hospital';

const ORG_TYPE_INFO: Record<OrgType, { icon: typeof Skull; label: string; description: string }> = {
  gang: { icon: Skull, label: 'Gang', description: 'Criminal organization for heists and territory control' },
  business: { icon: Building2, label: 'Business', description: 'Legal company for trading and services' },
  police_department: { icon: Shield, label: 'Police Dept', description: 'Law enforcement faction' },
  hospital: { icon: Building2, label: 'Hospital', description: 'Medical faction for healing players' },
};

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'
];

export default function OrganizationMenu({ character, onClose, onCharacterUpdate }: OrganizationMenuProps) {
  const [view, setView] = useState<'main' | 'create' | 'manage' | 'browse'>('main');
  const [myOrg, setMyOrg] = useState<any>(null);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<OrgType>('gang');
  const [newColor, setNewColor] = useState('#ef4444');

  // Invite state
  const [inviteTarget, setInviteTarget] = useState('');

  useEffect(() => {
    fetchOrganizationData();
  }, [character.id]);

  const fetchOrganizationData = async () => {
    try {
      // Check if player is in an organization
      const { data: membership } = await supabase
        .from('game_org_members')
        .select('*, organization:game_organizations(*)')
        .eq('character_id', character.id)
        .maybeSingle();

      if (membership) {
        setMyMembership(membership);
        setMyOrg(membership.organization);

        // Fetch all members of this org
        const { data: members } = await supabase
          .from('game_org_members')
          .select('*, character:game_characters(id, name, current_job, is_online)')
          .eq('organization_id', membership.organization_id);

        setOrgMembers(members || []);
      }

      // Fetch all organizations for browsing
      const { data: orgs } = await supabase
        .from('game_organizations')
        .select('*, members:game_org_members(count)')
        .order('reputation', { ascending: false });

      setAllOrgs(orgs || []);
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newName.trim()) {
      toast.error('Enter an organization name');
      return;
    }

    if (newName.length < 3 || newName.length > 20) {
      toast.error('Name must be 3-20 characters');
      return;
    }

    // Check if player has enough money (cost: $5000)
    const creationCost = 5000;
    if (character.bank_balance < creationCost) {
      toast.error(`You need $${creationCost.toLocaleString()} in bank to create an organization`);
      return;
    }

    try {
      // Deduct money
      const { error: moneyError } = await supabase
        .from('game_characters')
        .update({ bank_balance: character.bank_balance - creationCost })
        .eq('id', character.id);

      if (moneyError) throw moneyError;

      // Create organization
      const { data: newOrg, error: orgError } = await supabase
        .from('game_organizations')
        .insert({
          name: newName.trim(),
          org_type: newType as 'gang' | 'business' | 'hospital' | 'police_department',
          color: newColor,
          leader_id: character.id,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as leader member
      const { error: memberError } = await supabase
        .from('game_org_members')
        .insert({
          character_id: character.id,
          organization_id: newOrg.id,
          role: 'leader',
        });

      if (memberError) throw memberError;

      toast.success(`${newName} has been created!`);
      onCharacterUpdate();
      fetchOrganizationData();
      setView('main');
    } catch (error) {
      console.error('Error creating org:', error);
      toast.error('Failed to create organization');
    }
  };

  const handleLeaveOrg = async () => {
    if (!myMembership) return;

    // Leaders can't leave, they must disband
    if (myMembership.role === 'leader') {
      toast.error('Leaders must disband the organization to leave');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_org_members')
        .delete()
        .eq('id', myMembership.id);

      if (error) throw error;

      toast.success('You left the organization');
      setMyOrg(null);
      setMyMembership(null);
      fetchOrganizationData();
    } catch (error) {
      toast.error('Failed to leave organization');
    }
  };

  const handleDisbandOrg = async () => {
    if (!myOrg || myMembership?.role !== 'leader') return;

    try {
      // Delete all members first
      await supabase
        .from('game_org_members')
        .delete()
        .eq('organization_id', myOrg.id);

      // Delete organization
      const { error } = await supabase
        .from('game_organizations')
        .delete()
        .eq('id', myOrg.id);

      if (error) throw error;

      toast.success('Organization disbanded');
      setMyOrg(null);
      setMyMembership(null);
      fetchOrganizationData();
      setView('main');
    } catch (error) {
      toast.error('Failed to disband organization');
    }
  };

  const handleInvitePlayer = async () => {
    if (!inviteTarget.trim() || !myOrg) return;

    try {
      // Find character by name
      const { data: targetChar } = await supabase
        .from('game_characters')
        .select('id, name')
        .ilike('name', inviteTarget.trim())
        .maybeSingle();

      if (!targetChar) {
        toast.error('Player not found');
        return;
      }

      if (targetChar.id === character.id) {
        toast.error("You can't invite yourself");
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('game_org_members')
        .select('id')
        .eq('character_id', targetChar.id)
        .eq('organization_id', myOrg.id)
        .maybeSingle();

      if (existing) {
        toast.error('Player is already a member');
        return;
      }

      // Add as member
      const { error } = await supabase
        .from('game_org_members')
        .insert({
          character_id: targetChar.id,
          organization_id: myOrg.id,
          role: 'member',
        });

      if (error) throw error;

      toast.success(`${targetChar.name} has been added!`);
      setInviteTarget('');
      fetchOrganizationData();
    } catch (error) {
      toast.error('Failed to invite player');
    }
  };

  const handleJoinOrg = async (orgId: string) => {
    if (myOrg) {
      toast.error('You must leave your current organization first');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_org_members')
        .insert({
          character_id: character.id,
          organization_id: orgId,
          role: 'member',
        });

      if (error) throw error;

      toast.success('You joined the organization!');
      fetchOrganizationData();
      setView('main');
    } catch (error) {
      toast.error('Failed to join organization');
    }
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (myMembership?.role !== 'leader') return;

    try {
      const { error } = await supabase
        .from('game_org_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${memberName} has been kicked`);
      fetchOrganizationData();
    } catch (error) {
      toast.error('Failed to kick member');
    }
  };

  const handlePromoteMember = async (memberId: string, memberName: string) => {
    if (myMembership?.role !== 'leader') return;

    try {
      const { error } = await supabase
        .from('game_org_members')
        .update({ role: 'officer' })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${memberName} promoted to Officer`);
      fetchOrganizationData();
    } catch (error) {
      toast.error('Failed to promote member');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card p-8 rounded-xl">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Organizations
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Main View */}
        {view === 'main' && (
          <div className="space-y-4">
            {myOrg ? (
              <div 
                className="p-4 rounded-lg border-2"
                style={{ borderColor: myOrg.color }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: myOrg.color }}
                    >
                      {ORG_TYPE_INFO[myOrg.org_type as OrgType]?.icon && (
                        <span className="text-white">
                          {(() => {
                            const Icon = ORG_TYPE_INFO[myOrg.org_type as OrgType].icon;
                            return <Icon className="w-5 h-5" />;
                          })()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold">{myOrg.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {myOrg.org_type} • {orgMembers.length} members
                      </p>
                    </div>
                  </div>
                  {myMembership?.role === 'leader' && (
                    <Crown className="w-5 h-5 text-yellow-500" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-secondary/50 rounded p-2 text-center">
                    <p className="text-lg font-bold text-green-500">${myOrg.treasury.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Treasury</p>
                  </div>
                  <div className="bg-secondary/50 rounded p-2 text-center">
                    <p className="text-lg font-bold text-primary">{myOrg.reputation}</p>
                    <p className="text-xs text-muted-foreground">Reputation</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => setView('manage')}
                  >
                    Manage
                  </Button>
                  {myMembership?.role === 'leader' ? (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleDisbandOrg}
                    >
                      Disband
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleLeaveOrg}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-secondary/30 rounded-lg">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground mb-4">You're not in an organization</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setView('create')}>Create One</Button>
                  <Button variant="outline" onClick={() => setView('browse')}>Browse</Button>
                </div>
              </div>
            )}

            {!myOrg && allOrgs.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Top Organizations</h3>
                {allOrgs.slice(0, 3).map(org => (
                  <div 
                    key={org.id}
                    className="p-3 rounded-lg border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: org.color }}
                      />
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{org.org_type}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleJoinOrg(org.id)}>
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create View */}
        {view === 'create' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView('main')}>
              ← Back
            </Button>

            <div className="space-y-3">
              <div>
                <Label>Organization Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter name..."
                  maxLength={20}
                />
              </div>

              <div>
                <Label>Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {Object.entries(ORG_TYPE_INFO).map(([type, info]) => {
                    const Icon = info.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setNewType(type as OrgType)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          newType === type 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-xs font-medium">{info.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  Creation cost: <span className="text-yellow-500 font-bold">$5,000</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your balance: ${character.bank_balance.toLocaleString()}
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={handleCreateOrg}
                disabled={character.bank_balance < 5000}
              >
                Create Organization
              </Button>
            </div>
          </div>
        )}

        {/* Manage View */}
        {view === 'manage' && myOrg && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView('main')}>
              ← Back
            </Button>

            {/* Invite Section */}
            {(myMembership?.role === 'leader' || myMembership?.role === 'officer') && (
              <div className="space-y-2">
                <Label>Invite Player</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteTarget}
                    onChange={(e) => setInviteTarget(e.target.value)}
                    placeholder="Character name..."
                  />
                  <Button onClick={handleInvitePlayer}>
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="space-y-2">
              <Label>Members ({orgMembers.length})</Label>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {orgMembers.map(member => (
                  <div 
                    key={member.id}
                    className="p-2 rounded-lg bg-secondary/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${member.character?.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div>
                        <p className="font-medium text-sm">{member.character?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {member.role} • {member.character?.current_job?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    
                    {myMembership?.role === 'leader' && member.character?.id !== character.id && (
                      <div className="flex gap-1">
                        {member.role === 'member' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handlePromoteMember(member.id, member.character?.name)}
                          >
                            <Crown className="w-3 h-3" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleKickMember(member.id, member.character?.name)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Browse View */}
        {view === 'browse' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView('main')}>
              ← Back
            </Button>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allOrgs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No organizations yet</p>
              ) : (
                allOrgs.map(org => (
                  <div 
                    key={org.id}
                    className="p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: org.color }}
                        >
                          {ORG_TYPE_INFO[org.org_type as OrgType]?.icon && (
                            <span className="text-white">
                              {(() => {
                                const Icon = ORG_TYPE_INFO[org.org_type as OrgType].icon;
                                return <Icon className="w-5 h-5" />;
                              })()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {org.org_type} • Rep: {org.reputation}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleJoinOrg(org.id)}>
                        Join
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
