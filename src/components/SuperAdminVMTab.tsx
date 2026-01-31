import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  Users, 
  Terminal, 
  Search,
  UserCheck,
  UserX,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminPermission {
  id: string;
  admin_user_id: string;
  can_use_vm: boolean;
  granted_by: string | null;
  granted_at: string | null;
  username?: string;
  email?: string;
}

export default function SuperAdminVMTab() {
  const [admins, setAdmins] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAdminPermissions();
  }, []);

  const fetchAdminPermissions = async () => {
    setLoading(true);
    try {
      // Get all admins from user_roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Get profiles for these admins
      const adminIds = adminRoles?.map(r => r.user_id) || [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', adminIds);

      // Get wallets for usernames
      const { data: wallets } = await supabase
        .from('wallets')
        .select('user_id, username')
        .in('user_id', adminIds);

      // Get existing VM permissions
      const { data: permissions } = await supabase
        .from('admin_vm_permissions')
        .select('*');

      // Combine data
      const combinedAdmins: AdminPermission[] = adminIds.map(userId => {
        const profile = profiles?.find(p => p.user_id === userId);
        const wallet = wallets?.find(w => w.user_id === userId);
        const permission = permissions?.find(p => p.admin_user_id === userId);

        return {
          id: permission?.id || '',
          admin_user_id: userId,
          can_use_vm: permission?.can_use_vm || false,
          granted_by: permission?.granted_by || null,
          granted_at: permission?.granted_at || null,
          username: wallet?.username || 'Unknown',
          email: profile?.email || 'Unknown'
        };
      });

      setAdmins(combinedAdmins);
    } catch (error) {
      console.error('Error fetching admin permissions:', error);
      toast.error('Failed to load admin permissions');
    } finally {
      setLoading(false);
    }
  };

  const toggleVMAccess = async (adminUserId: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if permission exists
      const { data: existing } = await supabase
        .from('admin_vm_permissions')
        .select('id')
        .eq('admin_user_id', adminUserId)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from('admin_vm_permissions')
          .update({
            can_use_vm: !currentStatus,
            granted_by: user?.id,
            granted_at: !currentStatus ? new Date().toISOString() : null,
            revoked_at: currentStatus ? new Date().toISOString() : null
          })
          .eq('admin_user_id', adminUserId);
      } else {
        // Create new
        await supabase
          .from('admin_vm_permissions')
          .insert({
            admin_user_id: adminUserId,
            can_use_vm: true,
            granted_by: user?.id,
            granted_at: new Date().toISOString()
          });
      }

      // Update local state
      setAdmins(prev => prev.map(admin => 
        admin.admin_user_id === adminUserId 
          ? { ...admin, can_use_vm: !currentStatus }
          : admin
      ));

      toast.success(`VM access ${!currentStatus ? 'granted' : 'revoked'}`);
    } catch (error) {
      console.error('Error toggling VM access:', error);
      toast.error('Failed to update VM access');
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Super Admin Controls</h2>
            <p className="text-sm text-gray-400">Manage which admins can access the VM Terminal</p>
          </div>
        </div>
        <Button 
          onClick={fetchAdminPermissions}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search admins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-800/50 border-white/10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{admins.length}</p>
              <p className="text-xs text-gray-400">Total Admins</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">{admins.filter(a => a.can_use_vm).length}</p>
              <p className="text-xs text-gray-400">VM Access</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <UserX className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-white">{admins.filter(a => !a.can_use_vm).length}</p>
              <p className="text-xs text-gray-400">No Access</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin List */}
      <div className="bg-gray-800/30 rounded-xl border border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Admin VM Permissions
          </h3>
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading admins...</div>
            ) : filteredAdmins.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No admins found</div>
            ) : (
              filteredAdmins.map((admin) => (
                <div 
                  key={admin.admin_user_id}
                  className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      admin.can_use_vm 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {admin.can_use_vm ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">@{admin.username}</p>
                      <p className="text-xs text-gray-400">{admin.email}</p>
                      {admin.granted_at && admin.can_use_vm && (
                        <p className="text-xs text-green-400 mt-1">
                          Access granted: {new Date(admin.granted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${admin.can_use_vm ? 'text-green-400' : 'text-gray-500'}`}>
                      {admin.can_use_vm ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={admin.can_use_vm}
                      onCheckedChange={() => toggleVMAccess(admin.admin_user_id, admin.can_use_vm)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
