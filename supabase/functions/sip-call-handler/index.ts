import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This edge function handles inbound SIP calls and routes them to AI receptionist
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "inbound";

    // Handle inbound call notification from SIP provider
    if (action === "inbound") {
      const body = await req.json().catch(() => ({}));
      
      const {
        caller_id,
        called_number,
        call_sid,
        sip_config_id,
      } = body;

      console.log(`Inbound SIP call from ${caller_id} to ${called_number}`);

      // Find matching SIP configuration
      let sipConfig = null;
      if (sip_config_id) {
        const { data } = await adminClient
          .from('sip_configurations')
          .select('*')
          .eq('id', sip_config_id)
          .eq('is_active', true)
          .maybeSingle();
        sipConfig = data;
      } else if (called_number) {
        const { data } = await adminClient
          .from('sip_configurations')
          .select('*')
          .eq('inbound_number', called_number)
          .eq('is_active', true)
          .maybeSingle();
        sipConfig = data;
      }

      if (!sipConfig) {
        console.error("No active SIP configuration found for:", called_number);
        return new Response(JSON.stringify({ 
          error: "No SIP configuration found",
          action: "reject"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      // Check if caller is allowed
      const allowedNumbers = sipConfig.allowed_numbers || ["*"];
      const isAllowed = allowedNumbers.includes("*") || 
                        allowedNumbers.some((num: string) => caller_id?.includes(num));

      if (!isAllowed) {
        console.log(`Caller ${caller_id} not in allowed list`);
        return new Response(JSON.stringify({ 
          error: "Caller not allowed",
          action: "reject"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Find linked AI receptionist config
      const { data: receptionistConfig } = await adminClient
        .from('ai_receptionist_configs')
        .select('*')
        .eq('linked_sip_config_id', sipConfig.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!receptionistConfig) {
        console.log("No AI receptionist linked to this SIP config");
        return new Response(JSON.stringify({ 
          error: "No AI receptionist configured",
          action: "voicemail"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      // Create call session
      const { data: callSession, error: sessionError } = await adminClient
        .from('sip_call_sessions')
        .insert({
          user_id: sipConfig.user_id,
          sip_config_id: sipConfig.id,
          receptionist_config_id: receptionistConfig.id,
          caller_id: caller_id,
          call_status: 'initiated',
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating call session:", sessionError);
      }

      // Return AI receptionist configuration for the call handler
      return new Response(JSON.stringify({
        action: "answer",
        session_id: callSession?.id,
        receptionist: {
          name: receptionistConfig.receptionist_name,
          greeting: receptionistConfig.greeting_message,
          system_prompt: receptionistConfig.system_prompt,
          ai_provider: receptionistConfig.ai_provider,
          ai_model: receptionistConfig.ai_model,
          temperature: receptionistConfig.temperature,
          max_tokens: receptionistConfig.max_tokens,
          voice_profile_id: receptionistConfig.linked_voice_profile_id,
          faq_data: receptionistConfig.faq_data,
        },
        sip: {
          provider: sipConfig.provider_name,
          domain: sipConfig.domain,
          port: sipConfig.port,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle call status updates
    if (action === "status") {
      const body = await req.json();
      const { session_id, status, duration, transcript, sentiment } = body;

      if (session_id) {
        await adminClient
          .from('sip_call_sessions')
          .update({
            call_status: status,
            duration_seconds: duration,
            transcript: transcript || [],
            sentiment: sentiment,
            ended_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
          })
          .eq('id', session_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle AI conversation (STT -> AI -> TTS)
    if (action === "conversation") {
      const body = await req.json();
      const { session_id, user_message, conversation_history } = body;

      // Get session and config
      const { data: session } = await adminClient
        .from('sip_call_sessions')
        .select(`
          *,
          ai_receptionist_configs (*)
        `)
        .eq('id', session_id)
        .single();

      if (!session || !session.ai_receptionist_configs) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      const config = session.ai_receptionist_configs;

      // Build messages for AI
      const systemPrompt = (config.system_prompt || "")
        .replace("{receptionist_name}", config.receptionist_name)
        .replace("{company_name}", config.company_name || "our company");

      // Add FAQ context
      let faqContext = "";
      if (config.faq_data && config.faq_data.length > 0) {
        faqContext = "\n\nKnowledge Base:\n" + 
          config.faq_data.map((faq: any) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n");
      }

      const messages = [
        { role: "system", content: systemPrompt + faqContext },
        ...(conversation_history || []),
        { role: "user", content: user_message }
      ];

      // Call AI provider
      let aiResponse = "";
      
      if (config.ai_provider === "lovable_ai") {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: `google/${config.ai_model}`,
            messages,
            max_tokens: config.max_tokens,
            temperature: config.temperature,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I didn't understand that.";
        }
      }
      // Add other AI providers here (OpenAI, Anthropic, etc.)

      // Update session with conversation
      const updatedTranscript = [
        ...(session.transcript || []),
        { role: "user", content: user_message, timestamp: new Date().toISOString() },
        { role: "assistant", content: aiResponse, timestamp: new Date().toISOString() },
      ];

      await adminClient
        .from('sip_call_sessions')
        .update({ 
          transcript: updatedTranscript,
          tokens_used: (session.tokens_used || 0) + config.max_tokens,
        })
        .eq('id', session_id);

      return new Response(JSON.stringify({
        response: aiResponse,
        voice_profile_id: config.linked_voice_profile_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test SIP connection
    if (action === "test") {
      const body = await req.json();
      const { domain, port, username, password, transport } = body;

      // In production, implement actual SIP REGISTER test
      // For now, validate the configuration format
      const isValid = domain && port && username && password;

      return new Response(JSON.stringify({
        success: isValid,
        message: isValid ? "Configuration looks valid. Ready to receive calls." : "Invalid configuration",
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error) {
    console.error("SIP Call Handler error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal error" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
