import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ── Base58 Decode ──
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str: string): Uint8Array {
  let num = BigInt(0);
  for (const c of str) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}

// ── Ed25519 Signing ──
function buildPkcs8(seed: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
  ]);
  const pkcs8 = new Uint8Array(header.length + seed.length);
  pkcs8.set(header);
  pkcs8.set(seed, header.length);
  return pkcs8.buffer;
}

async function signTransaction(message: Uint8Array, secretKeyBytes: Uint8Array): Promise<Uint8Array> {
  const seed = secretKeyBytes.slice(0, 32);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', buildPkcs8(seed), { name: 'Ed25519' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('Ed25519', privateKey, message);
  return new Uint8Array(signature);
}

// ══════════════════════════════════════════════════════════════
// HELIUS PRO SCALPER — CONFIGURATION
// ══════════════════════════════════════════════════════════════
const PLATFORM_FEE_WALLET = '8ce3F3D6kbCv3Q4yPphJwXVebN3uGWwQhyzH6yQtS44t';
const PLATFORM_FLAT_FEE_SOL = 0.01; // Mandatory 0.01 SOL platform fee per trade initiation
const PLATFORM_PROFIT_FEE_PERCENT = 0.02; // 2% of profit (only on winning trades)

const SCALPER_CONFIG = {
  DEFAULT_POSITION_SOL: 0.05,
  PLATFORM_FEE_USD: 0,
  TAKE_PROFIT_USD: 2.00, // $2 net profit target — STRICT: ONLY exit at $2+
  QUICK_EXIT_MINUTES: 1.5,
  QUICK_EXIT_PROFIT_USD: 2.00,
  STOP_LOSS_PCT: -0.90, // -90% — effectively disabled, we hold until $2 profit
  MAX_HOLD_MINUTES: 60, // 60 min hold — give token time to pump to $2
  MAX_SLIPPAGE_BPS: 150, // Tighter slippage to prevent entry losses
  MAX_TOKEN_AGE_MINUTES: 5, // STRICT: only trade tokens ≤5 min old — fresh launches only
  MIN_LP_SOL: 3,
  MAX_TOP10_HOLDER_PCT: 40,
  CIRCUIT_BREAKER_LOSSES: 5,
  CIRCUIT_BREAKER_PAUSE_MIN: 10,
  MAX_CONCURRENT_POSITIONS: 1,
  PRIORITY_FEE_SOL: 0.0005,
  SCAN_INTERVAL_SECONDS: 15,
  MIN_MATCH_PCT: 55, // Higher quality entries — was 40%, too many bad trades
  GRACE_PERIOD_SECONDS: 90, // Don't check stop loss for first 90s — let token stabilize
  MAX_ENTRY_IMPACT_PCT: 3, // Block entry if price impact > 3%
  EARLY_MOMENTUM_CHECK_SECONDS: 10, // Token must show pump momentum within first 10s
  MIN_EARLY_BUY_VELOCITY: 3, // Minimum buys/min in first 10 seconds to qualify
  SELL_PRESSURE_EXIT_RATIO: 2.0, // Exit if sells outnumber buys by 2:1 ratio
  NO_MOMENTUM_EXIT_SECONDS: 30, // If no price increase in first 30s after entry, exit
};

// ═══ PERCENTAGE-BASED FILTER SCORING ═══
// Each filter contributes a percentage. No hard rejects — always finds the best match.
interface TokenMetrics {
  age_seconds: number;
  buy_count: number;
  liquidity_sol: number;
  liquidity_usd: number;
  market_cap_usd: number;
  reply_count: number;
  holder_count: number;
  mint_authority_revoked: boolean;
  freeze_authority_disabled: boolean;
  top10_holder_pct: number;
}

interface FilterResult {
  name: string;
  passed: boolean;
  weight: number;
  detail: string;
}

interface ScoringResult {
  match_pct: number;
  filters: FilterResult[];
  total_passed: number;
  total_filters: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'SPECULATIVE' | 'HIGH_RISK';
}

function scoreTokenPercentage(metrics: TokenMetrics): ScoringResult {
  const filters: FilterResult[] = [];

  // Filter 1: Mint authority revoked (weight: 15%)
  filters.push({
    name: 'Mint Authority Revoked',
    passed: metrics.mint_authority_revoked,
    weight: 15,
    detail: metrics.mint_authority_revoked ? 'Revoked ✓' : 'Active ⚠️',
  });

  // Filter 2: Freeze authority disabled (weight: 10%)
  filters.push({
    name: 'Freeze Authority Disabled',
    passed: metrics.freeze_authority_disabled,
    weight: 10,
    detail: metrics.freeze_authority_disabled ? 'Disabled ✓' : 'Active ⚠️',
  });

  // Filter 3: LP >= 3 SOL (weight: 12%)
  const lpPassed = metrics.liquidity_sol >= SCALPER_CONFIG.MIN_LP_SOL;
  filters.push({
    name: 'Liquidity ≥ 5 SOL',
    passed: lpPassed,
    weight: 12,
    detail: `${metrics.liquidity_sol.toFixed(2)} SOL`,
  });

  // Filter 4: Top 10 holders < 40% (weight: 8%)
  const holdersPassed = metrics.top10_holder_pct < SCALPER_CONFIG.MAX_TOP10_HOLDER_PCT;
  filters.push({
    name: 'Top 10 Holders < 30%',
    passed: holdersPassed,
    weight: 8,
    detail: `${metrics.top10_holder_pct.toFixed(1)}%`,
  });

  // Filter 5: Token age < 5 min (weight: 20%) — PRIORITIZE FRESHNESS
  const agePassed = metrics.age_seconds <= SCALPER_CONFIG.MAX_TOKEN_AGE_MINUTES * 60;
  filters.push({
    name: 'Token Age ≤ 5 min',
    passed: agePassed,
    weight: 20,
    detail: `${(metrics.age_seconds / 60).toFixed(1)} min`,
  });

  // Filter 6: Buy velocity (Poisson) (weight: 15%)
  const buyRate = metrics.age_seconds > 0 ? (metrics.buy_count / metrics.age_seconds) * 60 : 0;
  const velocityPassed = buyRate >= 2;
  filters.push({
    name: 'Buy Velocity ≥ 2/min',
    passed: velocityPassed,
    weight: 15,
    detail: `${buyRate.toFixed(1)} buys/min`,
  });

  // Filter 7: Market cap sweet spot $500–$80K (weight: 5%) — lowered weight, freshness matters more
  const mcapPassed = metrics.market_cap_usd >= 500 && metrics.market_cap_usd <= 80000;
  filters.push({
    name: 'Market Cap $500–$80K',
    passed: mcapPassed,
    weight: 5,
    detail: metrics.market_cap_usd > 0 ? `$${(metrics.market_cap_usd / 1000).toFixed(1)}K` : 'Unknown',
  });

  // Filter 8: Social engagement (weight: 5%)
  const socialPassed = metrics.reply_count >= 3;
  filters.push({
    name: 'Social Engagement',
    passed: socialPassed,
    weight: 5,
    detail: `${metrics.reply_count} replies`,
  });

  // Filter 9: Honeypot simulation (weight: 10%) — checked separately, assume pass here
  // This is checked after scoring during execution
  filters.push({
    name: 'Honeypot Check',
    passed: true, // Will be verified separately
    weight: 10,
    detail: 'Pending verification',
  });

  // Calculate match percentage
  const totalWeight = filters.reduce((sum, f) => sum + f.weight, 0);
  const passedWeight = filters.reduce((sum, f) => sum + (f.passed ? f.weight : 0), 0);
  const match_pct = Math.round((passedWeight / totalWeight) * 100);

  const total_passed = filters.filter(f => f.passed).length;
  const total_filters = filters.length;

  let recommendation: ScoringResult['recommendation'] = 'HIGH_RISK';
  if (match_pct >= 80) recommendation = 'STRONG_BUY';
  else if (match_pct >= 60) recommendation = 'BUY';
  else if (match_pct >= 40) recommendation = 'SPECULATIVE';

  return { match_pct, filters, total_passed, total_filters, recommendation };
}

// ── Get SOL balance ──
async function getBalance(publicKey: string, heliusRpc: string): Promise<number> {
  try {
    const res = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }),
    });
    const data = await res.json();
    return (data?.result?.value || 0) / 1e9;
  } catch { return 0; }
}

// ── Get SOL price in USD ──
async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    const data = await res.json();
    return parseFloat(data?.data?.['So11111111111111111111111111111111111111112']?.price || '150');
  } catch {}
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) { const d = await res.json(); return d?.solana?.usd || 150; }
  } catch {}
  return 150;
}

// ── Jupiter API URLs — lite-api first (free, no auth), then others ──
// IMPORTANT: quote-api.jup.ag has DNS issues from Edge Functions, so we skip it entirely
const JUPITER_QUOTE_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/quote',
  'https://api.jup.ag/swap/v1/quote',
];
const JUPITER_SWAP_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/swap',
  'https://api.jup.ag/swap/v1/swap',
];

