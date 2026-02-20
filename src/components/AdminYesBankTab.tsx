import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CreditCard,
  Check,
  X,
  DollarSign,
  Users,
  ClipboardList,
  Snowflake,
  Plus,
  Eye,
  EyeOff,
  Landmark,
  Trash2,
} from 'lucide-react';

interface YesBankCard {
  id: string;
  user_id: string;
  holder_name: string;
  card_number: string;
  cvv: string;
  expiry: string;
  balance: number;
  status: string;
  created_at: string;
}

interface BankApplication {
  id: string;
  user_id: string;
  applicant_name: string;
  email: string;
  requested_amount: number;
  purpose: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface BankTransaction {
  id: string;
  card_id: string;
  holder_name: string | null;
  amount: number;
  transaction_type: string;
  admin_note: string | null;
  created_by: string | null;
  created_at: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  is_approved: boolean;
  created_at: string;
}

const generateCardNumber = (): string => {
  let num = '5';
  for (let i = 1; i < 16; i++) num += Math.floor(Math.random() * 10).toString();
  return num;
};

const generateCVV = (): string => {
  return Math.floor(100 + Math.random() * 900).toString();
};

const generateExpiry = (): string => {
  const now = new Date();
  const years = 2 + Math.floor(Math.random() * 4);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = (now.getFullYear() + years).toString().slice(-2);
  return `${month}/${year}`;
};

const formatCardNumber = (num: string) => num.replace(/(.{4})/g, '$1 ').trim();
const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminYesBankTab() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<'overview' | 'cards' | 'applications' | 'transactions' | 'access'>('overview');

  const [cards, setCards] = useState<YesBankCard[]>([]);
  const [applications, setApplications] = useState<BankApplication[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  // Issue card form
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueUserId, setIssueUserId] = useState('');
  const [issueHolderName, setIssueHolderName] = useState('');
  const [issueBalance, setIssueBalance] = useState('');

