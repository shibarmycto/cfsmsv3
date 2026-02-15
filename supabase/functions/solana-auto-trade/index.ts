import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

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

async function signTransaction(message: Uint8Array, secretKeyBytes: Uint8Array): Promise<Uint8Array> {
  const seed = secretKeyBytes.slice(0, 32);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    buildPkcs8(seed),
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('Ed25519', privateKey, message);
  return new Uint8Array(signature);
}

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

// ── Poisson-based token scoring model ──
// Evaluates whether a freshly launched token is likely to 2x
// λ = expected buy-rate parameter, we score based on observed buys, liquidity, and momentum
interface TokenMetrics {
  age_seconds: number;
  buy_count: number;
  liquidity_usd: number;
  market_cap_usd: number;
  reply_count: number;
  holder_count: number;
}

function poissonProbability(k: number, lambda: number): number {
  // P(X >= k) = 1 - P(X < k) using cumulative Poisson
  let cdf = 0;
  for (let i = 0; i < k; i++) {
    cdf += (Math.pow(lambda, i) * Math.exp(-lambda)) / factorial(i);
  }
  return 1 - cdf;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= Math.min(n, 170); i++) result *= i;
  return result;
}

function scoreToken(metrics: TokenMetrics): { score: number; reasons: string[]; shouldBuy: boolean } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Buy velocity — Poisson model
  // Expected buys in first 60s for a "good" token: λ = 5
  // If observed buys exceed this significantly, strong signal
  const expectedLambda = 5;
  const buyRate = metrics.age_seconds > 0 ? (metrics.buy_count / metrics.age_seconds) * 60 : 0;
  const poissonScore = poissonProbability(metrics.buy_count, expectedLambda);
  
  if (buyRate >= 10) { score += 35; reasons.push(`High buy velocity: ${buyRate.toFixed(1)}/min`); }
  else if (buyRate >= 5) { score += 20; reasons.push(`Good buy velocity: ${buyRate.toFixed(1)}/min`); }
  else if (buyRate >= 2) { score += 10; reasons.push(`Moderate buy velocity: ${buyRate.toFixed(1)}/min`); }

  // 2. Poisson anomaly score (buys are unusually high vs expected)
  if (poissonScore > 0.95) { score += 20; reasons.push(`Poisson anomaly: p=${poissonScore.toFixed(3)}`); }
  else if (poissonScore > 0.8) { score += 10; reasons.push(`Above-average activity`); }

  // 3. Liquidity check — needs enough to enter AND exit
  if (metrics.liquidity_usd >= 5000) { score += 15; reasons.push(`Strong liquidity: $${metrics.liquidity_usd.toFixed(0)}`); }
  else if (metrics.liquidity_usd >= 1000) { score += 10; reasons.push(`Adequate liquidity: $${metrics.liquidity_usd.toFixed(0)}`); }
  else if (metrics.liquidity_usd < 500) { score -= 20; reasons.push(`Low liquidity risk: $${metrics.liquidity_usd.toFixed(0)}`); }

  // 4. Market cap sweet spot — very low mcap = room to grow, but not zero
  if (metrics.market_cap_usd >= 3000 && metrics.market_cap_usd <= 50000) {
    score += 15; reasons.push(`Sweet spot mcap: $${(metrics.market_cap_usd / 1000).toFixed(1)}K`);
  } else if (metrics.market_cap_usd > 50000 && metrics.market_cap_usd <= 200000) {
    score += 5; reasons.push(`Growing mcap: $${(metrics.market_cap_usd / 1000).toFixed(1)}K`);
  }

  // 5. Social engagement (replies/comments on pump.fun)
  if (metrics.reply_count >= 10) { score += 10; reasons.push(`High engagement: ${metrics.reply_count} replies`); }
  else if (metrics.reply_count >= 3) { score += 5; reasons.push(`Some engagement`); }

  // 6. Freshness bonus — under 60 seconds old is prime
  if (metrics.age_seconds <= 30) { score += 10; reasons.push(`Ultra-fresh: ${metrics.age_seconds}s old`); }
  else if (metrics.age_seconds <= 60) { score += 5; reasons.push(`Fresh: ${metrics.age_seconds}s old`); }

  // Threshold: score >= 60 means strong 2x candidate
  const shouldBuy = score >= 60;

  return { score, reasons, shouldBuy };
}

