import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignRequest {
  action: 'create' | 'optimize' | 'start' | 'status' | 'cancel';
  campaignId?: string;
  campaignData?: {
    name: string;
    description?: string;
    targetAudience: string;
    messageTemplate: string;
    recipients: string[];
    whatsappNumber: string;
    daysRequested: number;
    destination: string;
    isScheduled?: boolean;
    scheduledAt?: string;
  };
}

async function logCampaign(
  supabaseAdmin: any,
  campaignId: string,
  logType: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  await supabaseAdmin.from('ai_campaign_logs').insert({
    campaign_id: campaignId,
    log_type: logType,
    message,
    metadata: metadata || null,
  });
}

async function optimizeMessage(message: string, targetAudience: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.log("No OpenRouter API key, returning original message");
    return message;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cfsmsv3.lovable.app",
        "X-Title": "CFSMS AI Agent",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: `You are an SMS marketing expert. Optimize the following message for maximum engagement while keeping it under 160 characters. Target audience: ${targetAudience}. Keep the core message intact but make it more compelling. Return ONLY the optimized message text, nothing else.`
          },
          {
            role: "user",
            content: message
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI optimization failed:", await response.text());
      return message;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || message;
  } catch (error) {
    console.error("Error optimizing message:", error);
    return message;
  }
}

async function sendWhatsAppNotification(phoneNumber: string, message: string) {
  // WhatsApp Business API integration would go here
  // For now, we'll log this - in production you'd integrate with WhatsApp Business API
  console.log(`WhatsApp notification to ${phoneNumber}: ${message}`);
  
  // You could also use services like Twilio WhatsApp API, Meta Business API, etc.
  // Since WhatsApp is "free" for the user, the business would absorb the cost
  return { success: true, message: "WhatsApp notification queued" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, campaignId, campaignData }: CampaignRequest = await req.json();

    switch (action) {
      case 'create': {
        if (!campaignData) {
          return new Response(
            JSON.stringify({ error: "Missing campaign data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const dailyCost = 25.00;
        const totalCost = dailyCost * (campaignData.daysRequested || 1);

        // Optimize message using AI
        const optimizedMessage = await optimizeMessage(
          campaignData.messageTemplate,
          campaignData.targetAudience
        );

        // Create the campaign
        const { data: campaign, error: createError } = await supabaseAdmin
          .from('ai_campaigns')
          .insert({
            user_id: user.id,
            name: campaignData.name,
            description: campaignData.description,
            target_audience: campaignData.targetAudience,
            message_template: optimizedMessage,
            recipients: campaignData.recipients,
            total_recipients: campaignData.recipients.length,
            whatsapp_number: campaignData.whatsappNumber,
            days_requested: campaignData.daysRequested,
            daily_cost: dailyCost,
            total_cost: totalCost,
            destination: campaignData.destination,
            status: 'pending_payment',
            is_scheduled: campaignData.isScheduled || false,
            scheduled_at: campaignData.scheduledAt || null,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating campaign:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create campaign" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log campaign creation
        const scheduleInfo = campaignData.isScheduled && campaignData.scheduledAt 
          ? ` Scheduled for ${new Date(campaignData.scheduledAt).toISOString()}`
          : '';
        await logCampaign(supabaseAdmin, campaign.id, 'info', `Campaign created and awaiting payment.${scheduleInfo}`, {
          original_message: campaignData.messageTemplate,
          optimized_message: optimizedMessage,
          is_scheduled: campaignData.isScheduled || false,
          scheduled_at: campaignData.scheduledAt || null,
        });

        return new Response(
          JSON.stringify({
            success: true,
            campaign,
            optimizedMessage,
            message: campaignData.isScheduled 
              ? "Scheduled campaign created. Please complete payment to proceed."
              : "Campaign created. Please complete payment to proceed.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'optimize': {
        if (!campaignData?.messageTemplate || !campaignData?.targetAudience) {
          return new Response(
            JSON.stringify({ error: "Missing message or target audience" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const optimizedMessage = await optimizeMessage(
          campaignData.messageTemplate,
          campaignData.targetAudience
        );

        return new Response(
          JSON.stringify({
            success: true,
            originalMessage: campaignData.messageTemplate,
            optimizedMessage,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'status': {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ error: "Missing campaign ID" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get campaign with logs
        const { data: campaign, error: fetchError } = await supabaseClient
          .from('ai_campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();

        if (fetchError || !campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: logs } = await supabaseClient
          .from('ai_campaign_logs')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(
          JSON.stringify({
            success: true,
            campaign,
            logs: logs || [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'cancel': {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ error: "Missing campaign ID" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check campaign belongs to user and can be cancelled
        const { data: campaign } = await supabaseClient
          .from('ai_campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();

        if (!campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!['pending_payment', 'pending_approval'].includes(campaign.status)) {
          return new Response(
            JSON.stringify({ error: "Campaign cannot be cancelled in current status" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from('ai_campaigns')
          .update({ status: 'cancelled' })
          .eq('id', campaignId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: "Failed to cancel campaign" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logCampaign(supabaseAdmin, campaignId, 'info', 'Campaign cancelled by user');

        return new Response(
          JSON.stringify({ success: true, message: "Campaign cancelled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("AI Campaign Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
