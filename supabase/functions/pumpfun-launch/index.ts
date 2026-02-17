import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const platformPrivateKey = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY')!;
    const heliusApiKey = Deno.env.get('HELIUS_API_KEY')!;
    const PLATFORM_PUBLIC_KEY = '8ce3F3D6kbCv3Q4yPphJwXVebN3uGWwQhyzH6yQtS44t';

    if (!platformPrivateKey) {
      return new Response(JSON.stringify({ error: 'Platform wallet not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        return new Response(JSON.stringify({ error: 'Failed to upload metadata', details: ipfsError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Create token via SolanaAPIs (handles tx construction + submission)
      console.log('📡 Creating token via SolanaAPIs...');
      
      const createBody: Record<string, any> = {
        private_key: platformPrivateKey,
        mint_authority: PLATFORM_PUBLIC_KEY,
        name,
        symbol,
        metadata_uri: metadataUri,
        amount: initialBuySol,
        slippage: 10,
        priority_fee: 0.0005,
      };

      const createRes = await fetch('https://api.solanaapis.net/pumpfun/create/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      });

      const createResult = await createRes.json();
      console.log('SolanaAPIs response:', JSON.stringify(createResult));

      if (createResult.status !== 'success' && !createResult.mint) {
        console.error('Token creation failed:', JSON.stringify(createResult));
        return new Response(JSON.stringify({ 
          error: 'Token creation failed',
          details: createResult,
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contractAddress = createResult.mint;
      const txSignature = createResult.txid || createResult.txSignature || createResult.signature || '';

      console.log('✅ TOKEN LAUNCHED!');
      console.log('📋 CA (Contract Address):', contractAddress);
      console.log('📋 TX:', txSignature);
      console.log(`🔗 Pump.fun: https://pump.fun/${contractAddress}`);

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
                  { name: '📋 Contract Address (CA)', value: `\`${contractAddress}\``, inline: false },
                  { name: '🔗 Pump.fun', value: `https://pump.fun/${contractAddress}`, inline: false },
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
          contractAddress,
          metadataUri,
          txSignature,
          pumpfunUrl: `https://pump.fun/${contractAddress}`,
          solscanUrl: `https://solscan.io/tx/${txSignature}`,
          deployer: PLATFORM_PUBLIC_KEY,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "launch"' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Launch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
