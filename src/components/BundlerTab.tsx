import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, Copy, Check, Loader2, ShieldAlert, Lock,
  ArrowRightLeft, Coins, Eye, EyeOff, Download,
} from 'lucide-react';

interface BundlerWallet {
  index: number;
  publicKey: string;
  privateKey: string;
}

interface TxResult {
  walletIndex: number;
  publicKey: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

export default function BundlerTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [accessStatus, setAccessStatus] = useState<'loading' | 'none' | 'pending' | 'approved'>('loading');
  const [wallets, setWallets] = useState<BundlerWallet[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [mainPrivateKey, setMainPrivateKey] = useState('');
  const [solPerWallet, setSolPerWallet] = useState('0.01');
  const [tokenAddress, setTokenAddress] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [loading, setLoading] = useState('');
  const [results, setResults] = useState<TxResult[]>([]);
  const [showKeys, setShowKeys] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => { checkAccess(); }, [userId]);

  const apiCall = async (action: string, extra = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not logged in');
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bundler-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const checkAccess = async () => {
    const { data } = await supabase.from('bundler_access').select('*').eq('user_id', userId).maybeSingle();
    if (!data) setAccessStatus('none');
    else if (data.is_approved) setAccessStatus('approved');
    else setAccessStatus('pending');
  };

  const requestAccess = async () => {
    setLoading('access');
    try {
      await apiCall('request_access');
      setAccessStatus('pending');
      toast({ title: 'Access Requested', description: 'Waiting for admin approval.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading('');
  };

  const generateWallets = async () => {
    setLoading('generate');
    setResults([]);
    try {
      const data = await apiCall('generate_wallets');
      setWallets(data.wallets);
      setSessionId(data.sessionId);
      toast({ title: '25 Wallets Generated', description: '20 credits charged.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading('');
  };

  const fundWallets = async () => {
    if (!mainPrivateKey || !solPerWallet || !sessionId) {
      toast({ title: 'Missing Info', description: 'Enter main wallet private key and SOL amount.', variant: 'destructive' });
      return;
    }
    setLoading('fund');
    setResults([]);
    try {
      const data = await apiCall('fund_wallets', { sessionId, mainWalletPrivateKey: mainPrivateKey, solPerWallet: parseFloat(solPerWallet) });
      setResults(data.results);
      const succeeded = data.results.filter((r: TxResult) => r.success).length;
      toast({ title: 'Funding Complete', description: `${succeeded}/25 wallets funded.` });
    } catch (e: any) {
      toast({ title: 'Funding Error', description: e.message, variant: 'destructive' });
    }
    setLoading('');
  };

  const buyToken = async () => {
    if (!tokenAddress || !sessionId) {
      toast({ title: 'Missing Info', description: 'Enter token contract address.', variant: 'destructive' });
      return;
    }
    setLoading('buy');
    setResults([]);
    try {
      const data = await apiCall('buy_token', {
        sessionId,
        tokenAddress,
        solAmount: buyAmount ? parseFloat(buyAmount) : undefined,
      });
      setResults(data.results);
      const succeeded = data.results.filter((r: TxResult) => r.success).length;
      toast({ title: 'Buy Complete', description: `${succeeded}/25 wallets bought token.` });
    } catch (e: any) {
      toast({ title: 'Buy Error', description: e.message, variant: 'destructive' });
    }
    setLoading('');
  };

  const sellAll = async () => {
    if (!sessionId) return;
    setLoading('sell');
    setResults([]);
    try {
      const data = await apiCall('sell_all', { sessionId });
      setResults(data.results);
      const succeeded = data.results.filter((r: TxResult) => r.success).length;
      toast({ title: 'Sell Complete', description: `${succeeded}/25 wallets sold tokens back to SOL.` });
    } catch (e: any) {
      toast({ title: 'Sell Error', description: e.message, variant: 'destructive' });
    }
    setLoading('');
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const exportKeys = () => {
    const csv = ['Index,Public Key,Private Key', ...wallets.map(w => `${w.index},${w.publicKey},${w.privateKey}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bundler-wallets-${sessionId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (accessStatus === 'loading') {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (accessStatus === 'none') {
    return (
      <div className="glass-card p-8 animate-fade-in text-center">
        <Lock className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">CF Bundler</h2>
        <p className="text-muted-foreground mb-6">Multi-wallet Solana bundler for generating 25 wallets, funding, and simultaneous token trading. Requires admin approval. 20 credits per session.</p>
        <Button onClick={requestAccess} disabled={loading === 'access'} size="lg">
          {loading === 'access' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
          Request Access
        </Button>
      </div>
    );
  }

  if (accessStatus === 'pending') {
    return (
      <div className="glass-card p-8 animate-fade-in text-center">
        <Lock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Pending</h2>
        <p className="text-muted-foreground">Your CF Bundler access request is pending admin approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> CF Bundler
        </h2>
        <p className="text-muted-foreground text-sm mb-6">Generate 25 wallets, fund them, buy & sell tokens from all wallets simultaneously. 20 credits per generation.</p>

        {/* Step 1: Generate Wallets */}
        {wallets.length === 0 ? (
          <div className="text-center py-8">
            <Button onClick={generateWallets} disabled={!!loading} size="lg" className="px-8">
              {loading === 'generate' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
              Generate 25 Wallets (20 Credits)
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Generated Wallets ({wallets.length})</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowKeys(!showKeys)}>
                    {showKeys ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    {showKeys ? 'Hide' : 'Show'} Keys
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportKeys}>
                    <Download className="w-3 h-3 mr-1" /> Export CSV
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 bg-secondary/20 rounded-lg p-3">
                {wallets.map(w => (
                  <div key={w.index} className="flex items-center gap-2 text-xs font-mono bg-background/50 rounded p-2">
                    <span className="text-muted-foreground w-6 flex-shrink-0">#{w.index + 1}</span>
                    <span className="truncate flex-1">{w.publicKey}</span>
                    {showKeys && (
                      <span className="truncate flex-1 text-yellow-500/70">{w.privateKey.slice(0, 12)}...</span>
                    )}
                    <button onClick={() => copyText(w.publicKey, `pub-${w.index}`)} className="text-muted-foreground hover:text-primary">
                      {copied === `pub-${w.index}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {showKeys && (
                      <button onClick={() => copyText(w.privateKey, `priv-${w.index}`)} className="text-muted-foreground hover:text-yellow-500">
                        {copied === `priv-${w.index}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Fund Wallets */}
            <div className="bg-secondary/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Fund All Wallets</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Main Wallet Private Key</label>
                  <Input
                    type="password"
                    value={mainPrivateKey}
                    onChange={e => setMainPrivateKey(e.target.value)}
                    placeholder="Base58 private key of funding wallet"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SOL Per Wallet</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={solPerWallet}
                    onChange={e => setSolPerWallet(e.target.value)}
                    placeholder="0.01"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
                <Button onClick={fundWallets} disabled={!!loading} className="w-full">
                  {loading === 'fund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                  Send {solPerWallet} SOL to All 25 Wallets
                </Button>
              </div>
            </div>

            {/* Step 3: Buy Token */}
            <div className="bg-secondary/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Buy Token (All Wallets)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Token Contract Address</label>
                  <Input
                    value={tokenAddress}
                    onChange={e => setTokenAddress(e.target.value)}
                    placeholder="Token mint address"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SOL Amount Per Wallet (leave empty for max)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={buyAmount}
                    onChange={e => setBuyAmount(e.target.value)}
                    placeholder="Auto (full balance minus rent)"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
                <Button onClick={buyToken} disabled={!!loading} className="w-full bg-green-600 hover:bg-green-700">
                  {loading === 'buy' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                  Buy Token From All 25 Wallets
                </Button>
              </div>
            </div>

            {/* Step 4: Sell All */}
            <div className="bg-secondary/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Sell All Tokens → SOL</h3>
              <Button onClick={sellAll} disabled={!!loading || !tokenAddress} variant="destructive" className="w-full">
                {loading === 'sell' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                Sell All Tokens Back to SOL (All 25 Wallets)
              </Button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="bg-secondary/20 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Transaction Results</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {results.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs font-mono p-1.5 rounded ${r.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <span className="w-6">#{r.walletIndex + 1}</span>
                      <span className={`flex-shrink-0 ${r.success ? 'text-green-500' : 'text-red-500'}`}>
                        {r.success ? '✓' : '✗'}
                      </span>
                      <span className="truncate flex-1">{r.success ? r.txHash : r.error}</span>
                      {r.success && r.txHash && (
                        <a href={`https://solscan.io/tx/${r.txHash}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex-shrink-0">
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {results.filter(r => r.success).length}/{results.length} successful
                </p>
              </div>
            )}

            {/* New Session */}
            <div className="text-center pt-2">
              <Button variant="outline" onClick={() => { setWallets([]); setSessionId(''); setResults([]); setTokenAddress(''); }}>
                Start New Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
