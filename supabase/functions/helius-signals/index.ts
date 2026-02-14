import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { action } = await req.json();

    if (action === 'get_signals') {
      // Fetch recent transactions from Helius for known DEX programs
      const signals = [];

      // Fetch from PumpFun API for new token launches
      try {
        const pumpRes = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=30&sort=created_timestamp&order=DESC&includeNsfw=false');
        if (pumpRes.ok) {
          const tokens = await pumpRes.json();
          const now = Date.now();

          for (const t of tokens) {
            const age = now - (t.created_timestamp || 0);
            const ageMinutes = age / 60000;

            if (ageMinutes <= 5) {
              signals.push({
                id: t.mint,
                type: ageMinutes <= 1 ? 'SNIPE_OPPORTUNITY' : 'NEW_TOKEN_LAUNCH',
                token_name: t.name || 'Unknown',
                token_symbol: t.symbol || 'UNK',
                mint_address: t.mint,
                market_cap_usd: t.usd_market_cap || 0,
                liquidity_usd: (t.virtual_sol_reserves || 0) * 150,
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
        console.error('PumpFun fetch error:', e);
      }

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
                  price_usd: totalSol * 150,
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

      // Sort by newest first
      signals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return new Response(JSON.stringify({ signals, helius_connected: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_balance') {
      const { publicKey } = await req.json().catch(() => ({}));
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

        // Get SOL price
        let solPrice = 150;
        try {
          const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
          const priceData = await priceRes.json();
          solPrice = priceData?.solana?.usd || 150;
        } catch {}

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
