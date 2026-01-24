import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function checks for due scheduled campaigns and triggers them
// It should be called by a cron job every minute

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find all scheduled campaigns that are due (approved and scheduled_at <= now)
    const now = new Date().toISOString();
    
    const { data: dueCampaigns, error: fetchError } = await supabaseAdmin
      .from('ai_campaigns')
      .select('*')
      .eq('is_scheduled', true)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error("Error fetching due campaigns:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaigns" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No campaigns due", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${dueCampaigns.length} campaigns due for execution`);

    const results = [];

    for (const campaign of dueCampaigns) {
      try {
        // Log that we're starting this scheduled campaign
        await supabaseAdmin.from('ai_campaign_logs').insert({
          campaign_id: campaign.id,
          log_type: 'info',
          message: 'Scheduled campaign is being triggered automatically',
        });

        // Call the run-ai-campaign function
        const runResponse = await fetch(`${supabaseUrl}/functions/v1/run-ai-campaign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        });

        const runResult = await runResponse.json();

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          success: runResult.success || false,
          error: runResult.error,
        });

      } catch (campaignError) {
        console.error(`Error running campaign ${campaign.id}:`, campaignError);
        
        // Log the error
        await supabaseAdmin.from('ai_campaign_logs').insert({
          campaign_id: campaign.id,
          log_type: 'error',
          message: `Failed to start scheduled campaign: ${campaignError instanceof Error ? campaignError.message : 'Unknown error'}`,
        });

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          success: false,
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${dueCampaigns.length} scheduled campaigns`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Check scheduled campaigns error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});