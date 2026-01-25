import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Wallet, 
  Send, 
  Users, 
  MessageCircle, 
  ArrowDownCircle, 
  Pickaxe,
  Search,
  UserPlus,
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Coins,
  LogOut,
  Shield,
  Ban,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface WalletData {
  id: string;
  username: string;
  balance: number;
  is_miner_approved: boolean;
  total_mined: number;
  total_sent: number;
  total_received: number;
  created_at: string;
}

interface Transaction {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  transaction_type: string;
  status: string;
  description: string | null;
  created_at: string;
  from_wallet?: { username: string } | null;
  to_wallet?: { username: string } | null;
}

interface Friend {
  id: string;
  friend_id: string;
  user_id: string;
  friend_wallet?: { username: string; user_id: string };
  user_wallet?: { username: string; user_id: string };
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_wallet?: { username: string };
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface MinerRequest {
  id: string;
  status: string;
  created_at: string;
}

const COIN_RATE = 0.10; // 1 CFSMS coin = $0.10

export default function Bank() {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [minerRequest, setMinerRequest] = useState<MinerRequest | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; user_id: string }[]>([]);
  
  const [selectedFriend, setSelectedFriend] = useState<{ id: string; username: string; user_id: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawType, setWithdrawType] = useState<'usdc' | 'bitcoin' | 'solana'>('usdc');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [smsCredits, setSmsCredits] = useState(0);
  
  // SMS to Bank transfer
  const [smsToBankAmount, setSmsToBankAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string }[]>([]);
  
