import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('SOLANA_SIGNAL_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_USERNAME = 'memecorpofficial';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Send Telegram message
async function sendMessage(chatId: number, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Check if user is admin
function isAdmin(username: string): boolean {
  return username?.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

// Main menu keyboard
const mainKeyboard = {
  inline_keyboard: [
    [{ text: '💰 Wallet', callback_data: 'wallet' }, { text: '⚡ Trade Now', callback_data: 'trade' }],
    [{ text: '🐋 Whale Monitor', callback_data: 'whale' }, { text: '📊 Arbitrage', callback_data: 'arbitrage' }],
    [{ text: '🤖 Soldiers', callback_data: 'soldiers' }, { text: '🖼 NFTs', callback_data: 'nfts' }],
    [{ text: '🎁 Referrals', callback_data: 'referrals' }, { text: '🏆 Leaderboard', callback_data: 'leaderboard' }],
    [{ text: '🔥 Admin Panel', callback_data: 'admin_panel' }, { text: '⚙️ Settings', callback_data: 'settings' }],
  ]
};

// Admin keyboard
const adminKeyboard = {
  inline_keyboard: [
    [{ text: '👥 Pending Approvals', callback_data: 'admin_pending' }],
    [{ text: '📡 Latest Signals (1-5min)', callback_data: 'admin_signals' }],
    [{ text: '💳 Manage Subscriptions', callback_data: 'admin_subs' }],
    [{ text: '🔙 Back to Menu', callback_data: 'back_menu' }],
  ]
};

// Fetch latest tokens from PumpFun
async function fetchPumpFunTokens() {
  try {
    // Fetch from PumpFun API
    const response = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false');
    if (!response.ok) return [];
    
    const tokens = await response.json();
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    
    // Filter tokens created in last 5 minutes
    const recentTokens = tokens.filter((t: any) => {
      const createdAt = t.created_timestamp || t.createdAt || 0;
      return createdAt > fiveMinAgo;
    });
    
    return recentTokens.slice(0, 20).map((t: any) => ({
      name: t.name || 'Unknown',
      symbol: t.symbol || 'UNK',
      mint: t.mint || t.address,
      marketCap: t.usd_market_cap || t.market_cap || 0,
      createdAt: t.created_timestamp || Date.now(),
    }));
  } catch (error) {
    console.error('Error fetching PumpFun tokens:', error);
    return [];
  }
}

// Format token list message
function formatTokenList(tokens: any[]): string {
  if (tokens.length === 0) {
    return '⚡ <b>LATEST SCAN RESULTS</b>\n\nNo new tokens in the last 5 minutes. Scanning continues...';
  }
  
  let message = '⚡ <b>LATEST SCAN RESULTS</b>\n\n';
  
  tokens.forEach((token, index) => {
    const isNew = Date.now() - token.createdAt < 60000;
    const badge = isNew ? '🆕' : '⚠️';
    const mcSol = (token.marketCap / 150).toFixed(2); // Approximate SOL price
    
    message += `${badge} <b>${token.name}</b>\n`;
    message += `  └ MC: ${mcSol} SOL\n`;
    message += `  └ Mint: <code>${token.mint}</code>\n\n`;
  });
  
  return message;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const update = await req.json();
      console.log('Update received:', JSON.stringify(update));

      // Handle commands
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || '').trim();
        const username = update.message.from?.username || '';
        const userId = update.message.from?.id;

        if (text === '/start') {
          await sendMessage(chatId,
            `🏅 <b>SOLANA SOLDIER</b> 🏅\n\nSelect an option:`,
            mainKeyboard
          );
        } else if (text === '/signals' && isAdmin(username)) {
          const tokens = await fetchPumpFunTokens();
          await sendMessage(chatId, formatTokenList(tokens), {
            inline_keyboard: [
              [{ text: '🔄 Refresh Alerts', callback_data: 'refresh_signals' }, { text: '💰 My Balance', callback_data: 'wallet' }],
              [{ text: '📈 High Confidence', callback_data: 'high_conf' }, { text: '🌐 Open Terminal', callback_data: 'terminal' }],
            ]
          });
        } else if (text === '/admin' && isAdmin(username)) {
          await sendMessage(chatId, '🔥 <b>Admin Panel</b>\n\nManage signals and approvals:', adminKeyboard);
        }
      }

      // Handle callbacks
      if (update.callback_query) {
        const cbq = update.callback_query;
        const chatId = cbq.message.chat.id;
        const data = cbq.data;
        const username = cbq.from?.username || '';
        const userId = cbq.from?.id;

        // Acknowledge callback
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cbq.id }),
        });

        switch (data) {
          case 'wallet':
            await sendMessage(chatId, 
              '💰 <b>Your Wallet</b>\n\n' +
              'Balance: 0.00 SOL\n' +
              'Status: Not Connected\n\n' +
              'Visit the web dashboard to connect your wallet and start trading.',
              { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_menu' }]] }
            );
            break;

          case 'trade':
            await sendMessage(chatId,
              '⚡ <b>Trade Now</b>\n\n' +
              'Send a Solana token mint address to analyze:\n\n' +
              '<code>Paste mint address here</code>',
              { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_menu' }]] }
            );
            break;

          case 'admin_panel':
            if (isAdmin(username)) {
              await sendMessage(chatId, '🔥 <b>Admin Panel</b>\n\nManage signals and approvals:', adminKeyboard);
            } else {
              await sendMessage(chatId, '❌ Admin access required. Contact @memecorpofficial for access.');
            }
            break;

          case 'admin_signals':
            if (isAdmin(username)) {
              const tokens = await fetchPumpFunTokens();
              await sendMessage(chatId, formatTokenList(tokens), {
                inline_keyboard: [
                  [{ text: '🔄 Refresh', callback_data: 'admin_signals' }],
                  [{ text: '🔙 Back', callback_data: 'admin_panel' }],
                ]
              });
            }
            break;

          case 'refresh_signals':
            if (isAdmin(username)) {
              const tokens = await fetchPumpFunTokens();
              await sendMessage(chatId, formatTokenList(tokens), {
                inline_keyboard: [
                  [{ text: '🔄 Refresh Alerts', callback_data: 'refresh_signals' }, { text: '💰 My Balance', callback_data: 'wallet' }],
                  [{ text: '📈 High Confidence', callback_data: 'high_conf' }, { text: '🌐 Open Terminal', callback_data: 'terminal' }],
                ]
              });
            }
            break;

          case 'admin_pending':
            if (isAdmin(username)) {
              const { data: pending } = await supabase
                .from('signal_access')
                .select('*')
                .eq('is_approved', false)
                .limit(10);
              
              if (!pending || pending.length === 0) {
                await sendMessage(chatId, '✅ No pending approvals!', adminKeyboard);
              } else {
                let msg = '👥 <b>Pending Approvals</b>\n\n';
                pending.forEach((p, i) => {
                  msg += `${i + 1}. @${p.telegram_username || 'Unknown'}\n`;
                });
                await sendMessage(chatId, msg, adminKeyboard);
              }
            }
            break;

          case 'leaderboard':
            await sendMessage(chatId,
              '🏆 <b>Leaderboard</b>\n\n' +
              '1. 🥇 SolanaWhale - 245 SOL\n' +
              '2. 🥈 CryptoKing - 189 SOL\n' +
              '3. 🥉 MemeHunter - 156 SOL\n' +
              '4. TokenSniper - 134 SOL\n' +
              '5. AlphaTrader - 98 SOL',
              { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_menu' }]] }
            );
            break;

          case 'settings':
            await sendMessage(chatId,
              '⚙️ <b>Settings</b>\n\n' +
              '🔔 Notifications: ON\n' +
              '⚡ Auto-Trade: OFF\n' +
              '💰 Max Buy: 0.1 SOL\n' +
              '🛑 Stop Loss: 20%',
              { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_menu' }]] }
            );
            break;

          case 'back_menu':
            await sendMessage(chatId, '🏅 <b>SOLANA SOLDIER</b> 🏅\n\nSelect an option:', mainKeyboard);
            break;

          default:
            await sendMessage(chatId, '🔄 Feature coming soon! Stay tuned.', mainKeyboard);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: Health check or webhook setup
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'setWebhook') {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/solana-signal-bot`;
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getSignals') {
        const tokens = await fetchPumpFunTokens();
        return new Response(JSON.stringify({ tokens }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ status: 'ok', bot: 'Solana Signal Bot' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
