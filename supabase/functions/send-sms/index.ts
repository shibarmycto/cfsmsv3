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

// Send SMS via GatewayAPI (supports custom alphanumeric sender IDs)
async function sendViaGatewayAPI(
  recipients: string[],
  message: string,
  senderId: string
): Promise<{ success: boolean; data: any; sentCount: number }> {
  const apiToken = Deno.env.get('GATEWAYAPI_TOKEN');
  
  if (!apiToken) {
    console.log('GatewayAPI not configured');
    return { success: false, data: { error: 'GatewayAPI not configured' }, sentCount: 0 };
  }

  console.log(`Attempting GatewayAPI for ${recipients.length} recipients with sender ID: ${senderId}`);

  try {
    // GatewayAPI uses Basic auth with the token
    const authHeader = 'Basic ' + btoa(apiToken + ':');
    
    const response = await fetch('https://gatewayapi.com/rest/mtsms', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        message: message,
        recipients: recipients.map(r => ({ msisdn: r.replace('+', '') })),
      }),
    });

    const responseData = await response.json();
    console.log('GatewayAPI response:', JSON.stringify(responseData));

    if (response.ok) {
      return { 
        success: true, 
        data: { ...responseData, provider: 'gatewayapi' }, 
        sentCount: recipients.length 
      };
    }

    // Check for insufficient credits or other errors
    if (responseData.code === 'INSUFFICIENT_CREDIT' || response.status === 402) {
      console.log('GatewayAPI insufficient credits, will fallback to TextBee');
      return { success: false, data: { ...responseData, provider: 'gatewayapi', reason: 'insufficient_credits' }, sentCount: 0 };
    }

    return { success: false, data: { ...responseData, provider: 'gatewayapi' }, sentCount: 0 };
  } catch (error) {
    console.error('GatewayAPI error:', error);
    return { success: false, data: { error: String(error), provider: 'gatewayapi' }, sentCount: 0 };
  }
}

// Send SMS via TextBee (default route, no custom sender ID support)
async function sendViaTextBee(
  recipients: string[],
  message: string,
  senderId: string
): Promise<{ success: boolean; data: any; sentCount: number }> {
  const apiKey = Deno.env.get('TEXTBEE_API_KEY');
  const deviceId = Deno.env.get('TEXTBEE_DEVICE_ID');

  if (!apiKey || !deviceId) {
    console.error('TextBee not configured');
    return { success: false, data: { error: 'TextBee not configured' }, sentCount: 0 };
  }

  // Prefix message with sender ID so recipients see the brand (only if set)
  const prefixedMessage = senderId ? `${senderId}: ${message}` : message;

  console.log(`Sending SMS via TextBee for ${recipients.length} recipients (sender ID prefix: ${senderId})`);

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
        message: prefixedMessage,
      }),
    });

    const responseData = await response.json();
    console.log('TextBee response:', JSON.stringify(responseData));

    return {
      success: response.ok,
      data: { ...responseData, provider: 'textbee' },
      sentCount: response.ok ? recipients.length : 0,
    };
  } catch (error) {
    console.error('TextBee API error:', error);
    return { success: false, data: { error: String(error), provider: 'textbee' }, sentCount: 0 };
  }
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

    // Use approved sender ID from profile, or fallback to requested (no default)
    const senderId = profile.default_sender_id || requestedSenderId || '';
    
    // Validate sender ID (alphanumeric, 1-11 chars) - empty string if invalid or not set
    const validSenderId = senderId && /^[a-zA-Z0-9]{1,11}$/.test(senderId) ? senderId : '';
    
    // Determine if user has an approved custom sender ID
    const hasApprovedSenderId = !!profile.default_sender_id && /^[a-zA-Z0-9]{1,11}$/.test(profile.default_sender_id);

    let result: { success: boolean; data: any; sentCount: number };
    let usedProvider = 'textbee';

    // If user has approved custom sender ID, try GatewayAPI first (supports alphanumeric sender IDs)
    if (hasApprovedSenderId) {
      console.log(`User has approved sender ID: ${validSenderId}, trying GatewayAPI first`);
      result = await sendViaGatewayAPI(recipients, message, validSenderId);
      
      if (result.success) {
        usedProvider = 'gatewayapi';
      } else {
        // Fallback to TextBee if GatewayAPI fails (e.g., insufficient credits)
        console.log('GatewayAPI failed, falling back to TextBee');
        result = await sendViaTextBee(recipients, message, validSenderId);
        usedProvider = 'textbee';
      }
    } else {
      // No custom sender ID, use TextBee directly
      console.log('No custom sender ID, using TextBee');
      result = await sendViaTextBee(recipients, message, validSenderId);
    }

    // Log the SMS for each recipient
    const logs = recipients.map((recipient) => ({
      user_id: user.id,
      sender_id: validSenderId,
      recipient,
      message,
      destination,
      status: result.success ? 'sent' : 'failed',
      api_response: result.data,
      credits_used: result.success ? 1 : 0,
    }));

    // Insert SMS logs
    if (logs.length > 0) {
      await supabase.from('sms_logs').insert(logs);
    }

    // Deduct credits for sent messages
    if (result.sentCount > 0) {
      await supabase
        .from('profiles')
        .update({ sms_credits: profile.sms_credits - result.sentCount })
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: result.success, 
        sent: result.sentCount, 
        failed: recipients.length - result.sentCount,
        total: recipients.length,
        senderId: validSenderId,
        provider: usedProvider
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
