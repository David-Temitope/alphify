import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseUser.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    const userId = authData.user.id;

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'schedule') {
      // Schedule deletion for 7 days from now
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 7);

      const { error } = await supabaseUser
        .from('profiles')
        .update({ scheduled_deletion_at: deletionDate.toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account scheduled for deletion',
        deletion_date: deletionDate.toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'cancel') {
      const { error } = await supabaseUser
        .from('profiles')
        .update({ scheduled_deletion_at: null })
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account deletion cancelled'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'execute') {
      // Check if deletion was scheduled and grace period passed
      const { data: profile } = await supabaseUser
        .from('profiles')
        .select('scheduled_deletion_at')
        .eq('user_id', userId)
        .single();

      if (!profile?.scheduled_deletion_at) {
        return new Response(JSON.stringify({ error: 'No deletion scheduled' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const scheduledDate = new Date(profile.scheduled_deletion_at);
      if (scheduledDate > new Date()) {
        return new Response(JSON.stringify({ 
          error: 'Grace period not yet expired',
          deletion_date: profile.scheduled_deletion_at
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete user data
      // 1. Delete storage files
      const { data: files } = await supabaseUser
        .from('uploaded_files')
        .select('file_path')
        .eq('user_id', userId);

      if (files && files.length > 0) {
        const paths = files.map(f => f.file_path);
        await supabaseAdmin.storage.from('user-files').remove(paths);
      }

      // 2. Delete database records (cascade will handle most)
      // These are in dependency order
      await supabaseAdmin.from('session_quiz_responses').delete().eq('user_id', userId);
      await supabaseAdmin.from('session_messages').delete().eq('user_id', userId);
      await supabaseAdmin.from('session_participants').delete().eq('user_id', userId);
      await supabaseAdmin.from('messages').delete().eq('user_id', userId);
      await supabaseAdmin.from('conversations').delete().eq('user_id', userId);
      await supabaseAdmin.from('uploaded_files').delete().eq('user_id', userId);
      await supabaseAdmin.from('exam_samples').delete().eq('user_id', userId);
      await supabaseAdmin.from('exam_attempts').delete().eq('user_id', userId);
      await supabaseAdmin.from('study_mates').delete().or(`user_id.eq.${userId},mate_id.eq.${userId}`);
      await supabaseAdmin.from('study_requests').delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
      await supabaseAdmin.from('study_group_members').delete().eq('user_id', userId);
      // Delete groups where user is admin
      await supabaseAdmin.from('study_groups').delete().eq('admin_id', userId);
      await supabaseAdmin.from('usage_tracking').delete().eq('user_id', userId);
      await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
      await supabaseAdmin.from('payment_history').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_settings').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

      // 3. Delete auth user
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error("Failed to delete auth user:", deleteUserError);
        throw deleteUserError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account permanently deleted'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
