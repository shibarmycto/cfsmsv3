import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// This function helps configure Telnyx SIP trunk to route to ElevenLabs
// The user needs to:
// 1. Create a Telnyx SIP connection with FQDN type
// 2. Set origination URI to sip.rtc.elevenlabs.io
// 3. Configure digest authentication matching ElevenLabs agent settings
// 4. Assign phone numbers to this connection

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
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

    switch (action) {
      case "get_setup_instructions": {
        // Return setup instructions for connecting Telnyx to ElevenLabs
        const instructions = {
          title: "Telnyx + ElevenLabs Phone Setup",
          steps: [
            {
              step: 1,
              title: "Create ElevenLabs Agent",
              description: "Go to elevenlabs.io/agents and create your AI agent. Configure its voice, personality, and behavior.",
              link: "https://elevenlabs.io/agents"
            },
            {
              step: 2,
              title: "Enable Phone Integration in ElevenLabs",
              description: "In your agent settings, go to 'Phone' tab and select 'Import from Telnyx'. Note down the SIP URI: sip.rtc.elevenlabs.io",
              details: "You'll need to configure digest authentication credentials (username/password) in ElevenLabs."
            },
            {
              step: 3,
              title: "Create Telnyx SIP Connection",
              description: "In Telnyx Mission Control, go to Voice → SIP Trunking → Create new connection with FQDN type.",
              link: "https://portal.telnyx.com"
            },
            {
              step: 4,
              title: "Configure Telnyx Origination",
              description: "Set the origination URI to 'sip.rtc.elevenlabs.io' and configure digest authentication to match ElevenLabs settings.",
              details: "The username and password must match what you configured in your ElevenLabs agent phone settings."
            },
            {
              step: 5,
              title: "Purchase and Assign Phone Number",
              description: "Buy a UK phone number from Telnyx and assign it to your SIP connection.",
              note: "Use the 'Phone Numbers' tab below to search and purchase numbers."
            },
            {
              step: 6,
              title: "Test Your Setup",
              description: "Call your Telnyx phone number - it should connect to your ElevenLabs AI agent!"
            }
          ],
          important_notes: [
            "Telnyx charges ~$1/month for UK phone numbers plus per-minute call costs",
            "ElevenLabs charges separately for conversation minutes",
            "The SIP connection uses digest authentication for security",
            "Calls are routed: Caller → Telnyx → ElevenLabs AI Agent"
          ],
          elevenlabs_sip_uri: "sip.rtc.elevenlabs.io"
        };

        return new Response(
          JSON.stringify(instructions),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_fqdn_connection": {
        // Create an FQDN SIP connection for ElevenLabs routing
        const { connection_name, sip_username, sip_password, elevenlabs_agent_id } = params;
        
        if (!connection_name) {
          throw new Error("connection_name is required");
        }

        // Note: For ElevenLabs, users need to create an FQDN connection in Telnyx portal
        // pointing to sip.rtc.elevenlabs.io with matching credentials
        
        // We'll create outbound voice profile first if needed, then the connection
        const telnyxHeaders = {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        };

        // Check existing FQDN connections
        const fqdnResponse = await fetch("https://api.telnyx.com/v2/fqdn_connections", {
          headers: telnyxHeaders,
        });
        
        const fqdnData = await fqdnResponse.json();
        
        // Look for existing ElevenLabs connection
        const existingConnection = fqdnData.data?.find((c: any) => 
          c.connection_name?.includes("elevenlabs") || 
          c.connection_name?.includes("ElevenLabs")
        );

        if (existingConnection) {
          return new Response(
            JSON.stringify({ 
              connection: existingConnection,
              message: "Existing ElevenLabs connection found",
              isExisting: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create new FQDN connection for ElevenLabs
        const createPayload = {
          connection_name: connection_name || "ElevenLabs-AI-Agent",
          transport_protocol: "UDP",
          default_on_hold_comfort_noise_enabled: false,
          dtmf_type: "RFC 2833",
          encode_contact_header_enabled: false,
          encrypted_media: null,
          active: true,
        };

        const createResponse = await fetch("https://api.telnyx.com/v2/fqdn_connections", {
          method: "POST",
          headers: telnyxHeaders,
          body: JSON.stringify(createPayload),
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createData.errors?.[0]?.detail || "Failed to create FQDN connection");
        }

        // Now add the FQDN pointing to ElevenLabs
        const fqdnId = createData.data.id;
        const addFqdnPayload = {
          fqdn: "sip.rtc.elevenlabs.io",
          dns_record_type: "a",
          port: 5060,
        };

        await fetch(`https://api.telnyx.com/v2/fqdn_connections/${fqdnId}/fqdns`, {
          method: "POST", 
          headers: telnyxHeaders,
          body: JSON.stringify(addFqdnPayload),
        });

        return new Response(
          JSON.stringify({ 
            connection: createData.data,
            message: "FQDN connection created. Configure digest auth in Telnyx portal to match ElevenLabs agent settings.",
            next_steps: [
              "Go to Telnyx portal and add digest authentication",
              "Match credentials with your ElevenLabs agent phone settings",
              "Assign your phone number to this connection"
            ]
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_configuration_status": {
        // Check if Telnyx is properly configured
        const telnyxHeaders = {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        };

        // Get phone numbers
        const numbersResponse = await fetch("https://api.telnyx.com/v2/phone_numbers?page[size]=50", {
          headers: telnyxHeaders,
        });
        const numbersData = await numbersResponse.json();
        
        // Get FQDN connections
        const connectionsResponse = await fetch("https://api.telnyx.com/v2/fqdn_connections", {
          headers: telnyxHeaders,
        });
        const connectionsData = await connectionsResponse.json();

        const hasNumbers = numbersData.data?.length > 0;
        const hasElevenLabsConnection = connectionsData.data?.some((c: any) =>
          c.connection_name?.toLowerCase().includes("elevenlabs") ||
          c.active === true
        );

        return new Response(
          JSON.stringify({
            configured: hasNumbers && hasElevenLabsConnection,
            phone_numbers: numbersData.data || [],
            connections: connectionsData.data || [],
            recommendations: [
              !hasNumbers ? "Purchase a UK phone number" : null,
              !hasElevenLabsConnection ? "Create FQDN connection for ElevenLabs" : null,
            ].filter(Boolean)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error("Telnyx ElevenLabs setup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
