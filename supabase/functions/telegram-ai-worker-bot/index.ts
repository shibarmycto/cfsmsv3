import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_AI_WORKER_BOT_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle incoming webhook updates from Telegram
    if (req.method === 'POST') {
      const update = await req.json();
      console.log('Received Telegram update:', JSON.stringify(update));
      
      // Process the update (this keeps the bot alive)
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        
        // Echo or handle commands - the main bot logic is on the other server
        // This is just a backup endpoint to ensure uptime
        console.log(`Message from ${chatId}: ${text}`);
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET request - health check and webhook setup info
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      
      if (action === 'setWebhook') {
        // Set webhook to this endpoint
        const webhookUrl = `${url.origin}/telegram-ai-worker-bot`;
        const response = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
        );
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (action === 'getWebhookInfo') {
        const response = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
        );
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Health check
      return new Response(JSON.stringify({ 
        status: 'ok', 
        bot: 'AI Worker Bot',
        message: 'Telegram bot backup webhook is running'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
