import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddress,
  getMint,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from '@solana/spl-token';
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Coins, ExternalLink, Loader2, Wallet, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/landing/Navbar';

const PLATFORM_ADDRESS = new PublicKey('8ce3F3D6kbCv3Q4yPphJwXVebN3uGWwQhyzH6yQtS44t');
const CREATION_FEE_SOL = 0.5;
const TOTAL_SUPPLY = 999_000_000;
const USER_SUPPLY = 998_000_000;
const PLATFORM_SUPPLY = 1_000_000;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export default function CreateToken() {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [decimals, setDecimals] = useState(9);
  const [metadataUri, setMetadataUri] = useState('');
  const [revokeMint, setRevokeMint] = useState(true);
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const estimatedCost = CREATION_FEE_SOL + 0.012; // ~0.012 SOL for rent + fees

  const handleCreate = async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast.error('Token name and symbol are required');
      return;
    }
    if (tokenSymbol.length > 10) {
      toast.error('Symbol must be 10 characters or less');
      return;
    }

    setLoading(true);
    setTxSignature(null);

    try {
      // Check balance
      const balance = await connection.getBalance(publicKey);
      const requiredLamports = (CREATION_FEE_SOL + 0.02) * LAMPORTS_PER_SOL;
      if (balance < requiredLamports) {
        toast.error(`Insufficient balance. Need ~${(requiredLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
        setLoading(false);
        return;
      }

      const mintKeypair = Keypair.generate();
      const mintRent = await getMinimumBalanceForRentExemptMint(connection);
      const supplyMultiplier = Math.pow(10, decimals);

      // Derive ATAs
      const userAta = await getAssociatedTokenAddress(mintKeypair.publicKey, publicKey);
      const platformAta = await getAssociatedTokenAddress(mintKeypair.publicKey, PLATFORM_ADDRESS);

      // Derive metadata PDA
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const tx = new Transaction();

      // 1. Create mint account
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // 2. Initialize mint
      tx.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          null, // freeze authority
          TOKEN_PROGRAM_ID
        )
      );

      // 3. Create metadata
      tx.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataPDA,
            mint: mintKeypair.publicKey,
            mintAuthority: publicKey,
            payer: publicKey,
            updateAuthority: publicKey,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: tokenName.trim(),
                symbol: tokenSymbol.trim().toUpperCase(),
                uri: metadataUri.trim() || '',
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          }
        )
      );

      // 4. Create user ATA
      tx.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          userAta,
          publicKey,
          mintKeypair.publicKey
        )
      );

      // 5. Create platform ATA
      tx.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          platformAta,
          PLATFORM_ADDRESS,
          mintKeypair.publicKey
        )
      );

      // 6. Mint to user
      tx.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          userAta,
          publicKey,
          BigInt(USER_SUPPLY) * BigInt(supplyMultiplier)
        )
      );

      // 7. Mint to platform
      tx.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          platformAta,
          publicKey,
          BigInt(PLATFORM_SUPPLY) * BigInt(supplyMultiplier)
        )
      );

      // 8. Transfer 0.5 SOL fee to platform
      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: PLATFORM_ADDRESS,
          lamports: CREATION_FEE_SOL * LAMPORTS_PER_SOL,
        })
      );

      // 9. Optionally revoke mint authority
      if (revokeMint) {
        tx.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.MintTokens,
            null
          )
        );
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      tx.partialSign(mintKeypair);

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      setTxSignature(sig);
      toast.success('Token created successfully!');
    } catch (err: any) {
      console.error('Token creation failed:', err);
      const msg = err?.message || 'Unknown error';
      if (msg.includes('User rejected')) {
        toast.error('Transaction cancelled by user');
      } else {
        toast.error(`Failed: ${msg.slice(0, 120)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Coins className="w-7 h-7 text-primary" />
              Create Solana Token
            </CardTitle>
            <CardDescription>
              Launch your own SPL token on Solana mainnet. 999M total supply &mdash; you receive 998M, platform receives 1M.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Wallet connection */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {connected && publicKey
                    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}`
                    : 'No wallet connected'}
                </span>
              </div>
              <WalletMultiButton style={{ height: 36, fontSize: 14, borderRadius: 8 }} />
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Token Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. CF Blockchain Token"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="symbol">Token Symbol *</Label>
                <Input
                  id="symbol"
                  placeholder="e.g. CFB"
                  maxLength={10}
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="decimals">Decimals</Label>
                <Input
                  id="decimals"
                  type="number"
                  min={0}
                  max={9}
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uri">Metadata URI (optional)</Label>
                <Input
                  id="uri"
                  placeholder="https://arweave.net/... or IPFS link"
                  value={metadataUri}
                  onChange={(e) => setMetadataUri(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">JSON metadata with image for your token logo</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">Revoke Mint Authority</p>
                  <p className="text-xs text-muted-foreground">Lock supply permanently — recommended</p>
                </div>
                <Switch checked={revokeMint} onCheckedChange={setRevokeMint} disabled={loading} />
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
              <p className="text-sm font-semibold">Cost Breakdown</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Creation fee</span>
                <span>0.5 SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rent + network fees</span>
                <span>~0.012 SOL</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                <span>Estimated total</span>
                <span>~{estimatedCost.toFixed(3)} SOL</span>
              </div>
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              variant="hero"
              size="lg"
              onClick={handleCreate}
              disabled={loading || !connected || !tokenName.trim() || !tokenSymbol.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Token...
                </>
              ) : (
                <>
                  <Coins className="w-5 h-5" />
                  Create Token — {CREATION_FEE_SOL} SOL
                </>
              )}
            </Button>

            {/* Success */}
            {txSignature && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/10 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Token Created Successfully!
                </div>
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View on Solscan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
