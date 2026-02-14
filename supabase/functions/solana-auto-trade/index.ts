import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Base58 decode
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str: string): Uint8Array {
  let num = BigInt(0);
  for (const c of str) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const b of bytes) num = num * BigInt(256) + BigInt(b);
  let result = '';
  while (num > BigInt(0)) {
    result = ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }
  for (const b of bytes) { if (b === 0) result = '1' + result; else break; }
  return result || '1';
}

// Sign an Ed25519 message using Web Crypto
async function signTransaction(message: Uint8Array, secretKeyBytes: Uint8Array): Promise<Uint8Array> {
  // First 32 bytes of Solana secret key is the seed
  const seed = secretKeyBytes.slice(0, 32);
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    buildPkcs8(seed),
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('Ed25519', privateKey, message);
  return new Uint8Array(signature);
}

// Build PKCS8 wrapper for Ed25519 seed
function buildPkcs8(seed: Uint8Array): ArrayBuffer {
  // PKCS8 header for Ed25519
  const header = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
  ]);
  const pkcs8 = new Uint8Array(header.length + seed.length);
  pkcs8.set(header);
  pkcs8.set(seed, header.length);
  return pkcs8.buffer;
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // ── ACTIVATE AUTO-TRADE ──
    if (action === 'activate') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (!wallet || (wallet.balance || 0) < 20) {
        return new Response(JSON.stringify({ error: 'Insufficient tokens. Need 20 to activate.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('wallets')
        .update({ balance: (wallet.balance || 0) - 20 })
        .eq('user_id', userId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Auto-trade activated! Monitoring for entry signals...',
        tokens_deducted: 20,
        remaining_balance: (wallet.balance || 0) - 20,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── EXECUTE TRADE (BUY or SELL) ──
    if (action === 'execute_trade') {
      const { mint_address, amount_sol, trade_type } = body;

      if (!mint_address || !amount_sol || !trade_type) {
        return new Response(JSON.stringify({ error: 'Missing trade parameters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user's stored wallet (private key)
      const { data: solWallet } = await supabaseAdmin
        .from('solana_wallets')
        .select('public_key, encrypted_private_key')
        .eq('user_id', userId)
        .single();

      if (!solWallet?.encrypted_private_key || !solWallet?.public_key) {
        return new Response(JSON.stringify({ error: 'No wallet found. Create one first.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const inputMint = trade_type === 'buy' ? SOL_MINT : mint_address;
      const outputMint = trade_type === 'buy' ? mint_address : SOL_MINT;
      const amountLamports = Math.floor(amount_sol * 1e9);

      // Step 1: Get Jupiter quote
      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=500`
      );
      const quote = await quoteRes.json();

      if (quote.error) {
        return new Response(JSON.stringify({ error: `Quote failed: ${quote.error}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Get swap transaction from Jupiter
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: solWallet.public_key,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });
      const swapData = await swapRes.json();

      if (swapData.error || !swapData.swapTransaction) {
        return new Response(JSON.stringify({ error: `Swap build failed: ${swapData.error || 'No transaction returned'}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 3: Decode, sign, and send the transaction
      try {
        const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
        
        // Decode the private key
        const secretKeyBytes = base58Decode(solWallet.encrypted_private_key);
        
        // Sign the transaction message (skip first 65 bytes: 1 signature count + 64 signature placeholder)
        const messageBytes = txBytes.slice(65);
        const signature = await signTransaction(messageBytes, secretKeyBytes);
        
        // Insert signature back into transaction
        const signedTx = new Uint8Array(txBytes);
        signedTx.set(signature, 1); // offset 1 to skip the signature count byte
        
        // Send to Solana via Helius RPC
        const sendRes = await fetch(HELIUS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendTransaction',
            params: [
              btoa(String.fromCharCode(...signedTx)),
              { encoding: 'base64', skipPreflight: true, maxRetries: 3 }
            ],
          }),
        });
        const sendResult = await sendRes.json();

        if (sendResult.error) {
          return new Response(JSON.stringify({ 
            error: `Transaction failed: ${sendResult.error.message || JSON.stringify(sendResult.error)}`,
            details: sendResult.error,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const txSignature = sendResult.result;

        // Calculate platform fee (1% of profit on sells)
        const outputAmount = parseInt(quote.outAmount) / 1e9;
        const inputAmount = parseInt(quote.inAmount) / 1e9;
        const platformFee = trade_type === 'sell' ? Math.max(0, (outputAmount - inputAmount) * 0.01) : 0;

        return new Response(JSON.stringify({
          success: true,
          signature: txSignature,
          trade_type,
          input_amount: inputAmount,
          output_amount: outputAmount,
          price_impact: quote.priceImpactPct,
          platform_fee: platformFee,
          explorer_url: `https://solscan.io/tx/${txSignature}`,
          message: `${trade_type === 'buy' ? '🟢 Buy' : '🔴 Sell'} executed! TX: ${txSignature?.slice(0, 8)}...`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (signError) {
        console.error('Signing error:', signError);
        return new Response(JSON.stringify({ 
          error: `Transaction signing failed: ${signError.message}`,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── GET TRADE LOG ──
    if (action === 'get_trade_log') {
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
