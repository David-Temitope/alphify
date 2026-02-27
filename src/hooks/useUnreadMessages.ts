import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export function useUnreadMessages() {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-mate-messages', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get all mate messages where I'm the receiver
      // We consider messages "unread" if they arrived after the user's last visit
      // Simple approach: count messages received in last 24h that are from mates (not from me)
      const lastChecked = localStorage.getItem(`mate-last-checked-${user.id}`);
      const since = lastChecked || new Date(Date.now() - 86400000).toISOString();

      const { count, error } = await supabase
        .from('mate_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .gt('created_at', since);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 15000, // Check every 15s
  });

  // Subscribe to realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-mate-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mate_messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const markAsRead = () => {
    if (user) {
      localStorage.setItem(`mate-last-checked-${user.id}`, new Date().toISOString());
      refetch();
    }
  };

  return { unreadCount, markAsRead };
}
