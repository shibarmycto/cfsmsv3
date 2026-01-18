import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  recipients: string[];
  message: string;
  senderId: string;
  destination: 'uk' | 'usa';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
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

    const { recipients, message, senderId, destination }: SendSmsRequest = await req.json();

    if (!recipients || !message || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile and check credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_credits')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.sms_credits < recipients.length) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API credentials
    const apiUsername = Deno.env.get('EASYSENDSMS_USERNAME');
    const apiPassword = Deno.env.get('EASYSENDSMS_PASSWORD');

    if (!apiUsername || !apiPassword) {
      console.error('SMS API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    const logs: any[] = [];

    for (const recipient of recipients) {
      try {
        // Build API URL
        const params = new URLSearchParams({
          username: apiUsername,
          password: apiPassword,
          to: recipient,
          from: senderId || 'CFSMS',
          text: message,
          type: 'text',
        });

        const apiUrl = `https://api.easysendsms.app/bulksms?${params.toString()}`;
        
        console.log(`Sending SMS to ${recipient}`);
        
        const response = await fetch(apiUrl);
        const responseText = await response.text();
        
        console.log(`SMS API Response for ${recipient}: ${responseText}`);

        const status = response.ok && !responseText.toLowerCase().includes('error') ? 'sent' : 'failed';
        
        if (status === 'sent') {
          sentCount++;
        }

        // Log the SMS
        logs.push({
          user_id: user.id,
          sender_id: senderId || 'CFSMS',
          recipient,
          message,
          destination,
          status,
          api_response: { response: responseText },
          credits_used: status === 'sent' ? 1 : 0,
        });
      } catch (err) {
        console.error(`Failed to send to ${recipient}:`, err);
        logs.push({
          user_id: user.id,
          sender_id: senderId || 'CFSMS',
          recipient,
          message,
          destination,
          status: 'failed',
          api_response: { error: String(err) },
          credits_used: 0,
        });
      }
    }

    // Insert SMS logs
    if (logs.length > 0) {
      await supabase.from('sms_logs').insert(logs);
    }

    // Deduct credits for sent messages
    if (sentCount > 0) {
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits - sentCount })
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        failed: recipients.length - sentCount,
        total: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send SMS error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
