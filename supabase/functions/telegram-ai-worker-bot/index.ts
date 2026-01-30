import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_AI_WORKER_BOT_TOKEN');
const VERSION = "v2.0.0"; // bump on deploy

async function sendMessage(chatId: number, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mainKeyboard = {
  inline_keyboard: [
    [{ text: '🤖 Start Task', callback_data: 'start_task' }, { text: '📋 My Tasks', callback_data: 'my_tasks' }],
    [{ text: '💰 Earnings', callback_data: 'earnings' }, { text: '❓ Help', callback_data: 'help' }]
  ]
};

serve(async (req) => {
  console.log(`[${VERSION}] AI Worker bot request`);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const update = await req.json();
      console.log(`[${VERSION}] Update:`, JSON.stringify(update));

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || '').trim();

        if (text === '/start') {
          await sendMessage(chatId,
            `<b>🤖 CF AI Worker Bot</b>\n\nWelcome! Complete AI tasks and earn rewards.\n\nTap a button below to get started.`,
            mainKeyboard
          );
        } else if (text === '/help') {
          await sendMessage(chatId,
            `<b>Commands</b>\n/start - Main menu\n/help - This help message`,
            mainKeyboard
          );
        }
      }

      if (update.callback_query) {
        const cbq = update.callback_query;
        const chatId = cbq.message.chat.id;
        const data = cbq.data;

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cbq.id }),
        });

        if (data === 'start_task') {
          await sendMessage(chatId, '🤖 <b>New Task</b>\n\nNo tasks available right now. Check back soon!', mainKeyboard);
        } else if (data === 'my_tasks') {
          await sendMessage(chatId, '📋 <b>Your Tasks</b>\n\nCompleted: 0\nPending: 0', mainKeyboard);
        } else if (data === 'earnings') {
          await sendMessage(chatId, '💰 <b>Earnings</b>\n\nTotal earned: $0.00', mainKeyboard);
        } else if (data === 'help') {
          await sendMessage(chatId, '❓ <b>Help</b>\n\nThis bot allows you to complete AI labeling tasks and earn rewards. Tap "Start Task" when tasks are available.', mainKeyboard);
        }
      }

      return new Response(JSON.stringify({ ok: true, _version: VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'setWebhook') {
        const webhookUrl = `https://vdvijwzkultowrambvhe.supabase.co/functions/v1/telegram-ai-worker-bot`;
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getWebhookInfo') {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ status: 'ok', bot: 'CF AI Worker Bot', _version: VERSION }), {
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
