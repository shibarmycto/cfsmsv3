import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Base58 helpers
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
    const platformPrivateKey = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY')!;
    const pumpPortalApiKey = Deno.env.get('PUMPPORTAL_API_KEY')!;
    const PLATFORM_PUBLIC_KEY = '8ce3F3D6kbCv3Q4yPphJwXVebN3uGWwQhyzH6yQtS44t';

    if (!platformPrivateKey || !pumpPortalApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing platform wallet or PumpPortal API key' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'launch') {
      const {
        name = 'CF Blockchain',
        symbol = 'CFB',
        description = 'CF Blockchain Network — The future of decentralized community tokens. Anti-rug pull protection, revenue sharing, and milestone rewards.',
        telegram = 'https://t.me/cfblockchain',
        website = 'https://cfsmsv3.lovable.app',
        twitter = '',
        initialBuySol = 0,
      } = body;

      console.log(`🚀 Launching token: ${name} ($${symbol}) on Pump.fun`);

      // Step 1: Upload metadata to Pump.fun IPFS
      let metadataUri = '';
      try {
        const logoUrl = 'https://cfsmsv3.lovable.app/cf-blockchain-logo.png';
        const logoRes = await fetch(logoUrl);
        const logoBlob = await logoRes.blob();
        const logoArrayBuffer = await logoBlob.arrayBuffer();
        const logoBytes = new Uint8Array(logoArrayBuffer);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('symbol', symbol);
        formData.append('description', description);
        if (twitter) formData.append('twitter', twitter);
        if (telegram) formData.append('telegram', telegram);
        if (website) formData.append('website', website);
        formData.append('showName', 'true');
        formData.append('file', new Blob([logoBytes], { type: 'image/png' }), 'logo.png');

        console.log('📤 Uploading metadata to Pump.fun IPFS...');
        const ipfsRes = await fetch('https://pump.fun/api/ipfs', {
          method: 'POST',
          body: formData,
        });

        if (!ipfsRes.ok) {
          const errText = await ipfsRes.text();
          throw new Error(`IPFS upload failed: ${ipfsRes.status} - ${errText}`);
        }

        const ipfsData = await ipfsRes.json();
        metadataUri = ipfsData.metadataUri;
        console.log('✅ Metadata uploaded:', metadataUri);
      } catch (ipfsError) {
        console.error('IPFS error:', ipfsError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to upload metadata', details: ipfsError.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Generate a mint keypair for the new token
      const mintKeyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify']
      );

      const mintPrivateRaw = await crypto.subtle.exportKey('pkcs8', mintKeyPair.privateKey);
      const mintPublicRaw = await crypto.subtle.exportKey('raw', mintKeyPair.publicKey);
      const mintPublicBytes = new Uint8Array(mintPublicRaw);
      const mintPrivateBytes = new Uint8Array(mintPrivateRaw);
      
      // Extract 32-byte seed from PKCS8 and build 64-byte Solana keypair
      const mintSeed = mintPrivateBytes.slice(mintPrivateBytes.length - 32);
      const mintFullSecret = new Uint8Array(64);
      mintFullSecret.set(mintSeed, 0);
      mintFullSecret.set(mintPublicBytes, 32);
      
      const mintPublicKeyB58 = base58Encode(mintPublicBytes);
      const mintKeypairB58 = base58Encode(mintFullSecret);

      console.log('🔑 Generated mint address (CA):', mintPublicKeyB58);

      // Step 3: Create token via PumpPortal Lightning API
      console.log('📡 Submitting creation to PumpPortal Lightning API...');
      
      const createPayload = {
        action: 'create',
        tokenMetadata: {
          name,
          symbol,
          uri: metadataUri,
        },
        mint: mintKeypairB58,
        denominatedInSol: 'true',
        amount: initialBuySol,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      };

      const portalUrl = `https://pumpportal.fun/api/trade?api-key=${pumpPortalApiKey}`;
      
      const createRes = await fetch(portalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });

      const createResultText = await createRes.text();
      console.log('PumpPortal response status:', createRes.status);
      console.log('PumpPortal response:', createResultText);

      if (!createRes.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'PumpPortal creation failed',
          details: createResultText,
          mintAddress: mintPublicKeyB58,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // PumpPortal Lightning API returns the tx signature directly as text
      const txSignature = createResultText.replace(/"/g, '').trim();

      console.log('✅ TOKEN LAUNCHED ON PUMP.FUN!');
      console.log('📋 CA (Contract Address):', mintPublicKeyB58);
      console.log('📋 TX Signature:', txSignature);
      console.log(`🔗 Pump.fun: https://pump.fun/coin/${mintPublicKeyB58}`);

      // Send webhook notification
      const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '🚀 CF BLOCKCHAIN TOKEN LAUNCHED ON PUMP.FUN!',
                color: 0x00ff88,
                fields: [
                  { name: '📛 Name', value: `${name} ($${symbol})`, inline: true },
                  { name: '📋 Contract Address (CA)', value: `\`${mintPublicKeyB58}\``, inline: false },
                  { name: '🔗 Pump.fun', value: `https://pump.fun/coin/${mintPublicKeyB58}`, inline: false },
                  { name: '🔗 Solscan', value: `https://solscan.io/tx/${txSignature}`, inline: false },
                  { name: '💼 Deployer', value: `\`${PLATFORM_PUBLIC_KEY}\``, inline: false },
                  { name: '📄 Metadata', value: metadataUri, inline: false },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'CF Blockchain — Pump.fun Launch' },
              }],
            }),
          });
        } catch (e) {
          console.error('Webhook failed:', e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        token: {
          name,
          symbol,
          contractAddress: mintPublicKeyB58,
          metadataUri,
          txSignature,
          pumpfunUrl: `https://pump.fun/coin/${mintPublicKeyB58}`,
          solscanUrl: `https://solscan.io/tx/${txSignature}`,
          deployer: PLATFORM_PUBLIC_KEY,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use "launch"' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Launch error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
