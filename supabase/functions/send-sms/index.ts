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

    // Get TextBee credentials
    const apiKey = Deno.env.get('TEXTBEE_API_KEY');
    const deviceId = Deno.env.get('TEXTBEE_DEVICE_ID');

    if (!apiKey || !deviceId) {
      console.error('TextBee credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TextBee API endpoint
    const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

    console.log(`Sending SMS to ${recipients.length} recipients via TextBee`);
    
    // TextBee supports bulk sending - send all recipients at once
    const response = await fetch(textbeeUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: recipients,
        message: message,
      }),
    });

    const responseData = await response.json();
    
    console.log(`TextBee response:`, JSON.stringify(responseData));

    const success = response.ok;
    const sentCount = success ? recipients.length : 0;

    // Log the SMS for each recipient
    const logs = recipients.map((recipient) => ({
      user_id: user.id,
      sender_id: senderId || 'TextBee',
      recipient,
      message,
      destination,
      status: success ? 'sent' : 'failed',
      api_response: responseData,
      credits_used: success ? 1 : 0,
    }));

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
