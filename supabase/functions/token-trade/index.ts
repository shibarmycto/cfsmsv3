import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TOKEN_CREATION_COST = 25;
const INITIAL_SUPPLY = 999000000;
const INITIAL_CIRCULATING = 3000;
const LARGE_TRADE_THRESHOLD = 10000;
const MAX_OWNERSHIP_PERCENT = 0.25;
const EARLY_WITHDRAWAL_FEE = 0.5;
const PRICE_IMPACT_FACTOR = 0.0001;

// Fire-and-forget Telegram alert
async function sendTelegramAlert(supabaseUrl: string, alertType: string, data: Record<string, any>) {
  try {
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    await fetch(`${supabaseUrl}/functions/v1/cf-blockchain-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ alert_type: alertType, data }),
    });
  } catch (e) {
    console.error('Telegram alert failed (non-blocking):', e);
  }
}

// Calculate new price based on trade impact
function calculatePriceImpact(
  currentPrice: number,
  tradeAmount: number,
  isBuy: boolean,
  circulatingSupply: number
): number {
  // Larger trades relative to circulating supply have more impact
  const supplyRatio = tradeAmount / Math.max(circulatingSupply, 1000);
  const impact = supplyRatio * PRICE_IMPACT_FACTOR * 10000; // Scale impact
  
  if (isBuy) {
    // Buys increase price
    return Math.max(0.01, currentPrice * (1 + impact));
  } else {
    // Sells decrease price
    return Math.max(0.01, currentPrice * (1 - impact));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;

    // Get user profile for credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE TOKEN
    if (action === 'create_token') {
      const { name, symbol, description, logoEmoji } = params;

      if (!name || !symbol) {
        return new Response(
          JSON.stringify({ error: 'Name and symbol are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (symbol.length < 2 || symbol.length > 6) {
        return new Response(
          JSON.stringify({ error: 'Symbol must be 2-6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile.sms_credits < TOKEN_CREATION_COST) {
        return new Response(
          JSON.stringify({ error: `Insufficient credits. Need ${TOKEN_CREATION_COST} credits.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if symbol exists
      const { data: existing, error: existingError } = await supabase
        .from('user_tokens')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Token symbol already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct credits
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits - TOKEN_CREATION_COST })
        .eq('user_id', user.id);

      // Create token with 999M total supply, 3K circulating (MCap starts at 3K)
      const { data: newToken, error: tokenError } = await supabase
        .from('user_tokens')
        .insert({
          creator_id: user.id,
          name,
          symbol: symbol.toUpperCase(),
          description: description || null,
          logo_emoji: logoEmoji || '🪙',
          total_supply: INITIAL_SUPPLY,
          circulating_supply: INITIAL_CIRCULATING,
          price_per_token: 1,
          market_cap: INITIAL_CIRCULATING, // MCap = circulating * price = 3000 * 1 = 3000
          holder_count: 0,
        })
        .select()
        .single();

      if (tokenError) {
        // Refund credits on failure
        await supabase
          .from('profiles')
          .update({ sms_credits: profile.sms_credits })
          .eq('user_id', user.id);
        throw tokenError;
      }

      // Log creation transaction
      await supabase.from('token_transactions').insert({
        token_id: newToken.id,
        seller_id: null,
        buyer_id: user.id,
        transaction_type: 'creation',
        amount: 0,
        price_per_token: 1,
        total_credits: TOKEN_CREATION_COST,
      });

      // Add news event for new listing
      await supabase.from('token_news').insert({
        token_id: newToken.id,
        event_type: 'new_listing',
        title: `🚀 NEW TOKEN: ${name} ($${symbol.toUpperCase()})`,
        description: `${INITIAL_SUPPLY.toLocaleString()} ${symbol.toUpperCase()} tokens created! ${INITIAL_CIRCULATING.toLocaleString()} available for trading now. ${description || ''}`,
        impact: 'high',
        metadata: { creator_id: user.id, total_supply: INITIAL_SUPPLY, initial_circulating: INITIAL_CIRCULATING },
      });

      // Send Telegram alert for new token
      sendTelegramAlert(supabaseUrl, 'new_token', {
        name,
        symbol: symbol.toUpperCase(),
        logo_emoji: logoEmoji || '🪙',
        price: 1,
        description: description || '',
        creator_name: user.email?.split('@')[0] || 'Anonymous',
      });

      return new Response(
        JSON.stringify({ success: true, token: newToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BUY TOKENS
    if (action === 'buy_tokens') {
      const { tokenId, amount } = params;

      if (!tokenId || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid token or amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get token details
      const { data: tokenData } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('id', tokenId)
        .single();

      if (!tokenData || tokenData.status === 'suspended') {
        return new Response(
          JSON.stringify({ error: 'Token not found or suspended' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pricePerToken = tokenData.price_per_token;
      const totalCost = Math.ceil(amount * pricePerToken);
      const availableSupply = tokenData.total_supply - tokenData.circulating_supply;

      if (amount > availableSupply) {
        return new Response(
          JSON.stringify({ error: `Only ${availableSupply.toLocaleString()} tokens available` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile.sms_credits < totalCost) {
        return new Response(
          JSON.stringify({ error: `Insufficient credits. Need ${totalCost} credits.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current user holding for 25% max check
      const { data: existingHolding } = await supabase
        .from('token_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_id', tokenId)
        .single();

      const currentHolding = existingHolding?.amount || 0;
      const newTotalHolding = currentHolding + amount;
      const maxAllowed = Math.floor(tokenData.total_supply * MAX_OWNERSHIP_PERCENT);

      if (newTotalHolding > maxAllowed) {
        const canBuy = maxAllowed - currentHolding;
        return new Response(
          JSON.stringify({ 
            error: `Max 25% ownership allowed. You can buy up to ${canBuy.toLocaleString()} more tokens.`,
            maxBuyable: canBuy
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct credits from buyer
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits - totalCost })
        .eq('user_id', user.id);

      // Credit the token creator
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('sms_credits')
        .eq('user_id', tokenData.creator_id)
        .single();

      if (creatorProfile) {
        await supabase
          .from('profiles')
          .update({ sms_credits: creatorProfile.sms_credits + totalCost })
          .eq('user_id', tokenData.creator_id);
      }

      // Update or create holding
      let isNewHolder = false;
      if (existingHolding) {
        const newAmount = existingHolding.amount + amount;
        const newAvgPrice = ((existingHolding.amount * existingHolding.avg_buy_price) + (amount * pricePerToken)) / newAmount;
        await supabase
          .from('token_holdings')
          .update({ amount: newAmount, avg_buy_price: newAvgPrice })
          .eq('id', existingHolding.id);
      } else {
        isNewHolder = true;
        await supabase.from('token_holdings').insert({
          user_id: user.id,
          token_id: tokenId,
          amount,
          avg_buy_price: pricePerToken,
        });
      }

      // Calculate new price with trade impact (buys push price UP)
      const newCirculating = tokenData.circulating_supply + amount;
      const newPrice = calculatePriceImpact(pricePerToken, amount, true, tokenData.circulating_supply);
      const newMarketCap = Math.round(newCirculating * newPrice);
      
      const newTotalVolume = (tokenData.total_volume || 0) + totalCost;
      const newTotalSalesValue = (tokenData.total_sales_value || 0) + totalCost;
      const newHolderCount = isNewHolder ? (tokenData.holder_count || 0) + 1 : (tokenData.holder_count || 0);
      
      // Check for milestone upgrades
      let newStatus = tokenData.status;
      if (newTotalSalesValue >= 100000 && tokenData.status !== 'graduated') {
        newStatus = 'graduated';
      } else if (newTotalSalesValue >= 50000 && tokenData.status !== 'graduated' && tokenData.status !== 'verified') {
        newStatus = 'verified';
      } else if (newTotalSalesValue >= 10000 && tokenData.status === 'active') {
        newStatus = 'established';
      }

      await supabase
        .from('user_tokens')
        .update({
          circulating_supply: newCirculating,
          price_per_token: Math.round(newPrice * 10000) / 10000, // Round to 4 decimals
          total_volume: newTotalVolume,
          total_sales_value: newTotalSalesValue,
          market_cap: newMarketCap,
          status: newStatus,
          holder_count: newHolderCount,
        })
        .eq('id', tokenId);

      // Log transaction
      await supabase.from('token_transactions').insert({
        token_id: tokenId,
        buyer_id: user.id,
        seller_id: tokenData.creator_id,
        transaction_type: 'buy',
        amount,
        price_per_token: pricePerToken,
        total_credits: totalCost,
      });

      // ALWAYS add a simple news item for each buy (token + amount + timestamp)
      await supabase.from('token_news').insert({
        token_id: tokenId,
        event_type: 'buy',
        title: `📈 BUY: ${amount.toLocaleString()} $${tokenData.symbol}`,
        description: `${amount.toLocaleString()} ${tokenData.symbol} bought for ${totalCost.toLocaleString()} credits at ${pricePerToken} each.`,
        impact: 'low',
        metadata: {
          amount,
          total_credits: totalCost,
          price_per_token: pricePerToken,
        },
      });

      // Add news for new holders
      if (isNewHolder && newHolderCount % 10 === 0) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'milestone',
          title: `📊 ${tokenData.symbol} hits ${newHolderCount} holders!`,
          description: `${tokenData.name} is growing! The token now has ${newHolderCount} unique holders.`,
          impact: 'medium',
          metadata: { holder_count: newHolderCount },
        });
      }

      // Add news for large trades
      if (totalCost >= LARGE_TRADE_THRESHOLD) {
        const priceChangePercent = ((newPrice - pricePerToken) / pricePerToken * 100).toFixed(2);
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'large_buy',
          title: `📈 WHALE BUY: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `A whale just bought ${amount.toLocaleString()} ${tokenData.symbol} tokens worth ${totalCost.toLocaleString()} credits! Price pumped +${priceChangePercent}% 🟢`,
          impact: totalCost >= 50000 ? 'high' : 'medium',
          metadata: { amount, total_credits: totalCost, price_impact: priceChangePercent },
        });
      }

      // Add news for status upgrades
      if (newStatus !== tokenData.status) {
        const statusMessages: Record<string, { title: string; description: string }> = {
          established: {
            title: `🏆 ${tokenData.symbol} ESTABLISHED!`,
            description: `${tokenData.name} has reached £10,000 in total sales and achieved Established status!`
          },
          verified: {
            title: `✅ ${tokenData.symbol} VERIFIED!`,
            description: `${tokenData.name} has reached £50,000 in total sales! Creator is now verified on the platform!`
          },
          graduated: {
            title: `🎓 ${tokenData.symbol} GRADUATED! 🎉`,
            description: `HUGE NEWS! ${tokenData.name} has reached £100,000 in total sales and GRADUATED! Brand deal unlocked!`
          },
        };
        const msg = statusMessages[newStatus];
        if (msg) {
          await supabase.from('token_news').insert({
            token_id: tokenId,
            event_type: newStatus,
            title: msg.title,
            description: msg.description,
            impact: 'high',
            metadata: { total_sales_value: newTotalSalesValue },
          });
        }
      }

      // Send Telegram alert for buy
      sendTelegramAlert(supabaseUrl, 'token_buy', {
        symbol: tokenData.symbol,
        logo_emoji: tokenData.logo_emoji,
        token_name: tokenData.name,
        amount,
        total: totalCost,
        price: pricePerToken,
        buyer_name: user.email?.split('@')[0] || 'Anonymous',
      });

      // Alert for status upgrade
      if (newStatus !== tokenData.status) {
        sendTelegramAlert(supabaseUrl, 'token_graduated', {
          name: tokenData.name,
          symbol: tokenData.symbol,
          logo_emoji: tokenData.logo_emoji,
          market_cap: newMarketCap,
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          amount, 
          totalCost, 
          newPrice: Math.round(newPrice * 10000) / 10000,
          newBalance: profile.sms_credits - totalCost 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SELL TOKENS
    if (action === 'sell_tokens') {
      const { tokenId, amount } = params;

      if (!tokenId || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid token or amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's holding
      const { data: holding } = await supabase
        .from('token_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_id', tokenId)
        .single();

      if (!holding || holding.amount < amount) {
        return new Response(
          JSON.stringify({ error: `Insufficient tokens. You have ${holding?.amount || 0}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get token details
      const { data: tokenData } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('id', tokenId)
        .single();

      if (!tokenData || tokenData.status === 'suspended') {
        return new Response(
          JSON.stringify({ error: 'Token not found or suspended' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pricePerToken = tokenData.price_per_token;
      let totalValue = Math.floor(amount * pricePerToken);
      let earlyWithdrawalPenalty = 0;

      // Apply 50% early withdrawal fee if token hasn't graduated
      if (tokenData.status !== 'graduated') {
        earlyWithdrawalPenalty = Math.floor(totalValue * EARLY_WITHDRAWAL_FEE);
        totalValue = totalValue - earlyWithdrawalPenalty;
      }

      // Update holding
      const newHoldingAmount = holding.amount - amount;
      let holderRemoved = false;
      if (newHoldingAmount <= 0) {
        await supabase.from('token_holdings').delete().eq('id', holding.id);
        holderRemoved = true;
      } else {
        await supabase.from('token_holdings').update({ amount: newHoldingAmount }).eq('id', holding.id);
      }

      // Credit user with credits (after fee)
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits + totalValue })
        .eq('user_id', user.id);

      // Calculate new price with trade impact (sells push price DOWN)
      const newCirculating = Math.max(0, tokenData.circulating_supply - amount);
      const newPrice = calculatePriceImpact(pricePerToken, amount, false, tokenData.circulating_supply);
      const newMarketCap = Math.round(newCirculating * newPrice);
      
      const newTotalVolume = (tokenData.total_volume || 0) + (totalValue + earlyWithdrawalPenalty);
      const newHolderCount = holderRemoved ? Math.max(0, (tokenData.holder_count || 0) - 1) : (tokenData.holder_count || 0);

      await supabase
        .from('user_tokens')
        .update({
          circulating_supply: newCirculating,
          price_per_token: Math.round(newPrice * 10000) / 10000,
          total_volume: newTotalVolume,
          market_cap: newMarketCap,
          holder_count: newHolderCount,
        })
        .eq('id', tokenId);

      // Log transaction
      await supabase.from('token_transactions').insert({
        token_id: tokenId,
        seller_id: user.id,
        buyer_id: null,
        transaction_type: 'sell',
        amount,
        price_per_token: pricePerToken,
        total_credits: totalValue + earlyWithdrawalPenalty,
      });

      const priceChangePercent = ((newPrice - pricePerToken) / pricePerToken * 100).toFixed(2);

      // Add news for early withdrawal with penalty (RED CANDLE)
      if (earlyWithdrawalPenalty > 0) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'early_withdrawal',
          title: `🔴 EARLY SELL: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `A holder sold ${amount.toLocaleString()} ${tokenData.symbol} BEFORE graduation! 50% penalty applied (${earlyWithdrawalPenalty.toLocaleString()} credits burned). Price dropped ${priceChangePercent}% 📉`,
          impact: 'high',
          metadata: { 
            amount, 
            penalty: earlyWithdrawalPenalty, 
            received: totalValue,
            full_value: totalValue + earlyWithdrawalPenalty,
            price_impact: priceChangePercent
          },
        });
      }

      // Add news for large sales (additional alert)
      if ((totalValue + earlyWithdrawalPenalty) >= LARGE_TRADE_THRESHOLD) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'large_sell',
          title: `📉 LARGE SELL: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `${amount.toLocaleString()} ${tokenData.symbol} tokens sold for ${totalValue.toLocaleString()} credits${earlyWithdrawalPenalty > 0 ? ` (${earlyWithdrawalPenalty.toLocaleString()} burned)` : ''}! Price dropped ${priceChangePercent}%`,
          impact: (totalValue + earlyWithdrawalPenalty) >= 50000 ? 'high' : 'medium',
          metadata: { amount, total_credits: totalValue, price_impact: priceChangePercent },
        });
      }

      // Add news if holder count dropped significantly
      if (holderRemoved && newHolderCount > 0 && newHolderCount % 10 === 0) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'holder_drop',
          title: `⚠️ ${tokenData.symbol} down to ${newHolderCount} holders`,
          description: `${tokenData.name} lost a holder. Current holder count: ${newHolderCount}`,
          impact: 'low',
          metadata: { holder_count: newHolderCount },
        });
      }

      // Send Telegram alert for sell
      sendTelegramAlert(supabaseUrl, 'token_sell', {
        symbol: tokenData.symbol,
        logo_emoji: tokenData.logo_emoji,
        token_name: tokenData.name,
        amount,
        total: totalValue + earlyWithdrawalPenalty,
        price: pricePerToken,
        seller_name: user.email?.split('@')[0] || 'Anonymous',
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          amount, 
          totalValue, 
          earlyWithdrawalPenalty,
          newPrice: Math.round(newPrice * 10000) / 10000,
          newBalance: profile.sms_credits + totalValue 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Token trade error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
