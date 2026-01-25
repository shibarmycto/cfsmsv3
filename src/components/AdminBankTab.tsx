import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import VerifiedBadge from '@/components/VerifiedBadge';
import {
  Coins,
  Search,
  Check,
  X,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Pickaxe,
  DollarSign,
  Users,
  ClipboardList,
  Globe,
  Bitcoin,
  Youtube,
} from 'lucide-react';

interface Wallet {
  id: string;
  user_id: string;
  username: string;
  balance: number;
  is_miner_approved: boolean;
  is_verified: boolean;
  total_mined: number;
  total_sent: number;
  total_received: number;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  withdrawal_type: string;
  wallet_address: string;
  status: string;
  created_at: string;
}

interface MinerRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

interface WalletTransaction {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  transaction_type: string;
  status: string;
  description: string | null;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

interface LargeTransactionApproval {
  id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface MiningTaskLog {
  id: string;
  user_id: string;
  wallet_id: string;
  task_type: string;
  task_details: Record<string, unknown>;
  completed_at: string;
  tokens_awarded: number;
}

const COIN_RATE = 0.10;

export default function AdminBankTab() {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'wallets' | 'withdrawals' | 'miners' | 'transactions' | 'large-approvals' | 'task-logs'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [minerRequests, setMinerRequests] = useState<MinerRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [largeApprovals, setLargeApprovals] = useState<LargeTransactionApproval[]>([]);
  const [walletMap, setWalletMap] = useState<Map<string, string>>(new Map());
  const [miningTaskLogs, setMiningTaskLogs] = useState<MiningTaskLog[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch wallets
    const { data: walletsData } = await supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: false });
    if (walletsData) {
      setWallets(walletsData);
      const map = new Map(walletsData.map(w => [w.id, w.username]));
      setWalletMap(map);
    }

    // Fetch withdrawal requests
    const { data: withdrawalsData } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (withdrawalsData) setWithdrawalRequests(withdrawalsData);

