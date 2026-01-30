import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    if (!TELNYX_API_KEY) {
      throw new Error("TELNYX_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...params } = await req.json();

    const telnyxHeaders = {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "search_numbers": {
        // Search for available UK phone numbers
        const { country_code = "GB", locality, limit = 10 } = params;
        
        let url = `${TELNYX_API_BASE}/available_phone_numbers?filter[country_code]=${country_code}&filter[limit]=${limit}`;
        if (locality) {
          url += `&filter[locality]=${encodeURIComponent(locality)}`;
        }
        
        const response = await fetch(url, { headers: telnyxHeaders });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to search numbers");
        }
        
        return new Response(
          JSON.stringify({ numbers: data.data || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "purchase_number": {
        // Purchase a specific phone number
        const { phone_number, connection_id } = params;
        
        if (!phone_number) {
          throw new Error("phone_number is required");
        }

        const orderPayload: any = {
          phone_numbers: [{ phone_number }],
        };

        // If a connection_id is provided, assign the number to it
        if (connection_id) {
          orderPayload.connection_id = connection_id;
        }

        const response = await fetch(`${TELNYX_API_BASE}/number_orders`, {
          method: "POST",
          headers: telnyxHeaders,
          body: JSON.stringify(orderPayload),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to purchase number");
        }

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_owned_numbers": {
        // List user's owned phone numbers
        const response = await fetch(`${TELNYX_API_BASE}/phone_numbers?page[size]=50`, {
          headers: telnyxHeaders,
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to list numbers");
        }

        return new Response(
          JSON.stringify({ numbers: data.data || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_connections": {
        // List SIP connections (needed to route to ElevenLabs)
        const response = await fetch(`${TELNYX_API_BASE}/credential_connections`, {
          headers: telnyxHeaders,
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to get connections");
        }

        return new Response(
          JSON.stringify({ connections: data.data || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_sip_connection": {
        // Create a SIP connection for ElevenLabs
        const { connection_name, sip_username, sip_password } = params;
        
        if (!connection_name || !sip_username || !sip_password) {
          throw new Error("connection_name, sip_username, and sip_password are required");
        }

        // Create a credential connection pointing to ElevenLabs SIP
        const payload = {
          connection_name,
          outbound: {
            outbound_voice_profile_id: null,
            sip_region: "europe",
            transport_protocol: "UDP",
          },
          inbound: {
            sip_uri_calling_preference: "from_display_name",
          },
          // For ElevenLabs integration, the origination URI should be set
          webhook_event_url: null,
          default_on_hold_comfort_noise_enabled: false,
          dtmf_type: "RFC 2833",
          encode_contact_header_enabled: false,
          record_type: "credential_connection",
        };

        const response = await fetch(`${TELNYX_API_BASE}/credential_connections`, {
          method: "POST",
          headers: telnyxHeaders,
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to create SIP connection");
        }

        return new Response(
          JSON.stringify({ connection: data.data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_number_connection": {
        // Update a phone number to use a specific connection
        const { number_id, connection_id } = params;
        
        if (!number_id || !connection_id) {
          throw new Error("number_id and connection_id are required");
        }

        const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${number_id}`, {
          method: "PATCH",
          headers: telnyxHeaders,
          body: JSON.stringify({
            connection_id,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.errors?.[0]?.detail || "Failed to update number");
        }

        return new Response(
          JSON.stringify({ number: data.data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "release_number": {
        // Release/delete a phone number
        const { number_id } = params;
        
        if (!number_id) {
          throw new Error("number_id is required");
        }

        const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${number_id}`, {
          method: "DELETE",
          headers: telnyxHeaders,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.errors?.[0]?.detail || "Failed to release number");
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error("Telnyx phone numbers error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