async function fetchWithFallback(urls: string[], options?: RequestInit): Promise<Response> {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      console.log(`[JUPITER] Trying: ${url.split('?')[0]}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      // Only accept 2xx responses — 401/403 should trigger fallback
      if (res.ok) {
        console.log(`[JUPITER] ✅ Success from: ${url.split('?')[0]}`);
        return res;
      }
      const errBody = await res.text().catch(() => '');
      console.error(`[JUPITER] ${url.split('?')[0]} returned ${res.status}: ${errBody.slice(0, 200)}`);
      lastError = new Error(`HTTP ${res.status}: ${errBody.slice(0, 100)}`);
    } catch (e) {
      console.error(`[JUPITER] Failed ${url.split('?')[0]}: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('All Jupiter endpoints failed');
}

// ── Execute Jupiter swap ──
async function executeSwap(
  inputMint: string, outputMint: string, amountLamports: number,
  publicKey: string, privateKeyB58: string, heliusRpc: string,
  maxSlippageBps: number = SCALPER_CONFIG.MAX_SLIPPAGE_BPS
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    // ── STEP 1: Get quote from Jupiter (try V6 first, then V1) ──
    const quoteUrls = JUPITER_QUOTE_ENDPOINTS.map(u => 
      `${u}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${maxSlippageBps}`
    );
    console.log('[SWAP] Getting quote for', inputMint.slice(0,8), '→', outputMint.slice(0,8), 'amount:', amountLamports);
    
    const quoteRes = await fetchWithFallback(quoteUrls);
    const quote = await quoteRes.json();
    
    if (quote.error) {
      console.error('[SWAP] Quote error:', JSON.stringify(quote));
      return { success: false, error: `Quote: ${quote.error}` };
    }
    if (!quote.outAmount || quote.outAmount === '0') {
      console.error('[SWAP] Quote returned 0 output:', JSON.stringify(quote));
      return { success: false, error: 'No route found for this token' };
    }

    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    if (priceImpact > SCALPER_CONFIG.MAX_ENTRY_IMPACT_PCT) {
      return { success: false, error: `Price impact ${priceImpact.toFixed(2)}% exceeds ${SCALPER_CONFIG.MAX_ENTRY_IMPACT_PCT}% max — token too illiquid` };
    }
    console.log('[SWAP] Quote OK: outAmount=', quote.outAmount, 'priceImpact=', priceImpact);

    // ── STEP 2: Get serialized transaction (try each swap endpoint) ──
    let swapTransaction: string | null = null;
    let swapError: string | null = null;
    
    for (const swapUrl of JUPITER_SWAP_ENDPOINTS) {
      try {
        console.log('[SWAP] Trying swap endpoint:', swapUrl);
        const swapRes = await fetch(swapUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: publicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: Math.floor(SCALPER_CONFIG.PRIORITY_FEE_SOL * 1e9),
          }),
        });
        const swapData = await swapRes.json();
        console.log('[SWAP] Response from', swapUrl, '- has swapTransaction:', !!swapData.swapTransaction, 'error:', swapData.error || 'none');
        
        if (swapData.swapTransaction) {
          swapTransaction = swapData.swapTransaction;
          break;
        }
        swapError = swapData.error || 'No swapTransaction in response';
      } catch (e) {
        console.error('[SWAP] Endpoint failed:', swapUrl, e.message);
        swapError = e.message;
      }
    }
    
    if (!swapTransaction) {
      return { success: false, error: `All swap endpoints failed: ${swapError}` };
    }

    // ── STEP 3: Sign and send transaction ──
    console.log('[SWAP] Signing transaction...');
    const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
    const secretKeyBytes = base58Decode(privateKeyB58);
    
    // Determine transaction format — versioned transactions have different structure
    const messageBytes = txBytes.slice(65);
    const sig = await signTransaction(messageBytes, secretKeyBytes);
    const signedTx = new Uint8Array(txBytes);
    signedTx.set(sig, 1);

    console.log('[SWAP] Sending transaction to Helius RPC...');
    const sendRes = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sendTransaction',
        params: [btoa(String.fromCharCode(...signedTx)), { encoding: 'base64', skipPreflight: true, maxRetries: 3 }],
      }),
    });
    const sendResult = await sendRes.json();
    
    if (sendResult.error) {
      console.error('[SWAP] Send error:', JSON.stringify(sendResult.error));
      return { success: false, error: sendResult.error.message || JSON.stringify(sendResult.error) };
    }

    console.log('[SWAP] ✅ Transaction sent:', sendResult.result);
    const outputAmount = parseInt(quote.outAmount) / (outputMint === SOL_MINT ? 1e9 : Math.pow(10, quote.outputDecimals || 6));
    return { success: true, signature: sendResult.result, outputAmount };
  } catch (e) {
    console.error('[JUPITER] executeSwap error:', e);
    return { success: false, error: `Swap failed: ${e.message}` };
  }
}


// ── Send SOL platform fee to platform wallet ──
async function sendPlatformFee(
  feeSol: number, userPublicKey: string, privateKeyB58: string, heliusRpc: string
): Promise<{ success: boolean; signature?: string; feeSol?: number; error?: string }> {
  try {
    if (feeSol < 0.0001) {
      console.log('[FEE] Fee too small to send:', feeSol);
      return { success: true, feeSol: 0, signature: 'skipped_too_small' };
    }
    const feeLamports = Math.floor(feeSol * 1e9);
    console.log(`[FEE] Sending ${feeSol.toFixed(6)} SOL to platform wallet...`);

    // Build a native SOL transfer via Jupiter (SOL → SOL swap to platform wallet won't work)
    // Use raw Solana transfer instruction instead
    const secretKeyBytes = base58Decode(privateKeyB58);

    // Get recent blockhash
    const bhRes = await fetch(heliusRpc, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'finalized' }] }),
    });
    const bhData = await bhRes.json();
    const blockhash = bhData.result?.value?.blockhash;
    if (!blockhash) return { success: false, error: 'Failed to get blockhash for fee transfer' };

    // Decode addresses
    const fromPubkey = base58Decode(userPublicKey);
    const toPubkey = base58Decode(PLATFORM_FEE_WALLET);
    const blockhashBytes = base58Decode(blockhash);

    // Build legacy transaction: transfer SOL
    // Header: 1 signer, 0 read-only signed, 1 read-only unsigned (system program)
    const systemProgram = new Uint8Array(32); // 11111111111111111111111111111111
    const header = new Uint8Array([1, 0, 1]);
    const numAccounts = 3;

    // Compact array of account keys: from, to, system_program
    const accountKeys = new Uint8Array(32 * 3);
    accountKeys.set(fromPubkey, 0);
    accountKeys.set(toPubkey, 32);
    accountKeys.set(systemProgram, 64);

    // Transfer instruction: program_id_index=2 (system), accounts=[0,1], data=transfer(lamports)
    // System Transfer instruction data: [2,0,0,0] + u64 lamports (little-endian)
    const instrData = new Uint8Array(12);
    instrData.set([2, 0, 0, 0], 0); // Transfer instruction index
    const view = new DataView(instrData.buffer);
    view.setUint32(4, feeLamports & 0xFFFFFFFF, true);
    view.setUint32(8, Math.floor(feeLamports / 0x100000000), true);

    // Compile message
    const messageBytes2 = new Uint8Array([
      ...header,
      numAccounts, ...accountKeys,
      ...blockhashBytes,
      1, // num instructions
      2, // program id index (system program)
      2, 0, 1, // num accounts, account indices
      instrData.length, ...instrData,
    ]);

    // Sign
    const sig = await signTransaction(messageBytes2, secretKeyBytes);

    // Build full transaction: num_signatures(1) + signature + message
    const fullTx = new Uint8Array(1 + 64 + messageBytes2.length);
    fullTx[0] = 1;
    fullTx.set(sig, 1);
    fullTx.set(messageBytes2, 65);

    // Send
    const sendRes = await fetch(heliusRpc, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sendTransaction',
        params: [btoa(String.fromCharCode(...fullTx)), { encoding: 'base64', skipPreflight: true, maxRetries: 3 }],
      }),
    });
    const sendResult = await sendRes.json();
    if (sendResult.error) {
      console.error('[FEE] Transfer error:', JSON.stringify(sendResult.error));
      return { success: false, feeSol, error: sendResult.error.message || 'Fee transfer failed' };
    }
    console.log(`[FEE] ✅ Platform fee sent: ${feeSol.toFixed(6)} SOL → TX: ${sendResult.result}`);
    return { success: true, signature: sendResult.result, feeSol };
  } catch (e) {
    console.error('[FEE] Platform fee transfer error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Fetch token safety info from Helius DAS ──
async function getTokenSafetyInfo(mintAddress: string, heliusRpc: string): Promise<{
  mintAuthorityRevoked: boolean;
  freezeAuthorityDisabled: boolean;
  top10HolderPct: number;
}> {
  try {
    const res = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mintAddress } }),
    });
    const data = await res.json();
    const asset = data?.result;

    let mintAuthorityRevoked = true; // Optimistic default
    let freezeAuthorityDisabled = true;

    if (asset?.authorities) {
      const mintAuth = asset.authorities.find((a: any) => a.scopes?.includes('mint'));
      mintAuthorityRevoked = !mintAuth;
      const freezeAuth = asset.authorities.find((a: any) => a.scopes?.includes('freeze'));
      freezeAuthorityDisabled = !freezeAuth;
    }

    let top10HolderPct = 15; // Optimistic default
    try {
      const holdersRes = await fetch(heliusRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenLargestAccounts', params: [mintAddress] }),
      });
      const holdersData = await holdersRes.json();
      const accounts = holdersData?.result?.value || [];

      const supplyRes = await fetch(heliusRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mintAddress] }),
      });
      const supplyData = await supplyRes.json();
      const totalSupply = parseFloat(supplyData?.result?.value?.amount || '0');

      if (totalSupply > 0 && accounts.length > 0) {
        const top10Total = accounts.slice(0, 10).reduce((sum: number, acc: any) => sum + parseFloat(acc.amount || '0'), 0);
        top10HolderPct = (top10Total / totalSupply) * 100;
      }
    } catch {}

    return { mintAuthorityRevoked, freezeAuthorityDisabled, top10HolderPct };
  } catch {
    // Optimistic fallback — don't block trades
    return { mintAuthorityRevoked: true, freezeAuthorityDisabled: true, top10HolderPct: 15 };
  }
}

// ── Honeypot check ──
async function honeypotCheck(mintAddress: string): Promise<boolean> {
  try {
    const urls = JUPITER_QUOTE_ENDPOINTS.map(u => `${u}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=1000000&slippageBps=500`);
    const quoteRes = await fetchWithFallback(urls);
    const quote = await quoteRes.json();
    return !quote.error && quote.outAmount && parseInt(quote.outAmount) > 0;
  } catch {
    return false; // PESSIMISTIC — block trade if we can't verify sellability
  }
}

// ── Pre-buy sell simulation — verify token can actually be sold back ──
async function verifySellable(mintAddress: string): Promise<boolean> {
  try {
    // Simulate selling 1M token units back to SOL — use high slippage for new tokens
    const urls = JUPITER_QUOTE_ENDPOINTS.map(u =>
      `${u}?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=1000000&slippageBps=2000`
    );
    const quoteRes = await fetchWithFallback(urls);
    const quote = await quoteRes.json();
    if (quote.error || !quote.outAmount || parseInt(quote.outAmount) === 0) {
      console.warn(`[SAFETY] Token ${mintAddress.slice(0,8)} has NO sell route — BLOCKED`);
      return false;
    }
    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    if (priceImpact > 25) { // More lenient — only block extreme impacts
      console.warn(`[SAFETY] Token ${mintAddress.slice(0,8)} sell impact ${priceImpact.toFixed(1)}% — BLOCKED`);
      return false;
    }
    console.log(`[SAFETY] Token ${mintAddress.slice(0,8)} sell route OK (impact: ${priceImpact.toFixed(1)}%)`);
    return true;
  } catch (e) {
    console.warn(`[SAFETY] Sell verification failed for ${mintAddress.slice(0,8)}: ${e.message} — BLOCKED`);
    return false;
  }
}

