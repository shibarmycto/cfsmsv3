import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WALLET_ADDRESSES = {
  solana: 'TXFm5oQQ4Qp51tMkPgdqSESYdQaN6hqQkpoZidWMdSy',
  ethereum: '0x125FeD6C4A538aaD4108cE5D598628DC42635Fe9',
  bitcoin: 'bc1p3red8wgfa9k2qyhxxj9vpnehvy29ld63lg5t6kfvrcy6lz7l9mhspyjk3k',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabaseClient
      .from('crypto_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if order is expired
    if (new Date(order.expires_at) < new Date()) {
      if (order.status === 'pending') {
        await supabaseClient
          .from('crypto_orders')
          .update({ status: 'expired' })
          .eq('id', orderId);
      }
      return new Response(
        JSON.stringify({ status: 'expired', message: 'Order has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.status !== 'pending') {
      return new Response(
        JSON.stringify({ status: order.status, message: `Order is ${order.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let paymentFound = false;
    let txHash = null;

    // Check blockchain based on crypto type
    try {
      if (order.crypto_type === 'solana') {
        // Check Solana transactions using public API
        const response = await fetch(
          `https://api.solscan.io/v2/account/transfer?address=${WALLET_ADDRESSES.solana}&page=1&page_size=20`,
          { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          const transactions = data.data || [];
          const oneHourAgo = new Date(order.created_at).getTime();
          
          for (const tx of transactions) {
            const txTime = tx.block_time * 1000;
            if (txTime >= oneHourAgo) {
              // Check if amount roughly matches (within 5% for price fluctuations)
              const lamports = tx.lamport || 0;
              const solAmount = lamports / 1e9;
              if (Math.abs(solAmount - order.expected_amount) / order.expected_amount < 0.05) {
                paymentFound = true;
                txHash = tx.trans_id || tx.signature;
                break;
              }
            }
          }
        }
      } else if (order.crypto_type === 'ethereum') {
        // Check Ethereum transactions using Etherscan public API
        const response = await fetch(
          `https://api.etherscan.io/api?module=account&action=txlist&address=${WALLET_ADDRESSES.ethereum}&startblock=0&endblock=99999999&sort=desc&page=1&offset=20`
        );
        
        if (response.ok) {
          const data = await response.json();
          const transactions = data.result || [];
          const orderTime = new Date(order.created_at).getTime() / 1000;
          
          for (const tx of transactions) {
            if (parseInt(tx.timeStamp) >= orderTime && tx.to?.toLowerCase() === WALLET_ADDRESSES.ethereum.toLowerCase()) {
              const ethAmount = parseInt(tx.value) / 1e18;
              if (Math.abs(ethAmount - order.expected_amount) / order.expected_amount < 0.05) {
                paymentFound = true;
                txHash = tx.hash;
                break;
              }
            }
          }
        }
      } else if (order.crypto_type === 'bitcoin') {
        // Check Bitcoin transactions using Blockchain.info API
        const response = await fetch(
          `https://blockchain.info/rawaddr/${WALLET_ADDRESSES.bitcoin}?limit=20`
        );
        
        if (response.ok) {
          const data = await response.json();
          const transactions = data.txs || [];
          const orderTime = new Date(order.created_at).getTime() / 1000;
          
          for (const tx of transactions) {
            if (tx.time >= orderTime) {
              for (const output of tx.out) {
                if (output.addr === WALLET_ADDRESSES.bitcoin) {
                  const btcAmount = output.value / 1e8;
                  if (Math.abs(btcAmount - order.expected_amount) / order.expected_amount < 0.05) {
                    paymentFound = true;
                    txHash = tx.hash;
                    break;
                  }
                }
              }
            }
            if (paymentFound) break;
          }
        }
      }
    } catch (blockchainError) {
      console.error('Blockchain check error:', blockchainError);
      // Continue without failing - admin can manually verify
    }

    if (paymentFound && txHash) {
      // Update order as paid
      await supabaseClient
        .from('crypto_orders')
        .update({ 
          status: 'paid',
          tx_hash: txHash,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);

      // Add credits to user
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('sms_credits')
        .eq('user_id', order.user_id)
        .maybeSingle();

      if (profile) {
        await supabaseClient
          .from('profiles')
          .update({ sms_credits: profile.sms_credits + order.credits_amount })
          .eq('user_id', order.user_id);
      }

      // Create transaction record
      await supabaseClient.from('transactions').insert({
        user_id: order.user_id,
        amount: order.price_usd,
        credits_purchased: order.credits_amount,
        payment_method: order.crypto_type,
        payment_reference: txHash,
        currency: 'USD',
        status: 'completed',
      });

      return new Response(
        JSON.stringify({ 
          status: 'paid', 
          message: 'Payment confirmed!',
          txHash 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: 'pending', 
        message: 'Payment not yet detected. Please wait for blockchain confirmations.',
        expiresAt: order.expires_at
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