import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, BadgeCheck, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import VerifiedBadge from '@/components/VerifiedBadge';

interface WalletUser {
  id: string;
  user_id: string;
  username: string;
  is_verified: boolean;
  balance: number;
  total_mined: number;
  created_at: string;
}

export default function AdminVerifyUsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Failed to fetch users', variant: 'destructive' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('wallets')
      .update({ is_verified: !currentStatus })
      .eq('id', userId);

    if (error) {
      toast({ title: 'Failed to update verification', variant: 'destructive' });
    } else {
      toast({ 
        title: currentStatus ? 'Verification removed' : 'User verified!',
        description: currentStatus 
          ? 'Blue tick badge has been removed' 
          : 'User now has the verified CF badge'
      });
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const verifiedUsers = filteredUsers.filter(u => u.is_verified);
  const unverifiedUsers = filteredUsers.filter(u => !u.is_verified);

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Verify Users
            <VerifiedBadge size="lg" showTooltip={false} />
          </h2>
          <p className="text-muted-foreground">Award verified badges to trusted members</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {verifiedUsers.length} verified users
        </div>
      </div>

      {/* Badge Preview */}
      <div className="mb-6 p-4 bg-secondary/30 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground mb-3">Badge Preview:</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm">Small:</span>
            <span className="font-semibold">@username</span>
            <VerifiedBadge size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Medium:</span>
            <span className="font-semibold">@username</span>
            <VerifiedBadge size="md" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Large:</span>
            <span className="font-semibold">@username</span>
            <VerifiedBadge size="lg" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users by username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[500px]">
        {/* Verified Users Section */}
        {verifiedUsers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              Verified Members ({verifiedUsers.length})
            </h3>
            <div className="space-y-2">
              {verifiedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">@{user.username}</span>
                    <VerifiedBadge size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {user.balance.toLocaleString()} tokens
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => toggleVerification(user.id, user.is_verified)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unverified Users Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            All Users ({unverifiedUsers.length})
          </h3>
          <div className="space-y-2">
            {unverifiedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-secondary/30 border border-border rounded-lg hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold">@{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.balance.toLocaleString()} tokens • Mined: {user.total_mined.toLocaleString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  onClick={() => toggleVerification(user.id, user.is_verified)}
                >
                  <BadgeCheck className="w-4 h-4 mr-1" />
                  Verify
                </Button>
              </div>
            ))}
          </div>
        </div>

        {filteredUsers.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? 'No users found matching your search' : 'No users yet'}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
