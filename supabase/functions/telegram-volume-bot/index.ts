import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_VOLUME_BOT_TOKEN')!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdPhxGT4DA2kX2TMZXLDjoy9';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const VERSION = 'v1.0.0';

// Volume bot config
const VOLUME_CONFIG = {
  MIN_TRADE_SOL: 0.001,       // Minimum trade size
  MAX_TRADE_SOL: 0.01,        // Maximum trade size
  TRADE_INTERVAL_SEC: 30,     // Seconds between trades
  MAX_SLIPPAGE_BPS: 500,      // 5% slippage for small trades
  PRIORITY_FEE_SOL: 0.0003,
  MAX_CYCLES: 100,            // Max buy/sell cycles per session
};

// ── Base58 Decode ──
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

// ── Ed25519 Signing ──
function buildPkcs8(seed: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
  ]);
  const pkcs8 = new Uint8Array(header.length + seed.length);
  pkcs8.set(header);
  pkcs8.set(seed, header.length);
  return pkcs8.buffer;
}

async function signTransaction(message: Uint8Array, secretKeyBytes: Uint8Array): Promise<Uint8Array> {
  const seed = secretKeyBytes.slice(0, 32);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', buildPkcs8(seed), { name: 'Ed25519' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('Ed25519', privateKey, message);
  return new Uint8Array(signature);
}

// ── Jupiter endpoints ──
const JUPITER_QUOTE_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/quote',
  'https://api.jup.ag/swap/v1/quote',
];
const JUPITER_SWAP_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/swap',
  'https://api.jup.ag/swap/v1/swap',
];

async function fetchWithFallback(urls: string[], options?: RequestInit): Promise<Response> {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      const errBody = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${errBody.slice(0, 100)}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('All endpoints failed');
}

// ── Get SOL balance ──
async function getBalance(publicKey: string, heliusRpc: string): Promise<number> {
  try {
    const res = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }),
    });
    const data = await res.json();
    return (data?.result?.value || 0) / 1e9;
  } catch { return 0; }
}

// ── Get token balance ──
async function getTokenBalance(publicKey: string, mintAddress: string, heliusRpc: string): Promise<number> {
  try {
    const res = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
        params: [publicKey, { mint: mintAddress }, { encoding: 'jsonParsed' }],
      }),
    });
    const data = await res.json();
    const accounts = data?.result?.value || [];
    if (accounts.length === 0) return 0;
    return parseFloat(accounts[0].account?.data?.parsed?.info?.tokenAmount?.uiAmount || '0');
  } catch { return 0; }
}

// ── Execute Jupiter swap ──
async function executeSwap(
  inputMint: string, outputMint: string, amountLamports: number,
  publicKey: string, privateKeyB58: string, heliusRpc: string,
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    const quoteUrls = JUPITER_QUOTE_ENDPOINTS.map(u =>
      `${u}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${VOLUME_CONFIG.MAX_SLIPPAGE_BPS}`
    );
    const quoteRes = await fetchWithFallback(quoteUrls);
    const quote = await quoteRes.json();

    if (quote.error || !quote.outAmount || quote.outAmount === '0') {
      return { success: false, error: `Quote failed: ${quote.error || 'No route'}` };
    }

    let swapTransaction: string | null = null;
    let swapError: string | null = null;

    for (const swapUrl of JUPITER_SWAP_ENDPOINTS) {
      try {
        const swapRes = await fetch(swapUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: publicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: Math.floor(VOLUME_CONFIG.PRIORITY_FEE_SOL * 1e9),
          }),
        });
        const swapData = await swapRes.json();
        if (swapData.swapTransaction) { swapTransaction = swapData.swapTransaction; break; }
        swapError = swapData.error || 'No swapTransaction';
      } catch (e) { swapError = e.message; }
    }

    if (!swapTransaction) return { success: false, error: `Swap failed: ${swapError}` };

    const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
    const secretKeyBytes = base58Decode(privateKeyB58);
    const messageBytes = txBytes.slice(65);
    const sig = await signTransaction(messageBytes, secretKeyBytes);
    const signedTx = new Uint8Array(txBytes);
    signedTx.set(sig, 1);

    const sendRes = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'sendTransaction',
        params: [btoa(String.fromCharCode(...signedTx)), { encoding: 'base64', skipPreflight: true, maxRetries: 3 }],
      }),
    });
    const sendResult = await sendRes.json();

    if (sendResult.error) return { success: false, error: sendResult.error.message || JSON.stringify(sendResult.error) };

    const outputAmount = parseInt(quote.outAmount) / (outputMint === SOL_MINT ? 1e9 : Math.pow(10, quote.outputDecimals || 6));
    return { success: true, signature: sendResult.result, outputAmount };
  } catch (e) {
    return { success: false, error: `Swap error: ${e.message}` };
  }
}