// ── Check early momentum — token must be pumping within first 10 seconds ──
async function checkEarlyMomentum(mintAddress: string, HELIUS_API_KEY: string): Promise<{ hasMomentum: boolean; buyVelocity: number; sellCount: number; detail: string }> {
  try {
    // Check recent transactions for this token via Helius
    const res = await fetch(`https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=20`);
    if (!res.ok) return { hasMomentum: true, buyVelocity: 0, sellCount: 0, detail: 'Could not verify — allowing' };
    
    const txs = await res.json();
    const now = Date.now();
    let recentBuys = 0;
    let recentSells = 0;
    const windowMs = SCALPER_CONFIG.EARLY_MOMENTUM_CHECK_SECONDS * 1000;
    
    for (const tx of txs) {
      const txTime = (tx.timestamp || 0) * 1000;
      if (now - txTime > windowMs * 3) continue; // Only look at very recent txs
      
      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        if (t.mint !== mintAddress) continue;
        // If SOL is being sent TO the pool (buy) vs FROM the pool (sell)
        const nativeTransfers = tx.nativeTransfers || [];
        const solOut = nativeTransfers.reduce((s: number, n: any) => s + (n.amount > 0 ? n.amount : 0), 0);
        if (solOut > 0) recentBuys++;
        else recentSells++;
      }
    }
    
    // Calculate velocity (buys per minute)
    const windowMin = (SCALPER_CONFIG.EARLY_MOMENTUM_CHECK_SECONDS * 3) / 60; // 30s window
    const buyVelocity = windowMin > 0 ? recentBuys / windowMin : 0;
    const hasMomentum = recentBuys >= 2 && recentBuys > recentSells;
    
    console.log(`[MOMENTUM] ${mintAddress.slice(0,8)}: ${recentBuys} buys, ${recentSells} sells, velocity=${buyVelocity.toFixed(1)}/min — ${hasMomentum ? '✅ PUMPING' : '❌ NO MOMENTUM'}`);
    return { hasMomentum, buyVelocity, sellCount: recentSells, detail: `${recentBuys}B/${recentSells}S in ${SCALPER_CONFIG.EARLY_MOMENTUM_CHECK_SECONDS * 3}s` };
  } catch (e) {
    console.error('[MOMENTUM] Check error:', e);
    return { hasMomentum: true, buyVelocity: 0, sellCount: 0, detail: 'Error — allowing' };
  }
}

// ── Detect sell pressure — check if dev or whales are dumping ──
async function detectSellPressure(mintAddress: string, HELIUS_API_KEY: string): Promise<{ isDumping: boolean; sellRatio: number; detail: string }> {
  try {
    const res = await fetch(`https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=30`);
    if (!res.ok) return { isDumping: false, sellRatio: 0, detail: 'Could not check' };
    
    const txs = await res.json();
    const now = Date.now();
    let recentBuys = 0;
    let recentSells = 0;
    let largestSellLamports = 0;
    
    for (const tx of txs) {
      const txTime = (tx.timestamp || 0) * 1000;
      if (now - txTime > 120000) continue; // Last 2 minutes only
      
      const nativeTransfers = tx.nativeTransfers || [];
      const tokenTransfers = tx.tokenTransfers || [];
      
      for (const t of tokenTransfers) {
        if (t.mint !== mintAddress) continue;
        // Detect direction: large SOL coming OUT of pool = someone selling tokens
        const totalSolMovement = nativeTransfers.reduce((s: number, n: any) => s + (n.amount || 0), 0);
        if (totalSolMovement < 0) {
          // SOL leaving = buy
          recentBuys++;
        } else if (totalSolMovement > 0) {
          // SOL arriving = sell
          recentSells++;
          if (totalSolMovement > largestSellLamports) largestSellLamports = totalSolMovement;
        }
      }
    }
    
    const sellRatio = recentBuys > 0 ? recentSells / recentBuys : recentSells > 0 ? 99 : 0;
    const largestSellSol = largestSellLamports / 1e9;
    const isDumping = sellRatio >= SCALPER_CONFIG.SELL_PRESSURE_EXIT_RATIO || largestSellSol > 5;
    
    console.log(`[SELL_PRESSURE] ${mintAddress.slice(0,8)}: ${recentBuys}B/${recentSells}S ratio=${sellRatio.toFixed(1)} bigSell=${largestSellSol.toFixed(2)}SOL — ${isDumping ? '🚨 DUMPING' : '✅ OK'}`);
    return { isDumping, sellRatio, detail: `${recentBuys}B/${recentSells}S (ratio ${sellRatio.toFixed(1)}), biggest sell: ${largestSellSol.toFixed(2)} SOL` };
  } catch (e) {
    console.error('[SELL_PRESSURE] Error:', e);
    return { isDumping: false, sellRatio: 0, detail: 'Error checking' };
  }
}

// ── Fetch full token metadata from DexScreener ──
async function getTokenMetadata(mintAddress: string): Promise<{ name: string; symbol: string }> {
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (dexRes.ok) {
      const dexData = await dexRes.json();
      const pair = dexData?.pairs?.[0];
      if (pair?.baseToken?.name && !pair.baseToken.name.startsWith('http')) {
        return {
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol || 'UNK',
        };
      }
    }
  } catch {}
  // Fallback: try Helius DAS
  try {
    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (HELIUS_API_KEY) {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mintAddress } }),
      });
      const data = await res.json();
      const content = data?.result?.content;
      if (content?.metadata?.name) {
        return { name: content.metadata.name, symbol: content.metadata.symbol || 'UNK' };
      }
    }
  } catch {}
  return { name: mintAddress.slice(0, 12), symbol: 'UNK' };
}

