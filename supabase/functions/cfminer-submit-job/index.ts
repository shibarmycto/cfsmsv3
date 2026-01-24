import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CAPTCHAS_PER_TOKEN = 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { jobId, answer, captchaType, expectedAnswer } = await req.json();

    if (!jobId || !answer) {
      return new Response(
        JSON.stringify({ error: 'Missing job ID or answer' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user's wallet
    const { data: wallet } = await adminClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet || !wallet.is_miner_approved) {
      return new Response(
        JSON.stringify({ error: 'Not approved as miner' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get active session
    const { data: session } = await adminClient
      .from('mining_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'No active mining session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate answer based on captcha type
    let isCorrect = false;
    
    if (captchaType === 'text') {
      // For text captchas, answer should match the challenge (case insensitive)
      isCorrect = answer.toUpperCase() === expectedAnswer?.toUpperCase();
    } else if (captchaType === 'math' || captchaType === 'pattern') {
      // For math and pattern, check exact answer
      isCorrect = answer.toString().trim() === expectedAnswer?.toString().trim();
    } else {
      // Default: accept any non-empty answer for now (for real 2Captcha integration)
      isCorrect = answer.length > 0;
    }

    if (!isCorrect) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          correct: false,
          message: 'Incorrect answer. Try again!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session with completed captcha
    const newCaptchasCompleted = session.captchas_completed + 1;
    const tokensToAward = Math.floor(newCaptchasCompleted / CAPTCHAS_PER_TOKEN) - Math.floor(session.captchas_completed / CAPTCHAS_PER_TOKEN);
    const newTokensEarned = session.tokens_earned + tokensToAward;

    await adminClient
      .from('mining_sessions')
      .update({
        captchas_completed: newCaptchasCompleted,
        tokens_earned: newTokensEarned
      })
      .eq('id', session.id);

    // If tokens were earned, update wallet
    if (tokensToAward > 0) {
      await adminClient
        .from('wallets')
        .update({
          balance: wallet.balance + tokensToAward,
          total_mined: wallet.total_mined + tokensToAward
        })
        .eq('id', wallet.id);

      // Create transaction record
      await adminClient
        .from('wallet_transactions')
        .insert({
          to_wallet_id: wallet.id,
          amount: tokensToAward,
          transaction_type: 'mining',
          status: 'completed',
          description: `Mining reward for ${CAPTCHAS_PER_TOKEN} completed tasks`
        });
    }

    const progressToNextToken = newCaptchasCompleted % CAPTCHAS_PER_TOKEN;

    return new Response(
      JSON.stringify({
        success: true,
        correct: true,
        captchasCompleted: newCaptchasCompleted,
        tokensEarned: newTokensEarned,
        tokensAwarded: tokensToAward,
        progressToNextToken,
        captchasNeeded: CAPTCHAS_PER_TOKEN - progressToNextToken,
        newBalance: wallet.balance + tokensToAward,
        message: tokensToAward > 0 
          ? `🎉 You earned ${tokensToAward} CFSMS token${tokensToAward > 1 ? 's' : ''}!` 
          : `Correct! ${CAPTCHAS_PER_TOKEN - progressToNextToken} more to earn a token.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