  // Fund modal
  const [fundingCard, setFundingCard] = useState<YesBankCard | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundNote, setFundNote] = useState('');

  useEffect(() => {
    fetchAll();
    // Realtime
    const ch = supabase
      .channel('admin-yes-bank-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_bank_cards' }, () => fetchCards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_bank_applications' }, () => fetchApplications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_bank_transactions' }, () => fetchTransactions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchAll = () => {
    fetchCards();
    fetchApplications();
    fetchTransactions();
    fetchAccess();
    fetchProfiles();
  };

  const fetchCards = async () => {
    const { data } = await supabase.from('yes_bank_cards').select('*').order('created_at', { ascending: false });
    if (data) setCards(data);
  };

  const fetchApplications = async () => {
    const { data } = await supabase.from('yes_bank_applications').select('*').order('created_at', { ascending: false });
    if (data) setApplications(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase.from('yes_bank_transactions').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setTransactions(data);
  };

  const fetchAccess = async () => {
    const { data } = await supabase.from('yes_bank_access').select('*').order('created_at', { ascending: false });
    if (data) setAccessRequests(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, email, full_name');
    if (data) {
      const map = new Map(data.map(p => [p.user_id, p.email || p.full_name || 'Unknown']));
      setProfileMap(map);
    }
  };

  const getUserEmail = (uid: string) => profileMap.get(uid) || uid.slice(0, 8);

  // Access management
  const handleAccessApproval = async (id: string, approved: boolean) => {
    const { error } = await supabase.from('yes_bank_access').update({
      is_approved: approved,
      approved_at: approved ? new Date().toISOString() : null,
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Could not update access.', variant: 'destructive' });
    } else {
      toast({ title: approved ? 'Approved' : 'Revoked', description: `Access ${approved ? 'granted' : 'revoked'}.` });
      fetchAccess();
    }
  };

  // Issue new card
  const handleIssueCard = async () => {
    if (!issueUserId.trim() || !issueHolderName.trim()) {
      toast({ title: 'Missing Fields', variant: 'destructive' }); return;
    }
    const balance = parseFloat(issueBalance) || 0;

    const card = {
      user_id: issueUserId.trim(),
      holder_name: issueHolderName.trim(),
      card_number: generateCardNumber(),
      cvv: generateCVV(),
      expiry: generateExpiry(),
      balance,
      status: 'active',
    };

    const { data, error } = await supabase.from('yes_bank_cards').insert(card).select().single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Create transaction record for initial fund
      if (balance > 0 && data) {
        await supabase.from('yes_bank_transactions').insert({
          card_id: data.id,
          holder_name: issueHolderName.trim(),
          amount: balance,
          transaction_type: 'fund',
          admin_note: 'Initial card funding',
        });
      }
      toast({ title: 'Card Issued', description: `Card issued to ${issueHolderName}` });
      setShowIssueForm(false);
      setIssueUserId(''); setIssueHolderName(''); setIssueBalance('');
      fetchCards();
      fetchTransactions();
    }
  };

  // Fund card
  const handleFundCard = async () => {
    if (!fundingCard || !fundAmount) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', variant: 'destructive' }); return;
    }

    const newBalance = fundingCard.balance + amount;
    const { error: updateErr } = await supabase.from('yes_bank_cards')
      .update({ balance: newBalance }).eq('id', fundingCard.id);

    if (updateErr) {
      toast({ title: 'Error', description: updateErr.message, variant: 'destructive' }); return;
    }

    await supabase.from('yes_bank_transactions').insert({
      card_id: fundingCard.id,
      holder_name: fundingCard.holder_name,
      amount,
      transaction_type: 'fund',
      admin_note: fundNote || null,
    });

    toast({ title: 'Funds Added', description: `${formatUSD(amount)} added to ${fundingCard.holder_name}'s card.` });
    setFundingCard(null); setFundAmount(''); setFundNote('');
    fetchCards(); fetchTransactions();
  };

  // Toggle freeze
  const toggleFreeze = async (card: YesBankCard) => {
    const newStatus = card.status === 'frozen' ? 'active' : 'frozen';
    await supabase.from('yes_bank_cards').update({ status: newStatus }).eq('id', card.id);
    toast({ title: newStatus === 'frozen' ? 'Card Frozen' : 'Card Unfrozen' });
    fetchCards();
  };

  // Approve application
  const handleApproveApplication = async (app: BankApplication) => {
    const card = {
      user_id: app.user_id,
      holder_name: app.applicant_name,
      card_number: generateCardNumber(),
      cvv: generateCVV(),
      expiry: generateExpiry(),
      balance: app.requested_amount,
      status: 'active',
    };

    const { data, error } = await supabase.from('yes_bank_cards').insert(card).select().single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); return;
    }

    if (data) {
      await supabase.from('yes_bank_transactions').insert({
        card_id: data.id,
        holder_name: app.applicant_name,
        amount: app.requested_amount,
        transaction_type: 'fund',
        admin_note: 'Application approved - initial funding',
      });
    }

    await supabase.from('yes_bank_applications').update({ status: 'approved' }).eq('id', app.id);
    toast({ title: 'Application Approved', description: `Card issued to ${app.applicant_name} with ${formatUSD(app.requested_amount)}.` });
    fetchAll();
  };

  const handleRejectApplication = async (appId: string) => {
    await supabase.from('yes_bank_applications').update({ status: 'rejected' }).eq('id', appId);
    toast({ title: 'Application Rejected' });
    fetchApplications();
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Delete this card permanently?')) return;
    await supabase.from('yes_bank_cards').delete().eq('id', cardId);
    toast({ title: 'Card Deleted' });
    fetchCards();
  };

  const pendingApps = applications.filter(a => a.status === 'pending');
  const pendingAccess = accessRequests.filter(a => !a.is_approved);
  const totalFunds = cards.reduce((s, c) => s + c.balance, 0);
  const activeCards = cards.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Sub nav */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: Landmark },
          { id: 'cards', label: 'Manage Cards', icon: CreditCard, count: cards.length },
          { id: 'applications', label: 'Applications', icon: ClipboardList, count: pendingApps.length },
          { id: 'transactions', label: 'Transactions', icon: DollarSign },
          { id: 'access', label: 'Access Control', icon: Users, count: pendingAccess.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              subTab === tab.id ? 'bg-amber-600 text-black font-bold' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count && tab.count > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground">Total Cards</p>
              <p className="text-2xl font-bold">{cards.length}</p>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground">Total Funds Loaded</p>
              <p className="text-2xl font-bold text-amber-400">{formatUSD(totalFunds)}</p>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground">Active Cards</p>
              <p className="text-2xl font-bold text-emerald-400">{activeCards}</p>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground">Pending Applications</p>
              <p className="text-2xl font-bold text-amber-400">{pendingApps.length}</p>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {transactions.slice(0, 20).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{tx.holder_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{tx.admin_note || tx.transaction_type}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold font-mono ${tx.transaction_type === 'fund' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.transaction_type === 'fund' ? '+' : '-'}{formatUSD(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Manage Cards */}
      {subTab === 'cards' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">All Cards</h3>
            <Button onClick={() => setShowIssueForm(!showIssueForm)} className="bg-amber-600 text-black hover:bg-amber-500">
              <Plus className="w-4 h-4 mr-1" /> Issue New Card
            </Button>
          </div>

          {/* Issue form */}
          {showIssueForm && (
            <div className="glass-card p-6 border-amber-500/30 space-y-4">
              <h4 className="font-semibold">Issue New Virtual Card</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>User ID</Label>
                  <Input value={issueUserId} onChange={e => setIssueUserId(e.target.value)} placeholder="UUID" className="bg-secondary/50 font-mono text-xs" />
                </div>
                <div>
                  <Label>Cardholder Name</Label>
                  <Input value={issueHolderName} onChange={e => setIssueHolderName(e.target.value)} placeholder="John Doe" className="bg-secondary/50" />
                </div>
                <div>
                  <Label>Initial Balance ($)</Label>
                  <Input value={issueBalance} onChange={e => setIssueBalance(e.target.value)} placeholder="500" type="number" className="bg-secondary/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleIssueCard} className="bg-amber-600 text-black">Issue Card</Button>
                <Button variant="outline" onClick={() => setShowIssueForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Fund modal */}
          {fundingCard && (
            <div className="glass-card p-6 border-emerald-500/30 space-y-4">
              <h4 className="font-semibold">Fund Card: {fundingCard.holder_name}</h4>
              <p className="text-sm text-muted-foreground">Current Balance: {formatUSD(fundingCard.balance)}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Amount ($)</Label>
                  <Input value={fundAmount} onChange={e => setFundAmount(e.target.value)} placeholder="100" type="number" className="bg-secondary/50" />
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Input value={fundNote} onChange={e => setFundNote(e.target.value)} placeholder="Monthly top-up" className="bg-secondary/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleFundCard} className="bg-emerald-600 hover:bg-emerald-500">Confirm Fund</Button>
                <Button variant="outline" onClick={() => setFundingCard(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Card list */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {cards.map(card => {
                const revealed = revealedCards.has(card.id);
                return (
                  <div key={card.id} className="p-4 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-amber-400" />
                        <div>
                          <p className="font-semibold">{card.holder_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {revealed ? formatCardNumber(card.card_number) : `•••• •••• •••• ${card.card_number.slice(-4)}`}
                            {revealed && ` | CVV: ${card.cvv}`} | Exp: {card.expiry}
                          </p>
                          <p className="text-xs text-muted-foreground">User: {getUserEmail(card.user_id)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={card.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : card.status === 'frozen' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}>
                          {card.status}
                        </Badge>
                        <span className="font-bold text-amber-400 font-mono">{formatUSD(card.balance)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => {
                        const s = new Set(revealedCards);
                        if (s.has(card.id)) s.delete(card.id); else s.add(card.id);
                        setRevealedCards(s);
                      }}>
                        {revealed ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {revealed ? 'Hide' : 'Reveal'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setFundingCard(card)}>
                        <DollarSign className="w-3 h-3 mr-1" /> Fund
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleFreeze(card)}>
                        <Snowflake className="w-3 h-3 mr-1" /> {card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteCard(card.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Applications */}
      {subTab === 'applications' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Card Applications</h3>
          {applications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No applications.</p>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {applications.map(app => (
                  <div key={app.id} className={`p-4 rounded-lg border ${app.status === 'pending' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-secondary/30 border-border'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-semibold">{app.applicant_name}</p>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Requested: {formatUSD(app.requested_amount)} · {app.purpose || 'N/A'} · {new Date(app.created_at).toLocaleDateString()}
                        </p>
                        {app.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {app.notes}</p>}
                        <p className="text-xs text-muted-foreground">User: {getUserEmail(app.user_id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={app.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : app.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                          {app.status}
                        </Badge>
                        {app.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => handleApproveApplication(app)} className="bg-emerald-600 hover:bg-emerald-500">
                              <Check className="w-4 h-4 mr-1" /> Approve & Issue
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRejectApplication(app.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Transactions */}
      {subTab === 'transactions' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Transaction Log</h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{tx.holder_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{tx.admin_note || tx.transaction_type} · ID: {tx.id.slice(0, 8)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold font-mono ${tx.transaction_type === 'fund' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.transaction_type === 'fund' ? '+' : '-'}{formatUSD(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Access Control */}
      {subTab === 'access' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Access Control</h3>
          {accessRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No access requests.</p>
          ) : (
            <div className="space-y-3">
              {accessRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div>
                    <p className="font-medium">{getUserEmail(req.user_id)}</p>
                    <p className="text-xs text-muted-foreground">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={req.is_approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                      {req.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                    {!req.is_approved ? (
                      <Button size="sm" onClick={() => handleAccessApproval(req.id, true)} className="bg-emerald-600 hover:bg-emerald-500">
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleAccessApproval(req.id, false)}>
                        <X className="w-4 h-4 mr-1" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
