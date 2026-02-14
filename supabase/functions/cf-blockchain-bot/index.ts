import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('CF_BLOCKCHAIN_BOT_TOKEN')!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const LOGO_URL = 'https://www.cfblockchains.com/cf-blockchain-logo.png?v=' + Date.now();

async function sendTelegramMessage(chatId: number | string, text: string, parseMode = 'HTML') {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

async function sendTelegramPhoto(chatId: number | string, caption: string, parseMode = 'HTML') {
  const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: LOGO_URL,
      caption,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

function getStartMessage() {
  return `
🔗 <b>CF BLOCKCHAIN BOT</b> 🔗

Welcome to the official <b>CF Exchange</b> alert bot!

📊 <b>Real-Time Alerts:</b>
• 🟢 Token BUY orders
• 🔴 Token SELL orders  
• 🆕 New token launches
• 📰 Economic news & events
• 🏆 Market milestones

<b>Commands:</b>
/start - Show this menu
/stats - Exchange statistics
/top - Top tokens by volume
/price [SYMBOL] - Token price lookup
/alerts - Toggle alert settings
/help - All commands

💎 Add me to any group for <b>real-time market alerts!</b>

🌐 <a href="https://www.cfblockchains.com/exchange">Visit CF Exchange</a>
`;
}

function getHelpMessage() {
  return `
📖 <b>CF BLOCKCHAIN BOT — Commands</b>

<b>📊 Market Data:</b>
/stats — Full exchange statistics
/top — Top 10 tokens by volume
/price SYMBOL — Price & stats for a token
/new — Recently created tokens

<b>⚙️ Settings:</b>
/alerts — Toggle which alerts to receive
/start — Welcome message

<b>🔔 Automatic Alerts:</b>
When added to a group, the bot automatically sends:
• Buy/Sell alerts for trades over $100
• New token launch announcements
• Economic calendar events
• Major price movements (>10%)

💡 <i>Tip: Add this bot to your trading group for real-time updates!</i>
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    // Handle webhook registration endpoint
    if (url.searchParams.get('action') === 'register') {
      const webhookUrl = `${supabaseUrl}/functions/v1/cf-blockchain-bot`;
      const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'my_chat_member'] }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle broadcast endpoint (called by cf-blockchain-alerts function)
    if (url.searchParams.get('action') === 'broadcast') {
      const { message, alert_type } = await req.json();
      
      const { data: groups } = await supabase
        .from('telegram_bot_groups')
        .select('chat_id')
        .eq('is_active', true);

      let sent = 0;
      if (groups) {
        for (const group of groups) {
          try {
            await sendTelegramMessage(group.chat_id, message);
            sent++;
          } catch (e) {
            console.error(`Failed to send to ${group.chat_id}:`, e);
          }
        }
      }

      // Log alert
      await supabase.from('telegram_bot_alerts').insert({
        alert_type: alert_type || 'broadcast',
        message,
        groups_sent_to: sent,
      });

      return new Response(JSON.stringify({ success: true, groups_sent: sent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle Telegram webhook updates
    const update = await req.json();

    // Bot added/removed from group
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const newStatus = update.my_chat_member.new_chat_member?.status;

      if (newStatus === 'member' || newStatus === 'administrator') {
        // Bot added to group
        await supabase.from('telegram_bot_groups').upsert({
          chat_id: chat.id,
          chat_title: chat.title || chat.first_name || 'Unknown',
          chat_type: chat.type,
          is_active: true,
          added_at: new Date().toISOString(),
        }, { onConflict: 'chat_id' });

        await sendTelegramPhoto(chat.id, `
🔗 <b>CF BLOCKCHAIN BOT ACTIVATED!</b> 🔗

This group will now receive <b>real-time alerts</b> from the CF Exchange:

📈 Token buys & sells
🆕 New token launches  
📰 Economic news
🏆 Market milestones

Type /help for all commands.

💎 Trade on CF Exchange: www.cfblockchains.com/exchange
`);
      } else if (newStatus === 'left' || newStatus === 'kicked') {
        await supabase.from('telegram_bot_groups')
          .update({ is_active: false })
          .eq('chat_id', chat.id);
      }
    }

    // Handle messages/commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const command = text.split(' ')[0].split('@')[0].toLowerCase();

      // Also track private chats
      if (update.message.chat.type === 'private') {
        await supabase.from('telegram_bot_groups').upsert({
          chat_id: chatId,
          chat_title: update.message.chat.first_name || 'Private',
          chat_type: 'private',
          is_active: true,
        }, { onConflict: 'chat_id' });
      }

      switch (command) {
        case '/start':
          await sendTelegramPhoto(chatId, getStartMessage());
          break;

        case '/help':
          await sendTelegramMessage(chatId, getHelpMessage());
          break;

        case '/stats': {
          const { data: tokens } = await supabase
            .from('user_tokens')
            .select('*')
            .neq('status', 'suspended');

          if (!tokens || tokens.length === 0) {
            await sendTelegramMessage(chatId, '📊 No tokens on the exchange yet.');
            break;
          }

          const totalMcap = tokens.reduce((a: number, t: any) => a + (t.market_cap || 0), 0);
          const totalVol = tokens.reduce((a: number, t: any) => a + (t.total_volume || 0), 0);
          const totalSales = tokens.reduce((a: number, t: any) => a + (t.total_sales_value || 0), 0);

          await sendTelegramMessage(chatId, `
📊 <b>CF EXCHANGE — MARKET REPORT</b>
━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Total Market Cap:</b> $${totalMcap.toLocaleString()}
📈 <b>Total Volume:</b> ${totalVol.toLocaleString()} tokens
💵 <b>Total Sales Value:</b> $${totalSales.toLocaleString()}
🪙 <b>Active Tokens:</b> ${tokens.length}
🎓 <b>Graduated:</b> ${tokens.filter((t: any) => t.status === 'graduated').length}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="https://www.cfblockchains.com/exchange">Trade Now on CF Exchange</a>
`);
          break;
        }

        case '/top': {
          const { data: topTokens } = await supabase
            .from('user_tokens')
            .select('*')
            .neq('status', 'suspended')
            .order('total_volume', { ascending: false })
            .limit(10);

          if (!topTokens || topTokens.length === 0) {
            await sendTelegramMessage(chatId, '🏆 No tokens listed yet.');
            break;
          }

          let msg = '🏆 <b>TOP 10 TOKENS BY VOLUME</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
          topTokens.forEach((t: any, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            msg += `${medal} <b>${t.logo_emoji} ${t.symbol}</b>\n`;
            msg += `   💰 $${t.price_per_token} | MCap: $${(t.market_cap || 0).toLocaleString()} | Vol: ${(t.total_volume || 0).toLocaleString()}\n\n`;
          });

          msg += '━━━━━━━━━━━━━━━━━━━━━━\n🌐 <a href="https://www.cfblockchains.com/exchange">Trade on CF Exchange</a>';
          await sendTelegramMessage(chatId, msg);
          break;
        }

        case '/price': {
          const symbol = text.split(' ')[1]?.toUpperCase();
          if (!symbol) {
            await sendTelegramMessage(chatId, '❌ Usage: /price SYMBOL\nExample: /price BTC');
            break;
          }

          const { data: token } = await supabase
            .from('user_tokens')
            .select('*')
            .ilike('symbol', symbol)
            .single();

          if (!token) {
            await sendTelegramMessage(chatId, `❌ Token <b>${symbol}</b> not found.`);
            break;
          }

          const statusEmoji = token.status === 'graduated' ? '🎓' : token.status === 'verified' ? '✅' : token.status === 'established' ? '⭐' : '🪙';

          await sendTelegramMessage(chatId, `
${token.logo_emoji} <b>${token.name} (${token.symbol})</b> ${statusEmoji}
━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Price:</b> $${token.price_per_token}
📊 <b>Market Cap:</b> $${(token.market_cap || 0).toLocaleString()}
📈 <b>Volume:</b> ${(token.total_volume || 0).toLocaleString()}
💵 <b>Total Sales:</b> $${(token.total_sales_value || 0).toLocaleString()}
🏦 <b>Supply:</b> ${(token.circulating_supply || 0).toLocaleString()} / ${(token.total_supply || 0).toLocaleString()}
📌 <b>Status:</b> ${token.status}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="https://www.cfblockchains.com/exchange">Trade ${token.symbol} Now</a>
`);
          break;
        }

        case '/new': {
          const { data: newTokens } = await supabase
            .from('user_tokens')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

          if (!newTokens || newTokens.length === 0) {
            await sendTelegramMessage(chatId, '🆕 No new tokens yet.');
            break;
          }

          let msg = '🆕 <b>LATEST TOKEN LAUNCHES</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
          newTokens.forEach((t: any) => {
            const age = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 3600000);
            msg += `${t.logo_emoji} <b>${t.name}</b> ($${t.symbol})\n`;
            msg += `   💰 $${t.price_per_token} | MCap: $${(t.market_cap || 0).toLocaleString()}\n`;
            msg += `   ⏰ ${age < 24 ? `${age}h ago` : `${Math.floor(age / 24)}d ago`}\n\n`;
          });

          msg += '━━━━━━━━━━━━━━━━━━━━━━\n🌐 <a href="https://www.cfblockchains.com/exchange">Launch Your Token</a>';
          await sendTelegramMessage(chatId, msg);
          break;
        }

        default:
          // Only reply in private chats for unknown commands
          if (update.message.chat.type === 'private' && text.startsWith('/')) {
            await sendTelegramMessage(chatId, '❓ Unknown command. Type /help for available commands.');
          }
          break;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bot error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
