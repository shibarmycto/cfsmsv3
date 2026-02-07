import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKEN_CREATION_COST = 25;
const INITIAL_SUPPLY = 999000000;
const LARGE_TRADE_THRESHOLD = 10000;
const MAX_OWNERSHIP_PERCENT = 0.25; // 25% max ownership per user
const EARLY_WITHDRAWAL_FEE = 0.5; // 50% fee for selling before graduation

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

    const { action, ...params } = await req.json();

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
      const { data: existing } = await supabase
        .from('user_tokens')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

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

      // Create token with 999M supply
      const { data: newToken, error: tokenError } = await supabase
        .from('user_tokens')
        .insert({
          creator_id: user.id,
          name,
          symbol: symbol.toUpperCase(),
          description: description || null,
          logo_emoji: logoEmoji || '🪙',
          total_supply: INITIAL_SUPPLY,
          circulating_supply: 0,
          price_per_token: 1,
          market_cap: INITIAL_SUPPLY,
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
        description: `${INITIAL_SUPPLY.toLocaleString()} ${symbol.toUpperCase()} tokens are now available for trading on CF Exchange! ${description || ''}`,
        impact: 'high',
        metadata: { creator_id: user.id, total_supply: INITIAL_SUPPLY },
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

      // Update token stats
      const newCirculating = tokenData.circulating_supply + amount;
      const newTotalVolume = tokenData.total_volume + totalCost;
      const newTotalSalesValue = tokenData.total_sales_value + totalCost;
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
          total_volume: newTotalVolume,
          total_sales_value: newTotalSalesValue,
          market_cap: newCirculating * pricePerToken,
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
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'large_buy',
          title: `📈 WHALE BUY: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `A whale just bought ${amount.toLocaleString()} ${tokenData.symbol} tokens worth ${totalCost.toLocaleString()} credits! Bullish signal 🟢`,
          impact: totalCost >= 50000 ? 'high' : 'medium',
          metadata: { amount, total_credits: totalCost },
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

      return new Response(
        JSON.stringify({ success: true, amount, totalCost, newBalance: profile.sms_credits - totalCost }),
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

      // Update token stats
      const newCirculating = tokenData.circulating_supply - amount;
      const newTotalVolume = tokenData.total_volume + (totalValue + earlyWithdrawalPenalty);
      const newHolderCount = holderRemoved ? Math.max(0, (tokenData.holder_count || 0) - 1) : (tokenData.holder_count || 0);

      await supabase
        .from('user_tokens')
        .update({
          circulating_supply: Math.max(0, newCirculating),
          total_volume: newTotalVolume,
          market_cap: Math.max(0, newCirculating) * pricePerToken,
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

      // Add news for early withdrawal with penalty (RED CANDLE)
      if (earlyWithdrawalPenalty > 0) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'early_withdrawal',
          title: `🔴 EARLY SELL: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `A holder sold ${amount.toLocaleString()} ${tokenData.symbol} BEFORE graduation! 50% penalty applied (${earlyWithdrawalPenalty.toLocaleString()} credits burned). This is bearish for the token! 📉`,
          impact: 'high',
          metadata: { 
            amount, 
            penalty: earlyWithdrawalPenalty, 
            received: totalValue,
            full_value: totalValue + earlyWithdrawalPenalty 
          },
        });
      }

      // Add news for large sales (additional alert)
      if ((totalValue + earlyWithdrawalPenalty) >= LARGE_TRADE_THRESHOLD) {
        await supabase.from('token_news').insert({
          token_id: tokenId,
          event_type: 'large_sell',
          title: `📉 LARGE SELL: ${amount.toLocaleString()} $${tokenData.symbol}`,
          description: `${amount.toLocaleString()} ${tokenData.symbol} tokens sold for ${totalValue.toLocaleString()} credits${earlyWithdrawalPenalty > 0 ? ` (${earlyWithdrawalPenalty.toLocaleString()} burned)` : ''}!`,
          impact: (totalValue + earlyWithdrawalPenalty) >= 50000 ? 'high' : 'medium',
          metadata: { amount, total_credits: totalValue },
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          amount, 
          totalValue, 
          earlyWithdrawalPenalty,
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
