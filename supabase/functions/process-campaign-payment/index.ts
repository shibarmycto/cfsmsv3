import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  campaignId: string;
  paymentMethod: 'manual' | 'crypto';
  cryptoType?: 'solana' | 'ethereum' | 'bitcoin';
}

const WALLET_ADDRESSES: Record<string, string> = {
  solana: 'YOUR_SOLANA_WALLET_ADDRESS',
  ethereum: 'YOUR_ETH_WALLET_ADDRESS',
  bitcoin: 'YOUR_BTC_WALLET_ADDRESS',
};

const CRYPTO_PRICES: Record<string, number> = {
  solana: 180,
  ethereum: 3500,
  bitcoin: 95000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaignId, paymentMethod, cryptoType }: PaymentRequest = await req.json();

    // Get campaign
    const { data: campaign, error: fetchError } = await supabaseClient
      .from('ai_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.status !== 'pending_payment') {
      return new Response(
        JSON.stringify({ error: "Campaign is not awaiting payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentMethod === 'manual') {
      // Create a manual payment request
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('ai_campaign_payments')
        .insert({
          campaign_id: campaignId,
          user_id: user.id,
          amount: campaign.total_cost,
          currency: 'GBP',
          payment_method: 'manual',
          status: 'pending',
        })
        .select()
        .single();

      if (paymentError) {
        return new Response(
          JSON.stringify({ error: "Failed to create payment request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log payment request
      await supabaseAdmin.from('ai_campaign_logs').insert({
        campaign_id: campaignId,
        log_type: 'info',
        message: `Manual payment request created: £${campaign.total_cost}`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment,
          message: "Payment request submitted. Admin will review shortly.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentMethod === 'crypto' && cryptoType) {
      const cryptoPrice = CRYPTO_PRICES[cryptoType] || 100;
      const expectedAmount = campaign.total_cost / cryptoPrice;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Create crypto order for campaign payment
      const { data: cryptoOrder, error: cryptoError } = await supabaseAdmin
        .from('crypto_orders')
        .insert({
          user_id: user.id,
          credits_amount: 0, // Not for credits, for campaign
          price_usd: campaign.total_cost * 1.25, // Convert GBP to USD roughly
          crypto_type: cryptoType,
          expected_amount: expectedAmount,
          wallet_address: WALLET_ADDRESSES[cryptoType],
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (cryptoError) {
        return new Response(
          JSON.stringify({ error: "Failed to create crypto order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create campaign payment record linked to crypto
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('ai_campaign_payments')
        .insert({
          campaign_id: campaignId,
          user_id: user.id,
          amount: campaign.total_cost,
          currency: 'GBP',
          payment_method: `crypto_${cryptoType}`,
          payment_reference: cryptoOrder.id,
          status: 'pending',
        })
        .select()
        .single();

      if (paymentError) {
        return new Response(
          JSON.stringify({ error: "Failed to create payment record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin.from('ai_campaign_logs').insert({
        campaign_id: campaignId,
        log_type: 'info',
        message: `Crypto payment initiated: ${expectedAmount.toFixed(6)} ${cryptoType.toUpperCase()}`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          cryptoOrder,
          payment,
          walletAddress: WALLET_ADDRESSES[cryptoType],
          expectedAmount,
          expiresAt: expiresAt.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid payment method" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process campaign payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
