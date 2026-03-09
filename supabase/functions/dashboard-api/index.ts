import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify shared secret — only Alphify Companion can call this
  const secret = req.headers.get("x-dashboard-secret");
  const expectedSecret = Deno.env.get("DASHBOARD_API_SECRET");
  if (!expectedSecret || secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

    // Run all queries in parallel
    const [
      totalUsersRes,
      newTodayRes,
      newWeekRes,
      newMonthRes,
      activeTodayRes,
      groupsRes,
      examsRes,
      conversationsRes,
      revenueRes,
      kuCirculationRes,
      subscriptionBreakdownRes,
      topUniversitiesRes,
      recentPaymentsRes,
      dailyUsersRes,
      dailyExamsRes,
      dailyConversationsRes,
      activePromosRes,
    ] = await Promise.all([
      // Total users
      supabase.from("profiles").select("id", { count: "exact", head: true }),

      // New users today
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart),

      // New users this week
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),

      // New users this month
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),

      // Active users today (usage_tracking with today's date)
      supabase.from("usage_tracking").select("id", { count: "exact", head: true }).eq("date", todayStart.slice(0, 10)),

      // Total study groups
      supabase.from("study_groups").select("id", { count: "exact", head: true }),

      // Total exams
      supabase.from("exam_attempts").select("id", { count: "exact", head: true }),

      // Total conversations
      supabase.from("conversations").select("id", { count: "exact", head: true }),

      // Total revenue (sum of successful payments)
      supabase.from("payment_history").select("amount").eq("status", "success"),

      // KU in circulation
      supabase.from("ku_wallets").select("balance"),

      // Subscription plan breakdown
      supabase.from("subscriptions").select("plan, status"),

      // Top universities
      supabase.from("user_settings").select("university").not("university", "is", null),

      // Recent 10 payments
      supabase.from("payment_history").select("*").eq("status", "success").order("created_at", { ascending: false }).limit(10),

      // Daily users created (last 14 days)
      supabase.from("profiles").select("created_at").gte("created_at", fourteenDaysAgo),

      // Daily exams (last 14 days)
      supabase.from("exam_attempts").select("created_at").gte("created_at", fourteenDaysAgo),

      // Daily conversations (last 14 days)
      supabase.from("conversations").select("created_at").gte("created_at", fourteenDaysAgo),

      // Active promo codes
      supabase.from("promo_codes").select("code, influencer_name, bonus_ku, commission_rate, total_uses, total_commission_naira, is_active, expires_at, created_at").eq("is_active", true),
    ]);

    // Compute total revenue
    const totalRevenueKobo = (revenueRes.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    // Compute total KU in circulation
    const totalKu = (kuCirculationRes.data || []).reduce((sum: number, w: any) => sum + (w.balance || 0), 0);

    // Subscription breakdown
    const planBreakdown: Record<string, number> = {};
    for (const sub of subscriptionBreakdownRes.data || []) {
      const key = `${sub.plan}_${sub.status}`;
      planBreakdown[key] = (planBreakdown[key] || 0) + 1;
    }

    // Top universities
    const uniCounts: Record<string, number> = {};
    for (const s of topUniversitiesRes.data || []) {
      if (s.university) {
        uniCounts[s.university] = (uniCounts[s.university] || 0) + 1;
      }
    }
    const topUniversities = Object.entries(uniCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([university, count]) => ({ university, count }));

    // Daily activity aggregation helper
    const aggregateByDay = (rows: any[]) => {
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const day = row.created_at?.slice(0, 10);
        if (day) counts[day] = (counts[day] || 0) + 1;
      }
      return counts;
    };

    const dailyUsers = aggregateByDay(dailyUsersRes.data || []);
    const dailyExams = aggregateByDay(dailyExamsRes.data || []);
    const dailyConversations = aggregateByDay(dailyConversationsRes.data || []);

    // Build 14-day activity array
    const dailyActivity = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyActivity.push({
        date: key,
        users_created: dailyUsers[key] || 0,
        exams: dailyExams[key] || 0,
        conversations: dailyConversations[key] || 0,
      });
    }

    const result = {
      total_users: totalUsersRes.count || 0,
      active_users_today: activeTodayRes.count || 0,
      new_users_today: newTodayRes.count || 0,
      new_users_this_week: newWeekRes.count || 0,
      new_users_this_month: newMonthRes.count || 0,
      total_study_groups: groupsRes.count || 0,
      total_exams: examsRes.count || 0,
      total_conversations: conversationsRes.count || 0,
      total_revenue_kobo: totalRevenueKobo,
      total_revenue_naira: totalRevenueKobo / 100,
      total_ku_in_circulation: totalKu,
      subscription_breakdown: planBreakdown,
      top_universities: topUniversities,
      recent_payments: recentPaymentsRes.data || [],
      daily_activity: dailyActivity,
      active_promo_codes: activePromosRes.data || [],
      generated_at: now.toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
