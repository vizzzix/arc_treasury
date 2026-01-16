import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret (optional security)
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also allow service_role key
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!authHeader?.includes(supabaseKey || "")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, unknown> = {};

    // 1. Delete sent_notifications older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: notifDeleted, error: e1 } = await supabase
      .from("sent_notifications")
      .delete({ count: "exact" })
      .lt("sent_at", sevenDaysAgo);

    results.sent_notifications = e1 ? { error: e1.message } : { deleted: notifDeleted };

    // 2. Delete balance_snapshots older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: snapDeleted, error: e2 } = await supabase
      .from("balance_snapshots")
      .delete({ count: "exact" })
      .lt("snapshot_time", thirtyDaysAgo);

    results.balance_snapshots = e2 ? { error: e2.message } : { deleted: snapDeleted };

    // 3. Optionally clean old bridge_transactions (90+ days)
    // Uncomment if needed:
    // const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    // const { count: bridgeDeleted, error: e3 } = await supabase
    //   .from("bridge_transactions")
    //   .delete({ count: "exact" })
    //   .lt("created_at", ninetyDaysAgo);
    // results.bridge_transactions = e3 ? { error: e3.message } : { deleted: bridgeDeleted };

    console.log("Cleanup completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
