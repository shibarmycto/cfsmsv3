import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_SOLANA_BOT_TOKEN');
const VERSION = "v2.0.0"; // bump on deploy

// Helper to send messages with optional inline keyboard
async function sendMessage(chatId: number, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Inline keyboard for trading controls
const tradingKeyboard = {
  inline_keyboard: [
    [{ text: '🚀 Trade Now', callback_data: 'trade_now' }],
    [{ text: '▶️ Start Trading', callback_data: 'start_trading' }, { text: '⏹ Stop Trading', callback_data: 'stop_trading' }],
    [{ text: '📊 My Stats', callback_data: 'stats' }, { text: '⚙️ Settings', callback_data: 'settings' }]
  ]
};

serve(async (req) => {
  console.log(`[${VERSION}] Request received`);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const update = await req.json();
      console.log(`[${VERSION}] Update:`, JSON.stringify(update));

      // Handle commands
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || '').trim();

        if (text === '/start') {
          await sendMessage(chatId,
            `<b>🤖 CF Solana Soldier MEV Bot</b>\n\nWelcome! I can help you trade Solana tokens with MEV protection.\n\nUse the buttons below to start trading.`,
            tradingKeyboard
          );
        } else if (text === '/trade' || text === '/menu') {
          await sendMessage(chatId, '<b>Trading Panel</b>\nSelect an option:', tradingKeyboard);
        } else if (text === '/help') {
          await sendMessage(chatId,
            `<b>Commands</b>\n/start - Main menu\n/trade - Trading panel\n/help - Show this help`,
            tradingKeyboard
          );
        }
      }

      // Handle button callbacks
      if (update.callback_query) {
        const cbq = update.callback_query;
        const chatId = cbq.message.chat.id;
        const data = cbq.data;

        // Acknowledge callback immediately
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cbq.id }),
        });

        if (data === 'trade_now') {
          await sendMessage(chatId, '🚀 <b>Trade Now</b>\n\nSend a Solana token address to analyze and trade.\n\nExample:\n<code>Enter token address here</code>', tradingKeyboard);
        } else if (data === 'start_trading') {
          await sendMessage(chatId, '▶️ <b>Auto-trading started!</b>\n\nThe bot is now monitoring for profitable opportunities. You will receive alerts when trades are executed.', tradingKeyboard);
        } else if (data === 'stop_trading') {
          await sendMessage(chatId, '⏹ <b>Auto-trading stopped.</b>\n\nYou can restart anytime using the button below.', tradingKeyboard);
        } else if (data === 'stats') {
          await sendMessage(chatId, '📊 <b>Your Stats</b>\n\nTrades today: 0\nProfit: $0.00\nWin rate: --', tradingKeyboard);
        } else if (data === 'settings') {
          await sendMessage(chatId, '⚙️ <b>Settings</b>\n\nSettings panel coming soon!', tradingKeyboard);
        }
      }

      return new Response(JSON.stringify({ ok: true, _version: VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: health check or webhook management
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'setWebhook') {
        const webhookUrl = `https://vdvijwzkultowrambvhe.supabase.co/functions/v1/telegram-solana-bot`;
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getWebhookInfo') {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ status: 'ok', bot: 'CF Solana Soldier Bot', _version: VERSION }), {
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