// ── Fetch live token data ──
async function fetchTokenData() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
    const json = await res.json();
    const pair = json.pairs?.[0];
    if (!pair) return null;
    return {
      priceUsd: pair.priceUsd || '0',
      marketCap: pair.marketCap || pair.fdv || 0,
      volume24h: pair.volume?.h24 || 0,
      buysTxns: pair.txns?.h24?.buys || 0,
      sellsTxns: pair.txns?.h24?.sells || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      pairName: pair.baseToken?.name || 'CF Token',
    };
  } catch { return null; }
}

// ── Telegram send message ──
async function sendMessage(chatId: number | string, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Active volume sessions (in-memory per invocation, persisted via DB) ──
interface VolumeSession {
  chat_id: string;
  user_id: string;
  wallet_public_key: string;
  wallet_private_key: string;
  trade_size_sol: number;
  cycles_completed: number;
  max_cycles: number;
  is_active: boolean;
  total_volume_usd: number;
  started_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY') || '';
  const heliusRpc = HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // === POST: Telegram webhook ===
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';

      // Check if it's a cron/internal call for running volume cycles
      if (contentType.includes('application/json')) {
        const body = await req.json();

        // Internal trigger to run volume cycles
        if (body.action === 'run_volume_cycle') {
          return await handleVolumeCycle(supabase, heliusRpc);
        }

        // Telegram webhook update
        if (body.message || body.callback_query) {
          return await handleTelegramUpdate(body, supabase, heliusRpc);
        }
      }

      return new Response(JSON.stringify({ ok: true, _version: VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === GET: Actions ===
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'setWebhook') {
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-volume-bot`;
        const res = await fetch(`${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getWebhookInfo') {
        const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'run_cycle') {
        return await handleVolumeCycle(supabase, heliusRpc);
      }

      if (action === 'status') {
        const { data: sessions } = await supabase
          .from('volume_bot_sessions')
          .select('*')
          .eq('is_active', true);

        return new Response(JSON.stringify({
          status: 'ok', bot: 'CF Volume Bot', token_ca: TOKEN_CA,
          active_sessions: sessions?.length || 0, _version: VERSION,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ status: 'ok', bot: 'CF Volume Bot', _version: VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('[VOLUME BOT] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ── Handle Telegram updates ──
async function handleTelegramUpdate(update: any, supabase: any, heliusRpc: string) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();
    const userId = String(update.message.from?.id || chatId);

    if (text === '/start' || text.startsWith('/start@')) {
      await sendMessage(chatId, `
🤖 <b>CF VOLUME BOT ${VERSION}</b>
━━━━━━━━━━━━━━━━━━━━━━

Automated volume booster for <b>$CFB</b> token on Solana.

📍 CA: <code>${TOKEN_CA}</code>

<b>Commands:</b>
/setwallet <code>&lt;private_key&gt;</code> — Set your trading wallet
/startpump — Start volume pumping
/stoppump — Stop volume pumping
/status — Check current session
/setvol <code>&lt;sol_amount&gt;</code> — Set trade size (default: 0.005 SOL)
/stats — Live token stats
/help — Show this help

⚠️ <b>Important:</b> Use a dedicated wallet with small SOL amounts. This bot executes rapid buy/sell cycles to generate volume.
`, getMainKeyboard());
    }

    else if (text.startsWith('/setwallet') || text.startsWith('/setwallet@')) {
      const parts = text.split(' ');
      const privKey = parts[1];
      if (!privKey) {
        await sendMessage(chatId, '❌ Usage: /setwallet <code>&lt;private_key&gt;</code>\n\nSend your wallet private key (base58). Use a dedicated wallet!');
        return okResponse();
      }

      try {
        // Validate key by decoding
        const keyBytes = base58Decode(privKey);
        if (keyBytes.length !== 64) throw new Error('Invalid key length');

        // Derive public key
        const seed = keyBytes.slice(0, 32);
        const cryptoKey = await crypto.subtle.importKey('pkcs8', buildPkcs8(seed), { name: 'Ed25519' }, true, ['sign']);
        const exported = await crypto.subtle.exportKey('raw', cryptoKey);
        // For Ed25519, the public key is the last 32 bytes of the 64-byte secret key
        const pubKeyBytes = keyBytes.slice(32, 64);
        // Base58 encode public key
        let pubKey = base58Encode(pubKeyBytes);

        const balance = await getBalance(pubKey, heliusRpc);

        // Store wallet in DB
        await supabase.from('volume_bot_sessions').upsert({
          chat_id: String(chatId),
          user_id: userId,
          wallet_public_key: pubKey,
          wallet_private_key: privKey,
          is_active: false,
          trade_size_sol: VOLUME_CONFIG.MIN_TRADE_SOL * 5,
          cycles_completed: 0,
          max_cycles: VOLUME_CONFIG.MAX_CYCLES,
          total_volume_usd: 0,
        }, { onConflict: 'chat_id' });

        // Delete the message containing the private key for security
        try {
          await fetch(`${TELEGRAM_API}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: update.message.message_id }),
          });
        } catch {}

        await sendMessage(chatId, `
✅ <b>Wallet Connected!</b>

🔑 Address: <code>${pubKey}</code>
💰 Balance: <b>${balance.toFixed(4)} SOL</b>

⚠️ Your private key message has been deleted for security.
Use /startpump to begin volume generation.
`, getMainKeyboard());
      } catch (e) {
        await sendMessage(chatId, `❌ Invalid private key. Make sure it's a base58-encoded Solana private key.\n\nError: ${e.message}`);
      }
    }

    else if (text.startsWith('/setvol') || text.startsWith('/setvol@')) {
      const parts = text.split(' ');
      const amount = parseFloat(parts[1]);
      if (!amount || amount < VOLUME_CONFIG.MIN_TRADE_SOL || amount > VOLUME_CONFIG.MAX_TRADE_SOL) {
        await sendMessage(chatId, `❌ Trade size must be between ${VOLUME_CONFIG.MIN_TRADE_SOL} and ${VOLUME_CONFIG.MAX_TRADE_SOL} SOL.\n\nUsage: /setvol <code>0.005</code>`);
        return okResponse();
      }

      await supabase.from('volume_bot_sessions')
        .update({ trade_size_sol: amount })
        .eq('chat_id', String(chatId));

      await sendMessage(chatId, `✅ Trade size set to <b>${amount} SOL</b> per cycle.`);
    }

    else if (text === '/startpump' || text.startsWith('/startpump@')) {
      const { data: session } = await supabase
        .from('volume_bot_sessions')
        .select('*')
        .eq('chat_id', String(chatId))
        .single();

      if (!session || !session.wallet_private_key) {
        await sendMessage(chatId, '❌ No wallet configured. Use /setwallet first.');
        return okResponse();
      }

      if (session.is_active) {
        await sendMessage(chatId, '⚡ Volume pump is already running! Use /stoppump to stop.');
        return okResponse();
      }

      const balance = await getBalance(session.wallet_public_key, heliusRpc);
      if (balance < session.trade_size_sol * 2) {
        await sendMessage(chatId, `❌ Insufficient balance. Need at least <b>${(session.trade_size_sol * 2).toFixed(4)} SOL</b>, you have <b>${balance.toFixed(4)} SOL</b>.`);
        return okResponse();
      }

      await supabase.from('volume_bot_sessions')
        .update({ is_active: true, cycles_completed: 0, total_volume_usd: 0, started_at: new Date().toISOString() })
        .eq('chat_id', String(chatId));

      // Execute first cycle immediately
      const result = await executeVolumeCycle(session, heliusRpc);

      await sendMessage(chatId, `
🚀 <b>VOLUME PUMP STARTED!</b>
━━━━━━━━━━━━━━━━━━━━━━

🪙 Token: <b>$CFB</b>
💰 Trade Size: <b>${session.trade_size_sol} SOL</b>/cycle
🔄 Strategy: Buy → Sell rapid cycles
💼 Wallet: <code>${session.wallet_public_key.slice(0, 8)}...${session.wallet_public_key.slice(-4)}</code>
💰 Balance: <b>${balance.toFixed(4)} SOL</b>

${result.success ? `✅ First cycle: ${result.detail}` : `⚠️ First cycle: ${result.error}`}

Bot will execute cycles automatically.
Use /stoppump to stop.
`, getMainKeyboard());
    }

    else if (text === '/stoppump' || text.startsWith('/stoppump@')) {
      const { data: session } = await supabase
        .from('volume_bot_sessions')
        .select('*')
        .eq('chat_id', String(chatId))
        .single();

      if (!session || !session.is_active) {
        await sendMessage(chatId, '❌ No active volume session. Use /startpump to begin.');
        return okResponse();
      }

      await supabase.from('volume_bot_sessions')
        .update({ is_active: false })
        .eq('chat_id', String(chatId));

      await sendMessage(chatId, `
🛑 <b>VOLUME PUMP STOPPED</b>
━━━━━━━━━━━━━━━━━━━━━━

📊 Cycles completed: <b>${session.cycles_completed}</b>
💵 Volume generated: <b>$${(session.total_volume_usd || 0).toFixed(2)}</b>
`);
    }

    else if (text === '/status' || text.startsWith('/status@')) {
      const { data: session } = await supabase
        .from('volume_bot_sessions')
        .select('*')
        .eq('chat_id', String(chatId))
        .single();

      if (!session) {
        await sendMessage(chatId, '❌ No session found. Use /setwallet first.');
        return okResponse();
      }

      const balance = session.wallet_public_key ? await getBalance(session.wallet_public_key, heliusRpc) : 0;
      const tokenData = await fetchTokenData();

      await sendMessage(chatId, `
📊 <b>VOLUME BOT STATUS</b>
━━━━━━━━━━━━━━━━━━━━━━

${session.is_active ? '🟢 <b>ACTIVE</b>' : '🔴 <b>STOPPED</b>'}

💼 Wallet: <code>${session.wallet_public_key?.slice(0, 8)}...${session.wallet_public_key?.slice(-4)}</code>
💰 Balance: <b>${balance.toFixed(4)} SOL</b>
📦 Trade Size: <b>${session.trade_size_sol} SOL</b>/cycle
🔄 Cycles: <b>${session.cycles_completed}</b>
💵 Volume Generated: <b>$${(session.total_volume_usd || 0).toFixed(2)}</b>

${tokenData ? `
🪙 <b>$CFB Live:</b>
💰 Price: $${tokenData.priceUsd}
📊 24h Vol: $${tokenData.volume24h.toLocaleString()}
🔄 24h Txns: ${tokenData.buysTxns + tokenData.sellsTxns}
` : ''}
`, getMainKeyboard());
    }

    else if (text === '/stats' || text.startsWith('/stats@')) {
      const tokenData = await fetchTokenData();
      if (tokenData) {
        await sendMessage(chatId, `
📊 <b>$CFB LIVE STATS</b>
━━━━━━━━━━━━━━━━━━━━━━

🪙 <b>${tokenData.pairName}</b>
💰 Price: <b>$${tokenData.priceUsd}</b>
💎 MCap: <b>$${tokenData.marketCap.toLocaleString()}</b>
📊 24h Volume: <b>$${tokenData.volume24h.toLocaleString()}</b>
🔄 24h Txns: <b>${tokenData.buysTxns + tokenData.sellsTxns}</b> (${tokenData.buysTxns}B / ${tokenData.sellsTxns}S)
📈 24h Change: ${tokenData.priceChange24h >= 0 ? '🟢' : '🔴'} ${tokenData.priceChange24h.toFixed(2)}%

📍 CA: <code>${TOKEN_CA}</code>
`);
      } else {
        await sendMessage(chatId, '❌ Could not fetch token data. Try again shortly.');
      }
    }

    else if (text === '/help' || text.startsWith('/help@')) {
      await sendMessage(chatId, `
🤖 <b>CF Volume Bot — Commands</b>
━━━━━━━━━━━━━━━━━━━━━━

/start — Welcome & overview
/setwallet <code>&lt;key&gt;</code> — Connect wallet
/setvol <code>&lt;sol&gt;</code> — Set trade size (${VOLUME_CONFIG.MIN_TRADE_SOL}-${VOLUME_CONFIG.MAX_TRADE_SOL} SOL)
/startpump — Start volume generation
/stoppump — Stop volume generation
/status — Current session info
/stats — Live $CFB stats
/help — This help menu

<b>How it works:</b>
The bot rapidly executes buy/sell cycles on your $CFB position to generate on-chain trading volume. Each cycle:
1️⃣ Buys $CFB with SOL
2️⃣ Waits briefly
3️⃣ Sells $CFB back to SOL

This creates organic-looking transaction volume on DexScreener and other trackers.

⚠️ <b>Costs:</b> Gas fees (~0.001 SOL/cycle) + slippage. Use a dedicated wallet with small amounts.
`, getMainKeyboard());
    }
  }

  // Handle callbacks
  if (update.callback_query) {
    const cbq = update.callback_query;
    const chatId = cbq.message.chat.id;

    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbq.id }),
    });

    if (cbq.data === 'start_pump') {
      // Trigger start pump logic
      await sendMessage(chatId, 'Use /startpump to begin volume generation.');
    } else if (cbq.data === 'stop_pump') {
      await sendMessage(chatId, 'Use /stoppump to stop volume generation.');
    } else if (cbq.data === 'check_status') {
      await sendMessage(chatId, 'Use /status to check your session.');
    }
  }

  return okResponse();
}

// ── Execute a single volume cycle (buy then sell) ──
async function executeVolumeCycle(
  session: any, heliusRpc: string
): Promise<{ success: boolean; detail?: string; error?: string; volumeUsd?: number }> {
  const tradeSolLamports = Math.floor(session.trade_size_sol * 1e9);

  try {
    // STEP 1: BUY — SOL → CFB
    console.log(`[VOLUME] Buying $CFB with ${session.trade_size_sol} SOL...`);
    const buyResult = await executeSwap(
      SOL_MINT, TOKEN_CA, tradeSolLamports,
      session.wallet_public_key, session.wallet_private_key, heliusRpc
    );

    if (!buyResult.success) {
      return { success: false, error: `Buy failed: ${buyResult.error}` };
    }

    console.log(`[VOLUME] ✅ Buy OK: ${buyResult.outputAmount} CFB, tx: ${buyResult.signature}`);

    // Wait 3-8 seconds before selling (randomized to look organic)
    const waitMs = 3000 + Math.floor(Math.random() * 5000);
    await new Promise(resolve => setTimeout(resolve, waitMs));

    // STEP 2: SELL — CFB → SOL (sell all tokens received)
    const tokenBalance = await getTokenBalance(session.wallet_public_key, TOKEN_CA, heliusRpc);
    if (tokenBalance <= 0) {
      return { success: false, error: 'No tokens to sell after buy' };
    }

    // Get token decimals from the buy response or default to 6
    const sellAmountRaw = Math.floor(tokenBalance * 1e6); // Assuming 6 decimals
    console.log(`[VOLUME] Selling ${tokenBalance} CFB back to SOL...`);

    const sellResult = await executeSwap(
      TOKEN_CA, SOL_MINT, sellAmountRaw,
      session.wallet_public_key, session.wallet_private_key, heliusRpc
    );

    if (!sellResult.success) {
      console.warn(`[VOLUME] Sell failed: ${sellResult.error} — tokens remain in wallet`);
      // Still count as partial success (buy volume was generated)
      const solPrice = 150; // Approximate
      const volumeUsd = session.trade_size_sol * solPrice;
      return { success: true, detail: `Buy ✅ (sell pending) | ~$${volumeUsd.toFixed(2)} vol`, volumeUsd };
    }

    console.log(`[VOLUME] ✅ Sell OK: ${sellResult.outputAmount} SOL, tx: ${sellResult.signature}`);

    // Calculate volume (buy + sell counted)
    const solPrice = 150;
    const volumeUsd = session.trade_size_sol * solPrice * 2; // Both sides count as volume

    return {
      success: true,
      detail: `Buy ✅ Sell ✅ | ~$${volumeUsd.toFixed(2)} volume generated`,
      volumeUsd,
    };
  } catch (e) {
    return { success: false, error: `Cycle error: ${e.message}` };
  }
}

// ── Handle automated volume cycles (triggered by cron) ──
async function handleVolumeCycle(supabase: any, heliusRpc: string) {
  const { data: sessions } = await supabase
    .from('volume_bot_sessions')
    .select('*')
    .eq('is_active', true);

  if (!sessions || sessions.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: 'No active sessions' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];

  for (const session of sessions) {
    // Check if max cycles reached
    if (session.cycles_completed >= session.max_cycles) {
      await supabase.from('volume_bot_sessions')
        .update({ is_active: false })
        .eq('id', session.id);

      await sendMessage(session.chat_id, `
🏁 <b>Volume session complete!</b>

📊 Total cycles: ${session.cycles_completed}
💵 Total volume: $${(session.total_volume_usd || 0).toFixed(2)}
`);
      results.push({ chat_id: session.chat_id, status: 'completed' });
      continue;
    }

    // Check balance
    const balance = await getBalance(session.wallet_public_key, heliusRpc);
    if (balance < session.trade_size_sol * 1.5) {
      await supabase.from('volume_bot_sessions')
        .update({ is_active: false })
        .eq('id', session.id);

      await sendMessage(session.chat_id, `
⚠️ <b>Volume bot paused — low balance!</b>

💰 Balance: ${balance.toFixed(4)} SOL
Need at least ${(session.trade_size_sol * 1.5).toFixed(4)} SOL to continue.

Top up your wallet and use /startpump to resume.
`);
      results.push({ chat_id: session.chat_id, status: 'paused_low_balance' });
      continue;
    }

    // Execute cycle
    const result = await executeVolumeCycle(session, heliusRpc);

    if (result.success) {
      await supabase.from('volume_bot_sessions')
        .update({
          cycles_completed: session.cycles_completed + 1,
          total_volume_usd: (session.total_volume_usd || 0) + (result.volumeUsd || 0),
        })
        .eq('id', session.id);

      // Send update every 10 cycles
      if ((session.cycles_completed + 1) % 10 === 0) {
        await sendMessage(session.chat_id, `
📊 <b>Volume Update</b> — Cycle #${session.cycles_completed + 1}

${result.detail}
💵 Total volume: $${((session.total_volume_usd || 0) + (result.volumeUsd || 0)).toFixed(2)}
💰 Balance: ${balance.toFixed(4)} SOL
`);
      }
    } else {
      console.error(`[VOLUME] Cycle failed for ${session.chat_id}: ${result.error}`);
      // Don't stop on single failure, but log it
    }

    results.push({ chat_id: session.chat_id, status: result.success ? 'cycle_ok' : 'cycle_failed', detail: result.detail || result.error });
  }

  return new Response(JSON.stringify({ ok: true, sessions_processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Helpers ──
function base58Encode(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const b of bytes) num = num * BigInt(256) + BigInt(b);
  let str = '';
  while (num > BigInt(0)) {
    str = ALPHABET[Number(num % BigInt(58))] + str;
    num = num / BigInt(58);
  }
  for (const b of bytes) { if (b === 0) str = '1' + str; else break; }
  return str;
}

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Start Pump', callback_data: 'start_pump' }, { text: '🛑 Stop', callback_data: 'stop_pump' }],
      [{ text: '📊 Status', callback_data: 'check_status' }],
      [{ text: '📈 DexScreener', url: `https://dexscreener.com/solana/${TOKEN_CA}` }],
    ]
  };
}

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
