import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  recipients: string[];
  message: string;
  senderId?: string;
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

    const { recipients, message, senderId: requestedSenderId, destination }: SendSmsRequest = await req.json();

    if (!recipients || !message || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile with approved sender ID and check credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_credits, default_sender_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.sms_credits < recipients.length) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use approved sender ID from profile, or fallback to requested, or default
    const senderId = profile.default_sender_id || requestedSenderId || 'CFSMS';
    
    // Validate sender ID (alphanumeric, 1-11 chars)
    const validSenderId = /^[a-zA-Z0-9]{1,11}$/.test(senderId) ? senderId : 'CFSMS';

    // Get EasySendSMS credentials for alphanumeric sender ID support
    const easySendUsername = Deno.env.get('EASYSENDSMS_USERNAME');
    const easySendPassword = Deno.env.get('EASYSENDSMS_PASSWORD');

    // Fallback to TextBee if EasySendSMS not configured
    const apiKey = Deno.env.get('TEXTBEE_API_KEY');
    const deviceId = Deno.env.get('TEXTBEE_DEVICE_ID');

    let success = false;
    let responseData: any = {};
    let sentCount = 0;

    // Try EasySendSMS first (supports alphanumeric sender IDs)
    if (easySendUsername && easySendPassword) {
      console.log(`Sending SMS via EasySendSMS with sender ID: ${validSenderId}`);
      
      // EasySendSMS supports comma-separated recipients
      const recipientList = recipients.join(',');
      
      const easySendUrl = new URL('https://api.easysendsms.app/bulksms');
      easySendUrl.searchParams.set('username', easySendUsername);
      easySendUrl.searchParams.set('password', easySendPassword);
      easySendUrl.searchParams.set('from', validSenderId);
      easySendUrl.searchParams.set('to', recipientList);
      easySendUrl.searchParams.set('text', message);
      easySendUrl.searchParams.set('type', '0'); // Plain text

      try {
        const response = await fetch(easySendUrl.toString(), {
          method: 'GET',
        });

        const responseText = await response.text();
        console.log(`EasySendSMS response: ${responseText}`);
        
        responseData = { provider: 'easysendsms', response: responseText };
        
        // EasySendSMS returns "OK" or message ID on success
        if (responseText.startsWith('OK') || /^[0-9]+$/.test(responseText.trim())) {
          success = true;
          sentCount = recipients.length;
        } else {
          console.error('EasySendSMS error:', responseText);
        }
      } catch (apiError) {
        console.error('EasySendSMS API error:', apiError);
      }
    }
    
    // Fallback to TextBee if EasySendSMS failed or not configured
    if (!success && apiKey && deviceId) {
      console.log(`Falling back to TextBee for ${recipients.length} recipients`);
      
      const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
      
      try {
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

        responseData = await response.json();
        console.log(`TextBee response:`, JSON.stringify(responseData));
        
        success = response.ok;
        sentCount = success ? recipients.length : 0;
        responseData.provider = 'textbee';
      } catch (apiError) {
        console.error('TextBee API error:', apiError);
      }
    }

    if (!success && !apiKey && !easySendUsername) {
      console.error('No SMS provider configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the SMS for each recipient
    const logs = recipients.map((recipient) => ({
      user_id: user.id,
      sender_id: validSenderId,
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
        success: success, 
        sent: sentCount, 
        failed: recipients.length - sentCount,
        total: recipients.length,
        senderId: validSenderId,
        provider: responseData.provider || 'unknown'
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