  // Search results with status
  const [searchResultsWithStatus, setSearchResultsWithStatus] = useState<{
    id: string;
    username: string;
    user_id: string;
    isFriend: boolean;
    isPending: boolean;
    isBlocked: boolean;
  }[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkWallet();
    }
  }, [user]);

  useEffect(() => {
    if (wallet) {
      fetchTransactions();
      fetchFriends();
      fetchFriendRequests();
      fetchMinerRequest();
      fetchUnreadCount();
      fetchSmsCredits();
      fetchBlockedUsers();
    }
  }, [wallet]);

  // Real-time listener for chat notifications
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel(`chat-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (selectedFriend && user) {
      fetchChatMessages(selectedFriend.user_id);
      
      const channel = supabase
        .channel(`chat-${user.id}-${selectedFriend.user_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          if (payload.new.sender_id === selectedFriend.user_id) {
            setChatMessages(prev => [...prev, payload.new as ChatMessage]);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedFriend, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const checkWallet = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setWallet(data);
      setHasWallet(true);
    } else {
      setHasWallet(false);
    }
  };

  const createWallet = async () => {
    if (!user || !newUsername.trim()) return;
    
    const username = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) {
      toast({ title: 'Error', description: 'Username must be at least 3 characters', variant: 'destructive' });
      return;
    }
    
    setIsCreatingWallet(true);
    
    const { data, error } = await supabase
      .from('wallets')
      .insert({ user_id: user.id, username: `@${username}` })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'Username already taken', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      setWallet(data);
      setHasWallet(true);
      toast({ title: 'Success', description: 'CFSMS Wallet created!' });
    }
    
    setIsCreatingWallet(false);
  };

  const fetchTransactions = async () => {
    if (!wallet) return;
    
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      // Fetch wallet usernames separately
      const walletIds = [...new Set([...data.map(t => t.from_wallet_id), ...data.map(t => t.to_wallet_id)].filter(Boolean))];
      const { data: wallets } = await supabase
        .from('wallets')
        .select('id, username')
        .in('id', walletIds as string[]);
      
      const walletMap = new Map(wallets?.map(w => [w.id, w.username]) || []);
      
      const transactionsWithWallets = data.map(tx => ({
        ...tx,
        from_wallet: tx.from_wallet_id ? { username: walletMap.get(tx.from_wallet_id) || 'Unknown' } : null,
        to_wallet: tx.to_wallet_id ? { username: walletMap.get(tx.to_wallet_id) || 'Unknown' } : null
      }));
      
      setTransactions(transactionsWithWallets);
    }
  };

  const fetchFriends = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    
    if (data) {
      // Fetch wallet info for friends
      const userIds = [...new Set([...data.map(f => f.friend_id), ...data.map(f => f.user_id)])];
      const { data: wallets } = await supabase
        .from('wallets')
        .select('id, username, user_id')
        .in('user_id', userIds);
      
      const walletMap = new Map(wallets?.map(w => [w.user_id, { username: w.username, user_id: w.user_id }]) || []);
      
      const friendsWithWallets = data.map(f => ({
        ...f,
        friend_wallet: walletMap.get(f.friend_id) || undefined,
        user_wallet: walletMap.get(f.user_id) || undefined
      }));
      
      setFriends(friendsWithWallets);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending');
    
    if (data) {
      // Fetch wallet info for requesters
      const userIds = data.map(r => r.from_user_id);
      const { data: wallets } = await supabase
        .from('wallets')
        .select('username, user_id')
        .in('user_id', userIds);
      
      const walletMap = new Map(wallets?.map(w => [w.user_id, { username: w.username }]) || []);
      
      const requestsWithWallets = data.map(r => ({
        ...r,
        from_wallet: walletMap.get(r.from_user_id)
      }));
      
      setFriendRequests(requestsWithWallets);
    }
  };

  const fetchMinerRequest = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('miner_requests')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) setMinerRequest(data);
  };

  const fetchChatMessages = async (friendUserId: string) => {
    if (!user) return;
    
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    
    if (data) setChatMessages(data);
    
    // Mark messages as read
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', friendUserId);
  };

  const fetchBlockedUsers = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('blocked_users')
      .select('id, blocked_id')
      .eq('blocker_id', user.id);
    
    if (data) setBlockedUsers(data);
  };

  const searchUsers = async () => {
    if (!searchUsername.trim() || !wallet || !user) return;
    
    const { data } = await supabase
      .from('wallets')
      .select('id, username, user_id')
      .ilike('username', `%${searchUsername}%`)
      .neq('user_id', user.id)
      .limit(20);
    
    if (data) {
      // Get existing friends list
      const friendUserIds = friends.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      
      // Get pending requests we sent
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('to_user_id')
        .eq('from_user_id', user.id)
        .eq('status', 'pending');
      
      const pendingUserIds = sentRequests?.map(r => r.to_user_id) || [];
      const blockedUserIds = blockedUsers.map(b => b.blocked_id);
      
      const enrichedResults = data.map(result => ({
        ...result,
        isFriend: friendUserIds.includes(result.user_id),
        isPending: pendingUserIds.includes(result.user_id),
        isBlocked: blockedUserIds.includes(result.user_id),
      }));
      
      setSearchResults(data);
      setSearchResultsWithStatus(enrichedResults);
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('friend_requests')
      .insert({ from_user_id: user.id, to_user_id: toUserId });
    
    if (error) {
      toast({ title: 'Error', description: 'Could not send friend request', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Friend request sent!' });
      searchUsers(); // Refresh search results
    }
  };

  const blockUser = async (userId: string, username: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: user.id, blocked_id: userId });
    
    if (error) {
      toast({ title: 'Error', description: 'Could not block user', variant: 'destructive' });
    } else {
      toast({ title: 'Blocked', description: `${username} has been blocked` });
      fetchBlockedUsers();
      searchUsers();
    }
  };

  const unblockUser = async (blockId: string, username: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('id', blockId);
    
    if (error) {
      toast({ title: 'Error', description: 'Could not unblock user', variant: 'destructive' });
    } else {
      toast({ title: 'Unblocked', description: `${username} has been unblocked` });
      fetchBlockedUsers();
      searchUsers();
    }
  };

  const removeFriend = async (friendUserId: string, username: string) => {
    if (!user) return;
    
    // Remove both friendship records
    await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`);
    
    toast({ title: 'Removed', description: `${username} removed from friends` });
    fetchFriends();
    searchUsers();
  };

  const transferSmsToBank = async () => {
    if (!wallet || !smsToBankAmount) return;
    
    const credits = parseInt(smsToBankAmount);
    if (isNaN(credits) || credits <= 0) {
      toast({ title: 'Error', description: 'Invalid amount', variant: 'destructive' });
      return;
    }
    
    if (credits > smsCredits) {
      toast({ title: 'Error', description: 'Insufficient SMS credits', variant: 'destructive' });
      return;
    }
    
    setIsTransferring(true);
    
    const { data, error } = await supabase.functions.invoke('sms-to-bank-transfer', {
      body: { creditsToTransfer: credits }
    });
    
    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || 'Transfer failed', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Transfer Successful!', 
        description: `Transferred ${data.creditsTransferred} SMS credits to ${data.tokensAdded} CFSMS tokens` 
      });
      setSmsToBankAmount('');
      checkWallet();
      fetchSmsCredits();
      fetchTransactions();
    }
    
    setIsTransferring(false);
  };

  const handleFriendRequest = async (requestId: string, accept: boolean, fromUserId: string) => {
    if (!user) return;
    
    await supabase
      .from('friend_requests')
      .update({ status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
      .eq('id', requestId);
    
    if (accept) {
      // Create bidirectional friendship
      await supabase.from('friends').insert([
        { user_id: user.id, friend_id: fromUserId },
        { user_id: fromUserId, friend_id: user.id }
      ]);
    }
    
    fetchFriendRequests();
    fetchFriends();
    toast({ title: accept ? 'Friend added!' : 'Request declined' });
  };

  const sendTokens = async () => {
    if (!wallet || !sendRecipient.trim() || !sendAmount) return;
    
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Invalid amount', variant: 'destructive' });
      return;
    }
    
    if (amount > wallet.balance) {
      toast({ title: 'Error', description: 'Insufficient balance', variant: 'destructive' });
      return;
    }
    
    setIsSending(true);
    
    const { data, error } = await supabase.functions.invoke('wallet-transfer', {
      body: { 
        recipientUsername: sendRecipient.startsWith('@') ? sendRecipient : `@${sendRecipient}`,
        amount 
      }
    });
    
    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || 'Transfer failed', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Sent ${amount} CFSMS to ${sendRecipient}` });
      setSendAmount('');
      setSendRecipient('');
      checkWallet();
      fetchTransactions();
    }
    
    setIsSending(false);
  };

  const sendMessage = async () => {
    if (!user || !selectedFriend || !newMessage.trim()) return;
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: user.id,
        receiver_id: selectedFriend.user_id,
        message: newMessage.trim()
      });
    
    if (!error) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender_id: user.id,
        receiver_id: selectedFriend.user_id,
        message: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString()
      }]);
      setNewMessage('');
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    
    setUnreadCount(count || 0);
  };

  const fetchSmsCredits = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();
    
    if (data) setSmsCredits(data.sms_credits || 0);
  };

  const exchangeTokensForCredits = async () => {
    if (!wallet || !exchangeAmount) return;
    
    const tokens = parseInt(exchangeAmount);
    if (isNaN(tokens) || tokens < 10) {
      toast({ title: 'Error', description: 'Minimum 10 tokens required', variant: 'destructive' });
      return;
    }
    
    if (tokens > wallet.balance) {
      toast({ title: 'Error', description: 'Insufficient token balance', variant: 'destructive' });
      return;
    }
    
    setIsExchanging(true);
    
    const { data, error } = await supabase.functions.invoke('exchange-tokens', {
      body: { tokensToExchange: tokens }
    });
    
    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || 'Exchange failed', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Exchange Successful!', 
        description: `Exchanged ${data.tokensUsed} tokens for ${data.creditsAdded} SMS credits` 
      });
      setExchangeAmount('');
      checkWallet();
      fetchSmsCredits();
      fetchTransactions();
    }
    
    setIsExchanging(false);
  };

  const requestMinerStatus = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('miner_requests')
      .insert({ user_id: user.id });
    
    if (error) {
      toast({ title: 'Error', description: 'Could not submit miner request', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Miner request submitted for admin review' });
      fetchMinerRequest();
    }
  };

  const submitWithdrawal = async () => {
    if (!wallet || !withdrawAmount || !withdrawAddress.trim()) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Invalid amount', variant: 'destructive' });
      return;
    }
    
    if (amount > wallet.balance) {
      toast({ title: 'Error', description: 'Insufficient balance', variant: 'destructive' });
      return;
    }
    
    setIsWithdrawing(true);
    
    const { error } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: user?.id,
        wallet_id: wallet.id,
        amount,
        withdrawal_type: withdrawType,
        wallet_address: withdrawAddress.trim()
      });
    
    if (error) {
      toast({ title: 'Error', description: 'Could not submit withdrawal request', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Withdrawal request submitted for admin review' });
      setWithdrawAmount('');
      setWithdrawAddress('');
    }
    
    setIsWithdrawing(false);
  };

  const getFriendData = (friend: Friend) => {
    if (friend.user_id === user?.id) {
      return friend.friend_wallet;
    }
    return friend.user_wallet;
  };

  if (loading || hasWallet === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-md mx-auto mt-20">
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Coins className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">CFSMS Digital Bank</CardTitle>
              <CardDescription>
                Create your wallet to start using CFSMS tokens. 
                Each token is worth ${COIN_RATE.toFixed(2)} USD.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Choose your @username</label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-muted rounded-l-md border border-r-0">@</span>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Letters, numbers, and underscores only. Minimum 3 characters.
                </p>
              </div>
              <Button 
                onClick={createWallet} 
                disabled={isCreatingWallet || newUsername.length < 3}
                className="w-full"
              >
                {isCreatingWallet ? 'Creating...' : 'Create Wallet'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">CFSMS Bank</h1>
              <p className="text-xs text-muted-foreground">{wallet?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold">{wallet?.balance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                ≈ ${((wallet?.balance || 0) * COIN_RATE).toFixed(2)} USD
              </p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                  <Shield className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="wallet" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl mx-auto">
            <TabsTrigger value="wallet" className="flex gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex gap-2 relative">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Friends</span>
              {friendRequests.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
                  {friendRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex gap-2 relative">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mining" className="flex gap-2">
              <Pickaxe className="w-4 h-4" />
              <span className="hidden sm:inline">Mine</span>
            </TabsTrigger>
          </TabsList>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Received</p>
                      <p className="text-xl font-bold">{wallet?.total_received.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Sent</p>
                      <p className="text-xl font-bold">{wallet?.total_sent.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Pickaxe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Mined</p>
                      <p className="text-xl font-bold">{wallet?.total_mined.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => {
                        const isOutgoing = tx.from_wallet_id === wallet?.id;
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOutgoing ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                {isOutgoing ? (
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                ) : (
                                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {tx.transaction_type === 'mining' ? 'Mining Reward' :
                                   tx.transaction_type === 'sms_credit_exchange' ? 'SMS Credit Exchange' :
                                   isOutgoing ? `To ${tx.to_wallet?.username || 'Unknown'}` : `From ${tx.from_wallet?.username || 'System'}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(tx.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <p className={`font-bold ${isOutgoing ? 'text-red-500' : 'text-green-500'}`}>
                              {isOutgoing ? '-' : '+'}{tx.amount.toLocaleString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Withdraw Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5" />
                  Withdraw Tokens
                </CardTitle>
                <CardDescription>
                  Convert your CFSMS tokens to cryptocurrency. Withdrawals require admin approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount</label>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ ${(parseFloat(withdrawAmount || '0') * COIN_RATE).toFixed(2)} USD
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Currency</label>
                    <select
                      value={withdrawType}
                      onChange={(e) => setWithdrawType(e.target.value as 'usdc' | 'bitcoin' | 'solana')}
                      className="w-full h-10 px-3 rounded-md border bg-background"
                    >
                      <option value="usdc">USDC</option>
                      <option value="solana">Solana</option>
                      <option value="bitcoin">Bitcoin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Wallet Address</label>
                    <Input
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      placeholder="Your wallet address"
                    />
                  </div>
                </div>
                <Button 
                  onClick={submitWithdrawal} 
                  disabled={isWithdrawing || !withdrawAmount || !withdrawAddress}
                >
                  {isWithdrawing ? 'Submitting...' : 'Request Withdrawal'}
                </Button>
              </CardContent>
            </Card>

            {/* SMS to Bank Transfer Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Transfer SMS Credits to Bank
                </CardTitle>
                <CardDescription>
                  Convert your SMS credits to CFSMS tokens. Rate: 1 SMS credit = 10 tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your SMS Credits</p>
                    <p className="text-2xl font-bold">{smsCredits}</p>
                  </div>
                  <div className="text-center">
                    <RefreshCw className="w-6 h-6 text-primary mx-auto" />
                    <p className="text-xs text-muted-foreground mt-1">1:10 rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Token Balance</p>
                    <p className="text-2xl font-bold">{wallet?.balance.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">SMS Credits to Transfer</label>
                    <Input
                      type="number"
                      value={smsToBankAmount}
                      onChange={(e) => setSmsToBankAmount(e.target.value)}
                      placeholder="1"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      = {parseInt(smsToBankAmount || '0') * 10} CFSMS tokens
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={transferSmsToBank} 
                      disabled={isTransferring || !smsToBankAmount || parseInt(smsToBankAmount) < 1 || parseInt(smsToBankAmount) > smsCredits}
                      className="w-full"
                    >
                      {isTransferring ? 'Transferring...' : 'Transfer to Bank'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Exchange Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Exchange Tokens for SMS Credits
                </CardTitle>
                <CardDescription>
                  Convert your CFSMS tokens to SMS credits. Rate: 10 tokens = 1 SMS credit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your SMS Credits</p>
                    <p className="text-2xl font-bold">{smsCredits}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Token Balance</p>
                    <p className="text-2xl font-bold">{wallet?.balance.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tokens to Exchange</label>
                    <Input
                      type="number"
                      value={exchangeAmount}
                      onChange={(e) => setExchangeAmount(e.target.value)}
                      placeholder="10"
                      min="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      = {Math.floor(parseInt(exchangeAmount || '0') / 10)} SMS credits
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={exchangeTokensForCredits} 
                      disabled={isExchanging || !exchangeAmount || parseInt(exchangeAmount) < 10}
                      className="w-full"
                    >
                      {isExchanging ? 'Exchanging...' : 'Exchange Now'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Send Tab */}
          <TabsContent value="send">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Send CFSMS Tokens</CardTitle>
                <CardDescription>
                  Send tokens instantly to any CFSMS wallet user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Recipient @username</label>
                  <Input
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    placeholder="@username"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Amount</label>
                  <Input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: {wallet?.balance.toLocaleString()} CFSMS
                  </p>
                </div>
                <Button 
                  onClick={sendTokens} 
                  disabled={isSending || !sendAmount || !sendRecipient}
                  className="w-full"
                >
                  {isSending ? 'Sending...' : 'Send Tokens'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-6">
            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Friend Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {friendRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{req.from_wallet?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleFriendRequest(req.id, true, req.from_user_id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleFriendRequest(req.id, false, req.from_user_id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Users */}
            <Card>
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    placeholder="Search by @username"
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  />
                  <Button onClick={searchUsers}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {searchResultsWithStatus.length > 0 && (
                  <div className="space-y-2">
                    {searchResultsWithStatus.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{result.username}</p>
                          {result.isFriend && (
                            <Badge variant="secondary" className="text-xs">Friend</Badge>
                          )}
                          {result.isPending && (
                            <Badge variant="outline" className="text-xs">Pending</Badge>
                          )}
                          {result.isBlocked && (
                            <Badge variant="destructive" className="text-xs">Blocked</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {result.isBlocked ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const block = blockedUsers.find(b => b.blocked_id === result.user_id);
                                if (block) unblockUser(block.id, result.username);
                              }}
                            >
                              Unblock
                            </Button>
                          ) : (
                            <>
                              {!result.isFriend && !result.isPending && (
                                <Button size="sm" onClick={() => sendFriendRequest(result.user_id)}>
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setSendRecipient(result.username)}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => blockUser(result.user_id, result.username)}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Blocked Users */}
            {blockedUsers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ban className="w-5 h-5" />
                    Blocked Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {blockedUsers.map((block) => {
                      const blockedWallet = searchResults.find(r => r.user_id === block.blocked_id);
                      return (
                        <div key={block.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                          <p className="font-medium">{blockedWallet?.username || 'Unknown user'}</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => unblockUser(block.id, blockedWallet?.username || 'user')}
                          >
                            Unblock
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Friends List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Friends</CardTitle>
                <CardDescription>Friends must approve requests before they can interact</CardDescription>
              </CardHeader>
              <CardContent>
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No friends yet. Search and add some!</p>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => {
                      const friendData = getFriendData(friend);
                      return (
                        <div key={friend.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <p className="font-medium">{friendData?.username}</p>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedFriend(friendData ? { id: friend.id, username: friendData.username, user_id: friendData.user_id } : null)}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSendRecipient(friendData?.username || '')}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => friendData && removeFriend(friendData.user_id, friendData.username)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <div className="grid md:grid-cols-3 gap-4 h-[600px]">
              {/* Friends List */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {friends.map((friend) => {
                      const friendData = getFriendData(friend);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => setSelectedFriend(friendData ? { id: friend.id, username: friendData.username, user_id: friendData.user_id } : null)}
                          className={`w-full p-4 text-left hover:bg-muted/50 border-b ${selectedFriend?.user_id === friendData?.user_id ? 'bg-muted' : ''}`}
                        >
                          <p className="font-medium">{friendData?.username}</p>
                        </button>
                      );
                    })}
                    {friends.length === 0 && (
                      <p className="text-center text-muted-foreground p-4">Add friends to start chatting</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat Window */}
              <Card className="md:col-span-2">
                {selectedFriend ? (
                  <>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">{selectedFriend.username}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col h-[500px]">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                          {chatMessages.map((msg) => {
                            const isMine = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] p-3 rounded-lg ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                  <p className="text-sm">{msg.message}</p>
                                  <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <Button onClick={sendMessage}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Select a friend to start chatting
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Mining Tab */}
          <TabsContent value="mining">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pickaxe className="w-5 h-5" />
                  CFSMS Mining
                </CardTitle>
                <CardDescription>
                  Earn CFSMS tokens by completing captchas. Complete 1,000 captchas to earn 1 CFSMS token.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!wallet?.is_miner_approved ? (
                  <div className="text-center py-8 space-y-4">
                    {minerRequest ? (
                      <>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                          minerRequest.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          minerRequest.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          <Clock className="w-4 h-4" />
                          Miner Request: {minerRequest.status.charAt(0).toUpperCase() + minerRequest.status.slice(1)}
                        </div>
                        <p className="text-muted-foreground">
                          {minerRequest.status === 'pending' 
                            ? 'Your request is being reviewed by an admin.'
                            : minerRequest.status === 'rejected'
                            ? 'Your request was rejected. Contact support for more information.'
                            : 'You are approved to mine!'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          You need to be verified as a miner to start earning tokens.
                        </p>
                        <Button onClick={requestMinerStatus}>
                          <Pickaxe className="w-4 h-4 mr-2" />
                          Request Miner Verification
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-6 rounded-lg bg-primary/5 border border-primary/10 text-center">
                      <p className="text-sm text-muted-foreground mb-2">You are an approved miner!</p>
                      <p className="text-4xl font-bold text-primary">{wallet?.total_mined.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Tokens Mined</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <h4 className="font-medium mb-2">How Mining Works:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Complete captchas through our mining portal</li>
                        <li>• Every 1,000 completed captchas = 1 CFSMS token</li>
                        <li>• Tokens are automatically credited to your wallet</li>
                        <li>• Exchange tokens for SMS credits or withdraw to crypto</li>
                      </ul>
                    </div>
                    <Button className="w-full" size="lg" onClick={() => navigate('/miner')}>
                      <Pickaxe className="w-4 h-4 mr-2" />
                      Open CFMiner
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
