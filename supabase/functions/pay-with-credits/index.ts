import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Conversion: 10 tokens = £1 (so £25 = 250 tokens per day)
const TOKENS_PER_POUND = 10;

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

    const { campaignId, paymentType } = await req.json();

    if (!campaignId || paymentType !== 'credits') {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await adminClient
      .from('ai_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (campaign.status !== 'pending_payment') {
      return new Response(
        JSON.stringify({ error: 'Campaign is not pending payment' }),
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

    // Calculate tokens needed (£25/day = 250 tokens/day)
    const tokensNeeded = campaign.total_cost * TOKENS_PER_POUND;

    if (wallet.balance < tokensNeeded) {
      return new Response(
        JSON.stringify({ 
          error: `Insufficient balance. Need ${tokensNeeded} tokens (£${campaign.total_cost}), have ${wallet.balance}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Deduct tokens from wallet
    const { error: deductError } = await adminClient
      .from('wallets')
      .update({ 
        balance: wallet.balance - tokensNeeded,
        total_sent: wallet.total_sent + tokensNeeded
      })
      .eq('id', wallet.id);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update campaign status to pending_approval
    const { error: updateError } = await adminClient
      .from('ai_campaigns')
      .update({ status: 'pending_approval' })
      .eq('id', campaignId);

    if (updateError) {
      // Rollback wallet deduction
      await adminClient
        .from('wallets')
        .update({ 
          balance: wallet.balance,
          total_sent: wallet.total_sent
        })
        .eq('id', wallet.id);

      return new Response(
        JSON.stringify({ error: 'Failed to update campaign' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Record the payment
    await adminClient
      .from('ai_campaign_payments')
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        amount: campaign.total_cost,
        payment_method: 'cfsms_credits',
        payment_reference: `CFSMS-${tokensNeeded}-tokens`,
        status: 'completed'
      });

    // Log transaction
    await adminClient
      .from('wallet_transactions')
      .insert({
        from_wallet_id: wallet.id,
        amount: tokensNeeded,
        transaction_type: 'campaign_payment',
        status: 'completed',
        description: `AI Campaign payment: ${campaign.name} (${campaign.days_requested} days)`
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign paid with CFSMS credits and submitted for approval',
        tokensUsed: tokensNeeded,
        newBalance: wallet.balance - tokensNeeded
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
