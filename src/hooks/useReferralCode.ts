import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useReferralCode() {
  const { user } = useAuth();

  const { data: referralCode, isLoading, refetch } = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Check if user already has a referral code
      const { data: existing } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) return existing.code;

      // Generate one
      const { data: code } = await supabase.rpc('generate_referral_code' as any, { _user_id: user.id });

      if (code) {
        await supabase.from('referral_codes').insert({ user_id: user.id, code });
        return code as string;
      }

      return null;
    },
    enabled: !!user,
  });

  const { data: referralCount = 0 } = useQuery({
    queryKey: ['referral-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_user_id', user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  return { referralCode, referralCount, isLoading, refetch };
}
