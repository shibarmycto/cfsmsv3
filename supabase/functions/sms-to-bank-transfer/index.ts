import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate: 1 SMS credit = 1 CFSMS token (same price)
const TOKENS_PER_CREDIT = 1;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { creditsToTransfer } = await req.json();

    if (!creditsToTransfer || creditsToTransfer <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user's SMS credits from profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (profile.sms_credits < creditsToTransfer) {
      return new Response(
        JSON.stringify({ error: 'Insufficient SMS credits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await adminClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found. Please create a wallet first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const tokensToAdd = creditsToTransfer * TOKENS_PER_CREDIT;

    // Deduct SMS credits from profile
    const { error: deductError } = await adminClient
      .from('profiles')
      .update({ sms_credits: profile.sms_credits - creditsToTransfer })
      .eq('user_id', user.id);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct SMS credits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Add tokens to wallet
    const { error: addError } = await adminClient
      .from('wallets')
      .update({ 
        balance: wallet.balance + tokensToAdd,
        total_received: wallet.total_received + tokensToAdd
      })
      .eq('id', wallet.id);

    if (addError) {
      // Rollback SMS credit deduction
      await adminClient
        .from('profiles')
        .update({ sms_credits: profile.sms_credits })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ error: 'Failed to add tokens to wallet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Log the transaction
    await adminClient
      .from('wallet_transactions')
      .insert({
        to_wallet_id: wallet.id,
        amount: tokensToAdd,
        transaction_type: 'sms_to_bank_transfer',
        status: 'completed',
        description: `Transferred ${creditsToTransfer} SMS credits to ${tokensToAdd} CFSMS tokens`
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        creditsTransferred: creditsToTransfer,
        tokensAdded: tokensToAdd,
        newBalance: wallet.balance + tokensToAdd,
        newSmsCredits: profile.sms_credits - creditsToTransfer
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
