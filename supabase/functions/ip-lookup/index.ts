import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if IP is public (not private/loopback)
function isPublicIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  
  // Check if valid IPv4
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  
  // Private IP ranges
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false; // Loopback
  if (parts[0] === 169 && parts[1] === 254) return false; // Link-local
  
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ip } = await req.json();

    if (!ip) {
      return new Response(
        JSON.stringify({ error: "IP address is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if IP is public
    if (!isPublicIP(ip)) {
      return new Response(
        JSON.stringify({ 
          ip,
          isPrivate: true,
          info: "Private IP"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check cache first
    const { data: cached } = await supabase
      .from("ip_lookups")
      .select("*")
      .eq("ip_address", ip)
      .single();

    if (cached) {
      return new Response(
        JSON.stringify({
          ip,
          country: cached.country,
          city: cached.city,
          isp: cached.isp,
          org: cached.org,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch from ip-api.com (free, no key required)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,org,as`);
    const data = await response.json();

    if (data.status === "fail") {
      console.error("IP lookup failed:", data.message);
      return new Response(
        JSON.stringify({ 
          ip,
          error: data.message || "Lookup failed"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cache the result
    await supabase.from("ip_lookups").insert([{
      ip_address: ip,
      country: data.country || null,
      city: data.city || null,
      isp: data.isp || null,
      org: data.org || null,
      lookup_data: data,
    }]);

    return new Response(
      JSON.stringify({
        ip,
        country: data.country,
        city: data.city,
        isp: data.isp,
        org: data.org,
        as: data.as,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('[IP-LOOKUP]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return new Response(
      JSON.stringify({ error: 'Failed to lookup IP address. Please try again later.' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
