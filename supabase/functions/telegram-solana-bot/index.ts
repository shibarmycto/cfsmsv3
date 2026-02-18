import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_SOLANA_BOT_TOKEN')!;
const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';
const VERSION = "v3.0.0";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const BUY_LINKS = {
  jupiter: `https://jup.ag/swap/SOL-${TOKEN_CA}`,
  raydium: `https://raydium.io/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=${TOKEN_CA}`,
  dexscreener: `https://dexscreener.com/solana/${TOKEN_CA}`,
  birdeye: `https://birdeye.so/token/${TOKEN_CA}?chain=solana`,
};

interface TokenData {
  priceUsd: string;
  priceNative: string;
  marketCap: number;
  fdv: number;
  volume24h: number;
  liquidity: number;
  buysTxns: number;
  sellsTxns: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  pairName: string;
  dexId: string;
  isPumpFun: boolean;
}

async function fetchTokenData(): Promise<TokenData | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
    const json = await res.json();
    const pair = json.pairs?.[0];
    if (!pair) return null;

    let liquidity = pair.liquidity?.usd || 0;

    // PumpFun uses bonding curve — estimate liquidity from MCap if DexScreener returns 0
    if (liquidity === 0 && pair.dexId === 'pumpfun') {
      // Bonding curve liquidity ≈ market cap (tokens are backed by the curve)
      liquidity = pair.marketCap || pair.fdv || 0;
    }

    // Fallback: try Birdeye for liquidity if still 0
    if (liquidity === 0) {
      try {
        const birdRes = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${TOKEN_CA}`, {
          headers: { 'accept': 'application/json' }
        });
        const birdJson = await birdRes.json();
        if (birdJson.data?.liquidity) liquidity = birdJson.data.liquidity;
      } catch (_) { /* ignore fallback errors */ }
    }

    return {
      priceUsd: pair.priceUsd || '0',
      priceNative: pair.priceNative || '0',
      marketCap: pair.marketCap || pair.fdv || 0,
      fdv: pair.fdv || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity,
      buysTxns: pair.txns?.h24?.buys || 0,
      sellsTxns: pair.txns?.h24?.sells || 0,
      priceChange5m: pair.priceChange?.m5 || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      priceChange6h: pair.priceChange?.h6 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      pairName: pair.baseToken?.name || 'CF Token',
      dexId: pair.dexId || 'unknown',
      isPumpFun: pair.dexId === 'pumpfun',
    };
  } catch (e) {
    console.error('DexScreener fetch error:', e);
    return null;
  }
}

function formatPrice(p: string): string {
  const n = parseFloat(p);
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  return n.toFixed(4);
}

function changeEmoji(v: number): string {
  return v >= 0 ? `🟢 +${v.toFixed(2)}%` : `🔴 ${v.toFixed(2)}%`;
}

function buildStatsMessage(data: TokenData, title: string): string {
  const totalTxns = data.buysTxns + data.sellsTxns;
  const buyRatio = totalTxns > 0 ? ((data.buysTxns / totalTxns) * 100).toFixed(0) : '50';
  const sentiment = data.buysTxns > data.sellsTxns ? '🐂 BULLISH' : data.buysTxns < data.sellsTxns ? '🐻 BEARISH' : '➡️ NEUTRAL';

  return `
${title}
━━━━━━━━━━━━━━━━━━━━━━

🪙 <b>${data.pairName}</b>
📍 DEX: ${data.dexId.toUpperCase()}

💰 <b>Price:</b> $${formatPrice(data.priceUsd)}
⟡ <b>SOL:</b> ${formatPrice(data.priceNative)} SOL

📊 <b>Price Changes:</b>
   5m: ${changeEmoji(data.priceChange5m)}
   1h: ${changeEmoji(data.priceChange1h)}
   6h: ${changeEmoji(data.priceChange6h)}
   24h: ${changeEmoji(data.priceChange24h)}

📈 <b>Market Data:</b>
   💎 MCap: <b>$${data.marketCap.toLocaleString()}</b>
   💧 Liquidity: <b>${data.isPumpFun && data.liquidity === data.marketCap ? '🔄 Bonding Curve' : '$' + data.liquidity.toLocaleString()}</b>
   📊 24h Vol: <b>$${data.volume24h.toLocaleString()}</b>

🔄 <b>24h Transactions:</b>
   🟢 Buys: <b>${data.buysTxns.toLocaleString()}</b>
   🔴 Sells: <b>${data.sellsTxns.toLocaleString()}</b>
   📊 Buy Ratio: <b>${buyRatio}%</b>
   ${sentiment}

━━━━━━━━━━━━━━━━━━━━━━
🕐 <i>${new Date().toUTCString()}</i>
`;
}

function buildBuyKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Buy on Jupiter', url: BUY_LINKS.jupiter }],
      [{ text: '💹 Raydium', url: BUY_LINKS.raydium }, { text: '📊 DexScreener', url: BUY_LINKS.dexscreener }],
      [{ text: '🦅 Birdeye', url: BUY_LINKS.birdeye }],
      [{ text: '📈 Live Stats', callback_data: 'live_stats' }, { text: '🔔 Alerts Info', callback_data: 'alerts_info' }],
    ]
  };
}

function buildTradeAlert(type: 'buy' | 'sell', data: TokenData): string {
  const emoji = type === 'buy' ? '🟢🟢🟢' : '🔴🔴🔴';
  const action = type === 'buy' ? 'BUY DETECTED' : 'SELL DETECTED';
  return `
${emoji} <b>${action}</b> ${emoji}
━━━━━━━━━━━━━━━━━━━━━━

🪙 <b>${data.pairName}</b>

💰 Price: <b>$${formatPrice(data.priceUsd)}</b>
📊 5m Change: ${changeEmoji(data.priceChange5m)}
💎 MCap: $${data.marketCap.toLocaleString()}
💧 Liq: $${data.liquidity.toLocaleString()}

🔄 24h: ${data.buysTxns} buys / ${data.sellsTxns} sells

━━━━━━━━━━━━━━━━━━━━━━
⚡ <a href="${BUY_LINKS.jupiter}">Trade Now on Jupiter</a>
`;
}

async function sendMessage(chatId: number | string, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (keyboard) body.reply_markup = keyboard;
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function broadcastToAllChats(supabase: any, text: string, keyboard?: object) {
  // Send to registered groups from telegram_bot_groups
  const { data: groups } = await supabase
    .from('telegram_bot_groups')
    .select('chat_id')
    .eq('is_active', true);

  let sent = 0;
  if (groups) {
    for (const g of groups) {
      try {
        await sendMessage(g.chat_id, text, keyboard);
        sent++;
      } catch (e) {
        console.error(`Failed broadcast to ${g.chat_id}:`, e);
      }
    }
  }
  return sent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // === POST: Telegram webhook ===
    if (req.method === 'POST') {
      const update = await req.json();

      // Handle commands
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || '').trim();
        const isGroup = update.message.chat.type === 'group' || update.message.chat.type === 'supergroup';

        // Auto-register groups
        if (isGroup) {
          await supabase.from('telegram_bot_groups').upsert(
            { chat_id: String(chatId), bot_name: 'CF Solana Soldier', is_active: true },
            { onConflict: 'chat_id' }
          );
        }

        if (text === '/start' || text === '/start@CFSolanaSoldierBot') {
          const data = await fetchTokenData();
          if (data) {
            await sendMessage(chatId, buildStatsMessage(data, '🤖 <b>CF SOLANA SOLDIER — LIVE TRACKER</b>'), buildBuyKeyboard());
          } else {
            await sendMessage(chatId, '🤖 <b>CF Solana Soldier Bot</b>\n\nTracking CF Token in real-time. Use /price for live stats.', buildBuyKeyboard());
          }
        } else if (text === '/price' || text === '/price@CFSolanaSoldierBot') {
          const data = await fetchTokenData();
          if (data) {
            await sendMessage(chatId, buildStatsMessage(data, '📊 <b>LIVE TOKEN STATS</b>'), buildBuyKeyboard());
          } else {
            await sendMessage(chatId, '❌ Could not fetch token data. Try again shortly.');
          }
        } else if (text === '/buy' || text === '/buy@CFSolanaSoldierBot') {
          await sendMessage(chatId, `🚀 <b>BUY CF TOKEN</b>\n\n📍 CA: <code>${TOKEN_CA}</code>\n\nChoose your platform:`, buildBuyKeyboard());
        } else if (text === '/help' || text === '/help@CFSolanaSoldierBot') {
          await sendMessage(chatId, `<b>🤖 CF Solana Soldier Commands</b>\n\n/start — Dashboard & live stats\n/price — Current price & market data\n/buy — Quick buy links\n/ca — Copy contract address\n/checktoken — All CF Exchange tokens & prices\n/help — Show this help\n\n<b>Auto Alerts:</b>\n✅ Hourly price updates\n✅ Buy & sell movement alerts\n✅ Real-time market sentiment`, buildBuyKeyboard());
        } else if (text === '/ca' || text === '/ca@CFSolanaSoldierBot') {
          await sendMessage(chatId, `📋 <b>Contract Address:</b>\n\n<code>${TOKEN_CA}</code>\n\nTap to copy ☝️`);
        } else if (text === '/checktoken' || text === '/checktoken@CFSolanaSoldierBot') {
          // Fetch all active tokens from CF Exchange
          const { data: tokens } = await supabase
            .from('user_tokens')
            .select('symbol, name, logo_emoji, price_per_token, market_cap, total_volume, status')
            .neq('status', 'suspended')
            .order('market_cap', { ascending: false });

          if (!tokens || tokens.length === 0) {
            await sendMessage(chatId, '📭 No tokens currently listed on CF Exchange.');
          } else {
            // Also fetch $CFB live data
            const cfbData = await fetchTokenData();
            let msg = `🪙🪙🪙 <b>CF BLOCKCHAIN TOKENS</b> 🪙🪙🪙\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            // Show $CFB (mainnet PumpFun token) first
            if (cfbData) {
              msg += `🚀 <b>${cfbData.pairName}</b> ($CFB) — <b>FLAGSHIP</b>\n`;
              msg += `   💰 $${formatPrice(cfbData.priceUsd)} | MCap: $${cfbData.marketCap.toLocaleString()}\n`;
              msg += `   📊 24h: ${changeEmoji(cfbData.priceChange24h)}\n`;
              msg += `   📍 <code>${TOKEN_CA}</code>\n`;
              msg += `   🔗 <a href="${BUY_LINKS.jupiter}">Buy on Jupiter</a>\n\n`;
            }

            msg += `📋 <b>CF EXCHANGE LISTINGS:</b>\n\n`;

            tokens.forEach((t: any, i: number) => {
              const emoji = t.logo_emoji || '🪙';
              const vol = t.total_volume || 0;
              msg += `${i + 1}. ${emoji} <b>${t.name}</b> ($${t.symbol})\n`;
              msg += `   💰 Price: <b>$${Number(t.price_per_token).toFixed(4)}</b>\n`;
              msg += `   💎 MCap: $${(t.market_cap || 0).toLocaleString()}\n`;
              msg += `   📊 Volume: ${vol.toLocaleString()} tokens traded\n`;
              msg += `   🔗 <a href="https://www.cfblockchains.com/exchange">Buy on CF Exchange</a>\n`;
              msg += `\n`;
            });

            msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `🌐 <a href="https://www.cfblockchains.com/exchange">Trade All Tokens on CF Exchange</a>\n`;
            msg += `\n#CFBlockchain #Solana #PumpFun`;

            await sendMessage(chatId, msg, {
              inline_keyboard: [
                [{ text: '🚀 Buy $CFB on Jupiter', url: BUY_LINKS.jupiter }],
                [{ text: '📊 CF Exchange', url: 'https://www.cfblockchains.com/exchange' }],
                [{ text: '📈 DexScreener', url: BUY_LINKS.dexscreener }],
              ]
            });
          }
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

        if (cbq.data === 'live_stats') {
          const data = await fetchTokenData();
          if (data) {
            await sendMessage(chatId, buildStatsMessage(data, '📊 <b>LIVE TOKEN STATS</b>'), buildBuyKeyboard());
          }
        } else if (cbq.data === 'alerts_info') {
          await sendMessage(chatId, `🔔 <b>Alert System Active</b>\n\nThis bot automatically sends:\n\n⏰ <b>Hourly Updates</b> — Price, volume, sentiment\n🟢 <b>Buy Alerts</b> — When buying pressure increases\n🔴 <b>Sell Alerts</b> — When selling pressure increases\n📊 <b>Milestone Alerts</b> — Price & MCap milestones\n\nAlerts are sent to all groups where this bot is added.\n\n<i>Add this bot to your group to receive alerts!</i>`, buildBuyKeyboard());
        }
      }

      return new Response(JSON.stringify({ ok: true, _version: VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === GET: Actions (hourly update, test, webhook setup) ===
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'setWebhook') {
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-solana-bot`;
        const res = await fetch(`${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getWebhookInfo') {
        const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
        const result = await res.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Hourly update broadcast
      if (action === 'hourly_update') {
        const data = await fetchTokenData();
        if (!data) {
          return new Response(JSON.stringify({ error: 'No token data' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const msg = buildStatsMessage(data, '⏰ <b>HOURLY UPDATE — CF TOKEN</b>');
        const sent = await broadcastToAllChats(supabase, msg, buildBuyKeyboard());
        return new Response(JSON.stringify({ success: true, groups_notified: sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Trade alert (called externally when buy/sell detected)
      if (action === 'trade_alert') {
        const type = (url.searchParams.get('type') || 'buy') as 'buy' | 'sell';
        const data = await fetchTokenData();
        if (!data) {
          return new Response(JSON.stringify({ error: 'No token data' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const msg = buildTradeAlert(type, data);
        const sent = await broadcastToAllChats(supabase, msg, buildBuyKeyboard());
        return new Response(JSON.stringify({ success: true, type, groups_notified: sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Test message — send current stats to all groups
      if (action === 'test') {
        const chatId = url.searchParams.get('chat_id');
        const data = await fetchTokenData();
        if (!data) {
          return new Response(JSON.stringify({ error: 'No token data available' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const msg = buildStatsMessage(data, '🧪 <b>TEST — CF SOLANA SOLDIER LIVE</b>');

        if (chatId) {
          const result = await sendMessage(chatId, msg, buildBuyKeyboard());
          return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          const sent = await broadcastToAllChats(supabase, msg, buildBuyKeyboard());
          return new Response(JSON.stringify({ success: true, groups_notified: sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Default health
      return new Response(JSON.stringify({ status: 'ok', bot: 'CF Solana Soldier', token_ca: TOKEN_CA, _version: VERSION }), {
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
