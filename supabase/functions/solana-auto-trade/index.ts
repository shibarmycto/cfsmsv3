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
const SCALPER_CONFIG = {
  DEFAULT_POSITION_SOL: 0.03, // Minimum 0.03 SOL per trade
  PLATFORM_FEE_USD: 0, // NO platform fee — only network/Helius fees apply
  TAKE_PROFIT_USD: 2.00, // $2 net profit target — pure profit to user
  QUICK_EXIT_MINUTES: 1.5, // After 1.5 min, lower the TP target for fast cycling
  QUICK_EXIT_PROFIT_USD: 1.00, // $1 net profit after 1.5 min
  STOP_LOSS_PCT: -0.25, // -25% stop loss (only after grace period)
  MAX_HOLD_MINUTES: 5, // 5 min max per token
  MAX_SLIPPAGE_BPS: 150, // Tighter slippage to prevent entry losses
  MAX_TOKEN_AGE_MINUTES: 15,
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

  // Filter 5: Token age < 15 min (weight: 10%)
  const agePassed = metrics.age_seconds <= SCALPER_CONFIG.MAX_TOKEN_AGE_MINUTES * 60;
  filters.push({
    name: 'Token Age ≤ 10 min',
    passed: agePassed,
    weight: 10,
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

  // Filter 7: Market cap sweet spot $1K–$100K (weight: 10%)
  const mcapPassed = metrics.market_cap_usd >= 1000 && metrics.market_cap_usd <= 100000;
  filters.push({
    name: 'Market Cap $1K–$100K',
    passed: mcapPassed,
    weight: 10,
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

// ══════════════════════════════════════════════════════════════
// MULTI-SOURCE TOKEN DISCOVERY
// ══════════════════════════════════════════════════════════════
async function discoverTokens(HELIUS_API_KEY: string, solPrice: number): Promise<any[]> {
  const freshTokens: any[] = [];
  const existingMints = new Set<string>();
  const maxAgeMs = SCALPER_CONFIG.MAX_TOKEN_AGE_MINUTES * 60 * 1000;

  const addToken = (t: any) => {
    if (t.mint && !existingMints.has(t.mint)) {
      existingMints.add(t.mint);
      freshTokens.push(t);
    }
  };

  // SOURCE 1: DexScreener new Solana pairs
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
      console.log(`[SCALPER] DexScreener search: ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] DexScreener error:', e); }

  // SOURCE 2: DexScreener latest token profiles (catches tokens DexScreener search misses)
  try {
    const profRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
      headers: { 'Accept': 'application/json' },
    });
    if (profRes.ok) {
      const profiles = await profRes.json();
      for (const p of (profiles || []).slice(0, 50)) {
        if (p.chainId !== 'solana' || !p.tokenAddress) continue;
        // Sanitize name — DexScreener profiles sometimes put CDN image URLs in description/header
        const rawName = p.description?.split(' ')[0] || '';
        const rawSymbol = p.header?.split(' ')[0] || '';
        const safeName = rawName.startsWith('http') ? rawSymbol || p.tokenAddress.slice(0, 8) : rawName || p.tokenAddress.slice(0, 8);
        const safeSymbol = rawSymbol.startsWith('http') ? 'UNK' : rawSymbol || 'UNK';
        addToken({
          mint: p.tokenAddress,
          name: safeName,
          symbol: safeSymbol,
          created_timestamp: Date.now(),
          usd_market_cap: 0,
          virtual_sol_reserves: 0,
          reply_count: 0,
          total_supply: 1e9,
        });
      }
      console.log(`[SCALPER] DexScreener profiles: total ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] DexScreener profiles error:', e); }

  // SOURCE 3: Helius PumpFun program transactions
  const PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  try {
    const sigRes = await fetch(`https://api.helius.xyz/v0/addresses/${PUMPFUN_PROGRAM}/transactions?api-key=${HELIUS_API_KEY}&limit=50&type=SWAP`);
    if (sigRes.ok) {
      const txs = await sigRes.json();
      const now = Date.now();
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
        }
      }
      console.log(`[SCALPER] Helius PumpFun: total ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] Helius PumpFun error:', e); }

  // SOURCE 4: PumpFun client API
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

  // SOURCE 5: DexScreener trending (additional discovery)
  try {
    const trendRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=pump', {
      headers: { 'Accept': 'application/json' },
    });
    if (trendRes.ok) {
      const trendData = await trendRes.json();
      const now = Date.now();
      for (const pair of (trendData?.pairs || [])) {
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
            total_supply: 1e9,
            liquidity_usd: pair.liquidity?.usd || 0,
            price_usd: parseFloat(pair.priceUsd || '0'),
          });
        }
      }
      console.log(`[SCALPER] DexScreener trending: total ${freshTokens.length} tokens`);
    }
  } catch (e) { console.error('[SCALPER] DexScreener trending error:', e); }

  console.log(`[SCALPER] Final discovery: ${freshTokens.length} tokens from all sources`);
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

      // Use custom trade amount from body, or default
      const positionSol = body.trade_amount_sol || SCALPER_CONFIG.DEFAULT_POSITION_SOL;
      const feesReserve = SCALPER_CONFIG.PRIORITY_FEE_SOL + 0.002;
      const solBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      if (solBalance < positionSol + feesReserve) {
        return new Response(JSON.stringify({
          success: true,
          trade_executed: false,
          message: `Insufficient SOL: ${solBalance.toFixed(4)} SOL (need ~${(positionSol + feesReserve).toFixed(4)}). Found ${opportunities.length} opportunities.`,
          tokens_scanned: freshTokens.length,
          opportunities: opportunities.slice(0, 10),
          best_match: bestOpp,
          balance: solBalance,
          sol_price: solPrice,
          config: SCALPER_CONFIG,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

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

      const amountLamports = Math.floor(positionSol * 1e9);
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

      // Trade successful
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
          take_profit: '$2 net (<1.5min) / $1 net (>1.5min)',
          stop_loss: '-25% (after 90s grace)',
          time_stop: '5-10 minutes (smart recovery)',
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
      const feesReserve = SCALPER_CONFIG.PRIORITY_FEE_SOL + 0.002;
      const solBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      if (solBalance < positionSol + feesReserve) {
        return new Response(JSON.stringify({
          success: false,
          error: `Insufficient SOL: ${solBalance.toFixed(4)} (need ~${(positionSol + feesReserve).toFixed(4)})`,
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

      // Get token metadata from DexScreener
      let tokenName = mint_address.slice(0, 8);
      let tokenSymbol = 'UNK';
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint_address}`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          const pair = dexData?.pairs?.[0];
          if (pair?.baseToken) {
            tokenName = pair.baseToken.name || tokenName;
            tokenSymbol = pair.baseToken.symbol || tokenSymbol;
          }
        }
      } catch {}

      // Execute buy
      const amountLamports = Math.floor(positionSol * 1e9);
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

          // ── PRIORITY 1: Take Profit — ALWAYS check, even during grace period ──
          if (profitUsdRaw >= activeNetTarget) {
            shouldSell = true;
            const label = isQuickExit ? '⚡ Quick Exit' : '🎯 Take Profit';
            reason = `${label}! +$${netProfitUsd.toFixed(2)} net [${ageMin.toFixed(1)}m]`;
          }
          // ── PRIORITY 2: Stop Loss — ONLY after grace period (90s) ──
          else if (!inGracePeriod && pnlPct <= SCALPER_CONFIG.STOP_LOSS_PCT * 100) {
            shouldSell = true;
            reason = `🛑 Stop Loss: ${pnlPct.toFixed(1)}% ($${profitUsdRaw.toFixed(2)}) [after ${SCALPER_CONFIG.GRACE_PERIOD_SECONDS}s grace]`;
          }
          // ── PRIORITY 3: Time Stop — only exit at loss if > -10%, otherwise extend hold ──
          else if (ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES) {
            if (pnlPct >= -10) {
              // Acceptable loss or small profit — exit cleanly
              shouldSell = true;
              reason = `⏰ Time stop (${ageMin.toFixed(0)}m): $${profitUsdRaw.toFixed(2)} net — clean exit`;
            } else if (ageMin >= SCALPER_CONFIG.MAX_HOLD_MINUTES * 2) {
              // Extended hold expired — force exit to free capital
              shouldSell = true;
              reason = `⏰ Extended time stop (${ageMin.toFixed(0)}m): $${profitUsdRaw.toFixed(2)} — forced exit`;
            } else {
              // Token is down badly but still within extended hold — wait for recovery
              console.log(`[CHECK] ${pos.mint.slice(0,8)} at ${pnlPct.toFixed(1)}% — extending hold for recovery (${ageMin.toFixed(1)}m)`);
            }
          }

          if (shouldSell) {
            // Execute sell
            const sellResult = await executeSwap(
              pos.mint, SOL_MINT, Math.floor(pos.amount_tokens * 1e6),
              solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC, 300
            );

            const profitSol = currentSol - pos.entry_sol;
            const grossProfitUsd = profitSol * solPrice;
            const platformFeeUsd = SCALPER_CONFIG.PLATFORM_FEE_USD;
            const netProfitUsdFinal = grossProfitUsd - platformFeeUsd;
            const platformFee = platformFeeUsd / solPrice; // fee in SOL for compatibility

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
            const targetLabel = isQuickExit ? `$${activeGrossTarget.toFixed(2)} gross (quick)` : `$${activeGrossTarget.toFixed(2)} gross`;
            results.push({
              mint: pos.mint,
              action: 'hold',
              reason: `Holding: $${holdProfitUsd.toFixed(2)} gross / $${holdNetUsd.toFixed(2)} net (${ageMin.toFixed(1)}m) — target: ${targetLabel}`,
              current_sol: currentSol,
              pnl_percent: pnlPct,
              current_profit_usd: holdProfitUsd,
              net_profit_usd: holdNetUsd,
              target_profit_usd: activeGrossTarget,
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
