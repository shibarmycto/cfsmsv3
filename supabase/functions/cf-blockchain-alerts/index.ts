import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('CF_BLOCKCHAIN_BOT_TOKEN')!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL = 'https://www.cfblockchains.com';

async function broadcastToGroups(supabase: any, message: string, alertType: string) {
  const { data: groups } = await supabase
    .from('telegram_bot_groups')
    .select('chat_id')
    .eq('is_active', true);

  let sent = 0;
  if (groups) {
    for (const group of groups) {
      try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: group.chat_id,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${group.chat_id}:`, e);
      }
    }
  }

  await supabase.from('telegram_bot_alerts').insert({
    alert_type: alertType,
    message,
    groups_sent_to: sent,
    metadata: { timestamp: new Date().toISOString() },
  });

  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { alert_type, data } = await req.json();

    let message = '';

    switch (alert_type) {
      case 'token_buy': {
        const { symbol, logo_emoji, amount, total, buyer_name, price, token_name } = data;
        message = `
🟢🟢🟢 <b>BUY ALERT</b> 🟢🟢🟢
━━━━━━━━━━━━━━━━━━━━━━

${logo_emoji || '🪙'} <b>${token_name || symbol}</b> ($${symbol})

💰 <b>${amount.toLocaleString()} tokens BOUGHT</b>
💵 Total: <b>$${total.toLocaleString()}</b>
📊 Price: $${price}
👤 Buyer: ${buyer_name || 'Anonymous'}

━━━━━━━━━━━━━━━━━━━━━━
📈 <i>Bullish momentum detected!</i>
🌐 <a href="${SITE_URL}/exchange">Trade Now on CF Exchange</a>

#CFExchange #${symbol} #CryptoAlert
`;
        break;
      }

      case 'token_sell': {
        const { symbol, logo_emoji, amount, total, seller_name, price, token_name } = data;
        message = `
🔴🔴🔴 <b>SELL ALERT</b> 🔴🔴🔴
━━━━━━━━━━━━━━━━━━━━━━

${logo_emoji || '🪙'} <b>${token_name || symbol}</b> ($${symbol})

📉 <b>${amount.toLocaleString()} tokens SOLD</b>
💵 Total: <b>$${total.toLocaleString()}</b>
📊 Price: $${price}
👤 Seller: ${seller_name || 'Anonymous'}

━━━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Market movement — watch closely!</i>
🌐 <a href="${SITE_URL}/exchange">Trade Now on CF Exchange</a>

#CFExchange #${symbol} #SellAlert
`;
        break;
      }

      case 'new_token': {
        const { name, symbol, logo_emoji, creator_name, price, description } = data;
        message = `
🚀🚀🚀 <b>NEW TOKEN ALERT!</b> 🚀🚀🚀
━━━━━━━━━━━━━━━━━━━━━━

${logo_emoji || '🆕'} <b>${name}</b> ($${symbol})

🆕 <b>JUST LAUNCHED on CF Exchange!</b>

💰 Starting Price: $${price}
📝 ${description || 'No description'}
👤 Creator: ${creator_name || 'Anonymous'}

━━━━━━━━━━━━━━━━━━━━━━
🔥 <i>Get in early! New opportunities await!</i>
🌐 <a href="${SITE_URL}/exchange">Buy ${symbol} Now</a>

#CFExchange #NewListing #${symbol} #GemAlert
`;
        break;
      }

      case 'economic_news': {
        const { title, description, impact, token_symbol } = data;
        const impactEmoji = impact === 'high' ? '🔴' : impact === 'medium' ? '🟡' : '🟢';
        message = `
📰 <b>ECONOMIC NEWS</b> 📰
━━━━━━━━━━━━━━━━━━━━━━

${impactEmoji} Impact: <b>${(impact || 'low').toUpperCase()}</b>

📢 <b>${title}</b>
${description ? `
📝 ${description}` : ''}
${token_symbol ? `
🪙 Related: $${token_symbol}` : ''}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="${SITE_URL}/exchange">View on CF Exchange</a>

#CFExchange #MarketNews
`;
        break;
      }

      case 'token_graduated': {
        const { name, symbol, logo_emoji, market_cap } = data;
        message = `
🎓🏆 <b>TOKEN GRADUATED!</b> 🏆🎓
━━━━━━━━━━━━━━━━━━━━━━

${logo_emoji || '🎓'} <b>${name}</b> ($${symbol})

🎉 Has reached <b>GRADUATED</b> status!
💰 Market Cap: <b>$${(market_cap || 0).toLocaleString()}</b>

This token has proven itself on the market!

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="${SITE_URL}/exchange">Trade ${symbol} on CF Exchange</a>

#CFExchange #Graduated #${symbol}
`;
        break;
      }

      case 'price_milestone': {
        const { name, symbol, logo_emoji, price, milestone } = data;
        message = `
💎💎💎 <b>PRICE MILESTONE!</b> 💎💎💎
━━━━━━━━━━━━━━━━━━━━━━

${logo_emoji || '💎'} <b>${name}</b> ($${symbol})

🚀 Price hit <b>$${price}</b>!
📊 Milestone: ${milestone}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="${SITE_URL}/exchange">Don't miss out! Trade now</a>

#CFExchange #PriceAlert #${symbol}
`;
        break;
      }

      case 'forum_post': {
        const { title, channel_name, author_name } = data;
        message = `
💬 <b>NEW FORUM POST</b>
━━━━━━━━━━━━━━━━━━━━━━

📌 <b>${title}</b>
📂 Channel: ${channel_name || 'General'}
👤 By: ${author_name || 'Anonymous'}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="${SITE_URL}/forum">Join the Discussion</a>
`;
        break;
      }

      case 'market_summary': {
        const { data: tokens } = await supabase
          .from('user_tokens')
          .select('*')
          .neq('status', 'suspended')
          .order('total_volume', { ascending: false });

        if (!tokens || tokens.length === 0) {
          message = '📊 No market data available.';
          break;
        }

        const totalMcap = tokens.reduce((a: number, t: any) => a + (t.market_cap || 0), 0);
        const totalVol = tokens.reduce((a: number, t: any) => a + (t.total_volume || 0), 0);
        const top3 = tokens.slice(0, 3);

        message = `
📊📊📊 <b>CF EXCHANGE — DAILY REPORT</b> 📊📊📊
━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Total Market Cap:</b> $${totalMcap.toLocaleString()}
📈 <b>Total Volume:</b> ${totalVol.toLocaleString()} tokens
🪙 <b>Active Tokens:</b> ${tokens.length}

🏆 <b>TOP PERFORMERS:</b>
${top3.map((t: any, i: number) => {
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
  return `${medal} ${t.logo_emoji} <b>${t.symbol}</b> — $${t.price_per_token} | MCap: $${(t.market_cap || 0).toLocaleString()}`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━
💎 <b>CF Exchange — Where fortunes are made</b>
🌐 <a href="${SITE_URL}/exchange">Trade Now</a>

#CFExchange #DailyReport #Crypto
`;
        break;
      }

      case 'solana_auto_trade': {
        const { token_name, token_symbol, username, amount_sol, amount_usd, match_pct, signature } = data;
        message = `
⚡⚡⚡ <b>NEW AUTO TRADE ON SOLANA SIGNALS</b> ⚡⚡⚡
━━━━━━━━━━━━━━━━━━━━━━

🪙 <b>${token_name || token_symbol}</b> ($${token_symbol || 'UNK'})

💰 <b>Amount:</b> ${amount_sol} SOL ($${amount_usd})
📊 <b>Match Score:</b> ${match_pct}%
👤 <b>User:</b> ${username || 'Anonymous'}
${signature ? `🔗 <a href="https://solscan.io/tx/${signature}">View on Solscan</a>` : ''}

━━━━━━━━━━━━━━━━━━━━━━
🌐 <a href="${SITE_URL}/dashboard">Trade on Solana Signals</a>

#SolanaSignals #AutoTrade #CFBlockchain
`;
        break;
      }

      case 'solana_profit': {
        const { token_name, token_symbol, username, gross_profit_usd, net_profit_usd, fee_usd, pnl_percent, signature } = data;
        message = `
💰💰💰 <b>NEW PROFIT EARNED BY SOLANA SIGNALS</b> 💰💰💰
━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>CFBLOCKCHAINS.COM</b>

🪙 <b>${token_name || token_symbol}</b> ($${token_symbol || 'UNK'})

🎯 <b>Gross Profit:</b> $${gross_profit_usd}
🏷️ <b>Fee:</b> $${fee_usd}
💵 <b>Net Profit:</b> $${net_profit_usd}
📊 <b>P&L:</b> ${pnl_percent}%
👤 <b>User:</b> ${username || 'Anonymous'}
${signature ? `🔗 <a href="https://solscan.io/tx/${signature}">View on Solscan</a>` : ''}

━━━━━━━━━━━━━━━━━━━━━━
🔥 <i>Profits secured automatically!</i>
🌐 <a href="${SITE_URL}/dashboard">Start earning on Solana Signals</a>

#SolanaSignals #Profit #CFBlockchain
`;
        break;
      }

      default:
        message = `📢 <b>CF Exchange Alert</b>

${JSON.stringify(data)}`;
    }

    const sent = await broadcastToGroups(supabase, message, alert_type);

    return new Response(JSON.stringify({ success: true, groups_notified: sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Alert error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
