import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TASKS_PER_TOKEN = 1000;

// Minimum time required to complete each task (in seconds)
const MIN_TASK_TIME: Record<string, number> = {
  signup: 5,       // 5 seconds minimum for signup tasks
  freebitcoin: 15, // 15 seconds minimum for FreeBitcoin (need to load page, solve captcha, roll)
  youtube: 30,     // 30 seconds minimum for YouTube watch
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

    const { taskType, details, startedAt } = await req.json();

    if (!taskType || !['signup', 'freebitcoin', 'youtube'].includes(taskType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid task type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate timing - check if enough time has passed
    const minTime = MIN_TASK_TIME[taskType] || 5;
    const taskStartTime = startedAt ? new Date(startedAt).getTime() : 0;
    const now = Date.now();
    const elapsedSeconds = taskStartTime ? Math.floor((now - taskStartTime) / 1000) : 0;

    // If no start time provided or elapsed time is too short, reject
    if (!startedAt || elapsedSeconds < minTime) {
      const taskNames: Record<string, string> = {
        signup: 'Website Sign-up',
        freebitcoin: 'FreeBitcoin Roll',
        youtube: 'YouTube Watch'
      };
      
      const timeNeeded = minTime - elapsedSeconds;
      const message = !startedAt 
        ? `Please start the ${taskNames[taskType]} task properly before completing it.`
        : `Task completed too quickly! ${taskNames[taskType]} requires at least ${minTime} seconds. You only spent ${elapsedSeconds} seconds. Please try again and spend more time on the task.`;
      
      console.log(`Task rejected: ${taskType} by user ${user.id}. Elapsed: ${elapsedSeconds}s, Required: ${minTime}s`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: message,
          rejected: true,
          reason: 'too_fast',
          elapsedSeconds,
          requiredSeconds: minTime,
          timeNeeded
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Additional validation for YouTube - check watchTime from details
    if (taskType === 'youtube' && details?.watchTime) {
      const reportedWatchTime = details.watchTime;
      // Cross-check: reported watch time should roughly match elapsed time
      const tolerance = 5; // 5 second tolerance for network delays
      
      if (reportedWatchTime < minTime || Math.abs(reportedWatchTime - elapsedSeconds) > tolerance + elapsedSeconds * 0.2) {
        console.log(`YouTube watch time mismatch: reported ${reportedWatchTime}s, elapsed ${elapsedSeconds}s`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Watch time verification failed. Please watch the video for at least ${minTime} seconds without pausing.`,
            rejected: true,
            reason: 'time_mismatch'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
    const nowDate = new Date();
    const oneHourAgo = new Date(nowDate.getTime() - 60 * 60 * 1000);

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

    // Log the task completion with timing data
    await adminClient
      .from('mining_task_logs')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        task_type: taskType,
        task_details: { 
          ...details, 
          elapsedSeconds,
          startedAt,
          completedAt: new Date().toISOString(),
          verified: true
        },
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

    console.log(`Task completed: ${taskType} by user ${user.id}. Elapsed: ${elapsedSeconds}s, Total: ${newTasksCompleted}, Tokens: ${newTokensEarned}`);

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
        verifiedTime: elapsedSeconds,
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
