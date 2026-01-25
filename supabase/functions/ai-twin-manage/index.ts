import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user auth
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

    const { action, ...data } = await req.json();

    switch (action) {
      case 'get_twin': {
        const { data: twin, error } = await supabaseClient
          .from('ai_twins')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        return new Response(
          JSON.stringify({ success: true, twin }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'create_twin': {
        // Check if user already has a twin
        const { data: existingTwin } = await supabaseClient
          .from('ai_twins')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingTwin) {
          return new Response(
            JSON.stringify({ error: "You already have an AI Twin. Update it instead." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: twin, error } = await adminClient
          .from('ai_twins')
          .insert({
            user_id: user.id,
            ...data.config,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, twin }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update_twin': {
        const { error } = await supabaseClient
          .from('ai_twins')
          .update(data.config)
          .eq('user_id', user.id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_calls': {
        const { data: twin } = await supabaseClient
          .from('ai_twins')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!twin) {
          return new Response(
            JSON.stringify({ success: true, calls: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: calls } = await supabaseClient
          .from('ai_twin_calls')
          .select('*')
          .eq('twin_id', twin.id)
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(
          JSON.stringify({ success: true, calls: calls || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_memories': {
        const { data: twin } = await supabaseClient
          .from('ai_twins')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!twin) {
          return new Response(
            JSON.stringify({ success: true, memories: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: memories } = await supabaseClient
          .from('ai_twin_memories')
          .select('*')
          .eq('twin_id', twin.id)
          .order('created_at', { ascending: false })
          .limit(100);

        return new Response(
          JSON.stringify({ success: true, memories: memories || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete_memory': {
        const { memoryId } = data;
        
        const { error } = await supabaseClient
          .from('ai_twin_memories')
          .delete()
          .eq('id', memoryId);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_stats': {
        const { data: twin } = await supabaseClient
          .from('ai_twins')
          .select('total_minutes_used, total_calls, cost_per_minute')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: wallet } = await supabaseClient
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();

        return new Response(
          JSON.stringify({ 
            success: true, 
            stats: {
              totalMinutes: twin?.total_minutes_used || 0,
              totalCalls: twin?.total_calls || 0,
              costPerMinute: twin?.cost_per_minute || 1,
              walletBalance: wallet?.balance || 0,
            }
          }),
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
    console.error("AI Twin Manage error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
