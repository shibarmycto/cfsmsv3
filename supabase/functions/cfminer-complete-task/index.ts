import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TASKS_PER_TOKEN = 1000;

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

    const { taskType, details } = await req.json();

    if (!taskType || !['signup', 'freebitcoin', 'youtube'].includes(taskType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid task type' }),
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

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check task eligibility
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (taskType === 'signup') {
      // Check if already completed signup
      const { data: existingSignup } = await adminClient
        .from('mining_task_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_type', 'signup')
        .maybeSingle();

      if (existingSignup) {
        return new Response(
          JSON.stringify({ success: false, error: 'Signup task already completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Check hourly limit for freebitcoin and youtube
      const { data: recentTask } = await adminClient
        .from('mining_task_logs')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('task_type', taskType)
        .gte('completed_at', oneHourAgo.toISOString())
        .maybeSingle();

      if (recentTask) {
        const nextAvailable = new Date(new Date(recentTask.completed_at).getTime() + 60 * 60 * 1000);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `You can only do this task once per hour. Next available: ${nextAvailable.toISOString()}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log the task completion
    await adminClient
      .from('mining_task_logs')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        task_type: taskType,
        task_details: details || {},
        session_id: session.id,
        tokens_awarded: 0
      });

    // Update session with completed task
    const newTasksCompleted = session.captchas_completed + 1;
    const tokensToAward = Math.floor(newTasksCompleted / TASKS_PER_TOKEN) - Math.floor(session.captchas_completed / TASKS_PER_TOKEN);
    const newTokensEarned = session.tokens_earned + tokensToAward;

    await adminClient
      .from('mining_sessions')
      .update({
        captchas_completed: newTasksCompleted,
        tokens_earned: newTokensEarned
      })
      .eq('id', session.id);

    // If tokens were earned, update wallet and log
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
          description: `Mining reward for ${TASKS_PER_TOKEN} completed tasks`
        });

      // Update the task log with tokens awarded
      await adminClient
        .from('mining_task_logs')
        .update({ tokens_awarded: tokensToAward })
        .eq('user_id', user.id)
        .eq('task_type', taskType)
        .order('completed_at', { ascending: false })
        .limit(1);
    }

    console.log(`Task completed: ${taskType} by user ${user.id}. Total: ${newTasksCompleted}, Tokens: ${newTokensEarned}`);

    const taskNames: Record<string, string> = {
      signup: 'Website Sign-up',
      freebitcoin: 'FreeBitcoin Roll',
      youtube: 'YouTube Watch'
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: `${taskNames[taskType]} completed! +1 task progress.`,
        tasksCompleted: newTasksCompleted,
        tokensEarned: newTokensEarned,
        tokensAwarded: tokensToAward,
        newBalance: wallet.balance + tokensToAward,
        session: {
          id: session.id,
          captchasCompleted: newTasksCompleted,
          tokensEarned: newTokensEarned
        }
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
