import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

function base58Decode(str: string): Uint8Array {
  let num = BigInt(0);
  for (const c of str) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(idx);
  }
  const hex = num.toString(16).padStart(2, '0');
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  let leadingZeros = 0;
  for (const c of str) { if (c === '1') leadingZeros++; else break; }
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(new Uint8Array(bytes), leadingZeros);
  return result;
}

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=`;
const JUPITER_APIS = [
  'https://lite-api.jup.ag/swap/v1',
  'https://api.jup.ag/swap/v1',
];

async function fetchWithFallback(path: string, options: RequestInit, apis = JUPITER_APIS) {
  for (const base of apis) {
    try {
      const res = await fetch(`${base}${path}`, options);
      if (res.ok) return res;
    } catch (_) { /* try next */ }
  }
  throw new Error(`All API endpoints failed for ${path}`);
}

async function generateWallet(): Promise<{ publicKey: string; privateKey: string; secretBytes: Uint8Array }> {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateKeyRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateBytes = new Uint8Array(privateKeyRaw);
  const publicBytes = new Uint8Array(publicKeyRaw);
  const seed = privateBytes.slice(privateBytes.length - 32);
  const fullSecret = new Uint8Array(64);
  fullSecret.set(seed, 0);
  fullSecret.set(publicBytes, 32);
  return {
    publicKey: base58Encode(publicBytes),
    privateKey: base58Encode(fullSecret),
    secretBytes: fullSecret,
  };
}

async function sendSol(
  fromSecretBytes: Uint8Array,
  toPublicKey: string,
  lamports: number,
  heliusKey: string
): Promise<string> {
  const rpc = HELIUS_RPC + heliusKey;

  // Get recent blockhash
  const bhRes = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getLatestBlockhash',
      params: [{ commitment: 'confirmed' }],
    }),
  });
  const bhData = await bhRes.json();
  const blockhash = bhData.result.value.blockhash;

  const fromPubBytes = fromSecretBytes.slice(32, 64);
  const fromPub = base58Encode(fromPubBytes);

  // Build a legacy transfer transaction manually
  // We'll use the Helius sendTransaction with a serialized tx
  // For simplicity, use the RPC transferSOL approach via versioned tx

  // Use system program transfer instruction
  const toPubBytes = base58Decode(toPublicKey);
  
  // Build transaction message
  const SYSTEM_PROGRAM = new Uint8Array(32); // all zeros
  
  // Compact array helpers
  const encodeCompactU16 = (val: number): number[] => {
    if (val < 128) return [val];
    if (val < 16384) return [val & 0x7f | 0x80, val >> 7];
    return [val & 0x7f | 0x80, (val >> 7) & 0x7f | 0x80, val >> 14];
  };

  // Decode blockhash
  const blockhashBytes = base58Decode(blockhash);

  // Message header: 1 signer, 0 readonly signed, 1 readonly unsigned
  const header = new Uint8Array([1, 0, 1]);
  
  // Account keys: from, to, system program
  const numAccounts = encodeCompactU16(3);
  
  // Recent blockhash (32 bytes)
  
  // Instructions: 1 instruction
  const numInstructions = encodeCompactU16(1);
  
  // Transfer instruction
  const programIdIndex = 2; // system program
  const accountIndexes = new Uint8Array([0, 1]); // from, to
  const numAccountIndexes = encodeCompactU16(2);
  
  // Data: instruction index (2 = transfer) + amount (8 bytes LE)
  const instrData = new Uint8Array(12);
  const view = new DataView(instrData.buffer);
  view.setUint32(0, 2, true); // transfer instruction = 2
  // Set lamports as uint64 LE
  const bigLamports = BigInt(lamports);
  view.setUint32(4, Number(bigLamports & BigInt(0xFFFFFFFF)), true);
  view.setUint32(8, Number(bigLamports >> BigInt(32)), true);
  
  const numInstrData = encodeCompactU16(instrData.length);
  
  // Build message bytes
  const messageParts: Uint8Array[] = [
    header,
    new Uint8Array(numAccounts),
    fromPubBytes,
    toPubBytes.length === 32 ? toPubBytes : new Uint8Array(32),
    SYSTEM_PROGRAM,
    blockhashBytes.length === 32 ? blockhashBytes : new Uint8Array(32),
    new Uint8Array(numInstructions),
    new Uint8Array([programIdIndex]),
    new Uint8Array(numAccountIndexes),
    accountIndexes,
    new Uint8Array(numInstrData),
    instrData,
  ];
  
  let totalLen = 0;
  for (const p of messageParts) totalLen += p.length;
  const messageBytes = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of messageParts) {
    messageBytes.set(p, offset);
    offset += p.length;
  }

  // Sign message
  const privateKeyBytes = fromSecretBytes.slice(0, 32);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", cryptoKey, messageBytes));

  // Build full transaction: num_signatures + signature + message
  const numSigs = encodeCompactU16(1);
  const txParts = [new Uint8Array(numSigs), signature, messageBytes];
  let txLen = 0;
  for (const p of txParts) txLen += p.length;
  const txBytes = new Uint8Array(txLen);
  let txOff = 0;
  for (const p of txParts) {
    txBytes.set(p, txOff);
    txOff += p.length;
  }

  // Convert to base64
  const txBase64 = btoa(String.fromCharCode(...txBytes));

  // Send transaction
  const sendRes = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'sendTransaction',
      params: [txBase64, { encoding: 'base64', skipPreflight: true, maxRetries: 3 }],
    }),
  });

  const sendData = await sendRes.json();
  if (sendData.error) throw new Error(sendData.error.message || JSON.stringify(sendData.error));
  return sendData.result;
}

async function jupiterSwap(
  secretBytes: Uint8Array,
  inputMint: string,
  outputMint: string,
  amount: string,
  heliusKey: string,
  slippage = 500
): Promise<string> {
  const publicKey = base58Encode(secretBytes.slice(32, 64));

  // Get quote
  const quoteRes = await fetchWithFallback(
    `/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  const quote = await quoteRes.json();
  if (!quote || quote.error) throw new Error(quote?.error || 'Quote failed');

  // Get swap transaction
  const swapRes = await fetchWithFallback('/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: publicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  const swapData = await swapRes.json();
  if (!swapData.swapTransaction) throw new Error('No swap transaction returned');

  // Decode, sign, and send
  const txBuf = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));

  // Import signing key
  const privateKeyBytes = secretBytes.slice(0, 32);
  const cryptoKey = await crypto.subtle.importKey("raw", privateKeyBytes, { name: "Ed25519" }, false, ["sign"]);

  // The transaction is a versioned transaction. Sign the message portion.
  // For versioned tx: first byte is 0x80 flag, then signatures, then message
  // We need to find the message and sign it
  const numSigs = txBuf[0] === 0x80 ? txBuf[1] : txBuf[0];
  const isVersioned = txBuf[0] === 0x80;
  
  let sigStart: number, msgStart: number;
  if (isVersioned) {
    sigStart = 2;
    msgStart = 2 + numSigs * 64;
  } else {
    sigStart = 1;
    msgStart = 1 + numSigs * 64;
  }

  const messageBytes = txBuf.slice(msgStart);
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", cryptoKey, messageBytes));

  // Replace first signature
  txBuf.set(signature, sigStart);

  const txBase64 = btoa(String.fromCharCode(...txBuf));

  const rpc = HELIUS_RPC + heliusKey;
  const sendRes = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'sendTransaction',
      params: [txBase64, { encoding: 'base64', skipPreflight: true, maxRetries: 3 }],
    }),
  });

  const sendData = await sendRes.json();
  if (sendData.error) throw new Error(sendData.error.message || JSON.stringify(sendData.error));
  return sendData.result;
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { action, ...params } = await req.json();
    const heliusKey = Deno.env.get('HELIUS_API_KEY') || '';
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Check bundler access
    const { data: access } = await supabaseAdmin
      .from('bundler_access')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (action !== 'request_access' && (!access || !access.is_approved)) {
      return new Response(JSON.stringify({ error: 'Bundler access not approved' }), { status: 403, headers: corsHeaders });
    }

    if (action === 'request_access') {
      if (access) {
        return new Response(JSON.stringify({ success: true, status: access.is_approved ? 'approved' : 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await supabaseAdmin.from('bundler_access').insert({ user_id: user.id });
      return new Response(JSON.stringify({ success: true, status: 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_wallets') {
      // Charge 20 credits
      const { data: profile } = await supabaseAdmin.from('profiles').select('sms_credits').eq('user_id', user.id).single();
      if (!profile || profile.sms_credits < 20) {
        return new Response(JSON.stringify({ error: 'Insufficient credits. Need 20 credits.' }), { status: 400, headers: corsHeaders });
      }

      // Generate 25 wallets
      const wallets = [];
      for (let i = 0; i < 25; i++) {
        const w = await generateWallet();
        wallets.push({ index: i, publicKey: w.publicKey, privateKey: w.privateKey });
      }

      // Create session
      const { data: session, error: sessErr } = await supabaseAdmin
        .from('bundler_sessions')
        .insert({
          user_id: user.id,
          status: 'generated',
          total_wallets: 25,
          credits_charged: 20,
        })
        .select()
        .single();

      if (sessErr) throw sessErr;

      // Store wallets
      const walletRows = wallets.map(w => ({
        session_id: session.id,
        user_id: user.id,
        wallet_index: w.index,
        public_key: w.publicKey,
        private_key: w.privateKey,
      }));
      await supabaseAdmin.from('bundler_wallets').insert(walletRows);

      // Deduct credits
      await supabaseAdmin.from('profiles').update({ sms_credits: profile.sms_credits - 20 }).eq('user_id', user.id);

      // Webhook notification
      const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
      if (webhookUrl) {
        try {
          const { data: userProfile } = await supabaseAdmin.from('profiles').select('full_name, email').eq('user_id', user.id).single();
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '🔗 Bundler Session Created',
                color: 0x9945FF,
                fields: [
                  { name: '👤 User', value: userProfile?.full_name || userProfile?.email || 'Unknown', inline: true },
                  { name: '💰 Credits Charged', value: '20', inline: true },
                  { name: '🔑 Wallets Generated', value: '25', inline: true },
                ],
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        wallets: wallets.map(w => ({ index: w.index, publicKey: w.publicKey, privateKey: w.privateKey })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'fund_wallets') {
      const { sessionId, mainWalletPrivateKey, solPerWallet } = params;
      if (!sessionId || !mainWalletPrivateKey || !solPerWallet) {
        return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
      }

      const mainSecretBytes = base58Decode(mainWalletPrivateKey);
      if (mainSecretBytes.length !== 64) {
        return new Response(JSON.stringify({ error: 'Invalid private key' }), { status: 400, headers: corsHeaders });
      }

      const { data: wallets } = await supabaseAdmin
        .from('bundler_wallets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('wallet_index');

      if (!wallets || wallets.length === 0) {
        return new Response(JSON.stringify({ error: 'No wallets found' }), { status: 400, headers: corsHeaders });
      }

      const lamports = Math.floor(solPerWallet * 1e9);
      const results = [];

      // Send SOL to each wallet concurrently in batches of 5
      for (let i = 0; i < wallets.length; i += 5) {
        const batch = wallets.slice(i, i + 5);
        const batchResults = await Promise.allSettled(
          batch.map(w => sendSol(mainSecretBytes, w.public_key, lamports, heliusKey))
        );
        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          results.push({
            walletIndex: batch[j].wallet_index,
            publicKey: batch[j].public_key,
            success: r.status === 'fulfilled',
            txHash: r.status === 'fulfilled' ? r.value : undefined,
            error: r.status === 'rejected' ? r.reason?.message : undefined,
          });
        }
      }

      // Update session
      await supabaseAdmin.from('bundler_sessions').update({
        main_wallet_public_key: base58Encode(mainSecretBytes.slice(32, 64)),
        sol_per_wallet: solPerWallet,
        status: 'funded',
      }).eq('id', sessionId);

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'buy_token') {
      const { sessionId, tokenAddress, solAmount } = params;
      if (!sessionId || !tokenAddress) {
        return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
      }

      const { data: wallets } = await supabaseAdmin
        .from('bundler_wallets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('wallet_index');

      if (!wallets || wallets.length === 0) {
        return new Response(JSON.stringify({ error: 'No wallets found' }), { status: 400, headers: corsHeaders });
      }

      // Update session with token address
      await supabaseAdmin.from('bundler_sessions').update({
        token_address: tokenAddress,
        status: 'buying',
      }).eq('id', sessionId);

      const amountLamports = solAmount ? Math.floor(solAmount * 1e9).toString() : undefined;
      const results = [];

      // Execute buys concurrently in batches of 5
      for (let i = 0; i < wallets.length; i += 5) {
        const batch = wallets.slice(i, i + 5);
        const batchResults = await Promise.allSettled(
          batch.map(async (w) => {
            const secretBytes = base58Decode(w.private_key);
            // If no specific amount, use wallet's balance minus rent (0.005 SOL for rent)
            let amount = amountLamports;
            if (!amount) {
              // Get wallet balance
              const rpc = HELIUS_RPC + heliusKey;
              const balRes = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0', id: 1,
                  method: 'getBalance',
                  params: [w.public_key],
                }),
              });
              const balData = await balRes.json();
              const balance = balData.result?.value || 0;
              amount = Math.max(balance - 5000000, 0).toString(); // Leave 0.005 SOL for rent/fees
            }
            if (parseInt(amount) <= 0) throw new Error('Insufficient balance');
            return jupiterSwap(secretBytes, SOL_MINT, tokenAddress, amount, heliusKey);
          })
        );
        for (let j = 0; j < batchResults.length; j++) {
          results.push({
            walletIndex: batch[j].wallet_index,
            publicKey: batch[j].public_key,
            success: batchResults[j].status === 'fulfilled',
            txHash: batchResults[j].status === 'fulfilled' ? (batchResults[j] as PromiseFulfilledResult<string>).value : undefined,
            error: batchResults[j].status === 'rejected' ? (batchResults[j] as PromiseRejectedResult).reason?.message : undefined,
          });
        }
      }

      await supabaseAdmin.from('bundler_sessions').update({ status: 'bought' }).eq('id', sessionId);

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sell_all') {
      const { sessionId } = params;
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Missing sessionId' }), { status: 400, headers: corsHeaders });
      }

      const { data: session } = await supabaseAdmin
        .from('bundler_sessions')
        .select('token_address')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!session?.token_address) {
        return new Response(JSON.stringify({ error: 'No token address set' }), { status: 400, headers: corsHeaders });
      }

      const { data: wallets } = await supabaseAdmin
        .from('bundler_wallets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('wallet_index');

      if (!wallets || wallets.length === 0) {
        return new Response(JSON.stringify({ error: 'No wallets found' }), { status: 400, headers: corsHeaders });
      }

      await supabaseAdmin.from('bundler_sessions').update({ status: 'selling' }).eq('id', sessionId);

      const results = [];
      const rpc = HELIUS_RPC + heliusKey;

      // Get token balances and sell concurrently in batches
      for (let i = 0; i < wallets.length; i += 5) {
        const batch = wallets.slice(i, i + 5);
        const batchResults = await Promise.allSettled(
          batch.map(async (w) => {
            const secretBytes = base58Decode(w.private_key);
            // Get token account balance
            const taRes = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0', id: 1,
                method: 'getTokenAccountsByOwner',
                params: [w.public_key, { mint: session.token_address }, { encoding: 'jsonParsed' }],
              }),
            });
            const taData = await taRes.json();
            const accounts = taData.result?.value || [];
            if (accounts.length === 0) throw new Error('No token balance');
            
            const tokenAmount = accounts[0].account.data.parsed.info.tokenAmount.amount;
            if (tokenAmount === '0') throw new Error('Zero token balance');

            return jupiterSwap(secretBytes, session.token_address, SOL_MINT, tokenAmount, heliusKey, 5000);
          })
        );
        for (let j = 0; j < batchResults.length; j++) {
          results.push({
            walletIndex: batch[j].wallet_index,
            publicKey: batch[j].public_key,
            success: batchResults[j].status === 'fulfilled',
            txHash: batchResults[j].status === 'fulfilled' ? (batchResults[j] as PromiseFulfilledResult<string>).value : undefined,
            error: batchResults[j].status === 'rejected' ? (batchResults[j] as PromiseRejectedResult).reason?.message : undefined,
          });
        }
      }

      await supabaseAdmin.from('bundler_sessions').update({ status: 'sold' }).eq('id', sessionId);

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_sessions') {
      const { data: sessions } = await supabaseAdmin
        .from('bundler_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({ success: true, sessions: sessions || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_wallets') {
      const { sessionId } = params;
      const { data: wallets } = await supabaseAdmin
        .from('bundler_wallets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('wallet_index');

      return new Response(JSON.stringify({ success: true, wallets: wallets || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Bundler error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
