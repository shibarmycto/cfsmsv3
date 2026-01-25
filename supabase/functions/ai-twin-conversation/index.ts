import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This handles the ongoing conversation with speech recognition and AI responses
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const contextEncoded = url.searchParams.get("context");
    
    if (!contextEncoded) {
      throw new Error("Missing conversation context");
    }

    const context = JSON.parse(atob(contextEncoded));
    const { callId, twinId, userId, callerPhone, systemPrompt, voice, language } = context;

    // Parse the speech result from Twilio
    const formData = await req.formData();
    const speechResult = formData.get("SpeechResult") as string;
    const callSid = formData.get("CallSid") as string;

    console.log(`Speech received: "${speechResult}"`);

    if (!speechResult || speechResult.trim() === "") {
      // No speech detected, prompt again
      const twiml = buildGatherTwiml(
        "I'm still here. What would you like to talk about?",
        voice,
        language,
        supabaseUrl,
        contextEncoded
      );
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Get conversation history from the call record
    const { data: callRecord } = await adminClient
      .from('ai_twin_calls')
      .select('transcript')
      .eq('id', callId)
      .maybeSingle();

    const conversationHistory = callRecord?.transcript || [];
    
    // Add user message to history
    conversationHistory.push({ role: 'user', content: speechResult });

    // Generate AI response using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-10), // Keep last 10 messages for context
        ],
        max_tokens: 150, // Keep responses short for phone
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      throw new Error("AI response failed");
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "I'm sorry, I didn't quite catch that. Could you repeat?";

    // Add assistant message to history
    conversationHistory.push({ role: 'assistant', content: assistantMessage });

    // Update call record with transcript
    await adminClient
      .from('ai_twin_calls')
      .update({ 
        transcript: conversationHistory,
        call_status: 'in_progress'
      })
      .eq('id', callId);

    // Extract and store memories from the conversation
    await extractAndStoreMemories(adminClient, twinId, callerPhone, speechResult);

    // Check if the call should end (user says goodbye)
    const goodbyePhrases = ['goodbye', 'bye', 'talk later', 'hang up', 'end call', 'gotta go'];
    const shouldEnd = goodbyePhrases.some(phrase => 
      speechResult.toLowerCase().includes(phrase)
    );

    if (shouldEnd) {
      // End the call gracefully
      const { data: twin } = await adminClient
        .from('ai_twins')
        .select('cost_per_minute, total_minutes_used, total_calls')
        .eq('id', twinId)
        .single();

      // Calculate duration and charge tokens
      const { data: call } = await adminClient
        .from('ai_twin_calls')
        .select('started_at')
        .eq('id', callId)
        .single();

      const durationSeconds = call ? Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000) : 60;
      const durationMinutes = Math.ceil(durationSeconds / 60);
      const tokensToCharge = durationMinutes * (twin?.cost_per_minute || 1);

      // Deduct tokens from wallet
      await adminClient.rpc('', {}).then(() => {});
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        await adminClient
          .from('wallets')
          .update({ balance: wallet.balance - tokensToCharge })
          .eq('user_id', userId);

        // Log the transaction
        const { data: userWallet } = await adminClient
          .from('wallets')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (userWallet) {
          await adminClient
            .from('wallet_transactions')
            .insert({
              from_wallet_id: userWallet.id,
              amount: tokensToCharge,
              transaction_type: 'ai_twin_call',
              description: `AI Twin call - ${durationMinutes} minute(s)`,
              status: 'completed'
            });
        }
      }

      // Update call record as completed
      await adminClient
        .from('ai_twin_calls')
        .update({
          call_status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          tokens_charged: tokensToCharge,
        })
        .eq('id', callId);

      // Update twin stats
      await adminClient
        .from('ai_twins')
        .update({
          total_minutes_used: (twin?.total_minutes_used || 0) + durationMinutes,
          total_calls: (twin?.total_calls || 0) + 1,
        })
        .eq('id', twinId);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(assistantMessage)} Take care!</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Continue the conversation
    const twiml = buildGatherTwiml(assistantMessage, voice, language, supabaseUrl, contextEncoded);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (error) {
    console.error("AI Twin Conversation error:", error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I'm having trouble right now. Let's talk again soon.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }
});

function buildGatherTwiml(message: string, voice: string, language: string, supabaseUrl: string, context: string): string {
  const gatherUrl = `${supabaseUrl}/functions/v1/ai-twin-conversation?context=${encodeURIComponent(context)}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(message)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${gatherUrl}" method="POST">
  </Gather>
  <Say voice="${voice}">Are you still there?</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${gatherUrl}" method="POST">
  </Gather>
  <Say voice="${voice}">It seems like you've gone quiet. Feel free to call back anytime. Goodbye!</Say>
  <Hangup/>
</Response>`;
}

async function extractAndStoreMemories(
  adminClient: any, 
  twinId: string, 
  callerPhone: string, 
  userMessage: string
) {
  try {
    // Simple keyword-based memory extraction
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for name mentions
    const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+(\w+)/i);
    if (nameMatch) {
      await adminClient
        .from('ai_twin_memories')
        .upsert({
          twin_id: twinId,
          caller_phone: callerPhone,
          caller_name: nameMatch[1],
          memory_type: 'identity',
          memory_content: `Caller's name is ${nameMatch[1]}`,
          importance: 1.0,
        }, {
          onConflict: 'twin_id,caller_phone',
          ignoreDuplicates: false,
        });
    }

    // Store emotional patterns
    const emotionalKeywords = {
      happy: ['happy', 'excited', 'great', 'wonderful', 'amazing'],
      sad: ['sad', 'down', 'depressed', 'unhappy', 'lonely'],
      anxious: ['anxious', 'worried', 'stressed', 'nervous', 'overwhelmed'],
      angry: ['angry', 'frustrated', 'annoyed', 'upset', 'mad'],
    };

    for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        await adminClient
          .from('ai_twin_memories')
          .insert({
            twin_id: twinId,
            caller_phone: callerPhone,
            memory_type: 'emotional',
            memory_content: `Caller expressed feeling ${emotion}`,
            importance: 0.7,
          });
        break;
      }
    }

    // Store topics of interest
    const topics = {
      work: ['work', 'job', 'boss', 'office', 'career', 'business'],
      love: ['relationship', 'partner', 'dating', 'love', 'marriage', 'girlfriend', 'boyfriend'],
      family: ['family', 'kids', 'children', 'parents', 'mom', 'dad', 'brother', 'sister'],
      money: ['money', 'finances', 'bills', 'debt', 'savings', 'investment'],
      health: ['health', 'doctor', 'sick', 'tired', 'exercise', 'sleep'],
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        await adminClient
          .from('ai_twin_memories')
          .insert({
            twin_id: twinId,
            caller_phone: callerPhone,
            memory_type: 'topic',
            memory_content: `Caller talked about ${topic}: "${userMessage.substring(0, 100)}..."`,
            importance: 0.5,
          });
        break;
      }
    }

  } catch (error) {
    console.error("Error storing memories:", error);
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
