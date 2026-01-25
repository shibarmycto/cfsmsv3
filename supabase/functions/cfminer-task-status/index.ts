import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Check if user is an approved miner
    const { data: wallet } = await adminClient
      .from('wallets')
      .select('id, is_miner_approved')
      .eq('user_id', user.id)
      .single();

    if (!wallet || !wallet.is_miner_approved) {
      return new Response(
        JSON.stringify({ error: 'You are not approved as a miner' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get or create active mining session
    let { data: session } = await adminClient
      .from('mining_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      const { data: newSession } = await adminClient
        .from('mining_sessions')
        .insert({
          user_id: user.id,
          wallet_id: wallet.id,
          captchas_completed: 0,
          tokens_earned: 0
        })
        .select()
        .single();
      session = newSession;
    }

    // Get task logs for this user
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: taskLogs } = await adminClient
      .from('mining_task_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    // Calculate task status
    const signupLog = taskLogs?.find(log => log.task_type === 'signup');
    const freeBitcoinLogs = taskLogs?.filter(log => log.task_type === 'freebitcoin') || [];
    const youtubeLogs = taskLogs?.filter(log => log.task_type === 'youtube') || [];

    const lastFreeBitcoin = freeBitcoinLogs[0];
    const lastYoutube = youtubeLogs[0];

    const canDoFreeBitcoin = !lastFreeBitcoin || new Date(lastFreeBitcoin.completed_at) < oneHourAgo;
    const canDoYoutube = !lastYoutube || new Date(lastYoutube.completed_at) < oneHourAgo;

    const status = {
      signup: {
        completed: !!signupLog,
        completedAt: signupLog?.completed_at || null
      },
      freebitcoin: {
        completed: !canDoFreeBitcoin,
        lastCompleted: lastFreeBitcoin?.completed_at || null,
        canDoAt: lastFreeBitcoin ? new Date(new Date(lastFreeBitcoin.completed_at).getTime() + 60 * 60 * 1000).toISOString() : null
      },
      youtube: {
        completed: !canDoYoutube,
        lastCompleted: lastYoutube?.completed_at || null,
        canDoAt: lastYoutube ? new Date(new Date(lastYoutube.completed_at).getTime() + 60 * 60 * 1000).toISOString() : null
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        status,
        session: session ? {
          id: session.id,
          captchasCompleted: session.captchas_completed,
          tokensEarned: session.tokens_earned
        } : null
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
