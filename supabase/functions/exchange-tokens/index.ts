import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKENS_PER_CREDIT = 10; // 10 tokens = 1 SMS credit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tokensToExchange } = await req.json();

    if (!tokensToExchange || tokensToExchange <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid token amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (wallet.balance < tokensToExchange) {
      return new Response(
        JSON.stringify({ error: 'Insufficient token balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate credits to add
    const creditsToAdd = Math.floor(tokensToExchange / TOKENS_PER_CREDIT);
    if (creditsToAdd < 1) {
      return new Response(
        JSON.stringify({ error: `Minimum ${TOKENS_PER_CREDIT} tokens required for 1 SMS credit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokensUsed = creditsToAdd * TOKENS_PER_CREDIT;

    // Deduct tokens from wallet
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ balance: wallet.balance - tokensUsed })
      .eq('id', wallet.id);

    if (walletError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add SMS credits to profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ sms_credits: (profile?.sms_credits || 0) + creditsToAdd })
      .eq('user_id', user.id);

    if (profileError) {
      // Rollback wallet deduction
      await supabase
        .from('wallets')
        .update({ balance: wallet.balance })
        .eq('id', wallet.id);

      return new Response(
        JSON.stringify({ error: 'Failed to add SMS credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction record
    await supabase.from('wallet_transactions').insert({
      from_wallet_id: wallet.id,
      amount: tokensUsed,
      transaction_type: 'sms_credit_exchange',
      status: 'completed',
      description: `Exchanged ${tokensUsed} tokens for ${creditsToAdd} SMS credits`
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        tokensUsed,
        creditsAdded: creditsToAdd,
        newWalletBalance: wallet.balance - tokensUsed,
        newCredits: (profile?.sms_credits || 0) + creditsToAdd
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Exchange error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
