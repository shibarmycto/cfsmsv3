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

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    const logs: any[] = [];

    for (const recipient of recipients) {
      try {
        // Build Twilio API request
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', recipient);
        formData.append('From', twilioPhoneNumber);
        formData.append('Body', message);

        console.log(`Sending SMS to ${recipient} via Twilio`);
        
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const responseData = await response.json();
        
        console.log(`Twilio response for ${recipient}:`, JSON.stringify(responseData));

        const status = response.ok && responseData.sid ? 'sent' : 'failed';
        
        if (status === 'sent') {
          sentCount++;
        }

        // Log the SMS
        logs.push({
          user_id: user.id,
          sender_id: senderId || twilioPhoneNumber,
          recipient,
          message,
          destination,
          status,
          api_response: responseData,
          credits_used: status === 'sent' ? 1 : 0,
        });
      } catch (err) {
        console.error(`Failed to send to ${recipient}:`, err);
        logs.push({
          user_id: user.id,
          sender_id: senderId || twilioPhoneNumber,
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
