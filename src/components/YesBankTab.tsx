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
  Eye,
  EyeOff,
  Send,
  Snowflake,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Landmark,
  Copy,
} from 'lucide-react';

interface YesBankCard {
  id: string;
  holder_name: string;
  card_number: string;
  cvv: string;
  expiry: string;
  balance: number;
  status: string;
  created_at: string;
}

interface CardApplication {
  id: string;
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
  holder_name: string;
  amount: number;
  transaction_type: string;
  admin_note: string | null;
  created_at: string;
}

interface YesBankTabProps {
  userId: string;
}

const formatCardNumber = (num: string) => num.replace(/(.{4})/g, '$1 ').trim();
const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function YesBankTab({ userId }: YesBankTabProps) {
  const { toast } = useToast();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [cards, setCards] = useState<YesBankCard[]>([]);
  const [applications, setApplications] = useState<CardApplication[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [activeView, setActiveView] = useState<'cards' | 'apply' | 'transactions'>('cards');
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  // Apply form
  const [applyName, setApplyName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyAmount, setApplyAmount] = useState('');
  const [applyPurpose, setApplyPurpose] = useState('personal');
  const [applyNotes, setApplyNotes] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [userId]);

  useEffect(() => {
    if (isApproved) {
      fetchCards();
      fetchApplications();
      fetchTransactions();

      // Realtime for cards
      const channel = supabase
        .channel('yes-bank-cards-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_bank_cards' }, () => {
          fetchCards();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isApproved]);

  const checkAccess = async () => {
    const { data } = await supabase
      .from('yes_bank_access')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setHasAccess(true);
      setIsApproved(data.is_approved);
    } else {
      setHasAccess(false);
    }
  };

  const requestAccess = async () => {
    setRequesting(true);
    const { error } = await supabase
      .from('yes_bank_access')
      .insert({ user_id: userId });

    if (error) {
      toast({ title: 'Error', description: 'Could not request access.', variant: 'destructive' });
    } else {
      toast({ title: 'Access Requested', description: 'Waiting for admin approval.' });
      setHasAccess(true);
      setIsApproved(false);
    }
    setRequesting(false);
  };

  const fetchCards = async () => {
    const { data } = await supabase
      .from('yes_bank_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setCards(data);
  };

  const fetchApplications = async () => {
    const { data } = await supabase
      .from('yes_bank_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setApplications(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('yes_bank_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setTransactions(data);
  };

  const toggleReveal = (cardId: string) => {
    setRevealedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard.` });
  };

  const handleApply = async () => {
    if (!applyName.trim() || !applyEmail.trim() || !applyAmount) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(applyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Enter a valid amount.', variant: 'destructive' });
      return;
    }

    setSubmittingApp(true);
    const { error } = await supabase.from('yes_bank_applications').insert({
      user_id: userId,
      applicant_name: applyName.trim(),
      email: applyEmail.trim(),
      requested_amount: amount,
      purpose: applyPurpose,
      notes: applyNotes.trim() || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Could not submit application.', variant: 'destructive' });
    } else {
      toast({ title: 'Application Submitted', description: 'Your card application is pending review.' });
      setApplyName(''); setApplyEmail(''); setApplyAmount(''); setApplyNotes('');
      fetchApplications();
      setActiveView('cards');
    }
    setSubmittingApp(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case 'pending': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
      case 'frozen': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Frozen</Badge>;
      case 'approved': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Not approved yet
  if (hasAccess === null) {
    return <div className="glass-card p-8 text-center"><div className="animate-pulse-glow w-12 h-12 mx-auto rounded-xl bg-primary/20" /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
          <Landmark className="w-10 h-10 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold">YES Bank 🏦</h2>
        <p className="text-muted-foreground max-w-md mx-auto">Virtual banking with CF Bank partnership. Apply for access to get your own virtual cards.</p>
        <Button onClick={requestAccess} disabled={requesting} className="bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold">
          {requesting ? 'Requesting...' : 'Request Access'}
        </Button>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center space-y-4">
        <Clock className="w-12 h-12 mx-auto text-amber-400" />
        <h2 className="text-xl font-bold">Access Pending</h2>
        <p className="text-muted-foreground">Your YES Bank access request is awaiting admin approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6 bg-gradient-to-r from-amber-900/20 to-background border-amber-500/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Landmark className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold">YES Bank</h2>
              <p className="text-xs text-muted-foreground">In partnership with CF Bank</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['cards', 'apply', 'transactions'] as const).map(v => (
              <Button key={v} size="sm" variant={activeView === v ? 'default' : 'outline'}
                onClick={() => setActiveView(v)} className={activeView === v ? 'bg-amber-600 text-black hover:bg-amber-500' : ''}>
                {v === 'cards' && <CreditCard className="w-4 h-4 mr-1" />}
                {v === 'apply' && <Send className="w-4 h-4 mr-1" />}
                {v === 'transactions' && <DollarSign className="w-4 h-4 mr-1" />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* My Cards */}
      {activeView === 'cards' && (
        <div className="space-y-6">
          {cards.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-4">
              <CreditCard className="w-16 h-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">No cards issued yet. Apply for a card to get started.</p>
              <Button onClick={() => setActiveView('apply')} variant="outline">Apply for Card</Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {cards.map(card => {
                const revealed = revealedCards.has(card.id);
                return (
                  <div key={card.id} className="relative group">
                    {/* Card visual */}
                    <div className={`rounded-2xl p-6 h-52 flex flex-col justify-between relative overflow-hidden border
                      ${card.status === 'active' ? 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-900/40 border-amber-500/20' :
                        card.status === 'frozen' ? 'bg-gradient-to-br from-zinc-900 via-blue-900/30 to-zinc-800 border-blue-500/20' :
                        'bg-gradient-to-br from-zinc-900 to-zinc-800 border-border'}`}>
                      
                      {/* Gold shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-pulse pointer-events-none" />
                      
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs text-muted-foreground font-mono">YES BANK</p>
                          <p className="text-lg font-bold text-amber-400">{formatUSD(card.balance)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(card.status)}
                          {card.status === 'frozen' && <Snowflake className="w-4 h-4 text-blue-400" />}
                        </div>
                      </div>
                      
                      <div className="relative z-10 space-y-1">
                        <p className="font-mono text-lg tracking-widest text-foreground/90">
                          {revealed ? formatCardNumber(card.card_number) : `•••• •••• •••• ${card.card_number.slice(-4)}`}
                        </p>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs text-muted-foreground">CARDHOLDER</p>
                            <p className="text-sm font-semibold">{card.holder_name.toUpperCase()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">CVV</p>
                            <p className="font-mono text-sm">{revealed ? card.cvv : '•••'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">EXPIRES</p>
                            <p className="font-mono text-sm">{card.expiry}</p>
                          </div>
                        </div>
                      </div>

                      {/* CF Bank logo area */}
                      <div className="absolute bottom-4 right-4 flex items-center gap-1 z-10">
                        <div className="w-6 h-6 rounded-full bg-amber-500/60" />
                        <div className="w-6 h-6 rounded-full bg-amber-700/60 -ml-3" />
                      </div>
                    </div>

                    {/* Card actions */}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => toggleReveal(card.id)} className="flex-1">
                        {revealed ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                        {revealed ? 'Hide' : 'Reveal'}
                      </Button>
                      {revealed && (
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(card.card_number, 'Card number')}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Application history */}
          {applications.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Your Applications</h3>
              <div className="space-y-3">
                {applications.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium">{app.applicant_name}</p>
                      <p className="text-xs text-muted-foreground">{formatUSD(app.requested_amount)} · {app.purpose} · {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apply for Card */}
      {activeView === 'apply' && (
        <div className="glass-card p-6 max-w-lg mx-auto space-y-6">
          <h3 className="text-lg font-bold">Apply for Virtual Card</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={applyName} onChange={e => setApplyName(e.target.value)} placeholder="John Doe" className="bg-secondary/50" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input value={applyEmail} onChange={e => setApplyEmail(e.target.value)} placeholder="john@example.com" type="email" className="bg-secondary/50" />
              </div>
            </div>
            <div>
              <Label>Requested Balance (USD) *</Label>
              <Input value={applyAmount} onChange={e => setApplyAmount(e.target.value)} placeholder="500" type="number" min="1" className="bg-secondary/50" />
            </div>
            <div>
              <Label>Purpose</Label>
              <select value={applyPurpose} onChange={e => setApplyPurpose(e.target.value)}
                className="w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm">
                <option value="personal">Personal Use</option>
                <option value="business">Business</option>
                <option value="online_shopping">Online Shopping</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={applyNotes} onChange={e => setApplyNotes(e.target.value)} placeholder="Any additional info..." className="bg-secondary/50" />
            </div>
            <Button onClick={handleApply} disabled={submittingApp} className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold">
              {submittingApp ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}

      {/* Transactions */}
      {activeView === 'transactions' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Transaction History</h3>
          <ScrollArea className="h-[400px]">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'fund' ? 'bg-emerald-500/10' : tx.transaction_type === 'debit' ? 'bg-red-500/10' : 'bg-amber-500/10'
                      }`}>
                        {tx.transaction_type === 'fund' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                         tx.transaction_type === 'debit' ? <XCircle className="w-4 h-4 text-red-400" /> :
                         <DollarSign className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.holder_name || 'Card Holder'}</p>
                        <p className="text-xs text-muted-foreground">{tx.admin_note || tx.transaction_type}</p>
                      </div>
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
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