// Get on-chain SOL balance via Helius
async function getBalance(publicKey: string, heliusRpc: string): Promise<number> {
  try {
    const res = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [publicKey],
      }),
    });
    const data = await res.json();
    return (data?.result?.value || 0) / 1e9;
  } catch { return 0; }
}

// Execute a Jupiter swap
async function executeSwap(
  inputMint: string, outputMint: string, amountLamports: number,
  publicKey: string, privateKeyB58: string, heliusRpc: string
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  // 1. Quote
  const quoteRes = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=500`
  );
  const quote = await quoteRes.json();
  if (quote.error) return { success: false, error: `Quote: ${quote.error}` };

  // 2. Swap TX
  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: publicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  const swapData = await swapRes.json();
  if (swapData.error || !swapData.swapTransaction) {
    return { success: false, error: `Swap build: ${swapData.error || 'No tx'}` };
  }

  // 3. Sign & send
  const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
  const secretKeyBytes = base58Decode(privateKeyB58);
  const messageBytes = txBytes.slice(65);
  const sig = await signTransaction(messageBytes, secretKeyBytes);
  const signedTx = new Uint8Array(txBytes);
  signedTx.set(sig, 1);

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
  if (sendResult.error) return { success: false, error: sendResult.error.message || JSON.stringify(sendResult.error) };

  const outputAmount = parseInt(quote.outAmount) / (outputMint === SOL_MINT ? 1e9 : Math.pow(10, quote.outputDecimals || 6));
  return { success: true, signature: sendResult.result, outputAmount };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action } = body;

    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Helius API key not configured' }), { status: 500, headers: corsHeaders });
    }
    const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // Get user's wallet
    const { data: solWallet } = await supabaseAdmin
      .from('solana_wallets')
      .select('public_key, encrypted_private_key')
      .eq('user_id', userId)
      .single();

    // ── ACTIVATE AUTO-TRADE: Scan, Score, Execute ──
    if (action === 'activate') {
      if (!solWallet?.public_key || !solWallet?.encrypted_private_key) {
        return new Response(JSON.stringify({ error: 'No wallet found. Create one first.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check real on-chain SOL balance
      const solBalance = await getBalance(solWallet.public_key, HELIUS_RPC);
      const tradeAmount = body.trade_amount_sol || 0.01; // default 0.01 SOL per trade

      if (solBalance < tradeAmount + 0.005) { // reserve 0.005 for fees
        return new Response(JSON.stringify({
          error: `Insufficient SOL balance. You have ${solBalance.toFixed(6)} SOL but need at least ${(tradeAmount + 0.005).toFixed(4)} SOL (${tradeAmount} trade + 0.005 fees).`,
          balance: solBalance,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Also deduct 20 platform tokens if available
      const { data: tokenWallet } = await supabase
        .from('wallets').select('balance').eq('user_id', userId).single();
      if (tokenWallet && (tokenWallet.balance || 0) >= 20) {
        await supabase.from('wallets').update({ balance: (tokenWallet.balance || 0) - 20 }).eq('user_id', userId);
      }

      // ── STEP 1: Fetch fresh tokens from PumpFun (last 60 seconds) ──
      let freshTokens: any[] = [];
      try {
        const pumpRes = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false');
        if (pumpRes.ok) {
          const allTokens = await pumpRes.json();
          const now = Date.now();
          freshTokens = allTokens.filter((t: any) => {
            const ageMs = now - (t.created_timestamp || 0);
            return ageMs <= 60000; // last 60 seconds only
          });
        }
      } catch (e) {
        console.error('PumpFun scan error:', e);
      }

      if (freshTokens.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No tokens launched in the last 60 seconds. Auto-trade is active — try again shortly.',
          tokens_scanned: 0,
          trade_executed: false,
          balance: solBalance,
          remaining_tokens: tokenWallet ? Math.max(0, (tokenWallet.balance || 0) - 20) : 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STEP 2: Score each token with Poisson model ──
      const scored = freshTokens.map((t: any) => {
        const now = Date.now();
        const ageSeconds = Math.max(1, (now - (t.created_timestamp || 0)) / 1000);
        
        // Get live SOL price estimate from market cap vs virtual reserves
        const solPriceEst = t.usd_market_cap && t.virtual_sol_reserves
          ? t.usd_market_cap / (t.virtual_sol_reserves / 1e6)
          : 150;

        const metrics: TokenMetrics = {
          age_seconds: ageSeconds,
          buy_count: t.reply_count || 0, // proxy for activity
          liquidity_usd: (t.virtual_sol_reserves || 0) / 1e6 * solPriceEst,
          market_cap_usd: t.usd_market_cap || 0,
          reply_count: t.reply_count || 0,
          holder_count: 0,
        };

        const result = scoreToken(metrics);
        return { token: t, ...result };
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);
      const bestToken = scored[0];

      console.log(`Scanned ${freshTokens.length} fresh tokens. Best: ${bestToken.token.name} (score: ${bestToken.score})`);

      // ── STEP 3: Execute trade if score passes threshold ──
      if (!bestToken.shouldBuy) {
        return new Response(JSON.stringify({
          success: true,
          message: `Scanned ${freshTokens.length} fresh tokens — none passed the Poisson threshold (best score: ${bestToken.score}/100). Monitoring...`,
          tokens_scanned: freshTokens.length,
          best_token: bestToken.token.name,
          best_score: bestToken.score,
          reasons: bestToken.reasons,
          trade_executed: false,
          balance: solBalance,
          remaining_tokens: tokenWallet ? Math.max(0, (tokenWallet.balance || 0) - 20) : 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Execute the buy
      const amountLamports = Math.floor(tradeAmount * 1e9);
      const tradeResult = await executeSwap(
        SOL_MINT, bestToken.token.mint, amountLamports,
        solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC
      );

      if (!tradeResult.success) {
        return new Response(JSON.stringify({
          success: false,
          error: `Trade failed: ${tradeResult.error}`,
          token: bestToken.token.name,
          score: bestToken.score,
          reasons: bestToken.reasons,
          balance: solBalance,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Log the trade to webhook
      const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'AUTO_TRADE_EXECUTED',
              timestamp: new Date().toISOString(),
              user_id: userId,
              token: bestToken.token.name,
              symbol: bestToken.token.symbol,
              mint: bestToken.token.mint,
              score: bestToken.score,
              reasons: bestToken.reasons,
              amount_sol: tradeAmount,
              signature: tradeResult.signature,
              output_tokens: tradeResult.outputAmount,
            }),
          });
        } catch {}
      }

      const newBalance = await getBalance(solWallet.public_key, HELIUS_RPC);

      return new Response(JSON.stringify({
        success: true,
        trade_executed: true,
        message: `⚡ AUTO-TRADE: Bought ${bestToken.token.name} (${bestToken.token.symbol}) for ${tradeAmount} SOL — Score: ${bestToken.score}/100`,
        token_name: bestToken.token.name,
        token_symbol: bestToken.token.symbol,
        mint_address: bestToken.token.mint,
        score: bestToken.score,
        reasons: bestToken.reasons,
        amount_sol: tradeAmount,
        output_tokens: tradeResult.outputAmount,
        signature: tradeResult.signature,
        explorer_url: `https://solscan.io/tx/${tradeResult.signature}`,
        tokens_scanned: freshTokens.length,
        balance: newBalance,
        remaining_tokens: tokenWallet ? Math.max(0, (tokenWallet.balance || 0) - 20) : 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── EXECUTE MANUAL TRADE (BUY or SELL) ──
    if (action === 'execute_trade') {
      const { mint_address, amount_sol, trade_type } = body;
      if (!mint_address || !amount_sol || !trade_type) {
        return new Response(JSON.stringify({ error: 'Missing trade parameters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!solWallet?.encrypted_private_key || !solWallet?.public_key) {
        return new Response(JSON.stringify({ error: 'No wallet found. Create one first.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const inputMint = trade_type === 'buy' ? SOL_MINT : mint_address;
      const outputMint = trade_type === 'buy' ? mint_address : SOL_MINT;
      const amountLamports = Math.floor(amount_sol * 1e9);

      const result = await executeSwap(inputMint, outputMint, amountLamports, solWallet.public_key, solWallet.encrypted_private_key, HELIUS_RPC);

      if (!result.success) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const outputAmount = result.outputAmount || 0;
      const platformFee = trade_type === 'sell' ? Math.max(0, (outputAmount - amount_sol) * 0.01) : 0;

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

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
