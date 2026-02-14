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
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action } = body;

    if (action === 'activate') {
      // Check token balance (using wallets table total_mined as token balance)
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance, total_mined')
        .eq('user_id', userId)
        .single();

      if (!wallet || (wallet.balance || 0) < 20) {
        return new Response(JSON.stringify({ error: 'Insufficient tokens. Need 20 tokens to activate.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Deduct 20 tokens
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: (wallet.balance || 0) - 20 })
        .eq('user_id', userId);

      if (deductError) {
        return new Response(JSON.stringify({ error: 'Failed to deduct tokens' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Auto-trade activated! Monitoring for signals...',
        tokens_deducted: 20,
        remaining_balance: (wallet.balance || 0) - 20,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'execute_trade') {
      const { mint_address, amount_sol, trade_type } = body;

      // Get Jupiter quote
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const inputMint = trade_type === 'buy' ? SOL_MINT : mint_address;
      const outputMint = trade_type === 'buy' ? mint_address : SOL_MINT;
      const amountLamports = Math.floor((amount_sol || 0.01) * 1e9);

      try {
        const quoteRes = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=500`
        );
        const quote = await quoteRes.json();

        if (quote.error) {
          return new Response(JSON.stringify({ error: `Jupiter quote failed: ${quote.error}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          quote: {
            inputAmount: quote.inAmount,
            outputAmount: quote.outAmount,
            priceImpact: quote.priceImpactPct,
            route: quote.routePlan?.map((r: any) => r.swapInfo?.label).join(' → '),
          },
          message: `${trade_type === 'buy' ? 'Buy' : 'Sell'} quote ready. Sign with wallet to execute.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to get Jupiter quote' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'get_trade_log') {
      // Return mock trade log for now (would be stored in DB in production)
      return new Response(JSON.stringify({ trades: [], total_profit: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
