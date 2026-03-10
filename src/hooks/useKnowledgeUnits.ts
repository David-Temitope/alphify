import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useKnowledgeUnits() {
  const { user } = useAuth();

  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['ku-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('ku_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const balance = wallet?.balance ?? 0;
  const canChat = balance > 0;
  const canStartExam = balance >= 70;

  return { wallet, balance, canChat, canStartExam, isLoading, refetch };
}

export function useGroupWallet(groupId: string | undefined) {
  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['group-wallet', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data, error } = await supabase
        .from('group_wallets')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  return { wallet, balance: wallet?.balance ?? 0, isLoading, refetch };
}
