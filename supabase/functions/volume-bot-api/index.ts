import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const VOLUME_CONFIG = {
  MIN_TRADE_SOL: 0.001,
  MAX_TRADE_SOL: 0.01,
  MIN_INTERVAL_SEC: 30,
  MAX_INTERVAL_SEC: 120,
  MAX_SLIPPAGE_BPS: 500,
  PRIORITY_FEE_SOL: 0.0003,
  MAX_CYCLES: 100,
};

// ── Base58 ──
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str: string): Uint8Array {
  let num = BigInt(0);
  for (const c of str) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > BigInt(0)) { bytes.unshift(Number(num % BigInt(256))); num = num / BigInt(256); }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}
function base58Encode(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const b of bytes) num = num * BigInt(256) + BigInt(b);
  let str = '';
  while (num > BigInt(0)) { str = ALPHABET[Number(num % BigInt(58))] + str; num = num / BigInt(58); }
  for (const b of bytes) { if (b === 0) str = '1' + str; else break; }
  return str;
}

// ── Ed25519 ──
function buildPkcs8(seed: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20]);
  const pkcs8 = new Uint8Array(header.length + seed.length);
  pkcs8.set(header); pkcs8.set(seed, header.length);
  return pkcs8.buffer;
}
async function signTransaction(message: Uint8Array, secretKeyBytes: Uint8Array): Promise<Uint8Array> {
  const seed = secretKeyBytes.slice(0, 32);
  const pk = await crypto.subtle.importKey('pkcs8', buildPkcs8(seed), { name: 'Ed25519' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('Ed25519', pk, message));
}

// ── Jupiter ──
const JUPITER_API_KEY = Deno.env.get('JUPITER_API_KEY') || '';
const jupiterHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
};
async function jupiterFetch(url: string, options?: RequestInit): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);
  const res = await fetch(url, { ...options, headers: { ...jupiterHeaders, ...(options?.headers || {}) }, signal: c.signal });
  clearTimeout(t);
  if (!res.ok) { const e = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`); }
  return res;
}

// ── RPC helpers ──
async function getBalance(publicKey: string, rpc: string): Promise<number> {
  try {
    const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }) });
    const d = await res.json(); return (d?.result?.value || 0) / 1e9;
  } catch { return 0; }
}
async function getTokenBalance(publicKey: string, mint: string, rpc: string): Promise<number> {
  try {
    const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
        params: [publicKey, { mint }, { encoding: 'jsonParsed' }] }) });
    const d = await res.json(); const a = d?.result?.value || [];
    return a.length === 0 ? 0 : parseFloat(a[0].account?.data?.parsed?.info?.tokenAmount?.uiAmount || '0');
  } catch { return 0; }
}

// ── Swap ──
async function executeSwap(
  inputMint: string, outputMint: string, amountLamports: number,
  publicKey: string, privateKeyB58: string, rpc: string,
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${VOLUME_CONFIG.MAX_SLIPPAGE_BPS}`;
    const quote = await (await jupiterFetch(quoteUrl)).json();
    if (quote.error || !quote.outAmount || quote.outAmount === '0') return { success: false, error: `Quote: ${quote.error || 'No route'}` };

    const swapRes = await jupiterFetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST', body: JSON.stringify({ quoteResponse: quote, userPublicKey: publicKey, wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true, prioritizationFeeLamports: Math.floor(VOLUME_CONFIG.PRIORITY_FEE_SOL * 1e9) }) });
    const swapData = await swapRes.json();
    if (!swapData.swapTransaction) return { success: false, error: `Swap: ${swapData.error || 'No tx'}` };

    const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
    const sig = await signTransaction(txBytes.slice(65), base58Decode(privateKeyB58));
    const signedTx = new Uint8Array(txBytes); signedTx.set(sig, 1);

    const sendRes = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction',
        params: [btoa(String.fromCharCode(...signedTx)), { encoding: 'base64', skipPreflight: true, maxRetries: 3 }] }) });
    const sr = await sendRes.json();
    if (sr.error) return { success: false, error: sr.error.message || JSON.stringify(sr.error) };
    const out = parseInt(quote.outAmount) / (outputMint === SOL_MINT ? 1e9 : Math.pow(10, quote.outputDecimals || 6));
    return { success: true, signature: sr.result, outputAmount: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// ── Volume cycle ──
async function executeVolumeCycle(session: any, rpc: string) {
  const lamports = Math.floor(session.trade_size_sol * 1e9);
  try {
    const buy = await executeSwap(SOL_MINT, TOKEN_CA, lamports, session.wallet_public_key, session.wallet_private_key, rpc);
    if (!buy.success) return { success: false, error: `Buy failed: ${buy.error}` };
    await new Promise(r => setTimeout(r, 3000 + Math.floor(Math.random() * 5000)));
    const tb = await getTokenBalance(session.wallet_public_key, TOKEN_CA, rpc);
    if (tb <= 0) return { success: false, error: 'No tokens after buy' };
    const sell = await executeSwap(TOKEN_CA, SOL_MINT, Math.floor(tb * 1e6), session.wallet_public_key, session.wallet_private_key, rpc);
    const solPrice = 150;
    if (!sell.success) return { success: true, detail: `Buy ✅ (sell pending)`, volumeUsd: session.trade_size_sol * solPrice };
    return { success: true, detail: `Buy ✅ Sell ✅`, volumeUsd: session.trade_size_sol * solPrice * 2 };
  } catch (e) { return { success: false, error: e.message }; }
}

// ── DexScreener ──
async function fetchTokenData() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
    const json = await res.json(); const p = json.pairs?.[0]; if (!p) return null;
    return { priceUsd: p.priceUsd || '0', marketCap: p.marketCap || p.fdv || 0, volume24h: p.volume?.h24 || 0,
      buysTxns: p.txns?.h24?.buys || 0, sellsTxns: p.txns?.h24?.sells || 0, priceChange24h: p.priceChange?.h24 || 0 };
  } catch { return null; }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY') || '';
  const rpc = HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : 'https://api.mainnet-beta.solana.com';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getUser(token);
    if (claimsErr || !claims?.user) return json({ success: false, error: 'Invalid token' });
    const userId = claims.user.id;

    const body = await req.json();
    const { action } = body;

    // ── SET WALLET ──
    if (action === 'set_wallet') {
      const { private_key } = body;
      if (!private_key) return json({ success: false, error: 'Missing private_key' });
      try {
        const keyBytes = base58Decode(private_key);
        if (keyBytes.length !== 64) throw new Error('Invalid key length');
        const seed = keyBytes.slice(0, 32);
        await crypto.subtle.importKey('pkcs8', buildPkcs8(seed), { name: 'Ed25519' }, false, ['sign']);
        const pubKey = base58Encode(keyBytes.slice(32, 64));
        const balance = await getBalance(pubKey, rpc);

        await supabase.from('volume_bot_sessions').upsert({
          chat_id: `web_${userId}`,
          user_id: `web_${userId}`,
          auth_user_id: userId,
          wallet_public_key: pubKey,
          wallet_private_key: private_key,
          is_active: false,
          trade_size_sol: 0.005,
          cycles_completed: 0,
          max_cycles: VOLUME_CONFIG.MAX_CYCLES,
          total_volume_usd: 0,
        }, { onConflict: 'chat_id' });

        return json({ success: true, public_key: pubKey, balance });
      } catch (e) { return json({ success: false, error: `Invalid key: ${e.message}` }); }
    }

    // ── GET STATUS ──
    if (action === 'status') {
      const { data: session } = await supabase.from('volume_bot_sessions').select('*')
        .eq('auth_user_id', userId).single();
      if (!session) return json({ success: true, session: null });
      const balance = session.wallet_public_key ? await getBalance(session.wallet_public_key, rpc) : 0;
      const tokenData = await fetchTokenData();
      return json({ success: true, session: {
        is_active: session.is_active, wallet: session.wallet_public_key,
        balance, trade_size_sol: session.trade_size_sol, cycles_completed: session.cycles_completed,
        max_cycles: session.max_cycles, total_volume_usd: session.total_volume_usd,
        started_at: session.started_at,
      }, token: tokenData });
    }

    // ── SET VOLUME ──
    if (action === 'set_volume') {
      const { trade_size_sol } = body;
      if (!trade_size_sol || trade_size_sol < VOLUME_CONFIG.MIN_TRADE_SOL || trade_size_sol > VOLUME_CONFIG.MAX_TRADE_SOL) {
        return json({ success: false, error: `Trade size must be ${VOLUME_CONFIG.MIN_TRADE_SOL}-${VOLUME_CONFIG.MAX_TRADE_SOL} SOL` });
      }
      await supabase.from('volume_bot_sessions').update({ trade_size_sol }).eq('auth_user_id', userId);
      return json({ success: true });
    }

    // ── START PUMP ──
    if (action === 'start') {
      const { data: session } = await supabase.from('volume_bot_sessions').select('*')
        .eq('auth_user_id', userId).single();
      if (!session?.wallet_private_key) return json({ success: false, error: 'No wallet configured' });
      if (session.is_active) return json({ success: false, error: 'Already running' });
      const balance = await getBalance(session.wallet_public_key, rpc);
      if (balance < session.trade_size_sol * 2) return json({ success: false, error: `Need ${(session.trade_size_sol * 2).toFixed(4)} SOL, have ${balance.toFixed(4)}` });

      await supabase.from('volume_bot_sessions').update({
        is_active: true, cycles_completed: 0, total_volume_usd: 0, started_at: new Date().toISOString()
      }).eq('auth_user_id', userId);

      const result = await executeVolumeCycle(session, rpc);

      // Schedule next
      scheduleNextCycle(supabaseUrl, serviceKey, userId);

      return json({ success: true, first_cycle: result });
    }

    // ── STOP PUMP ──
    if (action === 'stop') {
      const { data: session } = await supabase.from('volume_bot_sessions').select('*')
        .eq('auth_user_id', userId).single();
      if (!session?.is_active) return json({ success: false, error: 'Not running' });
      await supabase.from('volume_bot_sessions').update({ is_active: false }).eq('auth_user_id', userId);
      return json({ success: true, cycles_completed: session.cycles_completed, total_volume_usd: session.total_volume_usd });
    }

    // ── RUN CYCLE (internal) ──
    if (action === 'run_cycle') {
      const targetUserId = body.target_user_id;
      if (!targetUserId) return json({ success: false, error: 'No target' });
      const { data: session } = await supabase.from('volume_bot_sessions').select('*')
        .eq('auth_user_id', targetUserId).eq('is_active', true).single();
      if (!session) return json({ success: true, message: 'Session inactive' });

      if (session.cycles_completed >= session.max_cycles) {
        await supabase.from('volume_bot_sessions').update({ is_active: false }).eq('id', session.id);
        return json({ success: true, message: 'Max cycles reached' });
      }
      const balance = await getBalance(session.wallet_public_key, rpc);
      if (balance < session.trade_size_sol * 1.5) {
        await supabase.from('volume_bot_sessions').update({ is_active: false }).eq('id', session.id);
        return json({ success: true, message: 'Low balance, paused' });
      }

      const result = await executeVolumeCycle(session, rpc);
      if (result.success) {
        await supabase.from('volume_bot_sessions').update({
          cycles_completed: session.cycles_completed + 1,
          total_volume_usd: (session.total_volume_usd || 0) + (result.volumeUsd || 0),
        }).eq('id', session.id);
      }

      // Schedule next
      scheduleNextCycle(supabaseUrl, serviceKey, targetUserId);

      return json({ success: true, cycle: result });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (e) {
    console.error('[VOLUME-API]', e);
    return json({ success: false, error: e.message });
  }
});

function scheduleNextCycle(supabaseUrl: string, serviceKey: string, userId: string) {
  const delay = VOLUME_CONFIG.MIN_INTERVAL_SEC + Math.floor(Math.random() * (VOLUME_CONFIG.MAX_INTERVAL_SEC - VOLUME_CONFIG.MIN_INTERVAL_SEC));
  console.log(`[VOLUME-API] Next cycle in ${delay}s for user ${userId}`);
  setTimeout(async () => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/volume-bot-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: 'run_cycle', target_user_id: userId }),
      });
    } catch (e) { console.error('[VOLUME-API] Schedule error:', e); }
  }, delay * 1000);
}

function json(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
