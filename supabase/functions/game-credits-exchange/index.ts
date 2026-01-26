import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange rate: 1 CF Credit = $100 in-game money
const GAME_MONEY_PER_CREDIT = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { creditsToExchange, characterId } = await req.json();

    // Validate input
    if (!creditsToExchange || creditsToExchange < 1) {
      return new Response(
        JSON.stringify({ error: 'Minimum 1 credit required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!characterId) {
      return new Response(
        JSON.stringify({ error: 'Character ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user's SMS credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.sms_credits < creditsToExchange) {
      return new Response(
        JSON.stringify({ error: 'Insufficient CF credits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify character belongs to user
    const { data: character, error: charError } = await supabase
      .from('game_characters')
      .select('id, user_id, cash')
      .eq('id', characterId)
      .single();

    if (charError || !character) {
      return new Response(
        JSON.stringify({ error: 'Character not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (character.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Character does not belong to you' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gameMoneyToAdd = creditsToExchange * GAME_MONEY_PER_CREDIT;

    // Deduct credits from profile
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ sms_credits: profile.sms_credits - creditsToExchange })
      .eq('user_id', user.id);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add cash to character
    const { error: cashError } = await supabase
      .from('game_characters')
      .update({ cash: character.cash + gameMoneyToAdd })
      .eq('id', characterId);

    if (cashError) {
      // Rollback credit deduction
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ error: 'Failed to add game money' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the transaction
    await supabase.from('game_transactions').insert({
      character_id: characterId,
      amount: gameMoneyToAdd,
      transaction_type: 'credit_exchange',
      description: `Exchanged ${creditsToExchange} CF credits for $${gameMoneyToAdd.toLocaleString()}`
    });

    return new Response(
      JSON.stringify({
        success: true,
        creditsUsed: creditsToExchange,
        gameMoneyAdded: gameMoneyToAdd,
        newCash: character.cash + gameMoneyToAdd,
        remainingCredits: profile.sms_credits - creditsToExchange
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Exchange error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
