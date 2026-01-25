import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This webhook receives incoming calls from Twilio and initiates the AI Twin conversation
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming Twilio webhook data
    const formData = await req.formData();
    const callerPhone = formData.get("From") as string;
    const calledNumber = formData.get("To") as string;
    const callSid = formData.get("CallSid") as string;

    console.log(`Incoming call from ${callerPhone} to ${calledNumber}, CallSid: ${callSid}`);

    // Find the AI Twin that has this forwarding number configured
    const { data: twin, error: twinError } = await adminClient
      .from('ai_twins')
      .select('*')
      .eq('forwarding_number', calledNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (twinError || !twin) {
      console.error("No active AI Twin found for number:", calledNumber);
      // Return TwiML that says the service is unavailable
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, this AI companion service is not available at the moment. Please try again later.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Check if user has enough wallet balance (1 token per minute minimum)
    const { data: wallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', twin.user_id)
      .maybeSingle();

    if (!wallet || wallet.balance < twin.cost_per_minute) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, the owner of this AI companion doesn't have enough credits. Please ask them to top up.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Create a call record
    const { data: callRecord, error: callError } = await adminClient
      .from('ai_twin_calls')
      .insert({
        twin_id: twin.id,
        user_id: twin.user_id,
        caller_phone: callerPhone,
        call_sid: callSid,
        call_status: 'in_progress',
      })
      .select()
      .single();

    if (callError) {
      console.error("Error creating call record:", callError);
    }

    // Retrieve any memories about this caller
    const { data: memories } = await adminClient
      .from('ai_twin_memories')
      .select('*')
      .eq('twin_id', twin.id)
      .eq('caller_phone', callerPhone)
      .order('importance', { ascending: false })
      .limit(10);

    // Build context from memories
    let memoryContext = "";
    let callerName = "";
    if (memories && memories.length > 0) {
      callerName = memories.find(m => m.caller_name)?.caller_name || "";
      memoryContext = memories.map(m => `- ${m.memory_content}`).join("\n");
    }

    // Build the system prompt
    const personalityTraits = twin.personality_traits?.join(", ") || "warm, friendly, supportive";
    const systemPrompt = buildSystemPrompt(twin, callerName, memoryContext);

    // Generate greeting based on whether we know the caller
    const greeting = callerName 
      ? `${twin.greeting_message} It's good to hear from you again, ${callerName}.`
      : twin.greeting_message;

    // Store context for the conversation handler
    const conversationContext = {
      callId: callRecord?.id,
      twinId: twin.id,
      userId: twin.user_id,
      callerPhone,
      systemPrompt,
      greeting,
      voice: twin.voice_id || 'alice',
      language: twin.language || 'en-US',
    };

    // Encode context to pass to gather webhook
    const contextEncoded = btoa(JSON.stringify(conversationContext));

    // Return TwiML to greet and start conversation
    const gatherUrl = `${supabaseUrl}/functions/v1/ai-twin-conversation?context=${encodeURIComponent(contextEncoded)}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${twin.voice_id || 'alice'}" language="${twin.language || 'en-US'}">${escapeXml(greeting)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${gatherUrl}" method="POST">
    <Say voice="${twin.voice_id || 'alice'}">I'm listening.</Say>
  </Gather>
  <Say voice="${twin.voice_id || 'alice'}">I didn't catch that. Goodbye for now.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error("AI Twin Webhook error:", error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});

function buildSystemPrompt(twin: any, callerName: string, memoryContext: string): string {
  const personalityTraits = twin.personality_traits?.join(", ") || "warm, friendly, supportive";
  
  return `You are an AI Virtual Twin Companion named "${twin.name}".

PERSONALITY & TONE:
You are: ${personalityTraits}
Speaking style: ${twin.speaking_style || 'conversational'}
Tone balance: Calm (${(twin.tone_calm * 100).toFixed(0)}%), Playful (${(twin.tone_playful * 100).toFixed(0)}%), Intuitive (${(twin.tone_intuitive * 100).toFixed(0)}%)

${twin.custom_instructions ? `CUSTOM INSTRUCTIONS:\n${twin.custom_instructions}\n` : ''}

${callerName ? `CALLER INFO:\nYou're speaking with ${callerName}.` : 'This appears to be a new caller.'}

${memoryContext ? `MEMORIES ABOUT THIS CALLER:\n${memoryContext}\n` : ''}

CONVERSATION RULES:
- Speak naturally like a warm friend, not a robot
- Use short, conversational responses (2-3 sentences max for phone)
- Ask gentle follow-up questions
- Never claim to predict the future with certainty
- Never give medical or legal advice
- If caller seems distressed, encourage them to seek real human support
- Remember details they share for future conversations

RESPONSE FORMAT:
Keep responses brief and natural for phone conversation. No markdown, no lists - just speak naturally.`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
