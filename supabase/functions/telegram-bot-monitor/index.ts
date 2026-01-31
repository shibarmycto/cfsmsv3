import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bot configuration
const BOTS = [
  {
    name: 'CF Solana Soldier',
    tokenEnvVar: 'TELEGRAM_SOLANA_BOT_TOKEN',
    webhookPath: 'telegram-solana-bot'
  },
  {
    name: 'AI Worker Bot',
    tokenEnvVar: 'TELEGRAM_AI_WORKER_BOT_TOKEN',
    webhookPath: 'telegram-ai-worker-bot'
  }
];

async function checkBotHealth(botToken: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      method: 'GET',
    });
    const data = await response.json();
    return { ok: data.ok, description: data.ok ? 'Bot is online' : data.description };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, description: `Connection failed: ${msg}` };
  }
}

async function checkWebhookStatus(botToken: string): Promise<{ ok: boolean; url?: string; pendingUpdates?: number }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
      method: 'GET',
    });
    const data = await response.json();
    if (data.ok) {
      return { 
        ok: !!data.result.url, 
        url: data.result.url,
        pendingUpdates: data.result.pending_update_count 
      };
    }
    return { ok: false };
  } catch (error) {
    return { ok: false };
  }
}

async function restartBot(botToken: string, webhookPath: string, supabaseUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    // First, delete the existing webhook
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set the new webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/${webhookPath}`;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: false,
        allowed_updates: ['message', 'callback_query']
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return { success: true, message: `Webhook restored to ${webhookUrl}` };
    } else {
      return { success: false, message: `Failed to set webhook: ${data.description}` };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Restart failed: ${msg}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const results: Array<{
      bot: string;
      status: 'online' | 'offline' | 'restarted' | 'restart_failed';
      details: string;
      timestamp: string;
    }> = [];
    
    for (const bot of BOTS) {
      const botToken = Deno.env.get(bot.tokenEnvVar);
      
      if (!botToken) {
        results.push({
          bot: bot.name,
          status: 'offline',
          details: `Token not configured (${bot.tokenEnvVar})`,
          timestamp: new Date().toISOString()
        });
        continue;
      }
      
      // Check bot health
      const health = await checkBotHealth(botToken);
      
      if (!health.ok) {
        results.push({
          bot: bot.name,
          status: 'offline',
          details: health.description || 'Bot not responding',
          timestamp: new Date().toISOString()
        });
        continue;
      }
      
      // Check webhook status
      const webhook = await checkWebhookStatus(botToken);
      
      if (!webhook.ok || !webhook.url) {
        // Webhook is down, try to restart
        console.log(`[${bot.name}] Webhook down, attempting restart...`);
        const restart = await restartBot(botToken, bot.webhookPath, supabaseUrl);
        
        results.push({
          bot: bot.name,
          status: restart.success ? 'restarted' : 'restart_failed',
          details: restart.message,
          timestamp: new Date().toISOString()
        });
      } else {
        // Bot is online and healthy
        results.push({
          bot: bot.name,
          status: 'online',
          details: `Webhook active at ${webhook.url}${webhook.pendingUpdates ? ` (${webhook.pendingUpdates} pending updates)` : ''}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Log results to console for monitoring
    console.log('[Bot Monitor] Health check results:', JSON.stringify(results, null, 2));
    
    // Count issues
    const issues = results.filter(r => r.status !== 'online');
    const restarts = results.filter(r => r.status === 'restarted');
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: BOTS.length,
        online: results.filter(r => r.status === 'online').length,
        restarted: restarts.length,
        failed: results.filter(r => r.status === 'restart_failed' || r.status === 'offline').length
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bot Monitor] Error:', msg);
    return new Response(JSON.stringify({ 
      success: false, 
      error: msg 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