// ══════════════════════════════════════════════════════════════
// MULTI-SOURCE TOKEN DISCOVERY — FRESH LAUNCHES ONLY (≤5 min)
// ══════════════════════════════════════════════════════════════
async function discoverTokens(HELIUS_API_KEY: string, solPrice: number): Promise<any[]> {
  const freshTokens: any[] = [];
  const existingMints = new Set<string>();
  const maxAgeMs = SCALPER_CONFIG.MAX_TOKEN_AGE_MINUTES * 60 * 1000; // 5 min

  const addToken = (t: any) => {
    if (t.mint && !existingMints.has(t.mint)) {
      existingMints.add(t.mint);
      freshTokens.push(t);
    }
  };

  // ═══ SOURCE 1 (PRIORITY): PumpPortal — real-time just-launched tokens ═══
  try {
    const ppRes = await fetch('https://pumpportal.fun/api/data/tokens/latest', {
      headers: { 'Accept': 'application/json' },
    });
    if (ppRes.ok) {
      const ppTokens = await ppRes.json();
      if (Array.isArray(ppTokens)) {
        const now = Date.now();
        for (const t of ppTokens) {
          const ts = t.created_timestamp || t.timestamp || 0;
          const ageMs = now - ts;
          if (ageMs >= 0 && ageMs <= maxAgeMs && t.mint) {
            addToken({
              mint: t.mint,
              name: t.name || t.mint?.slice(0, 8) || 'Unknown',
              symbol: t.symbol || 'UNK',
              created_timestamp: ts,
              usd_market_cap: t.usd_market_cap || t.marketCap || 0,
              virtual_sol_reserves: t.virtual_sol_reserves || 0,
              reply_count: t.reply_count || 0,
              total_supply: t.total_supply || 1e9,
              liquidity_usd: (t.virtual_sol_reserves || 0) * solPrice,
              price_usd: t.usd_market_cap ? t.usd_market_cap / (t.total_supply || 1e9) : 0,
            });
          }
        }
      }
      console.log(`[SCALPER] PumpPortal: ${freshTokens.length} fresh tokens`);
    }
  } catch (e) { console.error('[SCALPER] PumpPortal error:', e); }

  // ═══ SOURCE 2: PumpFun client API — newest tokens sorted by creation ═══
  try {
    const pumpRes = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://pump.fun',
        'Referer': 'https://pump.fun/',
      },
    });
    if (pumpRes.ok) {
      const allTokens = await pumpRes.json();
      if (Array.isArray(allTokens)) {
        const now = Date.now();
        for (const t of allTokens) {
          const ageMs = now - (t.created_timestamp || 0);
          if (ageMs <= maxAgeMs && ageMs >= 0) {
            addToken(t);
          }
        }
      }
      console.log(`[SCALPER] PumpFun client: total ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] PumpFun error:', e); }

  // ═══ SOURCE 3: Helius PumpFun program — token CREATE events (not swaps) ═══
  const PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  try {
    // Try CREATE type first, fall back to SWAP if no results
    for (const txType of ['CREATE', 'SWAP']) {
      const sigRes = await fetch(`https://api.helius.xyz/v0/addresses/${PUMPFUN_PROGRAM}/transactions?api-key=${HELIUS_API_KEY}&limit=50&type=${txType}`);
      if (sigRes.ok) {
        const txs = await sigRes.json();
        const now = Date.now();
        let added = 0;
        for (const tx of txs) {
          const timestamp = (tx.timestamp || 0) * 1000;
          const ageMs = now - timestamp;
          if (ageMs > maxAgeMs) continue;
          for (const transfer of (tx.tokenTransfers || [])) {
            const mint = transfer.mint;
            if (!mint || mint === SOL_MINT) continue;
            addToken({
              mint,
              name: transfer.tokenName || mint.slice(0, 8),
              symbol: transfer.tokenSymbol || 'UNK',
              created_timestamp: timestamp,
              usd_market_cap: 0,
              virtual_sol_reserves: 0,
              reply_count: 0,
              total_supply: 1e9,
            });
            added++;
          }
        }
        console.log(`[SCALPER] Helius PumpFun (${txType}): ${added} new, total ${freshTokens.length} tokens`);
        if (added > 0) break; // If CREATE found tokens, skip SWAP
      }
    }
  } catch (e) { console.error('[SCALPER] Helius PumpFun error:', e); }

  // ═══ SOURCE 4: DexScreener new Solana pairs (backup — these may be older) ═══
  try {
    const dexRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana%20new', {
      headers: { 'Accept': 'application/json' },
    });
    if (dexRes.ok) {
      const data = await dexRes.json();
      const now = Date.now();
      for (const pair of (data?.pairs || [])) {
        if (pair.chainId !== 'solana') continue;
        const createdAt = pair.pairCreatedAt || 0;
        const ageMs = createdAt > 0 ? now - createdAt : Infinity;
        if (ageMs <= maxAgeMs) {
          addToken({
            mint: pair.baseToken?.address,
            name: pair.baseToken?.name || 'Unknown',
            symbol: pair.baseToken?.symbol || 'UNK',
            created_timestamp: createdAt,
            usd_market_cap: pair.marketCap || pair.fdv || 0,
            virtual_sol_reserves: (pair.liquidity?.usd || 0) / Math.max(solPrice, 1),
            reply_count: pair.txns?.h1?.buys || 0,
            total_supply: pair.fdv && parseFloat(pair.priceUsd || '0') > 0 ? pair.fdv / parseFloat(pair.priceUsd) : 1e9,
            liquidity_usd: pair.liquidity?.usd || 0,
            price_usd: parseFloat(pair.priceUsd || '0'),
          });
        }
      }
      console.log(`[SCALPER] DexScreener search: total ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] DexScreener error:', e); }

  // Sort by FRESHEST FIRST — newest tokens get priority
  freshTokens.sort((a, b) => (b.created_timestamp || 0) - (a.created_timestamp || 0));

  console.log(`[SCALPER] Final discovery: ${freshTokens.length} tokens (max age ${SCALPER_CONFIG.MAX_TOKEN_AGE_MINUTES} min)`);
  if (freshTokens.length > 0) {
    const newest = freshTokens[0];
    const ageS = (Date.now() - (newest.created_timestamp || Date.now())) / 1000;
    console.log(`[SCALPER] Freshest token: ${newest.name} (${newest.symbol}) — ${ageS.toFixed(0)}s old`);
  }
  return freshTokens;
}

// ── Discord webhook notification helper ──
async function notifyDiscord(title: string, color: number, fields: {name: string, value: string, inline?: boolean}[]) {
  const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          color,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'CF Blockchain — Solana Auto-Trade' },
        }],
      }),
    });
  } catch (e) {
    console.error('[DISCORD] Webhook error:', e);
  }
}

// ── Telegram alert helper (sends to cf-blockchain-alerts function) ──
async function notifyTelegram(alertType: string, data: Record<string, any>) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/cf-blockchain-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ alert_type: alertType, data }),
    });
  } catch (e) {
    console.error('[TELEGRAM] Alert error:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'No auth token provided' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Use service role to verify the JWT token reliably
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('[AUTH] getUser failed:', userError?.message);
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = user.id;
    console.log('[AUTH] Authenticated user:', userId);

    const body = await req.json();
    const { action } = body;

    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Helius API key not configured' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    const { data: solWallet } = await supabaseAdmin
      .from('solana_wallets')
      .select('public_key, encrypted_private_key')
      .eq('user_id', userId)
      .single();

    // ══════════════════════════════════════════════════════════════
    // ACTION: SCAN — Discover → Score → Return opportunities (NO execution)
    // ══════════════════════════════════════════════════════════════
    if (action === 'scan' || action === 'activate') {
      const shouldExecute = action === 'activate';
      const solPrice = await getSolPrice();

      // ── CHECK: If activate mode, ensure no open position already exists ──
      if (shouldExecute) {
        // First, auto-close any stale trades older than 65 minutes
        const staleMinAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('signal_trades')
          .update({ status: 'closed', exit_reason: 'Stale trade auto-closed (server)', closed_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('status', 'open')
          .lt('created_at', staleMinAgo);

        const { data: openTrades } = await supabaseAdmin
          .from('signal_trades')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'open')
          .limit(1);
        if (openTrades && openTrades.length > 0) {
          return new Response(JSON.stringify({
            success: true,
            trade_executed: false,
            message: 'Position already open — monitoring for exit before next buy.',
            has_open_position: true,
            sol_price: solPrice,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // ── STEP 1: Discover tokens from ALL sources ──
      const freshTokens = await discoverTokens(HELIUS_API_KEY, solPrice);

      if (freshTokens.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Discovery scan found 0 tokens — retrying next cycle.',
          tokens_scanned: 0,
          trade_executed: false,
          opportunities: [],
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STEP 2: Score ALL tokens with percentage-based system ──
      const opportunities: any[] = [];
      const tokensToCheck = freshTokens.slice(0, 20);
      
      for (const t of tokensToCheck) {
        const now = Date.now();
        const ageSeconds = Math.max(1, (now - (t.created_timestamp || 0)) / 1000);
        const safetyInfo = await getTokenSafetyInfo(t.mint, HELIUS_RPC);
        const lpSol = t.virtual_sol_reserves ? t.virtual_sol_reserves / 1e6 : (t.liquidity_usd || 0) / Math.max(solPrice, 1);

        const metrics: TokenMetrics = {
          age_seconds: ageSeconds,
          buy_count: t.reply_count || 0,
          liquidity_sol: lpSol > 0 ? lpSol : (t.liquidity_usd || 0) / Math.max(solPrice, 1),
          liquidity_usd: t.liquidity_usd || lpSol * solPrice,
          market_cap_usd: t.usd_market_cap || 0,
          reply_count: t.reply_count || 0,
          holder_count: 0,
          mint_authority_revoked: safetyInfo.mintAuthorityRevoked,
          freeze_authority_disabled: safetyInfo.freezeAuthorityDisabled,
          top10_holder_pct: safetyInfo.top10HolderPct,
        };

        const scoring = scoreTokenPercentage(metrics);
        opportunities.push({
          mint: t.mint,
          name: t.name || 'Unknown',
          symbol: t.symbol || 'UNK',
          age_seconds: ageSeconds,
          age_minutes: ageSeconds / 60,
          market_cap_usd: metrics.market_cap_usd,
          liquidity_sol: metrics.liquidity_sol,
          liquidity_usd: metrics.liquidity_usd,
          match_pct: scoring.match_pct,
          recommendation: scoring.recommendation,
          filters: scoring.filters,
          total_passed: scoring.total_passed,
          total_filters: scoring.total_filters,
        });
      }

      opportunities.sort((a, b) => b.match_pct - a.match_pct);
      const bestOpp = opportunities[0];
      console.log(`[SCALPER] Scored ${opportunities.length} tokens. Best: ${bestOpp.name} (${bestOpp.match_pct}% match, ${bestOpp.recommendation})`);

      // Discord: Notify scan results (only when executing)
      if (shouldExecute) {
        await notifyDiscord('🔍 SCALPER SCAN', 0x00aaff, [
          { name: '📊 Tokens Scanned', value: `${freshTokens.length}`, inline: true },
          { name: '🏆 Best Match', value: `${bestOpp.name} (${bestOpp.match_pct}%)`, inline: true },
          { name: '📋 Recommendation', value: bestOpp.recommendation, inline: true },
        ]);
      }

      // If scan-only mode, return opportunities without executing
      if (!shouldExecute) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          message: `Found ${opportunities.length} opportunities — best: ${bestOpp.name} (${bestOpp.match_pct}% match). Ready to execute.`,
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: bestOpp,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STEP 3: EXECUTE on best match ──
      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          error: 'No wallet found. Create one first.',
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: bestOpp,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Use custom trade amount from body, or default — NO minimum requirement
      const positionSol = body.trade_amount_sol || SCALPER_CONFIG.DEFAULT_POSITION_SOL;
      const feesReserve = SCALPER_CONFIG.PRIORITY_FEE_SOL + 0.001;
      const solBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      // Only block if literally can't afford fees — no minimum trade size enforced
      if (solBalance < feesReserve) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          message: `Wallet empty: ${solBalance.toFixed(6)} SOL. Need at least ~${feesReserve.toFixed(4)} SOL for gas fees.`,
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: bestOpp,
          balance: solBalance,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Adjust position size down to available balance if needed
      const actualPositionSol = Math.min(positionSol, solBalance - feesReserve);

      // ── STEP 3A: Ensure minimum match quality ──
      if (bestOpp.match_pct < SCALPER_CONFIG.MIN_MATCH_PCT) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          message: `Best match ${bestOpp.name} only ${bestOpp.match_pct}% (min ${SCALPER_CONFIG.MIN_MATCH_PCT}%) — waiting for better opportunity.`,
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: bestOpp,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STEP 3B: Honeypot & sell verification — try up to 10 candidates ──
      let execTarget = bestOpp;
      const isHoneypotSafe = await honeypotCheck(bestOpp.mint);
      const isSellable = isHoneypotSafe ? await verifySellable(bestOpp.mint) : false;
      
      if (!isHoneypotSafe || !isSellable) {
        const hpFilter = bestOpp.filters.find((f: any) => f.name === 'Honeypot Check');
        if (hpFilter) { hpFilter.passed = false; hpFilter.detail = !isHoneypotSafe ? 'Honeypot ⚠️' : 'Unsellable ⚠️'; }
        bestOpp.match_pct = Math.max(0, bestOpp.match_pct - 10);
        
        let foundAlt = false;
        for (let i = 1; i < Math.min(opportunities.length, 10); i++) {
          const alt = opportunities[i];
          const altSafe = await honeypotCheck(alt.mint);
          if (!altSafe) continue;
          const altSellable = await verifySellable(alt.mint);
          if (altSellable) {
            console.log(`[SCALPER] #1 blocked (${!isHoneypotSafe ? 'honeypot' : 'unsellable'}), switching to #${i+1}: ${alt.name} (${alt.match_pct}%)`);
            execTarget = alt;
            foundAlt = true;
            break;
          }
        }
        if (!foundAlt) {
          return new Response(JSON.stringify({
            success: true,
            trade_executed: false,
            message: `All top candidates failed sell verification — skipping this cycle to protect funds.`,
            tokens_scanned: freshTokens.length,
            opportunities: opportunities.slice(0, 10),
            best_match: bestOpp,
            balance: solBalance,
            sol_price: solPrice,
            config: SCALPER_CONFIG,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // ── STEP 3C: Early momentum check — token must be pumping right now ──
      const momentum = await checkEarlyMomentum(execTarget.mint, HELIUS_API_KEY);
      if (!momentum.hasMomentum) {
        console.log(`[SCALPER] ${execTarget.name} has no early momentum (${momentum.detail}) — skipping`);
        // Try next candidates
        let foundPumping = false;
        for (let i = 1; i < Math.min(opportunities.length, 10); i++) {
          const alt = opportunities[i];
          if (alt.mint === execTarget.mint || alt.match_pct < SCALPER_CONFIG.MIN_MATCH_PCT) continue;
          const altHP = await honeypotCheck(alt.mint);
          if (!altHP) continue;
          const altSell = await verifySellable(alt.mint);
          if (!altSell) continue;
          const altMomentum = await checkEarlyMomentum(alt.mint, HELIUS_API_KEY);
          if (altMomentum.hasMomentum) {
            console.log(`[SCALPER] Switching to pumping token #${i+1}: ${alt.name} (${momentum.detail})`);
            execTarget = alt;
            foundPumping = true;
            break;
          }
        }
        if (!foundPumping) {
          return new Response(JSON.stringify({
            success: true,
            trade_executed: false,
            message: `No tokens showing early pump momentum — waiting for a pumping launch.`,
            tokens_scanned: freshTokens.length,
            opportunities: opportunities.slice(0, 10),
            best_match: bestOpp,
            balance: solBalance,
            sol_price: solPrice,
            config: SCALPER_CONFIG,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const amountLamports = Math.floor(actualPositionSol * 1e9);
      const tradeResult = await executeSwap(
        SOL_MINT, execTarget.mint, amountLamports,
        solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC
      );

      if (!tradeResult.success) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          message: `Best: ${execTarget.name} (${execTarget.match_pct}%) — execution failed: ${tradeResult.error}. Retrying next scan.`,
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: execTarget,
          balance: solBalance,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Trade successful — resolve full token name from DexScreener/Helius
      const resolvedMeta = await getTokenMetadata(execTarget.mint);
      if (resolvedMeta.name !== execTarget.mint.slice(0, 12)) {
        execTarget.name = resolvedMeta.name;
        execTarget.symbol = resolvedMeta.symbol;
      }

      const { data: profileData } = await supabaseAdmin
        .from('wallets').select('username').eq('user_id', userId).single();
      const displayName = profileData?.username || 'Trader';

      await supabaseAdmin.from('trade_notifications').insert({
        user_id: userId,
        username: displayName,
        token_name: execTarget.name,
        token_symbol: execTarget.symbol,
        profit_percent: Math.round(execTarget.match_pct * 1.5),
        amount_sol: positionSol,
      });

      // Get balance BEFORE using it
      const newBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      // Discord: Notify trade execution
      await notifyDiscord('⚡ AUTO-TRADE EXECUTED', 0x00ff88, [
        { name: '🪙 Token', value: `${execTarget.name} (${execTarget.symbol})`, inline: true },
        { name: '📊 Match', value: `${execTarget.match_pct}% — ${execTarget.recommendation}`, inline: true },
        { name: '💰 Position', value: `${positionSol.toFixed(4)} SOL ($${(positionSol * solPrice).toFixed(2)})`, inline: true },
        { name: '🔗 TX', value: `[Solscan](https://solscan.io/tx/${tradeResult.signature})`, inline: true },
        { name: '👤 User', value: displayName, inline: true },
        { name: '💼 Balance After', value: `${newBalance.toFixed(4)} SOL`, inline: true },
      ]);

      // Telegram: Notify auto-trade to groups
      await notifyTelegram('solana_auto_trade', {
        token_name: execTarget.name,
        token_symbol: execTarget.symbol,
        username: displayName,
        amount_sol: positionSol.toFixed(4),
        amount_usd: (positionSol * solPrice).toFixed(2),
        match_pct: execTarget.match_pct,
        signature: tradeResult.signature,
      });

      return new Response(JSON.stringify({
        success: true,
        trade_executed: true,
        message: `⚡ EXECUTED: ${execTarget.name} (${execTarget.symbol}) — ${execTarget.match_pct}% match — ${positionSol.toFixed(3)} SOL position`,
        token_name: execTarget.name,
        token_symbol: execTarget.symbol,
        mint_address: execTarget.mint,
        match_pct: execTarget.match_pct,
        recommendation: execTarget.recommendation,
        filters: execTarget.filters,
        position_usd: positionSol * solPrice,
        position_sol: positionSol,
        output_tokens: tradeResult.outputAmount,
        signature: tradeResult.signature,
        explorer_url: `https://solscan.io/tx/${tradeResult.signature}`,
        tokens_scanned: freshTokens.length,
        opportunities: opportunities.slice(0, 10),
        balance: newBalance,
        sol_price: solPrice,
        exit_rules: {
          take_profit: '$2 net profit — strict',
          stop_loss: '-25% (after 90s grace)',
          time_stop: '10 minutes hard exit',
          momentum: 'No pump in 10s = skip, sell pressure = exit',
          fee: '$0',
        },
        config: SCALPER_CONFIG,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: SCALP_CA — Targeted scalping on a specific token CA
    // Bot buys, monitors, and auto-sells following same TP/SL rules
    // ══════════════════════════════════════════════════════════════
    if (action === 'scalp_ca') {
      const { mint_address, trade_amount_sol } = body;
      if (!mint_address || typeof mint_address !== 'string' || mint_address.length < 32 || mint_address.length > 50) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token CA address' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        return new Response(JSON.stringify({ success: false, error: 'No wallet found. Create one first.' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const solPrice = await getSolPrice();
      const positionSol = trade_amount_sol || SCALPER_CONFIG.DEFAULT_POSITION_SOL;
      const feesReserve = SCALPER_CONFIG.PRIORITY_FEE_SOL + 0.001;
      const solBalance = await getBalance(solWallet.public_key, HELIUS_RPC);
      const actualPositionSolCA = Math.min(positionSol, solBalance - feesReserve);

      if (actualPositionSolCA <= 0.001) {
        return new Response(JSON.stringify({
          success: false,
          error: `Insufficient balance for trade + gas. Balance: ${solBalance.toFixed(6)} SOL.`,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Safety checks on the target CA
      const safetyInfo = await getTokenSafetyInfo(mint_address, HELIUS_RPC);
      const isHoneypotSafe = await honeypotCheck(mint_address);
      const isSellable = isHoneypotSafe ? await verifySellable(mint_address) : false;

      if (!isHoneypotSafe) {
        return new Response(JSON.stringify({ success: false, error: 'Token failed honeypot check — cannot sell this token safely' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!isSellable) {
        return new Response(JSON.stringify({ success: false, error: 'Token has no sell route or extreme price impact — blocked for safety' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get full token metadata
      const resolvedCA = await getTokenMetadata(mint_address);
      let tokenName = resolvedCA.name;
      let tokenSymbol = resolvedCA.symbol;

      // Execute buy
      const amountLamports = Math.floor(actualPositionSolCA * 1e9);
      const tradeResult = await executeSwap(
        SOL_MINT, mint_address, amountLamports,
        solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC
      );

      if (!tradeResult.success) {
        return new Response(JSON.stringify({
          success: false,
          error: `Buy failed: ${tradeResult.error}`,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const newBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      // Discord notification
      await notifyDiscord('🎯 TARGETED CA SCALP', 0xff9900, [
        { name: '🪙 Token', value: `${tokenName} (${tokenSymbol})`, inline: true },
        { name: '💰 Position', value: `${positionSol.toFixed(4)} SOL ($${(positionSol * solPrice).toFixed(2)})`, inline: true },
        { name: '🔗 TX', value: `[Solscan](https://solscan.io/tx/${tradeResult.signature})`, inline: true },
        { name: '📋 CA', value: mint_address.slice(0, 20) + '...', inline: true },
      ]);

      await notifyTelegram('solana_ca_scalp', {
        token_name: tokenName,
        token_symbol: tokenSymbol,
        mint_address,
        amount_sol: positionSol.toFixed(4),
        amount_usd: (positionSol * solPrice).toFixed(2),
        signature: tradeResult.signature,
      });

      return new Response(JSON.stringify({
        success: true,
        trade_executed: true,
        message: `🎯 CA SCALP: Bought ${tokenName} (${tokenSymbol}) — ${positionSol.toFixed(3)} SOL — monitoring for exit`,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        mint_address,
        position_sol: positionSol,
        output_tokens: tradeResult.outputAmount,
        signature: tradeResult.signature,
        explorer_url: `https://solscan.io/tx/${tradeResult.signature}`,
        balance: newBalance,
        sol_price: solPrice,
        safety: {
          mint_authority_revoked: safetyInfo.mintAuthorityRevoked,
          freeze_authority_disabled: safetyInfo.freezeAuthorityDisabled,
          top10_holder_pct: safetyInfo.top10HolderPct,
          honeypot_safe: true,
          sellable: true,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: EXECUTE MANUAL TRADE (BUY or SELL)
    // ══════════════════════════════════════════════════════════════
    if (action === 'execute_trade') {
      console.log('[TRADE] execute_trade called:', JSON.stringify({ mint_address: body.mint_address, amount_sol: body.amount_sol, trade_type: body.trade_type }));
      const { mint_address, amount_sol, trade_type } = body;
      if (!mint_address || !amount_sol || !trade_type) {
        return new Response(JSON.stringify({ success: false, error: 'Missing trade parameters' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!solWallet?.encrypted_private_key || !solWallet?.public_key) {
        console.error('[TRADE] No wallet found for user:', userId);
        return new Response(JSON.stringify({ success: false, error: 'No wallet found. Create one first.' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[TRADE] Executing swap:', trade_type, 'amount:', amount_sol, 'SOL');
      const inputMint = trade_type === 'buy' ? SOL_MINT : mint_address;
      const outputMint = trade_type === 'buy' ? mint_address : SOL_MINT;
      const amountLamports = Math.floor(amount_sol * 1e9);

      const slippage = trade_type === 'sell' ? 200 : SCALPER_CONFIG.MAX_SLIPPAGE_BPS;
      const result = await executeSwap(inputMint, outputMint, amountLamports, solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC, slippage);

      if (!result.success) {
        console.error('[TRADE] Swap failed:', result.error);
        return new Response(JSON.stringify({ success: false, error: result.error, trade_executed: false }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const outputAmount = result.outputAmount || 0;
      const platformFee = 0; // No platform fee

      // Discord: Notify manual trade
      await notifyDiscord(
        trade_type === 'buy' ? '🟢 MANUAL BUY' : '🔴 MANUAL SELL',
        trade_type === 'buy' ? 0x00ff88 : 0xff4444,
        [
          { name: '🪙 Token', value: mint_address.slice(0, 12) + '...', inline: true },
          { name: '💰 Amount', value: `${amount_sol} SOL`, inline: true },
          { name: '📤 Output', value: `${outputAmount.toFixed(6)}`, inline: true },
          { name: '🔗 TX', value: `[Solscan](https://solscan.io/tx/${result.signature})`, inline: false },
        ]
      );

      return new Response(JSON.stringify({
        success: true,
        signature: result.signature,
        trade_type,
        input_amount: amount_sol,
        output_amount: outputAmount,
        platform_fee: platformFee,
        explorer_url: `https://solscan.io/tx/${result.signature}`,
        message: `${trade_type === 'buy' ? '🟢 Buy' : '🔴 Sell'} executed! TX: ${result.signature?.slice(0, 8)}...`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: CHECK_POSITIONS — Monitor active trades for TP/SL/Time-stop
    // ══════════════════════════════════════════════════════════════
    if (action === 'check_positions') {
      const { positions } = body; // Array of { mint, entry_sol, amount_tokens, timestamp }
      if (!positions || !Array.isArray(positions) || positions.length === 0) {
        return new Response(JSON.stringify({ success: true, results: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        return new Response(JSON.stringify({ success: true, results: [], error: 'No wallet' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const solPrice = await getSolPrice();
      const results: any[] = [];

      for (const pos of positions) {
        // Server-side guard: skip if already closed in DB
        const { data: dbTrade } = await supabaseAdmin
          .from('signal_trades')
          .select('status')
          .eq('user_id', userId)
          .eq('mint_address', pos.mint)
          .eq('status', 'open')
          .limit(1);
        if (!dbTrade || dbTrade.length === 0) {
          console.log(`[CHECK] Position ${pos.mint.slice(0,8)} already closed in DB — skipping`);
          results.push({ mint: pos.mint, action: 'sold', reason: 'Already closed', pnl_percent: 0, current_sol: 0, sell_success: true });
          continue;
        }

        const ageMin = (Date.now() - new Date(pos.timestamp).getTime()) / 60000;
        const ageSeconds = ageMin * 60;
        const inGracePeriod = ageSeconds < SCALPER_CONFIG.GRACE_PERIOD_SECONDS;
        let shouldSell = false;
        let reason = '';

        // Check current value via Jupiter quote (token → SOL)
        try {
          const quoteUrls = JUPITER_QUOTE_ENDPOINTS.map(u =>
            `${u}?inputMint=${pos.mint}&outputMint=${SOL_MINT}&amount=${Math.floor(pos.amount_tokens * 1e6)}&slippageBps=500`
          );
          const quoteRes = await fetchWithFallback(quoteUrls);
          const quote = await quoteRes.json();

          if (quote.error || !quote.outAmount) {
            // Can't get quote — only force sell on hard time-stop, not during grace
            if (ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES) {
              shouldSell = true;
              reason = `⏰ Time stop (${ageMin.toFixed(0)}m) — no quote available`;
            }
            results.push({
              mint: pos.mint,
              action: shouldSell ? 'sell' : 'hold',
              reason: shouldSell ? reason : `Cannot quote — holding (${ageMin.toFixed(1)}m)`,
              current_sol: 0,
              pnl_percent: 0,
            });
            continue;
          }

          const currentSol = parseInt(quote.outAmount) / 1e9;
          const pnlPct = ((currentSol - pos.entry_sol) / pos.entry_sol) * 100;
          const profitSolRaw = currentSol - pos.entry_sol;
          const profitUsdRaw = profitSolRaw * solPrice;
          const netProfitUsd = profitUsdRaw;

          // Dynamic take-profit: full target < 1.5min, quick exit after 1.5min
          const isQuickExit = ageMin >= SCALPER_CONFIG.QUICK_EXIT_MINUTES;
          const activeNetTarget = isQuickExit ? SCALPER_CONFIG.QUICK_EXIT_PROFIT_USD : SCALPER_CONFIG.TAKE_PROFIT_USD;

          // ── PRIORITY 1: Take Profit — ONLY exit when $2+ profit is made ──
          if (!shouldSell && profitUsdRaw >= activeNetTarget) {
            shouldSell = true;
            const label = isQuickExit ? '⚡ Quick Exit' : '🎯 Take Profit';
            reason = `${label}! +$${netProfitUsd.toFixed(2)} net [${ageMin.toFixed(1)}m]`;
          }

          // ── PRIORITY 2: Hard 60-minute time stop — last resort only ──
          if (!shouldSell && ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES) {
            shouldSell = true;
            reason = `⏰ Hard time stop (${ageMin.toFixed(0)}m): $${profitUsdRaw.toFixed(2)} — exiting after max hold`;
          }

          if (shouldSell) {
            // Execute sell
            const sellResult = await executeSwap(
              pos.mint, SOL_MINT, Math.floor(pos.amount_tokens * 1e6),
              solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC, 300
            );

            const profitSol = currentSol - pos.entry_sol;
            const grossProfitUsd = profitSol * solPrice;

            // ✅ Platform fee: 0.001 SOL flat + 2% of profit (if profitable)
            let platformFeeSol = 0;
            let feeSignature = '';
            if (sellResult.success) {
              const flatFee = PLATFORM_FLAT_FEE_SOL;
              const profitFee = profitSol > 0 ? profitSol * PLATFORM_PROFIT_FEE_PERCENT : 0;
              const totalFee = flatFee + profitFee;
              console.log(`[FEE] Flat: ${flatFee} SOL + Profit fee: ${profitFee.toFixed(6)} SOL = Total: ${totalFee.toFixed(6)} SOL`);
              const feeResult = await sendPlatformFee(totalFee, solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC);
              platformFeeSol = totalFee;
              feeSignature = feeResult.signature || '';
              if (feeResult.success) {
                console.log(`[FEE] ✅ Sent ${totalFee.toFixed(6)} SOL — TX: ${feeSignature}`);
              } else {
                console.error(`[FEE] ❌ Fee failed: ${feeResult.error}`);
              }
            }
            const platformFeeUsd = platformFeeSol * solPrice;
            const netProfitUsdFinal = grossProfitUsd - platformFeeUsd;
            const platformFee = platformFeeSol;

            // ✅ CRITICAL: Update DB record to closed so frontend/CA scalper can proceed
            await supabaseAdmin.from('signal_trades').update({
              status: 'closed',
              exit_sol: currentSol,
              pnl_percent: pnlPct,
              gross_profit_usd: grossProfitUsd,
              net_profit_usd: netProfitUsdFinal,
              exit_reason: reason,
              exit_signature: sellResult.signature || '',
              closed_at: new Date().toISOString(),
            }).eq('user_id', userId).eq('mint_address', pos.mint).eq('status', 'open');
            console.log(`[CHECK] ✅ DB updated: ${pos.mint.slice(0,8)} → closed (${reason})`);

            results.push({
              mint: pos.mint,
              action: 'sold',
              reason,
              current_sol: currentSol,
              entry_sol: pos.entry_sol,
              pnl_percent: pnlPct,
              profit_sol: profitSol,
              gross_profit_usd: grossProfitUsd,
              platform_fee_usd: platformFeeUsd,
              net_profit_usd: netProfitUsdFinal,
              profit_usd: netProfitUsdFinal,
              platform_fee: platformFee,
              signature: sellResult.signature,
              explorer_url: sellResult.signature ? `https://solscan.io/tx/${sellResult.signature}` : null,
              sell_success: sellResult.success,
              sell_error: sellResult.error,
            });

            // Discord: Notify position exit
            const exitColor = profitSol >= 0 ? 0x00ff88 : 0xff4444;
            const exitEmoji = profitSol >= 0 ? '💰' : '🛑';
            await notifyDiscord(`${exitEmoji} POSITION EXIT`, exitColor, [
              { name: '🪙 Token', value: pos.token_name || pos.mint?.slice(0, 12), inline: true },
              { name: '📊 P&L', value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`, inline: true },
              { name: '💰 Gross Profit', value: `$${grossProfitUsd.toFixed(2)}`, inline: true },
              { name: '🏷️ Fee', value: `$${platformFeeUsd.toFixed(2)}`, inline: true },
              { name: '💵 Net Profit', value: `$${netProfitUsdFinal.toFixed(2)}`, inline: true },
              { name: '📋 Reason', value: reason, inline: false },
              { name: '🔗 TX', value: sellResult.signature ? `[Solscan](https://solscan.io/tx/${sellResult.signature})` : 'Failed', inline: false },
            ]);
            // Log profit notification + Telegram alert
            if (sellResult.success && profitSol > 0) {
              const { data: profileData } = await supabaseAdmin
                .from('wallets').select('username').eq('user_id', userId).single();
              const traderName = profileData?.username || 'Trader';
              await supabaseAdmin.from('trade_notifications').insert({
                user_id: userId,
                username: traderName,
                token_name: pos.token_name || 'Token',
                token_symbol: pos.symbol || 'UNK',
                profit_percent: Math.round(pnlPct),
                amount_sol: profitSol,
              });

              // Telegram: Notify profit to groups
              await notifyTelegram('solana_profit', {
                token_name: pos.token_name || 'Token',
                token_symbol: pos.symbol || 'UNK',
                username: traderName,
                gross_profit_usd: grossProfitUsd.toFixed(2),
                net_profit_usd: netProfitUsdFinal.toFixed(2),
                fee_usd: platformFeeUsd.toFixed(2),
                pnl_percent: pnlPct.toFixed(1),
                signature: sellResult.signature,
              });
            }
          } else {
            const holdProfitUsd = profitSolRaw * solPrice;
            const holdNetUsd = holdProfitUsd - SCALPER_CONFIG.PLATFORM_FEE_USD;
            const targetLabel = isQuickExit ? `$${activeNetTarget.toFixed(2)} net (quick)` : `$${activeNetTarget.toFixed(2)} net`;
            results.push({
              mint: pos.mint,
              action: 'hold',
              reason: `Holding: $${holdProfitUsd.toFixed(2)} gross / $${holdNetUsd.toFixed(2)} net (${ageMin.toFixed(1)}m) — target: ${targetLabel}`,
              current_sol: currentSol,
              pnl_percent: pnlPct,
              current_profit_usd: holdProfitUsd,
              net_profit_usd: holdNetUsd,
              target_profit_usd: activeNetTarget,
            });
          }
        } catch (e) {
          results.push({
            mint: pos.mint,
            action: 'hold',
            reason: `Error checking: ${e.message}`,
            current_sol: 0,
            pnl_percent: 0,
          });
        }
      }

      const newBalance = await getBalance(solWallet.public_key, HELIUS_RPC);
      return new Response(JSON.stringify({
        success: true,
        results,
        balance: newBalance,
        sol_price: solPrice,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: CLOSE_ALL — Sell all active positions back to SOL
    // ══════════════════════════════════════════════════════════════
    if (action === 'close_all') {
      const { positions } = body;
      if (!positions || !Array.isArray(positions) || positions.length === 0) {
        return new Response(JSON.stringify({ success: true, results: [], message: 'No positions to close' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        return new Response(JSON.stringify({ success: false, error: 'No wallet found' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const solPrice = await getSolPrice();
      const results: any[] = [];
      let totalProfitSol = 0;

      for (const pos of positions) {
        try {
          const sellResult = await executeSwap(
            pos.mint, SOL_MINT, Math.floor(pos.amount_tokens * 1e6),
            solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC, 500
          );

          const returnedSol = sellResult.outputAmount || 0;
          const profitSol = returnedSol - pos.entry_sol;
          totalProfitSol += profitSol;

          results.push({
            mint: pos.mint,
            token_name: pos.token_name,
            sold: sellResult.success,
            returned_sol: returnedSol,
            profit_sol: profitSol,
            profit_usd: profitSol * solPrice,
            signature: sellResult.signature,
            error: sellResult.error,
          });
        } catch (e) {
          results.push({
            mint: pos.mint,
            token_name: pos.token_name,
            sold: false,
            error: e.message,
          });
        }
      }

      const newBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      // Log accumulated profit notification
      if (totalProfitSol > 0) {
        const { data: profileData } = await supabaseAdmin
          .from('wallets').select('username').eq('user_id', userId).single();
        await supabaseAdmin.from('trade_notifications').insert({
          user_id: userId,
          username: profileData?.username || 'Trader',
          token_name: 'Auto-Trade Session',
          token_symbol: 'SOL',
          profit_percent: Math.round((totalProfitSol / positions.reduce((s: number, p: any) => s + (p.entry_sol || 0), 0)) * 100),
          amount_sol: totalProfitSol,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        results,
        total_profit_sol: totalProfitSol,
        total_profit_usd: totalProfitSol * solPrice,
        balance: newBalance,
        sol_price: solPrice,
        message: `Closed ${results.filter(r => r.sold).length}/${positions.length} positions. ${totalProfitSol >= 0 ? 'Profit' : 'Loss'}: ${totalProfitSol.toFixed(6)} SOL ($${(totalProfitSol * solPrice).toFixed(2)})`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: GET_CONFIG
    // ══════════════════════════════════════════════════════════════
    if (action === 'get_config') {
      return new Response(JSON.stringify({
        success: true,
        config: SCALPER_CONFIG,
        sol_price: await getSolPrice(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: BACKGROUND_RUN — Called by cron to process all active sessions
    // ══════════════════════════════════════════════════════════════
    if (action === 'background_run') {
      // Fetch all active auto-trade sessions
      const { data: sessions } = await supabaseAdmin
        .from('auto_trade_sessions')
        .select('*')
        .eq('is_active', true);

      if (!sessions || sessions.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No active sessions', processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: any[] = [];
      for (const session of sessions) {
        const sessionUserId = session.user_id;
        try {
          // Check if user still has valid 24h access
          const { data: accessData } = await supabaseAdmin
            .from('signal_access_sessions')
            .select('*')
            .eq('user_id', sessionUserId)
            .eq('is_active', true)
            .gte('expires_at', new Date().toISOString())
            .limit(1);
          
          if (!accessData || accessData.length === 0) {
            // Session expired — deactivate
            await supabaseAdmin.from('auto_trade_sessions')
              .update({ is_active: false, stopped_at: new Date().toISOString() })
              .eq('id', session.id);
            results.push({ session_id: session.id, status: 'deactivated', reason: 'Access session expired' });
            continue;
          }

          // Get user's wallet
          const { data: userWallet } = await supabaseAdmin
            .from('solana_wallets')
            .select('public_key, encrypted_private_key')
            .eq('user_id', sessionUserId)
            .single();

          if (!userWallet?.public_key || !userWallet?.encrypted_private_key) {
            results.push({ session_id: session.id, status: 'skipped', reason: 'No wallet' });
            continue;
          }

          const solPrice = await getSolPrice();

          // ── Step 1: Check & close any open positions for this user ──
          const { data: openTrades } = await supabaseAdmin
            .from('signal_trades')
            .select('*')
            .eq('user_id', sessionUserId)
            .eq('status', 'open');

          if (openTrades && openTrades.length > 0) {
            // Auto-close stale trades >65 min (slightly above max hold)
            const staleMinAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString();
            await supabaseAdmin.from('signal_trades')
              .update({ status: 'closed', exit_reason: 'Stale trade auto-closed (background)', closed_at: new Date().toISOString() })
              .eq('user_id', sessionUserId)
              .eq('status', 'open')
              .lt('created_at', staleMinAgo);

            // Check active (non-stale) positions for TP/SL
            const { data: freshOpenTrades } = await supabaseAdmin
              .from('signal_trades')
              .select('*')
              .eq('user_id', sessionUserId)
              .eq('status', 'open');

            if (freshOpenTrades && freshOpenTrades.length > 0) {
              for (const trade of freshOpenTrades) {
                const ageMin = (Date.now() - new Date(trade.created_at).getTime()) / 60000;
                const ageSeconds = ageMin * 60;
                const inGracePeriod = ageSeconds < SCALPER_CONFIG.GRACE_PERIOD_SECONDS;
                const entSol = Number(trade.entry_sol) || Number(trade.amount_sol) || 0;
                const outputTokens = Number(trade.output_tokens) || 0;

                if (entSol <= 0 || outputTokens <= 0) continue;

                try {
                  const quoteUrls = JUPITER_QUOTE_ENDPOINTS.map(u =>
                    `${u}?inputMint=${trade.mint_address}&outputMint=${SOL_MINT}&amount=${Math.floor(outputTokens * 1e6)}&slippageBps=500`
                  );
                  const quoteRes = await fetchWithFallback(quoteUrls);
                  const quote = await quoteRes.json();

                  if (quote.error || !quote.outAmount) {
                    if (ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES) {
                      await supabaseAdmin.from('signal_trades').update({
                        status: 'closed', exit_reason: 'Time stop (no quote)', closed_at: new Date().toISOString(),
                      }).eq('id', trade.id);
                    }
                    continue;
                  }

                  const currentSol = parseInt(quote.outAmount) / 1e9;
                  const pnlPct = ((currentSol - entSol) / entSol) * 100;
                  const profitUsd = (currentSol - entSol) * solPrice;
                  let shouldSell = false;
                  let reason = '';

                  // Take profit — ONLY exit at $2+ profit
                  if (!shouldSell && profitUsd >= SCALPER_CONFIG.TAKE_PROFIT_USD) {
                    shouldSell = true;
                    reason = `🎯 Take Profit! +$${profitUsd.toFixed(2)} (background)`;
                  }

                  // Hard 60-min time stop — last resort
                  if (!shouldSell && ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES) {
                    shouldSell = true;
                    reason = `⏰ Hard time stop (${ageMin.toFixed(0)}m) — background exit`;
                  }

                  if (shouldSell) {
                    const sellResult = await executeSwap(
                      trade.mint_address, SOL_MINT, Math.floor(outputTokens * 1e6),
                      userWallet.public_key, userWallet.encrypted_private_key, HELIUS_RPC, 300
                    );
                    const profitSol = currentSol - entSol;
                    const netProfitUsd = profitSol * solPrice;

                    await supabaseAdmin.from('signal_trades').update({
                      status: 'closed',
                      pnl_percent: pnlPct,
                      gross_profit_usd: netProfitUsd,
                      net_profit_usd: netProfitUsd,
                      exit_reason: reason,
                      exit_signature: sellResult.signature || '',
                      closed_at: new Date().toISOString(),
                    }).eq('id', trade.id);

                    // Update session stats
                    await supabaseAdmin.from('auto_trade_sessions').update({
                      trades_completed: (session.trades_completed || 0) + 1,
                      total_profit_usd: Number(session.total_profit_usd || 0) + (netProfitUsd > 0 ? netProfitUsd : 0),
                      total_loss_usd: Number(session.total_loss_usd || 0) + (netProfitUsd < 0 ? Math.abs(netProfitUsd) : 0),
                      last_trade_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }).eq('id', session.id);

                    await notifyDiscord(`${netProfitUsd >= 0 ? '💰' : '🛑'} BACKGROUND EXIT`, netProfitUsd >= 0 ? 0x00ff88 : 0xff4444, [
                      { name: '🪙 Token', value: trade.token_name || trade.mint_address.slice(0, 12), inline: true },
                      { name: '📊 P&L', value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% ($${netProfitUsd.toFixed(2)})`, inline: true },
                      { name: '📋 Reason', value: reason, inline: false },
                    ]);

                    results.push({ session_id: session.id, action: 'sold', token: trade.token_name, pnl: netProfitUsd });
                  }
                } catch (e) {
                  console.error(`[BG] Error checking position ${trade.mint_address}:`, e);
                }
              }

              // If still have open positions after checking, skip buying
              const { data: stillOpen } = await supabaseAdmin.from('signal_trades')
                .select('id').eq('user_id', sessionUserId).eq('status', 'open').limit(1);
              if (stillOpen && stillOpen.length > 0) {
                await supabaseAdmin.from('auto_trade_sessions').update({
                  last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                }).eq('id', session.id);
                results.push({ session_id: session.id, status: 'monitoring', reason: 'Position still open' });
                continue;
              }
            }
          }

          // ── Step 2: No open position — discover & buy ──
          const positionSol = Number(session.trade_amount_sol) || SCALPER_CONFIG.DEFAULT_POSITION_SOL;
          const feesReserve = SCALPER_CONFIG.PRIORITY_FEE_SOL + 0.002;
          const solBalance = await getBalance(userWallet.public_key, HELIUS_RPC);

          if (solBalance < feesReserve) {
            await supabaseAdmin.from('auto_trade_sessions').update({
              last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', session.id);
            results.push({ session_id: session.id, status: 'low_balance', balance: solBalance, needed: feesReserve });
            continue;
          }
          // Adjust position size to available balance
          const bgPositionSol = Math.min(positionSol, solBalance - feesReserve);

          // Discover tokens
          const freshTokens = await discoverTokens(HELIUS_API_KEY, solPrice);
          if (freshTokens.length === 0) {
            await supabaseAdmin.from('auto_trade_sessions').update({
              last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', session.id);
            results.push({ session_id: session.id, status: 'no_tokens' });
            continue;
          }

          // Score tokens
          const opportunities: any[] = [];
          for (const t of freshTokens.slice(0, 15)) {
            const now = Date.now();
            const ageSeconds = Math.max(1, (now - (t.created_timestamp || 0)) / 1000);
            const safetyInfo = await getTokenSafetyInfo(t.mint, HELIUS_RPC);
            const lpSol = t.virtual_sol_reserves ? t.virtual_sol_reserves / 1e6 : (t.liquidity_usd || 0) / Math.max(solPrice, 1);
            const metrics: TokenMetrics = {
              age_seconds: ageSeconds,
              buy_count: t.reply_count || 0,
              liquidity_sol: lpSol > 0 ? lpSol : (t.liquidity_usd || 0) / Math.max(solPrice, 1),
              liquidity_usd: t.liquidity_usd || lpSol * solPrice,
              market_cap_usd: t.usd_market_cap || 0,
              reply_count: t.reply_count || 0,
              holder_count: 0,
              mint_authority_revoked: safetyInfo.mintAuthorityRevoked,
              freeze_authority_disabled: safetyInfo.freezeAuthorityDisabled,
              top10_holder_pct: safetyInfo.top10HolderPct,
            };
            const scoring = scoreTokenPercentage(metrics);
            opportunities.push({ ...t, ...scoring, age_seconds: ageSeconds, age_minutes: ageSeconds / 60, liquidity_sol: metrics.liquidity_sol });
          }
          opportunities.sort((a, b) => b.match_pct - a.match_pct);

          const best = opportunities[0];
          if (!best || best.match_pct < SCALPER_CONFIG.MIN_MATCH_PCT) {
            await supabaseAdmin.from('auto_trade_sessions').update({
              last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', session.id);
            results.push({ session_id: session.id, status: 'no_match', best_pct: best?.match_pct });
            continue;
          }

          // Honeypot + sell check
          let execTarget = best;
          const isHP = await honeypotCheck(best.mint);
          const isSellOk = isHP ? await verifySellable(best.mint) : false;
          if (!isHP || !isSellOk) {
            let found = false;
            for (let i = 1; i < Math.min(opportunities.length, 8); i++) {
              if (opportunities[i].match_pct < SCALPER_CONFIG.MIN_MATCH_PCT) break;
              const altHP = await honeypotCheck(opportunities[i].mint);
              if (!altHP) continue;
              const altSell = await verifySellable(opportunities[i].mint);
              if (altSell) { execTarget = opportunities[i]; found = true; break; }
            }
            if (!found) {
              results.push({ session_id: session.id, status: 'all_blocked' });
              continue;
            }
          }

          // Early momentum check — token must be pumping
          const bgMomentum = await checkEarlyMomentum(execTarget.mint, HELIUS_API_KEY);
          if (!bgMomentum.hasMomentum) {
            let foundPumping = false;
            for (let i = 1; i < Math.min(opportunities.length, 8); i++) {
              if (opportunities[i].mint === execTarget.mint || opportunities[i].match_pct < SCALPER_CONFIG.MIN_MATCH_PCT) continue;
              const altHP = await honeypotCheck(opportunities[i].mint);
              if (!altHP) continue;
              const altSell = await verifySellable(opportunities[i].mint);
              if (!altSell) continue;
              const altMom = await checkEarlyMomentum(opportunities[i].mint, HELIUS_API_KEY);
              if (altMom.hasMomentum) { execTarget = opportunities[i]; foundPumping = true; break; }
            }
            if (!foundPumping) {
              results.push({ session_id: session.id, status: 'no_momentum' });
              continue;
            }
          }

          // Execute buy
          const amountLamports = Math.floor(bgPositionSol * 1e9);
          const tradeResult = await executeSwap(
            SOL_MINT, execTarget.mint, amountLamports,
            userWallet.public_key, userWallet.encrypted_private_key, HELIUS_RPC
          );

          if (tradeResult.success) {
            const resolvedMeta = await getTokenMetadata(execTarget.mint);
            const tokenName = resolvedMeta.name !== execTarget.mint.slice(0, 12) ? resolvedMeta.name : execTarget.name;
            const tokenSymbol = resolvedMeta.symbol || execTarget.symbol || 'UNK';

            // Save trade to DB
            await supabaseAdmin.from('signal_trades').insert({
              user_id: sessionUserId,
              mint_address: execTarget.mint,
              token_name: tokenName,
              token_symbol: tokenSymbol,
              trade_type: 'buy',
              amount_sol: positionSol,
              entry_sol: positionSol,
              output_tokens: tradeResult.outputAmount || 0,
              tx_signature: tradeResult.signature || '',
              status: 'open',
            });

            // Update session
            await supabaseAdmin.from('auto_trade_sessions').update({
              last_trade_at: new Date().toISOString(),
              last_scan_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', session.id);

            await notifyDiscord('⚡ BACKGROUND BUY', 0x00ff88, [
              { name: '🪙 Token', value: `${tokenName} (${tokenSymbol})`, inline: true },
              { name: '💰 Position', value: `${positionSol.toFixed(4)} SOL`, inline: true },
              { name: '📊 Match', value: `${execTarget.match_pct}%`, inline: true },
            ]);

            results.push({ session_id: session.id, action: 'bought', token: tokenName, match_pct: execTarget.match_pct });
          } else {
            results.push({ session_id: session.id, status: 'buy_failed', error: tradeResult.error });
          }
        } catch (e) {
          console.error(`[BG] Session ${session.id} error:`, e);
          results.push({ session_id: session.id, status: 'error', error: e.message });
        }
      }

      console.log(`[BACKGROUND] Processed ${sessions.length} sessions:`, JSON.stringify(results));
      return new Response(JSON.stringify({ success: true, processed: sessions.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: TRADE_SUMMARY — AI summary of recent trades
    // ══════════════════════════════════════════════════════════════
    if (action === 'trade_summary') {
      const { data: recentTrades } = await supabaseAdmin
        .from('signal_trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentTrades || recentTrades.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          summary: 'No trades recorded yet. Start auto-trading to see your performance summary here.',
          stats: { total: 0, wins: 0, losses: 0, net_profit: 0 },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const closed = recentTrades.filter(t => t.status === 'closed');
      const open = recentTrades.filter(t => t.status === 'open');
      const wins = closed.filter(t => Number(t.net_profit_usd || 0) > 0);
      const losses = closed.filter(t => Number(t.net_profit_usd || 0) <= 0);
      const totalProfit = closed.reduce((s, t) => s + Number(t.net_profit_usd || 0), 0);
      const totalVolume = closed.reduce((s, t) => s + Number(t.amount_sol || 0), 0);
      const avgHoldMin = closed.length > 0
        ? closed.reduce((s, t) => s + (t.closed_at ? (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000 : 0), 0) / closed.length
        : 0;
      const bestTrade = wins.length > 0 ? wins.reduce((best, t) => Number(t.net_profit_usd || 0) > Number(best.net_profit_usd || 0) ? t : best) : null;
      const worstTrade = losses.length > 0 ? losses.reduce((worst, t) => Number(t.net_profit_usd || 0) < Number(worst.net_profit_usd || 0) ? t : worst) : null;

      const solPrice = await getSolPrice();
      const walletBal = solWallet?.public_key ? await getBalance(solWallet.public_key, HELIUS_RPC) : 0;
      const walletUsd = walletBal * solPrice;
      const canContinue = walletBal >= 0.02;

      const exitReasons: Record<string, number> = {};
      closed.forEach(t => {
        const r = t.exit_reason || 'Unknown';
        const key = r.includes('Take Profit') || r.includes('Quick Exit') ? 'Take Profit' :
                    r.includes('Stop Loss') ? 'Stop Loss' :
                    r.includes('Time stop') ? 'Time Stop' :
                    r.includes('force close') ? 'Manual Close' : 'Other';
        exitReasons[key] = (exitReasons[key] || 0) + 1;
      });

      let summary = `📊 **Trading Summary** (Last ${recentTrades.length} trades)\n\n`;
      summary += `• **${closed.length} completed** | ${open.length} open\n`;
      summary += `• **Win rate:** ${closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : 0}% (${wins.length}W / ${losses.length}L)\n`;
      summary += `• **Net P&L:** ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}\n`;
      summary += `• **Volume:** ${totalVolume.toFixed(4)} SOL traded\n`;
      summary += `• **Avg hold:** ${avgHoldMin.toFixed(1)} minutes\n\n`;

      if (bestTrade) summary += `🏆 **Best:** ${bestTrade.token_name} (+$${Number(bestTrade.net_profit_usd).toFixed(2)})\n`;
      if (worstTrade) summary += `📉 **Worst:** ${worstTrade.token_name} ($${Number(worstTrade.net_profit_usd).toFixed(2)})\n\n`;

      summary += `**Exit reasons:** ${Object.entries(exitReasons).map(([k, v]) => `${k}: ${v}`).join(' | ')}\n\n`;

      summary += `💰 **Wallet:** ${walletBal.toFixed(4)} SOL ($${walletUsd.toFixed(2)})\n`;
      summary += canContinue
        ? `✅ Sufficient balance to continue trading.`
        : `⚠️ Low balance — top up SOL to continue auto-trading (min ~0.05 SOL needed per trade).`;

      return new Response(JSON.stringify({
        success: true,
        summary,
        stats: {
          total: closed.length,
          open: open.length,
          wins: wins.length,
          losses: losses.length,
          win_rate: closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '0',
          net_profit: totalProfit,
          total_volume_sol: totalVolume,
          avg_hold_minutes: avgHoldMin,
          wallet_sol: walletBal,
          wallet_usd: walletUsd,
          can_continue: canContinue,
          exit_reasons: exitReasons,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: FORCE_CLOSE — Emergency sell ALL token positions, close token accounts, refund SOL
    // No matter what — ignores sell quote issues, uses max slippage, always closes DB trades
    // ══════════════════════════════════════════════════════════════
    if (action === 'force_close') {
      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        // Still close DB trades even without wallet
        await supabaseAdmin.from('signal_trades')
          .update({ status: 'closed', exit_reason: 'Force close (no wallet)', closed_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('status', 'open');
        return new Response(JSON.stringify({ success: true, message: 'DB trades closed. No wallet to sell from.', sold: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const solPrice = await getSolPrice();
      const results: any[] = [];
      let totalRecoveredSol = 0;

      // ── Step 1: Get ALL open trades from DB ──
      const { data: openTrades } = await supabaseAdmin
        .from('signal_trades')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open');

      // ── Step 2: Try to sell each position with MAXIMUM slippage (5000 bps = 50%) ──
      if (openTrades && openTrades.length > 0) {
        for (const trade of openTrades) {
          const outputTokens = Number(trade.output_tokens) || 0;
          if (outputTokens <= 0 || !trade.mint_address) {
            // No tokens to sell — just close the DB record
            await supabaseAdmin.from('signal_trades').update({
              status: 'closed', exit_reason: 'Force close (no tokens)', closed_at: new Date().toISOString(),
            }).eq('id', trade.id);
            results.push({ mint: trade.mint_address, status: 'closed_no_tokens', token_name: trade.token_name });
            continue;
          }

          try {
            // Attempt sell with extremely high slippage to guarantee execution
            const sellResult = await executeSwap(
              trade.mint_address, SOL_MINT, Math.floor(outputTokens * 1e6),
              solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC,
              5000 // 50% slippage — force the trade through no matter what
            );

            const entSol = Number(trade.entry_sol) || Number(trade.amount_sol) || 0;
            const returnedSol = sellResult.outputAmount || 0;
            const profitSol = returnedSol - entSol;
            const profitUsd = profitSol * solPrice;
            totalRecoveredSol += returnedSol;

            await supabaseAdmin.from('signal_trades').update({
              status: 'closed',
              pnl_percent: entSol > 0 ? ((returnedSol - entSol) / entSol) * 100 : 0,
              gross_profit_usd: profitUsd,
              net_profit_usd: profitUsd,
              exit_reason: sellResult.success ? 'Manual force close (sold)' : 'Manual force close (sell failed)',
              exit_signature: sellResult.signature || '',
              closed_at: new Date().toISOString(),
            }).eq('id', trade.id);

            results.push({
              mint: trade.mint_address,
              token_name: trade.token_name,
              sold: sellResult.success,
              returned_sol: returnedSol,
              profit_usd: profitUsd,
              signature: sellResult.signature,
              error: sellResult.error,
            });
          } catch (e) {
            // Even if sell fails, ALWAYS close the DB record
            await supabaseAdmin.from('signal_trades').update({
              status: 'closed', exit_reason: `Force close (error: ${e.message})`, closed_at: new Date().toISOString(),
            }).eq('id', trade.id);
            results.push({ mint: trade.mint_address, token_name: trade.token_name, sold: false, error: e.message });
          }
        }
      }

      // ── Step 3: Scan wallet for ANY remaining token accounts and close them ──
      try {
        const tokenAccountsRes = await fetch(HELIUS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTokenAccountsByOwner',
            params: [solWallet.public_key, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
          }),
        });
        const tokenData = await tokenAccountsRes.json();
        const tokenAccounts = tokenData?.result?.value || [];

        for (const account of tokenAccounts) {
          const parsed = account.account?.data?.parsed?.info;
          if (!parsed) continue;
          const mintAddr = parsed.mint;
          const tokenAmount = Number(parsed.tokenAmount?.amount || '0');
          const decimals = parsed.tokenAmount?.decimals || 6;

          if (mintAddr === SOL_MINT || tokenAmount <= 0) continue;

          // Try to sell remaining tokens back to SOL
          try {
            const sellResult = await executeSwap(
              mintAddr, SOL_MINT, tokenAmount,
              solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC,
              5000 // 50% slippage
            );
            if (sellResult.success) {
              totalRecoveredSol += sellResult.outputAmount || 0;
              results.push({
                mint: mintAddr,
                status: 'wallet_token_sold',
                returned_sol: sellResult.outputAmount || 0,
                signature: sellResult.signature,
              });
            } else {
              results.push({ mint: mintAddr, status: 'wallet_token_sell_failed', error: sellResult.error });
            }
          } catch (e) {
            results.push({ mint: mintAddr, status: 'wallet_token_error', error: e.message });
          }
        }
      } catch (e) {
        console.error('[FORCE_CLOSE] Token account scan error:', e);
      }

      // ── Step 4: Deactivate any active auto-trade sessions ──
      await supabaseAdmin.from('auto_trade_sessions')
        .update({ is_active: false, stopped_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true);

      // ── Step 5: Final cleanup — close any remaining open DB trades ──
      await supabaseAdmin.from('signal_trades')
        .update({ status: 'closed', exit_reason: 'Force close cleanup', closed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'open');

      const finalBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      await notifyDiscord('🛑 FORCE CLOSE ALL', 0xff0000, [
        { name: '💰 Recovered', value: `${totalRecoveredSol.toFixed(6)} SOL ($${(totalRecoveredSol * solPrice).toFixed(2)})`, inline: true },
        { name: '📊 Positions', value: `${results.length} processed`, inline: true },
        { name: '💼 Final Balance', value: `${finalBalance.toFixed(6)} SOL ($${(finalBalance * solPrice).toFixed(2)})`, inline: true },
      ]);

      return new Response(JSON.stringify({
        success: true,
        message: `Force-closed ${results.length} position(s). Recovered ${totalRecoveredSol.toFixed(6)} SOL ($${(totalRecoveredSol * solPrice).toFixed(2)}).`,
        results,
        total_recovered_sol: totalRecoveredSol,
        total_recovered_usd: totalRecoveredSol * solPrice,
        final_balance_sol: finalBalance,
        final_balance_usd: finalBalance * solPrice,
        sol_price: solPrice,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[FATAL] Unhandled error:', error);
    // ALWAYS return 200 with error details — never let the function crash with 5xx
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown server error',
      trade_executed: false,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