    // Fetch miner requests
    const { data: minersData } = await supabase
      .from('miner_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (minersData) setMinerRequests(minersData);

    // Fetch recent transactions
    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (txData) setTransactions(txData);

    // Fetch large transaction approvals
    const { data: approvalsData } = await supabase
      .from('large_transaction_approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (approvalsData) setLargeApprovals(approvalsData);

    // Fetch mining task logs
    const { data: taskLogsData } = await supabase
      .from('mining_task_logs')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(200);
    if (taskLogsData) setMiningTaskLogs(taskLogsData as MiningTaskLog[]);
  };

  const handleMinerRequest = async (requestId: string, userId: string, approved: boolean) => {
    const { error: requestError } = await supabase
      .from('miner_requests')
      .update({ 
        status: approved ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (approved && !requestError) {
      await supabase
        .from('wallets')
        .update({ is_miner_approved: true })
        .eq('user_id', userId);
    }

    toast({ 
      title: approved ? 'Miner Approved' : 'Miner Rejected',
      description: approved ? 'User can now mine tokens' : 'Request has been rejected'
    });
    fetchData();
  };

  const handleWithdrawalRequest = async (requestId: string, approved: boolean) => {
    const withdrawal = withdrawalRequests.find(w => w.id === requestId);
    if (!withdrawal) return;

    if (approved) {
      // Deduct from wallet balance
      const wallet = wallets.find(w => w.id === withdrawal.wallet_id);
      if (!wallet || wallet.balance < withdrawal.amount) {
        toast({ title: 'Error', description: 'Insufficient balance', variant: 'destructive' });
        return;
      }

      await supabase
        .from('wallets')
        .update({ balance: wallet.balance - withdrawal.amount })
        .eq('id', withdrawal.wallet_id);

      // Create transaction record
      await supabase
        .from('wallet_transactions')
        .insert({
          from_wallet_id: withdrawal.wallet_id,
          amount: withdrawal.amount,
          transaction_type: 'withdrawal',
          status: 'completed',
          description: `Withdrawal to ${withdrawal.withdrawal_type.toUpperCase()}: ${withdrawal.wallet_address}`
        });
    }

    await supabase
      .from('withdrawal_requests')
      .update({ 
        status: approved ? 'completed' : 'rejected',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    toast({ 
      title: approved ? 'Withdrawal Approved' : 'Withdrawal Rejected',
      description: approved ? 'Funds have been deducted from user wallet' : 'Request has been rejected'
    });
    fetchData();
  };

  const handleLargeApproval = async (approvalId: string, approved: boolean) => {
    await supabase
      .from('large_transaction_approvals')
      .update({ 
        status: approved ? 'approved' : 'rejected',
        approved_at: new Date().toISOString()
      })
      .eq('id', approvalId);

    toast({ 
      title: approved ? 'Transaction Approved' : 'Transaction Rejected',
      description: approved ? 'Large transaction has been approved' : 'Transaction has been blocked'
    });
    fetchData();
  };

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalMined = wallets.reduce((sum, w) => sum + w.total_mined, 0);
  const pendingWithdrawals = withdrawalRequests.filter(w => w.status === 'pending').length;
  const pendingMiners = minerRequests.filter(m => m.status === 'pending').length;

  const filteredWallets = wallets.filter(w => 
    w.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: Coins },
          { id: 'wallets', label: 'Wallets', icon: Users },
          { id: 'withdrawals', label: 'Withdrawals', icon: DollarSign, count: pendingWithdrawals },
          { id: 'miners', label: 'Miners', icon: Pickaxe, count: pendingMiners },
          { id: 'transactions', label: 'Transactions', icon: ArrowUpRight },
          { id: 'large-approvals', label: '2FA Approvals', icon: Check, count: largeApprovals.length },
          { id: 'task-logs', label: 'Task Logs', icon: ClipboardList, count: miningTaskLogs.filter(l => new Date(l.completed_at) > new Date(Date.now() - 3600000)).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeSubTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count && tab.count > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Supply</p>
                  <p className="text-xl font-bold">{totalBalance.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">≈ ${(totalBalance * COIN_RATE).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Pickaxe className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Mined</p>
                  <p className="text-xl font-bold">{totalMined.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Wallets</p>
                  <p className="text-xl font-bold">{wallets.length}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Actions</p>
                  <p className="text-xl font-bold">{pendingWithdrawals + pendingMiners + largeApprovals.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Recent Transactions</h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {transactions.slice(0, 20).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'transfer' ? 'bg-primary/10' :
                        tx.transaction_type === 'mining' ? 'bg-green-500/10' :
                        tx.transaction_type === 'withdrawal' ? 'bg-red-500/10' : 'bg-muted'
                      }`}>
                        {tx.transaction_type === 'transfer' && <ArrowUpRight className="w-4 h-4 text-primary" />}
                        {tx.transaction_type === 'mining' && <Pickaxe className="w-4 h-4 text-green-500" />}
                        {tx.transaction_type === 'withdrawal' && <ArrowDownLeft className="w-4 h-4 text-red-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {walletMap.get(tx.from_wallet_id || '') || 'System'} → {walletMap.get(tx.to_wallet_id || '') || 'System'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{tx.amount.toLocaleString()} CFSMS</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Wallets Tab */}
      {activeSubTab === 'wallets' && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">All Wallets</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username..."
                className="pl-10 w-64 bg-secondary/50"
              />
            </div>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredWallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-1">
                        @{wallet.username}
                        {wallet.is_verified && <VerifiedBadge size="sm" />}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Sent: {wallet.total_sent.toLocaleString()}</span>
                        <span>Received: {wallet.total_received.toLocaleString()}</span>
                        <span>Mined: {wallet.total_mined.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{wallet.balance.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">≈ ${(wallet.balance * COIN_RATE).toFixed(2)}</p>
                    {wallet.is_miner_approved && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Miner</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeSubTab === 'withdrawals' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Withdrawal Requests</h3>
          <ScrollArea className="h-[500px]">
            {withdrawalRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No withdrawal requests</p>
            ) : (
              <div className="space-y-3">
                {withdrawalRequests.map((req) => {
                  const wallet = wallets.find(w => w.id === req.wallet_id);
                  return (
                    <div key={req.id} className="p-4 rounded-lg bg-secondary/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{wallet?.username || 'Unknown'}</p>
                          <p className="text-lg font-bold">{req.amount.toLocaleString()} CFSMS</p>
                          <p className="text-sm text-muted-foreground">
                            → {req.withdrawal_type.toUpperCase()}: {req.wallet_address.slice(0, 20)}...
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(req.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === 'pending' ? (
                            <>
                              <Button size="sm" onClick={() => handleWithdrawalRequest(req.id, true)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleWithdrawalRequest(req.id, false)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              req.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {req.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Miners Tab */}
      {activeSubTab === 'miners' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Miner Requests</h3>
          <ScrollArea className="h-[500px]">
            {minerRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No miner requests</p>
            ) : (
              <div className="space-y-3">
                {minerRequests.map((req) => {
                  const wallet = wallets.find(w => w.user_id === req.user_id);
                  return (
                    <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                      <div>
                        <p className="font-medium">{wallet?.username || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' ? (
                          <>
                            <Button size="sm" onClick={() => handleMinerRequest(req.id, req.user_id, true)}>
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleMinerRequest(req.id, req.user_id, false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Transactions Tab */}
      {activeSubTab === 'transactions' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">All Transactions</h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {walletMap.get(tx.from_wallet_id || '') || 'System'} → {walletMap.get(tx.to_wallet_id || '') || 'System'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{tx.amount.toLocaleString()} CFSMS</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {(tx.ip_address || tx.device_info) && (
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      <p>IP: {tx.ip_address || 'N/A'}</p>
                      <p className="truncate">Device: {tx.device_info || 'N/A'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Large Transaction Approvals Tab */}
      {activeSubTab === 'large-approvals' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Large Transaction Approvals (2FA)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Transactions over 100,000 CFSMS require developer approval.
          </p>
          <ScrollArea className="h-[500px]">
            {largeApprovals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending approvals</p>
            ) : (
              <div className="space-y-3">
                {largeApprovals.map((approval) => (
                  <div key={approval.id} className="p-4 rounded-lg bg-secondary/30 border-2 border-yellow-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-yellow-400">⚠️ Large Transaction</p>
                        <p className="text-2xl font-bold">{approval.amount.toLocaleString()} CFSMS</p>
                        <p className="text-sm text-muted-foreground">
                          {walletMap.get(approval.from_wallet_id) || 'Unknown'} → {walletMap.get(approval.to_wallet_id) || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(approval.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleLargeApproval(approval.id, true)}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button variant="destructive" onClick={() => handleLargeApproval(approval.id, false)}>
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Mining Task Logs Tab */}
      {activeSubTab === 'task-logs' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Mining Task Logs</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Real-time log of all completed mining tasks (signup, FreeBitcoin rolls, YouTube watches).
          </p>
          <ScrollArea className="h-[500px]">
            {miningTaskLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No task logs yet</p>
            ) : (
              <div className="space-y-2">
                {miningTaskLogs.map((log) => {
                  const wallet = wallets.find(w => w.id === log.wallet_id);
                  const taskIcon = {
                    signup: <Globe className="w-4 h-4 text-primary" />,
                    freebitcoin: <Bitcoin className="w-4 h-4 text-orange-500" />,
                    youtube: <Youtube className="w-4 h-4 text-red-500" />,
                  }[log.task_type] || <Pickaxe className="w-4 h-4" />;
                  
                  const taskName = {
                    signup: 'Website Sign-up',
                    freebitcoin: 'FreeBitcoin Roll',
                    youtube: 'YouTube Watch',
                  }[log.task_type] || log.task_type;

                  return (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {taskIcon}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{taskName}</p>
                          <p className="text-xs text-muted-foreground">
                            @{wallet?.username || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.completed_at).toLocaleString()}
                        </p>
                        {log.tokens_awarded > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                            +{log.tokens_awarded} token
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
