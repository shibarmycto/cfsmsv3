import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LARGE_TRANSACTION_THRESHOLD = 100000; // Requires 2FA for amounts over 100,000

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

    const { recipientUsername, amount, approvalId } = await req.json();

    if (!recipientUsername || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get sender wallet
    const { data: senderWallet, error: senderError } = await adminClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (senderError || !senderWallet) {
      return new Response(
        JSON.stringify({ error: 'Sender wallet not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (senderWallet.balance < amount) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get recipient wallet
    const { data: recipientWallet, error: recipientError } = await adminClient
      .from('wallets')
      .select('*')
      .eq('username', recipientUsername)
      .single();

    if (recipientError || !recipientWallet) {
      return new Response(
        JSON.stringify({ error: 'Recipient wallet not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (senderWallet.id === recipientWallet.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot send to yourself' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if large transaction requires 2FA
    if (amount >= LARGE_TRANSACTION_THRESHOLD && !approvalId) {
      // Create pending approval request
      const { data: approval, error: approvalError } = await adminClient
        .from('large_transaction_approvals')
        .insert({
          from_wallet_id: senderWallet.id,
          to_wallet_id: recipientWallet.id,
          amount,
          otp_code: Math.floor(100000 + Math.random() * 900000).toString(),
          otp_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
        })
        .select()
        .single();

      if (approvalError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create approval request' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ 
          requiresApproval: true,
          approvalId: approval.id,
          message: 'This transaction requires admin 2FA approval due to the large amount.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If approval ID provided, verify it
    if (approvalId) {
      const { data: approval } = await adminClient
        .from('large_transaction_approvals')
        .select('*')
        .eq('id', approvalId)
        .eq('status', 'approved')
        .single();

      if (!approval) {
        return new Response(
          JSON.stringify({ error: 'Transaction not approved or approval expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    // Get client info for logging
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Perform transfer
    // Deduct from sender
    const { error: deductError } = await adminClient
      .from('wallets')
      .update({ 
        balance: senderWallet.balance - amount,
        total_sent: senderWallet.total_sent + amount
      })
      .eq('id', senderWallet.id);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct from sender' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Add to recipient
    const { error: addError } = await adminClient
      .from('wallets')
      .update({ 
        balance: recipientWallet.balance + amount,
        total_received: recipientWallet.total_received + amount
      })
      .eq('id', recipientWallet.id);

    if (addError) {
      // Rollback sender deduction
      await adminClient
        .from('wallets')
        .update({ 
          balance: senderWallet.balance,
          total_sent: senderWallet.total_sent
        })
        .eq('id', senderWallet.id);

      return new Response(
        JSON.stringify({ error: 'Failed to add to recipient' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create transaction record
    await adminClient
      .from('wallet_transactions')
      .insert({
        from_wallet_id: senderWallet.id,
        to_wallet_id: recipientWallet.id,
        amount,
        transaction_type: 'transfer',
        status: 'completed',
        description: `Transfer to ${recipientUsername}`,
        ip_address: ipAddress,
        device_info: userAgent
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully sent ${amount} CFSMS to ${recipientUsername}`,
        newBalance: senderWallet.balance - amount
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
