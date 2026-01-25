import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWOCAPTCHA_API_KEY = Deno.env.get('TWOCAPTCHA_API_KEY');

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

    // Check if API key is configured
    if (!TWOCAPTCHA_API_KEY) {
      console.error('TWOCAPTCHA_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: '2Captcha API key not configured',
          debug: 'Missing TWOCAPTCHA_API_KEY secret'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Fetching captcha job from 2Captcha with API key:', TWOCAPTCHA_API_KEY?.substring(0, 8) + '...');

    // Try to get a real captcha task from 2Captcha using the worker/earning API
    // Method 1: New API format (api.2captcha.com)
    let captchaData = null;
    let apiError = null;
    
    try {
      const taskResponse = await fetch('https://api.2captcha.com/getTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientKey: TWOCAPTCHA_API_KEY,
          languagePool: 'en',
          softId: 0
        })
      });

      const taskResult = await taskResponse.json();
      console.log('2Captcha getTask response:', JSON.stringify(taskResult));

      if (taskResult.errorId === 0 && taskResult.task) {
        const task = taskResult.task;
        
        if (task.type === 'ImageToTextTask' && task.body) {
          captchaData = {
            type: 'image',
            challenge: task.body,
            jobId: taskResult.taskId,
            hint: task.comment || 'Type the characters you see in the image',
            isReal: true,
            source: '2captcha-new-api'
          };
        }
      } else {
        apiError = taskResult.errorDescription || taskResult.errorCode || 'Unknown error';
        console.log('2Captcha API error:', apiError);
      }
    } catch (err: unknown) {
      console.error('2Captcha new API error:', err);
      apiError = err instanceof Error ? err.message : 'API request failed';
    }

    // Method 2: Try legacy API format if new API didn't work
    if (!captchaData) {
      try {
        const legacyUrl = `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&json=1`;
        console.log('Trying legacy API...');
        
        const legacyResponse = await fetch(legacyUrl);
        const legacyText = await legacyResponse.text();
        console.log('2Captcha legacy response:', legacyText);
        
        try {
          const legacyResult = JSON.parse(legacyText);
          
          if (legacyResult.status === 1 && legacyResult.request) {
            // Parse the captcha data
            if (typeof legacyResult.request === 'object') {
              captchaData = {
                type: 'image',
                challenge: legacyResult.request.captcha || legacyResult.request.body,
                jobId: legacyResult.request.id || `2c_${Date.now()}`,
                hint: legacyResult.request.comment || 'Type the characters you see',
                isReal: true,
                source: '2captcha-legacy'
              };
            }
          } else if (legacyResult.request) {
            apiError = legacyResult.request;
          }
        } catch (parseErr) {
          // Response might not be JSON
          if (legacyText.includes('CAPCHA_NOT_READY') || legacyText.includes('ERROR_NO_SLOT_AVAILABLE')) {
            apiError = legacyText;
          }
        }
      } catch (legacyErr) {
        console.error('2Captcha legacy API error:', legacyErr);
      }
    }

    // Method 3: Try in.php to get available work
    if (!captchaData) {
      try {
        const workUrl = `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&action=getbalance&json=1`;
        const balanceResponse = await fetch(workUrl);
        const balanceText = await balanceResponse.text();
        console.log('2Captcha balance check:', balanceText);
        
        // Also try to check account status
        const statusUrl = `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=getbalance&json=1`;
        const statusResponse = await fetch(statusUrl);
        const statusText = await statusResponse.text();
        console.log('2Captcha status check:', statusText);
      } catch (checkErr) {
        console.error('2Captcha check error:', checkErr);
      }
    }

    // If we got a real captcha, return it
    if (captchaData) {
      console.log('Returning real captcha job:', captchaData.jobId);
      return new Response(
        JSON.stringify({
          success: true,
          captcha: captchaData,
          session: {
            id: session.id,
            captchasCompleted: session.captchas_completed,
            tokensEarned: session.tokens_earned
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No real captcha available - return info about why
    console.log('No real captcha available, returning practice mode. API error:', apiError);
    
    // Generate practice captcha as fallback
    const captchaTypes = ['text', 'math', 'pattern'];
    const selectedType = captchaTypes[Math.floor(Math.random() * captchaTypes.length)];
    
    if (selectedType === 'text') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let text = '';
      for (let i = 0; i < 6; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      captchaData = {
        type: 'text',
        challenge: text,
        answer: text,
        jobId: `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        hint: 'Type the characters you see (Practice Mode)',
        isReal: false,
        apiStatus: apiError || 'No jobs available from 2Captcha'
      };
    } else if (selectedType === 'math') {
      const num1 = Math.floor(Math.random() * 20) + 1;
      const num2 = Math.floor(Math.random() * 20) + 1;
      const operators = ['+', '-', '*'];
      const op = operators[Math.floor(Math.random() * operators.length)];
      let answer: string;
      switch (op) {
        case '+': answer = (num1 + num2).toString(); break;
        case '-': answer = (num1 - num2).toString(); break;
        case '*': answer = (num1 * num2).toString(); break;
        default: answer = (num1 + num2).toString();
      }
      captchaData = {
        type: 'math',
        challenge: `${num1} ${op} ${num2} = ?`,
        answer: answer,
        jobId: `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        hint: 'Solve the math problem (Practice Mode)',
        isReal: false,
        apiStatus: apiError || 'No jobs available from 2Captcha'
      };
    } else {
      const patterns = [
        { pattern: '🔴🔵🔴🔵', next: '🔴', hint: 'What comes next in the pattern?' },
        { pattern: '1, 2, 4, 8, ?', next: '16', hint: 'Complete the sequence' },
        { pattern: 'A, C, E, G, ?', next: 'I', hint: 'Complete the sequence' },
        { pattern: '⬆️➡️⬇️⬅️?', next: '⬆️', hint: 'What comes next?' },
      ];
      const selected = patterns[Math.floor(Math.random() * patterns.length)];
      captchaData = {
        type: 'pattern',
        challenge: selected.pattern,
        answer: selected.next,
        jobId: `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        hint: `${selected.hint} (Practice Mode)`,
        isReal: false,
        apiStatus: apiError || 'No jobs available from 2Captcha'
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        captcha: captchaData,
        session: {
          id: session.id,
          captchasCompleted: session.captchas_completed,
          tokensEarned: session.tokens_earned
        },
        debug: {
          apiKeyConfigured: !!TWOCAPTCHA_API_KEY,
          apiError: apiError,
          message: 'No real jobs available from 2Captcha API. Using practice mode.'
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
