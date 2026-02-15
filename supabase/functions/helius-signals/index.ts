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
      const signals = [];

      // Fetch new tokens from multiple reliable sources
      // Source 1: PumpPortal API (server-friendly)
      try {
        const pumpPortalRes = await fetch('https://pumpportal.fun/api/data/recent-tokens?limit=50');
        if (pumpPortalRes.ok) {
          const tokens = await pumpPortalRes.json();
          const now = Date.now();

          for (const t of tokens) {
            // PumpPortal returns created_timestamp in ms or ISO string
            const createdAt = typeof t.created_at === 'string' ? new Date(t.created_at).getTime() : (t.created_timestamp || t.timestamp || 0);
            const age = now - createdAt;
            const ageMinutes = age / 60000;

            if (ageMinutes <= 10 && ageMinutes >= 0) {
              signals.push({
                id: t.mint || t.address || t.token_address,
                type: ageMinutes <= 1 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                token_name: t.name || t.token_name || 'Unknown',
                token_symbol: t.symbol || t.token_symbol || 'UNK',
                mint_address: t.mint || t.address || t.token_address,
                market_cap_usd: t.usd_market_cap || t.market_cap || 0,
                liquidity_usd: (t.virtual_sol_reserves || t.liquidity || 0) * solPrice,
                price_usd: t.price || (t.usd_market_cap ? t.usd_market_cap / (t.total_supply || 1e9) : 0),
                created_at: new Date(createdAt).toISOString(),
                age_minutes: Math.round(ageMinutes * 10) / 10,
                buy_count: t.reply_count || t.txns || 0,
                is_fresh: ageMinutes <= 2,
              });
            }
          }
        }
      } catch (e) {
        console.error('PumpPortal fetch error:', e);
      }

      // Source 2: Helius DAS API for recently created fungible tokens
      if (signals.length < 5) {
        try {
          const dasRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 'token-search',
              method: 'searchAssets',
              params: {
                ownerAddress: undefined,
                tokenType: 'fungible',
                sortBy: { sortBy: 'recent_action', sortDirection: 'desc' },
                limit: 30,
              },
            }),
          });
          if (dasRes.ok) {
            const dasData = await dasRes.json();
            const items = dasData?.result?.items || [];
            const now = Date.now();
            for (const item of items) {
              const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
              const ageMinutes = createdAt > 0 ? (now - createdAt) / 60000 : 999;
              if (ageMinutes <= 10 && !signals.find((s: any) => s.mint_address === item.id)) {
                signals.push({
                  id: item.id,
                  type: ageMinutes <= 1 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                  token_name: item.content?.metadata?.name || 'Unknown',
                  token_symbol: item.content?.metadata?.symbol || 'UNK',
                  mint_address: item.id,
                  market_cap_usd: 0,
                  liquidity_usd: 0,
                  price_usd: 0,
                  created_at: new Date(createdAt).toISOString(),
                  age_minutes: Math.round(ageMinutes * 10) / 10,
                  buy_count: 0,
                  is_fresh: ageMinutes <= 2,
                });
              }
            }
          }
        } catch (e) {
          console.error('Helius DAS fetch error:', e);
        }
      }

      // Source 3: Fallback to PumpFun with browser-like headers
      if (signals.length < 3) {
        try {
          const pumpRes = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': 'https://pump.fun/',
            },
          });
          if (pumpRes.ok) {
            const tokens = await pumpRes.json();
            const now = Date.now();
            for (const t of tokens) {
              const age = now - (t.created_timestamp || 0);
              const ageMinutes = age / 60000;
              if (ageMinutes <= 10 && ageMinutes >= 0 && !signals.find((s: any) => s.mint_address === t.mint)) {
                signals.push({
                  id: t.mint,
                  type: ageMinutes <= 1 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                  token_name: t.name || 'Unknown',
                  token_symbol: t.symbol || 'UNK',
                  mint_address: t.mint,
                  market_cap_usd: t.usd_market_cap || 0,
                  liquidity_usd: (t.virtual_sol_reserves || 0) * solPrice,
                  price_usd: t.usd_market_cap ? t.usd_market_cap / (t.total_supply || 1e9) : 0,
                  created_at: new Date(t.created_timestamp).toISOString(),
                  age_minutes: Math.round(ageMinutes * 10) / 10,
                  buy_count: t.reply_count || 0,
                  is_fresh: ageMinutes <= 2,
                });
              }
            }
          }
        } catch (e) {
          console.error('PumpFun fallback error:', e);
        }
      }

      console.log(`[SIGNALS] Found ${signals.length} tokens from all sources`);

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
