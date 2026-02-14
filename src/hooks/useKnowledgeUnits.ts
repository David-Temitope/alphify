import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function useKnowledgeUnits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBuyingSlot, setIsBuyingSlot] = useState(false);

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
  const librarySlots = wallet?.library_slots ?? 1;

  const buyLibrarySlot = async () => {
    if (!user || !wallet) return false;
    if (balance < 5) {
      toast({ title: 'Not enough KU', description: 'You need at least 5 KU to buy a library slot.', variant: 'destructive' });
      return false;
    }
    setIsBuyingSlot(true);
    try {
      // @ts-expect-error - purchase_library_slot is added via migration and might not be in the generated types yet
      const { error } = await supabase.rpc('purchase_library_slot');
      if (error) throw error;

      await refetch();
      toast({ title: 'Slot purchased!', description: 'You now have a new library slot.' });
      return true;
    } catch (error) {
      toast({
        title: 'Purchase failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsBuyingSlot(false);
    }
  };

  return { wallet, balance, canChat, canStartExam, librarySlots, buyLibrarySlot, isBuyingSlot, isLoading, refetch };
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
