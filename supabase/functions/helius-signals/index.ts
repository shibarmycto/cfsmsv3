import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fetch live SOL price from CoinGecko
async function getLiveSolPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      return data?.solana?.usd || 0;
    }
  } catch {}
  // Fallback: try Jupiter price API
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data?.data?.['So11111111111111111111111111111111111111112']?.price || '0');
    }
  } catch {}
  return 0;
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Helius API key not configured' }), { status: 500, headers: corsHeaders });
    }

    // Parse body once
    const body = await req.json();
    const { action } = body;

    // Get live SOL price for all actions
    const solPrice = await getLiveSolPrice();

    if (action === 'get_signals') {
      const signals: any[] = [];
      const seenMints = new Set<string>();

      const addSignal = (s: any) => {
        if (s.mint_address && !seenMints.has(s.mint_address)) {
          seenMints.add(s.mint_address);
          signals.push(s);
        }
      };

      // ═══ SOURCE 1: DexScreener latest token profiles (free, no auth, very reliable) ═══
      try {
        const dexRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
          headers: { 'Accept': 'application/json' },
        });
        if (dexRes.ok) {
          const profiles = await dexRes.json();
          const now = Date.now();
          let count = 0;
          for (const p of (profiles || [])) {
            if (p.chainId !== 'solana') continue;
            // DexScreener doesn't give creation time in profiles, treat all as recent
            addSignal({
              id: p.tokenAddress,
              type: 'NEW_TOKEN_LAUNCH',
              token_name: p.description?.split(' ')[0] || p.tokenAddress?.slice(0, 8) || 'Unknown',
              token_symbol: p.header?.split(' ')[0] || 'UNK',
              mint_address: p.tokenAddress,
              market_cap_usd: 0,
              liquidity_usd: 0,
              price_usd: 0,
              created_at: new Date().toISOString(),
              age_minutes: 0,
              buy_count: 0,
              is_fresh: true,
            });
            count++;
            if (count >= 30) break;
          }
          console.log(`[SIGNALS] DexScreener profiles: ${count} Solana tokens`);
        } else {
          console.error(`[SIGNALS] DexScreener status: ${dexRes.status}`);
        }
      } catch (e) {
        console.error('[SIGNALS] DexScreener error:', e);
      }

      // ═══ SOURCE 2: DexScreener search for new Solana pairs ═══
      try {
        const searchRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana%20new', {
          headers: { 'Accept': 'application/json' },
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const pairs = searchData?.pairs || [];
          const now = Date.now();
          let count = 0;
          for (const pair of pairs) {
            if (pair.chainId !== 'solana') continue;
            const createdAt = pair.pairCreatedAt || 0;
            const ageMinutes = createdAt > 0 ? (now - createdAt) / 60000 : 999;
            if (ageMinutes <= 30) {
              addSignal({
                id: pair.baseToken?.address || pair.pairAddress,
                type: ageMinutes <= 2 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                token_name: pair.baseToken?.name || 'Unknown',
                token_symbol: pair.baseToken?.symbol || 'UNK',
                mint_address: pair.baseToken?.address || pair.pairAddress,
                market_cap_usd: pair.marketCap || pair.fdv || 0,
                liquidity_usd: pair.liquidity?.usd || 0,
                price_usd: parseFloat(pair.priceUsd || '0'),
                created_at: new Date(createdAt).toISOString(),
                age_minutes: Math.round(ageMinutes * 10) / 10,
                buy_count: pair.txns?.h1?.buys || 0,
                is_fresh: ageMinutes <= 5,
              });
              count++;
            }
            if (count >= 20) break;
          }
          console.log(`[SIGNALS] DexScreener search: ${count} new pairs`);
        }
      } catch (e) {
        console.error('[SIGNALS] DexScreener search error:', e);
      }

      // ═══ SOURCE 3: Helius — monitor PumpFun program for recent token creates ═══
      const PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
      try {
        const sigRes = await fetch(`https://api.helius.xyz/v0/addresses/${PUMPFUN_PROGRAM}/transactions?api-key=${HELIUS_API_KEY}&limit=20&type=SWAP`);
        if (sigRes.ok) {
          const txs = await sigRes.json();
          const now = Date.now();
          let count = 0;
          for (const tx of txs) {
            const timestamp = (tx.timestamp || 0) * 1000;
            const ageMinutes = (now - timestamp) / 60000;
            if (ageMinutes > 30) continue;
            
            // Extract token mints from token transfers
            const tokenTransfers = tx.tokenTransfers || [];
            for (const transfer of tokenTransfers) {
              const mint = transfer.mint;
              if (!mint || mint === 'So11111111111111111111111111111111111111112') continue;
              addSignal({
                id: mint,
                type: ageMinutes <= 2 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                token_name: transfer.tokenName || mint.slice(0, 8),
                token_symbol: transfer.tokenSymbol || 'UNK',
                mint_address: mint,
                market_cap_usd: 0,
                liquidity_usd: 0,
                price_usd: 0,
                created_at: new Date(timestamp).toISOString(),
                age_minutes: Math.round(ageMinutes * 10) / 10,
                buy_count: 0,
                is_fresh: ageMinutes <= 5,
              });
              count++;
            }
          }
          console.log(`[SIGNALS] Helius PumpFun txs: ${count} tokens`);
        }
      } catch (e) {
        console.error('[SIGNALS] Helius PumpFun error:', e);
      }

      // ═══ SOURCE 4: PumpFun client API (may or may not work from edge) ═══
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
          const tokens = await pumpRes.json();
          if (Array.isArray(tokens)) {
            const now = Date.now();
            let count = 0;
            for (const t of tokens) {
              const age = now - (t.created_timestamp || 0);
              const ageMinutes = age / 60000;
              if (ageMinutes <= 30 && ageMinutes >= 0) {
                addSignal({
                  id: t.mint,
                  type: ageMinutes <= 2 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                  token_name: t.name || 'Unknown',
                  token_symbol: t.symbol || 'UNK',
                  mint_address: t.mint,
                  market_cap_usd: t.usd_market_cap || 0,
                  liquidity_usd: (t.virtual_sol_reserves || 0) * solPrice,
                  price_usd: t.usd_market_cap ? t.usd_market_cap / (t.total_supply || 1e9) : 0,
                  created_at: new Date(t.created_timestamp).toISOString(),
                  age_minutes: Math.round(ageMinutes * 10) / 10,
                  buy_count: t.reply_count || 0,
                  is_fresh: ageMinutes <= 5,
                });
                count++;
              }
            }
            console.log(`[SIGNALS] PumpFun client: ${count} tokens`);
          }
        } else {
          const body = await pumpRes.text();
          console.error(`[SIGNALS] PumpFun status ${pumpRes.status}: ${body.slice(0, 200)}`);
        }
      } catch (e) {
        console.error('[SIGNALS] PumpFun error:', e);
      }

      console.log(`[SIGNALS] Total: ${signals.length} tokens from all sources`);

      // Fetch whale transactions via Helius
      try {
        const heliusRes = await fetch(`https://api.helius.xyz/v0/addresses/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4/transactions?api-key=${HELIUS_API_KEY}&limit=10`);
        if (heliusRes.ok) {
          const txs = await heliusRes.json();
          for (const tx of txs) {
            if (tx.nativeTransfers) {
              const totalSol = tx.nativeTransfers.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) / 1e9;
              if (totalSol > 1) {
                signals.push({
                  id: tx.signature,
                  type: 'WHALE_BUY',
                  token_name: 'Jupiter Swap',
                  token_symbol: 'JUP',
                  mint_address: tx.signature,
                  market_cap_usd: 0,
                  liquidity_usd: 0,
                  price_usd: totalSol * solPrice,
                  created_at: new Date(tx.timestamp * 1000).toISOString(),
                  age_minutes: (Date.now() - tx.timestamp * 1000) / 60000,
                  sol_amount: totalSol,
                  is_fresh: false,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Helius fetch error:', e);
      }

      signals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return new Response(JSON.stringify({ signals, helius_connected: true, solPrice }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_balance') {
      const { publicKey } = body;
      if (!publicKey) {
        return new Response(JSON.stringify({ error: 'Public key required' }), { status: 400, headers: corsHeaders });
      }

      try {
        const balRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [publicKey],
          }),
        });
        const balData = await balRes.json();
        const lamports = balData?.result?.value || 0;
        const sol = lamports / 1e9;

        return new Response(JSON.stringify({ lamports, sol, usd: sol * solPrice, solPrice }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to fetch balance' }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
