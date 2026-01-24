import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is called by admin to start an approved campaign
// or can be scheduled to run campaigns

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaign ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
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

    // Allow both 'approved' and 'scheduled' statuses
    if (!['approved', 'scheduled'].includes(campaign.status)) {
      return new Response(
        JSON.stringify({ error: "Campaign is not approved or scheduled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status to running
    await supabaseAdmin
      .from('ai_campaigns')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    await supabaseAdmin.from('ai_campaign_logs').insert({
      campaign_id: campaignId,
      log_type: 'info',
      message: 'Campaign started by AI Agent',
    });

    // Get user's profile to check sender ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', campaign.user_id)
      .single();

    // Check for approved sender IDs
    const { data: approvedSenders } = await supabaseAdmin
      .from('sender_id_requests')
      .select('sender_id')
      .eq('user_id', campaign.user_id)
      .eq('status', 'approved')
      .neq('sender_id', 'CFSMS');

    const hasCustomSender = approvedSenders && approvedSenders.length > 0;
    const senderId = hasCustomSender ? approvedSenders[0].sender_id : '';

    // Process recipients in batches
    const recipients = campaign.recipients as string[];
    const batchSize = 10;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        // Call send-sms function
        const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            recipients: batch,
            message: campaign.message_template,
            senderId,
            destination: campaign.destination,
            useCustomSender: hasCustomSender,
          }),
        });

        const smsResult = await smsResponse.json();
        
        if (smsResult.sent) {
          sentCount += smsResult.sent;
        }
        if (smsResult.failed) {
          failedCount += smsResult.failed;
        }

        // Log progress
        await supabaseAdmin.from('ai_campaign_logs').insert({
          campaign_id: campaignId,
          log_type: 'progress',
          message: `Batch ${Math.floor(i / batchSize) + 1}: Sent ${smsResult.sent || 0}, Failed ${smsResult.failed || 0}`,
          metadata: { batch: Math.floor(i / batchSize) + 1, sent: smsResult.sent, failed: smsResult.failed },
        });

        // Update campaign progress
        await supabaseAdmin
          .from('ai_campaigns')
          .update({ 
            sent_count: sentCount,
            failed_count: failedCount,
          })
          .eq('id', campaignId);

        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (batchError) {
        console.error(`Batch error:`, batchError);
        failedCount += batch.length;
        
        await supabaseAdmin.from('ai_campaign_logs').insert({
          campaign_id: campaignId,
          log_type: 'error',
          message: `Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`,
        });
      }
    }

    // Mark campaign as completed
    await supabaseAdmin
      .from('ai_campaigns')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq('id', campaignId);

    await supabaseAdmin.from('ai_campaign_logs').insert({
      campaign_id: campaignId,
      log_type: 'success',
      message: `Campaign completed. Sent: ${sentCount}, Failed: ${failedCount}`,
    });

    // Send WhatsApp notification to user
    const whatsappMessage = `🎉 Your CFSMS AI campaign "${campaign.name}" has completed!\n\n📊 Results:\n✅ Sent: ${sentCount}\n❌ Failed: ${failedCount}\n📞 Total Recipients: ${recipients.length}\n\nThank you for using CFSMS!`;
    
    try {
      const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          to: campaign.whatsapp_number,
          message: whatsappMessage,
        }),
      });

      const whatsappResult = await whatsappResponse.json();

      if (whatsappResult.success) {
        await supabaseAdmin.from('ai_campaign_logs').insert({
          campaign_id: campaignId,
          log_type: 'success',
          message: `WhatsApp notification sent to ${campaign.whatsapp_number}`,
          metadata: { messageSid: whatsappResult.messageSid },
        });
      } else {
        throw new Error(whatsappResult.error || 'WhatsApp send failed');
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
      await supabaseAdmin.from('ai_campaign_logs').insert({
        campaign_id: campaignId,
        log_type: 'warning',
        message: `WhatsApp notification failed: ${whatsappError instanceof Error ? whatsappError.message : 'Unknown error'}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign completed",
        sentCount,
        failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Run AI campaign error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
