import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  for (const b of bytes) {
    if (b === 0) result = '1' + result;
    else break;
  }
  return result || '1';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pumpPortalApiKey = Deno.env.get('PUMPPORTAL_API_KEY')!;
    const heliusApiKey = Deno.env.get('HELIUS_API_KEY')!;
    const PLATFORM_PUBLIC_KEY = '8ce3F3D6kbCv3Q4yPphJwXVebN3uGWwQhyzH6yQtS44t';

    if (!pumpPortalApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'PumpPortal API key not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    // ===== CHECK PREVIOUS TX STATUS =====
    if (action === 'check_tx') {
      const { signature } = body;
      if (!signature) {
        return new Response(JSON.stringify({ success: false, error: 'No signature provided' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      const statusRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }),
      });
      const statusResult = await statusRes.json();
      
      return new Response(JSON.stringify({
        success: true,
        found: !!statusResult.result,
        transaction: statusResult.result ? {
          slot: statusResult.result.slot,
          err: statusResult.result.meta?.err,
          fee: statusResult.result.meta?.fee,
        } : null,
        error: statusResult.error || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== LAUNCH TOKEN =====
    if (action === 'launch') {
      const {
        name = 'CF Blockchain',
        symbol = 'CFB',
        description = 'CF Blockchain Network — The future of decentralized community tokens.',
        telegram = 'https://t.me/cfblockchain',
        website = 'https://cfsmsv3.lovable.app',
        twitter = '',
        initialBuySol = 0,
      } = body;

      console.log(`🚀 Launching: ${name} ($${symbol})`);

      // Step 1: Upload metadata to Pump.fun IPFS
      let metadataUri = '';
      try {
        const logoUrl = 'https://cfsmsv3.lovable.app/cf-blockchain-logo.png';
        const logoRes = await fetch(logoUrl);
        const logoBlob = await logoRes.blob();
        const logoBytes = new Uint8Array(await logoBlob.arrayBuffer());

        const formData = new FormData();
        formData.append('name', name);
        formData.append('symbol', symbol);
        formData.append('description', description);
        if (twitter) formData.append('twitter', twitter);
        if (telegram) formData.append('telegram', telegram);
        if (website) formData.append('website', website);
        formData.append('showName', 'true');
        formData.append('file', new Blob([logoBytes], { type: 'image/png' }), 'logo.png');

        const ipfsRes = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: formData });
        if (!ipfsRes.ok) throw new Error(`IPFS: ${ipfsRes.status} ${await ipfsRes.text()}`);
        const ipfsData = await ipfsRes.json();
        metadataUri = ipfsData.metadataUri;
        console.log('✅ IPFS:', metadataUri);
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'IPFS upload failed', details: e.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Generate mint keypair
      const mintKP = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
      const mintPrivRaw = new Uint8Array(await crypto.subtle.exportKey('pkcs8', mintKP.privateKey));
      const mintPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', mintKP.publicKey));
      const mintSeed = mintPrivRaw.slice(mintPrivRaw.length - 32);
      const mintFull = new Uint8Array(64);
      mintFull.set(mintSeed, 0);
      mintFull.set(mintPubBytes, 32);
      const mintCA = base58Encode(mintPubBytes);
      const mintKeypairB58 = base58Encode(mintFull);

      console.log('🔑 Mint CA:', mintCA);

      // Step 3: PumpPortal Lightning API (uses PumpPortal's funded wallet)
      console.log('📡 Submitting to PumpPortal Lightning API...');
      
      const createRes = await fetch(`https://pumpportal.fun/api/trade?api-key=${pumpPortalApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          tokenMetadata: { name, symbol, uri: metadataUri },
          mint: mintKeypairB58,
          denominatedInSol: 'true',
          amount: initialBuySol,
          slippage: 10,
          priorityFee: 0.0005,
          pool: 'pump',
        }),
      });

      const resultText = await createRes.text();
      console.log('PumpPortal status:', createRes.status, 'response:', resultText);

      if (!createRes.ok) {
        return new Response(JSON.stringify({ 
          success: false, error: 'PumpPortal creation failed', 
          details: resultText, httpStatus: createRes.status 
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Parse response - could be JSON or plain text
      let txSignature = '';
      try {
        const parsed = JSON.parse(resultText);
        txSignature = parsed.signature || parsed.txid || resultText;
        if (parsed.errors && parsed.errors.length > 0) {
          console.error('PumpPortal errors:', parsed.errors);
          return new Response(JSON.stringify({ 
            success: false, error: 'PumpPortal reported errors', 
            details: parsed.errors, mintCA 
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch {
        txSignature = resultText.replace(/"/g, '').trim();
      }

      console.log('✅ LAUNCHED! CA:', mintCA, 'TX:', txSignature);

      // Verify transaction landed on-chain
      console.log('🔍 Verifying transaction on-chain...');
      await new Promise(r => setTimeout(r, 3000)); // Wait 3s for confirmation
      
      const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      const verifyRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }),
      });
      const verifyResult = await verifyRes.json();
      const confirmed = !!verifyResult.result;
      const txError = verifyResult.result?.meta?.err;

      console.log('On-chain status:', confirmed ? (txError ? `FAILED: ${JSON.stringify(txError)}` : 'CONFIRMED ✅') : 'NOT FOUND (may still be pending)');

      // Webhook
      const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: confirmed && !txError ? '🚀 CF BLOCKCHAIN LAUNCHED!' : '⚠️ Token Launch — Pending Verification',
              color: confirmed && !txError ? 0x00ff88 : 0xffaa00,
              fields: [
                { name: '📛 Token', value: `${name} ($${symbol})`, inline: true },
                { name: '📋 CA', value: `\`${mintCA}\``, inline: false },
                { name: '🔗 Pump.fun', value: `https://pump.fun/coin/${mintCA}`, inline: false },
                { name: '📝 TX', value: `\`${txSignature}\``, inline: false },
                { name: '✅ Confirmed', value: confirmed ? (txError ? `❌ Error: ${JSON.stringify(txError)}` : 'Yes') : 'Pending...', inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        }).catch(() => {});
      }

      return new Response(JSON.stringify({
        success: true,
        confirmed,
        txError: txError || null,
        token: {
          name, symbol,
          contractAddress: mintCA,
          metadataUri,
          txSignature,
          pumpfunUrl: `https://pump.fun/coin/${mintCA}`,
          solscanUrl: `https://solscan.io/tx/${txSignature}`,
          deployer: PLATFORM_PUBLIC_KEY,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Use action: "launch" or "check_tx"' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
